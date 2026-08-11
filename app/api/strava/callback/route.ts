import { prisma } from "@/lib/prisma";
import { exchangeCodeForToken } from "@/lib/strava";
import { backfillStravaActivities } from "@/lib/syncAndAnalyze";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const origin = url.origin;

  if (error || !code) {
    return Response.redirect(`${origin}/?strava=error&reason=${encodeURIComponent(error ?? "missing_code")}`, 302);
  }

  try {
    const tokens = await exchangeCodeForToken(code);
    await prisma.stravaAuth.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
    });
  } catch (err) {
    return Response.redirect(`${origin}/?strava=error&reason=${encodeURIComponent((err as Error).message)}`, 302);
  }

  try {
    const newCount = await backfillStravaActivities();
    return Response.redirect(`${origin}/?strava=connected&backfilled=${newCount}`, 302);
  } catch (err) {
    return Response.redirect(`${origin}/?strava=connected&backfillError=${encodeURIComponent((err as Error).message)}`, 302);
  }
}
