import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { adjustUpcomingPlan } from "@/lib/syncAndAnalyze";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const { date, type, distance, duration, avgHr, perceivedEffort, notes } = body ?? {};

  if (!date || !type || !duration) {
    return Response.json({ error: "date, type, and duration (seconds) are required" }, { status: 400 });
  }

  if (perceivedEffort != null && (perceivedEffort < 1 || perceivedEffort > 10)) {
    return Response.json({ error: "perceivedEffort must be between 1 and 10" }, { status: 400 });
  }

  const avgPace = distance ? duration / (distance / 1000) : null;

  const activity = await prisma.activity.create({
    data: {
      userId,
      date: new Date(date),
      type,
      distance: distance ?? null,
      duration,
      avgHr: avgHr ?? null,
      avgPace,
      perceivedEffort: perceivedEffort ?? null,
      notes: notes ?? null,
      source: "manual",
    },
  });

  let adjustmentError: string | null = null;
  try {
    await adjustUpcomingPlan(userId);
  } catch (err) {
    adjustmentError = (err as Error).message;
  }

  return Response.json({ activity, adjustmentError }, { status: 201 });
}
