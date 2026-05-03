import { useMemo, useState } from "react";
import {
  getQuarter,
  getYear,
  isSameMonth,
  isSameQuarter,
  isSameYear,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  format,
} from "date-fns";
import { Trade } from "@/lib/trades";
import { PlaybookModel } from "@/types/playbook";
import { WinrateBarChart, DistributionDonutChart } from "./DashboardCharts";
import { Target, BarChart3, PieChart as PieChartIcon, TrendingUp, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PlaybookPerformanceProps {
  trades: Trade[];
  playbooks: PlaybookModel[];
}

export function PlaybookPerformance({ trades, playbooks }: PlaybookPerformanceProps) {
  // We only show compliant trades in this section
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => t.complianceCheck);
  }, [trades]);

  const stats = useMemo(() => {
    const total = filteredTrades.length;
    if (total === 0) return { total: 0, wins: 0, winRate: 0, pnl: 0 };

    const wins = filteredTrades.filter((t) => t.actualRr > 0).length;
    const winRate = (wins / total) * 100;
    const pnl = filteredTrades.reduce((acc, t) => acc + t.netPnl, 0);

    return { total, wins, winRate, pnl };
  }, [filteredTrades]);

  const winrateByPair = useMemo(() => {
    const groups: Record<string, { total: number; wins: number }> = {};
    filteredTrades.forEach((t) => {
      if (!groups[t.symbol]) groups[t.symbol] = { total: 0, wins: 0 };
      groups[t.symbol].total++;
      if (t.actualRr > 0) groups[t.symbol].wins++;
    });

    return Object.entries(groups)
      .map(([name, data]) => ({
        name,
        value: (data.wins / data.total) * 100,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTrades]);

  const winrateBySetup = useMemo(() => {
    const groups: Record<string, { total: number; wins: number }> = {};
    filteredTrades.forEach((t) => {
      const setup = playbooks.find((p) => p.id === t.setupId);
      const name = setup?.name || "Unknown Setup";
      if (!groups[name]) groups[name] = { total: 0, wins: 0 };
      groups[name].total++;
      if (t.actualRr > 0) groups[name].wins++;
    });

    return Object.entries(groups)
      .map(([name, data]) => ({
        name,
        value: (data.wins / data.total) * 100,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTrades, playbooks]);

  const distributionByPair = useMemo(() => {
    const groups: Record<string, number> = {};
    filteredTrades.forEach((t) => {
      groups[t.symbol] = (groups[t.symbol] || 0) + 1;
    });

    return Object.entries(groups)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTrades]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-black tracking-[0.2em] text-slate-900 dark:text-white uppercase">
              Performance Follow Playbook
            </h2>
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            Tracking discipline-only performance
          </p>
        </div>
      </div>

      <div className="space-y-12">
        {/* Row 1: All Winrate Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Total Playbook Winrate Card */}
          <div className="h-full">
            <div className="flex items-center gap-2 border-b border-slate-50 dark:border-slate-800 pb-4 mb-6">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Overall Performance
              </h3>
            </div>
            <QuickStat
              label="Playbook Winrate"
              value={`${stats.winRate.toFixed(1)}%`}
              subValue={`${stats.wins} Wins / ${stats.total} Trades`}
              icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
              tooltip="Tỉ lệ thắng chỉ tính riêng cho các lệnh tuân thủ đúng Playbook (Compliance Check = True)."
            />
          </div>

          {/* Winrate by Pair */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-400" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Winrate by Pair
                </h3>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-slate-300 hover:text-primary transition-colors">
                    <Info className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px] text-center">
                  Tỉ lệ thắng của các lệnh đúng kỷ luật, phân loại theo từng cặp tiền/tài sản giao dịch.
                </TooltipContent>
              </Tooltip>
            </div>
            {winrateByPair.length > 0 ? (
              <WinrateBarChart data={winrateByPair} height={180} />
            ) : (
              <EmptyState />
            )}
          </div>

          {/* Winrate by Setup */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-slate-400" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Winrate by Setup
                </h3>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-slate-300 hover:text-primary transition-colors">
                    <Info className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px] text-center">
                  Tỉ lệ thắng của các lệnh đúng kỷ luật, phân loại theo từng Setup kỹ thuật mà bạn đã định nghĩa.
                </TooltipContent>
              </Tooltip>
            </div>
            {winrateBySetup.length > 0 ? (
              <WinrateBarChart data={winrateBySetup} height={180} />
            ) : (
              <EmptyState />
            )}
          </div>
        </div>

        {/* Row 2: Distribution */}
        <div className="pt-10 border-t border-slate-50 dark:border-slate-800">
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-2 pb-4">
              <PieChartIcon className="w-4 h-4 text-slate-400" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Trade Distribution
              </h3>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-slate-300 hover:text-primary transition-colors">
                    <Info className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px] text-center">
                  Biểu đồ phân bổ tỉ lệ số lượng các lệnh đúng kỷ luật giữa các cặp tiền/tài sản.
                </TooltipContent>
              </Tooltip>
            </div>
            {distributionByPair.length > 0 ? (
              <DistributionDonutChart data={distributionByPair} height={250} />
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStat({
  label,
  value,
  subValue,
  color,
  icon,
  tooltip,
}: {
  label: string;
  value: string | number;
  subValue: string;
  color?: string;
  icon: React.ReactNode;
  tooltip?: string;
}) {
  return (
    <div className="p-5 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800/50">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-1.5">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
            {label}
          </p>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-slate-300 hover:text-primary transition-colors">
                  <Info className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px] text-center">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="p-1.5 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
          {icon}
        </div>
      </div>
      <h4 className={`text-xl font-black mb-1 ${color || "text-slate-900 dark:text-white"}`}>
        {value}
      </h4>
      <p className="text-[9px] font-bold text-slate-400/80 uppercase tracking-tight">{subValue}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-[200px] flex items-center justify-center border-2 border-dashed border-slate-50 dark:border-slate-800 rounded-[24px]">
      <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">
        No data for this period
      </p>
    </div>
  );
}
