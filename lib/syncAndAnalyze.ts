import { prisma } from "./prisma";
import { buildDailyLoadSeries, computeCtlAtl, computeMonotonyStrain, computeAcwr } from "./metrics";
import { estimateThresholdPace } from "./threshold";
import { agentQuery, parseAgentJson } from "./agentClient";
import { refreshStravaToken, fetchStravaActivities as fetchFromStrava, StravaActivity } from "./strava";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export async function getValidStravaToken(userId: string): Promise<{ accessToken: string }> {
  const auth = await prisma.stravaAuth.findUnique({ where: { userId } });
  if (!auth) {
    throw new Error("Strava not connected — visit /api/strava/connect first");
  }

  if (auth.expiresAt.getTime() - TOKEN_REFRESH_BUFFER_MS > Date.now()) {
    return { accessToken: auth.accessToken };
  }

  const refreshed = await refreshStravaToken(auth.refreshToken);
  await prisma.stravaAuth.update({
    where: { userId },
    data: {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: refreshed.expiresAt,
    },
  });
  return { accessToken: refreshed.accessToken };
}

const DAILY_SYNC_LOOKBACK_DAYS = 14;

async function fetchStravaActivities(accessToken: string): Promise<StravaActivity[]> {
  const afterEpochSeconds = Math.floor(daysAgo(DAILY_SYNC_LOOKBACK_DAYS).getTime() / 1000);
  return fetchFromStrava(accessToken, afterEpochSeconds);
}

const BACKFILL_LOOKBACK_DAYS = 90;

export async function backfillStravaActivities(userId: string): Promise<number> {
  const auth = await getValidStravaToken(userId);
  const afterEpochSeconds = Math.floor(daysAgo(BACKFILL_LOOKBACK_DAYS).getTime() / 1000);
  const activities = await fetchFromStrava(auth.accessToken, afterEpochSeconds);
  const newCount = await upsertActivities(userId, activities);
  await matchActivitiesToPlannedWorkouts(userId);
  return newCount;
}

function toDateOnly(isoLocal: string): Date {
  return new Date(isoLocal.slice(0, 10));
}

async function upsertActivities(userId: string, activities: StravaActivity[]): Promise<number> {
  if (activities.length === 0) return 0;

  const stravaIds = activities.map((a) => String(a.id));
  const existing = await prisma.activity.findMany({
    where: { userId, stravaId: { in: stravaIds } },
    select: { stravaId: true },
  });
  const existingIds = new Set(existing.map((e) => e.stravaId));

  let newCount = 0;
  for (const a of activities) {
    const stravaId = String(a.id);
    const distance = a.distance > 0 ? a.distance : null;
    const duration = a.moving_time;
    const avgPace = distance ? duration / (distance / 1000) : null;

    const data = {
      source: "strava",
      date: toDateOnly(a.start_date_local),
      type: a.type,
      distance,
      duration,
      avgHr: a.average_heartrate ?? null,
      avgPace,
      mapPolyline: a.map?.summary_polyline ?? null,
      elevation: a.total_elevation_gain ?? null,
    };

    if (existingIds.has(stravaId)) {
      await prisma.activity.update({ where: { userId_stravaId: { userId, stravaId } }, data });
    } else {
      await prisma.activity.create({ data: { ...data, userId, stravaId } });
      newCount++;
    }
  }

  return newCount;
}

export async function clearPastPlannedWorkouts(userId: string): Promise<number> {
  const result = await prisma.plannedWorkout.deleteMany({
    where: {
      userId,
      date: { lt: today() },
      status: "planned",
      completedActivityId: null,
    },
  });
  return result.count;
}

