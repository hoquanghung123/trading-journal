import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Calendar, FileText, LayoutDashboard, Search } from "lucide-react";
import {
  fetchTrades,
  deleteTrade,
  upsertTrade,
  type Trade,
  computeOutcome,
  outcomeStyle,
} from "@/lib/trades";
import { onDailyFocus, navigateToPage } from "@/lib/nav-bus";
import { format, parseISO } from "date-fns";
import { TradeModal } from "@/components/journal/TradeModal";
import { toast } from "sonner";

export function DailyViewPage() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Trade | null>(null);
  const [openModal, setOpenModal] = useState(false);

  const reload = async () => {
    if (!selectedDate) return;
    setLoading(true);
    try {
      const allTrades = await fetchTrades();
      const filtered = allTrades.filter((t) => {
        const localDate = format(new Date(t.entryTime), "yyyy-MM-dd");
        return localDate === selectedDate;
      });
      setTrades(filtered);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load trades");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return onDailyFocus((dateStr) => {
      setSelectedDate(dateStr);
    });
  }, []);

  useEffect(() => {
    reload();
  }, [selectedDate]);

  const openTrade = (t: Trade) => {
    setEditing(t);
    setOpenModal(true);
  };

  const save = async (t: Trade) => {
    await upsertTrade(t);
    await reload();
  };

  const remove = async (id: string) => {
    await deleteTrade(id);
    await reload();
  };

  const totalPnl = useMemo(() => {
    return trades.reduce((sum, t) => sum + t.netPnl, 0);
  }, [trades]);

  if (!selectedDate) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] p-6 flex flex-col items-center justify-center text-muted-foreground">
        <div className="w-20 h-20 rounded-[28px] bg-white shadow-xl flex items-center justify-center mb-6">
          <Calendar className="w-10 h-10 text-primary/40" />
        </div>
        <h2 className="text-xl font-black text-foreground">No Date Selected</h2>
        <p className="text-sm font-medium mt-2">Select a day from the calendar to view details.</p>
        <button
          onClick={() => navigateToPage("dashboard")}
          className="mt-8 px-6 py-3 bg-white border border-border rounded-2xl font-bold text-sm shadow-sm hover:bg-muted transition-all"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const dateObj = parseISO(selectedDate);

  return (
    <div className="min-h-screen bg-[#F8FAF9] p-6 lg:p-10">
      <div className="max-w-[1100px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigateToPage("dashboard")}
              className="w-12 h-12 rounded-2xl bg-white border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/20 transition-all shadow-sm active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-5 h-5 text-primary" />
                <h1 className="text-3xl font-black tracking-tight text-foreground">
                  {format(dateObj, "MMMM d, yyyy")}
                </h1>
              </div>
              <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em] mt-2">
                Daily Performance Review
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-border p-4 pr-6 flex items-center gap-5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">
                Total PnL
              </div>
              <div
                className={`text-xl font-black ${totalPnl >= 0 ? "text-primary" : "text-destructive"}`}
              >
                {totalPnl >= 0 ? "+" : ""}${Math.abs(totalPnl).toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-[40px] border border-border shadow-sm overflow-hidden min-h-[500px] flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-20">
              <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
              <p className="mt-4 text-sm font-bold text-muted-foreground uppercase tracking-widest">
                Fetching executions...
              </p>
            </div>
          ) : trades.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
              <div className="w-20 h-20 rounded-3xl bg-muted/30 flex items-center justify-center mb-6">
                <Search className="w-10 h-10 text-muted-foreground/30" />
              </div>
              <h3 className="text-xl font-black text-foreground">No executions found</h3>
              <p className="text-sm font-medium text-muted-foreground mt-2 max-w-xs">
                You didn't record any trades for this specific day in your journal.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {trades
                .sort((a, b) => +new Date(a.entryTime) - +new Date(b.entryTime))
                .map((t, i) => {
                  const outcome = computeOutcome(t.actualRr, t.maxRr, t.netPnl);
                  return (
                    <div
                      key={t.id}
                      onClick={() => openTrade(t)}
                      className="group p-8 flex items-center justify-between hover:bg-[#F8FAF9]/50 cursor-pointer transition-all duration-300"
                    >
                      <div className="flex items-center gap-8">
                        {/* Time & Index */}
                        <div className="flex flex-col gap-1 w-24">
                          <span className="text-xs font-black text-primary uppercase tracking-widest">
                            {format(parseISO(t.entryTime), "HH:mm")}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground/40 uppercase">
                            Execution #{String(i + 1).padStart(2, "0")}
                          </span>
                        </div>

                        {/* Symbol & Side */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-black text-foreground tracking-tight group-hover:text-primary transition-colors">
                              {t.symbol}
                            </span>
                            <span
                              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                t.side === "buy"
                                  ? "bg-primary/10 text-primary border border-primary/20"
                                  : "bg-destructive/10 text-destructive border border-destructive/20"
                              }`}
                            >
                              {t.side}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm ${outcomeStyle[outcome.color]}`}
                            >
                              {outcome.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex items-center gap-10">
                        {/* Stats */}
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
                            Risk/Reward
                          </span>
                          <span className="text-sm font-bold text-foreground">
                            {t.actualRr} <span className="text-muted-foreground/30 mx-1">/</span>{" "}
                            {t.maxRr}
                          </span>
                        </div>

                        {/* Profit */}
                        <div className="flex flex-col items-end gap-0.5 min-w-[120px]">
                          <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
                            Net Result
                          </span>
                          <span
                            className={`text-2xl font-black ${
                              t.netPnl > 0
                                ? "text-primary"
                                : t.netPnl < 0
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {t.netPnl > 0 ? "+" : ""}${Math.abs(t.netPnl).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      <TradeModal
        open={openModal}
        trade={editing}
        onClose={() => setOpenModal(false)}
        onSave={save}
        onDelete={editing ? (id) => remove(id) : undefined}
      />
    </div>
  );
}
