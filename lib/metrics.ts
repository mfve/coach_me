export interface DailyLoad {
  date: Date;
  load: number;
}

export interface CtlAtlPoint {
  date: Date;
  ctl: number;
  atl: number;
  tsb: number;
}

const CTL_DAYS = 42;
const ATL_DAYS = 7;

export function computeCtlAtl(dailyLoads: DailyLoad[]): CtlAtlPoint[] {
  const ctlLambda = 2 / (CTL_DAYS + 1);
  const atlLambda = 2 / (ATL_DAYS + 1);

  let ctl = 0;
  let atl = 0;
  const results: CtlAtlPoint[] = [];

  for (const day of dailyLoads) {
    ctl = day.load * ctlLambda + ctl * (1 - ctlLambda);
    atl = day.load * atlLambda + atl * (1 - atlLambda);

    results.push({
      date: day.date,
      ctl: round(ctl),
      atl: round(atl),
      tsb: round(ctl - atl),
    });
  }

  return results;
}

const MAX_MONOTONY = 10;

export function computeMonotonyStrain(dailyLoads: DailyLoad[]): { monotony: number; strain: number } {
  const loads = dailyLoads.map((d) => d.load);
  const mean = loads.reduce((a, b) => a + b, 0) / loads.length;
  const variance = loads.reduce((sum, l) => sum + (l - mean) ** 2, 0) / loads.length;
  const stdDev = Math.sqrt(variance);

  const monotony = stdDev === 0 ? (mean === 0 ? 0 : MAX_MONOTONY) : round(mean / stdDev);
  const weeklyLoad = loads.reduce((a, b) => a + b, 0);
  const strain = round(weeklyLoad * monotony);

  return { monotony, strain };
}

export function estimateLoad(
  activity: { distance?: number | null; avgPace?: number | null; durationSeconds?: number | null; perceivedEffort?: number | null },
  thresholdPaceSecPerKm: number
): number {
  if (activity.perceivedEffort && activity.durationSeconds) {
    return round((activity.durationSeconds / 60) * activity.perceivedEffort / 4);
  }

  if (!activity.distance) return 0;

  const distanceKm = activity.distance / 1000;
  const paceIntensity = activity.avgPace && thresholdPaceSecPerKm ? activity.avgPace / thresholdPaceSecPerKm : 1;
  return round(distanceKm * paceIntensity * 10);
}

export function buildDailyLoadSeries(
  activities: { date: Date; distance?: number | null; avgPace?: number | null; durationSeconds?: number | null; perceivedEffort?: number | null }[],
  days: number,
  thresholdPaceSecPerKm: number
): DailyLoad[] {
  const loadByDate = new Map<string, number>();
  for (const a of activities) {
    const key = a.date.toISOString().slice(0, 10);
    const dailyLoad = estimateLoad(a, thresholdPaceSecPerKm);
    loadByDate.set(key, (loadByDate.get(key) ?? 0) + dailyLoad);
  }

  const series: DailyLoad[] = [];
  const start = daysAgo(days);
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const key = date.toISOString().slice(0, 10);
    series.push({ date, load: loadByDate.get(key) ?? 0 });
  }
  return series;
}

export function computeAcwr(ctlAtl: CtlAtlPoint[]): number {
  const latest = ctlAtl[ctlAtl.length - 1];
  if (!latest || !latest.ctl) return 0;
  return round(latest.atl / latest.ctl);
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
