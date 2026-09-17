import { useState, type KeyboardEvent } from "react";
import { BarChart2 } from "lucide-react";
import { computeOutcome, type Trade } from "@/lib/trades";
import { getChartUrl } from "@/lib/journal";
import {
  formatNyStamp,
  formatPnl,
  formatSigned,
  killzoneStamp,
  MTF_SLOTS,
} from "@/lib/trade-log";

export function TradeTicketCard({
  trade,
  playbookName,
  onClick,
}: {
  trade: Trade;
  playbookName?: string;
  onClick: () => void;
}) {
  const [cut, setCut] = useState(50);
  const outcome = computeOutcome(trade.actualRr, trade.maxRr, trade.netPnl);
  const pre = trade.beforeImg ? getChartUrl(trade.beforeImg) : "";
  const post = trade.afterImg ? getChartUrl(trade.afterImg) : "";
  const stamp = killzoneStamp(trade.entryTime);
  const win = outcome.label === "Win";
  const loss = outcome.label === "Loss";

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${trade.symbol} ${trade.side} ${formatSigned(trade.actualRr, 1)}R`}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className="relative bg-card rounded-[18px] border border-border overflow-hidden cursor-pointer hover:border-primary/30 transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <span className="absolute z-[2] w-[18px] h-[18px] rounded-full bg-background border border-border top-[148px] -left-[9px]" />
      <span className="absolute z-[2] w-[18px] h-[18px] rounded-full bg-background border border-border top-[148px] -right-[9px]" />

      <div className="relative h-[148px] bg-slate-900 overflow-hidden">
        {pre ? (
          <img src={pre} alt="PRE" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-white/20">
            <BarChart2 className="w-10 h-10" />
          </div>
        )}
        {post && (
          <img
            src={post}
            alt="POST"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ clipPath: `inset(0 0 0 ${cut}%)` }}
          />
        )}
        {post && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white z-[3] shadow"
            style={{ left: `${cut}%`, transform: "translateX(-1px)" }}
          />
        )}
        <span className="absolute top-2.5 left-2.5 z-10 text-[8px] font-black tracking-widest text-white/80">
          PRE → POST
        </span>
        <span className="absolute top-2.5 right-2.5 z-10 rotate-[8deg] border-2 border-white text-[9px] font-black tracking-[0.14em] rounded px-1.5 py-0.5 bg-black/45 text-white">
          {stamp}
        </span>
        {post && (
          <input
            type="range"
            min={8}
            max={92}
            value={cut}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => setCut(Number(e.target.value))}
            className="trade-pre-post-slider absolute left-3 right-3 bottom-2.5 z-10 cursor-ew-resize"
            aria-label="PRE POST slider"
          />
        )}
      </div>

      <div className="mx-4 h-px bg-[repeating-linear-gradient(90deg,var(--border)_0_6px,transparent_6px_12px)]" />

      <div className="p-4 flex gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-base font-black">
            {trade.symbol}{" "}
            <span className={`text-xs ${trade.side === "buy" ? "text-primary" : "text-destructive"}`}>
              {trade.side.toUpperCase()}
            </span>
          </p>
          <p className="font-mono tabular-nums text-[11px] text-muted-foreground mt-1">
            {formatNyStamp(trade.entryTime)} NY
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-3">
            {MTF_SLOTS.map((s) => {
              const on = Boolean(trade[s.key]);
              return (
                <span key={s.label} className="flex items-center gap-1">
                  <span className={`text-[8px] font-black ${on ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                    {s.label}
                  </span>
                  <i
                    className={`block w-1.5 h-1.5 rounded-full ${
                      on ? "bg-primary shadow-[0_0_0_2px_rgba(76,118,59,0.2)]" : "bg-border"
                    }`}
                  />
                </span>
              );
            })}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p
            className={`font-mono tabular-nums text-[28px] leading-none font-bold tracking-tight ${
              win ? "text-primary" : loss ? "text-destructive" : "text-warning"
            }`}
          >
            {formatSigned(trade.actualRr, 1)}R
          </p>
          <p
            className={`font-mono tabular-nums text-xs font-bold mt-1 ${
              trade.netPnl > 0 ? "text-primary" : trade.netPnl < 0 ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {formatPnl(trade.netPnl)}
          </p>
          <p
            className={`mt-2 text-[9px] font-black uppercase tracking-widest ${
              trade.complianceCheck ? "text-primary" : "text-destructive"
            }`}
          >
            {trade.complianceCheck ? "Followed" : trade.missedConfluences?.[0] ?? "Broke"}
          </p>
          {playbookName && (
            <p className="mt-1 text-[9px] font-bold text-muted-foreground truncate max-w-[120px] ml-auto">
              {playbookName}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
