import { useEffect, useMemo, useState } from "react";
import { Plus, ExternalLink, Settings2, Loader2 } from "lucide-react";
import {
  computeOutcome,
  deleteTrade,
  fetchTrades,
  newTrade,
  outcomeStyle,
  upsertTrade,
  type Trade,
} from "@/lib/trades";
import { focusBiasEntry, navigateToPage } from "@/lib/nav-bus";
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

  useEffect(() => { reload(); }, []);

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
    <div className="min-h-screen p-6" style={{ background: "#05080A" }}>
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-lg font-bold tracking-[0.3em] text-[#48C0D8]">TRADE_LOG</h1>
            <p className="text-[10px] text-muted-foreground tracking-widest mt-0.5">
              // {trades.length} ENTRIES
            </p>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 py-2 rounded border border-terminal-border text-xs tracking-widest text-muted-foreground hover:text-foreground hover:border-[#48C0D8]/50">
                <Settings2 className="w-3.5 h-3.5" /> PROPERTIES
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#0D1117] border-terminal-border text-foreground">
                <DropdownMenuLabel className="text-[10px] tracking-widest text-muted-foreground">
                  TOGGLE COLUMNS
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(Object.keys(COL_LABELS) as ColKey[]).map((k) => (
                  <DropdownMenuCheckboxItem
                    key={k}
                    checked={cols[k]}
                    onCheckedChange={(v) => setCols((c) => ({ ...c, [k]: !!v }))}
                  >
                    {COL_LABELS[k]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={openNew}
              className="flex items-center gap-1.5 px-3 py-2 rounded border border-[#48C0D8]/60 bg-[#48C0D8]/10 text-[#48C0D8] text-xs font-bold tracking-widest hover:bg-[#48C0D8]/20"
            >
              <Plus className="w-3.5 h-3.5" /> NEW TRADE
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-terminal-border overflow-hidden" style={{ background: "#0D1117" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] tracking-[0.2em] text-muted-foreground border-b border-terminal-border">
                <th className="text-left p-3 w-[200px]">ID / OUTCOME</th>
                {cols.entryTime && <th className="text-left p-3 w-[150px]">ENTRY TIME</th>}
                <th className="text-left p-3 w-[140px]">SYMBOL / SIDE</th>
                {cols.stats && <th className="text-left p-3 w-[160px]">STATISTICS</th>}
                {cols.images && <th className="text-left p-3 w-[140px]">IMAGES</th>}
                <th className="text-left p-3">NOTES</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="p-12 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[#48C0D8] mx-auto" />
                </td></tr>
              )}
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={6} className="p-12 text-center text-muted-foreground text-xs tracking-widest">
                  // NO TRADES YET — CLICK "NEW TRADE" TO START
                </td></tr>
              )}
              {sorted.map((t, i) => {
                const outcome = computeOutcome(t.actualRr, t.maxRr, t.netPnl);
                return (
                  <tr
                    key={t.id}
                    onClick={() => openEdit(t)}
                    className="border-b border-terminal-border/50 hover:bg-white/[0.02] cursor-pointer transition"
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          #{String(i + 1).padStart(2, "0")}
                        </span>
                        <span className={`px-2 py-0.5 rounded border text-[10px] tracking-wider ${outcomeStyle[outcome.color]}`}>
                          {outcome.label}
                        </span>
                      </div>
                    </td>

                    {cols.entryTime && (
                      <td className="p-3 text-xs text-muted-foreground font-mono">
                        {formatTime(t.entryTime)}
                      </td>
                    )}

                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#48C0D8] text-xs tracking-wider">{t.symbol}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest ${
                          t.side === "buy"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40"
                            : "bg-red-500/15 text-red-400 border border-red-500/40"
                        }`}>
                          {t.side.toUpperCase()}
                        </span>
                        {t.biasEntryId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateToPage("bias");
                              setTimeout(() => focusBiasEntry(t.biasEntryId!), 50);
                            }}
                            className="text-muted-foreground hover:text-[#48C0D8]"
                            title="Open bias entry"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>

                    {cols.stats && (
                      <td className="p-3">
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-xs font-mono font-bold ${
                            t.netPnl > 0 ? "text-emerald-400" : t.netPnl < 0 ? "text-red-400" : "text-muted-foreground"
                          }`}>
                            {t.netPnl > 0 ? "+" : ""}{t.netPnl.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-muted-foreground tracking-wider">
                            RR {t.actualRr}/{t.maxRr}
                          </span>
                        </div>
                      </td>
                    )}

                    {cols.images && (
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1.5">
                          <TradeImageThumb
                            path={t.beforeImg}
                            label="BEFORE"
                            pair={{ path: t.afterImg, label: "AFTER" }}
                            captionPrefix={`Trade #${String(i + 1).padStart(2, "0")} • ${t.symbol}`}
                          />
                          <TradeImageThumb
                            path={t.afterImg}
                            label="AFTER"
                            pair={{ path: t.beforeImg, label: "BEFORE" }}
                            captionPrefix={`Trade #${String(i + 1).padStart(2, "0")} • ${t.symbol}`}
                          />
                        </div>
                      </td>
                    )}

                    <td className="p-3 text-xs text-muted-foreground truncate max-w-[300px]">
                      {t.notes ?? ""}
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
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(2);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}
