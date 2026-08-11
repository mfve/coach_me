import { syncAndAnalyze } from "@/lib/syncAndAnalyze";
import { isAuthorizedAppRequest } from "@/lib/auth";

export async function POST(req: Request) {
  if (!isAuthorizedAppRequest(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await syncAndAnalyze();
  return Response.json(result);
}
