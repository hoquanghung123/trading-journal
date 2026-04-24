import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  isPositive?: boolean;
  isMonth: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
}

export function MetricCard({
  label,
  value,
  subValue,
  isPositive,
  isMonth,
  onToggle,
  icon,
}: MetricCardProps) {
  return (
    <div className="glass p-5 rounded-xl border border-terminal-border/50 relative overflow-hidden group hover:border-neon-cyan/30 transition-all duration-300">
      {/* Background Glow */}
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-neon-cyan/5 blur-3xl rounded-full group-hover:bg-neon-cyan/10 transition-colors" />

      <div className="flex justify-between items-start mb-4">
        <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-neon-cyan">
          {icon}
        </div>
        <button
          onClick={onToggle}
          className={`flex items-center gap-2 px-2 py-1 rounded-full text-[9px] font-bold tracking-widest border transition-all ${
            isMonth
              ? "bg-neon-cyan/15 border-neon-cyan/40 text-neon-cyan"
              : "bg-white/5 border-white/10 text-muted-foreground"
          }`}
        >
          {isMonth ? "MONTH" : "ALL TIME"}
        </button>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase font-bold">
          {label}
        </p>
        <h3 className="text-2xl font-bold tracking-tight text-white font-mono">
          {value}
        </h3>
        {subValue && (
          <div className="flex items-center gap-1.5 mt-1">
            {isPositive !== undefined && (
              isPositive ? (
                <TrendingUp className="w-3 h-3 text-emerald-400" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-400" />
              )
            )}
            <span className={`text-xs font-mono font-medium ${
              isPositive === undefined ? "text-muted-foreground" : 
              isPositive ? "text-emerald-400" : "text-red-400"
            }`}>
              {subValue}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
