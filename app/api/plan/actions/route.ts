import { getSessionUserId } from "@/lib/auth";
import { applyPlanActions, type PlanAction } from "@/lib/planActions";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const actions: PlanAction[] = Array.isArray(body?.actions) ? body.actions : [];
  if (actions.length === 0) {
    return Response.json({ error: "actions array is required" }, { status: 400 });
  }

  const results = await applyPlanActions(userId, actions);
  return Response.json({ results });
}
