import { PlaybookModel } from "@/types/playbook";
import { Clock, Activity, CheckCircle2, ShieldAlert } from "lucide-react";

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
      className="bg-white group rounded-2xl overflow-hidden cursor-pointer border border-border hover:border-primary transition-all duration-300 flex flex-col h-full hover:shadow-xl relative"
    >
      {/* Thumbnail Area */}
      <div className="h-40 w-full bg-muted border-b border-border relative overflow-hidden flex items-center justify-center">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt="Thumbnail"
            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
          />
        ) : (
          <div className="text-muted-foreground/30 flex flex-col items-center gap-2">
            <Activity className="w-10 h-10" />
            <span className="text-[10px] font-bold tracking-widest uppercase">No Visuals</span>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
          {model.status === "Approved" ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/90 text-[10px] font-bold text-white tracking-wider uppercase backdrop-blur-md shadow-lg">
              <CheckCircle2 className="w-3 h-3" /> {model.status}
            </div>
          ) : model.status === "Testing" ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/90 text-[10px] font-bold text-white tracking-wider uppercase backdrop-blur-md shadow-lg">
              <ShieldAlert className="w-3 h-3" /> {model.status}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/90 text-[10px] font-bold text-white tracking-wider uppercase backdrop-blur-md shadow-lg">
              <Activity className="w-3 h-3" /> {model.status}
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">
          {model.name}
        </h3>
        
        <div className="mt-auto pt-6 flex items-center justify-between border-t border-border/50">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">Winrate</span>
            <span className={`text-sm font-black ${stats && stats.winRate >= 60 ? "text-emerald-500" : stats && stats.winRate < 40 ? "text-rose-500" : "text-foreground"}`}>
              {stats ? `${stats.winRate.toFixed(0)}%` : "N/A"}
            </span>
          </div>
          
          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">Avg RR</span>
            <span className="text-sm font-black text-foreground">
              {stats ? stats.avgRr.toFixed(1) : "—"}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
           <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
             <Clock className="w-3 h-3" /> {model.timeframe}
           </div>
           <div className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
             {stats?.count || 0} Trades
           </div>
        </div>
      </div>
    </div>
  );
}
