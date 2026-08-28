# Fitness Tracker App — Project Plan

## Stack
- Next.js (App Router) + Vercel (hosting, free tier) + Supabase (Postgres, free tier)
- tRPC + Prisma
- Strava API (primary ingestion) + garminconnect data where useful (HRV, sleep, Body Battery, VO2max)
- Claude via **Agent SDK, OAuth (Pro subscription)** — solo use only. Switch to a Console API key
  (with spend cap) before any other user (e.g. friends) is added.

## Core features
1. **Ingestion** — daily cron pulls Strava activities; also user-triggerable via a "Sync now" button
   (`/api/sync`), which reuses the same `syncAndAnalyze()` logic as the cron job.
2. **Feedback** — weekly Claude-generated recommendation from computed metrics (never raw arithmetic
   trusted to the LLM). Also a lightweight reactive adjustment step after every manual sync.
3. **Calendar** — in-app only (own DB + own UI, no external calendar sync). `PlannedWorkout` model
   holds scheduled sessions; matched against ingested `Activity` rows to mark completed/missed.
4. **Goals** — long-term targets (e.g. "sub-90 half marathon by October") that generate a structured
   `PlannedWorkout` series via Claude, forming the calendar's content.
5. **Chat** — conversational feature with full context (recent activities, active goal, upcoming
   planned workouts, recent recommendations) via the Agent SDK.
6. **Adaptive plan adjustment** — after a sync brings in new activities, compare recent load against
   upcoming planned workouts. If adjustment seems warranted (e.g. two hard days back-to-back before a
   planned hard day), Claude proposes a change (reduce / rest / reschedule) with a reason.
   **Adjustments require lightweight user approval — never auto-applied.**

## Data model (Prisma, key tables)
- `Activity` — ingested runs (Strava/Garmin), incl. splits/laps JSON
- `PlannedWorkout` — scheduled sessions; tracks `originalDate` + `adjustmentReason` if changed
- `Goal` — long-term target, target date, target metric
- `DailyMetrics` — CTL, ATL, TSB, monotony, strain, HRV, resting HR, sleep score, Body Battery
- `Recommendation` — stored weekly AI summaries
- `ChatMessage` — chat history
- `StravaAuth` — OAuth tokens (per-user once multi-user)

## Metrics (all computed in pure TypeScript, never by the LLM)
- **ACWR** (Acute:Chronic Workload Ratio) — 7-day load ÷ 28-day average load. ~0.8–1.3 = sensible,
  >1.5 = injury risk, <0.8 = detraining.
- **CTL / ATL / TSB** — exponentially weighted 42-day (CTL) / 7-day (ATL) load averages; TSB = CTL − ATL
  (freshness). Most useful single signal for sustained middle-to-long distance training.
- **Monotony & Strain** (Foster's method) — flags "same intensity every day" patterns that predict
  burnout even when total volume looks reasonable. Computed over trailing 7-day window.
- **Threshold pace / Critical Speed** — estimated from recent hard efforts (20–70 min duration) via the
  Riegel formula, recalculated periodically. Used to calibrate load estimates and race predictions.
  More relevant than VO2max for 5K–marathon-focused training.
- **Race time prediction** — Riegel formula, extrapolates a known effort to other distances.
- **GAP (Grade-Adjusted Pace)** — normalizes pace for elevation.

## LLM usage boundaries
- Chat/plan generation calls the Gemini API directly (`lib/agentClient.ts`), on its free tier —
  no per-user cost concern the way a metered API key would have. (An earlier version used the
  Claude Agent SDK via OAuth against a personal Pro subscription, but that shells out to a ~240MB
  native CLI binary that Vercel's serverless functions can't bundle — replaced for that reason.)
- The model is only ever given pre-computed metrics + context; it reasons/writes narrative and
  proposes actions, never does the arithmetic itself.
- Free-tier rate limits are still a real ceiling if usage grows beyond solo/small-group use —
  worth revisiting (a paid Gemini tier, or a different provider) if that happens.

## Data model updates (v2)

`PlannedWorkout` generalized beyond running:

```prisma
enum WorkoutType {
  EASY_RUN
  TEMPO_RUN
  INTERVALS
  LONG_RUN
  RACE
  STRENGTH
  HIIT
  MTB
  CYCLING
  SWIM
  MOBILITY
  REST
  OTHER
}

enum WorkoutSource {
  USER
  AI_GENERATED
}

model PlannedWorkout {
  id                  String        @id @default(cuid())
  date                DateTime
  type                WorkoutType
  targetDistance      Float?        // rough total, optional — meaningful for run/ride/swim
  targetDuration       Int?         // rough total minutes, optional
  description         String        @db.Text  // plain text: "4x400m @ 5K pace, 90s jog recovery"
  goalId              String?
  completedActivityId String?
  status              String        @default("planned")
  source              WorkoutSource @default(USER)
  originalDate        DateTime?
  adjustmentReason    String?       @db.Text
}
```

Key decisions:
- **Plain text `description`**, not structured segments/JSON — the plan is a human-readable
  prescription, not something that needs to be machine-parseable. Actual training metrics come from
  ingested GPX/HR/splits on the *completed* `Activity`, never from parsing the planned workout.
- **`source` guardrail** — `adjustUpcomingPlan()` only ever reads/modifies `PlannedWorkout` rows with
  `source: AI_GENERATED`. Workouts a user schedules manually (`source: USER`, the default) are never
  touched by the reactive adjustment logic, regardless of load metrics. Keeps user intent (e.g. a
  strength session booked with a gym buddy) safe from being silently rewritten.
- Matching completed activities to planned ones still works on `date` + `type` + rough
  `targetDistance` — no segment-level detail needed for matching either.

## Goal → initial plan generation

Prompt takes: goal (title, target date, target metric), weeks available, current weekly mileage,
current threshold pace, cross-training preferences. Returns a JSON array of planned workouts:

```typescript
{
  "date": "YYYY-MM-DD",
  "type": "EASY_RUN" | "TEMPO_RUN" | "INTERVALS" | "LONG_RUN" | "RACE" | "STRENGTH" | "HIIT" | "MTB" | "CYCLING" | "SWIM" | "MOBILITY" | "REST",
  "targetDistance": number | null,
  "targetDuration": number | null,
  "description": string
}
```

Generated rows get `source: AI_GENERATED`. Periodization principles requested: gradual weekly mileage
progression (~10%/week max), build → peak → taper phases, rest days included, at least one
cross-training session/week if preferences specified. Worth a validation pass on output (dates in
range, no wild mileage jumps) before inserting, since this generates a full multi-week schedule in
one shot — not yet built.

## Open / not yet built
- Validation/sanity-check pass on AI-generated plan output
- Threshold pace auto-recalculation trigger (monthly? on new qualifying effort?)
- Calendar UI component (month view)
- Garmin ingestion specifics (which fields, via `garminconnect`)
