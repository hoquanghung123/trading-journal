import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { AlertTriangle, ListChecks } from "lucide-react";

interface DisciplineGaugeProps {
  score: number;
  totalTrades: number;
  compliantTrades: number;
}

export function DisciplineGauge({ score, totalTrades, compliantTrades }: DisciplineGaugeProps) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getStatus = (s: number) => {
    if (s >= 90) return { label: "Elite", color: "text-emerald-500" };
    if (s >= 75) return { label: "Disciplined", color: "text-primary" };
    if (s >= 50) return { label: "Average", color: "text-amber-500" };
    return { label: "Poor", color: "text-rose-500" };
  };

  const status = getStatus(score);

  return (
    <TooltipProvider>
      <div className="flex flex-col items-center justify-between p-8 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm h-full">
        <h3 className="text-[11px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-4">Discipline Score</h3>
        
        <div className="relative flex items-center justify-center">
          <svg className="w-40 h-40 transform -rotate-90">
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              className="text-slate-100 dark:text-slate-800"
            />
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="text-primary transition-all duration-1000 ease-out"
            />
          </svg>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute flex flex-col items-center cursor-help">
                <span className="text-3xl font-black text-slate-900 dark:text-white">{Math.round(score)}%</span>
                <span className={`text-[10px] font-black uppercase tracking-widest ${status.color}`}>{status.label}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-slate-900 text-white border-slate-800 p-4 rounded-2xl shadow-2xl">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-2 mb-2">Thresholds</p>
                <div className="flex items-center justify-between gap-8">
                  <span className="text-xs font-bold text-emerald-400">Elite</span>
                  <span className="text-xs font-medium text-slate-300">&gt; 90%</span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <span className="text-xs font-bold text-primary">Disciplined</span>
                  <span className="text-xs font-medium text-slate-300">&gt; 75%</span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <span className="text-xs font-bold text-amber-400">Average</span>
                  <span className="text-xs font-medium text-slate-300">&gt; 50%</span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <span className="text-xs font-bold text-rose-400">Poor</span>
                  <span className="text-xs font-medium text-slate-300">&lt; 50%</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

      <div className="w-full mt-6 pt-6 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center px-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compliance</span>
          <span className="text-sm font-black text-slate-900 dark:text-white">{compliantTrades} / {totalTrades}</span>
        </div>
        <div className="text-right flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target</span>
          <span className="text-sm font-black text-emerald-500">90%+</span>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}

interface MistakesCardProps {
  mistakes: Array<{ id: string; text: string; fixed: boolean }> | string[];
  period?: string;
}

export function MistakesCard({ mistakes, period }: MistakesCardProps) {
  const validMistakes = mistakes.filter(m => {
    const text = typeof m === "string" ? m : m.text;
    return text.trim() !== "";
  });

  return (
    <div className="p-6 bg-orange-50 dark:bg-orange-950/20 rounded-[32px] border border-orange-100 dark:border-orange-900/30 shadow-sm h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-500/20">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-orange-900 dark:text-orange-400 uppercase tracking-widest">Top Mistakes</h3>
        </div>
        {period && (
          <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest bg-orange-100/50 dark:bg-orange-900/30 px-3 py-1 rounded-full border border-orange-200/50">
            {period}
          </span>
        )}
      </div>
      <div className="space-y-3">
        {validMistakes.length > 0 ? (
          validMistakes.map((m, i) => {
            const text = typeof m === "string" ? m : m.text;
            const isFixed = typeof m === "string" ? false : m.fixed;
            return (
              <div key={i} className="flex items-start gap-3 p-3 bg-white/50 dark:bg-orange-900/10 rounded-2xl border border-orange-200/50 dark:border-orange-800/30">
                <input 
                  type="checkbox" 
                  defaultChecked={isFixed}
                  className="mt-1 rounded-full border-orange-300 text-orange-500 focus:ring-orange-500" 
                />
                <span className={`text-xs font-medium ${isFixed ? "line-through text-orange-400" : "text-orange-800 dark:text-orange-300"}`}>
                  {text}
                </span>
              </div>
            );
          })
        ) : (
          <p className="text-xs text-orange-600/50 italic p-4 text-center">No mistakes logged in last review.</p>
        )}
      </div>
    </div>
  );
}

interface ActionPlanProps {
  plan: {
    hardRules: Array<{ id: string; text: string; checked: boolean }> | string[];
    optimization: Array<{ id: string; text: string; checked: boolean }> | string[];
    training: Array<{ id: string; text: string; checked: boolean }> | string[];
  };
  period?: string;
}

export function ActionPlanCard({ plan, period }: ActionPlanProps) {
  const categories = [
    { label: "Hard Rules", items: plan.hardRules, color: "text-rose-500" },
    { label: "Optimization", items: plan.optimization, color: "text-primary" },
    { label: "Training", items: plan.training, color: "text-amber-500" },
  ];

  return (
    <div className="p-6 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
            <ListChecks className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest">Action Plan v3.0</h3>
        </div>
        {period && (
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-700">
            {period}
          </span>
        )}
      </div>
      <div className="space-y-6">
        {categories.map((cat, i) => (
          <div key={i} className="space-y-2">
            <h4 className={`text-[10px] font-black uppercase tracking-[0.2em] ${cat.color}`}>{cat.label}</h4>
            <div className="space-y-2">
              {cat.items.filter(item => (typeof item === "string" ? item : item.text).trim() !== "").length > 0 ? (
                cat.items
                  .filter(item => (typeof item === "string" ? item : item.text).trim() !== "")
                  .map((item, idx) => {
                    const text = typeof item === "string" ? item : item.text;
                    const isChecked = typeof item === "string" ? false : item.checked;
                    return (
                      <div key={idx} className="flex items-center gap-2 group cursor-pointer">
                        <div className={`w-1 h-1 rounded-full ${isChecked ? "bg-primary" : "bg-slate-300 dark:bg-slate-700"} group-hover:bg-primary transition-colors`} />
                        <span className={`text-xs transition-colors ${isChecked ? "text-slate-400 line-through" : "text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200"}`}>
                          {text}
                        </span>
                      </div>
                    );
                  })
              ) : (
                <span className="text-[10px] text-slate-300 italic">No tasks.</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
