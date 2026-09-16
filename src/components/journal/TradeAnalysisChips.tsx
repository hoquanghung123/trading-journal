import { TrendingDown, TrendingUp } from "lucide-react";
import type { Trade } from "@/lib/trades";

export function TradeAnalysisChips({
  trade,
  schema,
  compact = false,
}: {
  trade: Trade;
  schema?: any[];
  compact?: boolean;
}) {
  const metrics = schema ?? [];
  if (!metrics.length) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "max-w-[280px]" : ""}`}>
      {metrics.map((metric: any) => {
        const val = trade.experimentalArgs?.metrics?.[metric.id];
        if (!val || (Array.isArray(val) && val.length === 0)) return null;

        if (metric.type === "bias_matrix") {
          return (
            <div
              key={metric.id}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/30 border border-border/50 whitespace-nowrap"
            >
              <span className="text-[8px] font-black uppercase tracking-tighter text-muted-foreground/60">
                {metric.label}:
              </span>
              <div className="flex items-center gap-2">
                {Object.entries(val as Record<string, string>).map(([tf, b]) => (
                  <div key={tf} className="flex items-center gap-0.5">
                    <span className="text-[9px] font-black uppercase">{tf}</span>
                    {b === "bull" ? (
                      <TrendingUp className="w-2.5 h-2.5 text-bull" />
                    ) : (
                      <TrendingDown className="w-2.5 h-2.5 text-destructive" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        let displayVal = "";
        if (metric.type === "presence_list") displayVal = (val as string[]).join(", ");
        else if (metric.type === "probability" || metric.type === "text") displayVal = String(val);
        if (!displayVal) return null;

        return (
          <div
            key={metric.id}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/30 border border-border/50 whitespace-nowrap"
          >
            <span className="text-[8px] font-black uppercase tracking-tighter text-muted-foreground/60">
              {metric.label}:
            </span>
            <span className="text-[9px] font-bold text-foreground uppercase tracking-tight">
              {displayVal}
            </span>
          </div>
        );
      })}
    </div>
  );
}
