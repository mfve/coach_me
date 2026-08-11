import { syncAndAnalyze } from "@/lib/syncAndAnalyze";
import { isAuthorizedCronRequest } from "@/lib/auth";

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await syncAndAnalyze();
  return Response.json(result);
}
