import {
  X,
  Sunrise,
  TrendingUp,
  TrendingDown,
  Brain,
  MessageSquare,
  Target,
  Activity,
} from "lucide-react";
import { useEffect } from "react";
import type { PsychologyLog } from "@/lib/psychology";
import type { Trade } from "@/lib/trades";
import { format } from "date-fns";

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
    .filter((t) => format(new Date(t.entryTime), "yyyy-MM-dd") === date)
    .sort((a, b) => +new Date(a.entryTime) - +new Date(b.entryTime));
  const tradeLogsById = new Map(logs.filter((l) => l.tradeId).map((l) => [l.tradeId as string, l]));

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-white/20 animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-10 py-8 border-b border-border/50">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              {daily?.morningMood ? (
                <span className="text-3xl leading-none">{daily.morningMood}</span>
              ) : (
                <Brain className="w-8 h-8 text-primary" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-black tracking-[0.2em] text-primary uppercase">
                Day Timeline
              </h2>
              <p className="text-xl font-black text-foreground tracking-tight mt-0.5">{prettyDate}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-95"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-px bg-border/50 border-b border-border/50 bg-muted/20">
          <Stat label="Total Trades" value={String(dayTrades.length)} />
          <Stat
            label="Win Rate"
            value={dayTrades.length ? `${Math.round((wins / dayTrades.length) * 100)}%` : "—"}
          />
          <Stat
            label="Net P&L"
            value={dayTrades.length ? `$${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
            tone={totalPnl > 0 ? "pos" : totalPnl < 0 ? "neg" : "neutral"}
          />
        </div>

        {/* Timeline body */}
        <div className="flex-1 overflow-y-auto px-10 py-8 custom-scrollbar">
          {!daily && dayTrades.length === 0 ? (
            <div className="text-center py-20">
              <Activity className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                No activity recorded on this date
              </p>
            </div>
          ) : (
            <ol className="relative border-l-2 border-border/50 ml-4 space-y-10">
              {/* Morning check-in */}
              {daily && (daily.morningMood || daily.morningNotes) && (
                <TimelineItem
                  icon={<Sunrise className="w-4 h-4" />}
                  color="var(--primary)"
                  time="Morning"
                  title="Daily Check-in"
                >
                  {daily.morningNotes && (
                    <div className="mt-3 p-5 rounded-2xl bg-primary/[0.03] border border-primary/10">
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-medium">
                        {daily.morningNotes}
                      </p>
                    </div>
                  )}
                </TimelineItem>
              )}

              {/* Trades */}
              {dayTrades.map((t, i) => {
                const tl = tradeLogsById.get(t.id);
                const win = (t.netPnl ?? 0) > 0;
                const loss = (t.netPnl ?? 0) < 0;
                return (
                  <TimelineItem
                    key={t.id}
                    icon={
                      win ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : loss ? (
                        <TrendingDown className="w-4 h-4" />
                      ) : (
                        <Activity className="w-4 h-4" />
                      )
                    }
                    color={win ? "#10B981" : loss ? "#F43F5E" : "#94A3B8"}
                    time={`${fmtTime(t.entryTime)} NY`}
                    title={`Trade #${String(i + 1).padStart(2, "0")} • ${t.symbol}`}
                    badge={
                      <span
                        className={`text-[10px] font-black px-2 py-1 rounded-lg border shadow-sm ${
                          win
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                            : loss
                              ? "bg-rose-50 text-rose-600 border-rose-100"
                              : "bg-muted/30 text-muted-foreground border-border/50"
                        }`}
                      >
                        {t.side.toUpperCase()} • {t.netPnl != null
                          ? `${t.netPnl >= 0 ? "+" : ""}$${t.netPnl.toFixed(2)}`
                          : "—"}
                      </span>
                    }
                  >
                    {tl ? (
                      <div className="grid grid-cols-1 gap-3 mt-4">
                        {tl.preTradeEmotion && (
                          <Row icon={<Brain className="w-3.5 h-3.5" />} label="Pre-Trade" color="text-primary">
                            {tl.preTradeEmotion}
                          </Row>
                        )}
                        {tl.entryRationale && (
                          <Row icon={<Target className="w-3.5 h-3.5" />} label="Rationale">
                            {tl.entryRationale}
                          </Row>
                        )}
                        {tl.postTradeEmotion && (
                          <Row icon={<Activity className="w-3.5 h-3.5" />} label="Post-Trade" color="text-amber-600">
                            {tl.postTradeEmotion}
                          </Row>
                        )}
                        {tl.exitAssessment && (
                          <Row icon={<MessageSquare className="w-3.5 h-3.5" />} label="Reflection">
                            {tl.exitAssessment}
                          </Row>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] font-medium text-muted-foreground/50 italic mt-3 bg-muted/10 px-4 py-2 rounded-lg border border-dashed border-border/50 inline-block">
                        No psychology evaluation recorded.
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

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "neutral";
}) {
  const color =
    tone === "pos" ? "text-emerald-600" : tone === "neg" ? "text-rose-600" : "text-foreground";
  return (
    <div className="px-10 py-6 bg-white">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{label}</div>
      <div className={`text-xl font-black tracking-tight mt-0.5 ${color}`}>{value}</div>
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
    <li className="ml-8 relative">
      <span
        className="absolute -left-[45px] top-0.5 w-8 h-8 rounded-xl flex items-center justify-center border-2 bg-white shadow-sm transition-transform hover:scale-110"
        style={{ borderColor: color, color }}
      >
        {icon}
      </span>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
            {time}
          </span>
          <span className="text-sm font-black text-foreground tracking-tight">{title}</span>
        </div>
        {badge}
      </div>
      <div className="animate-in slide-in-from-left-2 duration-500">{children}</div>
    </li>
  );
}

function Row({
  icon,
  label,
  color = "text-muted-foreground",
  children,
}: {
  icon: React.ReactNode;
  label: string;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-2xl bg-muted/10 border border-border/30 hover:bg-white hover:border-primary/20 hover:shadow-sm transition-all duration-300">
      <div className={`flex items-center gap-2 ${color} min-w-[100px] mt-0.5 shrink-0`}>
        <div className="w-6 h-6 rounded-lg bg-current/10 flex items-center justify-center">
          {icon}
        </div>
        <span className="font-black uppercase tracking-widest text-[9px]">{label}</span>
      </div>
      <div className="flex-1 text-xs font-medium text-foreground/80 leading-relaxed whitespace-pre-wrap">{children}</div>
    </div>
  );
}
