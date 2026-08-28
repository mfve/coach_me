import { NextResponse } from "next/server";
import { auth } from "@/auth";

const STATE_COOKIE_NAME = "strava_oauth_state";

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) {
    return new Response("STRAVA_CLIENT_ID is not set", { status: 500 });
  }

  const redirectUri = `${new URL(req.url).origin}/api/strava/callback`;

  // CSRF guard: without this, an attacker who authorizes their own Strava app and captures the
  // resulting `code` could trick a logged-in victim into visiting the callback URL, silently
  // linking the attacker's Strava account to the victim's app account (session cookie identifies
  // the account to attach to). The state value is only valid if it matches this short-lived cookie.
  const state = crypto.randomUUID();

  const authorizeUrl = new URL("https://www.strava.com/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("approval_prompt", "auto");
  authorizeUrl.searchParams.set("scope", "read,activity:read_all");
  authorizeUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authorizeUrl.toString(), 302);
  res.cookies.set(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
