import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const profile = await prisma.userProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  return Response.json({ profile });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const {
    thresholdMethod,
    maxHr,
    restingHr,
    runsPerWeek,
    experienceLevel,
    injuryHistory,
    preferredTrainingDays,
    maxWeeklyHours,
    crossTrainingPrefs,
    notes,
  } = body ?? {};

  if (thresholdMethod && thresholdMethod !== "riegel" && thresholdMethod !== "hr") {
    return Response.json({ error: 'thresholdMethod must be "riegel" or "hr"' }, { status: 400 });
  }

  const fields = {
    thresholdMethod,
    maxHr,
    restingHr,
    runsPerWeek,
    experienceLevel,
    injuryHistory,
    preferredTrainingDays,
    maxWeeklyHours,
    crossTrainingPrefs,
    notes,
  };

  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) update[key] = value;
  }

  const profile = await prisma.userProfile.upsert({
    where: { userId },
    update,
    create: { userId, thresholdMethod: thresholdMethod ?? "riegel", ...update },
  });

  return Response.json({ profile });
}
