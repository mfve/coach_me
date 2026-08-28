"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Check } from "lucide-react";
import { apiFetchJson } from "@/lib/apiClient";
import Spinner from "@/components/Spinner";
import BottomNav from "@/components/BottomNav";

const EXPERIENCE_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const CROSS_TRAINING_OPTIONS = ["strength", "mtb", "cycling", "swim"];

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [thresholdMethod, setThresholdMethod] = useState("riegel");
  const [maxHr, setMaxHr] = useState("");
  const [restingHr, setRestingHr] = useState("");
  const [runsPerWeek, setRunsPerWeek] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [injuryHistory, setInjuryHistory] = useState("");
  const [preferredTrainingDays, setPreferredTrainingDays] = useState<Record<string, boolean>>({});
  const [maxWeeklyHours, setMaxWeeklyHours] = useState("");
  const [crossTrainingPrefs, setCrossTrainingPrefs] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetchJson<{ profile: any }>("/api/profile");
      const p = data.profile;
      setThresholdMethod(p.thresholdMethod ?? "riegel");
      setMaxHr(p.maxHr != null ? String(p.maxHr) : "");
      setRestingHr(p.restingHr != null ? String(p.restingHr) : "");
      setRunsPerWeek(p.runsPerWeek != null ? String(p.runsPerWeek) : "");
      setExperienceLevel(p.experienceLevel ?? "");
      setInjuryHistory(p.injuryHistory ?? "");
      setPreferredTrainingDays(p.preferredTrainingDays ?? {});
      setMaxWeeklyHours(p.maxWeeklyHours != null ? String(p.maxWeeklyHours) : "");
      setCrossTrainingPrefs(p.crossTrainingPrefs ?? []);
      setNotes(p.notes ?? "");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleDay(key: string) {
    setPreferredTrainingDays((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleCrossTraining(option: string) {
    setCrossTrainingPrefs((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
  }

  async function handleLogout() {
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetchJson("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          thresholdMethod,
          maxHr: maxHr ? Number(maxHr) : null,
          restingHr: restingHr ? Number(restingHr) : null,
          runsPerWeek: runsPerWeek ? Number(runsPerWeek) : null,
          experienceLevel: experienceLevel || null,
          injuryHistory: injuryHistory || null,
          preferredTrainingDays,
          maxWeeklyHours: maxWeeklyHours ? Number(maxWeeklyHours) : null,
          crossTrainingPrefs,
          notes: notes || null,
        }),
      });
      setMessage("Saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const hrMethodUnavailable = thresholdMethod === "hr" && (!maxHr || !restingHr);

  return (
    <div className="min-h-screen bg-[#16181A] text-[#EDEAE3] font-[system-ui]">
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-28">
        <p className="text-xs uppercase tracking-[0.2em] text-[#6B7280] mb-1">Settings</p>
        <h1 className="text-2xl font-semibold tracking-tight mb-6">Profile</h1>

        {loading ? (
          <p className="text-sm text-[#6B7280]">
            <Spinner label="Loading…" />
          </p>
        ) : (
          <form onSubmit={save} className="bg-[#1F2225] border border-[#2E3236] rounded-lg p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold mb-1">About you</h2>
              <p className="text-xs text-[#6B7280] mb-3">
                Used as context when generating and adjusting your plan.
              </p>

              <div className="mb-3">
                <label className="block text-xs text-[#9AA5B1] mb-1">Experience level</label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0]"
                >
                  <option value="">Not specified</option>
                  {EXPERIENCE_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="block text-xs text-[#9AA5B1] mb-1">Injury history (optional)</label>
                <textarea
                  value={injuryHistory}
                  onChange={(e) => setInjuryHistory(e.target.value)}
                  placeholder="e.g. recurring left knee IT band issues, avoid high mileage weeks"
                  rows={2}
                  className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0] resize-y"
                />
              </div>

              <div className="mb-3">
                <label className="block text-xs text-[#9AA5B1] mb-2">Preferred training days (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => toggleDay(d.key)}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                        preferredTrainingDays[d.key]
                          ? "bg-[#7DD3C0] text-[#16181A] border-[#7DD3C0] font-medium"
                          : "bg-transparent border-[#3A3F45] text-[#9AA5B1] hover:bg-[#2A2E32]"
                      }`}
                    >
                      {preferredTrainingDays[d.key] && <Check size={12} />}
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-xs text-[#9AA5B1] mb-1">Max weekly training hours (optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={maxWeeklyHours}
                  onChange={(e) => setMaxWeeklyHours(e.target.value)}
                  className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0]"
                />
              </div>

              <div className="mb-3">
                <label className="block text-xs text-[#9AA5B1] mb-2">Cross-training preferences (optional)</label>
                <div className="flex flex-wrap gap-2">
                  {CROSS_TRAINING_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleCrossTraining(option)}
                      className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border transition-colors capitalize ${
                        crossTrainingPrefs.includes(option)
                          ? "bg-[#7DD3C0] text-[#16181A] border-[#7DD3C0] font-medium"
                          : "bg-transparent border-[#3A3F45] text-[#9AA5B1] hover:bg-[#2A2E32]"
                      }`}
                    >
                      {crossTrainingPrefs.includes(option) && <Check size={12} />}
                      {option}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[#6B7280] mt-1">
                  Default selection on the goal/maintenance-plan forms — still overridable per generation.
                </p>
              </div>

              <div>
                <label className="block text-xs text-[#9AA5B1] mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={'Anything else worth knowing, e.g. "I always run with a friend Thursday morning" or "prefer back-to-back rest days on weekends"'}
                  rows={3}
                  className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0] resize-y"
                />
                <p className="text-[10px] text-[#6B7280] mt-1">
                  Free text, passed directly to plan generation and chat as context.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-[#2E3236]">
              <h2 className="text-sm font-semibold mb-1">Threshold pace method</h2>
              <p className="text-xs text-[#6B7280] mb-3">
                How your threshold pace — used to size tempo/threshold sessions in generated plans — gets
                estimated from your training data.
              </p>
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="thresholdMethod"
                    value="riegel"
                    checked={thresholdMethod === "riegel"}
                    onChange={() => setThresholdMethod("riegel")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Riegel (pace-based)</span>
                    <span className="block text-xs text-[#6B7280]">
                      Projects your fastest recent qualifying run to a 60-minute-equivalent pace. No heart
                      rate needed.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="thresholdMethod"
                    value="hr"
                    checked={thresholdMethod === "hr"}
                    onChange={() => setThresholdMethod("hr")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">Heart rate (Karvonen/HRR)</span>
                    <span className="block text-xs text-[#6B7280]">
                      Estimates lactate threshold heart rate from your max/resting HR, then fits your
                      logged pace-vs-HR data to find the matching pace. Needs max HR and resting HR below,
                      and enough varied-intensity runs with HR data to fit reliably — falls back to Riegel
                      automatically when it can't.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-[#9AA5B1] mb-1">Max HR (bpm)</label>
                <input
                  type="number"
                  min="0"
                  value={maxHr}
                  onChange={(e) => setMaxHr(e.target.value)}
                  className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-[#9AA5B1] mb-1">Resting HR (bpm)</label>
                <input
                  type="number"
                  min="0"
                  value={restingHr}
                  onChange={(e) => setRestingHr(e.target.value)}
                  className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0]"
                />
              </div>
            </div>

            {hrMethodUnavailable && (
              <p className="text-xs text-[#F2A65A]">
                Heart rate method selected, but max HR and resting HR are both required — fill them in
                above, or generated plans will fall back to Riegel until you do.
              </p>
            )}

            <div className="pt-2 border-t border-[#2E3236]">
              <h2 className="text-sm font-semibold mb-1">Runs per week</h2>
              <p className="text-xs text-[#6B7280] mb-3">
                Default run frequency for generated plans — leave blank to let the plan generator decide
                based on your training volume. Can be overridden per-generation on the maintenance-plan
                form.
              </p>
              <input
                type="number"
                min="0"
                max="14"
                value={runsPerWeek}
                onChange={(e) => setRunsPerWeek(e.target.value)}
                placeholder="Let the plan decide"
                className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0]"
              />
            </div>

            {error && <p className="text-xs text-[#E8574B]">{error}</p>}
            {message && <p className="text-xs text-[#7DD3C0]">{message}</p>}

            <button
              type="submit"
              disabled={saving}
              className="text-sm px-3 py-2 rounded-md bg-[#7DD3C0] text-[#16181A] font-medium disabled:opacity-50"
            >
              {saving ? <Spinner label="Saving…" /> : "Save"}
            </button>
          </form>
        )}

        <div className="pt-6 mt-6 border-t border-[#2E3236]">
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm px-3 py-2 rounded-md border border-[#3A3F45] text-[#9AA5B1] hover:bg-[#2A2E32]"
          >
            Log out
          </button>
        </div>
      </div>
      <BottomNav active="profile" />
    </div>
  );
}
