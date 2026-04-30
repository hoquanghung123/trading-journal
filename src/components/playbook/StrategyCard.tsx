import { PlaybookModel } from "@/types/playbook";
import {
  Clock,
  Activity,
  CheckCircle2,
  ShieldAlert,
  LayoutDashboard,
  TrendingUp,
} from "lucide-react";

interface StrategyCardProps {
  model: PlaybookModel;
  onClick: () => void;
  stats?: { winRate: number; avgRr: number; count: number };
}

export function StrategyCard({ model, onClick, stats }: StrategyCardProps) {
  const thumbnail = model.images.find((img) => img.type === "perfect")?.url;

  return (
    <div
      onClick={onClick}
      className="bg-white group rounded-2xl overflow-hidden cursor-pointer border border-primary/10 hover:border-primary/30 transition-all duration-500 flex flex-col h-full hover:shadow-2xl hover:shadow-primary/5 relative"
    >
      {/* Thumbnail Area */}
      <div className="h-44 w-full bg-primary/[0.02] border-b border-primary/5 relative overflow-hidden flex items-center justify-center">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt="Thumbnail"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="text-primary/10 flex flex-col items-center gap-3">
            <LayoutDashboard className="w-12 h-12 stroke-[1.5]" />
            <span className="text-[9px] font-black tracking-[0.2em] uppercase opacity-50">
              No Study Captured
            </span>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[9px] font-black tracking-widest uppercase backdrop-blur-md border shadow-sm ${
              model.status === "Approved"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                : model.status === "Testing"
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-600"
                  : "bg-indigo-500/10 border-indigo-500/20 text-indigo-600"
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                model.status === "Approved"
                  ? "bg-emerald-500"
                  : model.status === "Testing"
                    ? "bg-amber-500"
                    : "bg-indigo-500"
              }`}
            />
            {model.status}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-3.5 h-3.5 text-primary/40" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {model.marketCondition}
          </span>
        </div>

        <h3 className="text-lg font-black text-foreground group-hover:text-primary transition-colors line-clamp-1 leading-tight uppercase tracking-tight">
          {model.name}
        </h3>

        {/* Stats Grid */}
        <div className="mt-6 pt-6 flex items-center justify-between border-t border-primary/5">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase font-black tracking-[0.2em] text-muted-foreground/60">
              Winrate
            </span>
            <span
              className={`text-base font-black tabular-nums ${stats && stats.winRate >= 60 ? "text-emerald-500" : stats && stats.winRate < 40 ? "text-rose-500" : "text-foreground"}`}
            >
              {stats ? `${stats.winRate.toFixed(0)}%` : "N/A"}
            </span>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] uppercase font-black tracking-[0.2em] text-muted-foreground/60">
              Efficiency
            </span>
            <span className="text-base font-black text-foreground tabular-nums">
              {stats ? stats.avgRr.toFixed(1) : "—"}{" "}
              <span className="text-[10px] text-muted-foreground font-bold">RR</span>
            </span>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5" /> {model.timeframe}
          </div>
          <div className="text-[10px] font-black text-primary bg-primary/5 px-3 py-1 rounded-full border border-primary/10 uppercase tracking-widest">
            {stats?.count || 0} Samples
          </div>
        </div>
      </div>

      {/* Hover Background Accent */}
      <div className="absolute inset-0 bg-primary/[0.01] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
}
