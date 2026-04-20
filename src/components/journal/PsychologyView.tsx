import { useEffect, useMemo, useState } from "react";
import { Brain, CalendarDays, Save, Loader2, Check } from "lucide-react";
import { fetchTrades, type Trade } from "@/lib/trades";
import {
  fetchPsychologyLogs,
  upsertPsychologyLog,
  newDailyLog,
  newTradeLog,
  MOOD_OPTIONS,
  PRE_EMOTIONS,
  POST_EMOTIONS,
  toNyDateStr,
  todayNyDateStr,
  type PsychologyLog,
} from "@/lib/psychology";
import { PsychologyCalendar } from "./PsychologyCalendar";
import { PsychologyDayTimeline } from "./PsychologyDayTimeline";
import { toast } from "sonner";

export function PsychologyView() {
  const [date, setDate] = useState<string>(() => todayNyDateStr());
  const [trades, setTrades] = useState<Trade[]>([]);
  const [logs, setLogs] = useState<PsychologyLog[]>([]);
  const [selectedTradeId, setSelectedTradeId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    return () => { alive = false; };
  }, []);

  // Trades placed on the selected date — compared in **New York** timezone
  // because users enter entry_time in NY local time.
  const tradesForDate = useMemo(
    () => trades.filter((t) => toNyDateStr(t.entryTime) === date),
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

  const SaveButton = ({ sectionKey, disabled }: { sectionKey: "daily" | "trade"; disabled?: boolean }) => {
    const justSaved = !!savedFlash[sectionKey];
    return (
      <button
        onClick={() => saveSection(sectionKey)}
        disabled={disabled || saving}
        className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold tracking-[0.2em] border transition ${
          justSaved
            ? "border-emerald-500/60 text-emerald-400 bg-emerald-500/10"
            : "border-[#48C0D8]/60 text-[#48C0D8] hover:bg-[#48C0D8]/10 disabled:opacity-40 disabled:cursor-not-allowed"
        }`}
      >
        {saving ? (
          <><Loader2 className="w-3 h-3 animate-spin" /> SAVING…</>
        ) : justSaved ? (
          <><Check className="w-3 h-3" /> SAVED</>
        ) : (
          <><Save className="w-3 h-3" /> SAVE</>
        )}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#05080A" }}>
        <Loader2 className="w-6 h-6 animate-spin text-neon-cyan" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "#05080A" }}>
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-neon-cyan text-glow-cyan" />
            <div>
              <h1 className="text-lg font-bold tracking-[0.3em] text-[#48C0D8]">PSYCHOLOGY_JOURNAL</h1>
              <p className="text-[10px] text-muted-foreground tracking-widest mt-0.5">
                // {logs.length} ENTRIES &nbsp;•&nbsp; {tradesForDate.length} TRADES ON {date}
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 px-3 py-2 rounded border border-terminal-border bg-[#0D1117]">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent text-xs font-mono text-foreground outline-none"
            />
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-neon-cyan" />}
          </label>
        </div>

        <div className="grid grid-cols-12 gap-4">
          {/* Left column */}
          <div className="col-span-12 lg:col-span-8 space-y-4">
            {/* Morning Check-in */}
            <Section title="MORNING CHECK-IN" action={<SaveButton sectionKey="daily" />}>
              <div className="mb-4">
                <Label>START OF DAY MOOD</Label>
                <div className="flex gap-2 flex-wrap">
                  {MOOD_OPTIONS.map((m) => {
                    const active = dailyLog.morningMood === m;
                    return (
                      <button
                        key={m}
                        onClick={() => updateDaily({ morningMood: active ? undefined : m })}
                        className={`text-2xl p-1.5 rounded-md border transition ${
                          active
                            ? "bg-neon-cyan/15 border-neon-cyan/60 shadow-[0_0_12px_oklch(0.85_0.18_200/0.35)]"
                            : "border-terminal-border opacity-50 hover:opacity-100"
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Field
                label="CHECK-IN NOTE"
                value={dailyLog.morningNotes ?? ""}
                placeholder="How do you feel? (Tired, motivated, stressed...)"
                onCommit={(v) => updateDaily({ morningNotes: v })}
              />
            </Section>

            {/* Trade Discipline & Emotions */}
            <Section title="TRADE DISCIPLINE & EMOTIONS" action={<SaveButton sectionKey="trade" disabled={!tradeLog || !selectedTradeId} />}>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <Label className="!mb-0">TRADE</Label>
                <select
                  value={selectedTradeId}
                  onChange={(e) => setSelectedTradeId(e.target.value)}
                  className="bg-[#05080A] border border-terminal-border rounded px-3 py-1.5 text-xs font-mono outline-none focus:border-[#48C0D8]/60 min-w-[260px]"
                  disabled={tradesForDate.length === 0}
                >
                  <option value="">
                    {tradesForDate.length === 0 ? "— No trades on this date —" : "Select specific trade…"}
                  </option>
                  {tradesForDate.map((t, i) => (
                    <option key={t.id} value={t.id}>
                      #{String(i + 1).padStart(2, "0")} • {t.symbol} • {t.side.toUpperCase()} • {new Date(t.entryTime).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false })} NY
                    </option>
                  ))}
                </select>
              </div>

              {tradeLog && selectedTradeId ? (
                <div className="space-y-5">
                  <TagPicker
                    label="PRE-TRADE EMOTION"
                    options={PRE_EMOTIONS}
                    value={tradeLog.preTradeEmotion}
                    onChange={(v) => updateTrade({ preTradeEmotion: v })}
                  />
                  <Field
                    label="ENTRY RATIONALE (INTERNAL)"
                    value={tradeLog.entryRationale ?? ""}
                    placeholder="Why did you take this entry?"
                    onCommit={(v) => updateTrade({ entryRationale: v })}
                  />

                  <TagPicker
                    label="POST-TRADE EMOTION"
                    options={POST_EMOTIONS}
                    value={tradeLog.postTradeEmotion}
                    onChange={(v) => updateTrade({ postTradeEmotion: v })}
                  />
                  <Field
                    label="EXIT FEELINGS & ASSESSMENT"
                    value={tradeLog.exitAssessment ?? ""}
                    placeholder="How did you feel exiting? Any regrets?"
                    onCommit={(v) => updateTrade({ exitAssessment: v })}
                  />

                </div>
              ) : (
                <div className="text-center py-8 text-xs text-muted-foreground tracking-widest">
                  // {tradesForDate.length === 0
                    ? "NO TRADES ON THIS DATE — LOG A TRADE FIRST"
                    : "SELECT A TRADE TO RECORD PSYCHOLOGY"}
                </div>
              )}
            </Section>

          </div>

          {/* Right column */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <Section title="DAILY OBSERVATIONS">
              <ul className="text-xs space-y-2 text-muted-foreground tracking-wide">
                <li>• Quick note: avoid over-trading</li>
                <li>• Quick note: respect your stop loss</li>
                <li>• Quick note: avoid FOMO entries</li>
              </ul>
            </Section>

            <Section title="KNOWLEDGE & REFRESHERS">
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded border-l-2 border-[#48C0D8] bg-white/[0.02] text-foreground">
                  Trading Psychology Principles
                </div>
                <p className="italic text-muted-foreground leading-relaxed">
                  "You don't trade the markets, you trade your beliefs about the markets."
                </p>
                <div className="p-3 rounded border border-neon-amber/30 bg-neon-amber/5 text-neon-amber text-[11px] tracking-wide leading-relaxed">
                  REMINDER: If your heart rate is high, your position size is too big.
                </div>
              </div>
            </Section>

            <Section title="TODAY'S SAVE STATE">
              <div className="space-y-1.5 text-[11px] font-mono text-muted-foreground">
                <Line k="Daily log" v={dailyLog.id !== "" ? "✓ tracked" : "—"} />
                <Line k="Trades logged" v={`${tradesForDate.length}`} />
                <Line k="Psych entries" v={`${logs.filter((l) => l.date === date).length}`} />
                <Line k="Last save" v={new Date(dailyLog.updatedAt).toLocaleTimeString()} />
              </div>
            </Section>
          </div>
        </div>

        {/* Psychology History Calendar */}
        <div className="mt-4">
          <PsychologyCalendar
            selectedDate={date}
            onSelectDate={setDate}
            logs={logs}
            trades={trades}
          />
        </div>
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
      className="rounded-lg border border-terminal-border p-5"
      style={{ background: "#0D1117" }}
    >
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-[11px] font-bold tracking-[0.3em] text-[#48C0D8]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-[10px] font-bold tracking-[0.25em] text-muted-foreground mb-2 ${className}`}>
      {children}
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-terminal-border/40 pb-1">
      <span>{k}</span><span className="text-foreground">{v}</span>
    </div>
  );
}

/** Local-state textarea that only commits onBlur (avoids re-renders / loops). */
function Field({
  label,
  value,
  placeholder,
  rows = 3,
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
  useEffect(() => { setV(value); }, [value]);
  return (
    <div>
      {label && <Label>{label}</Label>}
      <textarea
        value={v}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v !== value) onCommit(v); }}
        className="w-full bg-[#05080A] border border-terminal-border rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-[#48C0D8]/60 resize-y"
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
      <div className="flex gap-1.5 flex-wrap">
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              onClick={() => onChange(active ? undefined : opt)}
              className={`px-2.5 py-1 rounded text-[11px] font-bold tracking-wider border transition ${
                active
                  ? "bg-[#48C0D8]/15 text-[#48C0D8] border-[#48C0D8]/60"
                  : "border-terminal-border text-muted-foreground hover:text-foreground"
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
