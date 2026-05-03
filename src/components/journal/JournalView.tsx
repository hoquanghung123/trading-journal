import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  ChevronsRight,
  Filter,
  Activity,
  Terminal as TerminalIcon,
  Sparkles,
} from "lucide-react";
import {
  type DayEntry,
  type SlotKind,
  type Session,
  fetchEntries,
  upsertEntry,
  deleteEntry,
  monthKey,
  uid,
  resolveTradingViewUrl,
  uploadChartImage,
  isPrepDay,
  calculateStreak,
} from "@/lib/journal";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { useSymbols, getAssetIconUrl } from "@/lib/symbols";
import { DayColumn } from "./DayColumn";
import { EditDayModal } from "./EditDayModal";
import { MorningPsychologyPrompt } from "./MorningPsychologyPrompt";
import { MonthView } from "./MonthView";
import { CelebrationModal } from "./CelebrationModal";
import { onBiasFocus } from "@/lib/nav-bus";
import { toast } from "sonner";
import { fetchPsychologyForDate, toLocalDateStr, type PsychologyLog } from "@/lib/psychology";

const newEntry = (asset: string): DayEntry => ({
  id: uid(),
  date: new Date().toISOString().slice(0, 10),
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

export function JournalView() {
  const { data: assetList = [] } = useSymbols();
  const ASSETS = useMemo(() => assetList.filter((s) => !s.isForex).map((s) => s.name), [assetList]);

  const { data: entries = [] } = useQuery({
    queryKey: ["journal_entries"],
    queryFn: fetchEntries,
  });
  const [asset, setAsset] = useState<string>(() => {
    return localStorage.getItem("journal-filter-asset") || "TODAY";
  });
  const [month, setMonth] = useState<string>(() => {
    return localStorage.getItem("journal-filter-month") || "ALL";
  });
  const [viewMode, setViewMode] = useState<"timeline" | "month">(() => {
    return (localStorage.getItem("journal-view-mode") as "timeline" | "month") || "timeline";
  });
  const [editing, setEditing] = useState<DayEntry | null>(null);
  const [focusedSlot, setFocusedSlot] = useState<{ id: string; slot: SlotKind } | null>(null);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationStreak, setCelebrationStreak] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Morning Psychology Prompt Logic
  const [showPsychPrompt, setShowPsychPrompt] = useState(false);
  const [todayLog, setTodayLog] = useState<PsychologyLog | undefined>();

  useEffect(() => {
    const checkPsych = async () => {
      try {
        const { fetchSettings } = await import("@/lib/settings");
        const settings = await fetchSettings();
        
        if (!settings.dailyReminder) return;

        // Check if reminder time has passed
        const now = new Date();
        const [targetH, targetM] = (settings.reminderTime || "08:00").split(":").map(Number);
        const currentH = now.getHours();
        const currentM = now.getMinutes();

        const isTimePassed = currentH > targetH || (currentH === targetH && currentM >= targetM);
        const isTest = new URLSearchParams(window.location.search).get("test") === "psych";

        if (!isTimePassed && !isTest) return;

        const today = toLocalDateStr(new Date());
        const logs = await fetchPsychologyForDate(today);
        const daily = logs.find((l) => l.tradeId === null);

        // If no daily log or no mood recorded, show prompt (or if in test mode)
        if (!daily || !daily.morningMood || isTest) {
          setTodayLog(daily);
          setShowPsychPrompt(true);
        }
      } catch (e) {
        console.error("Failed to check psychology status:", e);
      }
    };

    checkPsych();
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
      if (assetName) setAsset(assetName);
      else setAsset("ALL");
      setMonth("ALL");
      setPendingFocusId(entryId);
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
    const today = new Date().toISOString().slice(0, 10);
    const forexNames = new Set(assetList.filter((s) => s.isForex).map((s) => s.name));
    return [...entries]
      .filter((e) => !forexNames.has(e.asset))
      .filter((e) => {
        if (asset === "TODAY") return e.date === today;
        return asset === "ALL" ? true : e.asset === asset;
      })
      .filter((e) =>
        viewMode === "month"
          ? true
          : asset === "TODAY"
            ? true
            : month === "ALL"
              ? true
              : monthKey(e.date) === month,
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, asset, month, assetList, viewMode]);

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
      const isNowComplete = isPrepDay([...entries.filter((x) => x.date === e.date && x.id !== e.id), e]);
      if (!dateWasComplete && isNowComplete) {
        const stats = calculateStreak([...entries.filter((x) => x.id !== e.id), e]);
        setCelebrationStreak(stats.currentStreak);
        setShowCelebration(true);
      }
      queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteEntry(id);
      queryClient.invalidateQueries({ queryKey: ["journal_entries"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const addEntry = async () => {
    const fallback = ASSETS[0] ?? "XAUUSD";
    const e = newEntry(asset === "ALL" || asset === "TODAY" ? fallback : asset);
    await upsert(e);
    setEditing(e);
    setTimeout(jumpRight, 100);
  };

  // The extension sync is now handled globally in src/routes/__root.tsx
  // This component will automatically see the new entries when they are saved to DB
  // because we re-fetch or use real-time updates if implemented.

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6 px-4 lg:px-6 py-3 lg:py-4">
          <div className="flex items-center justify-between lg:justify-start gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-base lg:text-lg font-bold tracking-tight text-foreground whitespace-nowrap">
                  Bias Expect
                </h1>
                <p className="text-[9px] lg:text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  Journal Timeline
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={addEntry}
              className="lg:hidden forest-gradient flex items-center justify-center w-10 h-10 text-white rounded-xl shadow-lg active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5" strokeWidth={3} />
            </button>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar pb-1 lg:pb-0">
            <button
              type="button"
              onClick={addEntry}
              className="hidden lg:flex forest-gradient items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl shadow-lg hover:opacity-90 transition-all active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" strokeWidth={3} /> Add Day
            </button>

            <div className="hidden lg:block h-8 w-px bg-border" />

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                Asset:
              </span>
              {viewMode !== "month" && (
                <button
                  onClick={() => setAsset("TODAY")}
                  className={`px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg border transition-all whitespace-nowrap ${asset === "TODAY" ? "bg-primary text-white border-primary shadow-sm" : "border-border bg-white text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                >
                  Today
                </button>
              )}
              {ASSETS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAsset(a)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg border transition-all whitespace-nowrap ${asset === a ? "bg-primary text-white border-primary shadow-sm" : "border-border bg-white text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                >
                  {getAssetIconUrl(a) && (
                    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full overflow-hidden shrink-0 bg-white flex items-center justify-center">
                      <img
                        src={getAssetIconUrl(a)!}
                        alt={a}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 lg:ml-auto">
            {viewMode !== "month" && (
              <label className="flex items-center gap-2 flex-1 lg:flex-none">
                <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="flex-1 lg:flex-none bg-white border border-border rounded-lg px-3 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                >
                  <option value="ALL">All months</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex bg-muted/50 p-1 rounded-lg border border-border">
              <button
                onClick={() => setViewMode("timeline")}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${viewMode === "timeline" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Timeline
              </button>
              <button
                onClick={() => {
                  setViewMode("month");
                  if (asset === "TODAY") setAsset(ASSETS[0] || "ALL");
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${viewMode === "month" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Month View
              </button>
            </div>

            <button
              onClick={jumpRight}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold border border-border bg-white rounded-lg hover:bg-muted transition-all shadow-sm whitespace-nowrap"
            >
              Jump <ChevronsRight className="w-4 h-4 text-primary" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-5">
        {filtered.length === 0 ? (
          <Empty onAdd={addEntry} />
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
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {editing && (
        <EditDayModal
          entry={editing}
          onSave={upsert}
          onDelete={remove}
          onClose={() => setEditing(null)}
        />
      )}

      <MorningPsychologyPrompt
        isOpen={showPsychPrompt}
        onClose={() => setShowPsychPrompt(false)}
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

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-white rounded-[32px] border border-border p-16 text-center max-w-xl mx-auto mt-20 shadow-xl">
      <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <Activity className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-2xl font-black tracking-tight text-foreground">Your Journal is Empty</h2>
      <p className="text-sm font-medium text-muted-foreground mt-2 mb-8 leading-relaxed px-6">
        Initialize your trading journey by recording your first analysis and bias expectations.
      </p>
      <button
        onClick={onAdd}
        className="forest-gradient inline-flex items-center gap-2 px-8 py-3 text-sm font-black text-white rounded-xl shadow-xl hover:opacity-90 transition-all active:scale-95 uppercase tracking-widest"
      >
        <Plus className="w-4 h-4" /> Add Your First Day
      </button>
    </div>
  );
}
