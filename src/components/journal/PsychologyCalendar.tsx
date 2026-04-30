import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import type { PsychologyLog } from "@/lib/psychology";
import { todayNyDateStr } from "@/lib/psychology";
import type { Trade } from "@/lib/trades";

interface Props {
  selectedDate: string; // YYYY-MM-DD (NY)
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
    const map = new Map<
      string,
      {
        hasDaily: boolean;
        tradeLogCount: number;
        tradeCount: number;
        netPnl: number;
        mood?: string;
      }
    >();
    for (const l of logs) {
      const cur = map.get(l.date) ?? {
        hasDaily: false,
        tradeLogCount: 0,
        tradeCount: 0,
        netPnl: 0,
      };
      if (l.tradeId === null) {
        cur.hasDaily = true;
        if (l.morningMood) cur.mood = l.morningMood;
      } else cur.tradeLogCount += 1;
      map.set(l.date, cur);
    }
    for (const t of trades) {
      const k = format(new Date(t.entryTime), "yyyy-MM-dd");
      const cur = map.get(k) ?? { hasDaily: false, tradeLogCount: 0, tradeCount: 0, netPnl: 0 };
      cur.tradeCount += 1;
      cur.netPnl += Number(t.netPnl) || 0;
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

  // Group days into weeks of 7
  const rows = useMemo(() => {
    const res: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      res.push(days.slice(i, i + 7));
    }
    return res;
  }, [days]);

  return (
    <section className="bg-white rounded-[40px] border border-border shadow-sm overflow-hidden animate-in fade-in duration-500 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-border bg-white flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CalendarDays className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-foreground">
              Psychology History
            </h2>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1">
              Daily Check-ins & Performance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-muted/30 rounded-2xl p-1.5 gap-1 border border-border/50">
            <button
              onClick={goPrev}
              className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-muted-foreground hover:text-foreground transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-6 py-1 text-sm font-black text-foreground min-w-[160px] text-center uppercase tracking-widest">
              {monthLabel}
            </div>
            <button
              onClick={goNext}
              className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-muted-foreground hover:text-foreground transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={goToday}
            className="px-6 py-3 rounded-2xl text-xs font-black tracking-widest bg-white border border-border text-muted-foreground hover:border-primary hover:text-primary transition-all active:scale-95 uppercase shadow-sm"
          >
            Today
          </button>
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex-1 flex flex-col">
        {/* Days of week */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/10">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="py-4 text-center text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]"
            >
              {w}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="flex-1 flex flex-col divide-y divide-border">
          {rows.map((row, i) => (
            <div key={i} className="flex-1 grid grid-cols-7 divide-x divide-border min-h-[120px]">
              {row.map((d) => {
                const k = ymd(d);
                const inMonth = d.getMonth() === anchor.getMonth();
                const isSelected = k === selectedDate;
                const isToday = k === today;
                const s = stats.get(k);

                return (
                  <div
                    key={k}
                    onClick={() => onSelectDate(k)}
                    className={`relative p-4 flex flex-col justify-between cursor-pointer transition-all duration-300 group
                      ${inMonth ? "bg-white hover:bg-muted/30" : "bg-muted/5"}
                      ${isSelected ? "ring-4 ring-inset ring-primary/40 z-10" : ""}
                      ${isToday && !isSelected ? "ring-2 ring-inset ring-primary/20" : ""}
                      ${!inMonth ? "opacity-20" : ""}
                    `}
                  >
                    {/* Day number */}
                    <div className="flex justify-between items-start">
                      <span
                        className={`text-sm font-black ${inMonth ? "text-foreground group-hover:text-primary" : "text-muted-foreground/30"}`}
                      >
                        {d.getDate()}
                      </span>
                      {s && s.tradeCount > 0 && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
                          {s.tradeCount}T
                        </span>
                      )}
                    </div>

                    {/* Mood / Center Content */}
                    <div className="flex-1 flex items-center justify-center py-2">
                      {s?.mood && (
                        <span className="text-2xl drop-shadow-sm transition-transform duration-300 group-hover:scale-125">
                          {s.mood}
                        </span>
                      )}
                    </div>

                    {/* Bottom Stats */}
                    <div className="flex flex-col items-center">
                      {s && s.tradeCount > 0 && (
                        <span
                          className={`text-[11px] font-black ${s.netPnl >= 0 ? "text-primary" : "text-destructive"}`}
                        >
                          {s.netPnl >= 0 ? "+" : ""}${Math.abs(s.netPnl).toFixed(0)}
                        </span>
                      )}
                      {/* Indicators */}
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {s?.hasDaily && (
                          <div className="w-1.5 h-1.5 rounded-full shadow-sm bg-primary" />
                        )}
                        {s && s.tradeLogCount > 0 && (
                          <div className="w-1.5 h-1.5 rounded-full shadow-sm bg-amber-500" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="px-8 py-6 border-t border-border bg-white flex items-center gap-8 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Daily Check-in
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Trade Evaluation
          </span>
        </div>
      </div>
    </section>
  );
}
