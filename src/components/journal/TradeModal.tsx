import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeOutcome, outcomeStyle, type Trade } from "@/lib/trades";
import { useSymbols } from "@/lib/symbols";
import { fetchEntries, type DayEntry, ddmm } from "@/lib/journal";
import {
  fetchPsychologyForTrade,
  type PsychologyLog,
} from "@/lib/psychology";
import { navigateToPage } from "@/lib/nav-bus";
import { PasteSlot } from "./PasteSlot";
import { PsychologyBadges } from "./PsychologyBadges";
import { Trash2, Save, Brain, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  trade: Trade | null;
  onClose: () => void;
  onSave: (t: Trade) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function TradeModal({ open, trade, onClose, onSave, onDelete }: Props) {
  const [t, setT] = useState<Trade | null>(trade);
  const [focused, setFocused] = useState<"before" | "after" | null>(null);
  const [busy, setBusy] = useState(false);
  const [biasEntries, setBiasEntries] = useState<DayEntry[]>([]);
  const [psych, setPsych] = useState<PsychologyLog | null>(null);
  const { data: symbols = [] } = useSymbols();
  const SYMBOLS = symbols.map((s) => s.name);

  useEffect(() => { setT(trade); }, [trade]);

  // Load journal entries + psychology log when modal opens
  useEffect(() => {
    if (!open) return;
    fetchEntries().then(setBiasEntries).catch(() => {});
    if (trade?.id) {
      fetchPsychologyForTrade(trade.id).then(setPsych).catch(() => setPsych(null));
    } else {
      setPsych(null);
    }
  }, [open, trade?.id]);

  const filteredBias = useMemo(
    () => biasEntries
      .filter((e) => !t?.symbol || e.asset === t.symbol)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [biasEntries, t?.symbol],
  );

  if (!t) return null;

  const update = (patch: Partial<Trade>) => {
    setT((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      // auto net = gross - fees
      if ("grossPnl" in patch || "fees" in patch) {
        next.netPnl = Number((next.grossPnl - next.fees).toFixed(2));
      }
      return next;
    });
  };

  const outcome = computeOutcome(t.actualRr, t.maxRr, t.netPnl);

  // datetime-local value
  const dt = new Date(t.entryTime);
  const dtLocal = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

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
    if (!confirm("Delete this trade?")) return;
    setBusy(true);
    try {
      await onDelete(t.id);
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0 bg-[#0D1117] border-terminal-border text-foreground flex flex-col overflow-hidden">
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-terminal-border shrink-0">
          <DialogTitle className="text-neon-cyan tracking-[0.2em] text-sm font-bold flex items-center gap-3">
            TRADE ENTRY
            <span className={`px-2 py-0.5 rounded border text-[10px] tracking-widest ${outcomeStyle[outcome.color]}`}>
              {outcome.label}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {/* Row 1: Entry Time + Symbol */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Entry time">
              <Input
                type="datetime-local"
                value={dtLocal}
                onChange={(e) => update({ entryTime: new Date(e.target.value).toISOString() })}
                className="h-8 bg-black/40 border-terminal-border"
              />
            </Field>
            <Field label="Symbol">
              <select
                value={t.symbol}
                onChange={(e) => update({ symbol: e.target.value })}
                className="h-8 w-full rounded-md bg-black/40 border border-terminal-border px-2 text-sm"
              >
                {SYMBOLS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          {/* Row 2: Side + Bias Entry */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Side">
              <div className="flex gap-2">
                {(["buy", "sell"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => update({ side: s })}
                    className={`flex-1 h-8 rounded-md border text-xs font-bold tracking-widest uppercase transition ${
                      t.side === s
                        ? s === "buy"
                          ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-400"
                          : "bg-red-500/20 border-red-500/60 text-red-400"
                        : "border-terminal-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={`Bias entry (${t.symbol})`}>
              <select
                value={t.biasEntryId ?? ""}
                onChange={(e) => update({ biasEntryId: e.target.value || undefined })}
                className="h-8 w-full rounded-md bg-black/40 border border-terminal-border px-2 text-sm"
              >
                <option value="">— none —</option>
                {filteredBias.map((b) => (
                  <option key={b.id} value={b.id}>
                    {ddmm(b.date)} — {b.dailyBias.charAt(0).toUpperCase() + b.dailyBias.slice(1)}
                  </option>
                ))}
                {filteredBias.length === 0 && (
                  <option value="" disabled>No {t.symbol} entries</option>
                )}
              </select>
            </Field>
          </div>

          {/* Row 3: Gross + Fees + Net */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Gross PnL">
              <Input
                type="number" step="0.01"
                value={t.grossPnl}
                onChange={(e) => update({ grossPnl: Number(e.target.value) })}
                className="h-8 bg-black/40 border-terminal-border"
              />
            </Field>
            <Field label="Fees">
              <Input
                type="number" step="0.01"
                value={t.fees}
                onChange={(e) => update({ fees: Number(e.target.value) })}
                className="h-8 bg-black/40 border-terminal-border"
              />
            </Field>
            <Field label="Net PnL (auto)">
              <Input
                type="number" step="0.01"
                value={t.netPnl}
                onChange={(e) => update({ netPnl: Number(e.target.value) })}
                className={`h-8 bg-black/40 border-terminal-border ${t.netPnl > 0 ? "text-emerald-400" : t.netPnl < 0 ? "text-red-400" : ""}`}
              />
            </Field>
          </div>

          {/* Row 4: Actual RR + Max RR */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Actual RR achieved">
              <Input
                type="number" step="0.01"
                value={t.actualRr}
                onChange={(e) => update({ actualRr: Number(e.target.value) })}
                className="h-8 bg-black/40 border-terminal-border"
              />
            </Field>
            <Field label="Max RR reached">
              <Input
                type="number" step="0.01"
                value={t.maxRr}
                onChange={(e) => update({ maxRr: Number(e.target.value) })}
                className="h-8 bg-black/40 border-terminal-border"
              />
            </Field>
          </div>

          {/* Images */}
          <div className="grid grid-cols-2 gap-3">
            <PasteSlot
              label="BEFORE"
              image={t.beforeImg}
              onChange={(p) => update({ beforeImg: p })}
              focused={focused === "before"}
              onFocus={() => setFocused("before")}
              className="h-32"
            />
            <PasteSlot
              label="AFTER"
              image={t.afterImg}
              onChange={(p) => update({ afterImg: p })}
              focused={focused === "after"}
              onFocus={() => setFocused("after")}
              className="h-32"
            />
          </div>

          <Field label="Notes">
            <textarea
              value={t.notes ?? ""}
              onChange={(e) => update({ notes: e.target.value })}
              rows={2}
              className="w-full rounded-md bg-black/40 border border-terminal-border p-2 text-sm"
            />
          </Field>

          {/* Psychology evaluation (read-only summary; edit on Psychology page) */}
          <div className="rounded-md border border-terminal-border bg-black/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-[#48C0D8]" />
                <span className="text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
                  Psychology
                </span>
              </div>
              <button
                type="button"
                onClick={() => { onClose(); navigateToPage("psychology"); }}
                className="flex items-center gap-1 text-[10px] tracking-widest text-[#48C0D8] hover:underline"
              >
                {psych ? "EDIT" : "ADD"} <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {psych ? (
              <div className="space-y-2">
                <PsychologyBadges log={psych} size="md" />
                {(psych.entryRationale || psych.exitAssessment || psych.mistakes) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                    {psych.entryRationale && (
                      <Snippet label="Entry rationale" value={psych.entryRationale} />
                    )}
                    {psych.exitAssessment && (
                      <Snippet label="Exit assessment" value={psych.exitAssessment} />
                    )}
                    {psych.mistakes && <Snippet label="Mistakes" value={psych.mistakes} />}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground tracking-wide">
                // No psychology evaluation yet for this trade
              </p>
            )}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="flex justify-between items-center px-5 py-3 border-t border-terminal-border bg-[#0D1117] shrink-0">
          {onDelete ? (
            <button
              onClick={del}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-red-500/40 text-red-400 text-xs tracking-widest hover:bg-red-500/10"
            >
              <Trash2 className="w-3.5 h-3.5" /> DELETE
            </button>
          ) : <div />}
          <button
            onClick={save}
            disabled={busy}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded border border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan text-xs tracking-widest hover:bg-neon-cyan/25"
          >
            <Save className="w-3.5 h-3.5" /> SAVE
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
