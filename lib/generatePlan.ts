import { prisma } from "./prisma";
import { agentQuery, parseAgentJson } from "./agentClient";
import { formatProfileForPrompt } from "./context";
import type { RunExample } from "./trainingSnapshot";

async function profileBlock(): Promise<string> {
  const profile = await prisma.userProfile.findUnique({ where: { id: "singleton" } });
  return formatProfileForPrompt(profile);
}

export interface OtherGoalContext {
  title: string;
  targetDate: Date | null;
  targetMetric: any;
  upcomingWorkouts: { date: Date; type: string; description: string }[];
}

export interface GoalInput {
  id: string;
  title: string;
  targetDate: Date;
  targetMetric: { type: string; raceDistance?: string; targetSeconds?: number };
  weeksAvailable: number;
  currentWeeklyMileage: number;
  thresholdPace: number;
  crossTrainingPreferences: string[];
  otherActiveGoals: OtherGoalContext[];
}

export interface MaintenanceInput {
  weeksAhead: number;
  currentWeeklyMileage: number;
  thresholdPace: number;
  crossTrainingPreferences: string[];
  runsPerWeek?: number | null;
  recentRunExamples?: RunExample[];
}

export const MAINTENANCE_WEEKS_AHEAD = 4;

export interface WeekFocus {
  weekStart: string; // YYYY-MM-DD, the Monday of the week
  focus: string;
}

export interface ProposedPlan {
  message: string;
  workouts: any[];
  weekFocuses: WeekFocus[];
}

const RESPONSE_SCHEMA = `Return ONLY a JSON object, no other text:
{
  "message": string, // a short note in your own voice as their coach introducing this plan (1-3 sentences) — this is shown directly to the user, so write it like a coach would, not like a changelog
  "weekFocuses": [
    {
      "weekStart": "YYYY-MM-DD", // the Monday of the week
      "focus": string // one short phrase naming what that week is FOR, e.g. "Base — hold volume, controlled effort", "Build — first threshold progression", "Sharpen — race-pace work", "Taper — freshen up". Every week in the plan must have one.
    }
  ],
  "workouts": [
    {
      "date": "YYYY-MM-DD",
      "type": "EASY_RUN" | "TEMPO_RUN" | "INTERVALS" | "LONG_RUN" | "RACE" | "STRENGTH" | "HIIT" | "MTB" | "CYCLING" | "SWIM" | "MOBILITY" | "REST",
      "targetDistance": number | null, // meters
      "targetDuration": number | null, // minutes
      "description": string
    }
  ]
}`;

const MIN_RUN_DISTANCE_NOTE =
  "- Every running session (any type) should be at least 5km — anything shorter isn't worth lacing up for.";

const LONG_RUN_GAP_NOTE =
  "- A long run needs to actually feel long: at least 60-80% further than that week's easy runs, not just marginally longer. A long run barely bigger than an easy run defeats its purpose.";

const WEEK_FOCUS_NOTE =
  "- Give each week a clear focus/theme (what is this week building toward?) and return it in weekFocuses — the runner should be able to see the intent of each week at a glance, not just the sessions.";

function formatRunExamples(examples: RunExample[] | undefined): string {
  if (!examples || examples.length === 0) {
    return "None available — no distance/pace history to reference, use judgment from the mileage and threshold pace above.";
  }
  return JSON.stringify(
    examples.map((e) => ({
      distanceKm: e.distanceKm,
      durationMin: e.durationMin,
      paceSecPerKm: e.paceSecPerKm,
    }))
  );
}

// Normalize any date to the Monday 00:00 of its week, so week-focus rows have a stable key
// regardless of which day the model returned.
function mondayOf(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function commitPlan(workouts: any[], goalId: string | null, weekFocuses: WeekFocus[] = []) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  await prisma.plannedWorkout.deleteMany({
    where: { source: "AI_GENERATED", status: "planned", date: { gte: startOfToday }, goalId },
  });

  await prisma.plannedWorkout.createMany({
    data: workouts.map((w: any) => ({
      date: new Date(w.date),
      type: w.type,
      targetDistance: w.targetDistance,
      targetDuration: w.targetDuration,
      description: w.description,
      goalId,
      source: "AI_GENERATED",
      status: "planned",
    })),
  });

  // Replace this plan's week focuses. Deduped by Monday since the model occasionally emits a
  // weekStart on a non-Monday day.
  await prisma.weekFocus.deleteMany({ where: { goalId, weekStart: { gte: startOfToday } } });
  const focusByWeek = new Map<number, { weekStart: Date; focus: string }>();
  for (const wf of weekFocuses) {
    if (!wf?.weekStart || !wf?.focus) continue;
    const monday = mondayOf(wf.weekStart);
    focusByWeek.set(monday.getTime(), { weekStart: monday, focus: wf.focus });
  }
  if (focusByWeek.size > 0) {
    await prisma.weekFocus.createMany({
      data: [...focusByWeek.values()].map((f) => ({ weekStart: f.weekStart, focus: f.focus, goalId })),
      skipDuplicates: true,
    });
  }
}

