import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  hasDailyCheckIn,
  hasTradeEval,
  type PsychologyLog,
} from "@/lib/psychology";
import { journalTradingDate } from "@/lib/journal";
import type { Trade } from "@/lib/trades";

interface Props {
  selectedDate: string; // YYYY-MM-DD (NY)
  onSelectDate: (date: string) => void;
  logs: PsychologyLog[];
  trades: Trade[];
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function buildMonthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
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
  const [anchor, setAnchor] = useState<Date>(() => {
    const [y, m] = selectedDate.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, 1);
  });

  useEffect(() => {
    const [y, m] = selectedDate.split("-").map(Number);
    setAnchor((prev) => {
      if (prev.getFullYear() === y && prev.getMonth() === (m ?? 1) - 1) return prev;
      return new Date(y, (m ?? 1) - 1, 1);
    });
  }, [selectedDate]);

  const days = useMemo(() => buildMonthGrid(anchor), [anchor]);

  const stats = useMemo(() => {
    const map = new Map<
      string,
      { hasDaily: boolean; hasEval: boolean; tradeCount: number; netPnl: number }
    >();
    for (const l of logs) {
      const cur = map.get(l.date) ?? {
        hasDaily: false,
        hasEval: false,
        tradeCount: 0,
        netPnl: 0,
      };
      if (l.tradeId === null) cur.hasDaily = hasDailyCheckIn(l);
      else if (hasTradeEval(l)) cur.hasEval = true;
      map.set(l.date, cur);
    }
    for (const t of trades) {
      const k = journalTradingDate(t.entryTime);
      const cur = map.get(k) ?? { hasDaily: false, hasEval: false, tradeCount: 0, netPnl: 0 };
      cur.tradeCount += 1;
      cur.netPnl += Number(t.netPnl) || 0;
      map.set(k, cur);
    }
    return map;
  }, [logs, trades]);

  const maxAbs = useMemo(() => {
    let m = 1;
    for (const d of days) {
      if (d.getMonth() !== anchor.getMonth()) continue;
      const s = stats.get(ymd(d));
      if (s) m = Math.max(m, Math.abs(s.netPnl));
    }
    return m;
  }, [days, anchor, stats]);

  const today = journalTradingDate();
  const monthLabel = anchor.toLocaleString("en-US", { month: "long" });
  const yearLabel = String(anchor.getFullYear());

  const goPrev = () => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1));
  const goNext = () => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1));
  const goToday = () => {
    const [y, m] = today.split("-").map(Number);
    setAnchor(new Date(y, m - 1, 1));
    onSelectDate(today);
  };

  const weeks = useMemo(() => {
    const res: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) res.push(days.slice(i, i + 7));
    while (
      res.length > 4 &&
      res[res.length - 1].every((d) => d.getMonth() !== anchor.getMonth())
    ) {
      res.pop();
    }
    return res;
  }, [days, anchor]);

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="px-3 pt-4 pb-3 flex items-center justify-between gap-2 shrink-0">
        <div>
          <h2 className="text-sm font-black tracking-tight text-foreground">{monthLabel}</h2>
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            {yearLabel} · NY
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous month"
            className="h-8 w-8 rounded-lg border border-border bg-card text-foreground hover:bg-muted"
          >
            <ChevronLeft className="w-4 h-4 mx-auto" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="h-8 px-2 rounded-lg border border-border bg-card text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next month"
            className="h-8 w-8 rounded-lg border border-border bg-card text-foreground hover:bg-muted"
          >
            <ChevronRight className="w-4 h-4 mx-auto" />
          </button>
        </div>
      </div>

      <div className="mx-2 mb-2 rounded-xl border border-border overflow-hidden bg-card">
        <div className="grid grid-cols-7 bg-muted/40">
          {WEEKDAYS.map((w, i) => (
            <div
              key={`${w}-${i}`}
              className="py-1.5 text-center text-[8px] font-black uppercase tracking-widest text-muted-foreground"
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flat().map((d) => {
            const k = ymd(d);
            const inMonth = d.getMonth() === anchor.getMonth();
            const isSelected = k === selectedDate;
            const isToday = k === today;
            const s = stats.get(k);
            const width = s ? Math.min(100, (Math.abs(s.netPnl) / maxAbs) * 100) : 0;
            return (
              <button
                key={k}
                type="button"
                disabled={!inMonth}
                onClick={() => onSelectDate(k)}
                className={`min-h-[52px] px-1.5 py-1.5 text-left border-r border-b border-border flex flex-col overflow-hidden last:border-r-0 ${
                  inMonth ? "bg-card hover:bg-muted/40" : "bg-muted/20 text-muted-foreground/40"
                } ${isSelected ? "ring-2 ring-inset ring-primary z-[1]" : ""} ${
                  isToday && !isSelected ? "ring-1 ring-inset ring-primary/30" : ""
                }`}
              >
                <span className="tabular-nums text-[11px] font-bold leading-none text-foreground">
                  {d.getDate()}
                </span>
                <span className="mt-auto block h-[3px] rounded-full bg-muted overflow-hidden">
                  {s && s.tradeCount > 0 && (
                    <span
                      className={`block h-full ${s.netPnl >= 0 ? "bg-primary" : "bg-destructive"}`}
                      style={{ width: `${width}%` }}
                    />
                  )}
                </span>
                <span className="mt-1 flex gap-1 h-[5px] items-center">
                  {s?.hasDaily && (
                    <span className="block w-[5px] h-[5px] rounded-full bg-primary" />
                  )}
                  {s?.hasEval && (
                    <span className="block w-[5px] h-[5px] rounded-full bg-warning" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-3 pb-4 flex flex-wrap gap-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <i className="w-1.5 h-1.5 rounded-full bg-primary inline-block" /> Check-in
        </span>
        <span className="flex items-center gap-1.5">
          <i className="w-1.5 h-1.5 rounded-full bg-warning inline-block" /> Eval
        </span>
      </div>
    </div>
  );
}
