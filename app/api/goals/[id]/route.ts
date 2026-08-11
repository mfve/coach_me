import { prisma } from "@/lib/prisma";
import { isAuthorizedAppRequest } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isAuthorizedAppRequest(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const status = body?.status;

  if (status !== "abandoned" && status !== "achieved") {
    return Response.json({ error: "status must be 'abandoned' or 'achieved'" }, { status: 400 });
  }

  const goal = await prisma.goal.update({ where: { id: params.id }, data: { status } });

  // A goal that's no longer active shouldn't keep filling the calendar with its future
  // sessions — otherwise they linger and double up against the maintenance plan or a new
  // goal's plan. Completed workouts stay as history; only future planned ones are removed.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const { count } = await prisma.plannedWorkout.deleteMany({
    where: { goalId: params.id, status: "planned", date: { gte: startOfToday } },
  });

  return Response.json({ ...goal, removedWorkouts: count });
}
