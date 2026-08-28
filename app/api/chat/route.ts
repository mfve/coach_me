import { prisma } from "@/lib/prisma";
import { agentQuery, parseAgentJson } from "@/lib/agentClient";
import { buildUserContext, formatContextForPrompt } from "@/lib/context";
import { auth } from "@/auth";
import { buildGoalPlanInput, type PlanAction } from "@/lib/planActions";
import { proposeMaintenancePlan, proposeInitialPlan, MAINTENANCE_WEEKS_AHEAD } from "@/lib/generatePlan";
import { computeTrainingSnapshot } from "@/lib/trainingSnapshot";

const PLAN_ACTIONS_INSTRUCTIONS = `
If — and only if — the user is asking you to change their training plan (reschedule or swap a
specific upcoming workout, adjust its distance/duration/description, add a one-off session,
remove a day, or regenerate the whole rolling/maintenance or goal plan), do both of these:
1. Give a short conversational reply describing what you're proposing, and say a human needs to
   approve it before anything is saved.
2. Append, on its own line after your reply, a fenced block:

\`\`\`plan-actions
[ ... ]
\`\`\`

Each array element is exactly one of:
{ "op": "update", "workoutId": string, "date"?: "YYYY-MM-DD", "type"?: "EASY_RUN"|"TEMPO_RUN"|"INTERVALS"|"LONG_RUN"|"RACE"|"STRENGTH"|"HIIT"|"MTB"|"CYCLING"|"SWIM"|"MOBILITY"|"REST", "targetDistance"?: number | null (meters), "targetDuration"?: number | null (minutes), "description"?: string }
{ "op": "add", "date": "YYYY-MM-DD", "type": (same type list), "targetDistance"?: number | null (meters), "targetDuration"?: number | null (minutes), "description": string }
{ "op": "remove", "workoutId": string }
{ "op": "regenerate", "scope": "maintenance" | "goal", "goalId"?: string (required when scope is "goal") }

Use the real "id" values from the upcoming planned workouts listed above for workoutId — never
invent one.

If the user is NOT asking for a plan change right now — just discussing the plan, asking a
question, giving/getting general advice — do NOT append a plan-actions block, and do NOT say
anything is "proposed," "pending," or "needs approval." There is nothing to approve in that
case, so don't mention approval at all — just answer directly.
`.trim();

function splitReplyAndActions(raw: string): { reply: string; proposedActions: PlanAction[] } {
  const match = raw.match(/```plan-actions\s*([\s\S]*?)```/i);
  if (!match || match.index === undefined) return { reply: raw.trim(), proposedActions: [] };

  const reply = (raw.slice(0, match.index) + raw.slice(match.index + match[0].length)).trim();
  const parsed = parseAgentJson(match[1]);
  return { reply, proposedActions: Array.isArray(parsed) ? parsed : [] };
}

// A bare "regenerate" action is just a promise ("I'll regenerate your plan") with nothing to
// actually show or approve against. Resolve it into a real proposed plan right away so the
// client can render it as a preview card — approving then just commits what was already shown,
// it never re-rolls the plan.
async function resolveRegenerateActions(userId: string, actions: PlanAction[]): Promise<PlanAction[]> {
  return Promise.all(
    actions.map(async (action) => {
      if (action.op !== "regenerate") return action;

      try {
        if (action.scope === "maintenance") {
          const { currentWeeklyMileage, thresholdPace } = await computeTrainingSnapshot(userId);
          const { message, workouts, weekFocuses } = await proposeMaintenancePlan(userId, {
            weeksAhead: MAINTENANCE_WEEKS_AHEAD,
            currentWeeklyMileage,
            thresholdPace,
            crossTrainingPreferences: [],
          });
          return { ...action, workouts, weekFocuses, planMessage: message };
        }

        if (!action.goalId) return action;
        const goalInput = await buildGoalPlanInput(userId, action.goalId);
        if (!goalInput) return action;

        const { message, workouts, weekFocuses } = await proposeInitialPlan(userId, goalInput);
        return { ...action, workouts, weekFocuses, planMessage: message };
      } catch {
        // Leave the action unresolved (no workouts attached) — the client falls back to the
        // plain text description and applying it re-triggers generation the old way.
        return action;
      }
    })
  );
}

const HISTORY_LIMIT = 20;

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  // Newest-first from the DB so the limit keeps the most recent turns, then reversed back to
  // chronological order for display.
  const recent = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
  });

  return Response.json({ messages: recent.reverse().map((m) => ({ role: m.role, content: m.content })) });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { message } = await req.json();

  const priorMessages = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
  });
  const history = priorMessages
    .reverse()
    .map((m) => `${m.role === "user" ? "User" : "Coach"}: ${m.content}`)
    .join("\n");

  const context = await buildUserContext(userId);
  const prompt = `${formatContextForPrompt(context)}\n\n${
    history ? `Conversation so far:\n${history}\n\n` : ""
  }User: ${message}\n\n${PLAN_ACTIONS_INSTRUCTIONS}`;

  let rawReply: string;
  try {
    rawReply = await agentQuery({ prompt });
  } catch (err) {
    return Response.json(
      { error: `Claude request failed: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  const { reply, proposedActions: rawActions } = splitReplyAndActions(rawReply);
  const proposedActions = await resolveRegenerateActions(userId, rawActions);

  await prisma.chatMessage.createMany({
    data: [
      { userId, role: "user", content: message },
      { userId, role: "assistant", content: reply },
    ],
  });

  return Response.json({ reply, proposedActions });
}
