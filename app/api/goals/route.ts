import { prisma } from "@/lib/prisma";
import { isAuthorizedAppRequest } from "@/lib/auth";
import { generateInitialPlan } from "@/lib/generatePlan";
import { computeTrainingSnapshot } from "@/lib/trainingSnapshot";

export async function GET(req: Request) {
  if (!isAuthorizedAppRequest(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const goals = await prisma.goal.findMany({ orderBy: { createdAt: "desc" } });
  return Response.json({ goals });
}

export async function POST(req: Request) {
  if (!isAuthorizedAppRequest(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const { title, targetDate, raceDistance, targetSeconds, crossTrainingPreferences } = body ?? {};

  if (!title || !targetDate) {
    return Response.json({ error: "title and targetDate are required" }, { status: 400 });
  }

  const otherActiveGoalRows = await prisma.goal.findMany({ where: { status: "active" } });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const otherActiveGoals = await Promise.all(
    otherActiveGoalRows.map(async (g) => ({
      title: g.title,
      targetDate: g.targetDate,
      targetMetric: g.targetMetric,
      upcomingWorkouts: await prisma.plannedWorkout.findMany({
        where: { goalId: g.id, date: { gte: startOfToday } },
        select: { date: true, type: true, description: true },
        orderBy: { date: "asc" },
      }),
    }))
  );

  const goal = await prisma.goal.create({
    data: {
      title,
      targetDate: new Date(targetDate),
      targetMetric: { type: "time", raceDistance: raceDistance ?? null, targetSeconds: targetSeconds ?? null },
      status: "active",
    },
  });

  const { currentWeeklyMileage, thresholdPace } = await computeTrainingSnapshot();
  const weeksAvailable = Math.max(
    1,
    Math.ceil((goal.targetDate!.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))
  );

  let workoutCount = 0;
  let planError: string | null = null;
  try {
    const workouts = await generateInitialPlan({
      id: goal.id,
      title: goal.title,
      targetDate: goal.targetDate!,
      targetMetric: goal.targetMetric as any,
      weeksAvailable,
      currentWeeklyMileage,
      thresholdPace,
      crossTrainingPreferences: crossTrainingPreferences ?? [],
      otherActiveGoals,
    });
    workoutCount = workouts.length;
  } catch (err) {
    planError = (err as Error).message;
  }

  return Response.json({ goal, workoutCount, planError }, { status: 201 });
}
