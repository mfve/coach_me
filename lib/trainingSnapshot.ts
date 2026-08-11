import { prisma } from "./prisma";
import { estimateThresholdPace, estimateThresholdPaceFromHr } from "./threshold";

// A single trailing week is noisy — one rest/travel/injury week reads as "current mileage"
// and undersizes the whole plan. Averaging over 4 weeks smooths that out. "Mileage" here is
// total training volume (runs, hikes, rides, anything with distance) — someone who
// cross-trains heavily has real volume beyond just running, and sizing the plan off
// running-only distance understates their actual current load.
const MILEAGE_WINDOW_DAYS = 28;

// Threshold pace reflects underlying fitness, which decays much slower than training volume —
// a strong 5K from two months ago is still real evidence of capability, so this looks back
// much further than the mileage window rather than sharing it.
const THRESHOLD_LOOKBACK_DAYS = 90;

export async function computeTrainingSnapshot() {
  const mileageWindowStart = new Date();
  mileageWindowStart.setDate(mileageWindowStart.getDate() - MILEAGE_WINDOW_DAYS);

  const recentActivities = await prisma.activity.findMany({ where: { date: { gte: mileageWindowStart } } });

  const totalVolumeKm = recentActivities.reduce((sum, a) => sum + (a.distance ?? 0), 0) / 1000;
  const currentWeeklyMileage = Math.round((totalVolumeKm / (MILEAGE_WINDOW_DAYS / 7)) * 10) / 10;

  const thresholdWindowStart = new Date();
  thresholdWindowStart.setDate(thresholdWindowStart.getDate() - THRESHOLD_LOOKBACK_DAYS);

  // Threshold pace specifically needs running efforts — a hike's pace isn't a running signal.
  const thresholdActivities = await prisma.activity.findMany({ where: { date: { gte: thresholdWindowStart } } });
  const runningActivities = thresholdActivities.filter((a) => a.type.toLowerCase().includes("run"));

  const profile = await prisma.userProfile.findUnique({ where: { id: "singleton" } });

  let thresholdPace: number | null = null;
  if (profile?.thresholdMethod === "hr" && profile.maxHr && profile.restingHr) {
    const hrSamples = runningActivities
      .filter((a) => a.avgHr && a.avgPace)
      .map((a) => ({ avgHr: a.avgHr!, avgPace: a.avgPace! }));
    thresholdPace = estimateThresholdPaceFromHr(hrSamples, profile.maxHr, profile.restingHr);
  }

  if (!thresholdPace) {
    const hardEfforts = runningActivities
      .filter((a) => a.avgPace)
      .map((a) => ({ date: a.date, distanceMeters: a.distance ?? 0, durationSeconds: a.duration }));
    thresholdPace = estimateThresholdPace(hardEfforts);
  }

  return { currentWeeklyMileage, thresholdPace };
}

export interface RunExample {
  distanceKm: number;
  paceSecPerKm: number;
  durationMin: number;
}

const RUN_EXAMPLES_LOOKBACK_DAYS = 90;
const MAX_RUN_EXAMPLES = 5;

// Plan generation only gets a single thresholdPace number otherwise — without concrete
// examples of runs actually completed, it tends to guess conservatively small distances
// even for someone who regularly runs much further at quality effort. Surfacing the longest
// and fastest recent runs directly grounds the plan in demonstrated capability.
export async function getRecentRunExamples(): Promise<RunExample[]> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - RUN_EXAMPLES_LOOKBACK_DAYS);

  const activities = await prisma.activity.findMany({ where: { date: { gte: windowStart } } });
  const runs = activities.filter((a) => a.type.toLowerCase().includes("run") && a.distance && a.avgPace);

  const toExample = (a: (typeof runs)[number]): RunExample => ({
    distanceKm: Math.round((a.distance! / 1000) * 10) / 10,
    paceSecPerKm: Math.round(a.avgPace!),
    durationMin: Math.round(a.duration / 60),
  });

  const longest = [...runs].sort((a, b) => b.distance! - a.distance!).slice(0, 3).map(toExample);
  const fastest = [...runs].sort((a, b) => a.avgPace! - b.avgPace!).slice(0, 3).map(toExample);

  const seen = new Set<string>();
  const examples: RunExample[] = [];
  for (const e of [...longest, ...fastest]) {
    const key = `${e.distanceKm}-${e.durationMin}`;
    if (seen.has(key)) continue;
    seen.add(key);
    examples.push(e);
    if (examples.length >= MAX_RUN_EXAMPLES) break;
  }
  return examples;
}
