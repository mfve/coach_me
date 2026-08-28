// Plain HTTP calls to the Gemini API — no SDK, no native binary. The Agent SDK (Claude Code's
// CLI wrapped as a library) shells out to a ~240MB per-platform binary, which Vercel's
// serverless functions can't bundle (way past their size limits) — this replaces it with the
// same single-turn text/JSON generation over a lightweight REST call instead.
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Fast, free-tier-eligible, and more than capable for single-turn text/JSON generation with no
// tool use. Override with AGENT_MODEL if a specific call ever needs more reasoning headroom.
const DEFAULT_MODEL = process.env.AGENT_MODEL || "gemini-3.6-flash";

export async function agentQuery({ prompt, model }: { prompt: string; model?: string }): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const res = await fetch(`${GEMINI_API_BASE}/${model ?? DEFAULT_MODEL}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });

  if (!res.ok) {
    throw new Error(`Gemini request failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: any) => p.text ?? "").join("");
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
