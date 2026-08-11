import { prisma } from "@/lib/prisma";
import { isAuthorizedAppRequest } from "@/lib/auth";
import { proposeMaintenancePlan, MAINTENANCE_WEEKS_AHEAD } from "@/lib/generatePlan";
import { computeTrainingSnapshot, getRecentRunExamples } from "@/lib/trainingSnapshot";

export async function POST(req: Request) {
  if (!isAuthorizedAppRequest(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const hasActiveGoal = await prisma.goal.findFirst({ where: { status: "active" } });
  if (hasActiveGoal) {
    return Response.json(
      { error: "An active goal already exists — generate a goal-based plan instead of a maintenance plan." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { currentWeeklyMileage, thresholdPace } = await computeTrainingSnapshot();
  const recentRunExamples = await getRecentRunExamples();
  const profile = await prisma.userProfile.findUnique({ where: { id: "singleton" } });

  try {
    const { message, workouts, weekFocuses } = await proposeMaintenancePlan({
      weeksAhead: MAINTENANCE_WEEKS_AHEAD,
      currentWeeklyMileage: body?.targetWeeklyMileage ?? currentWeeklyMileage,
      thresholdPace,
      crossTrainingPreferences: body?.crossTrainingPreferences ?? [],
      runsPerWeek: body?.runsPerWeek ?? profile?.runsPerWeek ?? null,
      recentRunExamples,
    });
    return Response.json({ message, workouts, weekFocuses }, { status: 200 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
