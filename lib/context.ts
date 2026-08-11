import { prisma } from "./prisma";

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

function summarizeActivities(activities: any[]) {
  return activities.map((a) => ({
    date: a.date,
    type: a.type,
    distance: a.distance,
    duration: a.duration,
    avgPace: a.avgPace,
    avgHr: a.avgHr,
    perceivedEffort: a.perceivedEffort,
    notes: a.notes,
  }));
}

export async function buildUserContext() {
  const profile = await prisma.userProfile.findUnique({ where: { id: "singleton" } });

  const recentActivities = await prisma.activity.findMany({
    where: { date: { gte: daysAgo(28) } },
    orderBy: { date: "desc" },
    select: { date: true, type: true, distance: true, duration: true, avgPace: true, avgHr: true, perceivedEffort: true, notes: true },
  });

  const latestMetrics = await prisma.dailyMetrics.findFirst({ orderBy: { date: "desc" } });

  const activeGoals = await prisma.goal.findMany({ where: { status: "active" } });

  const upcomingWorkouts = await prisma.plannedWorkout.findMany({
    where: { date: { gte: today(), lte: daysFromNow(10) } },
    orderBy: { date: "asc" },
  });

  const recentRecommendations = await prisma.recommendation.findMany({
    orderBy: { createdAt: "desc" },
    take: 2,
  });

  return {
    profile: profile ?? null,
    recentActivities: summarizeActivities(recentActivities),
    metrics: latestMetrics,
    activeGoals,
    upcomingWorkouts,
    recentRecommendations: recentRecommendations.map((r) => r.summary),
  };
}

const DAY_LABELS: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

// Human-readable profile block for plan-generation and chat prompts. A raw JSON dump buries
// the qualitative preferences (injuries, "I run with a friend Thursdays") that most affect how
// a plan should be shaped, so this pulls them out as plain instructions the model can act on.
export function formatProfileForPrompt(profile: any): string {
  if (!profile) return "No profile set — use sensible defaults.";

  const lines: string[] = [];
  if (profile.experienceLevel) lines.push(`- Experience level: ${profile.experienceLevel}`);
  if (profile.injuryHistory) lines.push(`- Injury history / constraints: ${profile.injuryHistory}`);

  const days = profile.preferredTrainingDays as Record<string, boolean> | null;
  if (days && Object.values(days).some(Boolean)) {
    const preferred = Object.entries(days)
      .filter(([, on]) => on)
      .map(([k]) => DAY_LABELS[k] ?? k);
    lines.push(`- Preferred training days: ${preferred.join(", ")} (favour these for harder sessions; avoid scheduling key workouts on non-preferred days where possible)`);
  }

  if (profile.maxWeeklyHours) lines.push(`- Max weekly training hours: ${profile.maxWeeklyHours}`);
  const cross = profile.crossTrainingPrefs as string[] | null;
  if (cross && cross.length > 0) lines.push(`- Cross-training preferences: ${cross.join(", ")}`);
  if (profile.notes) lines.push(`- Personal notes (honour these): ${profile.notes}`);

  return lines.length > 0 ? lines.join("\n") : "No specific preferences set — use sensible defaults.";
}

export function formatContextForPrompt(context: Awaited<ReturnType<typeof buildUserContext>>): string {
  return `
Runner profile:
${formatProfileForPrompt(context.profile)}
Current training load metrics: ${JSON.stringify(context.metrics)}
Active goals: ${JSON.stringify(context.activeGoals)}
Upcoming planned workouts: ${JSON.stringify(context.upcomingWorkouts)}
Recent weekly recommendations: ${JSON.stringify(context.recentRecommendations)}
Recent activities (last 28 days): ${JSON.stringify(context.recentActivities)}
`.trim();
}
