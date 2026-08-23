import { syncAndAnalyze } from "@/lib/syncAndAnalyze";
import { getSessionUserId } from "@/lib/auth";

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const result = await syncAndAnalyze(userId);
  return Response.json(result);
}
