"use client";

import { useState, useEffect, useCallback } from "react";
import { Target, Check } from "lucide-react";
import { apiFetchJson } from "@/lib/apiClient";
import PlanPreviewGrid from "@/components/PlanPreviewGrid";
import Spinner from "@/components/Spinner";
import BottomNav from "@/components/BottomNav";
import MarkdownMessage from "@/components/MarkdownMessage";

const RACE_DISTANCES = [
  { value: "5k", label: "5K" },
  { value: "10k", label: "10K" },
  { value: "half", label: "Half marathon" },
  { value: "marathon", label: "Marathon" },
  { value: "other", label: "Other" },
];

const CROSS_TRAINING_OPTIONS = ["strength", "mtb", "cycling", "swim"];

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatTargetMetric(metric: any) {
  if (!metric) return null;
  const distanceLabel = RACE_DISTANCES.find((d) => d.value === metric.raceDistance)?.label ?? metric.raceDistance;
  const parts = [distanceLabel].filter(Boolean);
  if (metric.targetSeconds) {
    const mins = Math.round(metric.targetSeconds / 60);
    parts.push(`sub-${mins}min`);
  }
  return parts.join(" · ") || null;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetchJson<{ goals: any[] }>("/api/goals");
      setGoals(data.goals ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeGoals = goals.filter((g) => g.status === "active");
  const pastGoals = goals.filter((g) => g.status !== "active");

  async function abandonGoal(id: string) {
    try {
      await apiFetchJson(`/api/goals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "abandoned" }),
      });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2B261F] font-[system-ui]">
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-28">
        <p className="text-xs uppercase tracking-[0.2em] text-[#A39C8C] mb-1">Training goal</p>
        <h1 className="text-2xl font-semibold tracking-tight mb-6">Goals</h1>

        {error && (
          <p className="mb-4 text-xs text-[#D14F3F] border border-[#D14F3F]/40 rounded-2xl px-4 py-3 bg-[#D14F3F]/10">
            {error}
          </p>
        )}
        {message && (
          <p className="mb-4 text-xs text-[#6B6357] bg-[#F3EFE7] border border-[#D9D2C4] rounded-2xl px-4 py-3">
            {message}
          </p>
        )}

        {!loading && activeGoals.length > 0 && (
          <div className="mb-6 space-y-2">
            {activeGoals.map((goal) => (
              <div key={goal.id} className="bg-[#F3EFE7] border border-[#D9D2C4] rounded-2xl px-4 py-4">
                <div className="flex items-start gap-3">
                  <Target size={18} className="text-[#2E9C86] mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#2B261F]">{goal.title}</p>
                    <p className="text-xs text-[#6B6357] mt-0.5">
                      Target: {formatDate(goal.targetDate)}
                      {formatTargetMetric(goal.targetMetric) ? ` · ${formatTargetMetric(goal.targetMetric)}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => abandonGoal(goal.id)}
                    className="text-xs px-2.5 py-1.5 rounded-xl bg-transparent border border-[#D9D2C4] text-[#6B6357] hover:bg-[#EFE9DE] transition-colors shrink-0"
                  >
                    Abandon
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <CreateGoalForm
            hasOtherActiveGoals={activeGoals.length > 0}
            onCreated={(msg) => {
              setMessage(msg);
              load();
            }}
          />
        )}

        {!loading && activeGoals.length === 0 && (
          <MaintenancePlanCard
            onGenerated={(msg) => {
              setMessage(msg);
            }}
          />
        )}

        {pastGoals.length > 0 && (
          <div className="mt-8">
            <p className="text-xs uppercase tracking-[0.2em] text-[#A39C8C] mb-3">Past goals</p>
            <div className="space-y-2">
              {pastGoals.map((g) => (
                <div key={g.id} className="flex items-center justify-between px-4 py-3 rounded-2xl border border-[#EAE4D9] bg-[#FFFFFF]">
                  <div>
                    <p className="text-sm text-[#6B6357]">{g.title}</p>
                    <p className="text-xs text-[#A39C8C]">{formatDate(g.targetDate)}</p>
                  </div>
                  <span className="text-xs text-[#A39C8C] capitalize">{g.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <BottomNav active="goals" />
    </div>
  );
}

function CreateGoalForm({
  onCreated,
  hasOtherActiveGoals,
}: {
  onCreated: (message: string) => void;
  hasOtherActiveGoals: boolean;
}) {
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [raceDistance, setRaceDistance] = useState("5k");
  const [targetMinutes, setTargetMinutes] = useState("");
  const [crossTraining, setCrossTraining] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCrossTraining(option: string) {
    setCrossTraining((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !targetDate) {
      setError("Title and target date are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiFetchJson<{ workoutCount: number; planError: string | null }>("/api/goals", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          targetDate,
          raceDistance,
          targetSeconds: targetMinutes ? Number(targetMinutes) * 60 : null,
          crossTrainingPreferences: crossTraining,
        }),
      });
      onCreated(
        result.planError
          ? `Goal saved, but plan generation failed: ${result.planError}`
          : `Goal saved — generated ${result.workoutCount} planned workouts.`
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-[#FFFFFF] border border-[#E2DCD0] rounded-2xl p-5 space-y-3">
      <h2 className="text-sm font-semibold">{hasOtherActiveGoals ? "Add another goal" : "Set a goal"}</h2>
      <p className="text-xs text-[#A39C8C]">
        Generates a full periodized plan (build → peak → taper) from your recent training and this
        target.
        {hasOtherActiveGoals && " Coordinated with your other active goal(s) so hard days don't stack."}
      </p>

      <div>
        <label className="block text-xs text-[#6B6357] mb-1">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Sub-90 half marathon"
          className="w-full bg-[#FFFFFF] border border-[#E2DCD0] rounded-xl px-3 py-2 text-sm outline-none shadow-sm focus:border-[#2E9C86] focus:shadow-md transition-shadow"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-[#6B6357] mb-1">Target date</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full bg-[#FFFFFF] border border-[#E2DCD0] rounded-xl px-3 py-2 text-sm outline-none shadow-sm focus:border-[#2E9C86] focus:shadow-md transition-shadow"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-[#6B6357] mb-1">Race distance</label>
          <select
            value={raceDistance}
            onChange={(e) => setRaceDistance(e.target.value)}
            className="w-full bg-[#FFFFFF] border border-[#E2DCD0] rounded-xl px-3 py-2 text-sm outline-none shadow-sm focus:border-[#2E9C86] focus:shadow-md transition-shadow"
          >
            {RACE_DISTANCES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-[#6B6357] mb-1">Target time (minutes, optional)</label>
        <input
          type="number"
          min="0"
          step="1"
          value={targetMinutes}
          onChange={(e) => setTargetMinutes(e.target.value)}
          className="w-full bg-[#FFFFFF] border border-[#E2DCD0] rounded-xl px-3 py-2 text-sm outline-none shadow-sm focus:border-[#2E9C86] focus:shadow-md transition-shadow"
        />
      </div>

      <div>
        <label className="block text-xs text-[#6B6357] mb-2">Cross-training (optional)</label>
        <div className="flex flex-wrap gap-2">
          {CROSS_TRAINING_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => toggleCrossTraining(option)}
              className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl border transition-colors capitalize ${
                crossTraining.includes(option)
                  ? "bg-[#5FC2AB] text-[#FAF7F2] border-[#2E9C86] font-medium"
                  : "bg-transparent border-[#D9D2C4] text-[#6B6357] hover:bg-[#EFE9DE]"
              }`}
            >
              {crossTraining.includes(option) && <Check size={12} />}
              {option}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-[#D14F3F]">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full text-center text-sm py-2 rounded-xl bg-[#5FC2AB] text-[#FAF7F2] shadow-md shadow-[#5FC2AB]/25 font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {submitting ? <Spinner label="Generating plan…" /> : "Create goal & generate plan"}
      </button>
    </form>
  );
}

function MaintenancePlanCard({ onGenerated }: { onGenerated: (message: string) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crossTraining, setCrossTraining] = useState<string[]>([]);
  const [targetWeeklyMileage, setTargetWeeklyMileage] = useState("");
  const [runsPerWeek, setRunsPerWeek] = useState("");
  const [proposal, setProposal] = useState<{ message: string; workouts: any[]; weekFocuses?: any[] } | null>(null);

  function toggleCrossTraining(option: string) {
    setCrossTraining((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
  }

  async function generate() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiFetchJson<{ message: string; workouts: any[]; weekFocuses?: any[] }>("/api/plan/maintain", {
        method: "POST",
        body: JSON.stringify({
          crossTrainingPreferences: crossTraining,
          targetWeeklyMileage: targetWeeklyMileage ? Number(targetWeeklyMileage) : null,
          runsPerWeek: runsPerWeek ? Number(runsPerWeek) : null,
        }),
      });
      setProposal(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function approve() {
    if (!proposal) return;
    setCommitting(true);
    setError(null);
    try {
      const result = await apiFetchJson<{ workoutCount: number }>("/api/plan/maintain/commit", {
        method: "POST",
        body: JSON.stringify({ workouts: proposal.workouts, weekFocuses: proposal.weekFocuses ?? [] }),
      });
      onGenerated(`Generated a 4-week maintenance plan — ${result.workoutCount} planned workouts.`);
      setProposal(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCommitting(false);
    }
  }

  function discard() {
    setProposal(null);
  }

  return (
    <div className="mt-4 border border-[#EAE4D9] rounded-2xl p-5">
      <h2 className="text-sm font-semibold mb-1">No specific goal right now?</h2>
      <p className="text-xs text-[#A39C8C] mb-3">
        Generates a rolling 4-week plan that just maintains your current training patterns — no
        build-up or taper, no target date needed.
      </p>

      {proposal ? (
        <div>
          <div className="border border-[#D9D2C4] rounded-2xl p-3 bg-[#FFFFFF] mb-3">
            <div className="text-sm text-[#2B261F] mb-3">
              <MarkdownMessage content={proposal.message} />
            </div>
            <p className="text-[10px] uppercase tracking-wide text-[#6B6357] mb-2">
              {proposal.workouts.length} planned workouts
            </p>
            <PlanPreviewGrid workouts={proposal.workouts} weekFocuses={proposal.weekFocuses} />
          </div>
          {error && <p className="text-xs text-[#D14F3F] mb-2">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={approve}
              disabled={committing}
              className="flex items-center gap-1 text-sm px-3 py-2 rounded-xl bg-[#5FC2AB] text-[#FAF7F2] shadow-md shadow-[#5FC2AB]/25 font-medium disabled:opacity-50"
            >
              {committing ? <Spinner label="Applying…" /> : (<><Check size={14} /> Approve</>)}
            </button>
            <button
              onClick={discard}
              disabled={committing}
              className="text-sm px-3 py-2 rounded-xl bg-transparent border border-[#D9D2C4] text-[#6B6357] hover:bg-[#EFE9DE] transition-colors disabled:opacity-50"
            >
              Discard
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3">
            <label className="block text-xs text-[#6B6357] mb-1">Target weekly mileage, km (optional)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={targetWeeklyMileage}
              onChange={(e) => setTargetWeeklyMileage(e.target.value)}
              placeholder="Defaults to your recent training volume average"
              className="w-full bg-[#FFFFFF] border border-[#E2DCD0] rounded-xl px-3 py-2 text-sm outline-none shadow-sm focus:border-[#2E9C86] focus:shadow-md transition-shadow"
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs text-[#6B6357] mb-1">Runs per week (optional)</label>
            <input
              type="number"
              min="0"
              max="14"
              step="1"
              value={runsPerWeek}
              onChange={(e) => setRunsPerWeek(e.target.value)}
              placeholder="Defaults to your profile setting, or the plan's judgment"
              className="w-full bg-[#FFFFFF] border border-[#E2DCD0] rounded-xl px-3 py-2 text-sm outline-none shadow-sm focus:border-[#2E9C86] focus:shadow-md transition-shadow"
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs text-[#6B6357] mb-2">Cross-training (optional)</label>
            <div className="flex flex-wrap gap-2">
              {CROSS_TRAINING_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleCrossTraining(option)}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-xl border transition-colors capitalize ${
                    crossTraining.includes(option)
                      ? "bg-[#5FC2AB] text-[#FAF7F2] border-[#2E9C86] font-medium"
                      : "bg-transparent border-[#D9D2C4] text-[#6B6357] hover:bg-[#EFE9DE]"
                  }`}
                >
                  {crossTraining.includes(option) && <Check size={12} />}
                  {option}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-[#D14F3F] mb-2">{error}</p>}
          <button
            onClick={generate}
            disabled={submitting}
            className="text-sm px-3 py-2 rounded-xl bg-transparent border border-[#D9D2C4] text-[#6B6357] hover:bg-[#EFE9DE] transition-colors disabled:opacity-50"
          >
            {submitting ? <Spinner label="Generating…" /> : "Generate maintenance plan"}
          </button>
        </>
      )}
    </div>
  );
}
