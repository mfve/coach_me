import { query } from "@anthropic-ai/claude-agent-sdk";

// Every call here is single-turn text/JSON generation with no tool use — Haiku is more than
// capable of it at a fraction of Sonnet/Opus cost. Override with AGENT_MODEL if a specific
// call ever needs more reasoning headroom.
const DEFAULT_MODEL = process.env.AGENT_MODEL || "haiku";

export async function agentQuery({ prompt, model }: { prompt: string; model?: string }): Promise<string> {
  let fullText = "";

  for await (const msg of query({
    prompt,
    options: { allowedTools: [], model: model ?? DEFAULT_MODEL },
  })) {
    if (msg.type === "assistant") {
      for (const block of msg.message.content) {
        if (block.type === "text") fullText += block.text;
      }
    }
  }

  return fullText;
}

// Callers ask for "JSON only, no other text" but the model still wraps it in a
// ```json fence (or adds a stray sentence) often enough that a plain JSON.parse
// was silently failing and callers were treating every one of those responses as empty.
export function parseAgentJson(response: string): any {
  const stripped = response
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
