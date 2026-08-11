"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Sparkles, User, Check, X, AlertCircle, Plus, RefreshCw, CheckCircle2, Link2 } from "lucide-react";
import { apiFetchJson } from "@/lib/apiClient";
import BottomNav from "@/components/BottomNav";

// --- Design tokens ---
// Background: graphite track surface. Accent: lane colors per workout type.
// AI-generated workouts get a dashed left rail; user-added get a solid one.
export const TYPE_STYLES = {
  EASY_RUN:   { label: "Easy run",   color: "#7DD3C0" },
  TEMPO_RUN:  { label: "Tempo",      color: "#F2A65A" },
  INTERVALS:  { label: "Intervals",  color: "#E8574B" },
  LONG_RUN:   { label: "Long run",   color: "#5B9BD5" },
  RACE:       { label: "Race",       color: "#F2D95C" },
  STRENGTH:   { label: "Strength",   color: "#B98CE0" },
  HIIT:       { label: "HIIT",       color: "#E8574B" },
  MTB:        { label: "MTB",        color: "#6FCF97" },
  CYCLING:    { label: "Cycling",    color: "#6FCF97" },
  SWIM:       { label: "Swim",       color: "#5BC0DE" },
  MOBILITY:   { label: "Mobility",   color: "#9AA5B1" },
  REST:       { label: "Rest",       color: "#4A5058" },
  OTHER:      { label: "Other",      color: "#9AA5B1" },
  // Pseudo-type for completed Activity rows (Strava/Garmin ingestion) that
  // haven't been matched to a PlannedWorkout yet — see matchActivitiesToPlannedWorkouts().
  ACTIVITY:   { label: "Completed",  color: "#4ADE80" },
};

const WORKOUT_TYPES = Object.keys(TYPE_STYLES).filter((t) => t !== "ACTIVITY");

export function styleFor(type) {
  return TYPE_STYLES[type] || TYPE_STYLES.OTHER;
}

// Heuristic run-type classification for completed activities — there's no coach-assigned
// type for unplanned runs, so we infer one from the activity's own pace/distance/lap data.
// Order matters: long-run and interval structure are checked before pace intensity, since a
// long tempo effort should still read as "Long run" and a workout with easy jog recoveries
// between hard reps would otherwise average out to a misleadingly moderate pace.
const LONG_RUN_DISTANCE_KM = 15;
const LONG_RUN_DURATION_SEC = 90 * 60;
// Auto-laps (per-km/mile splits from a watch) drift from hills, traffic lights, and fatigue on
// a perfectly normal easy run — a plain CV check alone was flagging those as intervals. Real
// interval sessions don't just vary, they oscillate: hard reps and easy recoveries repeatedly
// swap sides of the mean. Requiring both a larger CV *and* at least two of those swings rules out
// single-direction drift (one hill, one slow start) while still catching real structured work.
const INTERVAL_PACE_CV_THRESHOLD = 0.18; // lap-to-lap pace variability above this reads as structured intervals, not pace drift
const INTERVAL_MIN_ALTERNATIONS = 2; // min number of times laps swap between faster/slower than the mean
const TEMPO_INTENSITY_THRESHOLD = 0.93; // avg pace within ~7% of estimated threshold pace reads as tempo/threshold effort

function classifyRunType(activity, thresholdPaceSecPerKm) {
  if (!activity.type?.toLowerCase().includes("run") || !activity.distance || !activity.duration) return null;

  if (activity.distance / 1000 >= LONG_RUN_DISTANCE_KM || activity.duration >= LONG_RUN_DURATION_SEC) {
    return "LONG_RUN";
  }

  const laps = activity.splits?.laps;
  if (Array.isArray(laps) && laps.length >= 3) {
    const paces = laps.map((l) => l.paceSecPerKm).filter((p) => Number.isFinite(p) && p > 0);
    if (paces.length >= 3) {
      const mean = paces.reduce((a, b) => a + b, 0) / paces.length;
      const variance = paces.reduce((sum, p) => sum + (p - mean) ** 2, 0) / paces.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
      if (cv > INTERVAL_PACE_CV_THRESHOLD) {
        let alternations = 0;
        let prevSide = null;
        for (const p of paces) {
          const side = p > mean ? 1 : -1;
          if (prevSide !== null && side !== prevSide) alternations++;
          prevSide = side;
        }
        if (alternations >= INTERVAL_MIN_ALTERNATIONS) return "INTERVALS";
      }
    }
  }

  if (thresholdPaceSecPerKm && activity.avgPace && thresholdPaceSecPerKm / activity.avgPace >= TEMPO_INTENSITY_THRESHOLD) {
    return "TEMPO_RUN";
  }

  return "EASY_RUN";
}