export async function syncAndAnalyze(userId: string) {
  let newCount = 0;

  try {
    const auth = await getValidStravaToken(userId);
    const activities = await fetchStravaActivities(auth.accessToken);
    newCount = await upsertActivities(userId, activities);
    await matchActivitiesToPlannedWorkouts(userId);
  } finally {
    await clearPastPlannedWorkouts(userId);
  }

  if (newCount > 0) {
    await prisma.pendingReview.upsert({
      where: { userId },
      create: { userId, planAdjustment: true },
      update: { planAdjustment: true },
    });
  }

  return { newCount };
}

export async function flagPendingWeeklyRecommendation(userId: string) {
  await prisma.pendingReview.upsert({
    where: { userId },
    create: { userId, weeklyRecommendation: true },
    update: { weeklyRecommendation: true },
  });
}

export async function runPendingReviewIfNeeded(userId: string): Promise<string[]> {
  const state = await prisma.pendingReview.findUnique({ where: { userId } });
  if (!state || (!state.planAdjustment && !state.weeklyRecommendation)) return [];

  const errors: string[] = [];

  if (state.planAdjustment) {
    try {
      await adjustUpcomingPlan(userId);
    } catch (err) {
      errors.push(`adjustUpcomingPlan: ${(err as Error).message}`);
    }
  }

  if (state.weeklyRecommendation) {
    try {
      await maybeGenerateWeeklyRecommendation();
    } catch (err) {
      errors.push(`maybeGenerateWeeklyRecommendation: ${(err as Error).message}`);
    }
  }

  await prisma.pendingReview.update({
    where: { userId },
    data: { planAdjustment: false, weeklyRecommendation: false },
  });

  return errors;
}

const RUN_TYPES = new Set(["EASY_RUN", "TEMPO_RUN", "LONG_RUN", "INTERVALS", "RACE"]);
const RIDE_TYPES = new Set(["CYCLING", "MTB"]);
const SWIM_TYPES = new Set(["SWIM"]);
const STRENGTH_TYPES = new Set(["STRENGTH", "HIIT"]);

