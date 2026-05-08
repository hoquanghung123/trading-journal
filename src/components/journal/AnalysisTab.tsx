import { useState } from "react";
import { Plus, Settings2, Trash2, Check, X, Shield, Activity, TrendingUp, ChevronRight } from "lucide-react";
import { Trade } from "@/lib/trades";
import { UserSettings, updateSettings } from "@/lib/settings";
import { toast } from "sonner";

interface Props {
  trade: Trade;
  settings: UserSettings;
  onUpdate: (patch: Partial<Trade>) => void;
  onRefreshSettings: () => void;
}

type MetricType = "bias_matrix" | "presence_list" | "probability" | "text";

interface MetricSchema {
  id: string;
  label: string;
  type: MetricType;
  timeframes?: string[];
}

const TIMEFRAMES = ["MN", "W", "D", "H4", "H1", "M15", "M5", "M1"];

export function AnalysisTab({ trade, settings, onUpdate, onRefreshSettings }: Props) {
  const [designMode, setDesignMode] = useState(false);
  const schema = (settings.executionSchema as MetricSchema[]) || [];
  const values = trade.experimentalArgs?.metrics || {};

  const updateValue = (metricId: string, val: any) => {
    const newMetrics = { ...values, [metricId]: val };
    onUpdate({
      experimentalArgs: {
        ...trade.experimentalArgs,
        metrics: { ...values, [metricId]: val },
      },
    });
  };

  const handleAddMetric = async () => {
    const newMetric: MetricSchema = {
      id: crypto.randomUUID(),
      label: "New Metric",
      type: "bias_matrix",
      timeframes: ["D", "H4", "H1"],
    };
    const newSchema = [...schema, newMetric];
    try {
      await updateSettings({ executionSchema: newSchema });
      onRefreshSettings();
      toast.success("Metric added");
    } catch (e) {
      toast.error("Failed to add metric");
    }
  };

  const handleDeleteMetric = async (id: string) => {
    const newSchema = schema.filter((m) => m.id !== id);
    try {
      await updateSettings({ executionSchema: newSchema });
      onRefreshSettings();
      toast.success("Metric removed");
    } catch (e) {
      toast.error("Failed to remove metric");
    }
  };

  const handleUpdateMetric = async (id: string, patch: Partial<MetricSchema>) => {
    const newSchema = schema.map((m) => (m.id === id ? { ...m, ...patch } : m));
    try {
      await updateSettings({ executionSchema: newSchema });
      onRefreshSettings();
    } catch (e) {
      toast.error("Failed to update metric");
    }
  };

  if (schema.length === 0 && !designMode) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="w-20 h-20 rounded-[32px] bg-primary/10 flex items-center justify-center">
          <Activity className="w-10 h-10 text-primary" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-black uppercase tracking-tighter">Zero Analysis Data</h3>
          <p className="text-sm text-muted-foreground font-medium max-w-xs mx-auto">
            You haven't defined any execution metrics yet. Build your custom tracking system from zero.
          </p>
        </div>
        <button
          onClick={() => setDesignMode(true)}
          className="forest-gradient px-8 py-3 rounded-2xl text-xs font-black text-white uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all active:scale-95"
        >
          Setup Analysis System
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-4 w-1 bg-primary rounded-full" />
          <h3 className="text-xs font-black uppercase tracking-widest text-primary">
            Trade Analysis & Context
          </h3>
        </div>
        <button
          onClick={() => setDesignMode(!designMode)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            designMode
              ? "bg-primary text-white shadow-lg shadow-primary/20"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          {designMode ? "Exit Design Mode" : "Design Mode"}
        </button>
      </div>

      <div className="space-y-6">
        {schema.map((metric) => (
          <div
            key={metric.id}
            className={`group relative p-6 rounded-[32px] border transition-all ${
              designMode ? "bg-muted/10 border-dashed border-primary/30" : "bg-white border-border/50 shadow-sm"
            }`}
          >
            {designMode && (
              <button
                onClick={() => handleDeleteMetric(metric.id)}
                className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-destructive text-white flex items-center justify-center shadow-lg hover:scale-110 transition-all active:scale-95 z-10"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-1.5 flex-1">
                {designMode ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <input
                        className="text-sm font-black uppercase tracking-widest bg-transparent border-b-2 border-primary/20 focus:border-primary outline-none px-1 py-0.5 w-full max-w-xs"
                        value={metric.label}
                        onChange={(e) => handleUpdateMetric(metric.id, { label: e.target.value })}
                        placeholder="Metric Name"
                      />
                      <select
                        className="text-[10px] font-black uppercase tracking-widest bg-muted/50 rounded-lg px-2 py-1 outline-none"
                        value={metric.type}
                        onChange={(e) => handleUpdateMetric(metric.id, { type: e.target.value as MetricType })}
                      >
                        <option value="bias_matrix">Bias Matrix</option>
                        <option value="presence_list">TF Presence</option>
                        <option value="probability">Probability</option>
                        <option value="text">Simple Text</option>
                      </select>
                    </div>
                    {(metric.type === "bias_matrix" || metric.type === "presence_list") && (
                      <div className="flex flex-wrap gap-2">
                        {TIMEFRAMES.map((tf) => {
                          const isSelected = metric.timeframes?.includes(tf);
                          return (
                            <button
                              key={tf}
                              onClick={() => {
                                const current = metric.timeframes || [];
                                const next = isSelected
                                  ? current.filter((x) => x !== tf)
                                  : [...current, tf].sort(
                                      (a, b) => TIMEFRAMES.indexOf(a) - TIMEFRAMES.indexOf(b)
                                    );
                                handleUpdateMetric(metric.id, { timeframes: next });
                              }}
                              className={`px-3 py-1 rounded-lg text-[9px] font-black transition-all ${
                                isSelected
                                  ? "bg-primary text-white shadow-sm"
                                  : "bg-muted text-muted-foreground hover:bg-muted-foreground/10"
                              }`}
                            >
                              {tf}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/30" />
                      {metric.label}
                    </h4>
                  </>
                )}
              </div>

              {!designMode && (
                <div className="flex-shrink-0">
                  {metric.type === "bias_matrix" && (
                    <div className="flex flex-wrap gap-3">
                      {metric.timeframes?.map((tf) => {
                        const bias = values[metric.id]?.[tf] || "neutral";
                        return (
                          <div key={tf} className="flex flex-col items-center gap-1.5">
                            <span className="text-[8px] font-black text-muted-foreground/50 uppercase tracking-widest">
                              {tf}
                            </span>
                            <div className="flex bg-muted/30 p-1 rounded-xl border border-border/50">
                              <button
                                onClick={() =>
                                  updateValue(metric.id, { ...values[metric.id], [tf]: "bull" })
                                }
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                  bias === "bull"
                                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                                    : "text-muted-foreground/30 hover:text-emerald-500"
                                }`}
                              >
                                <TrendingUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  updateValue(metric.id, { ...values[metric.id], [tf]: "bear" })
                                }
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                                  bias === "bear"
                                    ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                                    : "text-muted-foreground/30 hover:text-rose-500"
                                }`}
                              >
                                <TrendingUp className="w-3.5 h-3.5 rotate-180" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {metric.type === "presence_list" && (
                    <div className="flex flex-wrap gap-2">
                      {metric.timeframes?.map((tf) => {
                        const isPresent = values[metric.id]?.includes(tf);
                        return (
                          <button
                            key={tf}
                            onClick={() => {
                              const current = values[metric.id] || [];
                              const next = isPresent
                                ? current.filter((x: string) => x !== tf)
                                : [...current, tf].sort(
                                    (a, b) => TIMEFRAMES.indexOf(a) - TIMEFRAMES.indexOf(b)
                                  );
                              updateValue(metric.id, next);
                            }}
                            className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all border shadow-sm ${
                              isPresent
                                ? "bg-primary text-white border-primary shadow-primary/20 scale-105"
                                : "bg-white text-muted-foreground border-border hover:border-primary/30"
                            }`}
                          >
                            {tf}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {metric.type === "probability" && (
                    <div className="flex bg-muted/30 p-1.5 rounded-2xl border border-border/50 gap-1.5">
                      {["Low", "High"].map((p) => (
                        <button
                          key={p}
                          onClick={() => updateValue(metric.id, p.toLowerCase())}
                          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            values[metric.id] === p.toLowerCase()
                              ? p === "High"
                                ? "bg-primary text-white shadow-lg shadow-primary/20"
                                : "bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                              : "bg-white border border-border/50 text-muted-foreground hover:bg-white hover:border-primary/20"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}

                  {metric.type === "text" && (
                    <input
                      className="h-11 w-full sm:w-64 bg-muted/30 border border-border rounded-xl px-4 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20"
                      value={values[metric.id] || ""}
                      onChange={(e) => updateValue(metric.id, e.target.value)}
                      placeholder="Enter value..."
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {designMode && (
          <button
            onClick={handleAddMetric}
            className="w-full py-10 rounded-[32px] border-2 border-dashed border-primary/20 text-primary/40 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-3 group"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">
              Add New Metric Widget
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
