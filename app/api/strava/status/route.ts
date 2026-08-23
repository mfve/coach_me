import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const auth = await prisma.stravaAuth.findUnique({ where: { userId } });
  return Response.json({ connected: Boolean(auth) });
}
