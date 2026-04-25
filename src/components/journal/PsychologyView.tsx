import { useEffect, useMemo, useState } from "react";
import { Brain, CalendarDays, Save, Loader2, Check, ShieldAlert } from "lucide-react";
import { fetchTrades, type Trade } from "@/lib/trades";
import {
  fetchPsychologyLogs,
  upsertPsychologyLog,
  newDailyLog,
  newTradeLog,
  MOOD_OPTIONS,
  PRE_EMOTIONS,
  POST_EMOTIONS,
  type PsychologyLog,
} from "@/lib/psychology";
import { format } from "date-fns";
import { PsychologyCalendar } from "./PsychologyCalendar";
import { PsychologyDayTimeline } from "./PsychologyDayTimeline";
import { toast } from "sonner";

export function PsychologyView() {
  const [date, setDate] = useState<string>(() => format(new Date(), "yyyy-MM-dd"));
  const [trades, setTrades] = useState<Trade[]>([]);
  const [logs, setLogs] = useState<PsychologyLog[]>([]);
  const [selectedTradeId, setSelectedTradeId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timelineDate, setTimelineDate] = useState<string | null>(null);

  // Initial load — fetch trades + logs once
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [t, l] = await Promise.all([fetchTrades(), fetchPsychologyLogs()]);
        if (!alive) return;
        setTrades(t);
        setLogs(l);
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load psychology data");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Trades placed on the selected date — compared in **New York** timezone
  // because users enter entry_time in NY local time.
  const tradesForDate = useMemo(
    () => trades.filter((t) => format(new Date(t.entryTime), "yyyy-MM-dd") === date),
    [trades, date],
  );

  // Reset trade selection when date changes if current selection isn't on that date
  useEffect(() => {
    if (selectedTradeId && !tradesForDate.find((t) => t.id === selectedTradeId)) {
      setSelectedTradeId("");
    }
  }, [tradesForDate, selectedTradeId]);

  // Resolve daily and per-trade logs from the in-memory cache
  const dailyLog = useMemo<PsychologyLog>(() => {
    const found = logs.find((r) => r.date === date && r.tradeId === null);
    return found ?? newDailyLog(date);
  }, [logs, date]);

  const tradeLog = useMemo<PsychologyLog | null>(() => {
    if (!selectedTradeId) return null;
    const found = logs.find((r) => r.tradeId === selectedTradeId);
    return found ?? newTradeLog(date, selectedTradeId);
  }, [logs, selectedTradeId, date]);

  const persist = async (next: PsychologyLog) => {
    setSaving(true);
    try {
      await upsertPsychologyLog(next);
      setLogs((prev) => {
        const idx = prev.findIndex((r) => r.id === next.id);
        if (idx >= 0) {
          const copy = prev.slice();
          copy[idx] = next;
          return copy;
        }
        return [...prev, next];
      });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const updateDaily = (patch: Partial<PsychologyLog>) => persist({ ...dailyLog, ...patch });
  const updateTrade = (patch: Partial<PsychologyLog>) => {
    if (!tradeLog) return;
    persist({ ...tradeLog, ...patch });
  };

  // "Saved ✓" feedback per section
  const [savedFlash, setSavedFlash] = useState<Record<string, number>>({});
  const flashSaved = (key: string) => {
    setSavedFlash((p) => ({ ...p, [key]: Date.now() }));
    setTimeout(() => {
      setSavedFlash((p) => {
        const copy = { ...p };
        if (Date.now() - (copy[key] ?? 0) >= 1900) delete copy[key];
        return copy;
      });
    }, 2000);
  };

  // Force any focused textarea/input to commit (triggers onBlur), then persist.
  const saveSection = async (which: "daily" | "trade") => {
    const el = document.activeElement as HTMLElement | null;
    if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) el.blur();
    // Wait one tick so onBlur-driven setState lands before we persist
    await new Promise((r) => setTimeout(r, 0));
    if (which === "daily") {
      await persist({ ...dailyLog });
      flashSaved("daily");
    } else if (tradeLog) {
      await persist({ ...tradeLog });
      flashSaved("trade");
    }
  };

  const SaveButton = ({
    sectionKey,
    disabled,
  }: {
    sectionKey: "daily" | "trade";
    disabled?: boolean;
  }) => {
    const justSaved = !!savedFlash[sectionKey];
    return (
      <button
        onClick={() => saveSection(sectionKey)}
        disabled={disabled || saving}
        className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
          justSaved
            ? "bg-emerald-500 text-white shadow-emerald-500/20"
            : "forest-gradient text-white shadow-primary/20 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        }`}
      >
        {saving ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> SAVING...
          </>
        ) : justSaved ? (
          <>
            <Check className="w-3.5 h-3.5" /> SAVED
          </>
        ) : (
          <>
            <Save className="w-3.5 h-3.5" /> SAVE
          </>
        )}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-10 mobile-pb">
      <div className="max-w-[1500px] mx-auto space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-6 sm:pb-8 gap-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Brain className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">
                Psychology Journal
              </h1>
              <p className="text-[10px] sm:text-sm text-muted-foreground font-medium uppercase tracking-wider mt-0.5 sm:mt-1">
                {logs.length} Entries • {tradesForDate.length} Trades on {date}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 px-4 py-2.5 rounded-2xl border border-border bg-white shadow-sm w-full sm:w-auto justify-center">
            <CalendarDays className="w-5 h-5 text-primary" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent text-sm font-bold text-foreground outline-none cursor-pointer flex-1 sm:flex-none"
            />
            {saving && <Loader2 className="w-4 h-4 animate-spin text-primary ml-2" />}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          {/* Left column */}
          <div className="lg:col-span-8 space-y-6 sm:space-y-8">
            {/* Morning Check-in */}
            <Section title="Morning Check-in" action={<SaveButton sectionKey="daily" />}>
              <div className="mb-6 sm:mb-8">
                <Label>Start of Day Mood</Label>
                <div className="flex gap-2 sm:gap-3 flex-wrap justify-between sm:justify-start">
                  {MOOD_OPTIONS.map((m) => {
                    const active = dailyLog.morningMood === m;
                    return (
                      <button
                        key={m}
                        onClick={() => updateDaily({ morningMood: active ? undefined : m })}
                        className={`text-2xl sm:text-3xl p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border-2 transition-all duration-300 flex-1 sm:flex-none flex items-center justify-center ${
                          active
                            ? "bg-primary/10 border-primary shadow-lg scale-105"
                            : "bg-white border-muted hover:border-primary/30"
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Field
                label="Check-in Note"
                value={dailyLog.morningNotes ?? ""}
                placeholder="How do you feel?"
                onCommit={(v) => updateDaily({ morningNotes: v })}
              />
            </Section>

            {/* Trade Discipline & Emotions */}
            <Section
              title="Trade Discipline & Emotions"
              action={<SaveButton sectionKey="trade" disabled={!tradeLog || !selectedTradeId} />}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 sm:mb-8">
                <Label className="!mb-0 whitespace-nowrap">Selected Trade</Label>
                <select
                  value={selectedTradeId}
                  onChange={(e) => setSelectedTradeId(e.target.value)}
                  className="w-full bg-muted/30 border border-border rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  disabled={tradesForDate.length === 0}
                >
                  <option value="">
                    {tradesForDate.length === 0
                      ? "— No trades on this date —"
                      : "Select specific trade..."}
                  </option>
                  {tradesForDate.map((t, i) => (
                    <option key={t.id} value={t.id}>
                      #{String(i + 1).padStart(2, "0")} • {t.symbol} • {t.side.toUpperCase()} •{" "}
                      {new Date(t.entryTime).toLocaleTimeString("en-US", {
                        timeZone: "America/New_York",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}{" "}
                      NY
                    </option>
                  ))}
                </select>
              </div>

              {tradeLog && selectedTradeId ? (
                <div className="space-y-6 sm:space-y-8">
                  <TagPicker
                    label="Pre-Trade Emotion"
                    options={PRE_EMOTIONS}
                    value={tradeLog.preTradeEmotion}
                    onChange={(v) => updateTrade({ preTradeEmotion: v })}
                  />
                  <Field
                    label="Entry Rationale (Internal)"
                    value={tradeLog.entryRationale ?? ""}
                    placeholder="Why did you take this entry?"
                    onCommit={(v) => updateTrade({ entryRationale: v })}
                  />

                  <TagPicker
                    label="Post-Trade Emotion"
                    options={POST_EMOTIONS}
                    value={tradeLog.postTradeEmotion}
                    onChange={(v) => updateTrade({ postTradeEmotion: v })}
                  />
                  <Field
                    label="Exit Feelings & Assessment"
                    value={tradeLog.exitAssessment ?? ""}
                    placeholder="How did you feel exiting?"
                    onCommit={(v) => updateTrade({ exitAssessment: v })}
                  />
                </div>
              ) : (
                <div className="text-center py-10 sm:py-12 bg-muted/20 rounded-2xl border border-dashed border-border">
                  <Brain className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-[10px] sm:text-sm font-bold text-muted-foreground uppercase tracking-widest px-4">
                    {tradesForDate.length === 0
                      ? "No trades on this date"
                      : "Select a trade to log psychology"}
                  </p>
                </div>
              )}
            </Section>
          </div>

          {/* Right column */}
          <div className="lg:col-span-4 space-y-6 sm:space-y-8">
            <Section title="Daily Observations">
              <ul className="text-sm space-y-4 text-muted-foreground font-medium">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span>Always respect your stop loss rules.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span>Avoid over-trading during consolidation.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span>Trust the process, not just the outcome.</span>
                </li>
              </ul>
            </Section>

            <Section title="Knowledge Base">
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-sm font-bold text-primary shadow-sm">
                  Trading Psychology Principle
                </div>
                <p className="italic text-muted-foreground text-sm leading-relaxed font-medium px-2">
                  "You don't trade the markets, you trade your beliefs about the markets."
                </p>
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs font-bold leading-relaxed shadow-sm">
                  <ShieldAlert className="w-4 h-4 inline-block mr-2 -mt-0.5" />
                  REMINDER: If your heart rate is high, your position size is likely too big.
                </div>
              </div>
            </Section>

            <Section title="Session Statistics">
              <div className="space-y-3">
                <Line k="Daily Log" v={dailyLog.id !== "" ? "Tracked" : "None"} />
                <Line k="Trades Logged" v={`${tradesForDate.length}`} />
                <Line k="Psych Entries" v={`${logs.filter((l) => l.date === date).length}`} />
                <Line k="Last Sync" v={new Date(dailyLog.updatedAt).toLocaleTimeString()} />
              </div>
            </Section>
          </div>
        </div>

        {/* Psychology History Calendar */}
        <div className="mt-12 pt-12 border-t border-border">
          <PsychologyCalendar
            selectedDate={date}
            onSelectDate={(d) => {
              setDate(d);
              setTimelineDate(d);
            }}
            logs={logs}
            trades={trades}
          />
        </div>

        {/* Day Timeline Modal */}
        {timelineDate && (
          <PsychologyDayTimeline
            date={timelineDate}
            logs={logs}
            trades={trades}
            onClose={() => setTimelineDate(null)}
          />
        )}
      </div>
    </div>
  );
}

/* ---------------- Sub components ---------------- */

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section
      className="bg-white rounded-2xl border border-border p-4 sm:p-8 shadow-sm hover:shadow-md transition-shadow duration-300"
    >
      <div className="flex items-center justify-between mb-6 sm:mb-8 gap-4">
        <h2 className="text-[10px] sm:text-sm font-black uppercase tracking-widest text-primary">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 ${className}`}
    >
      {children}
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-muted/50 last:border-0">
      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{k}</span>
      <span className="text-xs font-black text-foreground">{v}</span>
    </div>
  );
}

/** Local-state textarea that only commits onBlur (avoids re-renders / loops). */
function Field({
  label,
  value,
  placeholder,
  rows = 4,
  onCommit,
}: {
  label?: string;
  value: string;
  placeholder?: string;
  rows?: number;
  onCommit: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  // Sync when external value changes (e.g. switching date/trade)
  useEffect(() => {
    setV(value);
  }, [value]);
  return (
    <div>
      {label && <Label>{label}</Label>}
      <textarea
        value={v}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if (v !== value) onCommit(v);
        }}
        className="w-full bg-muted/20 border border-border rounded-2xl px-5 py-4 text-sm font-medium text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/50 transition-all resize-y"
      />
    </div>
  );
}

function TagPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              onClick={() => onChange(active ? undefined : opt)}
              className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wide border-2 transition-all duration-200 ${
                active
                  ? "bg-primary text-white border-primary shadow-lg scale-105"
                  : "bg-white border-muted text-muted-foreground hover:border-primary/30"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
