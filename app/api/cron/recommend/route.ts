import { prisma } from "@/lib/prisma";
import { flagPendingWeeklyRecommendation } from "@/lib/syncAndAnalyze";
import { isAuthorizedCronRequest } from "@/lib/auth";

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const users = await prisma.user.findMany({ select: { id: true } });
  await Promise.all(users.map((u) => flagPendingWeeklyRecommendation(u.id)));

  return Response.json({ ok: true, users: users.length });
}
