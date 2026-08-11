import { prisma } from "@/lib/prisma";
import { isAuthorizedAppRequest } from "@/lib/auth";
import { clearPastPlannedWorkouts, runPendingReviewIfNeeded } from "@/lib/syncAndAnalyze";
import { estimateThresholdPace } from "@/lib/threshold";

export async function GET(req: Request) {
  if (!isAuthorizedAppRequest(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  await clearPastPlannedWorkouts();
  const reviewErrors = await runPendingReviewIfNeeded();

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

  const [plannedWorkouts, activities, recentEfforts, weekFocuses] = await Promise.all([
    prisma.plannedWorkout.findMany({ where: { date: range }, orderBy: { date: "asc" } }),
    prisma.activity.findMany({ where: { date: range }, orderBy: { date: "asc" } }),
    prisma.activity.findMany({ where: { date: { gte: ninetyDaysAgo }, avgPace: { not: null } } }),
    prisma.weekFocus.findMany({ where: { weekStart: focusRange }, orderBy: { weekStart: "asc" } }),
  ]);

  // Reference pace for classifying completed runs as easy/tempo/long on the client —
  // widened to 90 days (vs. the 7-day window used for weekly-mileage snapshots) since a
  // qualifying 20-70min hard effort doesn't show up in every week.
  const thresholdPaceSecPerKm = estimateThresholdPace(
    recentEfforts.map((a) => ({ date: a.date, distanceMeters: a.distance ?? 0, durationSeconds: a.duration }))
  );

  return Response.json({ plannedWorkouts, activities, reviewErrors, thresholdPaceSecPerKm, weekFocuses });
}

export async function POST(req: Request) {
  if (!isAuthorizedAppRequest(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const { date, type, description, targetDistance, targetDuration } = body ?? {};

  if (!date || !type || !description) {
    return Response.json({ error: "date, type, and description are required" }, { status: 400 });
  }

  const workout = await prisma.plannedWorkout.create({
    data: {
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
