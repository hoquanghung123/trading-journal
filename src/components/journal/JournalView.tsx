import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  ChevronsRight,
  Filter,
  Activity,
} from "lucide-react";
import {
  type DayEntry,
  type SlotKind,
  type KillzoneChip,
  fetchEntries,
  upsertEntry,
  deleteEntry,
  monthKey,
  uid,
  isPrepDay,
  calculateStreak,
  journalTradingDate,
  previousEntryForAsset,
  applyHtfCarry,
} from "@/lib/journal";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { useSymbols, getAssetIconUrl } from "@/lib/symbols";
import { DayColumn } from "./DayColumn";
import { TodaySwissTapes } from "./TodaySwissTapes";
import { EditDayModal } from "./EditDayModal";
import { MorningPsychologyPrompt } from "./MorningPsychologyPrompt";
import { MonthView } from "./MonthView";
import { CelebrationModal } from "./CelebrationModal";
import { onBiasFocus, onShowCelebration, onRequestNewBias, onBiasAssetFocus, onBiasDateFocus, navigateToPage, parseNavFromUrl, setNavUrl } from "@/lib/nav-bus";
import { toast } from "sonner";
import { fetchPsychologyForDate, type PsychologyLog } from "@/lib/psychology";
import { SessionChip } from "@/components/shared/SessionChip";
import { EmptyState } from "@/components/shared/EmptyState";
import { useAchievementTracker } from "@/hooks/useAchievementTracker";
import { supabase } from "@/integrations/supabase/client";

const emptyEntry = (asset: string, date = journalTradingDate()): DayEntry => ({
  id: uid(),
  date,
  asset,
  yearlyBias: "consolidation",
  weeklyBias: "consolidation",
  weeklyCorrect: false,
  monthlyBias: "consolidation",
  monthlyCorrect: false,
  dailyBias: "consolidation",
  dailyCorrect: false,
  h4: {},
});

const newEntry = (asset: string, prior: DayEntry[] = [], date = journalTradingDate()): DayEntry => {
  const base = emptyEntry(asset, date);
  const prev = previousEntryForAsset(prior, asset, date);
  return prev ? applyHtfCarry(base, prev, "bias") : base;
};

