import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { clearPastPlannedWorkouts, runPendingReviewIfNeeded } from "@/lib/syncAndAnalyze";
import { estimateThresholdPace } from "@/lib/threshold";

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  await clearPastPlannedWorkouts(userId);
  const reviewErrors = await runPendingReviewIfNeeded(userId);

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return Response.json({ error: "start and end query params (YYYY-MM-DD) are required" }, { status: 400 });
  }

  const range = { gte: new Date(start), lte: new Date(`${end}T23:59:59.999Z`) };
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // A week whose Monday sits just before the month start still overlaps visible days, so widen
  // the week-focus lookup by a week on each side.
  const focusRange = {
    gte: new Date(new Date(start).getTime() - 7 * 86_400_000),
    lte: new Date(new Date(`${end}T23:59:59.999Z`).getTime() + 7 * 86_400_000),
  };

  // `splits` (Strava HR/time streams, cached lazily) and `mapPolyline` are never read outside
  // the streams route and the map feature that got dropped — pulling them into every calendar
  // load was serializing hundreds of KB of unused JSON per request. The visible-range query
  // still needs `splits` for the client's interval-detection (classifyRunType reads
  // `.splits.laps`), so it's stripped down to just `laps` below rather than dropped outright.
  const ACTIVITY_LIST_FIELDS = {
    id: true,
    date: true,
    type: true,
    distance: true,
    duration: true,
    avgHr: true,
    avgPace: true,
    perceivedEffort: true,
    notes: true,
    source: true,
    splits: true,
  } as const;

  const [plannedWorkouts, rawActivities, recentEfforts, weekFocuses] = await Promise.all([
    prisma.plannedWorkout.findMany({ where: { userId, date: range }, orderBy: { date: "asc" } }),
    prisma.activity.findMany({ where: { userId, date: range }, orderBy: { date: "asc" }, select: ACTIVITY_LIST_FIELDS }),
    prisma.activity.findMany({
      where: { userId, date: { gte: ninetyDaysAgo }, avgPace: { not: null } },
      select: { date: true, distance: true, duration: true },
    }),
    prisma.weekFocus.findMany({ where: { userId, weekStart: focusRange }, orderBy: { weekStart: "asc" } }),
  ]);

  const activities = rawActivities.map((a) => ({
    ...a,
    splits: (a.splits as any)?.laps ? { laps: (a.splits as any).laps } : null,
  }));

  // Reference pace for classifying completed runs as easy/tempo/long on the client —
  // widened to 90 days (vs. the 7-day window used for weekly-mileage snapshots) since a
  // qualifying 20-70min hard effort doesn't show up in every week.
  const thresholdPaceSecPerKm = estimateThresholdPace(
    recentEfforts.map((a) => ({ date: a.date, distanceMeters: a.distance ?? 0, durationSeconds: a.duration }))
  );

  return Response.json({ plannedWorkouts, activities, reviewErrors, thresholdPaceSecPerKm, weekFocuses });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const { date, type, description, targetDistance, targetDuration } = body ?? {};

  if (!date || !type || !description) {
    return Response.json({ error: "date, type, and description are required" }, { status: 400 });
  }

  const workout = await prisma.plannedWorkout.create({
    data: {
      userId,
      date: new Date(date),
      type,
      description,
      targetDistance: targetDistance ?? null,
      targetDuration: targetDuration ?? null,
      source: "USER",
      status: "planned",
    },
  });

  return Response.json(workout, { status: 201 });
}
