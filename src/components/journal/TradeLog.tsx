import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Settings2,
  Loader2,
  FileText,
  LayoutGrid,
  List,
  Table2,
  Timer,
  Search,
  CalendarDays,
} from "lucide-react";
import {
  computeOutcome,
  deleteTrade,
  fetchTrades,
  newTrade,
  tradesQueryKey,
  upsertTrade,
  type Trade,
} from "@/lib/trades";
import { isWithinInterval, startOfDay, endOfDay, parseISO, format } from "date-fns";
import { DateRangePicker } from "../shared/DateRangePicker";
import { DateRange } from "react-day-picker";
import { onRequestNewTrade, onRequestOpenTrade } from "@/lib/nav-bus";
import { EmptyState } from "@/components/shared/EmptyState";
import { TradeTimelineView } from "./TradeTimelineView";
import { MissedTradeModal } from "./MissedTradeModal";
import {
  fetchMissedTrades,
  missedTradesQueryKey,
  newMissedTrade,
  saveMissedTrade,
  deleteMissedTrade,
  type MissedTrade,
} from "@/lib/missed-trades";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TradeModal } from "./TradeModal";
import { TradeTapeView } from "./TradeTapeView";
import { TradeLedgerView } from "./TradeLedgerView";
import { TradeTicketCard } from "./TradeTicketCard";
import { TradeKillzoneView } from "./TradeKillzoneView";
import { toast } from "sonner";
import { usePlaybook } from "@/hooks/usePlaybook";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { fetchSettings } from "@/lib/settings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  computeFilterPulse,
  formatPnl,
  formatSigned,
  TRADE_LOG_VIEWS,
  type TradeLogView,
} from "@/lib/trade-log";

type ColKey =
  | "entryTime"
  | "stats"
  | "images"
  | "compliance"
  | "playbook"
  | "status"
  | "grade"
  | "outcome"
  | "side"
  | "bias"
  | "analysis";

const COL_LABELS: Record<ColKey, string> = {
  entryTime: "Entry Time",
  stats: "Statistics",
  images: "Images",
  compliance: "Follow Playbook",
  playbook: "Playbook",
  status: "Status",
  grade: "Grade",
  outcome: "Outcome",
  side: "Side",
  bias: "Bias Context",
  analysis: "Analysis",
};

const FILTERS_KEY = "trade-log-filters";
const COLS_KEY = "trade-log-cols-v2";

type SideFilter = "ALL" | "buy" | "sell";
type OutcomeFilter = "ALL" | "Win" | "Loss" | "BE";
type ComplianceFilter = "ALL" | "yes" | "no";

interface PersistedFilters {
  query?: string;
  symbolFilter?: string;
  sideFilter?: SideFilter;
  outcomeFilter?: OutcomeFilter;
  setupFilter?: string;
  complianceFilter?: ComplianceFilter;
  dateFrom?: string;
  dateTo?: string;
}

const DEFAULT_COLS: Record<ColKey, boolean> = {
  entryTime: true,
  stats: true,
  images: true,
  compliance: true,
  playbook: true,
  status: true,
  grade: true,
  outcome: true,
  side: true,
  bias: false,
  analysis: false,
};

function loadFilters(): PersistedFilters {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedFilters;
  } catch {
    return {};
  }
}

function dateRangeFromSaved(saved: PersistedFilters): DateRange | undefined {
  if (!saved.dateFrom) return undefined;
  const from = parseISO(saved.dateFrom);
  const to = saved.dateTo ? parseISO(saved.dateTo) : from;
  if (Number.isNaN(+from)) return undefined;
  return { from, to: Number.isNaN(+to) ? from : to };
}

function loadCols(): Record<ColKey, boolean> {
  try {
    const s = localStorage.getItem(COLS_KEY);
    if (s) return { ...DEFAULT_COLS, ...JSON.parse(s) };
  } catch {
    // A corrupt local preference should fall back to the default columns.
  }
  return { ...DEFAULT_COLS };
}

