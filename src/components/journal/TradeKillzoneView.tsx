import { useMemo, useState } from "react";
import { computeOutcome, type Trade } from "@/lib/trades";
import { getChartUrl } from "@/lib/journal";
import {
  formatNyDayKey,
  formatNyDayLabel,
  formatSigned,
  lanePositionPct,
  notesExcerpt,
  tradeKillzoneLane,
  type TradeKillzoneLane,
} from "@/lib/trade-log";

const LANES: { id: TradeKillzoneLane; label: string; ticks: string[] }[] = [
  { id: "ASIA", label: "Asia", ticks: ["18", "22", "02"] },
  { id: "LDN", label: "London", ticks: ["02", "05", "09"] },
  { id: "NY", label: "New York", ticks: ["08", "12", "16"] },
];

export function TradeKillzoneView({
  trades,
  onOpen,
}: {
  trades: Trade[];
  onOpen: (t: Trade) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const days = useMemo(() => {
    const map = new Map<string, { label: string; pnl: number; rows: Trade[] }>();
    for (const t of trades) {
      const key = formatNyDayKey(t.entryTime);
      const g = map.get(key) ?? { label: formatNyDayLabel(t.entryTime), pnl: 0, rows: [] };
      g.pnl += t.netPnl;
      g.rows.push(t);
      map.set(key, g);
    }
    return Array.from(map.entries()).map(([key, g]) => ({ key, ...g }));
  }, [trades]);

  const laneStats = useMemo(() => {
    const empty = { count: 0, pnl: 0, followed: 0 };
    const acc: Record<TradeKillzoneLane, typeof empty> = {
      ASIA: { ...empty },
      LDN: { ...empty },
      NY: { ...empty },
    };
    for (const t of trades) {
      const lane = tradeKillzoneLane(t.entryTime);
      acc[lane].count += 1;
      acc[lane].pnl += t.netPnl;
      if (t.complianceCheck) acc[lane].followed += 1;
    }
    return acc;
  }, [trades]);

  const selected = trades.find((t) => t.id === openId);

  return (
    <div className="space-y-4" onClick={() => setOpenId(null)}>
      <div className="grid grid-cols-3 gap-2">
        {LANES.map((lane) => {
          const s = laneStats[lane.id];
          const followedPct = s.count ? Math.round((s.followed / s.count) * 100) : 0;
          return (
            <div
              key={lane.id}
              className={`rounded-xl border px-3 py-2 ${
                lane.id === "NY" ? "border-primary/30 bg-primary/5" : "border-border bg-card"
              }`}
            >
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                {lane.label}
              </p>
              {s.count === 0 ? (
                <p className="font-mono text-sm font-bold">0 trades</p>
              ) : (
                <p
                  className={`font-mono text-sm font-bold ${s.pnl >= 0 ? "text-primary" : "text-destructive"}`}
                >
                  {formatSigned(s.pnl)} · {followedPct}% followed
                </p>
              )}
            </div>
          );
        })}
      </div>

      {selected && (
        <div
          className="rounded-2xl border border-border bg-card p-3 shadow-lg flex gap-3 items-start"
          onClick={(e) => e.stopPropagation()}
        >
          {selected.beforeImg && (
            <img
              src={getChartUrl(selected.beforeImg)}
              alt="PRE"
              className="h-[72px] w-[120px] object-cover rounded-xl shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {tradeKillzoneLane(selected.entryTime)} · {selected.complianceCheck ? "Followed" : "Broke"}
            </p>
            <p className="text-sm font-black">
              {selected.symbol} {selected.side}
            </p>
            <p className="font-mono text-xs font-bold mt-0.5">
              {formatSigned(selected.actualRr, 1)}R · {formatSigned(selected.netPnl)}
            </p>
            {notesExcerpt(selected.notes, 120) && (
              <p className="text-[11px] text-muted-foreground mt-1 truncate">{notesExcerpt(selected.notes, 120)}</p>
            )}
          </div>
          <button
            type="button"
            className="text-[11px] font-bold text-primary underline shrink-0"
            onClick={() => onOpen(selected)}
          >
            Open trade
          </button>
        </div>
      )}

      <div className="hidden sm:grid grid-cols-[88px_1fr_1fr_1.4fr] px-0 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <div />
        {LANES.map((lane) => (
          <div key={lane.id}>
            <p className={lane.id === "ASIA" ? "" : "text-primary"}>{lane.label}</p>
            <div className="flex justify-between font-mono text-[8px] font-bold text-muted-foreground/70 pr-2">
              {lane.ticks.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 overflow-x-auto">
        {days.map((day) => (
          <div
            key={day.key}
            className="min-w-[640px] sm:min-w-0 grid grid-cols-[88px_1fr_1fr_1.4fr] rounded-2xl border border-border bg-card overflow-hidden"
          >
            <div className="p-3 bg-muted/40">
              <p className="text-[11px] font-black">{day.label}</p>
              <p
                className={`font-mono tabular-nums text-[11px] font-bold ${
                  day.pnl >= 0 ? "text-primary" : "text-destructive"
                }`}
              >
                {formatSigned(day.pnl)}
              </p>
              <p className="text-[9px] text-muted-foreground font-semibold">
                {day.rows.length} {day.rows.length === 1 ? "fill" : "fills"}
              </p>
            </div>
            {LANES.map((lane) => (
              <div
                key={lane.id}
                className={`relative min-h-[92px] border-l border-dashed border-border px-2 py-2 ${
                  lane.id === "ASIA"
                    ? "bg-muted/20"
                    : lane.id === "LDN"
                      ? "bg-primary/[0.04]"
                      : "bg-primary/[0.07]"
                }`}
              >
                {day.rows
                  .filter((t) => tradeKillzoneLane(t.entryTime) === lane.id)
                  .map((t) => {
                    const outcome = computeOutcome(t.actualRr, t.maxRr, t.netPnl);
                    const color =
                      outcome.label === "Win"
                        ? "bg-primary text-white"
                        : outcome.label === "Loss"
                          ? "bg-destructive text-white"
                          : "bg-warning text-white";
                    return (
                      <button
                        key={t.id}
                        type="button"
                        style={{ left: `${lanePositionPct(t.entryTime, lane.id)}%` }}
                        className={`absolute top-6 -translate-x-1/2 px-2 py-1 rounded-full text-[10px] font-extrabold whitespace-nowrap shadow-md ${color} ${
                          t.complianceCheck ? "" : "outline outline-2 outline-dashed outline-white outline-offset-1"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenId(t.id);
                        }}
                      >
                        {t.symbol.replace("USD", "")} {formatSigned(t.actualRr, 1)}R
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
