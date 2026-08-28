"use client";

import { useState, useEffect } from "react";
import { Check, X } from "lucide-react";
import { apiFetchJson } from "@/lib/apiClient";
import PlanPreviewGrid from "@/components/PlanPreviewGrid";
import Spinner from "@/components/Spinner";
import BottomNav from "@/components/BottomNav";
import MarkdownMessage from "@/components/MarkdownMessage";

interface PlanAction {
  op: "update" | "add" | "remove" | "regenerate";
  workoutId?: string;
  date?: string;
  type?: string;
  targetDistance?: number | null;
  targetDuration?: number | null;
  description?: string;
  scope?: "maintenance" | "goal";
  goalId?: string;
  workouts?: any[];
  weekFocuses?: any[];
  planMessage?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  proposedActions?: PlanAction[];
  actionsResolution?: "applied" | "discarded";
}

function describeAction(a: PlanAction): string {
  switch (a.op) {
    case "update": {
      const parts = [];
      if (a.date) parts.push(`move to ${a.date}`);
      if (a.type) parts.push(`change type to ${a.type}`);
      if (a.targetDistance != null) parts.push(`${(a.targetDistance / 1000).toFixed(1)}km`);
      if (a.targetDuration != null) parts.push(`${a.targetDuration}min`);
      return `Update workout — ${parts.join(", ") || "edit details"}`;
    }
    case "add":
      return `Add ${a.type ?? "workout"} on ${a.date}${a.targetDistance ? ` (${(a.targetDistance / 1000).toFixed(1)}km)` : ""}`;
    case "remove":
      return "Remove a planned workout";
    case "regenerate":
      return a.scope === "goal" ? "Regenerate the goal plan" : "Regenerate the maintenance plan";
    default:
      return JSON.stringify(a);
  }
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyingIndex, setApplyingIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetchJson<{ messages: Message[] }>("/api/chat")
      .then((data) => {
        if (!cancelled) setMessages(data.messages ?? []);
      })
      .catch(() => {
        // A failed history load shouldn't block a fresh conversation.
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || sending) return;

    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const data = await apiFetchJson<{ reply: string; proposedActions?: PlanAction[] }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, proposedActions: data.proposedActions?.length ? data.proposedActions : undefined },
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function applyActions(index: number, actions: PlanAction[]) {
    setApplyingIndex(index);
    setError(null);
    try {
      await apiFetchJson("/api/plan/actions", {
        method: "POST",
        body: JSON.stringify({ actions }),
      });
      setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, actionsResolution: "applied" } : m)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setApplyingIndex(null);
    }
  }

  function discardActions(index: number) {
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, actionsResolution: "discarded" } : m)));
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2B261F] font-[system-ui] flex flex-col">
      <div className="max-w-2xl mx-auto w-full px-4 pt-8 pb-28 flex flex-col flex-1">
        <p className="text-xs uppercase tracking-[0.2em] text-[#A39C8C] mb-1">Your coach</p>
        <h1 className="text-2xl font-semibold tracking-tight mb-6">Coach chat</h1>

        <div className="flex-1 space-y-3 mb-4">
          {loadingHistory && messages.length === 0 && (
            <p className="text-xs text-[#A39C8C]">
              <Spinner label="Loading conversation…" size={12} />
            </p>
          )}
          {!loadingHistory && messages.length === 0 && (
            <p className="text-sm text-[#A39C8C]">
              Ask about your training load, upcoming plan, or anything else — full context (recent
              activities, active goal, upcoming workouts) is sent with every message. You can also ask
              it to reschedule, add, remove, or regenerate parts of your plan — it'll propose the change
              here for you to approve before anything is saved.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%]" : "max-w-[85%]"}>
              <div
                className={`rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-[#5FC2AB] text-[#FAF7F2] whitespace-pre-wrap" : "bg-[#F3EFE7] text-[#2B261F]"
                }`}
              >
                {m.role === "user" ? m.content : <MarkdownMessage content={m.content} />}
              </div>
              {m.proposedActions && (
                <div className="mt-2 border border-[#D9D2C4] rounded-2xl p-3 bg-[#FFFFFF]">
                  <p className="text-[10px] uppercase tracking-wide text-[#6B6357] mb-2">Proposed plan changes</p>
                  <div className="space-y-3 mb-3">
                    {m.proposedActions.map((a, j) =>
                      a.op === "regenerate" && a.workouts && a.workouts.length > 0 ? (
                        <div key={j}>
                          {a.planMessage && (
                            <div className="text-xs text-[#2B261F] mb-2">
                              <MarkdownMessage content={a.planMessage} />
                            </div>
                          )}
                          <p className="text-[10px] uppercase tracking-wide text-[#6B6357] mb-1">
                            {a.workouts.length} planned workouts
                          </p>
                          <PlanPreviewGrid workouts={a.workouts} weekFocuses={a.weekFocuses} />
                        </div>
                      ) : (
                        <p key={j} className="text-xs text-[#2B261F]">
                          {describeAction(a)}
                        </p>
                      )
                    )}
                  </div>
                  {m.actionsResolution === "applied" ? (
                    <p className="text-xs text-[#2E9C86]">Applied.</p>
                  ) : m.actionsResolution === "discarded" ? (
                    <p className="text-xs text-[#A39C8C]">Discarded.</p>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => applyActions(i, m.proposedActions!)}
                        disabled={applyingIndex === i}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl bg-[#5FC2AB] text-[#FAF7F2] shadow-md shadow-[#5FC2AB]/25 font-medium disabled:opacity-50"
                      >
                        {applyingIndex === i ? <Spinner label="Applying…" size={12} /> : (<><Check size={12} /> Approve</>)}
                      </button>
                      <button
                        onClick={() => discardActions(i)}
                        disabled={applyingIndex === i}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl border border-[#D9D2C4] text-[#6B6357] hover:bg-[#EFE9DE] disabled:opacity-50"
                      >
                        <X size={12} /> Discard
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {sending && (
            <p className="text-xs text-[#A39C8C]">
              <Spinner label="Thinking…" size={12} />
            </p>
          )}
        </div>

        {error && (
          <p className="text-xs text-[#D14F3F] mb-2 border border-[#D14F3F]/40 rounded-xl px-3 py-2 bg-[#D14F3F]/10">
            {error}
          </p>
        )}

        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message your coach..."
            className="flex-1 bg-[#FFFFFF] border border-[#E2DCD0] rounded-xl px-3 py-2 text-sm outline-none shadow-sm focus:border-[#2E9C86] focus:shadow-md transition-shadow"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="px-4 py-2 rounded-xl bg-[#5FC2AB] text-[#FAF7F2] shadow-md shadow-[#5FC2AB]/25 text-sm font-medium disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
      <BottomNav active="chat" />
    </div>
  );
}
