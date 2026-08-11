# Coach Me

Personal fitness tracking + AI training recommendations.

**Start here:** `docs/plan.md` — full project spec, architecture decisions, and open items.

## Current state

This repo is scaffolded with real logic in some places and clearly-marked stubs in others.
Everything in `lib/` and `app/api/` is written against the schema in `prisma/schema.prisma`.

**Implemented (logic is real, ready to wire up):**
- `prisma/schema.prisma` — full data model
- `lib/metrics.ts` — ACWR, CTL/ATL/TSB, monotony/strain (pure functions, no LLM)
- `lib/threshold.ts` — threshold pace estimation + race time prediction (Riegel formula)
- `lib/context.ts` — shared context builder every LLM call should use
- `lib/generatePlan.ts` — goal → AI-generated training plan
- `lib/agentClient.ts` — Agent SDK wrapper (solo OAuth — see warning in that file)
- `lib/prisma.ts` — standard Prisma client singleton
- `components/TrainingCalendar.jsx` — month view UI, wired to real data (`GET /api/workouts`), with
  "Add workout" (plan ahead), "Log workout" (record something you did, with perceived effort), and
  a "Sync now" button. Shows completed `Activity` rows on the calendar even before they're matched
  to a `PlannedWorkout`. Past planned-but-never-completed workouts are cleared automatically — only
  the upcoming plan is kept around (`clearPastPlannedWorkouts` in `lib/syncAndAnalyze.ts`).
- `components/Sidebar.tsx` — collapsible hamburger-menu nav (Calendar / Chat)
- `app/chat/page.tsx` — chat UI wired to `POST /api/chat`
- `app/api/workouts` — list/create planned workouts (`GET`/`POST`), accept/dismiss an AI adjustment
  (`PATCH /api/workouts/[id]`)
- `app/api/activities` — manually log a completed workout (`POST`), type-driven (distance/pace only
  for Run/Ride/Swim/Walk/Hike — team sport and gym sessions just get duration + RPE + free-text
  notes). Perceived effort feeds the load calc (`lib/metrics.ts`, session-RPE method) and immediately
  re-runs `adjustUpcomingPlan()` against it.
- `app/goals/page.tsx` + `app/api/goals` — create a goal (title, target date, race distance,
  optional target time, cross-training prefs), which generates a full periodized plan via
  `generateInitialPlan()`. Starting a new goal supersedes the previous active one. `PATCH
  /api/goals/[id]` marks a goal abandoned/achieved.
- `app/api/plan/maintain` — no active goal? Generates a rolling 2-week "maintain current fitness"
  plan via `generateMaintenancePlan()` instead of a periodized build-up. Both plan-generation paths
  clear whatever AI-generated plan was previously upcoming first, so there's only ever one AI plan
  in flight (`clearFutureAiGeneratedPlan` in `lib/generatePlan.ts`) — manually added workouts
  (`source: USER`) are never touched.

**Stubbed — needs real implementation:**
- Strava OAuth flow + token refresh (`getValidStravaToken`, `fetchStravaActivities` in `lib/syncAndAnalyze.ts`)
- `upsertActivities` — persisting fetched Strava activities
- `matchActivitiesToPlannedWorkouts` — matching completed activities to planned ones
- `maybeGenerateWeeklyRecommendation` — the weekly Claude summary (pattern described in `docs/plan.md`)
- Validation pass on AI-generated plans before insert
- Garmin ingestion (`garminconnect` Python lib — see plan doc for why this may run as a separate small service)
- Onboarding form for `UserProfile`

## Required env vars

- `DATABASE_URL` / `DIRECT_URL` — see `.env.local.example`. Locally these can be the same connection string; on Supabase they must differ (pooled vs. direct — see below).
- `CRON_SECRET` — Vercel Cron sends this automatically as `Authorization: Bearer <value>` once set; without it `/api/cron/*` routes reject all requests.
- `APP_SECRET` — the dashboard client must send this as `Authorization: Bearer <value>` on `/api/sync`, `/api/chat`, `/api/workouts`, and `/api/activities`. See `lib/auth.ts`.
- `NEXT_PUBLIC_APP_SECRET` — same value as `APP_SECRET`, exposed to the browser bundle so `lib/apiClient.ts` can attach it automatically. Not real auth once this app leaves your own machine — see the warning comment in that file.
- `CLAUDE_CODE_OAUTH_TOKEN` — only needed when deploying; see below.

## Critical constraint to preserve

Claude API access uses **OAuth via the Agent SDK, tied to a personal Pro subscription — solo use
only**. Before any other person uses this app, the LLM calls must switch to a Console API key
(with a spend cap). Full detail in `docs/plan.md` under "Claude usage boundaries" and in the
warning comment at the top of `lib/agentClient.ts`.

## Deploying to Vercel

- **Database (Supabase):** use Supabase's pooled connection string (port 6543, `?pgbouncer=true`)
  as `DATABASE_URL` and the direct connection (port 5432) as `DIRECT_URL`. `prisma migrate deploy`
  needs the direct one — PgBouncer's transaction mode doesn't support the prepared statements
  migrations rely on. `npm run build` already runs `prisma migrate deploy && next build`, so schema
  changes apply automatically on deploy as long as both env vars are set in the Vercel project.
- **Claude auth:** `lib/agentClient.ts` uses OAuth from `claude setup-token`, which is normally tied
  to an interactive login. To use it from Vercel's serverless functions, set the token it produces
  as `CLAUDE_CODE_OAUTH_TOKEN` in the Vercel project's env vars — verify the exact variable name
  against your installed Agent SDK version's docs before relying on it; this wasn't confirmed
  against a real deploy.
- **Cron:** `vercel.json` already defines the daily sync and weekly recommendation crons. They only
  authenticate once `CRON_SECRET` is set as a Vercel env var (Vercel sends it automatically as the
  cron request's `Authorization` header).
- **Supabase Row Level Security (RLS):** does not apply here and you can skip configuring it. RLS
  gates access through Supabase's client SDK / PostgREST API using the public `anon` key — this app
  never uses that path. Prisma connects straight to Postgres with a server-only connection string,
  and every read/write already goes through this app's own `/api/*` routes gated by `APP_SECRET`
  (see `lib/auth.ts`). Enabling RLS wouldn't add protection here, and misconfiguring it (denying the
  role Prisma connects as) would break `prisma migrate deploy`. RLS only becomes relevant if this
  app starts querying Supabase directly from the browser with `@supabase/supabase-js` — it doesn't
  today.
