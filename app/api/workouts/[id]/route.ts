import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const resolution = body?.resolveAdjustment;

  const current = await prisma.plannedWorkout.findUnique({ where: { id: params.id, userId } });
  if (!current) return Response.json({ error: "not found" }, { status: 404 });

  if (resolution === "accept") {
    const updated = await prisma.plannedWorkout.update({
      where: { id: params.id },
      data: { adjustmentReason: null },
    });
    return Response.json(updated);
  }

  if (resolution === "dismiss") {
    const updated = await prisma.plannedWorkout.update({
      where: { id: params.id },
      data: {
        date: current.originalDate ?? current.date,
        originalDate: null,
        adjustmentReason: null,
      },
    });
    return Response.json(updated);
  }

  return Response.json({ error: "unsupported patch — expected resolveAdjustment: 'accept' | 'dismiss'" }, { status: 400 });
}
