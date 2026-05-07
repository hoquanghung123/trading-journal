import { useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchTrades,
  upsertTrade,
  computeOutcome,
  outcomeStyle,
  type Trade,
} from "@/lib/trades";
import { RichEditor } from "@/components/ui/rich-editor";
import { getAssetIconUrl } from "@/lib/symbols";
import { isWithinInterval, startOfDay, endOfDay, parseISO } from "date-fns";
import { CheckCircle2, AlertCircle, FileText, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Period → Date Range ──────────────────────────────────────────────────────

function parsePeriodToRange(period: string): { start: Date; end: Date } | null {
  // Format: YYYY-MM-WN (week N of month)
  const monthWeekMatch = period.match(/^(\d{4})-(\d{2})-W(\d+)$/);
  if (monthWeekMatch) {
    const year = parseInt(monthWeekMatch[1]);
    const month = parseInt(monthWeekMatch[2]) - 1; // 0-indexed
    const weekNum = parseInt(monthWeekMatch[3]);

    const firstOfMonth = new Date(year, month, 1);
    // Find Monday of week 1 of that month
    const dayOfWeek = (firstOfMonth.getDay() + 6) % 7; // Mon=0
    const firstMonday = new Date(year, month, 1 - dayOfWeek);

    const weekStart = new Date(firstMonday);
    weekStart.setDate(firstMonday.getDate() + (weekNum - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    return { start: startOfDay(weekStart), end: endOfDay(weekEnd) };
  }

  // Format: YYYY-WN (ISO week)
  const isoWeekMatch = period.match(/^(\d{4})-W(\d+)$/);
  if (isoWeekMatch) {
    const year = parseInt(isoWeekMatch[1]);
    const week = parseInt(isoWeekMatch[2]);

    // ISO week 1 is the week containing Jan 4
    const jan4 = new Date(year, 0, 4);
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    monday.setDate(monday.getDate() + (week - 1) * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return { start: startOfDay(monday), end: endOfDay(sunday) };
  }

  // Format: YYYY-MM (whole month)
  const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const year = parseInt(monthMatch[1]);
    const month = parseInt(monthMatch[2]) - 1;
    return {
      start: startOfDay(new Date(year, month, 1)),
      end: endOfDay(new Date(year, month + 1, 0)),
    };
  }

  return null;
}

// ── Save Status Indicator ────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved";

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-all",
        status === "saving" ? "text-muted-foreground animate-pulse" : "text-primary",
      )}
    >
      {status === "saving" ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-ping" />
          Saving...
        </>
      ) : (
        <>
          <CheckCircle2 className="w-3.5 h-3.5" />
          Saved
        </>
      )}
    </div>
  );
}

// ── Trade Note Card ──────────────────────────────────────────────────────────

