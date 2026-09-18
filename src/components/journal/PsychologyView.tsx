import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchTrades, type Trade } from "@/lib/trades";
import { formatSigned } from "@/lib/trade-log";
import {
  fetchPsychologyLogs,
  upsertPsychologyLog,
  newDailyLog,
  newTradeLog,
  MOOD_ITEMS,
  PRE_EMOTIONS,
  POST_EMOTIONS,
  moodLabel,
  isHotEmotion,
  hasDailyCheckIn,
  hasTradeEval,
  type PsychologyLog,
} from "@/lib/psychology";
import { journalTradingDate } from "@/lib/journal";
import { PsychologyCalendar } from "./PsychologyCalendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";

const NY_TIME = {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
} as const;

function nyTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", NY_TIME);
}

function prettyDay(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

export function PsychologyView() {
  const [date, setDate] = useState<string>(() => journalTradingDate());
  const [trades, setTrades] = useState<Trade[]>([]);
  const [logs, setLogs] = useState<PsychologyLog[]>([]);
  const [selectedId, setSelectedId] = useState<string>("morning");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phoneTape, setPhoneTape] = useState(false);
  const [phoneSheet, setPhoneSheet] = useState(false);

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

  const tradesForDate = useMemo(
    () =>
      trades
        .filter((t) => journalTradingDate(t.entryTime) === date)
        .sort((a, b) => +new Date(a.entryTime) - +new Date(b.entryTime)),
    [trades, date],
  );

  useEffect(() => {
    if (selectedId !== "morning" && !tradesForDate.find((t) => t.id === selectedId)) {
      setSelectedId("morning");
    }
  }, [tradesForDate, selectedId]);

  const dailyLog = useMemo<PsychologyLog>(() => {
    const found = logs.find((r) => r.date === date && r.tradeId === null);
    return found ?? newDailyLog(date);
  }, [logs, date]);

  const tradeLogs = useMemo(() => {
    const map = new Map<string, PsychologyLog>();
    for (const l of logs) {
      if (l.tradeId) map.set(l.tradeId, l);
    }
    return map;
  }, [logs]);

  const selectedTrade = tradesForDate.find((t) => t.id === selectedId);
  const selectedTradeLog = selectedTrade
    ? (tradeLogs.get(selectedTrade.id) ?? newTradeLog(date, selectedTrade.id))
    : null;

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
    if (!selectedTradeLog) return;
    persist({ ...selectedTradeLog, ...patch });
  };

  const netPnl = tradesForDate.reduce((s, t) => s + (Number(t.netPnl) || 0), 0);
  const stamped = tradesForDate.filter((t) => hasTradeEval(tradeLogs.get(t.id))).length;
  const morningDone = hasDailyCheckIn(logs.find((r) => r.date === date && r.tradeId === null));

  const pickDate = (next: string) => {
    setDate(next);
    setSelectedId("morning");
    setPhoneSheet(false);
    const mobile =
      typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
    setPhoneTape(mobile);
  };

  const pickRow = (id: string, sheet = false) => {
    setSelectedId(id);
    if (sheet) setPhoneSheet(true);
  };

  if (loading) {
    return (
      <div className="h-full min-h-[50vh] bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const tape = (
    <DayTape
      date={date}
      dailyLog={dailyLog}
      morningDone={morningDone}
      trades={tradesForDate}
      tradeLogs={tradeLogs}
      selectedId={selectedId}
      onSelect={(id) => pickRow(id, false)}
    />
  );

  const phoneTapeBody = (
    <DayTape
      date={date}
      dailyLog={dailyLog}
      morningDone={morningDone}
      trades={tradesForDate}
      tradeLogs={tradeLogs}
      selectedId={selectedId}
      onSelect={(id) => pickRow(id, true)}
    />
  );

  return (
    <div className="relative h-full min-h-0 bg-background flex flex-col lg:grid lg:grid-cols-[minmax(220px,292px)_minmax(0,1fr)_minmax(240px,320px)] overflow-hidden">
      <aside className="flex-1 min-h-0 lg:flex-none lg:min-h-0 lg:border-r border-border bg-card overflow-y-auto hide-scrollbar">
        <PsychologyCalendar
          selectedDate={date}
          onSelectDate={pickDate}
          logs={logs}
          trades={trades}
        />
      </aside>

      <div className="hidden lg:flex min-w-0 min-h-0 flex-1 flex-col">
        <DayHeader
          date={date}
          stamped={stamped}
          total={tradesForDate.length}
          morningDone={morningDone}
          mood={dailyLog.morningMood}
          netPnl={netPnl}
          saving={saving}
        />
        <div className="flex-1 overflow-y-auto hide-scrollbar px-4 py-4">{tape}</div>
      </div>

      <aside className="hidden lg:flex min-w-0 flex-col border-l border-border bg-card overflow-y-auto hide-scrollbar">
        <Inspector
          selectedId={selectedId}
          dailyLog={dailyLog}
          trade={selectedTrade}
          tradeLog={selectedTradeLog}
          saving={saving}
          onDaily={updateDaily}
          onTrade={updateTrade}
        />
      </aside>

      {phoneTape && (
        <div className="lg:hidden absolute inset-0 z-20 flex flex-col bg-background">
          <div className="h-12 px-4 flex items-center justify-between border-b border-border bg-card shrink-0">
            <button
              type="button"
              onClick={() => {
                setPhoneTape(false);
                setPhoneSheet(false);
              }}
              className="text-sm font-bold text-foreground"
            >
              Calendar
            </button>
            <span className="text-sm font-bold">{prettyDay(date)}</span>
            <span className="w-16" />
          </div>
          <div className="px-4 py-3 border-b border-border bg-card">
            <DayHeader
              date={date}
              stamped={stamped}
              total={tradesForDate.length}
              morningDone={morningDone}
              mood={dailyLog.morningMood}
              netPnl={netPnl}
              saving={saving}
              compact
            />
          </div>
          <div className="flex-1 overflow-y-auto hide-scrollbar px-4 py-4">{phoneTapeBody}</div>
        </div>
      )}

      <Sheet open={phoneSheet} onOpenChange={setPhoneSheet}>
        <SheetContent
          side="bottom"
          className="lg:hidden rounded-t-[20px] max-h-[78vh] overflow-y-auto p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Psychology inspector</SheetTitle>
            <SheetDescription>Log mood and trade emotions for the selected row.</SheetDescription>
          </SheetHeader>
          <Inspector
            selectedId={selectedId}
            dailyLog={dailyLog}
            trade={selectedTrade}
            tradeLog={selectedTradeLog}
            saving={saving}
            onDaily={updateDaily}
            onTrade={updateTrade}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DayHeader({
  date,
  stamped,
  total,
  morningDone,
  mood,
  netPnl,
  saving,
  compact,
}: {
  date: string;
  stamped: number;
  total: number;
  morningDone: boolean;
  mood?: string;
  netPnl: number;
  saving: boolean;
  compact?: boolean;
}) {
  const moodText = morningDone ? moodLabel(mood) || "Logged" : "No morning";
  return (
    <div
      className={`flex items-end justify-between gap-3 ${compact ? "" : "px-4 pt-4 pb-3 border-b border-border bg-card/80"}`}
    >
      <div className="min-w-0">
        <h2 className={`font-black tracking-tight text-foreground ${compact ? "text-base" : "text-lg"}`}>
          {prettyDay(date)}
        </h2>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {total ? `${stamped} of ${total} trades stamped` : "No trades"} · {moodText}
          {saving ? " · Saving" : ""}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden text-right shrink-0">
        <div className="px-3 py-1.5">
          <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Net</p>
          <p
            className={`tabular-nums text-sm font-bold ${
              netPnl > 0 ? "text-primary" : netPnl < 0 ? "text-destructive" : "text-foreground"
            }`}
          >
            {total ? formatSigned(netPnl, 0) : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

function DayTape({
  date,
  dailyLog,
  morningDone,
  trades,
  tradeLogs,
  selectedId,
  onSelect,
}: {
  date: string;
  dailyLog: PsychologyLog;
  morningDone: boolean;
  trades: Trade[];
  tradeLogs: Map<string, PsychologyLog>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="relative pl-1.5">
      <span className="absolute left-3 top-4 bottom-4 w-0.5 bg-border" aria-hidden />
      <div className="space-y-3">
        <TapeStop
          selected={selectedId === "morning"}
          node={morningDone ? "morn" : "gap"}
          onClick={() => onSelect("morning")}
          ariaLabel="Morning check-in"
        >
          <span className="tabular-nums text-[11px] font-semibold text-muted-foreground w-12 shrink-0 pt-1">
            AM
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-black text-foreground">Morning check-in</span>
            {morningDone ? (
              <span className="block text-[12px] text-muted-foreground mt-0.5">
                {dailyLog.morningNotes || "Check-in logged"}
              </span>
            ) : (
              <Stamp miss>Add check-in</Stamp>
            )}
          </span>
          {morningDone && dailyLog.morningMood && <Stamp>{moodLabel(dailyLog.morningMood)}</Stamp>}
        </TapeStop>

        {trades.map((t) => {
          const log = tradeLogs.get(t.id);
          const win = (t.netPnl ?? 0) > 0;
          const loss = (t.netPnl ?? 0) < 0;
          const gap = !hasTradeEval(log);
          return (
            <TapeStop
              key={t.id}
              selected={selectedId === t.id}
              node={gap ? "gap" : "ok"}
              rail={win ? "win" : loss ? "loss" : undefined}
              onClick={() => onSelect(t.id)}
              ariaLabel={`${t.symbol} ${t.side} ${formatSigned(t.netPnl ?? 0, 0)}`}
            >
              <span className="tabular-nums text-[11px] font-semibold text-muted-foreground w-12 shrink-0 pt-1">
                {nyTime(t.entryTime)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-black text-foreground">
                  {t.symbol}{" "}
                  <span className={t.side === "buy" ? "text-primary" : "text-destructive"}>
                    {t.side === "buy" ? "Buy" : "Sell"}
                  </span>
                </span>
                {gap ? (
                  <Stamp miss>Add psych</Stamp>
                ) : (
                  <span className="mt-1 flex flex-wrap gap-1 items-center">
                    {log?.preTradeEmotion ? (
                      <Stamp hot={isHotEmotion(log.preTradeEmotion)}>{log.preTradeEmotion}</Stamp>
                    ) : (
                      <Stamp miss>Pre</Stamp>
                    )}
                    <span className="text-[10px] text-muted-foreground">→</span>
                    {log?.postTradeEmotion ? (
                      <Stamp hot={isHotEmotion(log.postTradeEmotion)}>{log.postTradeEmotion}</Stamp>
                    ) : (
                      <Stamp miss>Post</Stamp>
                    )}
                  </span>
                )}
              </span>
              <span
                className={`tabular-nums text-[12px] font-bold shrink-0 ${
                  win ? "text-primary" : loss ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {formatSigned(t.netPnl ?? 0, 0)}
              </span>
            </TapeStop>
          );
        })}
      </div>
      {trades.length === 0 && (
        <p className="pl-8 mt-3 text-sm text-muted-foreground">
          No trades on {prettyDay(date)}. Morning still sits on the tape.
        </p>
      )}
      <p className="mt-4 pl-8 text-[11px] text-muted-foreground">
        Times are NY. Calendar picks the day. Dashed node = missing stamp.
      </p>
    </div>
  );
}

function TapeStop({
  selected,
  node,
  rail,
  onClick,
  ariaLabel,
  children,
}: {
  selected: boolean;
  node: "morn" | "gap" | "ok";
  rail?: "win" | "loss";
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const railCls =
    rail === "win"
      ? "shadow-[inset_3px_0_0_hsl(var(--primary))]"
      : rail === "loss"
        ? "shadow-[inset_3px_0_0_hsl(var(--destructive))]"
        : "";
  return (
    <div className="flex items-start gap-3">
      <span
        className={`relative z-[1] mt-4 w-3.5 h-3.5 rounded-full shrink-0 bg-card ${
          node === "morn"
            ? "bg-primary border-2 border-primary"
            : node === "gap"
              ? "border-2 border-dashed border-destructive"
              : "border-2 border-primary"
        }`}
      />
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        aria-pressed={selected}
        className={`flex-1 min-w-0 text-left flex items-start gap-3 p-3 rounded-xl border bg-card hover:bg-muted/40 ${railCls} ${
          selected ? "border-primary ring-1 ring-primary" : "border-border"
        }`}
      >
        {children}
      </button>
    </div>
  );
}

function Stamp({
  children,
  hot,
  miss,
}: {
  children: React.ReactNode;
  hot?: boolean;
  miss?: boolean;
}) {
  return (
    <span
      className={`inline-flex mt-1 text-[9px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full border ${
        miss
          ? "text-destructive border-dashed border-destructive/50 bg-transparent"
          : hot
            ? "text-destructive border-destructive/30 bg-destructive/10"
            : "text-primary border-primary/30 bg-primary/10"
      }`}
    >
      {children}
    </span>
  );
}

function Inspector({
  selectedId,
  dailyLog,
  trade,
  tradeLog,
  saving,
  onDaily,
  onTrade,
}: {
  selectedId: string;
  dailyLog: PsychologyLog;
  trade?: Trade;
  tradeLog: PsychologyLog | null;
  saving: boolean;
  onDaily: (patch: Partial<PsychologyLog>) => void;
  onTrade: (patch: Partial<PsychologyLog>) => void;
}) {
  const morning = selectedId === "morning";
  const gap = morning ? !hasDailyCheckIn(dailyLog) : !hasTradeEval(tradeLog);

  return (
    <div className="p-5 space-y-4">
      <div>
        <p
          className={`text-[10px] font-black uppercase tracking-widest ${gap ? "text-destructive" : "text-primary"}`}
        >
          {gap ? (morning ? "Missing check-in" : "Missing stamp") : "On the tape"}
        </p>
        <h3 className="text-lg font-black tracking-tight text-foreground mt-1 break-words">
          {morning ? "Morning check-in" : `${trade?.symbol ?? "Trade"} ${trade?.side === "buy" ? "Buy" : "Sell"}`}
        </h3>
        <p className="tabular-nums text-[11px] text-muted-foreground mt-0.5">
          {morning
            ? "Start of day"
            : trade
              ? `${nyTime(trade.entryTime)} NY · ${formatSigned(trade.netPnl ?? 0, 0)}`
              : ""}
        </p>
      </div>

      {morning ? (
        <>
          <ChipPicker
            label="Start of day"
            options={MOOD_ITEMS.map((m) => m.value)}
            labels={Object.fromEntries(MOOD_ITEMS.map((m) => [m.value, m.label]))}
            value={dailyLog.morningMood}
            onChange={(v) => onDaily({ morningMood: v })}
          />
          <Field
            label="Check-in note"
            value={dailyLog.morningNotes ?? ""}
            placeholder="How are you showing up?"
            onCommit={(v) => onDaily({ morningNotes: v })}
          />
        </>
      ) : (
        <>
          <ChipPicker
            label="Pre-trade"
            options={PRE_EMOTIONS}
            value={tradeLog?.preTradeEmotion}
            onChange={(v) => onTrade({ preTradeEmotion: v })}
          />
          <Field
            label="Why this entry"
            value={tradeLog?.entryRationale ?? ""}
            placeholder="Why did you take it?"
            rows={3}
            onCommit={(v) => onTrade({ entryRationale: v })}
          />
          <ChipPicker
            label="Post-trade"
            options={POST_EMOTIONS}
            value={tradeLog?.postTradeEmotion}
            onChange={(v) => onTrade({ postTradeEmotion: v })}
          />
          <Field
            label="Exit assessment"
            value={tradeLog?.exitAssessment ?? ""}
            placeholder="How did the exit feel?"
            rows={3}
            onCommit={(v) => onTrade({ exitAssessment: v })}
          />
        </>
      )}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
        {saving ? "Saving" : gap ? "Pick to stamp" : "Saved"}
      </p>
    </div>
  );
}

function ChipPicker({
  label,
  options,
  labels,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  labels?: Record<string, string>;
  value?: string;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt || (labels && labels[opt] === value);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(active ? undefined : opt)}
              className={`px-2.5 py-1.5 rounded-[10px] text-[11px] font-bold border ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {labels?.[opt] ?? opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  rows = 4,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  rows?: number;
  onCommit: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => {
    setV(value);
  }, [value]);
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <textarea
        value={v}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          if (v !== value) onCommit(v);
        }}
        className="mt-2 w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-primary/20 resize-y"
      />
    </label>
  );
}
