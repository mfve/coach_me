import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getValidStravaToken } from "@/lib/syncAndAnalyze";
import { fetchStravaActivityStreams } from "@/lib/strava";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const activity = await prisma.activity.findUnique({ where: { id: params.id, userId } });
  if (!activity) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  if (activity.source !== "strava" || !activity.stravaId) {
    return Response.json({ error: "streams are only available for Strava-synced activities" }, { status: 400 });
  }

  if (activity.splits) {
    return Response.json(activity.splits);
  }

  try {
    const auth = await getValidStravaToken(userId);
    const streams = await fetchStravaActivityStreams(auth.accessToken, activity.stravaId);
    await prisma.activity.update({
      where: { id: activity.id },
      data: { splits: streams as unknown as Prisma.InputJsonValue },
    });
    return Response.json(streams);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
