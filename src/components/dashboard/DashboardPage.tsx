import { useEffect, useMemo, useState } from "react";
import { TradingCalendar } from "./TradingCalendar";
import { 
  EquityCurveChart, 
} from "./DashboardCharts";
import { DisciplineGauge, MistakesCard, ActionPlanCard } from "./PerformanceWidgets";
import { fetchTrades, type Trade } from "@/lib/trades";
import { fetchFunding } from "@/lib/funding";
import { fetchReviews } from "@/lib/reviews";
import { AccountModal } from "./AccountModal";
import { 
  Loader2,
  Wallet 
} from "lucide-react";
import { isSameMonth, format, parseISO } from "date-fns";

export function DashboardPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [funding, setFunding] = useState<any[]>([]);
  const [latestReview, setLatestReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMonthOnly, setIsMonthOnly] = useState(true);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const load = async () => {
    try {
      const [t, f, r] = await Promise.all([fetchTrades(), fetchFunding(), fetchReviews()]);
      setTrades(t);
      setFunding(f);
      if (r.length > 0) {
        // Sort by period descending (lexicographical)
        const sortedReviews = [...r].sort((a, b) => b.period.localeCompare(a.period));
        
        // Find the most recent review that has some content
        const relevantReview = sortedReviews.find(rev => 
          rev.topMistakes.some(m => m.text.trim() !== "") || 
          rev.actionPlan.hardRules.some(i => (typeof i === 'string' ? i : i.text).trim() !== "") ||
          rev.actionPlan.optimization.some(i => (typeof i === 'string' ? i : i.text).trim() !== "") ||
          rev.actionPlan.training.some(i => (typeof i === 'string' ? i : i.text).trim() !== "")
        ) || sortedReviews[0];
        
        setLatestReview(relevantReview);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredTrades = useMemo(() => {
    if (!isMonthOnly) return trades;
    const now = new Date();
    return trades.filter((t) => isSameMonth(parseISO(t.entryTime), now));
  }, [trades, isMonthOnly]);

  const stats = useMemo(() => {
    const activeTrades = filteredTrades;
    const total = activeTrades.length;
    if (total === 0) return { total: 0, winRate: 0, totalPnl: 0, sqn: 0, roc: 0, discipline: 0 };

    const wins = activeTrades.filter((t) => t.netPnl > 0);
    const winRate = (wins.length / total) * 100;
    const totalPnl = activeTrades.reduce((acc, t) => acc + t.netPnl, 0);
    
    // SQN Calculation
    const pnls = activeTrades.map(t => t.netPnl);
    const avgPnl = totalPnl / total;
    const stdDev = Math.sqrt(pnls.map(p => Math.pow(p - avgPnl, 2)).reduce((a, b) => a + b, 0) / total);
    const sqn = stdDev > 0 ? (avgPnl / stdDev) * Math.sqrt(total) : 0;

    // ROC Calculation
    const nowKey = format(new Date(), "yyyy-MM");
    const currentMonthFunding = funding.find(f => f.monthKey === nowKey)?.amount || 0;
    
    // ROC only calculated for monthly view as requested
    const baseCapital = isMonthOnly 
      ? (currentMonthFunding || (funding.length > 0 ? funding[funding.length - 1].amount : 10000))
      : 0;
      
    const roc = isMonthOnly && baseCapital > 0 ? (totalPnl / baseCapital) * 100 : 0;

    // Discipline Calculation
    const disciplined = activeTrades.filter(t => t.complianceCheck).length;
    const discipline = (disciplined / total) * 100;

    return {
      total,
      winRate,
      totalPnl,
      sqn,
      roc,
      discipline,
      disciplined,
    };
  }, [filteredTrades, funding, isMonthOnly]);

  const equityData = useMemo(() => {
    const sorted = [...trades].sort((a, b) => a.entryTime.localeCompare(b.entryTime));
    let running = 0;
    return sorted.map((t) => {
      running += t.netPnl;
      return {
        name: format(parseISO(t.entryTime), "MM/dd"),
        value: Number(running.toFixed(2)),
      };
    });
  }, [trades]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 sm:p-8 space-y-6 sm:space-y-10 font-sans">
      
      {/* Page Header with Toggle */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard Overview</h1>
        <div className="flex bg-white dark:bg-slate-900 p-1 rounded-full border border-slate-100 dark:border-slate-800 shadow-sm">
          <button
            onClick={() => setIsMonthOnly(true)}
            className={`px-6 py-1.5 rounded-full text-xs font-bold tracking-widest transition-all ${
              isMonthOnly 
                ? "bg-primary text-white shadow-md" 
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
          >
            THIS MONTH
          </button>
          <button
            onClick={() => setIsMonthOnly(false)}
            className={`px-6 py-1.5 rounded-full text-xs font-bold tracking-widest transition-all ${
              !isMonthOnly 
                ? "bg-primary text-white shadow-md" 
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
          >
            ALL TIME
          </button>
        </div>
      </div>

      {/* Tier 1: ACCOUNT PERFORMANCE */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-sm font-bold tracking-[0.2em] text-slate-900 dark:text-white uppercase">Account Performance</h2>
          <button
            onClick={() => setShowAccountModal(true)}
            className="flex items-center gap-2 px-6 py-2 bg-slate-50 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-100 dark:border-slate-700"
          >
            <Wallet className="w-4 h-4 text-primary" />
            <span>MANAGE ACCOUNT</span>
          </button>
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-12 items-center">
          <div className="xl:col-span-3">
            <EquityCurveChart data={equityData} height={350} />
          </div>
          
          <div className="space-y-8 border-l border-slate-50 dark:border-slate-800 pl-12">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Trades</p>
              <h4 className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</h4>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Win Rate</p>
              <h4 className="text-2xl font-black text-slate-900 dark:text-white">{stats.winRate.toFixed(1)}%</h4>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">SQN</p>
              <h4 className={`text-2xl font-black ${stats.sqn >= 2 ? "text-emerald-500" : "text-slate-900 dark:text-white"}`}>
                {stats.sqn.toFixed(2)}
              </h4>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Return on Capital</p>
              <h4 className="text-2xl font-black text-emerald-500">
                {isMonthOnly ? `${stats.roc.toFixed(2)}%` : "--"}
              </h4>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total P/L</p>
              <h4 className={`text-2xl font-black ${stats.totalPnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                ${stats.totalPnl.toLocaleString()}
              </h4>
            </div>
          </div>
        </div>
      </div>

      {/* Tier 2: Discipline, Mistakes, Action Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <DisciplineGauge 
          score={stats.discipline} 
          totalTrades={stats.total}
          compliantTrades={stats.disciplined}
        />
        <MistakesCard 
          mistakes={latestReview?.topMistakes || []} 
          period={latestReview?.period}
        />
        <ActionPlanCard 
          plan={latestReview?.actionPlan || { hardRules: [], optimization: [], training: [] }} 
          period={latestReview?.period}
        />
      </div>

      {/* Tier 3: Trading Calendar */}
      <div className="bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="p-4 sm:p-8 border-b border-slate-50 dark:border-slate-800">
          <h2 className="text-sm font-bold tracking-[0.2em] text-slate-900 dark:text-white uppercase">Trading Calendar</h2>
        </div>
        <TradingCalendar />
      </div>

      {showAccountModal && (
        <AccountModal 
          onClose={() => setShowAccountModal(false)} 
          onRefresh={load} 
        />
      )}

    </div>
  );
}


