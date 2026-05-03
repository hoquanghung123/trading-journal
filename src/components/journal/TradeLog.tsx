import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  ExternalLink,
  Settings2,
  Loader2,
  FileText,
  LayoutGrid,
  List,
  Clock,
} from "lucide-react";
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
import { CheckCircle2, ShieldAlert, AlertCircle, BookOpen } from "lucide-react";
import { getAssetIconUrl } from "@/lib/symbols";
import { TradeModal } from "./TradeModal";
import { TradeImageThumb } from "./TradeImageThumb";
import { TradeGalleryCard } from "./TradeGalleryCard";
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
  | "bias";

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
};

const gradeStyle: Record<string, string> = {
  "A+": "bg-primary text-primary-foreground shadow-primary/20",
  A: "bg-amber-500 text-white shadow-amber-500/20",
  B: "bg-destructive text-destructive-foreground shadow-destructive/20",
};

export function TradeLog() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const { models: playbookSetups } = usePlaybook();
  const [editing, setEditing] = useState<Trade | null>(null);
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleUpdateView = async (view: "table" | "gallery") => {
    await updateSettings({ tradeLogView: view });
    queryClient.invalidateQueries({ queryKey: ["user_settings"] });
  };

  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: fetchSettings,
  });

  const [cols, setCols] = useState<Record<ColKey, boolean>>(() => {
    try {
      const s = localStorage.getItem("trade-log-cols");
      if (s) return JSON.parse(s);
    } catch {}
    return {
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
    };
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
                <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
                  Trade Log
                </h1>
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
            {/* View Mode Toggle */}
            <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border/50 shrink-0">
              <button
                onClick={() => handleUpdateView("table")}
                className={`p-2 rounded-lg transition-all ${
                  settings?.tradeLogView === "table"
                    ? "bg-white text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleUpdateView("gallery")}
                className={`p-2 rounded-lg transition-all ${
                  settings?.tradeLogView === "gallery"
                    ? "bg-white text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Gallery View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-white text-xs lg:text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-sm whitespace-nowrap">
                <Settings2 className="w-4 h-4" /> Columns
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-white border-border text-foreground rounded-xl shadow-xl">
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
              onClick={openNew}
              className="hidden lg:flex forest-gradient items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg hover:opacity-90 transition-all active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-5 h-5" /> New Trade
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="w-full">
          {loading ? (
            <div className="p-20 text-center bg-white rounded-3xl border border-border/50">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="p-20 text-center text-muted-foreground text-sm font-medium bg-white rounded-3xl border border-border/50">
              Your trade log is empty.
            </div>
          ) : settings?.tradeLogView === "gallery" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sorted.map((t) => (
                <TradeGalleryCard
                  key={t.id}
                  trade={t}
                  onClick={() => openEdit(t)}
                  showGrade={settings?.showTradeGrade}
                  cols={cols}
                  playbookName={playbookSetups.find((s) => s.id === t.setupId)?.name}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-border/50 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[800px]">
                  <thead>
                    <tr className="text-[9px] lg:text-xs font-bold text-muted-foreground uppercase tracking-widest bg-muted/30 border-b border-border">
                      <th className="text-center py-4 px-1 w-[30px]">#</th>
                      {cols.outcome && <th className="text-left p-2 lg:p-4 w-[160px]">Outcome</th>}
                      {settings?.showTradeGrade && cols.grade && (
                        <th className="text-left p-2 lg:p-4 w-[100px]">Grade</th>
                      )}
                      {cols.entryTime && <th className="text-left p-2 lg:p-4 w-[180px]">Entry Time</th>}
                      <th className="text-left p-2 lg:p-4 w-[120px]">Symbol</th>
                      {cols.bias && <th className="text-left p-2 lg:p-4 w-[120px]">Bias Context</th>}
                      {cols.side && <th className="text-left p-2 lg:p-4 w-[80px]">Side</th>}
                      {cols.playbook && <th className="text-left p-2 lg:p-4 w-[100px]">Playbook</th>}
                      {cols.stats && <th className="text-left p-2 lg:p-4 w-[180px]">Statistics</th>}
                      {cols.images && <th className="text-left p-2 lg:p-4 w-[180px]">Images</th>}
                      {cols.compliance && (
                        <th className="text-left p-2 lg:p-4 w-[200px]">Follow Playbook</th>
                      )}
                      {cols.status && <th className="text-left p-2 lg:p-4 w-[140px]">Status</th>}
                      <th className="text-left p-2 lg:p-4">Trade Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {sorted.map((t, i) => {
                      const outcome = computeOutcome(t.actualRr, t.maxRr, t.netPnl);
                      return (
                        <tr
                          key={t.id}
                          onClick={() => openEdit(t)}
                          className="group hover:bg-muted/30 cursor-pointer transition-colors"
                        >
                          <td className="py-4 px-1 text-center">
                            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              #{String(i + 1).padStart(2, "0")}
                            </span>
                          </td>
                          {cols.outcome && (
                            <td className="p-2 lg:p-4">
                              <span
                                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${outcomeStyle[outcome.color]}`}
                              >
                                {outcome.label}
                              </span>
                            </td>
                          )}

                          {settings?.showTradeGrade && cols.grade && (
                            <td className="p-2 lg:p-4">
                              {t.grade ? (
                                <span
                                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${gradeStyle[t.grade]}`}
                                >
                                  {t.grade}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-muted-foreground/30">
                                  —
                                </span>
                              )}
                            </td>
                          )}

                          {cols.entryTime && (
                            <td className="p-2 lg:p-4 text-[10px] lg:text-xs font-semibold text-muted-foreground whitespace-nowrap">
                              {formatTime(t.entryTime)}
                            </td>
                          )}

                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              {getAssetIconUrl(t.symbol) && (
                                <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 bg-white flex items-center justify-center shadow-sm">
                                  <img
                                    src={getAssetIconUrl(t.symbol)!}
                                    alt={t.symbol}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <span className="font-black text-foreground text-xs lg:text-sm">{t.symbol}</span>
                            </div>
                          </td>

                          {cols.bias && (
                            <td className="p-2 lg:p-4">
                              {t.biasEntryId && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigateToPage("bias");
                                    setTimeout(() => focusBiasEntry(t.biasEntryId!), 50);
                                  }}
                                  className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-sm border border-primary/20"
                                  title="View Bias Context"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          )}

                          {cols.side && (
                            <td className="p-2 lg:p-4">
                              <span
                                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
                                  t.side === "buy"
                                    ? "bg-primary text-primary-foreground shadow-primary/20"
                                    : "bg-destructive text-destructive-foreground shadow-destructive/20"
                                }`}
                              >
                                {t.side}
                              </span>
                            </td>
                          )}

                          {cols.playbook && (
                            <td className="p-2 lg:p-4">
                              {t.setupId && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigateToPage("playbook");
                                    setTimeout(() => focusPlaybookModel(t.setupId!), 50);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-muted/50 flex items-center gap-2 text-muted-foreground hover:text-primary transition-all shadow-sm border border-border/50"
                                >
                                  <BookOpen className="w-3.5 h-3.5" />
                                  <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                                    {playbookSetups.find((s) => s.id === t.setupId)?.name ||
                                      "Unknown"}
                                  </span>
                                </button>
                              )}
                            </td>
                          )}

                          {cols.stats && (
                            <td className="p-2 lg:p-4">
                              <div className="flex flex-col gap-0.5">
                                <span
                                  className={`text-xs lg:text-sm font-black ${t.netPnl > 0 ? "text-primary" : t.netPnl < 0 ? "text-destructive" : "text-muted-foreground"}`}
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
                                />
                                <TradeImageThumb
                                  path={t.afterImg}
                                  label="POST"
                                  pair={{ path: t.beforeImg, label: "PRE" }}
                                />
                              </div>
                            </td>
                          )}

                          {cols.compliance && (
                            <td className="p-2 lg:p-4">
                              <div className="flex flex-col gap-2">
                                {t.complianceCheck ? (
                                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground shadow-sm shadow-primary/20 w-fit">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-black uppercase tracking-wider">
                                      Followed
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive text-destructive-foreground shadow-sm shadow-destructive/20 w-fit">
                                      <AlertCircle className="w-3.5 h-3.5" />
                                      <span className="text-[10px] font-black uppercase tracking-wider">
                                        Incomplete
                                      </span>
                                    </div>
                                    {t.missedConfluences && t.missedConfluences.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {t.missedConfluences.slice(0, 2).map((c) => (
                                          <span
                                            key={c}
                                            className="px-1.5 py-0.5 rounded bg-rose-50 border border-rose-100 text-[8px] font-bold text-rose-600 uppercase tracking-tighter whitespace-nowrap"
                                          >
                                            {c}
                                          </span>
                                        ))}
                                        {t.missedConfluences.length > 2 && (
                                          <span className="text-[8px] font-black text-rose-400 uppercase tracking-tighter px-1">
                                            +{t.missedConfluences.length - 2} more
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          )}

                          {cols.status && (
                            <td className="p-2 lg:p-4">
                              <span
                                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${
                                  t.status === "Not Started"
                                    ? "bg-destructive text-destructive-foreground shadow-destructive/20"
                                    : t.status === "Opened"
                                      ? "bg-primary text-primary-foreground shadow-primary/20"
                                      : "bg-amber-500 text-white shadow-amber-500/20"
                                }`}
                              >
                                {t.status}
                              </span>
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

function formatTimeShort(iso: string) {
  const d = new Date(iso);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York",
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

  return `${parts.day}/${parts.month} ${parts.hour}:${parts.minute} NY`;
}
