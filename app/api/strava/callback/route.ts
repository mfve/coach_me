import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { exchangeCodeForToken } from "@/lib/strava";
import { backfillStravaActivities } from "@/lib/syncAndAnalyze";

const STATE_COOKIE_NAME = "strava_oauth_state";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const origin = url.origin;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.redirect(`${origin}/login`, 302);
  }

  const expectedState = req.headers
    .get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith(`${STATE_COOKIE_NAME}=`))
    ?.split("=")[1];
  if (!state || !expectedState || state !== expectedState) {
    return Response.redirect(`${origin}/?strava=error&reason=state_mismatch`, 302);
  }

  if (error || !code) {
    return Response.redirect(`${origin}/?strava=error&reason=${encodeURIComponent(error ?? "missing_code")}`, 302);
  }

  try {
    const tokens = await exchangeCodeForToken(code);
    await prisma.stravaAuth.upsert({
      where: { userId },
      create: {
        userId,
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
    const newCount = await backfillStravaActivities(userId);
    return Response.redirect(`${origin}/?strava=connected&backfilled=${newCount}`, 302);
  } catch (err) {
    return Response.redirect(`${origin}/?strava=connected&backfillError=${encodeURIComponent((err as Error).message)}`, 302);
  }
}