function formatMonth(date) {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// Local calendar date, not UTC — toISOString() shifts to UTC and is off by
// one day for most of the day in any positive-UTC-offset timezone.
function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthRange(year, month) {
  const start = toKey(new Date(year, month, 1));
  const end = toKey(new Date(year, month + 1, 0));
  return { start, end };
}

// Monday-of-week key for a Date, matching how week focuses are stored/keyed.
function mondayKeyOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toKey(d);
}

function chunkWeeks(cells) {
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function TrainingCalendar() {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [plannedWorkouts, setPlannedWorkouts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [weekFocuses, setWeekFocuses] = useState([]);
  const [thresholdPaceSecPerKm, setThresholdPaceSecPerKm] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedDateKey, setSelectedDateKey] = useState(null);
  const [addFormDate, setAddFormDate] = useState(null);
  const [logFormDate, setLogFormDate] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [stravaConnected, setStravaConnected] = useState(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const grid = useMemo(() => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const weeks = useMemo(() => chunkWeeks(grid), [grid]);
  const focusByMonday = useMemo(() => {
    const map = {};
    for (const wf of weekFocuses) map[mondayKeyOf(new Date(wf.weekStart))] = wf.focus;
    return map;
  }, [weekFocuses]);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { start, end } = monthRange(cursor.getFullYear(), cursor.getMonth());
    try {
      const data = await apiFetchJson(`/api/workouts?start=${start}&end=${end}`);
      setPlannedWorkouts(data.plannedWorkouts ?? []);
      setActivities(data.activities ?? []);
      setWeekFocuses(data.weekFocuses ?? []);
      setThresholdPaceSecPerKm(data.thresholdPaceSecPerKm ?? 0);
      if (data.reviewErrors?.length > 0) {
        setSyncMessage(`Plan review had issues: ${data.reviewErrors.join("; ")}`);
      }
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [cursor]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  const loadStravaStatus = useCallback(async () => {
    try {
      const data = await apiFetchJson("/api/strava/status");
      setStravaConnected(Boolean(data.connected));
    } catch {
      setStravaConnected(false);
    }
  }, []);

  useEffect(() => {
    loadStravaStatus();
  }, [loadStravaStatus]);

  // Feedback from the Strava OAuth callback redirect (?strava=connected|error).
  useEffect(() => {
    const strava = searchParams.get("strava");
    if (!strava) return;

    if (strava === "connected") {
      const backfilled = searchParams.get("backfilled");
      const backfillError = searchParams.get("backfillError");
      setSyncMessage(
        backfillError
          ? `Strava connected — but the initial backfill failed: ${backfillError}`
          : `Strava connected — backfilled ${backfilled} activities.`
      );
      loadMonth();
      loadStravaStatus();
    } else if (strava === "error") {
      setSyncMessage(`Strava connection failed: ${searchParams.get("reason") ?? "unknown error"}`);
    }

    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Merge planned workouts with completed activities into one calendar feed.
  // Activities render even though matchActivitiesToPlannedWorkouts() hasn't
  // matched them to a planned entry yet — "done" should show up regardless.
  const items = useMemo(() => {
    const plannedItems = plannedWorkouts.map((w) => {
      const summaryParts = [];
      if (w.targetDistance) summaryParts.push(`${(w.targetDistance / 1000).toFixed(1)}km`);
      if (w.targetDuration) summaryParts.push(`${w.targetDuration}min`);

      return {
        id: `planned-${w.id}`,
        rawId: w.id,
        date: toKey(new Date(w.date)),
        type: w.type,
        description: [summaryParts.join(" · "), w.description].filter(Boolean).join("\n\n"),
        source: w.source,
        status: w.status,
        adjustmentReason: w.adjustmentReason,
        kind: "planned",
      };
    });

    const activityItems = activities.map((a) => {
      const runType = classifyRunType(a, thresholdPaceSecPerKm);
      const parts = [runType ? TYPE_STYLES[runType].label : a.type];
      if (a.distance) parts.push(`${(a.distance / 1000).toFixed(1)}km`);
      parts.push(formatElapsed(a.duration));
      if (a.avgPace) parts.push(`${formatPace(a.avgPace)}/km avg`);
      if (a.avgHr) parts.push(`${a.avgHr}bpm avg`);
      if (a.perceivedEffort) parts.push(`RPE ${a.perceivedEffort}`);

      return {
        id: `activity-${a.id}`,
        rawId: a.id,
        date: toKey(new Date(a.date)),
        type: "ACTIVITY",
        description: [parts.join(" · "), a.notes].filter(Boolean).join("\n\n"),
        source: "ACTIVITY",
        status: "completed",
        kind: "activity",
        isStrava: a.source === "strava",
      };
    });

    return [...plannedItems, ...activityItems];
  }, [plannedWorkouts, activities, thresholdPaceSecPerKm]);

  const itemsByDate = useMemo(() => {
    const map = {};
    for (const item of items) {
      if (!map[item.date]) map[item.date] = [];
      map[item.date].push(item);
    }
    return map;
  }, [items]);

  const pendingAdjustments = items.filter((w) => w.kind === "planned" && w.adjustmentReason && w.status === "planned");

  function shiftMonth(delta) {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  }

  async function resolveAdjustment(rawId, accept) {
    try {
      await apiFetchJson(`/api/workouts/${rawId}`, {
        method: "PATCH",
        body: JSON.stringify({ resolveAdjustment: accept ? "accept" : "dismiss" }),
      });
      await loadMonth();
    } catch (err) {
      setLoadError(err.message);
    }
  }

  async function runSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await apiFetchJson("/api/sync", { method: "POST" });
      setSyncMessage(`Synced — ${result.newCount} new activit${result.newCount === 1 ? "y" : "ies"}.`);
      await loadMonth();
    } catch (err) {
      setSyncMessage(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  const today = new Date();
  const todayKey = toKey(today);

  // Past/today -> you're recording something that happened; future -> you're
  // planning ahead. The day itself decides which form opens, no extra menu.
  function openQuickAdd(dateKey) {
    if (dateKey <= todayKey) {
      setLogFormDate(dateKey);
    } else {
      setAddFormDate(dateKey);
    }
  }

  return (
    <div className="min-h-screen bg-[#16181A] text-[#EDEAE3] font-[system-ui]">
      <div className="max-w-4xl mx-auto px-4 pt-8 pb-28">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#6B7280] mb-1">Training plan</p>
            <h1 className="text-2xl font-semibold tracking-tight">{formatMonth(cursor)}</h1>
          </div>
          <div className="flex items-center gap-2">
            {stravaConnected ? (
              <span className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md bg-transparent border border-[#3A3F45] text-[#7DD3C0]">
                <CheckCircle2 size={14} /> Strava connected
              </span>
            ) : (
              <a
                href="/api/strava/connect"
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md bg-transparent border border-[#3A3F45] text-[#9AA5B1] hover:bg-[#2A2E32] transition-colors"
              >
                <Link2 size={14} /> Connect Strava
              </a>
            )}
            <button
              onClick={runSync}
              disabled={syncing}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md bg-transparent border border-[#3A3F45] text-[#9AA5B1] hover:bg-[#2A2E32] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> Sync now
            </button>
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={() => shiftMonth(-1)}
                className="p-2 rounded-md hover:bg-[#232628] transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => shiftMonth(1)}
                className="p-2 rounded-md hover:bg-[#232628] transition-colors"
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {syncMessage && (
          <p className="mb-4 text-xs text-[#9AA5B1] bg-[#232628] border border-[#3A3F45] rounded-lg px-4 py-3">
            {syncMessage}
          </p>
        )}

        {loadError && (
          <p className="mb-4 text-xs text-[#E8574B] border border-[#E8574B]/40 rounded-lg px-4 py-3 bg-[#E8574B]/10">
            Couldn't load workouts: {loadError}
          </p>
        )}

        {/* Pending adjustments banner */}
        {pendingAdjustments.length > 0 && (
          <div className="mb-6 space-y-2">
            {pendingAdjustments.map((w) => (
              <div
                key={w.id}
                className="flex items-start gap-3 bg-[#232628] border border-[#3A3F45] rounded-lg px-4 py-3"
              >
                <AlertCircle size={18} className="text-[#F2A65A] mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#EDEAE3]">
                    <span className="font-medium">{styleFor(w.type).label}</span> on{" "}
                    {new Date(w.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                  </p>
                  <p className="text-xs text-[#9AA5B1] mt-0.5">{w.adjustmentReason}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => resolveAdjustment(w.rawId, true)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-[#7DD3C0] text-[#16181A] font-medium hover:opacity-90 transition-opacity"
                  >
                    <Check size={13} /> Accept
                  </button>
                  <button
                    onClick={() => resolveAdjustment(w.rawId, false)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-transparent border border-[#3A3F45] text-[#9AA5B1] hover:bg-[#2A2E32] transition-colors"
                  >
                    <X size={13} /> Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Weekday labels */}
        <div className="grid grid-cols-7 mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="text-center text-xs text-[#6B7280] py-2 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Month grid — grouped into week rows so each week can show its focus/theme */}
        <div className={loading ? "opacity-50" : ""}>
          {weeks.map((week, wi) => {
            const firstDate = week.find((d) => d);
            const focus = firstDate ? focusByMonday[mondayKeyOf(firstDate)] : undefined;
            return (
              <div key={wi} className="mb-1.5">
                {focus && (
                  <div className="text-[10px] text-[#7DD3C0] font-medium tracking-wide px-1 mb-1 truncate">
                    {focus}
                  </div>
                )}
                <div className="grid grid-cols-7 gap-1.5">
                  {week.map((date, i) => {
                    if (!date) return <div key={i} className="aspect-square" />;
                    const key = toKey(date);
            const dayItems = itemsByDate[key] || [];
            const isToday = key === todayKey;

            const isSelected = key === selectedDateKey;

            return (
              <div
                key={i}
                onClick={() => setSelectedDateKey((prev) => (prev === key ? null : key))}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedDateKey((prev) => (prev === key ? null : key));
                  }
                }}
                className={`aspect-square rounded-lg border p-1.5 flex flex-col gap-1 overflow-hidden cursor-pointer transition-colors ${
                  isSelected
                    ? "border-[#7DD3C0] bg-[#1D2422] ring-1 ring-[#7DD3C0]/50"
                    : isToday
                    ? "border-[#7DD3C0]/60 bg-[#1D2422]"
                    : "border-[#26292D] bg-[#1B1D1F] hover:border-[#3A3F45]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isToday ? "text-[#7DD3C0] font-semibold" : "text-[#6B7280]"}`}>
                    {date.getDate()}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openQuickAdd(key);
                    }}
                    aria-label={key <= todayKey ? `Log a workout on ${key}` : `Plan a workout on ${key}`}
                    className="flex items-center justify-center w-6 h-6 -mr-1 -mt-1 rounded-full bg-[#2A2E32] text-[#B8C0C8] hover:bg-[#3A3F45] hover:text-[#EDEAE3] active:scale-90 transition-all"
                  >
                    <Plus size={14} strokeWidth={2.5} />
                  </button>
                </div>
                <div className="flex flex-col gap-1 overflow-hidden">
                  {dayItems.slice(0, 2).map((w) => (
                    <div
                      key={w.id}
                      className="text-left rounded px-1.5 py-1 text-[10px] leading-tight truncate"
                      style={{
                        backgroundColor: `${styleFor(w.type).color}22`,
                        borderLeft: `2px solid ${styleFor(w.type).color}`,
                        borderStyle: w.source === "AI_GENERATED" ? "dashed" : "solid",
                        borderLeftWidth: "3px",
                      }}
                    >
                      <span className="text-[#EDEAE3] font-medium">{styleFor(w.type).label}</span>
                    </div>
                  ))}
                  {dayItems.length > 2 && (
                    <span className="text-[9px] text-[#6B7280] px-1.5">+{dayItems.length - 2} more</span>
                  )}
                </div>
              </div>
            );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected day detail — inline, no popup */}
        {selectedDateKey && (
          <div className="mt-4 bg-[#1F2225] border border-[#2E3236] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-[#EDEAE3]">
                {new Date(`${selectedDateKey}T00:00:00`).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <button
                onClick={() => setSelectedDateKey(null)}
                aria-label="Close"
                className="text-[#6B7280] hover:text-[#EDEAE3] transition-colors p-1"
              >
                <X size={16} />
              </button>
            </div>

            {(itemsByDate[selectedDateKey] || []).length === 0 ? (
              <p className="text-xs text-[#6B7280]">Nothing planned or logged for this day.</p>
            ) : (
              <div className="space-y-2">
                {(itemsByDate[selectedDateKey] || []).map((w) => (
                  <div key={w.id} className="flex items-start gap-2.5 rounded-md px-3 py-2.5 bg-[#232628]">
                    <span
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: styleFor(w.type).color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[#EDEAE3]">{styleFor(w.type).label}</span>
                        <span className="text-[10px] text-[#6B7280] flex items-center gap-1 ml-auto shrink-0">
                          {w.source === "AI_GENERATED" ? (
                            <Sparkles size={10} />
                          ) : w.source === "ACTIVITY" ? (
                            <CheckCircle2 size={10} />
                          ) : (
                            <User size={10} />
                          )}
                          {w.source === "AI_GENERATED" ? "AI-generated" : w.source === "ACTIVITY" ? "Completed" : "Your plan"}
                        </span>
                      </div>
                      <p className="text-sm text-[#EDEAE3] mt-1 whitespace-pre-wrap">{w.description}</p>
                      {w.isStrava && <StravaActivityExtras activityId={w.rawId} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-5 mt-6 text-xs text-[#6B7280]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-[2px] bg-[#9AA5B1]" style={{ borderTop: "2px solid #9AA5B1" }} />
            <User size={12} /> Your plan
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-[2px]" style={{ borderTop: "2px dashed #9AA5B1" }} />
            <Sparkles size={12} /> AI-generated
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={12} style={{ color: TYPE_STYLES.ACTIVITY.color }} /> Completed
          </div>
        </div>


        {/* Add workout modal */}
        {addFormDate && (
          <AddWorkoutModal
            defaultDate={addFormDate}
            onClose={() => setAddFormDate(null)}
            onCreated={() => {
              setAddFormDate(null);
              loadMonth();
            }}
          />
        )}

        {/* Log workout modal */}
        {logFormDate && (
          <LogWorkoutModal
            defaultDate={logFormDate}
            onClose={() => setLogFormDate(null)}
            onLogged={(adjustmentError) => {
              setLogFormDate(null);
              if (adjustmentError) {
                setSyncMessage(`Logged — but couldn't re-check your upcoming plan: ${adjustmentError}`);
              }
              loadMonth();
            }}
          />
        )}
      </div>

      <BottomNav active="calendar" />
    </div>
  );
}

function AddWorkoutModal({ defaultDate, onClose, onCreated }) {
  const [date, setDate] = useState(defaultDate);
  const [type, setType] = useState("EASY_RUN");
  const [description, setDescription] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiFetchJson("/api/workouts", {
        method: "POST",
        body: JSON.stringify({
          date,
          type,
          description: description.trim(),
          targetDistance: distanceKm ? Number(distanceKm) * 1000 : null,
          targetDuration: durationMin ? Number(durationMin) : null,
        }),
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#1F2225] border border-[#2E3236] rounded-t-xl sm:rounded-xl w-full sm:max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold mb-4">Add workout</h2>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs text-[#9AA5B1] mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#9AA5B1] mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0]"
            >
              {WORKOUT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_STYLES[t].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#9AA5B1] mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="e.g. 10km easy, conversational pace"
              className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0] resize-none"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-[#9AA5B1] mb-1">Distance (km, optional)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0]"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-[#9AA5B1] mb-1">Duration (min, optional)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0]"
              />
            </div>
          </div>

          {error && <p className="text-xs text-[#E8574B]">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-center text-sm py-2 rounded-md bg-[#2A2E32] hover:bg-[#32373C] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 text-center text-sm py-2 rounded-md bg-[#7DD3C0] text-[#16181A] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Distance/pace only makes sense for these — everything else (team sports,
// gym) just gets duration + RPE + notes.
const DISTANCE_TYPES = ["Run", "Ride", "Swim", "Walk", "Hike"];
const NON_DISTANCE_TYPES = ["Field Hockey", "Gym", "Other"];
const ACTIVITY_TYPE_OPTIONS = [...DISTANCE_TYPES, ...NON_DISTANCE_TYPES];

const RPE_LABELS = {
  1: "1 — very easy",
  2: "2",
  3: "3 — easy",
  4: "4",
  5: "5 — moderate",
  6: "6",
  7: "7 — hard",
  8: "8",
  9: "9 — very hard",
  10: "10 — max effort",
};

function LogWorkoutModal({ defaultDate, onClose, onLogged }) {
  const [date, setDate] = useState(defaultDate);
  const [type, setType] = useState("Run");
  const [distanceKm, setDistanceKm] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [avgHr, setAvgHr] = useState("");
  const [perceivedEffort, setPerceivedEffort] = useState("5");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isDistanceType = DISTANCE_TYPES.includes(type);

  async function submit(e) {
    e.preventDefault();
    if (!durationMin) {
      setError("Duration is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiFetchJson("/api/activities", {
        method: "POST",
        body: JSON.stringify({
          date,
          type,
          distance: isDistanceType && distanceKm ? Number(distanceKm) * 1000 : null,
          duration: Number(durationMin) * 60,
          avgHr: avgHr ? Number(avgHr) : null,
          perceivedEffort: perceivedEffort ? Number(perceivedEffort) : null,
          notes: notes.trim() || null,
        }),
      });
      onLogged(result.adjustmentError);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#1F2225] border border-[#2E3236] rounded-t-xl sm:rounded-xl w-full sm:max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold mb-1">Log workout</h2>
        <p className="text-xs text-[#6B7280] mb-4">
          Logs a completed session and re-checks your upcoming AI-generated plan against it.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs text-[#9AA5B1] mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#9AA5B1] mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0]"
            >
              {ACTIVITY_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            {isDistanceType && (
              <div className="flex-1">
                <label className="block text-xs text-[#9AA5B1] mb-1">Distance (km)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0]"
                />
              </div>
            )}
            <div className="flex-1">
              <label className="block text-xs text-[#9AA5B1] mb-1">Duration (min)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0]"
              />
            </div>
          </div>
          {isDistanceType && (
            <div>
              <label className="block text-xs text-[#9AA5B1] mb-1">Avg heart rate (optional)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={avgHr}
                onChange={(e) => setAvgHr(e.target.value)}
                className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0]"
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-[#9AA5B1] mb-1">Perceived effort (RPE)</label>
            <select
              value={perceivedEffort}
              onChange={(e) => setPerceivedEffort(e.target.value)}
              className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0]"
            >
              {Object.entries(RPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#9AA5B1] mb-1">
              Notes (optional) {!isDistanceType && "— sets/reps, drills, intervals, how it felt"}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={isDistanceType ? "e.g. 6x400m @ 5K pace, 90s jog recovery" : "e.g. Squats 5x5 @ 80kg, bench 3x8"}
              className="w-full bg-[#1B1D1F] border border-[#2E3236] rounded-md px-3 py-2 text-sm outline-none focus:border-[#7DD3C0] resize-none"
            />
          </div>

          {error && <p className="text-xs text-[#E8574B]">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-center text-sm py-2 rounded-md bg-[#2A2E32] hover:bg-[#32373C] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 text-center text-sm py-2 rounded-md bg-[#7DD3C0] text-[#16181A] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "Logging…" : "Log"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Strava HR/pace, shown inline in the day panel ---
// (Route map dropped for now — a plain shape with no street/background
// context wasn't worth the space. Revisit with a real tiled map later.)

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatPace(secPerKm) {
  return `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, "0")}`;
}

function buildLinePath(values, width, height, padding, marginLeft, marginRight) {
  const validValues = values.filter((v) => v != null);
  if (validValues.length === 0) return { pathStrings: [], points: [], min: 0, max: 0 };

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const range = max - min || 1;
  const innerW = width - marginLeft - marginRight;
  const innerH = height - padding * 2;

  const points = values.map((v, i) => {
    if (v == null) return null;
    const x = marginLeft + (i / (values.length - 1 || 1)) * innerW;
    const y = padding + innerH - ((v - min) / range) * innerH;
    return [x, y];
  });

  const segments = [];
  let current = [];
  for (const p of points) {
    if (p === null) {
      if (current.length > 1) segments.push(current);
      current = [];
    } else {
      current.push(p);
    }
  }
  if (current.length > 1) segments.push(current);

  const pathStrings = segments.map((seg) => "M " + seg.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L "));
  return { pathStrings, points, min, max };
}

const CHART_WIDTH = 280;
const CHART_HEIGHT = 84;
const CHART_PADDING = 4;
// Dual y-axis: HR ticks read on the left (against the line), pace ticks on the right
// (against the bars) — each margin is reserved plot width for that axis's tick text.
const AXIS_LABEL_WIDTH_LEFT = 26;
const AXIS_LABEL_WIDTH_RIGHT = 32;

function buildLapBars(laps, time, width, height, padding, marginLeft, marginRight) {
  if (!laps || laps.length === 0 || !time || time.length === 0) return { bars: [], min: 0, max: 0 };
  const totalTime = time[time.length - 1] || 1;
  const paces = laps.map((l) => l.paceSecPerKm);
  const min = Math.min(...paces);
  const max = Math.max(...paces);
  const range = max - min || 1;
  const innerW = width - marginLeft - marginRight;
  const innerH = height - padding * 2;

  const bars = laps.map((lap) => {
    const barHeight = Math.max(2, ((lap.paceSecPerKm - min) / range) * innerH);
    const x = marginLeft + (lap.startSeconds / totalTime) * innerW;
    const barWidth = Math.max(1, ((lap.endSeconds - lap.startSeconds) / totalTime) * innerW - 1);
    const y = height - padding - barHeight;
    return { ...lap, x, y, width: barWidth, height: barHeight };
  });
  return { bars, min, max };
}

// Y-axis tick rows shared by both series — same three heights, different values per side.
const TICK_ROWS = [
  { y: CHART_PADDING + 3, at: "max" },
  { y: CHART_HEIGHT / 2 + 2, at: "mid" },
  { y: CHART_HEIGHT - CHART_PADDING, at: "min" },
];

function tickValue(min, max, at) {
  if (at === "max") return max;
  if (at === "min") return min;
  return (min + max) / 2;
}

function HrPaceChart({ heartrate, time, laps }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const hr = useMemo(
    () => buildLinePath(heartrate ?? [], CHART_WIDTH, CHART_HEIGHT, CHART_PADDING, AXIS_LABEL_WIDTH_LEFT, AXIS_LABEL_WIDTH_RIGHT),
    [heartrate]
  );
  const { bars, min: paceMin, max: paceMax } = useMemo(
    () => buildLapBars(laps, time, CHART_WIDTH, CHART_HEIGHT, CHART_PADDING, AXIS_LABEL_WIDTH_LEFT, AXIS_LABEL_WIDTH_RIGHT),
    [laps, time]
  );

  if (hr.pathStrings.length === 0 && bars.length === 0) return null;

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const viewBoxX = ((e.clientX - rect.left) / rect.width) * CHART_WIDTH;
    const plotWidth = CHART_WIDTH - AXIS_LABEL_WIDTH_LEFT - AXIS_LABEL_WIDTH_RIGHT;
    const ratio = Math.min(1, Math.max(0, (viewBoxX - AXIS_LABEL_WIDTH_LEFT) / plotWidth));
    const index = Math.round(ratio * (heartrate.length - 1));
    setHoverIndex(heartrate[index] != null ? index : null);
  }

  const hoverPoint = hoverIndex != null ? hr.points[hoverIndex] : null;
  const hoverTime = hoverIndex != null ? time[hoverIndex] : null;
  const hoverLap = hoverTime != null && laps ? laps.find((l) => hoverTime >= l.startSeconds && hoverTime < l.endSeconds) : null;

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] uppercase tracking-wide" style={{ color: "#E8574B" }}>
          Heart rate
        </span>
        <span className="text-[9px] uppercase tracking-wide" style={{ color: "#5B9BD5" }}>
          Pace / lap
        </span>
      </div>
      <div className="h-3 mb-1 text-[9px] text-[#EDEAE3] flex items-center justify-between">
        {hoverPoint && <span>{Math.round(heartrate[hoverIndex])} bpm · {formatElapsed(hoverTime)}</span>}
        {hoverLap && <span>Lap {hoverLap.lapIndex} · {formatPace(hoverLap.paceSecPerKm)}/km</span>}
      </div>
      <div className="relative">
        {hr.pathStrings.length > 0 &&
          TICK_ROWS.map((row) => (
            <span
              key={`hr-${row.at}`}
              className="absolute text-[7px] leading-none pointer-events-none"
              style={{
                left: 0,
                width: `${(AXIS_LABEL_WIDTH_LEFT / CHART_WIDTH) * 100}%`,
                top: `${(row.y / CHART_HEIGHT) * 100}%`,
                transform: "translateY(-50%)",
                textAlign: "right",
                paddingRight: 3,
                color: "#E8574B",
              }}
            >
              {Math.round(tickValue(hr.min, hr.max, row.at))}
            </span>
          ))}
        {bars.length > 0 &&
          TICK_ROWS.map((row) => (
            <span
              key={`pace-${row.at}`}
              className="absolute text-[7px] leading-none pointer-events-none"
              style={{
                right: 0,
                width: `${(AXIS_LABEL_WIDTH_RIGHT / CHART_WIDTH) * 100}%`,
                top: `${(row.y / CHART_HEIGHT) * 100}%`,
                transform: "translateY(-50%)",
                textAlign: "left",
                paddingLeft: 3,
                color: "#5B9BD5",
              }}
            >
              {formatPace(tickValue(paceMin, paceMax, row.at))}
            </span>
          ))}
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          className="w-full block"
          style={{ height: `${CHART_HEIGHT}px` }}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
        {TICK_ROWS.map((row) => (
          <line
            key={row.at}
            x1={AXIS_LABEL_WIDTH_LEFT}
            y1={row.y}
            x2={CHART_WIDTH - AXIS_LABEL_WIDTH_RIGHT}
            y2={row.y}
            stroke="#2E3236"
            strokeWidth="0.5"
          />
        ))}
        {bars.map((bar, i) => (
          <rect
            key={i}
            x={bar.x.toFixed(1)}
            y={bar.y.toFixed(1)}
            width={bar.width.toFixed(1)}
            height={bar.height.toFixed(1)}
            rx="1"
            fill="#5B9BD5"
            opacity={hoverLap === bar ? 0.55 : 0.32}
          />
        ))}
        {hr.pathStrings.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#E8574B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {hoverPoint && (
          <>
            <line
              x1={hoverPoint[0]}
              y1={CHART_PADDING}
              x2={hoverPoint[0]}
              y2={CHART_HEIGHT - CHART_PADDING}
              stroke="#3A3F45"
              strokeWidth="1"
            />
            <circle cx={hoverPoint[0]} cy={hoverPoint[1]} r="2.5" fill="#E8574B" />
          </>
        )}
        </svg>
      </div>
    </div>
  );
}

function StravaActivityExtras({ activityId }) {
  const [streams, setStreams] = useState(null);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [streamsError, setStreamsError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingStreams(true);
    setStreamsError(null);
    apiFetchJson(`/api/activities/${activityId}/streams`)
      .then((data) => {
        if (!cancelled) setStreams(data);
      })
      .catch((err) => {
        if (!cancelled) setStreamsError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingStreams(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  return (
    <div className="mt-2 pt-2 border-t border-[#2E3236]">
      {loadingStreams && <p className="text-[10px] text-[#6B7280]">Loading HR/pace…</p>}
      {streamsError && <p className="text-[10px] text-[#E8574B]">Couldn't load HR/pace: {streamsError}</p>}
      {streams && (streams.heartrate || streams.laps) && (
        <div className="flex gap-3 bg-[#1B1D1F] border border-[#2E3236] rounded-md p-2.5">
          <HrPaceChart heartrate={streams.heartrate} time={streams.time} laps={streams.laps} />
        </div>
      )}
    </div>
  );
}
