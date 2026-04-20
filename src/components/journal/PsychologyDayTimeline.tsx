import { X, Sunrise, TrendingUp, TrendingDown, Brain, MessageSquare, Target, Activity } from "lucide-react";
import { useEffect } from "react";
import type { PsychologyLog } from "@/lib/psychology";
import type { Trade } from "@/lib/trades";
import { toNyDateStr } from "@/lib/psychology";

interface Props {
  date: string;
  logs: PsychologyLog[];
  trades: Trade[];
  onClose: () => void;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

export function PsychologyDayTimeline({ date, logs, trades, onClose }: Props) {
  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const daily = logs.find((l) => l.date === date && l.tradeId === null);
  const dayTrades = trades
    .filter((t) => toNyDateStr(t.entryTime) === date)
    .sort((a, b) => +new Date(a.entryTime) - +new Date(b.entryTime));
  const tradeLogsById = new Map(
    logs.filter((l) => l.tradeId).map((l) => [l.tradeId as string, l]),
  );

  const totalPnl = dayTrades.reduce((s, t) => s + (t.netPnl ?? 0), 0);
  const wins = dayTrades.filter((t) => (t.netPnl ?? 0) > 0).length;

  const prettyDate = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] rounded-lg border border-terminal-border overflow-hidden flex flex-col"
        style={{ background: "#0B0E11" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-terminal-border">
          <div className="flex items-center gap-3">
            {daily?.morningMood && <span className="text-3xl leading-none">{daily.morningMood}</span>}
            <div>
              <h2 className="text-[11px] font-bold tracking-[0.3em] text-[#48C0D8]">
                DAY TIMELINE
              </h2>
              <p className="text-xs font-mono text-foreground mt-0.5">{prettyDate}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded border border-terminal-border hover:border-[#48C0D8]/60 hover:text-[#48C0D8] text-muted-foreground transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-px bg-terminal-border border-b border-terminal-border">
          <Stat label="TRADES" value={String(dayTrades.length)} />
          <Stat
            label="WIN RATE"
            value={dayTrades.length ? `${Math.round((wins / dayTrades.length) * 100)}%` : "—"}
          />
          <Stat
            label="NET P&L"
            value={dayTrades.length ? `$${totalPnl.toFixed(2)}` : "—"}
            tone={totalPnl > 0 ? "pos" : totalPnl < 0 ? "neg" : "neutral"}
          />
        </div>

        {/* Timeline body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {!daily && dayTrades.length === 0 ? (
            <div className="text-center py-12 text-xs text-muted-foreground tracking-widest">
              // NO ACTIVITY ON THIS DATE
            </div>
          ) : (
            <ol className="relative border-l border-terminal-border ml-3 space-y-6">
              {/* Morning check-in */}
              {daily && (daily.morningMood || daily.morningNotes) && (
                <TimelineItem
                  icon={<Sunrise className="w-3.5 h-3.5" />}
                  color="#48C0D8"
                  time="MORNING"
                  title="START OF DAY MOOD"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {daily.morningMood && <span className="text-2xl">{daily.morningMood}</span>}
                  </div>
                  {daily.morningNotes && (
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {daily.morningNotes}
                    </p>
                  )}
                </TimelineItem>
              )}

              {/* Trades */}
              {dayTrades.map((t, i) => {
                const tl = tradeLogsById.get(t.id);
                const win = (t.netPnl ?? 0) > 0;
                return (
                  <TimelineItem
                    key={t.id}
                    icon={win ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    color={win ? "#10B981" : (t.netPnl ?? 0) < 0 ? "#EF4444" : "#94A3B8"}
                    time={`${fmtTime(t.entryTime)} NY`}
                    title={`#${String(i + 1).padStart(2, "0")} • ${t.symbol} • ${t.side.toUpperCase()}`}
                    badge={
                      <span
                        className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                          win
                            ? "bg-emerald-500/10 text-emerald-400"
                            : (t.netPnl ?? 0) < 0
                              ? "bg-red-500/10 text-red-400"
                              : "bg-white/5 text-muted-foreground"
                        }`}
                      >
                        {t.netPnl != null ? `${t.netPnl >= 0 ? "+" : ""}$${t.netPnl.toFixed(2)}` : "—"}
                      </span>
                    }
                  >
                    {tl ? (
                      <div className="space-y-2 mt-1">
                        {tl.preTradeEmotion && (
                          <Row icon={<Brain className="w-3 h-3" />} label="PRE">
                            <span className="text-[#48C0D8]">{tl.preTradeEmotion}</span>
                          </Row>
                        )}
                        {tl.entryRationale && (
                          <Row icon={<Target className="w-3 h-3" />} label="ENTRY">
                            {tl.entryRationale}
                          </Row>
                        )}
                        {tl.postTradeEmotion && (
                          <Row icon={<Activity className="w-3 h-3" />} label="POST">
                            <span className="text-orange-400">{tl.postTradeEmotion}</span>
                          </Row>
                        )}
                        {tl.exitAssessment && (
                          <Row icon={<MessageSquare className="w-3 h-3" />} label="EXIT">
                            {tl.exitAssessment}
                          </Row>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground/60 italic mt-1">
                        No psychology evaluation recorded for this trade.
                      </p>
                    )}
                  </TimelineItem>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" | "neutral" }) {
  const color =
    tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-red-400" : "text-foreground";
  return (
    <div className="px-4 py-3 bg-[#0B0E11]">
      <div className="text-[9px] font-bold tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className={`text-sm font-mono font-bold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

function TimelineItem({
  icon,
  color,
  time,
  title,
  badge,
  children,
}: {
  icon: React.ReactNode;
  color: string;
  time: string;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="ml-5 relative">
      <span
        className="absolute -left-[31px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center border"
        style={{ background: "#0B0E11", borderColor: color, color }}
      >
        {icon}
      </span>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold tracking-[0.25em] text-muted-foreground font-mono">
            {time}
          </span>
          <span className="text-xs font-bold text-foreground">{title}</span>
        </div>
        {badge}
      </div>
      <div>{children}</div>
    </li>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[11px] leading-relaxed">
      <div className="flex items-center gap-1 text-muted-foreground min-w-[52px] mt-0.5">
        {icon}
        <span className="font-bold tracking-widest text-[9px]">{label}</span>
      </div>
      <div className="flex-1 text-foreground whitespace-pre-wrap">{children}</div>
    </div>
  );
}
