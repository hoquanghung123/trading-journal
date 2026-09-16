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
import { isSameMonth, format, parseISO, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DateRangePicker } from "../shared/DateRangePicker";
import { DateRange } from "react-day-picker";
import { Review } from "@/types/review";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [disciplinedOnly, setDisciplinedOnly] = useState(true);

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
    if (!dateRange?.from) return trades;
    
    const start = startOfDay(dateRange.from);
    const end = endOfDay(dateRange.to || dateRange.from);

    return trades.filter((t) => {
      const entryDate = parseISO(t.entryTime);
      return isWithinInterval(entryDate, { start, end });
    });
  }, [trades, dateRange]);

  const stats = useMemo(() => {
    const activeTrades = filteredTrades;
    const total = activeTrades.length;
    const cohort = disciplinedOnly ? activeTrades.filter((t) => t.complianceCheck) : activeTrades;
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

    const disciplinedTrades = activeTrades.filter((t) => t.complianceCheck);
    const totalDisciplined = disciplinedTrades.length;
    const wins = cohort.filter((t) => t.actualRr > 0);
    const winRate = cohort.length > 0 ? (wins.length / cohort.length) * 100 : 0;
    const totalPnl = activeTrades.reduce((acc, t) => acc + t.netPnl, 0);

    const pnls = cohort.map((t) => t.netPnl);
    const avgPnl = cohort.length > 0 ? pnls.reduce((a, b) => a + b, 0) / cohort.length : 0;
    const stdDev =
      cohort.length > 0
        ? Math.sqrt(pnls.map((p) => Math.pow(p - avgPnl, 2)).reduce((a, b) => a + b, 0) / cohort.length)
        : 0;
    const sqn = stdDev > 0 ? (avgPnl / stdDev) * Math.sqrt(cohort.length) : 0;

    const disciplined = disciplinedTrades.length;
    const discipline = (disciplined / total) * 100;

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
  }, [filteredTrades, disciplinedOnly]);

  const equityData = useMemo(() => {
    const sorted = [...filteredTrades].sort((a, b) => a.entryTime.localeCompare(b.entryTime));
    let running = 0;
    return sorted.map((t) => {
      running += t.netPnl;
      return {
        name: format(parseISO(t.entryTime), "MM/dd"),
        value: Number(running.toFixed(2)),
      };
    });
  }, [filteredTrades]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="h-full overflow-y-auto bg-background p-3 sm:p-8 space-y-5 sm:space-y-10 font-sans mobile-pb">
      {/* Page Header with Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
          Stats
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDisciplinedOnly((v) => !v)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
              disciplinedOnly
                ? "bg-primary text-white border-primary"
                : "bg-card text-muted-foreground border-border"
            }`}
          >
            {disciplinedOnly ? "Disciplined only" : "All trades"}
          </button>
          <DateRangePicker date={dateRange} setDate={setDateRange} />
        </div>
      </div>

      {/* Tier 1: ACCOUNT PERFORMANCE */}
      <div className="bg-card rounded-[20px] sm:rounded-[32px] p-4 sm:p-8 border border-border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 sm:mb-10">
          <h2 className="text-[10px] sm:text-sm font-bold tracking-[0.2em] text-foreground uppercase">
            Account Performance
          </h2>
          <button
            onClick={() => setShowAccountModal(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-muted rounded-full text-xs font-bold text-muted-foreground hover:bg-muted/80 transition-all border border-border"
          >
            <Wallet className="w-4 h-4 text-primary" />
            <span>MANAGE ACCOUNT</span>
          </button>
        </div>

        <div className="flex flex-col xl:grid xl:grid-cols-4 gap-8 xl:gap-12">
          <div className="xl:col-span-3 -mx-2 sm:mx-0">
            <EquityCurveChart data={equityData} height={window.innerWidth < 640 ? 250 : 350} />
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-1 gap-6 sm:gap-8 xl:border-l border-border xl:pl-12">
            <StatItem
              label="Total Trades"
              value={stats.total}
              tooltip="Tổng số lệnh thực hiện bao gồm lệnh follow và không follow playbook trong khoảng thời gian được chọn."
            />
            <StatItem
              label="Win Rate"
              value={`${stats.winRate.toFixed(1)}%`}
              tooltip="Win rate over the selected cohort (Disciplined only vs All trades)."
            />
            <StatItem
              label="SQN"
              value={stats.sqn.toFixed(2)}
              color={stats.sqn >= 2 ? "text-bull" : undefined}
              tooltip="System Quality Number: Đánh giá chất lượng hệ thống (chỉ tính trên các lệnh đúng kỷ luật). Công thức: (Lợi nhuận TB / Độ lệch chuẩn PnL) × √Số lệnh."
            />
            <StatItem
              label="R Achieved"
              value={`${stats.totalR.toFixed(1)}R`}
              color="text-bull"
              tooltip="Tổng số đơn vị R (Risk-Reward) thực tế đạt được từ tất cả các lệnh thực hiện (bao gồm follow và không follow playbook)."
            />
            <StatItem
              label="Max RR Reached"
              value={`${stats.totalMaxR.toFixed(1)}R`}
              color="text-warning"
              tooltip="Tổng số đơn vị R tối đa tiềm năng mà tất cả các lệnh thực hiện (bao gồm follow và không follow playbook) đã chạm tới."
            />
            <StatItem
              label="Total P/L"
              value={`$${stats.totalPnl.toLocaleString()}`}
              color={stats.totalPnl >= 0 ? "text-bull" : "text-destructive"}
              tooltip="Tổng lợi nhuận ròng thực tế của tài khoản (bao gồm cả lệnh follow và không follow playbook)."
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
      <PlaybookPerformance trades={filteredTrades} playbooks={playbooks} />

      {/* Tier 3: Trading Calendar */}
      <div className="bg-card rounded-[24px] sm:rounded-[32px] overflow-hidden border border-border">
        <div className="p-5 sm:p-8 border-b border-border">
          <h2 className="text-[10px] sm:text-sm font-bold tracking-[0.2em] text-foreground uppercase">
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
    </TooltipProvider>
  );
}

function StatItem({
  label,
  value,
  color,
  tooltip,
}: {
  label: string;
  value: string | number;
  color?: string;
  tooltip?: string;
}) {
  return (
    <div className="flex flex-col group/stat">
      <div className="flex items-center gap-1.5 mb-1">
        <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">
          {label}
        </p>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-muted-foreground hover:text-primary transition-colors">
                <Info className="w-3 h-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px] text-center">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <h4 className={`text-lg sm:text-2xl font-black ${color || "text-foreground"}`}>
        {value}
      </h4>
    </div>
  );
}