export function TradeLog() {
  const savedFilters = useMemo(() => loadFilters(), []);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() =>
    dateRangeFromSaved(savedFilters),
  );
  const { models: playbookSetups } = usePlaybook();
  const [editing, setEditing] = useState<Trade | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [symbolFilter, setSymbolFilter] = useState("ALL");
  const [sideFilter, setSideFilter] = useState<SideFilter>("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("ALL");
  const [setupFilter, setSetupFilter] = useState("ALL");
  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilter>("ALL");
  // Each visit starts at Timeline / current week; switching views is local to this visit.
  const [viewMode, setViewMode] = useState<TradeLogView>("timeline");
  const [chooseType, setChooseType] = useState(false);
  const [editingMissed, setEditingMissed] = useState<MissedTrade | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    data: trades = [],
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: tradesQueryKey,
    queryFn: fetchTrades,
  });
  const {
    data: missed = [],
    isLoading: missedLoading,
    error: missedError,
    refetch: retryMissed,
  } = useQuery({
    queryKey: missedTradesQueryKey,
    queryFn: fetchMissedTrades,
  });
  const tradesRef = useRef(trades);
  tradesRef.current = trades;

  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: fetchSettings,
  });

  const [cols, setCols] = useState<Record<ColKey, boolean>>(loadCols);

  useEffect(() => {
    localStorage.setItem(COLS_KEY, JSON.stringify(cols));
  }, [cols]);

  useEffect(() => {
    const payload: PersistedFilters = {
      query,
      symbolFilter,
      sideFilter,
      outcomeFilter,
      setupFilter,
      complianceFilter,
      dateFrom: dateRange?.from ? dateRange.from.toISOString() : undefined,
      dateTo: dateRange?.to ? dateRange.to.toISOString() : undefined,
    };
    localStorage.setItem(FILTERS_KEY, JSON.stringify(payload));
  }, [query, symbolFilter, sideFilter, outcomeFilter, setupFilter, complianceFilter, dateRange]);

  useEffect(() => {
    if (error) toast.error(error instanceof Error ? error.message : "Failed to load");
  }, [error]);

  const handleUpdateView = (view: TradeLogView) => setViewMode(view);
  const saveMissed = async (trade: MissedTrade) => {
    await saveMissedTrade(trade);
    queryClient.setQueryData<MissedTrade[]>(missedTradesQueryKey, (old) => [
      trade,
      ...(old ?? []).filter((t) => t.id !== trade.id),
    ]);
    void queryClient.invalidateQueries({ queryKey: missedTradesQueryKey });
  };
  const removeMissed = async (trade: MissedTrade) => {
    await deleteMissedTrade(trade);
    queryClient.setQueryData<MissedTrade[]>(missedTradesQueryKey, (old) =>
      (old ?? []).filter((t) => t.id !== trade.id),
    );
    void queryClient.invalidateQueries({ queryKey: missedTradesQueryKey });
  };

  const openNew = () => {
    const draft = newTrade();
    const lastSymbol = tradesRef.current[0]?.symbol;
    if (lastSymbol) draft.symbol = lastSymbol;
    setEditing(draft);
    setOpen(true);
  };

  useEffect(() => onRequestNewTrade(() => setChooseType(true)), []);

  useEffect(
    () =>
      onRequestOpenTrade(async (id) => {
        let list = tradesRef.current;
        if (!list.length) {
          try {
            list = await fetchTrades();
            queryClient.setQueryData(tradesQueryKey, list);
          } catch {
            return;
          }
        }
        const t = list.find((x) => x.id === id);
        if (t) {
          setEditing(t);
          setOpen(true);
        }
      }),
    [queryClient],
  );

  const openEdit = (t: Trade) => {
    setEditing(t);
    setOpen(true);
  };

  const save = async (t: Trade) => {
    await upsertTrade(t);
    await queryClient.invalidateQueries({ queryKey: tradesQueryKey });
  };

  const remove = async (id: string) => {
    await deleteTrade(id);
    await queryClient.invalidateQueries({ queryKey: tradesQueryKey });
  };

  const filteredTrades = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trades.filter((t) => {
      if (viewMode !== "timeline" && dateRange?.from) {
        const start = startOfDay(dateRange.from);
        const end = endOfDay(dateRange.to || dateRange.from);
        const entryDate = parseISO(t.entryTime);
        if (!isWithinInterval(entryDate, { start, end })) return false;
      }
      if (symbolFilter !== "ALL" && t.symbol !== symbolFilter) return false;
      if (sideFilter !== "ALL" && t.side !== sideFilter) return false;
      if (setupFilter !== "ALL" && t.setupId !== setupFilter) return false;
      if (complianceFilter === "yes" && !t.complianceCheck) return false;
      if (complianceFilter === "no" && t.complianceCheck) return false;
      if (outcomeFilter !== "ALL") {
        const o = computeOutcome(t.actualRr, t.maxRr, t.netPnl).label;
        if (o !== outcomeFilter) return false;
      }
      if (q) {
        const hay = `${t.symbol} ${t.notes ?? ""} ${t.side}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    trades,
    viewMode,
    dateRange,
    query,
    symbolFilter,
    sideFilter,
    outcomeFilter,
    setupFilter,
    complianceFilter,
  ]);

  const sorted = useMemo(
    () => [...filteredTrades].sort((a, b) => +new Date(b.entryTime) - +new Date(a.entryTime)),
    [filteredTrades],
  );

  const filteredMissed = useMemo(
    () =>
      missed.filter((t) => {
        if (outcomeFilter !== "ALL" || complianceFilter !== "ALL") return false;
        if (symbolFilter !== "ALL" && t.symbol !== symbolFilter) return false;
        if (sideFilter !== "ALL" && t.side !== sideFilter) return false;
        if (setupFilter !== "ALL" && t.setup_id !== setupFilter) return false;
        const q = query.trim().toLowerCase();
        return (
          !q ||
          `${t.symbol} ${t.analysis} ${t.lesson} ${t.side} ${t.reason}`.toLowerCase().includes(q)
        );
      }),
    [missed, outcomeFilter, complianceFilter, symbolFilter, sideFilter, setupFilter, query],
  );

  const symbolsInLog = useMemo(
    () =>
      Array.from(new Set([...trades.map((t) => t.symbol), ...missed.map((t) => t.symbol)])).sort(),
    [trades, missed],
  );
  const pulse = useMemo(() => computeFilterPulse(sorted), [sorted]);
  const playbookName = useCallback(
    (id?: string) => playbookSetups.find((s) => s.id === id)?.name,
    [playbookSetups],
  );

  const filtersActive =
    query.trim() !== "" ||
    symbolFilter !== "ALL" ||
    sideFilter !== "ALL" ||
    outcomeFilter !== "ALL" ||
    setupFilter !== "ALL" ||
    complianceFilter !== "ALL" ||
    (viewMode !== "timeline" && !!dateRange?.from);

  const clearFilters = () => {
    setQuery("");
    setSymbolFilter("ALL");
    setSideFilter("ALL");
    setOutcomeFilter("ALL");
    setSetupFilter("ALL");
    setComplianceFilter("ALL");
    setDateRange(undefined);
  };

  const activeChips: { id: string; label: string; onClear: () => void }[] = [];
  if (query.trim()) {
    activeChips.push({ id: "q", label: query.trim(), onClear: () => setQuery("") });
  }
  if (symbolFilter !== "ALL") {
    activeChips.push({ id: "sym", label: symbolFilter, onClear: () => setSymbolFilter("ALL") });
  }
  if (setupFilter !== "ALL") {
    activeChips.push({
      id: "model",
      label: playbookName(setupFilter) ?? "Model",
      onClear: () => setSetupFilter("ALL"),
    });
  }
  if (sideFilter !== "ALL") {
    activeChips.push({
      id: "side",
      label: sideFilter,
      onClear: () => setSideFilter("ALL"),
    });
  }
  if (outcomeFilter !== "ALL") {
    activeChips.push({
      id: "out",
      label: outcomeFilter,
      onClear: () => setOutcomeFilter("ALL"),
    });
  }
  if (complianceFilter !== "ALL") {
    activeChips.push({
      id: "pb",
      label: complianceFilter === "yes" ? "Followed" : "Broke",
      onClear: () => setComplianceFilter("ALL"),
    });
  }
  if (viewMode !== "timeline" && dateRange?.from) {
    const from = format(dateRange.from, "d MMM");
    const to = dateRange.to ? format(dateRange.to, "d MMM") : from;
    activeChips.push({
      id: "date",
      label: from === to ? from : `${from} – ${to}`,
      onClear: () => setDateRange(undefined),
    });
  }

  const ticketGroups = useMemo(() => {
    const map = new Map<string, { name: string; pnl: number; rows: Trade[] }>();
    const seen = new Set<string>();
    for (const t of sorted) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      const name = playbookName(t.setupId) ?? "Unassigned";
      const g = map.get(name) ?? { name, pnl: 0, rows: [] };
      g.pnl += t.netPnl;
      g.rows.push(t);
      map.set(name, g);
    }
    return Array.from(map.values());
  }, [sorted, playbookName]);

  const viewIcon = (id: TradeLogView) => {
    if (id === "timeline") return CalendarDays;
    if (id === "tape") return List;
    if (id === "ledger") return Table2;
    if (id === "tickets") return LayoutGrid;
    return Timer;
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-10">
      <div className="max-w-[1500px] mx-auto space-y-4 lg:space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
                Trade Log
              </h1>
              <p className="text-[10px] lg:text-xs text-muted-foreground font-semibold uppercase tracking-widest">
                {viewMode === "timeline" ? "Daily timeline · UTC+7" : "NY blotter"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center bg-muted/50 p-1 rounded-xl border border-border/50">
              {TRADE_LOG_VIEWS.map((v) => {
                const Icon = viewIcon(v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleUpdateView(v.id)}
                    aria-label={v.label}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                      viewMode === v.id
                        ? "bg-card text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 sm:hidden" />
                    <span>{v.label}</span>
                  </button>
                );
              })}
            </div>
            {viewMode === "ledger" && (
              <DropdownMenu>
                <DropdownMenuTrigger className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-xl border border-border bg-card text-[11px] font-bold text-muted-foreground hover:text-foreground">
                  <Settings2 className="w-4 h-4" /> Columns
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-card border-border text-foreground rounded-xl shadow-xl">
                  <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-3 py-2">
                    Toggle Columns
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(Object.keys(COL_LABELS) as ColKey[])
                    .filter((k) => k !== "grade" || settings?.showTradeGrade)
                    .map((k) => (
                      <DropdownMenuCheckboxItem
                        key={k}
                        checked={cols[k]}
                        onCheckedChange={(v) => setCols((c) => ({ ...c, [k]: !!v }))}
                        onSelect={(e) => e.preventDefault()}
                        className="font-medium"
                      >
                        {COL_LABELS[k]}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <button
              type="button"
              onClick={() => setChooseType(true)}
              aria-label="New trade"
              className="lg:hidden forest-gradient flex items-center justify-center w-10 h-10 text-white rounded-xl shadow-lg active:scale-95"
            >
              <Plus className="w-6 h-6" strokeWidth={3} />
            </button>
            <button
              type="button"
              onClick={() => setChooseType(true)}
              className="hidden lg:flex forest-gradient items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg hover:opacity-90 active:scale-95"
            >
              <Plus className="w-5 h-5" /> New trade
            </button>
          </div>
        </div>

        <div className="flex sm:hidden items-center bg-muted/50 p-1 rounded-xl border border-border/50 overflow-x-auto hide-scrollbar">
          {TRADE_LOG_VIEWS.map((v) => {
            const Icon = viewIcon(v.id);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => handleUpdateView(v.id)}
                aria-label={v.label}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap ${
                  viewMode === v.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {v.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Symbol or notes"
              className="h-10 w-full rounded-xl border border-border bg-card pl-8 pr-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger className="sm:hidden h-10 px-3 rounded-xl border border-border bg-card text-[11px] font-black uppercase tracking-wider">
              Filters
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {viewMode !== "timeline" && (
                  <DateRangePicker date={dateRange} setDate={setDateRange} className="w-full" />
                )}
                <div className="flex flex-wrap gap-2">
                  <FilterControls
                    symbolsInLog={symbolsInLog}
                    playbookSetups={playbookSetups}
                    symbolFilter={symbolFilter}
                    setupFilter={setupFilter}
                    sideFilter={sideFilter}
                    outcomeFilter={outcomeFilter}
                    complianceFilter={complianceFilter}
                    setSymbolFilter={setSymbolFilter}
                    setSetupFilter={setSetupFilter}
                    setSideFilter={setSideFilter}
                    setOutcomeFilter={setOutcomeFilter}
                    setComplianceFilter={setComplianceFilter}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="hidden sm:flex flex-wrap items-center gap-2">
          {viewMode !== "timeline" && (
            <DateRangePicker date={dateRange} setDate={setDateRange} className="w-auto" />
          )}
          <FilterControls
            symbolsInLog={symbolsInLog}
            playbookSetups={playbookSetups}
            symbolFilter={symbolFilter}
            setupFilter={setupFilter}
            sideFilter={sideFilter}
            outcomeFilter={outcomeFilter}
            complianceFilter={complianceFilter}
            setSymbolFilter={setSymbolFilter}
            setSetupFilter={setSetupFilter}
            setSideFilter={setSideFilter}
            setOutcomeFilter={setOutcomeFilter}
            setComplianceFilter={setComplianceFilter}
          />
        </div>

        {(activeChips.length > 0 || filtersActive) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeChips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={c.onClear}
                className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border bg-primary text-white border-primary"
              >
                {c.label} ×
              </button>
            ))}
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[10px] font-black uppercase tracking-wider text-destructive underline underline-offset-2"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {viewMode !== "timeline" && sorted.length > 0 && (
          <div className="flex overflow-hidden rounded-xl border border-border bg-card">
            <PulseCell label="Trades" value={String(pulse.count)} />
            <PulseCell
              label="Net"
              value={formatSigned(pulse.pnl)}
              tone={pulse.pnl > 0 ? "up" : pulse.pnl < 0 ? "down" : undefined}
            />
            <PulseCell label="Win" value={`${pulse.winRate.toFixed(0)}%`} />
            <PulseCell
              label="Avg R"
              value={`${formatSigned(pulse.avgR, 1)}R`}
              className="hidden lg:block"
            />
            <PulseCell
              label="Playbook"
              value={`${pulse.followed}/${pulse.count}`}
              className="hidden lg:block"
            />
          </div>
        )}

        {viewMode === "timeline" && missedError && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 p-4 text-xs text-destructive"
          >
            <span>
              Không tải được trade miss. Lệnh thật vẫn hiển thị; số tổng kết miss chưa đầy đủ.
            </span>
            <button type="button" onClick={() => void retryMissed()} className="underline">
              Thử lại
            </button>
          </div>
        )}
        <div className="w-full">
          {loading || (viewMode === "timeline" && missedLoading) ? (
            <div className="p-20 text-center bg-card rounded-3xl border border-border/50">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            </div>
          ) : viewMode === "timeline" ? (
            <TradeTimelineView
              trades={sorted}
              missed={filteredMissed}
              playbookName={playbookName}
              onOpen={openEdit}
              onOpenMissed={setEditingMissed}
            />
          ) : trades.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Your trade log is empty"
              description="Log your first execution with R, playbook, and screenshots."
              actionLabel="Add first trade"
              onAction={openNew}
            />
          ) : sorted.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No trades match these filters"
              description="Widen the date range or clear symbol, side, and outcome chips."
              actionLabel="Clear filters"
              onAction={clearFilters}
            />
          ) : viewMode === "tape" ? (
            <TradeTapeView
              trades={sorted}
              playbookName={playbookName}
              showGrade={settings?.showTradeGrade}
              onOpen={openEdit}
            />
          ) : viewMode === "tickets" ? (
            <div className="space-y-8">
              {ticketGroups.map((g) => (
                <section key={g.name}>
                  <div className="flex items-baseline justify-between mb-3">
                    <h3 className="text-sm font-black tracking-tight">{g.name}</h3>
                    <p
                      className={`tabular-nums text-[11px] font-bold ${
                        g.pnl > 0
                          ? "text-primary"
                          : g.pnl < 0
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }`}
                    >
                      {g.rows.length} {g.rows.length === 1 ? "trade" : "trades"} ·{" "}
                      {formatPnl(g.pnl)}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {g.rows.map((t) => (
                      <TradeTicketCard
                        key={t.id}
                        trade={t}
                        playbookName={playbookName(t.setupId)}
                        onClick={() => openEdit(t)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : viewMode === "killzone" ? (
            <TradeKillzoneView trades={sorted} onOpen={openEdit} />
          ) : (
            <TradeLedgerView
              trades={sorted}
              cols={cols}
              showGrade={settings?.showTradeGrade}
              playbookName={playbookName}
              executionSchema={settings?.executionSchema}
              onOpen={openEdit}
            />
          )}
        </div>
      </div>

      <Dialog open={chooseType} onOpenChange={setChooseType}>
        <DialogContent className="w-[calc(100%-24px)] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Bạn muốn ghi loại trade nào?</DialogTitle>
            <DialogDescription>Chọn loại để mở đúng form phân tích.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={() => {
                setChooseType(false);
                openNew();
              }}
            >
              Đã vào lệnh
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setChooseType(false);
                setEditingMissed(newMissedTrade());
              }}
            >
              Bị miss
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <MissedTradeModal
        trade={editingMissed}
        onClose={() => setEditingMissed(null)}
        onSave={saveMissed}
        onDelete={
          editingMissed && missed.some((t) => t.id === editingMissed.id) ? removeMissed : undefined
        }
      />
      <TradeModal
        open={open}
        trade={editing}
        onClose={() => setOpen(false)}
        onSave={save}
        onDelete={editing && trades.find((x) => x.id === editing.id) ? remove : undefined}
      />
    </div>
  );
}

function PulseCell({
  label,
  value,
  tone,
  className = "",
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
  className?: string;
}) {
  return (
    <div className={`px-3 py-2 border-l border-border first:border-l-0 min-w-0 ${className}`}>
      <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={`tabular-nums text-base font-bold ${
          tone === "up" ? "text-primary" : tone === "down" ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function FilterSeg<T extends string>({
  value,
  all,
  options,
  onChange,
}: {
  value: T;
  all: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-[10px] border border-border bg-card">
      {options.map((o, i) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(value === o.id ? all : o.id)}
          className={`px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider ${
            i ? "border-l border-border" : ""
          } ${value === o.id ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FilterControls({
  symbolsInLog,
  playbookSetups,
  symbolFilter,
  setupFilter,
  sideFilter,
  outcomeFilter,
  complianceFilter,
  setSymbolFilter,
  setSetupFilter,
  setSideFilter,
  setOutcomeFilter,
  setComplianceFilter,
}: {
  symbolsInLog: string[];
  playbookSetups: { id: string; name: string }[];
  symbolFilter: string;
  setupFilter: string;
  sideFilter: SideFilter;
  outcomeFilter: OutcomeFilter;
  complianceFilter: ComplianceFilter;
  setSymbolFilter: (v: string) => void;
  setSetupFilter: (v: string) => void;
  setSideFilter: (v: SideFilter) => void;
  setOutcomeFilter: (v: OutcomeFilter) => void;
  setComplianceFilter: (v: ComplianceFilter) => void;
}) {
  return (
    <>
      <FilterSeg
        value={sideFilter}
        all="ALL"
        onChange={setSideFilter}
        options={[
          { id: "buy", label: "Buy" },
          { id: "sell", label: "Sell" },
        ]}
      />
      <FilterSeg
        value={outcomeFilter}
        all="ALL"
        onChange={setOutcomeFilter}
        options={[
          { id: "Win", label: "Win" },
          { id: "Loss", label: "Loss" },
          { id: "BE", label: "BE" },
        ]}
      />
      <FilterSeg
        value={complianceFilter}
        all="ALL"
        onChange={setComplianceFilter}
        options={[
          { id: "yes", label: "Followed" },
          { id: "no", label: "Broke" },
        ]}
      />
      <select
        value={symbolFilter}
        onChange={(e) => setSymbolFilter(e.target.value)}
        className="h-9 rounded-xl border border-border bg-card px-3 text-[11px] font-bold text-muted-foreground"
      >
        <option value="ALL">All symbols</option>
        {symbolsInLog.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        value={setupFilter}
        onChange={(e) => setSetupFilter(e.target.value)}
        className="h-9 rounded-xl border border-border bg-card px-3 text-[11px] font-bold text-muted-foreground"
      >
        <option value="ALL">All models</option>
        {playbookSetups.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </>
  );
}
