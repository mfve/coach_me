export async function GET(req: Request) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) {
    return new Response("STRAVA_CLIENT_ID is not set", { status: 500 });
  }

  const redirectUri = `${new URL(req.url).origin}/api/strava/callback`;

  const authorizeUrl = new URL("https://www.strava.com/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("approval_prompt", "auto");
  authorizeUrl.searchParams.set("scope", "read,activity:read_all");

  return Response.redirect(authorizeUrl.toString(), 302);
}
