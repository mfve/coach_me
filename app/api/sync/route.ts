import { syncAndAnalyze } from "@/lib/syncAndAnalyze";
import { auth } from "@/auth";

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const result = await syncAndAnalyze(userId);
  return Response.json(result);
}
