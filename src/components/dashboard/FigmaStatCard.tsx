import React from "react";
import { TrendingUp, TrendingDown, LucideIcon } from "lucide-react";

interface FigmaStatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  isPositive?: boolean;
  icon: LucideIcon;
  variant?: "primary" | "secondary";
}

export function FigmaStatCard({
  label,
  value,
  trend,
  isPositive,
  icon: Icon,
  variant = "primary",
}: FigmaStatCardProps) {
  return (
    <div className={`p-6 rounded-[24px] border transition-all duration-300 ${
      variant === "primary" 
        ? "bg-white border-slate-100 shadow-sm hover:shadow-md dark:bg-slate-900/50 dark:border-slate-800" 
        : "bg-slate-50 border-transparent dark:bg-slate-800/30"
    }`}>
      <div className="flex justify-between items-center mb-4">
        <span className="text-[11px] font-bold tracking-[0.1em] text-slate-400 uppercase">
          {label}
        </span>
        <div className={`p-2 rounded-xl ${
          variant === "primary" 
            ? "bg-primary/10 text-primary" 
            : "bg-slate-200/50 text-slate-500 dark:bg-slate-700/50"
        }`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-baseline gap-3">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-sans">
          {value}
        </h3>
        {trend && (
          <div className={`flex items-center gap-0.5 text-[10px] font-bold ${
            isPositive ? "text-emerald-500" : "text-rose-500"
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend}
          </div>
        )}
      </div>
    </div>
  );
}
