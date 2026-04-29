import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeOutcome, outcomeStyle, type Trade } from "@/lib/trades";
import { useSymbols } from "@/lib/symbols";
import { fetchEntries, type DayEntry, ddmm } from "@/lib/journal";
import { PasteSlot } from "./PasteSlot";
import { Trash2, Save, FileText, AlertCircle, X } from "lucide-react";
import { usePlaybook } from "@/hooks/usePlaybook";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchSettings } from "@/lib/settings";
import { useQuery } from "@tanstack/react-query";
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

export function TradeModal({ open, trade, onClose, onSave, onDelete }: Props) {
  const [t, setT] = useState<Trade | null>(trade);
  const [focused, setFocused] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [biasEntries, setBiasEntries] = useState<DayEntry[]>([]);
  const { data: symbols = [] } = useSymbols();
  const { models: playbookSetups } = usePlaybook();
  const SYMBOLS = symbols.map((s) => s.name);

  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: fetchSettings,
  });

  useEffect(() => {
    setT(trade);
  }, [trade]);

  useEffect(() => {
    if (!open) return;
    fetchEntries()
      .then(setBiasEntries)
      .catch(() => {});
  }, [open]);

  const filteredBias = useMemo(
    () =>
      biasEntries
        .filter((e) => {
          const isToday = e.date === new Date().toISOString().slice(0, 10);
          const isMatchingSymbol = !t?.symbol || e.asset === t.symbol;
          return isToday && isMatchingSymbol;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [biasEntries, t?.symbol],
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

  const toNyLocal = (iso: string) => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date(iso)).reduce<Record<string, string>>(
      (acc, p) => {
        if (p.type !== "literal") acc[p.type] = p.value;
        return acc;
      },
      {},
    );
    const hh = parts.hour === "24" ? "00" : parts.hour;
    return `${parts.year}-${parts.month}-${parts.day}T${hh}:${parts.minute}`;
  };

  const dtLocal = toNyLocal(t.entryTime);
  const exitDtLocal = t.exitTime ? toNyLocal(t.exitTime) : "";

  const nyLocalToIso = (local: string): string => {
    const [datePart, timePart] = local.split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    const [hh, mm] = timePart.split(":").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, hh, mm));
    
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });

    const p = formatter.formatToParts(date).reduce<Record<string, number>>((acc, part) => {
      if (part.type !== "literal" && !isNaN(Number(part.value))) acc[part.type] = Number(part.value);
      return acc;
    }, {});

    const nyUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute);
    const diff = date.getTime() - nyUtc;
    return new Date(date.getTime() + diff).toISOString();
  };

  const save = async () => {
    setBusy(true);
    try {
      await onSave(t);
      toast.success("Trade saved");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
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
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-full h-full sm:h-auto sm:max-w-5xl max-h-[100vh] sm:max-h-[96vh] p-0 gap-0 bg-white border-white/20 text-foreground flex flex-col overflow-hidden rounded-none sm:rounded-[48px] shadow-2xl animate-in fade-in zoom-in-95 duration-300 left-0 top-0 translate-x-0 translate-y-0 sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]">
        <DialogHeader className="px-6 sm:px-10 pt-6 sm:pt-10 pb-4 sm:pb-6 border-b border-border/50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-3xl font-black tracking-tight">
                  Trade Execution
                </DialogTitle>
                <div className="flex items-center gap-3 mt-1">
                   <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status:</span>
                   <span
                    className={`px-3 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm ${outcomeStyle[outcome.color]}`}
                  >
                    {outcome.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-6 sm:py-8 space-y-8 sm:space-y-10 scrollbar-hide">
          {/* Section: Basic Info */}
          <div className="space-y-6">
            <SectionHeader title="Entry & Asset" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
              <Field label="Entry time (NY)">
                <Input
                  type="datetime-local"
                  value={dtLocal}
                  onChange={(e) => update({ entryTime: nyLocalToIso(e.target.value) })}
                  className="h-12 bg-muted/30 border-border rounded-xl font-bold px-4 focus:ring-primary/20"
                />
              </Field>
              <Field label="Exit time (NY)">
                <Input
                  type="datetime-local"
                  value={exitDtLocal}
                  onChange={(e) => update({ exitTime: nyLocalToIso(e.target.value) })}
                  className="h-12 bg-muted/30 border-border rounded-xl font-bold px-4 focus:ring-primary/20"
                />
              </Field>
              <Field label="Symbol / Asset">
                <select
                  value={t.symbol}
                  onChange={(e) => update({ symbol: e.target.value })}
                  className="h-12 w-full rounded-xl bg-muted/30 border border-border px-4 text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/20 appearance-none transition-all"
                >
                  {SYMBOLS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Trade Status">
                <div className="flex gap-2">
                  {(["Not Started", "Opened", "Closed"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => update({ status: s })}
                      className={`flex-1 h-12 rounded-xl border-2 text-[9px] font-black tracking-widest uppercase transition-all shadow-sm ${
                        t.status === s
                          ? s === "Not Started"
                            ? "bg-muted text-muted-foreground border-muted-foreground/30 scale-[1.02]"
                            : s === "Opened"
                              ? "bg-sky-500 text-white border-sky-500 shadow-sky-500/20 scale-[1.02]"
                              : "bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/20 scale-[1.02]"
                          : "bg-white border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Trade Grade Section (Conditional) */}
              {settings?.showTradeGrade && (
                <Field label="Trade Grade">
                  <div className="flex gap-2">
                    {(["A+", "A", "B"] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => update({ grade: g })}
                        className={`flex-1 h-12 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${
                          t.grade === g
                            ? g === "A+"
                              ? "bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/20 scale-[1.02]"
                              : g === "A"
                                ? "bg-amber-500 text-white border-amber-500 shadow-amber-500/20 scale-[1.02]"
                                : "bg-rose-500 text-white border-rose-500 shadow-rose-500/20 scale-[1.02]"
                            : "bg-white border-border text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                    {/* Optional: Clear Grade Button */}
                    <button
                      onClick={() => update({ grade: undefined })}
                      className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all ${
                        !t.grade 
                          ? "bg-muted/50 border-muted-foreground/20 text-muted-foreground" 
                          : "bg-white border-border text-muted-foreground/30 hover:border-destructive/30 hover:text-destructive"
                      }`}
                      title="Clear Grade"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </Field>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
              <Field label="Execution Side">
                <div className="flex gap-4">
                  {(["buy", "sell"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => update({ side: s })}
                      className={`flex-1 h-12 rounded-xl border-2 text-[10px] font-black tracking-widest uppercase transition-all shadow-sm ${
                        t.side === s
                          ? s === "buy"
                            ? "bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/20 scale-[1.02]"
                            : "bg-rose-500 text-white border-rose-500 shadow-rose-500/20 scale-[1.02]"
                          : "bg-white border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={`Context: Bias entry (${t.symbol})`}>
                <select
                  value={t.biasEntryId ?? ""}
                  onChange={(e) => update({ biasEntryId: e.target.value || undefined })}
                  className="h-12 w-full rounded-xl bg-muted/30 border border-border px-4 text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/20 appearance-none transition-all"
                >
                  <option value="">— Link to Bias entry —</option>
                  {filteredBias.map((b) => (
                    <option key={b.id} value={b.id}>
                      {ddmm(b.date)} — {b.dailyBias.toUpperCase()}
                    </option>
                  ))}
                  {filteredBias.length === 0 && (
                    <option value="" disabled>
                      No {t.symbol} journal entries found for today
                    </option>
                  )}
                </select>
              </Field>
              <Field label="Setup / Strategy">
                <select
                  value={t.setupId ?? ""}
                  onChange={(e) => update({ 
                    setupId: e.target.value || undefined,
                    missedConfluences: []
                  })}
                  className="h-12 w-full rounded-xl bg-muted/30 border border-border px-4 text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/20 appearance-none transition-all"
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
                </select>
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
                        missedConfluences: checked ? [] : t.missedConfluences 
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

            {/* Missed Confluences Checklist */}
            {!t.complianceCheck && t.setupId && (
              <div className="bg-rose-50/50 border border-rose-100 rounded-[32px] p-8 space-y-6 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-rose-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-rose-600 uppercase tracking-widest">
                      Missed Confluences
                    </h4>
                    <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mt-0.5">
                      Specify what rules were not followed in this execution
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {playbookSetups.find(s => s.id === t.setupId)?.setupConfluences.map((c) => {
                    const isMissed = t.missedConfluences?.includes(c);
                    return (
                      <div 
                        key={c}
                        onClick={() => {
                          const current = t.missedConfluences ?? [];
                          const next = isMissed 
                            ? current.filter(x => x !== c)
                            : [...current, c];
                          update({ missedConfluences: next });
                        }}
                        className={`flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer select-none ${
                          isMissed 
                            ? "bg-white border-rose-200 shadow-sm shadow-rose-100" 
                            : "bg-white/50 border-transparent hover:border-rose-100"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          isMissed 
                            ? "bg-rose-500 border-rose-500" 
                            : "bg-white border-muted"
                        }`}>
                          {isMissed && <div className="w-2 h-2 rounded-full bg-white animate-in zoom-in duration-200" />}
                        </div>
                        <span className={`text-xs font-bold ${isMissed ? "text-rose-600" : "text-muted-foreground"}`}>
                          {c}
                        </span>
                      </div>
                    );
                  })}
                  {(!playbookSetups.find(s => s.id === t.setupId)?.setupConfluences || 
                    playbookSetups.find(s => s.id === t.setupId)?.setupConfluences.length === 0) && (
                    <p className="col-span-2 text-xs font-medium text-muted-foreground italic p-4 text-center">
                      No confluences defined for this playbook.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section: Performance */}
          <div className="space-y-6">
            <SectionHeader title="Financial Performance" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <Field label="Gross PnL">
                <Input
                  type="number"
                  step="0.01"
                  value={t.grossPnl}
                  onChange={(e) => update({ grossPnl: Number(e.target.value) })}
                  className="h-12 bg-muted/30 border-border rounded-xl font-bold px-4 focus:ring-primary/20"
                />
              </Field>
              <Field label="Fees / Commissions">
                <Input
                  type="number"
                  step="0.01"
                  value={t.fees}
                  onChange={(e) => update({ fees: Number(e.target.value) })}
                  className="h-12 bg-muted/30 border-border rounded-xl font-bold px-4 focus:ring-primary/20"
                />
              </Field>
              <Field label="Net PnL (Calculated)">
                <div className={`h-12 w-full rounded-xl flex items-center px-4 text-sm font-black border transition-all ${t.netPnl > 0 ? "bg-emerald-50 border-emerald-200 text-emerald-600" : t.netPnl < 0 ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-muted/30 border-border"}`}>
                  {t.netPnl > 0 ? "+" : ""}{t.netPnl.toFixed(2)}
                </div>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
              <Field label="Actual RR Achieved">
                <Input
                  type="number"
                  step="0.01"
                  value={t.actualRr}
                  onChange={(e) => update({ actualRr: Number(e.target.value) })}
                  className="h-12 bg-muted/30 border-border rounded-xl font-bold px-4 focus:ring-primary/20"
                />
              </Field>
              <Field label="Max RR Reached (Potential)">
                <Input
                  type="number"
                  step="0.01"
                  value={t.maxRr}
                  onChange={(e) => update({ maxRr: Number(e.target.value) })}
                  className="h-12 bg-muted/30 border-border rounded-xl font-bold px-4 focus:ring-primary/20"
                />
              </Field>
            </div>
          </div>

          {/* Section: Visual Evidence */}
          <div className="space-y-10">
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
                  />
                  <PasteSlot
                    label="AFTER EXIT"
                    image={t.afterImg}
                    onChange={(p) => update({ afterImg: p })}
                    focused={focused === "after"}
                    onFocus={() => setFocused("after")}
                    className="h-48 sm:h-64"
                  />
              </div>
            </div>

            <div className="space-y-6">
              <SectionHeader title={isForexPair ? "Multi-Timeframe Analysis (Forex)" : "Technical Analysis"} />
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
                    />
                    <PasteSlot
                      label="WEEKLY"
                      image={t.weeklyImg}
                      onChange={(p) => update({ weeklyImg: p })}
                      focused={focused === "weekly"}
                      onFocus={() => setFocused("weekly")}
                      className="h-44"
                    />
                    <PasteSlot
                      label="DAILY"
                      image={t.dailyImg}
                      onChange={(p) => update({ dailyImg: p })}
                      focused={focused === "daily"}
                      onFocus={() => setFocused("daily")}
                      className="h-44"
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
                    />
                    <PasteSlot
                      label="H1"
                      image={t.h1Img}
                      onChange={(p) => update({ h1Img: p })}
                      focused={focused === "h1"}
                      onFocus={() => setFocused("h1")}
                      className="h-44"
                    />
                    <PasteSlot
                      label="M15"
                      image={t.m15Img}
                      onChange={(p) => update({ m15Img: p })}
                      focused={focused === "m15"}
                      onFocus={() => setFocused("m15")}
                      className="h-44"
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
                  />
                  <PasteSlot
                    label="M15 CONTEXT"
                    image={t.m15Img}
                    onChange={(p) => update({ m15Img: p })}
                    focused={focused === "m15"}
                    onFocus={() => setFocused("m15")}
                    className="h-48"
                  />
                  <PasteSlot
                    label="M5 EXECUTION"
                    image={t.m5Img}
                    onChange={(p) => update({ m5Img: p })}
                    focused={focused === "m5"}
                    onFocus={() => setFocused("m5")}
                    className="h-48"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <SectionHeader title="Review & Feedback" />
            <textarea
              value={t.notes ?? ""}
              onChange={(e) => update({ notes: e.target.value })}
              rows={4}
              placeholder="What did you learn from this execution? Any psychological hurdles?"
              className="w-full rounded-2xl sm:rounded-[32px] bg-muted/20 border border-border p-4 sm:p-8 text-sm font-medium text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row justify-between items-center px-6 sm:px-10 py-6 sm:py-8 border-t border-border/50 bg-muted/10 shrink-0 gap-4">
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
              <AlertDialogContent className="bg-white border-border rounded-[32px] shadow-2xl p-10 max-w-md animate-in fade-in zoom-in-95 duration-300">
                <AlertDialogHeader className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
                    <AlertCircle className="w-8 h-8 text-destructive" />
                  </div>
                  <AlertDialogTitle className="text-2xl font-black text-foreground mb-2">
                    Delete Execution?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm font-medium text-muted-foreground leading-relaxed">
                    You are about to permanently remove this trade execution for <span className="font-bold text-primary">{t.symbol}</span>. This action cannot be reversed.
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
      <h3 className="text-xs font-black uppercase tracking-widest text-primary">
        {title}
      </h3>
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