function activityTypeFamily(stravaType: string): Set<string> | null {
  const t = stravaType.toLowerCase();
  if (t.includes("run")) return RUN_TYPES;
  if (t.includes("ride") || t === "cycling") return RIDE_TYPES;
  if (t.includes("swim")) return SWIM_TYPES;
  if (t.includes("weight") || t.includes("workout") || t.includes("strength")) return STRENGTH_TYPES;
  return null;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function matchActivitiesToPlannedWorkouts(userId: string) {
  const unmatchedPlanned = await prisma.plannedWorkout.findMany({
    where: { userId, status: "planned", completedActivityId: null },
  });
  if (unmatchedPlanned.length === 0) return;

  const unmatchedActivities = await prisma.activity.findMany({
    where: { userId, plannedWorkout: null },
    select: { id: true, type: true, date: true, distance: true },
  });
  if (unmatchedActivities.length === 0) return;

  const claimed = new Set<string>();

  for (const activity of unmatchedActivities) {
    const family = activityTypeFamily(activity.type);
    if (!family) continue;

    const activityDateKey = dateKey(activity.date);
    const candidates = unmatchedPlanned.filter(
      (w) => !claimed.has(w.id) && dateKey(w.date) === activityDateKey && family.has(w.type)
    );
    if (candidates.length === 0) continue;

    const best =
      candidates.length === 1
        ? candidates[0]
        : candidates.reduce((closest, w) => {
            if (!w.targetDistance || !activity.distance) return closest;
            if (!closest.targetDistance) return w;
            const closestDiff = Math.abs(closest.targetDistance - activity.distance);
            const wDiff = Math.abs(w.targetDistance - activity.distance);
            return wDiff < closestDiff ? w : closest;
          }, candidates[0]);

    await prisma.plannedWorkout.update({
      where: { id: best.id },
      data: { status: "completed", completedActivityId: activity.id },
    });
    claimed.add(best.id);
  }
}

export async function maybeGenerateWeeklyRecommendation() {}

export async function adjustUpcomingPlan(userId: string) {
  const recentActivities = await prisma.activity.findMany({
    where: { userId, date: { gte: daysAgo(7) } },
    orderBy: { date: "asc" },
    // This gets JSON.stringify'd straight into the Claude prompt below — selecting only the
    // fields actually useful as context keeps the cached HR/pace streams (splits) and
    // map polyline out of both the DB round trip and the token count.
    select: { date: true, type: true, distance: true, duration: true, avgPace: true, avgHr: true, perceivedEffort: true, notes: true },
  });

  const loadWindowActivities = await prisma.activity.findMany({
    where: { userId, date: { gte: daysAgo(42) } },
    orderBy: { date: "asc" },
    select: { date: true, distance: true, duration: true, avgPace: true, perceivedEffort: true },
  });

  const upcomingPlanned = await prisma.plannedWorkout.findMany({
    where: {
      userId,
      date: { gte: today(), lte: daysFromNow(7) },
      status: "planned",
      source: "AI_GENERATED",
    },
  });

  if (upcomingPlanned.length === 0) return;

  const hardEfforts = recentActivities
    .filter((a): a is typeof a & { distance: number } => Boolean(a.avgPace && a.distance))
    .map((a) => ({ date: a.date, distanceMeters: a.distance, durationSeconds: a.duration }));
  const thresholdPace = estimateThresholdPace(hardEfforts);

  const dailyLoads = buildDailyLoadSeries(
    loadWindowActivities.map((a) => ({
      date: a.date,
      distance: a.distance,
      avgPace: a.avgPace,
      durationSeconds: a.duration,
      perceivedEffort: a.perceivedEffort,
    })),
    42,
    thresholdPace
  );
  const ctlAtl = computeCtlAtl(dailyLoads);
  const { monotony, strain } = computeMonotonyStrain(dailyLoads.slice(-7));
  const acwr = computeAcwr(ctlAtl);
  const latest = ctlAtl[ctlAtl.length - 1];

  const metrics = { ctl: latest?.ctl, atl: latest?.atl, tsb: latest?.tsb, monotony, strain, acwr };

  const response = await agentQuery({
    prompt: `Recent runs (last 7 days): ${JSON.stringify(recentActivities)}
Computed load metrics: ${JSON.stringify(metrics)}
Upcoming planned workouts: ${JSON.stringify(upcomingPlanned)}

Some activities include perceivedEffort (self-reported RPE, 1-10) — weigh
this alongside the computed load metrics. A high RPE on a session that looks
easy on paper (short distance/duration) is a real signal of harder-than-usual
effort, and should be treated as such even though it isn't reflected in ACWR
or CTL/ATL trends the same way pace-based sessions are.

If the recent load suggests any upcoming planned workout should change
(reduce intensity, swap to rest, shift a day), return ONLY a JSON array of
{ plannedWorkoutId, action: "keep"|"reduce"|"rest"|"reschedule", newDate, reason }.
Otherwise return an empty array. Return JSON only, no other text.`,
  });

  const adjustments = parseJsonResponse(response);
  await applyAdjustments(userId, adjustments);
}

async function applyAdjustments(userId: string, adjustments: any[]) {
  for (const adj of adjustments) {
    if (adj.action === "keep") continue;

    const data: { date?: Date; originalDate?: Date; adjustmentReason: string } = {
      adjustmentReason: adj.reason,
    };

    const current = await prisma.plannedWorkout.findUnique({
      where: { id: adj.plannedWorkoutId, userId },
      select: { date: true, originalDate: true },
    });
    if (!current) continue;

    if (adj.newDate) {
      data.originalDate = current.originalDate ?? current.date;
      data.date = new Date(adj.newDate);
    }

    await prisma.plannedWorkout.update({
      where: { id: adj.plannedWorkoutId },
      data,
    });
  }
}

function parseJsonResponse(response: string): any[] {
  const parsed = parseAgentJson(response);
  return Array.isArray(parsed) ? parsed : [];
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}
function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
