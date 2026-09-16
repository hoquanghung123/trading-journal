import { useEffect, useMemo, useRef, useState } from "react";
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
import { isWithinInterval, startOfDay, endOfDay, parseISO } from "date-fns";
import { DateRangePicker } from "../shared/DateRangePicker";
import { DateRange } from "react-day-picker";
import { onRequestNewTrade, onRequestOpenTrade } from "@/lib/nav-bus";
import { EmptyState } from "@/components/shared/EmptyState";
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
import { fetchSettings, updateSettings } from "@/lib/settings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  computeFilterPulse,
  formatSigned,
  normalizeTradeLogView,
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
const COLS_KEY = "trade-log-cols";

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
  bias: true,
  analysis: true,
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
  } catch {}
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
  const [query, setQuery] = useState(savedFilters.query ?? "");
  const [symbolFilter, setSymbolFilter] = useState(savedFilters.symbolFilter ?? "ALL");
  const [sideFilter, setSideFilter] = useState<SideFilter>(savedFilters.sideFilter ?? "ALL");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>(
    savedFilters.outcomeFilter ?? "ALL",
  );
  const [setupFilter, setSetupFilter] = useState(savedFilters.setupFilter ?? "ALL");
  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilter>(
    savedFilters.complianceFilter ?? "ALL",
  );
  const [viewOverride, setViewOverride] = useState<TradeLogView | null>(null);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const { data: trades = [], isLoading: loading, error } = useQuery({
    queryKey: tradesQueryKey,
    queryFn: fetchTrades,
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

  const handleUpdateView = async (view: TradeLogView) => {
    setViewOverride(view);
    await updateSettings({ tradeLogView: view });
    queryClient.invalidateQueries({ queryKey: ["user_settings"] });
  };

  const openNew = () => {
    setEditing(newTrade());
    setOpen(true);
  };

  useEffect(() => onRequestNewTrade(openNew), []);

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
      if (dateRange?.from) {
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

  const savedView = normalizeTradeLogView(settings?.tradeLogView);
  const viewMode = viewOverride ?? (settings ? savedView : isMobile ? "tickets" : "ledger");

  const symbolsInLog = useMemo(
    () => Array.from(new Set(trades.map((t) => t.symbol))).sort(),
    [trades],
  );
  const pulse = useMemo(() => computeFilterPulse(sorted), [sorted]);
  const playbookName = (id?: string) => playbookSetups.find((s) => s.id === id)?.name;

  const filtersActive =
    query.trim() !== "" ||
    symbolFilter !== "ALL" ||
    sideFilter !== "ALL" ||
    outcomeFilter !== "ALL" ||
    setupFilter !== "ALL" ||
    complianceFilter !== "ALL" ||
    !!dateRange?.from;

  const clearFilters = () => {
    setQuery("");
    setSymbolFilter("ALL");
    setSideFilter("ALL");
    setOutcomeFilter("ALL");
    setSetupFilter("ALL");
    setComplianceFilter("ALL");
    setDateRange(undefined);
  };

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-[10px] font-bold border whitespace-nowrap ${
      active
        ? "bg-primary text-white border-primary"
        : "border-border bg-card text-muted-foreground hover:text-foreground"
    }`;

  const ticketGroups = useMemo(() => {
    const map = new Map<string, { name: string; pnl: number; rows: Trade[] }>();
    for (const t of sorted) {
      const key = t.setupId ?? "none";
      const name = playbookName(t.setupId) ?? "Unassigned";
      const g = map.get(key) ?? { name, pnl: 0, rows: [] };
      g.pnl += t.netPnl;
      g.rows.push(t);
      map.set(key, g);
    }
    return Array.from(map.values());
  }, [sorted, playbookSetups]);

  const viewIcon = (id: TradeLogView) => {
    if (id === "tape") return List;
    if (id === "ledger") return Table2;
    if (id === "tickets") return LayoutGrid;
    return Timer;
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-10">
      <div className="max-w-[1500px] mx-auto space-y-6 lg:space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-border pb-6 lg:pb-8 gap-6">
          <div className="flex items-center justify-between w-full lg:w-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
                  Trade Log
                </h1>
                <p className="text-[10px] lg:text-sm text-muted-foreground font-medium uppercase tracking-wider">
                  {filteredTrades.length} recorded entries
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openNew}
              aria-label="New trade"
              className="lg:hidden forest-gradient flex items-center justify-center w-10 h-10 text-white rounded-xl shadow-lg active:scale-95 transition-all"
            >
              <Plus className="w-6 h-6" strokeWidth={3} />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 overflow-x-auto hide-scrollbar pb-1 lg:pb-0">
            <DateRangePicker date={dateRange} setDate={setDateRange} className="w-full sm:w-auto" />

            <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border/50 shrink-0">
              {TRADE_LOG_VIEWS.map((v) => {
                const Icon = viewIcon(v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleUpdateView(v.id)}
                    className={`p-2 rounded-lg transition-all ${
                      viewMode === v.id
                        ? "bg-card text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title={v.label}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-xs lg:text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-sm whitespace-nowrap">
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

            <button
              type="button"
              onClick={openNew}
              className="hidden lg:flex forest-gradient items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg hover:opacity-90 transition-all active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-5 h-5" /> New Trade
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes or symbol"
              className="h-9 w-44 sm:w-56 rounded-lg border border-border bg-card pl-8 pr-3 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-3 text-xs font-bold"
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
            className="h-9 rounded-lg border border-border bg-card px-3 text-xs font-bold"
          >
            <option value="ALL">All models</option>
            {playbookSetups.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {(["ALL", "buy", "sell"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSideFilter(s)} className={chip(sideFilter === s)}>
              {s === "ALL" ? "Side" : s}
            </button>
          ))}
          {(["ALL", "Win", "Loss", "BE"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setOutcomeFilter(s)}
              className={chip(outcomeFilter === s)}
            >
              {s === "ALL" ? "Outcome" : s}
            </button>
          ))}
          {(["ALL", "yes", "no"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setComplianceFilter(s)}
              className={chip(complianceFilter === s)}
            >
              {s === "ALL" ? "Playbook" : s === "yes" ? "Followed" : "Broke"}
            </button>
          ))}
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[10px] font-black uppercase tracking-wider text-destructive underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
        </div>

        {sorted.length > 0 && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-3 py-1.5 border-b border-border flex items-center justify-between">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                Pulse of current filter
              </p>
            </div>
            <div className="grid grid-cols-3 lg:grid-cols-5">
              <PulseCell label="Trades" value={String(pulse.count)} />
              <PulseCell
                label="Net PnL"
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
          </div>
        )}

        <div className="w-full">
          {loading ? (
            <div className="p-20 text-center bg-card rounded-3xl border border-border/50">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            </div>
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
                    <p className="font-mono tabular-nums text-[11px] font-bold text-primary">
                      {g.rows.length} trades · {formatSigned(g.pnl)}
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
              executionSchema={settings?.executionSchema as any[]}
              onOpen={openEdit}
            />
          )}
        </div>
      </div>

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
    <div className={`px-4 py-3 relative after:absolute after:right-0 after:top-2 after:bottom-2 after:w-px after:bg-border last:after:hidden ${className}`}>
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p
        className={`font-mono tabular-nums text-xl font-bold ${
          tone === "up" ? "text-primary" : tone === "down" ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
