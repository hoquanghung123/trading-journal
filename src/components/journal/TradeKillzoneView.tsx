import { useMemo, useRef, useState } from "react";
import { computeOutcome, type Trade } from "@/lib/trades";
import { getChartUrl } from "@/lib/journal";
import {
  formatNyDayKey,
  formatNyDayLabel,
  formatPnl,
  formatSigned,
  lanePositionPct,
  liveKillzoneLane,
  notesExcerpt,
  shortKillzoneSymbol,
  tradeKillzoneLane,
  type TradeKillzoneLane,
} from "@/lib/trade-log";

const LANES: { id: TradeKillzoneLane; label: string; ticks: string[] }[] = [
  { id: "ASIA", label: "Asia", ticks: ["18:00", "22", "02"] },
  { id: "LDN", label: "London", ticks: ["02", "05", "09"] },
  { id: "NY", label: "New York", ticks: ["09:30", "12", "16"] },
];

function staggerTops(rows: Trade[], lane: TradeKillzoneLane) {
  const items = rows
    .filter((t) => tradeKillzoneLane(t.entryTime) === lane)
    .map((t) => ({ t, left: lanePositionPct(t.entryTime, lane) }))
    .sort((a, b) => a.left - b.left);
  const tops: Record<string, number> = {};
  let row = 0;
  let prev = -999;
  for (const it of items) {
    if (it.left - prev < 16) row = row === 0 ? 1 : 0;
    else row = 0;
    tops[it.t.id] = row === 0 ? 16 : 50;
    prev = it.left;
  }
  return tops;
}

export function TradeKillzoneView({
  trades,
  onOpen,
}: {
  trades: Trade[];
  onOpen: (t: Trade) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pop, setPop] = useState<{ id: string; left: number; top: number } | null>(null);
  const live = liveKillzoneLane();

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

  const selected = trades.find((t) => t.id === pop?.id);

  const openPop = (t: Trade, el: HTMLElement) => {
    const wrap = wrapRef.current?.getBoundingClientRect();
    if (!wrap) {
      setPop({ id: t.id, left: 16, top: 16 });
      return;
    }
    const r = el.getBoundingClientRect();
    setPop({
      id: t.id,
      left: Math.min(Math.max(8, r.left - wrap.left + 12), Math.max(8, wrap.width - 236)),
      top: r.bottom - wrap.top + 8,
    });
  };

  return (
    <div ref={wrapRef} className="relative space-y-4" onClick={() => setPop(null)}>
      <div className="grid grid-cols-3 gap-2">
        {LANES.map((lane) => {
          const s = laneStats[lane.id];
          const followedPct = s.count ? Math.round((s.followed / s.count) * 100) : 0;
          const now = live === lane.id;
          return (
            <div
              key={lane.id}
              className={`rounded-xl border px-3 py-2 min-w-0 ${
                now ? "border-primary/30 bg-primary/5" : "border-border bg-card"
              }`}
            >
              <p
                className={`text-[9px] font-black uppercase tracking-widest ${
                  now ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {lane.label}
                {now ? " · now" : ""}
              </p>
              {s.count === 0 ? (
                <p className="tabular-nums text-[13px] font-bold">0</p>
              ) : (
                <>
                  <p
                    className={`tabular-nums text-[13px] font-bold ${
                      s.pnl >= 0 ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {formatSigned(s.pnl)}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-semibold">
                    {s.count} {s.count === 1 ? "fill" : "fills"} · {followedPct}%
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <div className="grid grid-cols-[56px_1fr_1fr_1.2fr] sm:grid-cols-[88px_1fr_1fr_1.4fr] min-w-[520px] sm:min-w-0 mb-2">
          <div />
          {LANES.map((lane) => (
            <div key={lane.id}>
              <p
                className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                  live === lane.id ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {live === lane.id && (
                  <i className="block w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_0_3px_rgba(76,118,59,0.25)]" />
                )}
                {lane.label}
              </p>
              <div className="flex justify-between tabular-nums text-[8px] font-bold text-muted-foreground/70 pr-2">
                {lane.ticks.map((tick) => (
                  <span key={tick}>{tick}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {days.map((day) => (
            <div
              key={day.key}
              className="min-w-[520px] sm:min-w-0 grid grid-cols-[56px_1fr_1fr_1.2fr] sm:grid-cols-[88px_1fr_1fr_1.4fr] rounded-2xl border border-border bg-card overflow-visible"
            >
              <div className="p-3 bg-muted/40 rounded-l-2xl">
                <p className="text-[11px] font-black">{day.label}</p>
                <p
                  className={`tabular-nums text-[11px] font-bold ${
                    day.pnl >= 0 ? "text-primary" : "text-destructive"
                  }`}
                >
                  {formatSigned(day.pnl)}
                </p>
                <p className="text-[9px] text-muted-foreground font-semibold">
                  {day.rows.length} {day.rows.length === 1 ? "fill" : "fills"}
                </p>
              </div>
              {LANES.map((lane) => {
                const fills = day.rows.filter((t) => tradeKillzoneLane(t.entryTime) === lane.id);
                const tops = staggerTops(day.rows, lane.id);
                return (
                  <div
                    key={lane.id}
                    className={`relative min-h-[96px] border-l border-dashed border-border px-2 py-2 ${
                      lane.id === "ASIA"
                        ? "bg-muted/20"
                        : lane.id === "LDN"
                          ? "bg-primary/[0.04]"
                          : "bg-primary/[0.07]"
                    }`}
                  >
                    {fills.length === 0 && (
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30">
                        no fills
                      </span>
                    )}
                    {fills.map((t) => {
                      const outcome = computeOutcome(t.actualRr, t.maxRr, t.netPnl, t.brokerData);
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
                          style={{
                            left: `${lanePositionPct(t.entryTime, lane.id)}%`,
                            top: `${tops[t.id] ?? 16}px`,
                          }}
                          className={`absolute -translate-x-1/2 max-w-[88px] overflow-hidden text-ellipsis px-2 py-1 rounded-full text-[10px] font-extrabold whitespace-nowrap shadow-md ${color} ${
                            t.complianceCheck ? "" : "outline outline-2 outline-dashed outline-white outline-offset-1"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openPop(t, e.currentTarget);
                          }}
                        >
                          {shortKillzoneSymbol(t.symbol)} {formatSigned(t.actualRr, 1)}R
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selected && pop && (
        <div
          className="absolute z-20 w-[220px] rounded-[14px] border border-border bg-card p-3 shadow-xl"
          style={{ left: pop.left, top: pop.top }}
          onClick={(e) => e.stopPropagation()}
        >
          {selected.beforeImg && (
            <img
              src={getChartUrl(selected.beforeImg)}
              alt="PRE"
              className="h-[72px] w-full object-cover rounded-[10px] mb-2"
            />
          )}
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {tradeKillzoneLane(selected.entryTime)} · {selected.complianceCheck ? "Followed" : "Broke"}
          </p>
          <p className="text-sm font-black">
            {selected.symbol} {selected.side}
          </p>
          <p className="tabular-nums text-xs font-bold mt-0.5">
            {formatSigned(selected.actualRr, 1)}R · {formatPnl(selected.netPnl)}
          </p>
          {notesExcerpt(selected.notes, 120) && (
            <p className="text-[11px] text-muted-foreground mt-2">{notesExcerpt(selected.notes, 120)}</p>
          )}
          <button
            type="button"
            className="mt-3 text-[11px] font-bold text-primary underline"
            onClick={() => onOpen(selected)}
          >
            Open trade
          </button>
        </div>
      )}
    </div>
  );
}
