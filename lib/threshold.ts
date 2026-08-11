export interface HardEffort {
  date: Date;
  distanceMeters: number;
  durationSeconds: number;
}

const RIEGEL_EXPONENT = 1.06;

// Lower bound excludes short interval reps (where anaerobic capacity, not aerobic
// threshold, dominates and Riegel scaling stops being meaningful) while still admitting a
// fast 5K time trial — those commonly run under 20min for a fit recreational runner and
// were previously excluded entirely by a 20min floor, silently dropping the best signal.
const MIN_EFFORT_SECONDS = 480;
const MAX_EFFORT_SECONDS = 4200;

function paceSecPerKm(e: HardEffort): number {
  return e.durationSeconds / (e.distanceMeters / 1000);
}

function riegelProjectedPace(e: HardEffort): number {
  const referenceDurationMin = e.durationSeconds / 60;
  const scaleFactor = Math.pow(60 / referenceDurationMin, RIEGEL_EXPONENT - 1);
  return paceSecPerKm(e) * scaleFactor;
}

// Project each qualifying effort to a 60min-equivalent pace via Riegel, then take the
// fastest projection — threshold pace should reflect peak sustainable fitness, not
// whichever qualifying effort happened to be most recent or most typical.
export function estimateThresholdPace(recentEfforts: HardEffort[]): number {
  const candidates = recentEfforts.filter(
    (e) => e.durationSeconds >= MIN_EFFORT_SECONDS && e.durationSeconds <= MAX_EFFORT_SECONDS
  );
  if (candidates.length === 0) return 0;

  const projections = candidates.map(riegelProjectedPace);
  return round(Math.min(...projections));
}

export interface HrPaceSample {
  avgHr: number;
  avgPace: number; // sec/km
}

const MIN_HR_SAMPLES = 4;
const MIN_HR_SPREAD_BPM = 15; // need genuine intensity variation across samples to fit a meaningful line
const EXTRAPOLATION_TOLERANCE_BPM = 5; // how far past the observed HR range we'll still trust the fit

// Heart-rate-reserve (Karvonen) estimate of lactate threshold pace: fit a line across
// (HR, pace) samples spanning a range of efforts, then read off the pace at estimated LTHR.
// Karvonen anchors to the runner's own resting HR rather than assuming a "typical" HR range
// — %-of-max-HR zone tables are unreliable for anyone with an atypically low or high resting
// HR, since they implicitly assume everyone starts from roughly the same baseline.
export function estimateThresholdPaceFromHr(samples: HrPaceSample[], maxHr: number, restingHr: number): number | null {
  if (samples.length < MIN_HR_SAMPLES) return null;

  const hrs = samples.map((s) => s.avgHr);
  const hrMin = Math.min(...hrs);
  const hrMax = Math.max(...hrs);
  if (hrMax - hrMin < MIN_HR_SPREAD_BPM) return null;

  const n = samples.length;
  const meanHr = hrs.reduce((sum, h) => sum + h, 0) / n;
  const meanPace = samples.reduce((sum, s) => sum + s.avgPace, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (const s of samples) {
    numerator += (s.avgHr - meanHr) * (s.avgPace - meanPace);
    denominator += (s.avgHr - meanHr) ** 2;
  }
  if (denominator === 0) return null;

  const slope = numerator / denominator; // sec/km per bpm — expected negative (higher HR, faster pace)
  const intercept = meanPace - slope * meanHr;

  const LTHR_PERCENT_HRR = 0.88; // commonly cited midpoint of the 85-92% HRR lactate-threshold band
  const lthr = restingHr + LTHR_PERCENT_HRR * (maxHr - restingHr);

  // A linear HR/pace relationship bends as effort climbs toward and past threshold, so
  // extrapolating a line fit on easy-to-moderate runs far beyond their HR range is
  // speculative — better to fall back to Riegel than trust a wild extrapolation.
  if (lthr > hrMax + EXTRAPOLATION_TOLERANCE_BPM) return null;

  const predictedPace = intercept + slope * lthr;
  return predictedPace > 0 ? round(predictedPace) : null;
}

export function predictRaceTime(
  knownDistanceMeters: number,
  knownTimeSeconds: number,
  targetDistanceMeters: number
): number {
  return round(knownTimeSeconds * Math.pow(targetDistanceMeters / knownDistanceMeters, RIEGEL_EXPONENT));
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}
