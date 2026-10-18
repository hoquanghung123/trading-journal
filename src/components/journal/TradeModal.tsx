import { toNyLocal, nyLocalToIso } from "@/lib/trade-time";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeOutcome, outcomeStyle, type Trade } from "@/lib/trades";
import { useSymbols } from "@/lib/symbols";
import { fetchEntries, type DayEntry, ddmm, journalTradingDate } from "@/lib/journal";
import { PasteSlot } from "./PasteSlot";
import {
  ExternalLink,
  Trash2,
  Save,
  FileText,
  AlertCircle,
  X,
  TrendingUp,
  Activity,
  Image as ImageIcon,
  Sliders,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { AnalysisTab } from "./AnalysisTab";
import { focusBiasEntry, navigateToPage } from "@/lib/nav-bus";
import { usePlaybook } from "@/hooks/usePlaybook";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchSettings, updateSettings } from "@/lib/settings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAchievementTracker } from "@/hooks/useAchievementTracker";
import { RichEditor } from "@/components/ui/rich-editor";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  trade: Trade | null;
  onClose: () => void;
  onSave: (t: Trade) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

type TabID = "execution" | "analysis" | "performance" | "screenshots" | "journal";

export function TradeModal({ open, trade, onClose, onSave, onDelete }: Props) {
  const [t, setT] = useState<Trade | null>(trade);
  const [activeTab, setActiveTab] = useState<TabID>("execution");
  const [focused, setFocused] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [biasEntries, setBiasEntries] = useState<DayEntry[]>([]);
  const { data: symbols = [] } = useSymbols();
  const { models: playbookSetups } = usePlaybook();
  const { track } = useAchievementTracker();
  const queryClient = useQueryClient();
  const SYMBOLS = useMemo(() => symbols.map((s) => s.name), [symbols]);

  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: fetchSettings,
  });

  useEffect(() => {
    if (!trade) {
      setT(null);
      return;
    }

    // If new trade or invalid symbol, default to first available symbol
    if (symbols.length > 0 && (!trade.symbol || !SYMBOLS.includes(trade.symbol))) {
      setT({ ...trade, symbol: symbols[0].name });
    } else {
      setT(trade);
    }
  }, [trade, symbols, SYMBOLS]);

  useEffect(() => {
    if (!open) return;
    setActiveTab("execution");
    setFocused(null);
  }, [open, trade?.id]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [activeTab, open, trade?.id]);

  useEffect(() => {
    if (!open) return;
    fetchEntries()
      .then(setBiasEntries)
      .catch(() => {});
  }, [open]);

  const tradeJournalDate = t?.entryTime ? journalTradingDate(t.entryTime) : journalTradingDate();

  const filteredBias = useMemo(
    () =>
      biasEntries
        .filter((e) => {
          const isSameDay = e.date === tradeJournalDate;
          const isMatchingSymbol = !t?.symbol || e.asset === t.symbol;
          return isSameDay && isMatchingSymbol;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [biasEntries, t?.symbol, tradeJournalDate],
  );

  const update = (patch: Partial<Trade>) => {
    setT((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if ("grossPnl" in patch || "fees" in patch) {
        next.netPnl = Number((next.grossPnl - next.fees).toFixed(2));
      }
      return next;
    });
  };

  const isForexPair = useMemo(() => {
    const sym = symbols.find((s) => s.name === t?.symbol);
    return sym?.isForex ?? false;
  }, [symbols, t?.symbol]);

  if (!t) return null;

  const outcome = computeOutcome(t.actualRr, t.maxRr, t.netPnl);
  const hasResult = t.actualRr !== 0 || t.netPnl !== 0;
  const headerBadge =
    t.status !== "Closed" && !hasResult
      ? {
          label: t.status === "Not Started" ? "Draft" : "Opened",
          className:
            t.status === "Not Started"
              ? "bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground shadow-primary/20",
        }
      : { label: outcome.label, className: outcomeStyle[outcome.color] };

  const dtLocal = toNyLocal(t.entryTime);
  const exitDtLocal = t.exitTime ? toNyLocal(t.exitTime) : "";

  const save = async () => {
    setBusy(true);
    try {
      await onSave(t);
      if (t.status !== "Not Started") {
        await track(t);
      }
      toast.success("Trade saved");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!onDelete) return;
    setBusy(true);
    try {
      await onDelete(t.id);
      toast.success("Trade deleted");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-full h-full sm:h-auto sm:max-w-5xl max-h-[100vh] sm:max-h-[96vh] p-0 gap-0 bg-card border-white/20 text-foreground flex flex-col overflow-hidden rounded-none sm:rounded-[48px] shadow-2xl animate-in fade-in zoom-in-95 duration-300 left-0 top-0 translate-x-0 translate-y-0 sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] [&>button]:right-5 [&>button]:top-6 sm:[&>button]:right-8">
        <DialogHeader className="px-6 sm:px-10 pr-14 sm:pr-16 py-6 border-b border-border/50 bg-card sm:rounded-t-[48px]">
          <div className="flex items-center gap-3 min-w-0">
            <DialogTitle className="text-xl font-black uppercase tracking-tighter text-foreground flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg forest-gradient flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <span className="truncate">Trade Execution</span>
            </DialogTitle>
            <span
              className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${headerBadge.className}`}
            >
              {headerBadge.label}
            </span>
          </div>
        </DialogHeader>

        <div className="px-6 sm:px-10 py-3 border-b border-border/50">
          <div className="flex items-center bg-muted/50 p-1 rounded-2xl border border-border/50 overflow-x-auto hide-scrollbar">
            {(
              [
                { id: "execution", label: "Execution", icon: Activity },
                { id: "analysis", label: "Analysis", icon: Sliders },
                { id: "performance", label: "Performance", icon: TrendingUp },
                { id: "screenshots", label: "Screenshots", icon: ImageIcon },
                { id: "journal", label: "Journal", icon: FileText },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 min-w-[6.5rem] px-2.5 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5 shrink-0" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={bodyRef}
          className="flex-1 overflow-y-auto px-6 sm:px-10 py-6 sm:py-8 space-y-8 sm:space-y-10 hide-scrollbar"
        >
          {/* Tab: Execution */}
          {activeTab === "execution" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <SectionHeader title="Entry & Asset" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                <Field label="Entry time (NY)">
                  <Input
                    type="datetime-local"
                    value={dtLocal}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      try {
                        update({ entryTime: nyLocalToIso(v) });
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Ngày giờ không hợp lệ.",
                        );
                      }
                    }}
                    className="h-12 bg-muted/30 border-border rounded-xl font-bold px-4 focus:ring-primary/20"
                  />
                </Field>
                <Field label="Exit time (NY)">
                  <Input
                    type="datetime-local"
                    value={exitDtLocal}
                    onChange={(e) => {
                      const v = e.target.value;
                      try {
                        update({ exitTime: v ? nyLocalToIso(v) : undefined });
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Ngày giờ không hợp lệ.",
                        );
                      }
                    }}
                    className="h-12 bg-muted/30 border-border rounded-xl font-bold px-4 focus:ring-primary/20"
                  />
                </Field>
                <Field label="Symbol / Asset">
                  <SelectField value={t.symbol} onChange={(v) => update({ symbol: v })}>
                    {SYMBOLS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </SelectField>
                </Field>
                <Field label="Trade Status">
                  <div className="flex gap-2">
                    {(["Not Started", "Opened", "Closed"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          update({
                            status: s,
                            ...(s === "Closed" && !t.exitTime
                              ? { exitTime: new Date().toISOString() }
                              : {}),
                          })
                        }
                        className={`flex-1 h-12 rounded-xl border-2 text-[9px] font-black tracking-widest uppercase transition-all shadow-sm ${
                          t.status === s
                            ? s === "Not Started"
                              ? "bg-muted text-muted-foreground border-border scale-[1.02]"
                              : s === "Opened"
                                ? "bg-primary text-primary-foreground border-primary shadow-primary/20 scale-[1.02]"
                                : "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-300 scale-[1.02]"
                            : "bg-background border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {s === "Not Started" ? "Draft" : s}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {settings?.showTradeGrade && (
                <Field label="Trade Grade">
                  <div className="flex gap-2">
                    {(["A+", "A", "B"] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => update({ grade: g })}
                        className={`flex-1 h-12 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${
                          t.grade === g
                            ? g === "A+"
                              ? "bg-primary text-primary-foreground border-primary shadow-primary/20 scale-[1.02]"
                              : g === "A"
                                ? "bg-warning text-white border-warning shadow-warning/20 scale-[1.02]"
                                : "bg-destructive text-destructive-foreground border-destructive shadow-destructive/20 scale-[1.02]"
                            : "bg-background border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => update({ grade: undefined })}
                      className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all ${
                        !t.grade
                          ? "bg-muted/50 border-muted-foreground/20 text-muted-foreground"
                          : "bg-background border-border text-muted-foreground/30 hover:border-destructive/30 hover:text-destructive"
                      }`}
                      title="Clear Grade"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </Field>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                <Field label="Execution Side">
                  <div className="flex gap-4">
                    {(["buy", "sell"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => update({ side: s })}
                        className={`flex-1 h-12 rounded-xl border-2 text-[10px] font-black tracking-widest uppercase transition-all shadow-sm ${
                          t.side === s
                            ? s === "buy"
                              ? "bg-primary text-white border-primary shadow-primary/20 scale-[1.02]"
                              : "bg-destructive text-white border-destructive shadow-destructive/20 scale-[1.02]"
                            : "bg-background border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label={`Context: Bias entry (${t.symbol})`}>
                  <div className="flex gap-2">
                    <SelectField
                      className="flex-1"
                      value={t.biasEntryId ?? ""}
                      onChange={(v) => update({ biasEntryId: v || undefined })}
                    >
                      <option value="">— Link to Bias entry —</option>
                      {filteredBias.map((b) => (
                        <option key={b.id} value={b.id}>
                          {ddmm(b.date)} — {b.dailyBias.toUpperCase()}
                        </option>
                      ))}
                      {filteredBias.length === 0 && (
                        <option value="" disabled>
                          No {t.symbol} bias on {ddmm(tradeJournalDate)}
                        </option>
                      )}
                    </SelectField>
                    {t.biasEntryId && (
                      <button
                        type="button"
                        onClick={() => {
                          navigateToPage("bias");
                          setTimeout(() => focusBiasEntry(t.biasEntryId!, t.symbol), 50);
                          onClose();
                        }}
                        className="h-12 w-12 flex items-center justify-center rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all border border-primary/20"
                        title="Go to Bias entry"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </Field>
                <Field label="Setup / Strategy">
                  <SelectField
                    value={t.setupId ?? ""}
                    onChange={(v) =>
                      update({
                        setupId: v || undefined,
                        missedConfluences: [],
                      })
                    }
                  >
                    <option value="">— Select Setup —</option>
                    {playbookSetups.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.timeframe})
                      </option>
                    ))}
                    {playbookSetups.length === 0 && (
                      <option value="" disabled>
                        No strategies in Playbook
                      </option>
                    )}
                  </SelectField>
                </Field>
                <div className="flex flex-col justify-end">
                  <div className="flex items-center gap-3 bg-primary/5 px-6 h-12 rounded-xl border border-primary/10 transition-all hover:bg-primary/10 w-full mb-1">
                    <Checkbox
                      id="compliance"
                      checked={t.complianceCheck}
                      onCheckedChange={(v) => {
                        const checked = !!v;
                        update({
                          complianceCheck: checked,
                          missedConfluences: checked ? [] : t.missedConfluences,
                        });
                      }}
                      className="w-5 h-5 border-2 border-primary data-[state=checked]:bg-primary"
                    />
                    <label
                      htmlFor="compliance"
                      className="text-[10px] font-black uppercase tracking-widest text-primary cursor-pointer select-none"
                    >
                      Follow Playbook
                    </label>
                  </div>
                </div>
              </div>

              {/* Điều kiện setup chưa đáp ứng Checklist */}
              {!t.complianceCheck && t.setupId && (
                <div className="bg-destructive/5 border border-destructive/10 rounded-[32px] p-8 space-y-6 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-destructive/20 flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-destructive uppercase tracking-widest">
                        Điều kiện setup chưa đáp ứng
                      </h4>
                      <p className="text-[10px] font-bold text-destructive uppercase tracking-widest mt-0.5">
                        Specify what rules were not followed in this execution
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {(() => {
                      const setup = playbookSetups.find((s) => s.id === t.setupId);
                      if (!setup) return null;

                      const confluences = setup.setupConfluences;
                      const order = setup.confluenceOrder || Object.keys(confluences || {});
                      const flatConfluences = confluences
                        ? order.flatMap((key) => confluences[key] || [])
                        : [];

                      if (flatConfluences.length === 0) {
                        return (
                          <p className="col-span-2 text-xs font-medium text-muted-foreground italic p-4 text-center">
                            No confluences defined for this playbook.
                          </p>
                        );
                      }

                      return flatConfluences.map((c) => {
                        const isMissed = t.missedConfluences?.includes(c);
                        return (
                          <div
                            key={c}
                            onClick={() => {
                              const current = t.missedConfluences ?? [];
                              const next = isMissed
                                ? current.filter((x) => x !== c)
                                : [...current, c];
                              update({ missedConfluences: next });
                            }}
                            className={`flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                              isMissed
                                ? "bg-destructive/10 border-destructive/30 text-destructive shadow-sm"
                                : "bg-background border hover:border-destructive/20"
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                isMissed
                                  ? "bg-destructive border-destructive"
                                  : "bg-background border-muted"
                              }`}
                            >
                              {isMissed && (
                                <div className="w-2 h-2 rounded-full bg-white animate-in zoom-in duration-200" />
                              )}
                            </div>
                            <span
                              className={`text-xs font-bold ${isMissed ? "text-destructive" : "text-muted-foreground"}`}
                            >
                              {c}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Analysis */}
          {activeTab === "analysis" &&
            (settings ? (
              <AnalysisTab
                trade={t}
                settings={settings}
                onUpdate={update}
                onRefreshSettings={() =>
                  queryClient.invalidateQueries({ queryKey: ["user_settings"] })
                }
              />
            ) : (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ))}

          {/* Tab: Performance */}
          {activeTab === "performance" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <SectionHeader title="Financial Performance" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <Field label="Gross PnL">
                  <NumberField value={t.grossPnl} onChange={(n) => update({ grossPnl: n })} />
                </Field>
                <Field label="Fees / Commissions">
                  <NumberField value={t.fees} onChange={(n) => update({ fees: n })} />
                </Field>
                <Field label="Net PnL (Calculated)">
                  <div
                    className={`h-12 w-full rounded-xl flex items-center px-4 text-sm font-black border transition-all ${t.netPnl > 0 ? "bg-primary/10 border-primary/20 text-bull" : t.netPnl < 0 ? "bg-destructive/10 border-destructive/20 text-destructive" : "bg-muted/30 border-border"}`}
                  >
                    {t.netPnl > 0 ? "+" : ""}
                    {t.netPnl.toFixed(2)}
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                <Field label="Actual RR Achieved">
                  <NumberField value={t.actualRr} onChange={(n) => update({ actualRr: n })} />
                </Field>
                <Field label="Max RR Reached (Potential)">
                  <NumberField value={t.maxRr} onChange={(n) => update({ maxRr: n })} />
                </Field>
                <Field label="Risk % of Account">
                  <NumberField
                    value={t.riskPercent || 0}
                    onChange={(n) => update({ riskPercent: n })}
                    placeholder="e.g. 0.5"
                  />
                </Field>
              </div>
            </div>
          )}

          {/* Tab: Screenshots */}
          {activeTab === "screenshots" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="space-y-6">
                <SectionHeader title="Core Evidence" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                  <PasteSlot
                    label="BEFORE ENTRY"
                    image={t.beforeImg}
                    onChange={(p) => update({ beforeImg: p })}
                    focused={focused === "before"}
                    onFocus={() => setFocused("before")}
                    className="h-48 sm:h-64"
                    showChartActions
                    showPasteTarget
                  />
                  <PasteSlot
                    label="AFTER EXIT"
                    image={t.afterImg}
                    onChange={(p) => update({ afterImg: p })}
                    focused={focused === "after"}
                    onFocus={() => setFocused("after")}
                    className="h-48 sm:h-64"
                    showChartActions
                    showPasteTarget
                  />
                </div>
              </div>

              <div className="space-y-6">
                <SectionHeader
                  title={isForexPair ? "Multi-Timeframe Analysis (Forex)" : "Technical Analysis"}
                />
                {isForexPair ? (
                  <div className="space-y-6">
                    {/* Row 1: Monthly, Weekly, Daily */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                      <PasteSlot
                        label="MONTHLY"
                        image={t.monthlyImg}
                        onChange={(p) => update({ monthlyImg: p })}
                        focused={focused === "monthly"}
                        onFocus={() => setFocused("monthly")}
                        className="h-44"
                        showChartActions
                        showPasteTarget
                      />
                      <PasteSlot
                        label="WEEKLY"
                        image={t.weeklyImg}
                        onChange={(p) => update({ weeklyImg: p })}
                        focused={focused === "weekly"}
                        onFocus={() => setFocused("weekly")}
                        className="h-44"
                        showChartActions
                        showPasteTarget
                      />
                      <PasteSlot
                        label="DAILY"
                        image={t.dailyImg}
                        onChange={(p) => update({ dailyImg: p })}
                        focused={focused === "daily"}
                        onFocus={() => setFocused("daily")}
                        className="h-44"
                        showChartActions
                        showPasteTarget
                      />
                    </div>
                    {/* Row 2: H4, H1, M15 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                      <PasteSlot
                        label="H4"
                        image={t.h4Img}
                        onChange={(p) => update({ h4Img: p })}
                        focused={focused === "h4"}
                        onFocus={() => setFocused("h4")}
                        className="h-44"
                        showChartActions
                        showPasteTarget
                      />
                      <PasteSlot
                        label="H1"
                        image={t.h1Img}
                        onChange={(p) => update({ h1Img: p })}
                        focused={focused === "h1"}
                        onFocus={() => setFocused("h1")}
                        className="h-44"
                        showChartActions
                        showPasteTarget
                      />
                      <PasteSlot
                        label="M15"
                        image={t.m15Img}
                        onChange={(p) => update({ m15Img: p })}
                        focused={focused === "m15"}
                        onFocus={() => setFocused("m15")}
                        className="h-44"
                        showChartActions
                        showPasteTarget
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                    <PasteSlot
                      label="H1 STRUCTURE"
                      image={t.h1Img}
                      onChange={(p) => update({ h1Img: p })}
                      focused={focused === "h1"}
                      onFocus={() => setFocused("h1")}
                      className="h-48"
                      showChartActions
                      showPasteTarget
                    />
                    <PasteSlot
                      label="M15 CONTEXT"
                      image={t.m15Img}
                      onChange={(p) => update({ m15Img: p })}
                      focused={focused === "m15"}
                      onFocus={() => setFocused("m15")}
                      className="h-48"
                      showChartActions
                      showPasteTarget
                    />
                    <PasteSlot
                      label="M5 EXECUTION"
                      image={t.m5Img}
                      onChange={(p) => update({ m5Img: p })}
                      focused={focused === "m5"}
                      onFocus={() => setFocused("m5")}
                      className="h-48"
                      showChartActions
                      showPasteTarget
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab: Journal */}
          {activeTab === "journal" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <SectionHeader title="Review & Feedback" />
              <RichEditor
                value={t.notes ?? ""}
                onChange={(html) => update({ notes: html })}
                placeholder="What did you learn from this execution? Any psychological hurdles?"
                minHeight="300px"
                uploadImage={async (file) => {
                  const ext = file.name.split(".").pop();
                  const path = `notes/${crypto.randomUUID()}.${ext}`;
                  const { error } = await supabase.storage
                    .from("journal-charts")
                    .upload(path, file, { upsert: true });
                  if (error) throw error;
                  const { data } = supabase.storage.from("journal-charts").getPublicUrl(path);
                  return data.publicUrl;
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row justify-between items-center px-6 sm:px-10 py-6 sm:py-8 border-t border-border/50 bg-card shrink-0 gap-4">
          {onDelete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={busy}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-destructive/20 text-destructive text-xs font-black uppercase tracking-widest hover:bg-destructive hover:text-white transition-all active:scale-95 shadow-sm disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" /> Delete Entry
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border rounded-[32px] shadow-2xl p-10 max-w-md animate-in fade-in zoom-in-95 duration-300">
                <AlertDialogHeader className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
                    <AlertCircle className="w-8 h-8 text-destructive" />
                  </div>
                  <AlertDialogTitle className="text-2xl font-black text-foreground mb-2">
                    Delete Execution?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm font-medium text-muted-foreground leading-relaxed">
                    You are about to permanently remove this trade execution for{" "}
                    <span className="font-bold text-primary">{t.symbol}</span>. This action cannot
                    be reversed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-3 mt-10">
                  <AlertDialogCancel className="flex-1 h-14 rounded-2xl border-border text-foreground font-bold hover:bg-muted transition-all">
                    Keep Entry
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={del}
                    className="flex-1 h-14 rounded-2xl bg-destructive text-white font-black uppercase tracking-widest hover:bg-destructive/90 shadow-lg shadow-destructive/20 transition-all active:scale-95"
                  >
                    Delete Now
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="forest-gradient w-full sm:w-auto flex items-center justify-center gap-2 px-10 py-4 rounded-2xl text-sm font-black text-white shadow-xl hover:opacity-90 transition-all active:scale-95 uppercase tracking-widest"
          >
            <Save className="w-5 h-5" /> Save Execution
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-4 w-1 bg-primary rounded-full" />
      <h3 className="text-xs font-black uppercase tracking-widest text-primary">{title}</h3>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  children,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-xl bg-muted/30 border border-border px-4 pr-10 text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/20 appearance-none transition-all"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
    </div>
  );
}

function NumberField({
  value,
  onChange,
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
}) {
  const [raw, setRaw] = useState(() => String(value ?? ""));

  useEffect(() => {
    setRaw(String(value ?? ""));
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={raw}
      onChange={(e) => {
        const v = e.target.value;
        if (v !== "" && !/^-?\d*\.?\d*$/.test(v)) return;
        setRaw(v);
        if (v === "" || v === "-" || v === "." || v === "-.") return;
        const n = Number(v);
        if (!Number.isNaN(n)) onChange(n);
      }}
      onBlur={() => {
        const n = Number(raw);
        const next = raw === "" || Number.isNaN(n) ? 0 : n;
        onChange(next);
        setRaw(String(next));
      }}
      className="h-12 bg-muted/30 border-border rounded-xl font-bold px-4 focus:ring-primary/20"
    />
  );
}
