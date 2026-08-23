import { prisma } from "@/lib/prisma";
import { syncAndAnalyze } from "@/lib/syncAndAnalyze";
import { isAuthorizedCronRequest } from "@/lib/auth";

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const auths = await prisma.stravaAuth.findMany({ select: { userId: true } });
  const userIds = auths.map((a) => a.userId).filter((id): id is string => id !== null);
  const results = await Promise.all(
    userIds.map(async (userId) => {
      try {
        return { userId, ...(await syncAndAnalyze(userId)) };
      } catch (err) {
        return { userId, error: (err as Error).message };
      }
    })
  );

  return Response.json({ results });
}
