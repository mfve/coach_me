import { getSessionUserId } from "@/lib/auth";
import { commitProposedPlan } from "@/lib/generatePlan";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const workouts = Array.isArray(body?.workouts) ? body.workouts : [];
  const weekFocuses = Array.isArray(body?.weekFocuses) ? body.weekFocuses : [];
  if (workouts.length === 0) {
    return Response.json({ error: "workouts array is required" }, { status: 400 });
  }

  await commitProposedPlan(userId, workouts, null, weekFocuses);
  return Response.json({ workoutCount: workouts.length }, { status: 201 });
}
