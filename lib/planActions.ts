import { prisma } from "./prisma";
import { generateInitialPlan, generateMaintenancePlan, commitProposedPlan, MAINTENANCE_WEEKS_AHEAD } from "./generatePlan";
import { computeTrainingSnapshot } from "./trainingSnapshot";

export type PlanAction =
  | {
      op: "update";
      workoutId: string;
      date?: string;
      type?: string;
      targetDistance?: number | null;
      targetDuration?: number | null;
      description?: string;
    }
  | {
      op: "add";
      date: string;
      type: string;
      targetDistance?: number | null;
      targetDuration?: number | null;
      description: string;
    }
  | { op: "remove"; workoutId: string }
  | {
      op: "regenerate";
      scope: "maintenance" | "goal";
      goalId?: string;
      // Populated by /api/chat before this action is ever shown to the user, so the client can
      // render the actual proposed plan as a preview card. Approving just commits these exact
      // workouts — it does not call the model again, so what you approve is what you saw.
      workouts?: any[];
      weekFocuses?: any[];
      planMessage?: string;
    };

export interface PlanActionResult {
  action: PlanAction;
  ok: boolean;
  message: string;
}

export async function buildGoalPlanInput(userId: string, goalId: string) {
  const goal = await prisma.goal.findUnique({ where: { id: goalId, userId } });
  if (!goal || !goal.targetDate) return null;

  const otherActiveGoalRows = await prisma.goal.findMany({ where: { userId, status: "active", id: { not: goal.id } } });
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

  const { currentWeeklyMileage, thresholdPace } = await computeTrainingSnapshot(userId);
  const weeksAvailable = Math.max(1, Math.ceil((goal.targetDate.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)));

  return {
    id: goal.id,
    title: goal.title,
    targetDate: goal.targetDate,
    targetMetric: goal.targetMetric as any,
    weeksAvailable,
    currentWeeklyMileage,
    thresholdPace,
    crossTrainingPreferences: [],
    otherActiveGoals,
  };
}

async function applyOne(userId: string, action: PlanAction): Promise<PlanActionResult> {
  switch (action.op) {
    case "update": {
      const existing = await prisma.plannedWorkout.findUnique({ where: { id: action.workoutId, userId } });
      if (!existing) return { action, ok: false, message: "Workout not found." };
      if (existing.status === "completed") return { action, ok: false, message: "Can't edit a completed workout." };

      const data: Record<string, unknown> = {};
      if (action.date) {
        data.originalDate = existing.originalDate ?? existing.date;
        data.date = new Date(action.date);
      }
      if (action.type) data.type = action.type;
      if (action.targetDistance !== undefined) data.targetDistance = action.targetDistance;
      if (action.targetDuration !== undefined) data.targetDuration = action.targetDuration;
      if (action.description) data.description = action.description;

      await prisma.plannedWorkout.update({ where: { id: action.workoutId }, data });
      return { action, ok: true, message: "Updated." };
    }

    case "add": {
      await prisma.plannedWorkout.create({
        data: {
          userId,
          date: new Date(action.date),
          type: action.type as any,
          targetDistance: action.targetDistance ?? null,
          targetDuration: action.targetDuration ?? null,
          description: action.description,
          source: "AI_GENERATED",
          status: "planned",
        },
      });
      return { action, ok: true, message: "Added." };
    }

    case "remove": {
      const existing = await prisma.plannedWorkout.findUnique({ where: { id: action.workoutId, userId } });
      if (!existing) return { action, ok: false, message: "Workout not found." };
      if (existing.status === "completed") return { action, ok: false, message: "Can't remove a completed workout." };

      await prisma.plannedWorkout.delete({ where: { id: action.workoutId } });
      return { action, ok: true, message: "Removed." };
    }

    case "regenerate": {
      // /api/chat already proposed and attached the actual workouts before this action was
      // ever shown to the user — commit exactly what they saw and approved, don't re-roll.
      if (action.workouts && action.workouts.length > 0) {
        const goalId = action.scope === "goal" ? action.goalId ?? null : null;
        await commitProposedPlan(userId, action.workouts, goalId, action.weekFocuses ?? []);
        return { action, ok: true, message: `Regenerated — ${action.workouts.length} workouts.` };
      }

      if (action.scope === "maintenance") {
        const { currentWeeklyMileage, thresholdPace } = await computeTrainingSnapshot(userId);
        const workouts = await generateMaintenancePlan(userId, {
          weeksAhead: MAINTENANCE_WEEKS_AHEAD,
          currentWeeklyMileage,
          thresholdPace,
          crossTrainingPreferences: [],
        });
        return { action, ok: true, message: `Regenerated maintenance plan — ${workouts.length} workouts.` };
      }

      if (!action.goalId) return { action, ok: false, message: "Missing goalId for goal regeneration." };
      const goalInput = await buildGoalPlanInput(userId, action.goalId);
      if (!goalInput) return { action, ok: false, message: "Goal not found or has no target date." };

      const workouts = await generateInitialPlan(userId, goalInput);
      return { action, ok: true, message: `Regenerated goal plan — ${workouts.length} workouts.` };
    }
  }
}

export async function applyPlanActions(userId: string, actions: PlanAction[]): Promise<PlanActionResult[]> {
  const results: PlanActionResult[] = [];
  for (const action of actions) {
    try {
      results.push(await applyOne(userId, action));
    } catch (err) {
      results.push({ action, ok: false, message: (err as Error).message });
    }
  }
  return results;
}
