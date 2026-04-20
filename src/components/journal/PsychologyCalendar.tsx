import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import type { PsychologyLog } from "@/lib/psychology";
import { toNyDateStr, todayNyDateStr } from "@/lib/psychology";
import type { Trade } from "@/lib/trades";

interface Props {
  selectedDate: string;          // YYYY-MM-DD (NY)
  onSelectDate: (date: string) => void;
  logs: PsychologyLog[];
  trades: Trade[];
}

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/** Build a 6×7 grid (Mon-first) for the month containing `anchor`. */
function buildMonthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  // JS getDay: 0=Sun … 6=Sat. We want Monday=0.
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function PsychologyCalendar({ selectedDate, onSelectDate, logs, trades }: Props) {
  // Anchor month derived from selectedDate when possible
  const [anchor, setAnchor] = useState<Date>(() => {
    const [y, m] = selectedDate.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, 1);
  });

  const days = useMemo(() => buildMonthGrid(anchor), [anchor]);

  // Index logs / trades by NY date string for O(1) lookup
  const stats = useMemo(() => {
    const map = new Map<string, { hasDaily: boolean; tradeLogCount: number; tradeCount: number }>();
    for (const l of logs) {
      const cur = map.get(l.date) ?? { hasDaily: false, tradeLogCount: 0, tradeCount: 0 };
      if (l.tradeId === null) cur.hasDaily = true;
      else cur.tradeLogCount += 1;
      map.set(l.date, cur);
    }
    for (const t of trades) {
      const k = toNyDateStr(t.entryTime);
      const cur = map.get(k) ?? { hasDaily: false, tradeLogCount: 0, tradeCount: 0 };
      cur.tradeCount += 1;
      map.set(k, cur);
    }
    return map;
  }, [logs, trades]);

  const today = todayNyDateStr();
  const monthLabel = anchor.toLocaleString("en-US", { month: "long", year: "numeric" });

  const goPrev = () => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1));
  const goNext = () => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1));
  const goToday = () => {
    const now = new Date();
    setAnchor(new Date(now.getFullYear(), now.getMonth(), 1));
    onSelectDate(today);
  };

  return (
    <section
      className="rounded-lg border border-terminal-border p-5"
      style={{ background: "#0B0E11" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-4 h-4 text-[#48C0D8]" />
          <h2 className="text-[11px] font-bold tracking-[0.3em] text-[#48C0D8]">
            PSYCHOLOGY HISTORY CALENDAR
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="p-1.5 rounded border border-terminal-border hover:border-[#48C0D8]/60 hover:text-[#48C0D8] text-muted-foreground transition"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div className="px-3 py-1 text-[11px] font-mono tracking-widest text-foreground min-w-[140px] text-center uppercase">
            {monthLabel}
          </div>
          <button
            onClick={goNext}
            className="p-1.5 rounded border border-terminal-border hover:border-[#48C0D8]/60 hover:text-[#48C0D8] text-muted-foreground transition"
            aria-label="Next month"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={goToday}
            className="ml-2 px-2.5 py-1 rounded text-[10px] font-bold tracking-[0.2em] border border-[#48C0D8]/40 text-[#48C0D8] hover:bg-[#48C0D8]/10 transition"
          >
            TODAY
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-[9px] font-bold tracking-[0.25em] text-muted-foreground text-center py-1"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const k = ymd(d);
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = k === today;
          const isSelected = k === selectedDate;
          const s = stats.get(k);

          return (
            <button
              key={k}
              onClick={() => onSelectDate(k)}
              className={[
                "relative aspect-square rounded-md border text-left p-1.5 transition group",
                "hover:border-[#48C0D8]/60 hover:bg-[#48C0D8]/5",
                isSelected
                  ? "border-[#48C0D8] bg-[#48C0D8]/10 shadow-[0_0_12px_oklch(0.85_0.18_200/0.35)]"
                  : isToday
                    ? "border-[#48C0D8]/40"
                    : "border-[#1E262F]",
                inMonth ? "" : "opacity-30",
              ].join(" ")}
            >
              {/* Day number */}
              <div
                className={`text-[11px] font-mono ${
                  isSelected
                    ? "text-[#48C0D8] font-bold"
                    : isToday
                      ? "text-[#48C0D8]"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground"
                }`}
              >
                {d.getDate()}
              </div>

              {/* Trade count (top-right) */}
              {s && s.tradeCount > 0 && (
                <span className="absolute top-1 right-1 text-[8px] font-bold text-muted-foreground bg-white/[0.04] px-1 rounded leading-tight">
                  {s.tradeCount}
                </span>
              )}

              {/* Indicators (bottom) */}
              <div className="absolute bottom-1 left-1 right-1 flex items-center gap-1">
                {s?.hasDaily && (
                  <span
                    title="Daily check-in"
                    className="w-1.5 h-1.5 rounded-full bg-[#48C0D8] shadow-[0_0_6px_oklch(0.85_0.18_200/0.7)]"
                  />
                )}
                {s && s.tradeLogCount > 0 && (
                  <span
                    title={`${s.tradeLogCount} trade evaluation(s)`}
                    className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.7)]"
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-terminal-border flex-wrap text-[10px] font-mono tracking-widest text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#48C0D8]" />
          DAILY CHECK-IN
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
          TRADE EVALUATION
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold bg-white/[0.04] px-1 rounded">N</span>
          TRADES LOGGED
        </div>
      </div>
    </section>
  );
}
