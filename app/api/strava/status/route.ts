import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const stravaAuth = await prisma.stravaAuth.findUnique({ where: { userId } });
  return Response.json({ connected: Boolean(stravaAuth) });
}