function TradeNoteCard({ trade }: { trade: Trade }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string>(trade.notes ?? "");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const outcome = computeOutcome(trade.actualRr, trade.maxRr, trade.netPnl);

  const handleBlur = useCallback(async () => {
    if (draft === (trade.notes ?? "")) return; // no change
    setSaveStatus("saving");
    try {
      await upsertTrade({ ...trade, notes: draft });
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("idle");
    }
  }, [draft, trade, queryClient]);

  const formattedDate = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(trade.entryTime));

  return (
    <div className="bg-white rounded-2xl border border-border/60 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Card Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-muted/20">
        <div className="flex items-center gap-3">
          {/* Outcome badge */}
          <span
            className={cn(
              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm",
              outcomeStyle[outcome.color],
            )}
          >
            {outcome.label}
          </span>

          {/* Symbol + icon */}
          <div className="flex items-center gap-1.5">
            {getAssetIconUrl(trade.symbol) && (
              <div className="w-5 h-5 rounded-full overflow-hidden bg-white shadow-sm border border-border/40 flex items-center justify-center shrink-0">
                <img
                  src={getAssetIconUrl(trade.symbol)!}
                  alt={trade.symbol}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <span className="font-black text-foreground text-sm">{trade.symbol}</span>
          </div>

          {/* Side */}
          <span
            className={cn(
              "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
              trade.side === "buy"
                ? "bg-primary/10 text-primary"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {trade.side}
          </span>

          {/* PnL */}
          <span
            className={cn(
              "text-sm font-black",
              trade.netPnl > 0
                ? "text-primary"
                : trade.netPnl < 0
                  ? "text-destructive"
                  : "text-muted-foreground",
            )}
          >
            {trade.netPnl > 0 ? "+" : ""}
            {trade.netPnl.toFixed(2)}
          </span>

          {/* RR */}
          <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">
            {trade.actualRr}R
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Compliance */}
          {trade.complianceCheck ? (
            <div className="flex items-center gap-1 text-primary text-[10px] font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Followed
            </div>
          ) : (
            <div className="flex items-center gap-1 text-destructive text-[10px] font-bold uppercase tracking-wider">
              <AlertCircle className="w-3.5 h-3.5" />
              Incomplete
            </div>
          )}

          {/* Date */}
          <span className="text-[10px] font-semibold text-muted-foreground">{formattedDate}</span>

          {/* Save indicator */}
          <SaveIndicator status={saveStatus} />
        </div>
      </div>

      {/* TipTap Editor */}
      <div onBlur={handleBlur}>
        <RichEditor
          value={draft}
          onChange={setDraft}
          placeholder="Add trade notes... What happened? What did you learn?"
          minHeight="150px"
          className="border-0 rounded-none shadow-none"
        />
      </div>
    </div>
  );
}

// ── Filter Bar ────────────────────────────────────────────────────────────────

type OutcomeFilter = "all" | "win" | "loss" | "be";
type NoteFilter = "all" | "has-note" | "no-note";

const OUTCOME_OPTIONS: { value: OutcomeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "win", label: "Win" },
  { value: "loss", label: "Loss" },
  { value: "be", label: "BE" },
];

// ── Main Component ────────────────────────────────────────────────────────────

interface TradeNotesTabProps {
  period: string;
}

export function TradeNotesTab({ period }: TradeNotesTabProps) {
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [noteFilter, setNoteFilter] = useState<NoteFilter>("all");

  const { data: allTrades = [], isLoading } = useQuery({
    queryKey: ["trades"],
    queryFn: fetchTrades,
  });

  const dateRange = useMemo(() => parsePeriodToRange(period), [period]);

  const periodTrades = useMemo(() => {
    if (!dateRange) return allTrades;
    return allTrades.filter((t) => {
      const date = parseISO(t.entryTime);
      return isWithinInterval(date, { start: dateRange.start, end: dateRange.end });
    });
  }, [allTrades, dateRange]);

  const filtered = useMemo(() => {
    return periodTrades
      .filter((t) => {
        if (outcomeFilter === "all") return true;
        const o = computeOutcome(t.actualRr, t.maxRr, t.netPnl);
        if (outcomeFilter === "win") return o.color === "green";
        if (outcomeFilter === "loss") return o.color === "red";
        if (outcomeFilter === "be") return o.color === "amber";
        return true;
      })
      .filter((t) => {
        if (noteFilter === "all") return true;
        if (noteFilter === "has-note") return !!t.notes?.trim();
        if (noteFilter === "no-note") return !t.notes?.trim();
        return true;
      })
      .sort((a, b) => +new Date(b.entryTime) - +new Date(a.entryTime));
  }, [periodTrades, outcomeFilter, noteFilter]);

  // Stats
  const withNotes = periodTrades.filter((t) => !!t.notes?.trim()).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm font-bold animate-pulse">
        Loading trades...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="flex items-center gap-6 px-1">
        <div className="text-sm font-bold text-muted-foreground">
          <span className="text-foreground font-black text-lg">{periodTrades.length}</span>
          {" "}trades this period
        </div>
        <div className="w-px h-5 bg-border" />
        <div className="text-sm font-bold text-muted-foreground">
          <span className="text-primary font-black text-lg">{withNotes}</span>
          {" "}with notes
        </div>
        {periodTrades.length > 0 && (
          <>
            <div className="w-px h-5 bg-border" />
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[200px]">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.round((withNotes / periodTrades.length) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-muted-foreground">
              {Math.round((withNotes / periodTrades.length) * 100)}% coverage
            </span>
          </>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center bg-muted/40 p-1 rounded-xl border border-border/50">
          {OUTCOME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setOutcomeFilter(opt.value)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                outcomeFilter === opt.value
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-border" />

        <button
          onClick={() => setNoteFilter(noteFilter === "has-note" ? "all" : "has-note")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all",
            noteFilter === "has-note"
              ? "bg-primary text-white border-primary shadow-sm"
              : "border-border/60 text-muted-foreground hover:text-foreground bg-white",
          )}
        >
          <StickyNote className="w-3.5 h-3.5" />
          Has Note
        </button>
        <button
          onClick={() => setNoteFilter(noteFilter === "no-note" ? "all" : "no-note")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all",
            noteFilter === "no-note"
              ? "bg-destructive text-white border-destructive shadow-sm"
              : "border-border/60 text-muted-foreground hover:text-foreground bg-white",
          )}
        >
          <FileText className="w-3.5 h-3.5" />
          No Note
        </button>
      </div>

      {/* Trade cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-border/50 text-muted-foreground/50">
          <StickyNote className="w-10 h-10 mb-4 opacity-20" />
          <p className="text-sm font-bold uppercase tracking-widest">
            {periodTrades.length === 0
              ? "No trades recorded in this period"
              : "No trades match the current filter"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((trade) => (
            <TradeNoteCard key={trade.id} trade={trade} />
          ))}
        </div>
      )}
    </div>
  );
}
