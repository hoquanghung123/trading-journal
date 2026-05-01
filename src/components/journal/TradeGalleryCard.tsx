import { Trade, computeOutcome, outcomeStyle } from "@/lib/trades";
import { format } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  BarChart2,
  CheckCircle2,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { getAssetIconUrl } from "@/lib/symbols";
import { getChartUrl } from "@/lib/journal";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { focusBiasEntry, navigateToPage } from "@/lib/nav-bus";

interface TradeGalleryCardProps {
  trade: Trade;
  onClick: () => void;
  showGrade?: boolean;
  cols?: Record<string, boolean>;
  playbookName?: string;
}

const gradeStyle: Record<string, string> = {
  "A+": "bg-primary text-primary-foreground shadow-primary/20",
  A: "bg-amber-500 text-white shadow-amber-500/20",
  B: "bg-destructive text-destructive-foreground shadow-destructive/20",
};

export function TradeGalleryCard({
  trade,
  onClick,
  showGrade,
  cols = {},
  playbookName,
}: TradeGalleryCardProps) {
  const [hovered, setHovered] = useState(false);
  const outcome = computeOutcome(trade.actualRr, trade.maxRr, trade.netPnl);
  const style = outcomeStyle[outcome.color];

  // Default to true if cols is not provided for a specific key
  const show = (key: string) => cols[key] !== false;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative bg-white rounded-3xl border border-border/50 overflow-hidden hover:border-primary/30 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5 cursor-pointer flex flex-col h-full"
    >
      {/* Chart Preview Area */}
      {show("images") && (
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          {/* Before Image (Default) */}
          <div
            className={`absolute inset-0 transition-opacity duration-700 ${hovered && trade.afterImg ? "opacity-0" : "opacity-100"}`}
          >
            {trade.beforeImg ? (
              <img
                src={getChartUrl(trade.beforeImg)}
                alt="Before"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                <BarChart2 className="w-12 h-12" />
              </div>
            )}
            <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-md text-[9px] font-black text-white uppercase tracking-widest border border-white/10">
              PRE
            </div>
          </div>

          {/* After Image (On Hover) */}
          {trade.afterImg && (
            <div
              className={`absolute inset-0 transition-opacity duration-700 ${hovered ? "opacity-100" : "opacity-0"}`}
            >
              <img
                src={getChartUrl(trade.afterImg)}
                alt="After"
                className="w-full h-full object-cover transition-transform duration-700 scale-110 group-hover:scale-100"
              />
              <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-primary/80 backdrop-blur-md text-[9px] font-black text-white uppercase tracking-widest border border-white/10">
                POST
              </div>
            </div>
          )}

          {/* Floating Badges */}
          <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
            {show("side") && (
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg ${
                  trade.side === "buy"
                    ? "bg-primary text-primary-foreground"
                    : "bg-destructive text-destructive-foreground"
                }`}
              >
                {trade.side}
              </span>
            )}
            {showGrade && show("grade") && trade.grade && (
              <span
                className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black shadow-lg ${gradeStyle[trade.grade] || ""}`}
              >
                {trade.grade}
              </span>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-center gap-2">
            {getAssetIconUrl(trade.symbol) && (
              <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 bg-white flex items-center justify-center shadow-sm">
                <img
                  src={getAssetIconUrl(trade.symbol)!}
                  alt={trade.symbol}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <h3 className="text-xl font-black text-white tracking-tight">{trade.symbol}</h3>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="p-5 flex flex-col flex-1 gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {show("entryTime") && (
              <>
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {format(new Date(trade.entryTime), "dd/MM/yy HH:mm")}
                </span>
              </>
            )}
          </div>
          {show("outcome") && (
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${style}`}
            >
              {outcome.label}
            </span>
          )}
        </div>

        {show("stats") && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-2xl bg-muted/30 border border-border/30">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                Profit/Loss
              </p>
              <div className="flex items-center gap-1.5">
                {trade.netPnl >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                )}
                <span
                  className={`text-sm font-black ${trade.netPnl >= 0 ? "text-primary" : "text-destructive"}`}
                >
                  {trade.netPnl >= 0 ? "+" : ""}
                  {trade.netPnl.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-muted/30 border border-border/30">
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                RR Achieved
              </p>
              <p className="text-sm font-black text-foreground">
                {trade.actualRr}{" "}
                <span className="text-[10px] text-muted-foreground font-medium">/ {trade.maxRr}</span>
              </p>
            </div>
          </div>
        )}

        {/* Compliance Footer */}
        <div className="mt-auto pt-4 border-t border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {show("compliance") && (
              <>
                {trade.complianceCheck ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                )}
                <span
                  className={`text-[9px] font-bold uppercase tracking-widest ${trade.complianceCheck ? "text-primary" : "text-destructive"}`}
                >
                  {trade.complianceCheck ? "Followed" : "Incomplete"}
                </span>
              </>
            )}
          </div>
          {show("status") && (
            <div className="px-2.5 py-0.5 rounded-lg bg-muted text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
              {trade.status}
            </div>
          )}
          {show("bias") && trade.biasEntryId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateToPage("bias");
                setTimeout(() => focusBiasEntry(trade.biasEntryId!), 50);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all border border-primary/20"
              title="Go to Bias entry"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {show("playbook") && playbookName && (
          <div className="mt-2 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/20 border border-border/30 w-fit">
            <BookOpen className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate max-w-[150px]">
              {playbookName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
