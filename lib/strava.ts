const STRAVA_OAUTH_BASE = "https://www.strava.com/oauth";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface StravaActivity {
  id: number;
  type: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  total_elevation_gain: number | null;
  average_heartrate?: number | null;
  map?: { summary_polyline: string | null } | null;
}

export interface StravaLap {
  lapIndex: number;
  distanceMeters: number;
  paceSecPerKm: number;
  startSeconds: number;
  endSeconds: number;
}

export interface StravaStreams {
  time: number[];
  heartrate: number[] | null;
  laps: StravaLap[] | null;
}

function requireStravaCredentials() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET are not set");
  }
  return { clientId, clientSecret };
}

function toTokens(body: any): StravaTokens {
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: new Date(body.expires_at * 1000),
  };
}

export async function exchangeCodeForToken(code: string): Promise<StravaTokens> {
  const { clientId, clientSecret } = requireStravaCredentials();

  const res = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error(`Strava token exchange failed (${res.status}): ${await res.text()}`);
  }

  return toTokens(await res.json());
}

export async function refreshStravaToken(refreshToken: string): Promise<StravaTokens> {
  const { clientId, clientSecret } = requireStravaCredentials();

  const res = await fetch(`${STRAVA_OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error(`Strava token refresh failed (${res.status}): ${await res.text()}`);
  }

  return toTokens(await res.json());
}

export async function fetchStravaActivities(accessToken: string, afterEpochSeconds: number): Promise<StravaActivity[]> {
  const perPage = 200;
  const all: StravaActivity[] = [];

  for (let page = 1; page <= 20; page++) {
    const url = `${STRAVA_API_BASE}/athlete/activities?after=${afterEpochSeconds}&per_page=${perPage}&page=${page}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

    if (!res.ok) {
      throw new Error(`Strava activities fetch failed (${res.status}): ${await res.text()}`);
    }

    const batch: StravaActivity[] = await res.json();
    all.push(...batch);

    if (batch.length < perPage) break;
  }

  return all;
}

export async function fetchStravaActivityStreams(accessToken: string, activityId: string): Promise<StravaStreams> {
  const [streamsRes, lapsRes] = await Promise.all([
    fetch(`${STRAVA_API_BASE}/activities/${activityId}/streams?keys=time,heartrate&key_by_type=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch(`${STRAVA_API_BASE}/activities/${activityId}/laps`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  if (!streamsRes.ok) {
    throw new Error(`Strava streams fetch failed (${streamsRes.status}): ${await streamsRes.text()}`);
  }
  if (!lapsRes.ok) {
    throw new Error(`Strava laps fetch failed (${lapsRes.status}): ${await lapsRes.text()}`);
  }

  const streamsBody = await streamsRes.json();
  const time: number[] = streamsBody.time?.data ?? [];
  const heartrate: number[] | null = streamsBody.heartrate?.data ?? null;

  const lapsBody: any[] = await lapsRes.json();
  let cumulative = 0;
  const laps: StravaLap[] = lapsBody
    .filter((lap) => lap.distance > 0)
    .map((lap) => {
      const startSeconds = cumulative;
      cumulative += lap.elapsed_time;
      return {
        lapIndex: lap.lap_index,
        distanceMeters: lap.distance,
        paceSecPerKm: lap.moving_time / (lap.distance / 1000),
        startSeconds,
        endSeconds: cumulative,
      };
    });

  return { time, heartrate, laps: laps.length > 0 ? laps : null };
}
