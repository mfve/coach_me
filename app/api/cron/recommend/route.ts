import { flagPendingWeeklyRecommendation } from "@/lib/syncAndAnalyze";
import { isAuthorizedCronRequest } from "@/lib/auth";

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  await flagPendingWeeklyRecommendation();
  return Response.json({ ok: true });
}
