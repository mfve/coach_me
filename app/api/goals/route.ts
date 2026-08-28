import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateInitialPlan } from "@/lib/generatePlan";
import { computeTrainingSnapshot } from "@/lib/trainingSnapshot";

// Plan generation can take 30-45s (a full multi-week JSON plan from Gemini) — Vercel's
// default serverless timeout is well under that, so this needs to be raised explicitly.
export const maxDuration = 60;

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const goals = await prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return Response.json({ goals });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const { title, targetDate, raceDistance, targetSeconds, crossTrainingPreferences } = body ?? {};

  if (!title || !targetDate) {
    return Response.json({ error: "title and targetDate are required" }, { status: 400 });
  }

  const otherActiveGoalRows = await prisma.goal.findMany({ where: { userId, status: "active" } });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const otherActiveGoals = await Promise.all(
    otherActiveGoalRows.map(async (g) => ({
      title: g.title,
      targetDate: g.targetDate,
      targetMetric: g.targetMetric,
      upcomingWorkouts: await prisma.plannedWorkout.findMany({
        where: { userId, goalId: g.id, date: { gte: startOfToday } },
        select: { date: true, type: true, description: true },
        orderBy: { date: "asc" },
      }),
    }))
  );

  const goal = await prisma.goal.create({
    data: {
      userId,
      title,
      targetDate: new Date(targetDate),
      targetMetric: { type: "time", raceDistance: raceDistance ?? null, targetSeconds: targetSeconds ?? null },
      status: "active",
    },
  });

  const { currentWeeklyMileage, thresholdPace } = await computeTrainingSnapshot(userId);
  const weeksAvailable = Math.max(
    1,
    Math.ceil((goal.targetDate!.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))
  );

  let workoutCount = 0;
  let planError: string | null = null;
  try {
    const workouts = await generateInitialPlan(userId, {
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
