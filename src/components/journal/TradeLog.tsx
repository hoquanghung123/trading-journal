import { useEffect, useMemo, useState } from "react";
import { Plus, ExternalLink, Settings2, Loader2, FileText } from "lucide-react";
import {
  computeOutcome,
  deleteTrade,
  fetchTrades,
  newTrade,
  outcomeStyle,
  upsertTrade,
  type Trade,
} from "@/lib/trades";
import { focusBiasEntry, focusPlaybookModel, navigateToPage } from "@/lib/nav-bus";
import { CheckCircle2, ShieldAlert, BookOpen } from "lucide-react";
import { TradeModal } from "./TradeModal";
import { TradeImageThumb } from "./TradeImageThumb";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type ColKey = "entryTime" | "stats" | "images";

const COL_LABELS: Record<ColKey, string> = {
  entryTime: "Entry Time",
  stats: "Statistics",
  images: "Images",
};

export function TradeLog() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Trade | null>(null);
  const [open, setOpen] = useState(false);
  const [cols, setCols] = useState<Record<ColKey, boolean>>(() => {
    try {
      const s = localStorage.getItem("trade-log-cols");
      if (s) return JSON.parse(s);
    } catch {}
    return { entryTime: true, stats: true, images: true };
  });

  useEffect(() => {
    localStorage.setItem("trade-log-cols", JSON.stringify(cols));
  }, [cols]);

  const reload = async () => {
    setLoading(true);
    try {
      setTrades(await fetchTrades());
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const openNew = () => {
    setEditing(newTrade());
    setOpen(true);
  };

  const openEdit = (t: Trade) => {
    setEditing(t);
    setOpen(true);
  };

  const save = async (t: Trade) => {
    await upsertTrade(t);
    await reload();
  };

  const remove = async (id: string) => {
    await deleteTrade(id);
    await reload();
  };

  const sorted = useMemo(
    () => [...trades].sort((a, b) => +new Date(a.entryTime) - +new Date(b.entryTime)),
    [trades],
  );

  return (
    <div className="min-h-screen bg-background p-4 lg:p-10">
      <div className="max-w-[1500px] mx-auto space-y-6 lg:space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-border pb-6 lg:pb-8 gap-6">
          <div className="flex items-center justify-between w-full lg:w-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">Trade Log</h1>
                <p className="text-[10px] lg:text-sm text-muted-foreground font-medium uppercase tracking-wider">
                  {trades.length} Recorded Entries
                </p>
              </div>
            </div>

            <button
              onClick={openNew}
              className="lg:hidden forest-gradient flex items-center justify-center w-10 h-10 text-white rounded-xl shadow-lg active:scale-95 transition-all"
            >
              <Plus className="w-6 h-6" strokeWidth={3} />
            </button>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar pb-1 lg:pb-0">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-white text-xs lg:text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-sm whitespace-nowrap">
                <Settings2 className="w-4 h-4" /> Columns
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-white border-border text-foreground rounded-xl shadow-xl">
                <DropdownMenuLabel className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-3 py-2">
                  Toggle Columns
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(Object.keys(COL_LABELS) as ColKey[]).map((k) => (
                  <DropdownMenuCheckboxItem
                    key={k}
                    checked={cols[k]}
                    onCheckedChange={(v) => setCols((c) => ({ ...c, [k]: !!v }))}
                    className="font-medium"
                  >
                    {COL_LABELS[k]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={openNew}
              className="hidden lg:flex forest-gradient items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg hover:opacity-90 transition-all active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-5 h-5" /> New Trade
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="rounded-2xl border border-border bg-white overflow-x-auto hide-scrollbar shadow-sm">
          <table className="w-full text-sm border-collapse min-w-[800px] lg:min-w-0">
            <thead>
              <tr className="text-xs font-bold text-muted-foreground uppercase tracking-widest bg-muted/30 border-b border-border">
                <th className="text-left p-4 w-[220px]">Outcome</th>
                {cols.entryTime && <th className="text-left p-4 w-[180px]">Entry Time</th>}
                <th className="text-left p-4 w-[160px]">Symbol / Side</th>
                {cols.stats && <th className="text-left p-4 w-[180px]">Statistics</th>}
                {cols.images && <th className="text-left p-4 w-[180px]">Images</th>}
                <th className="text-left p-4">Trade Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading && (
                <tr>
                  <td colSpan={6} className="p-20 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              )}
              {!loading && sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-20 text-center text-muted-foreground text-sm font-medium"
                  >
                    Your trade log is empty. Start your first entry to see data here.
                  </td>
                </tr>
              )}
              {sorted.map((t, i) => {
                const outcome = computeOutcome(t.actualRr, t.maxRr, t.netPnl);
                return (
                  <tr
                    key={t.id}
                    onClick={() => openEdit(t)}
                    className="group hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          #{String(i + 1).padStart(2, "0")}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${outcomeStyle[outcome.color]}`}
                        >
                          {outcome.label}
                        </span>
                        {t.complianceCheck ? (
                          <div className="flex items-center gap-1 text-emerald-500" title="Followed Playbook">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-rose-500" title="Did not Follow Playbook">
                              <ShieldAlert className="w-4 h-4" />
                            </div>
                            {t.missedConfluences && t.missedConfluences.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {t.missedConfluences.map(c => (
                                  <span key={c} className="px-1.5 py-0.5 rounded-md bg-rose-50 text-[8px] font-bold text-rose-500 border border-rose-100 whitespace-nowrap">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {cols.entryTime && (
                      <td className="p-4 text-xs font-semibold text-muted-foreground">
                        {formatTime(t.entryTime)}
                      </td>
                    )}

                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-foreground text-sm">
                          {t.symbol}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                            t.side === "buy"
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "bg-destructive/10 text-destructive border border-destructive/20"
                          }`}
                        >
                          {t.side}
                        </span>
                        {t.biasEntryId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateToPage("bias");
                              setTimeout(() => focusBiasEntry(t.biasEntryId!), 50);
                            }}
                            className="text-muted-foreground hover:text-primary transition-colors ml-1"
                            title="Open bias entry"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}
                        {t.setupId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateToPage("playbook");
                              setTimeout(() => focusPlaybookModel(t.setupId!), 50);
                            }}
                            className="text-muted-foreground hover:text-primary transition-colors ml-1"
                            title="Open playbook setup"
                          >
                            <BookOpen className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>

                    {cols.stats && (
                      <td className="p-4">
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={`text-sm font-black ${
                              t.netPnl > 0
                                ? "text-primary"
                                : t.netPnl < 0
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {t.netPnl > 0 ? "+" : ""}
                            {t.netPnl.toFixed(2)}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                            RR {t.actualRr} / {t.maxRr}
                          </span>
                        </div>
                      </td>
                    )}

                    {cols.images && (
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <TradeImageThumb
                            path={t.beforeImg}
                            label="PRE"
                            pair={{ path: t.afterImg, label: "POST" }}
                            captionPrefix={`Trade #${String(i + 1).padStart(2, "0")} • ${t.symbol}`}
                          />
                          <TradeImageThumb
                            path={t.afterImg}
                            label="POST"
                            pair={{ path: t.beforeImg, label: "PRE" }}
                            captionPrefix={`Trade #${String(i + 1).padStart(2, "0")} • ${t.symbol}`}
                          />
                        </div>
                      </td>
                    )}

                    <td className="p-4 text-xs font-medium text-muted-foreground truncate max-w-[300px]">
                      {t.notes ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

function formatTime(iso: string) {
  const d = new Date(iso);
  
  // Create a formatter for NY timezone
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});

  // Returns format: DD/MM/YY HH:MM
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}