export function JournalView() {
  const { data: assetList = [] } = useSymbols();
  const ASSETS = useMemo(() => assetList.filter((s) => !s.isForex).map((s) => s.name), [assetList]);

  const {
    data: entries = [],
    isPending: entriesPending,
    isError: entriesError,
    refetch: refetchEntries,
  } = useQuery({
    queryKey: ["journal_entries"],
    queryFn: () => fetchEntries(),
  });
  const [asset, setAsset] = useState<string>(() => {
    const stored = localStorage.getItem("journal-filter-asset");
    if (!stored || stored === "TODAY") return "ALL";
    return stored;
  });
  const [month, setMonth] = useState<string>(() => {
    return localStorage.getItem("journal-filter-month") || "ALL";
  });
  const [viewMode, setViewMode] = useState<"today" | "timeline" | "month">(() => {
    const stored = localStorage.getItem("journal-view-mode");
    const storedAsset = localStorage.getItem("journal-filter-asset");
    if (stored === "month") return "month";
    if (stored === "today") return "today";
    if (storedAsset === "TODAY" || !stored) return "today";
    if (stored === "timeline") return "timeline";
    return "today";
  });
  const [todayDrafts, setTodayDrafts] = useState<Record<string, DayEntry>>({});
  const [expandTapeId, setExpandTapeId] = useState<string | null>(null);
  const [killzoneFocus, setKillzoneFocus] = useState<KillzoneChip | null>(null);
  const [killzoneFocusTick, setKillzoneFocusTick] = useState(0);
  const [editing, setEditing] = useState<DayEntry | null>(null);
  const [focusedSlot, setFocusedSlot] = useState<{ id: string; slot: SlotKind } | null>(null);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationStreak, setCelebrationStreak] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const urlDateApplied = useRef(false);
  const pinnedDate = useRef<string | null>(null);

  const selectAsset = (next: string) => {
    if (next !== asset) pinnedDate.current = null;
    setAsset(next);
  };

  // Morning Psychology Prompt Logic
  const [showPsychPrompt, setShowPsychPrompt] = useState(false);
  const [todayLog, setTodayLog] = useState<PsychologyLog | undefined>();
  const psychDismissedRef = useRef(false);
  const { track } = useAchievementTracker();

  const closePsychPrompt = () => {
    psychDismissedRef.current = true;
    setShowPsychPrompt(false);
  };

  const savePsychPrompt = (log: PsychologyLog) => {
    psychDismissedRef.current = true;
    setTodayLog(log);
    setShowPsychPrompt(false);
  };

  useEffect(() => {
    let cancelled = false;
    const checkPsych = async () => {
      try {
        const { fetchSettings } = await import("@/lib/settings");
        const settings = await fetchSettings();

        if (!settings.dailyReminder) return;

        // Check if reminder time has passed
        const now = new Date();
        const [targetH, targetM] = (settings.dailyReminderTime || "08:00").split(":").map(Number);
        const currentH = now.getHours();
        const currentM = now.getMinutes();

        const isTimePassed = currentH > targetH || (currentH === targetH && currentM >= targetM);
        const isTest = new URLSearchParams(window.location.search).get("test") === "psych";

        // test=psych only skips the reminder-time gate, not an already-saved check-in
        if (!isTimePassed && !isTest) return;

        const today = journalTradingDate();
        const logs = await fetchPsychologyForDate(today);
        const daily = logs.find((l) => l.tradeId === null);
        if (cancelled || psychDismissedRef.current) return;
        setTodayLog(daily);

        if (!daily || !daily.morningMood) {
          setShowPsychPrompt(true);
        }
      } catch (e) {
        console.error("Failed to check psychology status:", e);
      }
    };

    checkPsych();
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to real-time updates from Supabase for live reloading
  useEffect(() => {
    const channel = supabase
      .channel("journal_entries_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "journal_entries" }, () => {
        queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-slot-root]")) setFocusedSlot(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Save filter preferences
  useEffect(() => {
    localStorage.setItem("journal-filter-month", month);
  }, [month]);

  useEffect(() => {
    localStorage.setItem("journal-filter-asset", asset);
  }, [asset]);

  useEffect(() => {
    localStorage.setItem("journal-view-mode", viewMode);
  }, [viewMode]);

  // Subscribe to smart-link focus events from Trade Log
  useEffect(() => {
    return onBiasFocus((entryId, assetName) => {
      pinnedDate.current = null;
      setViewMode("timeline");
      setMonth("ALL");
      const fromList = entries.find((e) => e.id === entryId);
      const name = assetName || fromList?.asset;
      if (name) setAsset(name);
      else setAsset("ALL");
      setPendingFocusId(entryId);
    });
  }, [entries]);

  useEffect(() => {
    return onBiasAssetFocus((name) => {
      pinnedDate.current = null;
      setViewMode("timeline");
      setAsset(name);
      setMonth("ALL");
    });
  }, []);

  const applyBiasDate = (date: string) => {
    if (date === journalTradingDate()) {
      pinnedDate.current = null;
      setViewMode("today");
      return;
    }
    setViewMode("timeline");
    pinnedDate.current = date;
    setMonth("ALL");
    const match = entries.find((e) => e.date === date);
    if (match) {
      setAsset(match.asset);
      setPendingFocusId(match.id);
    }
  };

  useEffect(() => {
    return onBiasDateFocus((date) => applyBiasDate(date));
  }, [entries]);

  useEffect(() => {
    if (entriesPending || urlDateApplied.current) return;
    urlDateApplied.current = true;
    const nav = parseNavFromUrl();
    if (nav.page !== "bias" || !nav.date) return;
    applyBiasDate(nav.date);
  }, [entriesPending, entries]);

  useEffect(() => {
    if (!urlDateApplied.current) return;
    if (viewMode === "today") {
      pinnedDate.current = null;
      setNavUrl("bias", journalTradingDate());
    } else if (pinnedDate.current) {
      setNavUrl("bias", pinnedDate.current);
    } else {
      setNavUrl("bias");
    }
  }, [asset, viewMode]);

  useEffect(() => {
    return onRequestNewBias((name) => {
      const fallback = ASSETS[0] ?? "XAUUSD";
      const next = name || fallback;
      if (name) setAsset(name);
      setEditing(newEntry(next, entries));
    });
  }, [ASSETS, entries]);

  // Subscribe to celebration events from extension
  useEffect(() => {
    return onShowCelebration((streak) => {
      setCelebrationStreak(streak);
      setShowCelebration(true);
    });
  }, []);

  // Poll for the target element until it appears (data may still be loading,
  // or filters/render may not have flushed yet). Up to ~3 seconds.
  useEffect(() => {
    if (!pendingFocusId) return;
    let attempts = 0;
    let raf = 0;
    const tick = () => {
      const el = document.getElementById(`bias-entry-${pendingFocusId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", inline: "center", block: "center" });
        el.classList.add("bias-flash");
        setTimeout(() => el.classList.remove("bias-flash"), 2200);
        setPendingFocusId(null);
        return;
      }
      attempts += 1;
      if (attempts > 30) {
        // ~3s at 100ms
        toast.error("Bias entry not found");
        setPendingFocusId(null);
        return;
      }
      raf = window.setTimeout(tick, 100) as unknown as number;
    };
    tick();
    return () => {
      if (raf) clearTimeout(raf);
    };
  }, [pendingFocusId, entries]);

  const months = useMemo(() => {
    const set = new Set(entries.map((e) => monthKey(e.date)));
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    const today = journalTradingDate();
    const forexNames = new Set(assetList.filter((s) => s.isForex).map((s) => s.name));
    return [...entries]
      .filter((e) => !forexNames.has(e.asset))
      .filter((e) => {
        if (viewMode === "today") return e.date === today;
        return asset === "ALL" ? true : e.asset === asset;
      })
      .filter((e) =>
        viewMode === "month" || viewMode === "today"
          ? true
          : month === "ALL"
            ? true
            : monthKey(e.date) === month,
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, asset, month, assetList, viewMode]);

  const todayTapes = useMemo(() => {
    const byAsset = new Map<string, DayEntry>();
    for (const e of filtered) byAsset.set(e.asset, e);
    for (const [name, draft] of Object.entries(todayDrafts)) {
      if (!byAsset.has(name)) byAsset.set(name, draft);
    }
    const fromWatchlist = ASSETS.map((name) => byAsset.get(name)).filter(Boolean) as DayEntry[];
    const extras = [...byAsset.values()].filter((e) => !ASSETS.includes(e.asset));
    return [...fromWatchlist, ...extras];
  }, [filtered, todayDrafts, ASSETS]);

  const jumpRight = () => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  };

  const upsert = async (e: DayEntry) => {
    // Check if the date already had a prep entry BEFORE this edit
    const dateWasComplete = isPrepDay(entries.filter((x) => x.date === e.date));

    // Optimistic UI update (optional, but keep it simple for now and rely on invalidation)
    // Actually, invalidate is better for ensuring data integrity

    try {
      await upsertEntry(e);

      // Check if the date is complete AFTER this edit
      const isNowComplete = isPrepDay([
        ...entries.filter((x) => x.date === e.date && x.id !== e.id),
        e,
      ]);
      if (!dateWasComplete && isNowComplete) {
        const stats = calculateStreak([...entries.filter((x) => x.id !== e.id), e]);
        setCelebrationStreak(stats.currentStreak);
        setShowCelebration(true);
      }
      queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
      setTodayDrafts((d) => {
        if (!d[e.asset]) return d;
        const next = { ...d };
        delete next[e.asset];
        return next;
      });
      track();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (err as any)?.message || "An error occurred");
      throw err;
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteEntry(id);
      queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
      setTodayDrafts((d) => {
        const hit = Object.entries(d).find(([, draft]) => draft.id === id);
        if (!hit) return d;
        const next = { ...d };
        delete next[hit[0]];
        return next;
      });
      track();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (err as any)?.message || "An error occurred");
      throw err;
    }
  };

  const addEntry = async () => {
    const fallback = ASSETS[0] ?? "XAUUSD";
    const today = journalTradingDate();
    const targetAsset = asset === "ALL" ? fallback : asset;
    const existing = entries.find((e) => e.date === today && e.asset === targetAsset);
    setEditing(existing ?? newEntry(targetAsset, entries));
    setTimeout(jumpRight, 100);
  };

  const createTodayDraft = (assetName: string) => {
    const draft = newEntry(assetName, entries);
    setTodayDrafts((d) => ({ ...d, [assetName]: draft }));
    setExpandTapeId(draft.id);
  };

  // The extension sync is now handled globally in src/routes/__root.tsx
  // This component will automatically see the new entries when they are saved to DB
  // because we re-fetch or use real-time updates if implemented.

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4 px-4 lg:px-6 py-3 lg:pr-14">
          <div className="flex items-center justify-between lg:justify-start gap-3 min-w-0 lg:flex-1">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base lg:text-lg font-bold tracking-tight text-foreground whitespace-nowrap">
                  Bias Expect
                </h1>
                <p className="text-[9px] lg:text-[10px] text-muted-foreground font-medium uppercase tracking-wider whitespace-nowrap">
                  {journalTradingDate()} · rolls 5pm NY
                </p>
              </div>
              <SessionChip
                selected={killzoneFocus}
                onSelect={(chip) => {
                  setKillzoneFocus(chip);
                  setKillzoneFocusTick((n) => n + 1);
                }}
              />
            </div>
            {viewMode !== "today" && (
              <button
                type="button"
                onClick={addEntry}
                className="lg:hidden forest-gradient flex items-center justify-center w-10 h-10 text-white rounded-xl shadow-lg active:scale-95 transition-all"
              >
                <Plus className="w-5 h-5" strokeWidth={3} />
              </button>
            )}
          </div>

          {viewMode !== "today" && (
            <>
              <button
                type="button"
                onClick={addEntry}
                className="hidden lg:flex forest-gradient items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl shadow-lg hover:opacity-90 transition-all active:scale-95 whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" strokeWidth={3} /> Add Day
              </button>
              <div className="hidden lg:block h-8 w-px bg-border shrink-0" />
            </>
          )}

          <div className="flex bg-muted/50 p-1 rounded-lg border border-border shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("today")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${viewMode === "today" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("timeline");
                if (asset === "TODAY") selectAsset("ALL");
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${viewMode === "timeline" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Timeline
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("month");
                if (asset === "TODAY") selectAsset("ALL");
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${viewMode === "month" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Month
            </button>
          </div>
        </div>

        {viewMode !== "today" && (
          <div className="flex flex-wrap items-center gap-2 px-4 lg:px-6 pb-3 lg:pr-14">
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar min-w-0 flex-1">
              <span className="hidden sm:inline text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                Asset:
              </span>
              <button
                type="button"
                onClick={() => selectAsset("ALL")}
                className={`px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg border transition-all whitespace-nowrap ${asset === "ALL" ? "bg-primary text-white border-primary shadow-sm" : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"}`}
              >
                All
              </button>
              {ASSETS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => selectAsset(a)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg border transition-all whitespace-nowrap ${asset === a ? "bg-primary text-white border-primary shadow-sm" : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                >
                  {getAssetIconUrl(a) && (
                    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full overflow-hidden shrink-0 bg-white flex items-center justify-center">
                      <img src={getAssetIconUrl(a)!} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {a}
                </button>
              ))}
            </div>
            {viewMode === "timeline" && (
              <div className="flex items-center gap-2 shrink-0">
                <label className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                  <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  >
                    <option value="ALL">All months</option>
                    {months.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={jumpRight}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold border border-border bg-card rounded-lg hover:bg-muted transition-all shadow-sm whitespace-nowrap text-foreground"
                >
                  Jump <ChevronsRight className="w-4 h-4 text-primary" />
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="px-4 py-5">
        {entriesPending ? (
          <BiasSkeleton today={viewMode === "today"} />
        ) : entriesError ? (
          <EmptyState
            icon={Activity}
            title="Couldn't load bias"
            description="Check your connection and try again."
            actionLabel="Retry"
            onAction={() => refetchEntries()}
            className="mt-20"
          />
        ) : viewMode === "today" ? (
          <div className="space-y-4 max-w-6xl mx-auto">
            {showPsychPrompt && (
              <MorningPsychologyPrompt
                isOpen
                placement="inline"
                onClose={closePsychPrompt}
                onSaved={savePsychPrompt}
                existingLog={todayLog}
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-1">
                Today
              </span>
              <CheckChip
                done={entries.some((e) => e.date === journalTradingDate())}
                label="Bias logged"
              />
              <CheckChip
                done={!!todayLog?.morningMood}
                label="Psych check-in"
                onClick={() => navigateToPage("psychology")}
              />
              <button
                type="button"
                onClick={() => navigateToPage("trades")}
                className="text-[10px] font-bold text-primary hover:underline"
              >
                Log a trade
              </button>
            </div>
            {ASSETS.length === 0 && entries.length === 0 ? (
              <Empty onAdd={addEntry} />
            ) : (
              <TodaySwissTapes
                entries={todayTapes}
                watchlist={
                  ASSETS.length
                    ? [...new Set([...ASSETS, ...todayTapes.map((e) => e.asset)])]
                    : todayTapes.map((e) => e.asset)
                }
                onUpdate={upsert}
                onEdit={setEditing}
                onCreate={createTodayDraft}
                expandId={expandTapeId}
                focusKillzone={killzoneFocus}
                focusTick={killzoneFocusTick}
              />
            )}
          </div>
        ) : entries.length === 0 ? (
          <Empty onAdd={addEntry} />
        ) : filtered.length === 0 ? (
          <FilterEmpty
            asset={asset}
            month={month}
            onAdd={addEntry}
            onClear={() => {
              setMonth("ALL");
              selectAsset("ALL");
            }}
          />
        ) : viewMode === "month" ? (
          <MonthView entries={filtered} onUpdate={upsert} asset={asset} />
        ) : (
          <div ref={scrollerRef} data-slot-root className="overflow-x-auto scrollbar-terminal pb-4">
            <div className="flex gap-3 min-w-min items-start">
              {filtered.map((e) => (
                <DayColumn
                  key={e.id}
                  entry={e}
                  focusedSlot={focusedSlot}
                  setFocus={setFocusedSlot}
                  onUpdate={upsert}
                  onEdit={setEditing}
                  focusKillzone={killzoneFocus}
                  focusTick={killzoneFocusTick}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {editing && (
        <EditDayModal
          entry={editing}
          priorEntries={entries}
          onSave={upsert}
          onDelete={entries.some((e) => e.id === editing.id) ? remove : undefined}
          onClose={() => setEditing(null)}
        />
      )}

      <MorningPsychologyPrompt
        isOpen={showPsychPrompt && viewMode !== "today"}
        placement="overlay"
        onClose={closePsychPrompt}
        onSaved={savePsychPrompt}
        existingLog={todayLog}
      />

      <CelebrationModal
        isOpen={showCelebration}
        onClose={() => setShowCelebration(false)}
        streakCount={celebrationStreak}
        streakDays={calculateStreak(entries).streakDays}
      />
    </div>
  );
}

function CheckChip({
  done,
  label,
  onClick,
}: {
  done: boolean;
  label: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className={`w-1.5 h-1.5 rounded-full ${done ? "bg-primary" : "bg-muted-foreground/40"}`} />
      {label}
    </>
  );
  const cls = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
    done ? "border-primary/30 text-primary bg-primary/10" : "border-border text-muted-foreground bg-card"
  }`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  }
  return <span className={cls}>{inner}</span>;
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon={Activity}
      title="Your journal is empty"
      description="Record your first analysis and bias expectations for the session."
      actionLabel="Add your first day"
      onAction={onAdd}
      className="mt-20"
    />
  );
}

function FilterEmpty({
  asset,
  month,
  onAdd,
  onClear,
}: {
  asset: string;
  month: string;
  onAdd: () => void;
  onClear: () => void;
}) {
  const monthLabel =
    month === "ALL"
      ? null
      : new Date(`${month}-01T12:00:00`).toLocaleString("en-US", { month: "long", year: "numeric" });
  const title =
    asset === "TODAY"
      ? "No bias for today"
      : asset === "ALL" && monthLabel
        ? `No bias in ${monthLabel}`
        : asset === "ALL"
          ? "No bias for this filter"
          : monthLabel
            ? `No bias for ${asset} in ${monthLabel}`
            : `No bias for ${asset}`;
  const description =
    asset === "TODAY"
      ? "Nothing logged for this trading day yet. Add a day or show your existing journal."
      : "This filter doesn't match any entries. Clear it to see the rest of your journal.";

  return (
    <EmptyState
      icon={Filter}
      title={title}
      description={description}
      actionLabel="Add Day"
      onAction={onAdd}
      secondaryLabel={asset === "TODAY" ? "Show all days" : "Clear filters"}
      onSecondary={onClear}
      className="mt-20"
    />
  );
}

function BiasSkeleton({ today }: { today: boolean }) {
  if (today) {
    return (
      <div className="space-y-3 max-w-4xl">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl border border-border bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-[28rem] w-[85vw] md:w-[calc((100vw-var(--sidebar-width)-64px)/3)] shrink-0 rounded-2xl border border-border bg-muted/40 animate-pulse"
        />
      ))}
    </div>
  );
}