function formatOtherGoals(otherActiveGoals: OtherGoalContext[]): string {
  if (otherActiveGoals.length === 0) return "None — this is the only active goal.";
  return JSON.stringify(
    otherActiveGoals.map((g) => ({
      title: g.title,
      targetDate: g.targetDate?.toISOString().slice(0, 10) ?? null,
      targetMetric: g.targetMetric,
      upcomingWorkouts: g.upcomingWorkouts.map((w) => ({
        date: w.date.toISOString().slice(0, 10),
        type: w.type,
        description: w.description,
      })),
    }))
  );
}

export async function proposeInitialPlan(goal: GoalInput): Promise<ProposedPlan> {
  const prompt = `You are a running coach building a structured training plan for someone you
coach. Talk to them directly, like a coach would, not like a plan-generation service.

Runner profile — honour these preferences and constraints:
${await profileBlock()}

Goal: ${goal.title}
Target date: ${goal.targetDate.toISOString().slice(0, 10)}
Target metric: ${JSON.stringify(goal.targetMetric)}
Weeks available: ${goal.weeksAvailable}
Current weekly mileage: ${goal.currentWeeklyMileage}km
Current threshold pace: ${goal.thresholdPace}s/km
Cross-training to include: ${goal.crossTrainingPreferences.join(", ") || "none specified"}

Other active goals being trained for at the same time, with their existing planned workouts —
coordinate around these. Don't schedule a hard session on a day that already has a hard session
from another goal's plan; balance total weekly load across all active goals, not just this one:
${formatOtherGoals(goal.otherActiveGoals)}

Generate a week-by-week training plan following standard periodization principles:
- Build phase -> peak phase -> taper, appropriate for the distance and weeks available
- Weekly mileage should progress gradually (no more than ~10% week-over-week increase)
${MIN_RUN_DISTANCE_NOTE}
${LONG_RUN_GAP_NOTE}
- Include at least one cross-training session per week if preferences were specified
- Include rest/recovery days
- Respect the target date as the final week (race week = taper, minimal load)
${WEEK_FOCUS_NOTE}

${RESPONSE_SCHEMA}`;

  return requestPlan(prompt, "Plan generation");
}

export async function generateInitialPlan(goal: GoalInput) {
  const { workouts, weekFocuses } = await proposeInitialPlan(goal);
  await commitPlan(workouts, goal.id, weekFocuses);
  return workouts;
}

export async function proposeMaintenancePlan(input: MaintenanceInput): Promise<ProposedPlan> {
  const runsPerWeekNote = input.runsPerWeek
    ? `- Exactly ${input.runsPerWeek} running sessions per week.`
    : "- Choose a sensible number of running sessions per week based on the mileage and recent examples below.";

  const prompt = `You are a running coach checking in with someone you coach — there's no
specific race or goal right now, just ongoing training. Talk to them directly, like a coach
would, not like a plan-generation service.

Runner profile — honour these preferences and constraints:
${await profileBlock()}

Weeks to plan: ${input.weeksAhead}
Current weekly mileage: ${input.currentWeeklyMileage}km
Current threshold pace: ${input.thresholdPace}s/km
Cross-training to include: ${input.crossTrainingPreferences.join(", ") || "none specified"}

Recent runs actually completed (distance, duration, pace) — use these as real evidence of what
this runner can currently handle. Don't undersize sessions relative to what they've already
demonstrated, especially the faster/longer ones here:
${formatRunExamples(input.recentRunExamples)}

Generate a ${input.weeksAhead}-week rolling training plan starting today that maintains
current fitness — NOT a build-up plan:
- Keep weekly mileage roughly level with the current mileage above, no progressive overload
${MIN_RUN_DISTANCE_NOTE}
${LONG_RUN_GAP_NOTE}
${runsPerWeekNote}
- Include variety: mostly easy sessions, at most one moderate/tempo session per week
- Include rest/recovery days
- Include cross-training sessions if preferences were specified
- No taper or peak — this just needs to sustain fitness until a real goal is set
${WEEK_FOCUS_NOTE}

${RESPONSE_SCHEMA}`;

  return requestPlan(prompt, "Maintenance plan generation");
}

export async function generateMaintenancePlan(input: MaintenanceInput) {
  const { workouts, weekFocuses } = await proposeMaintenancePlan(input);
  await commitPlan(workouts, null, weekFocuses);
  return workouts;
}

export async function commitProposedPlan(
  workouts: any[],
  goalId: string | null,
  weekFocuses: WeekFocus[] = []
) {
  await commitPlan(workouts, goalId, weekFocuses);
  return workouts;
}

async function requestPlan(prompt: string, label: string): Promise<ProposedPlan> {
  let response: string;
  try {
    response = await agentQuery({ prompt });
  } catch (err) {
    throw new Error(`${label} failed: ${(err as Error).message}`);
  }

  const parsed = parseAgentJson(response);
  const workouts = Array.isArray(parsed?.workouts) ? parsed.workouts : [];
  if (workouts.length === 0) {
    throw new Error(`${label} returned no usable workouts — Claude response was empty or not valid JSON.`);
  }

  const weekFocuses: WeekFocus[] = Array.isArray(parsed?.weekFocuses)
    ? parsed.weekFocuses.filter((w: any) => w?.weekStart && w?.focus)
    : [];

  return { message: typeof parsed?.message === "string" ? parsed.message : "", workouts, weekFocuses };
}
