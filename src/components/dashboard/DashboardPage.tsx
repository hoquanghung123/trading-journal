import { useMemo, useState } from "react";
import { TradingCalendar } from "./TradingCalendar";
import { EquityCurveChart } from "./DashboardCharts";
import { DisciplineGauge, MistakesCard, ActionPlanCard } from "./PerformanceWidgets";
import { fetchTrades, tradesQueryKey, type Trade } from "@/lib/trades";
import { fetchFunding, fundingQueryKey, type MonthlyFunding } from "@/lib/funding";
import { fetchReviews, reviewsQueryKey } from "@/lib/reviews";
import { AccountModal } from "./AccountModal";
import { Loader2, Wallet } from "lucide-react";
import { PlaybookPerformance } from "./PlaybookPerformance";
import { fetchPlaybook, playbookQueryKey } from "@/lib/playbook";
import { isSameMonth, format, parseISO } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Review } from "@/types/review";

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [isMonthOnly, setIsMonthOnly] = useState(true);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const { data: trades = [], isLoading: loadingTrades } = useQuery({
    queryKey: tradesQueryKey,
    queryFn: fetchTrades,
  });

  const { data: funding = [], isLoading: loadingFunding } = useQuery({
    queryKey: fundingQueryKey,
    queryFn: fetchFunding,
  });

  const { data: reviews = [], isLoading: loadingReviews } = useQuery({
    queryKey: reviewsQueryKey,
    queryFn: fetchReviews,
  });

  const { data: playbooks = [], isLoading: loadingPlaybooks } = useQuery({
    queryKey: playbookQueryKey,
    queryFn: fetchPlaybook,
  });

  const loading = loadingTrades || loadingFunding || loadingReviews || loadingPlaybooks;

  const latestReview = useMemo(() => {
    if (reviews.length === 0) return null;

    // Sort by period descending (lexicographical)
    const sortedReviews = [...reviews].sort((a, b) => b.period.localeCompare(a.period));

    // Find the most recent review that has some content
    return (
      sortedReviews.find(
        (rev) =>
          rev.topMistakes.some((m) => m.text.trim() !== "") ||
          rev.actionPlan.hardRules.some(
            (i) => (typeof i === "string" ? i : i.text).trim() !== "",
          ) ||
          rev.actionPlan.optimization.some(
            (i) => (typeof i === "string" ? i : i.text).trim() !== "",
          ) ||
          rev.actionPlan.training.some((i) => (typeof i === "string" ? i : i.text).trim() !== ""),
      ) || sortedReviews[0]
    );
  }, [reviews]);

  const filteredTrades = useMemo(() => {
    if (!isMonthOnly) return trades;
    const now = new Date();
    return trades.filter((t) => isSameMonth(parseISO(t.entryTime), now));
  }, [trades, isMonthOnly]);

  const stats = useMemo(() => {
    const activeTrades = filteredTrades;
    const total = activeTrades.length;
    if (total === 0)
      return {
        total: 0,
        winRate: 0,
        totalPnl: 0,
        sqn: 0,
        totalR: 0,
        totalMaxR: 0,
        discipline: 0,
        disciplined: 0,
      };

    const wins = activeTrades.filter((t) => t.actualRr > 0);
    const winRate = (wins.length / total) * 100;
    const totalPnl = activeTrades.reduce((acc, t) => acc + t.netPnl, 0);

    // SQN Calculation
    const pnls = activeTrades.map((t) => t.netPnl);
    const avgPnl = totalPnl / total;
    const stdDev = Math.sqrt(
      pnls.map((p) => Math.pow(p - avgPnl, 2)).reduce((a, b) => a + b, 0) / total,
    );
    const sqn = stdDev > 0 ? (avgPnl / stdDev) * Math.sqrt(total) : 0;

    // Discipline Calculation
    const disciplined = activeTrades.filter((t) => t.complianceCheck).length;
    const discipline = (disciplined / total) * 100;

    // R Calculations
    const totalR = activeTrades.reduce((acc, t) => acc + (t.actualRr || 0), 0);
    const totalMaxR = activeTrades.reduce((acc, t) => acc + (t.maxRr || 0), 0);

    return {
      total,
      winRate,
      totalPnl,
      sqn,
      totalR,
      totalMaxR,
      discipline,
      disciplined,
    };
  }, [filteredTrades]);

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
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 p-3 sm:p-8 space-y-5 sm:space-y-10 font-sans mobile-pb">
      {/* Page Header with Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Dashboard Overview
        </h1>
        <div className="flex w-full sm:w-auto bg-white dark:bg-slate-900 p-1 rounded-full border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <button
            onClick={() => setIsMonthOnly(true)}
            className={`flex-1 sm:flex-none px-4 sm:px-6 py-1.5 rounded-full text-[10px] sm:text-xs font-bold tracking-widest transition-all ${
              isMonthOnly
                ? "bg-primary text-white shadow-md"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
          >
            THIS MONTH
          </button>
          <button
            onClick={() => setIsMonthOnly(false)}
            className={`flex-1 sm:flex-none px-4 sm:px-6 py-1.5 rounded-full text-[10px] sm:text-xs font-bold tracking-widest transition-all ${
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
      <div className="bg-white dark:bg-slate-900 rounded-[20px] sm:rounded-[32px] p-4 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 sm:mb-10">
          <h2 className="text-[10px] sm:text-sm font-bold tracking-[0.2em] text-slate-900 dark:text-white uppercase">
            Account Performance
          </h2>
          <button
            onClick={() => setShowAccountModal(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-slate-50 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-100 dark:border-slate-700"
          >
            <Wallet className="w-4 h-4 text-primary" />
            <span>MANAGE ACCOUNT</span>
          </button>
        </div>

        <div className="flex flex-col xl:grid xl:grid-cols-4 gap-8 xl:gap-12">
          <div className="xl:col-span-3 -mx-2 sm:mx-0">
            <EquityCurveChart data={equityData} height={window.innerWidth < 640 ? 250 : 350} />
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-1 gap-6 sm:gap-8 xl:border-l border-slate-50 dark:border-slate-800 xl:pl-12">
            <StatItem label="Total Trades" value={stats.total} />
            <StatItem label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
            <StatItem
              label="SQN"
              value={stats.sqn.toFixed(2)}
              color={stats.sqn >= 2 ? "text-emerald-500" : undefined}
            />
            <StatItem
              label="R Achieved"
              value={`${stats.totalR.toFixed(1)}R`}
              color="text-emerald-500"
            />
            <StatItem
              label="Max RR Reached"
              value={`${stats.totalMaxR.toFixed(1)}R`}
              color="text-amber-500"
            />
            <StatItem
              label="Total P/L"
              value={`$${stats.totalPnl.toLocaleString()}`}
              color={stats.totalPnl >= 0 ? "text-emerald-500" : "text-rose-500"}
            />
          </div>
        </div>
      </div>

      {/* Tier 2: Discipline, Mistakes, Action Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <DisciplineGauge
          score={stats.discipline}
          totalTrades={stats.total}
          compliantTrades={stats.disciplined}
        />
        <MistakesCard mistakes={latestReview?.topMistakes || []} period={latestReview?.period} />
        <ActionPlanCard
          plan={latestReview?.actionPlan || { hardRules: [], optimization: [], training: [] }}
          period={latestReview?.period}
        />
      </div>

      {/* Playbook Performance Section */}
      <PlaybookPerformance trades={trades} playbooks={playbooks} />

      {/* Tier 3: Trading Calendar */}
      <div className="bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="p-5 sm:p-8 border-b border-slate-50 dark:border-slate-800">
          <h2 className="text-[10px] sm:text-sm font-bold tracking-[0.2em] text-slate-900 dark:text-white uppercase">
            Trading Calendar
          </h2>
        </div>
        <div className="overflow-x-auto hide-scrollbar">
          <TradingCalendar />
        </div>
      </div>

      {showAccountModal && (
        <AccountModal
          onClose={() => setShowAccountModal(false)}
          onRefresh={() => {
            queryClient.invalidateQueries({ queryKey: tradesQueryKey });
            queryClient.invalidateQueries({ queryKey: fundingQueryKey });
          }}
        />
      )}
    </div>
  );
}

function StatItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex flex-col">
      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 truncate">
        {label}
      </p>
      <h4 className={`text-lg sm:text-2xl font-black ${color || "text-slate-900 dark:text-white"}`}>
        {value}
      </h4>
    </div>
  );
}
