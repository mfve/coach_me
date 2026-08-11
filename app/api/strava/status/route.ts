import { prisma } from "@/lib/prisma";
import { isAuthorizedAppRequest } from "@/lib/auth";

export async function GET(req: Request) {
  if (!isAuthorizedAppRequest(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const auth = await prisma.stravaAuth.findUnique({ where: { id: "singleton" } });
  return Response.json({ connected: Boolean(auth) });
}
