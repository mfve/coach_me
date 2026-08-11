import { styleFor } from "./TrainingCalendar";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

interface WeekFocus {
  weekStart: string; // YYYY-MM-DD (Monday) or full ISO
  focus: string;
}

function mondayKey(dateStr: string): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildPreviewWeeks(workouts: any[]): (any | null)[][] {
  if (workouts.length === 0) return [];
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = new Date(`${sorted[0].date}T00:00:00`);
  const startOffset = firstDate.getDay(); // 0 = Sunday

  const cells: (any | null)[] = Array(startOffset).fill(null);
  cells.push(...sorted);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (any | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function PlanPreviewGrid({ workouts, weekFocuses = [] }: { workouts: any[]; weekFocuses?: WeekFocus[] }) {
  const weeks = buildPreviewWeeks(workouts);
  const focusByMonday = new Map(weekFocuses.map((w) => [mondayKey(w.weekStart), w.focus]));

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((d, i) => (
          <div key={i} className="text-[9px] text-[#6B7280] text-center">
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => {
        const firstWorkout = week.find((w) => w);
        const focus = firstWorkout ? focusByMonday.get(mondayKey(firstWorkout.date)) : undefined;
        return (
          <div key={wi} className="mb-1">
            {focus && (
              <div className="text-[9px] text-[#7DD3C0] font-medium leading-tight mb-0.5 px-0.5 truncate">{focus}</div>
            )}
            <div className="grid grid-cols-7 gap-1">
              {week.map((w, di) => {
                if (!w) return <div key={di} />;
                const style = styleFor(w.type);
                const dayNum = new Date(`${w.date}T00:00:00`).getDate();
                return (
                  <div
                    key={di}
                    className="rounded px-1 py-1 min-h-[44px]"
                    style={{ backgroundColor: `${style.color}22`, borderLeft: `2px solid ${style.color}` }}
                  >
                    <div className="text-[9px] text-[#6B7280] leading-tight">{dayNum}</div>
                    <div className="text-[9px] text-[#EDEAE3] font-medium leading-tight truncate">{style.label}</div>
                    {w.targetDistance && (
                      <div className="text-[9px] text-[#9AA5B1] leading-tight">{(w.targetDistance / 1000).toFixed(1)}km</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
