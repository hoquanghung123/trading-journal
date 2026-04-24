import { useState } from "react";
import { PlaybookModel, SetupConfluences, ExecutionRules } from "@/types/playbook";
import { X, Save, Target, CheckSquare, Settings2, FileText, Clock, TrendingUp } from "lucide-react";
import { generateId } from "@/lib/utils";

interface StrategyFormProps {
  initialData?: PlaybookModel;
  onSave: (model: PlaybookModel) => void;
  onCancel: () => void;
}

export function StrategyForm({ initialData, onSave, onCancel }: StrategyFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [timeframe, setTimeframe] = useState(initialData?.timeframe || "1H");
  const [marketCondition, setMarketCondition] = useState(initialData?.marketCondition || "Trending");
  const [killzones, setKillzones] = useState(initialData?.killzones || "");
  const [status, setStatus] = useState<"Approved" | "Testing">(initialData?.status || "Testing");
  const [definition, setDefinition] = useState(initialData?.definition || "");

  const [confluences, setConfluences] = useState<SetupConfluences>(
    initialData?.setupConfluences || []
  );
  const [newConfluence, setNewConfluence] = useState("");

  const [execution, setExecution] = useState<ExecutionRules>(
    initialData?.executionRules || {
      entry: "",
      stopLoss: "",
      takeProfit: "",
      riskPercent: "1%",
      breakEven: "",
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    const model: PlaybookModel = {
      id: initialData?.id || generateId(),
      name,
      timeframe,
      marketCondition,
      killzones,
      status,
      definition,
      setupConfluences: confluences,
      executionRules: execution,
      images: initialData?.images || [],
    };

    onSave(model);
  };

  const addConfluence = () => {
    if (!newConfluence.trim()) return;
    if (confluences.includes(newConfluence.trim())) return;
    setConfluences([...confluences, newConfluence.trim()]);
    setNewConfluence("");
  };

  const removeConfluence = (item: string) => {
    setConfluences(confluences.filter((c) => c !== item));
  };

  const handleExecutionChange = (key: keyof ExecutionRules, value: string) => {
    setExecution((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 lg:p-8 overflow-y-auto scrollbar-hide">
      <div className="bg-white rounded-[48px] w-full max-w-4xl max-h-[92vh] overflow-y-auto border border-border flex flex-col my-auto relative shadow-2xl animate-in zoom-in-95 duration-300 scrollbar-hide">
        
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-border px-10 py-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Target className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-foreground">
                {initialData ? "Edit Strategy" : "Add New Strategy"}
              </h2>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1">
                 Playbook Configuration
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-12">
          
          {/* General Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-border pb-4">
               <FileText className="w-5 h-5 text-primary/40" />
               <h3 className="text-xs font-black tracking-[0.2em] text-muted-foreground uppercase">
                 General Definition
               </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Field label="Model Name" required>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="modern-input"
                  placeholder="e.g., 2022 Mentorship Model"
                />
              </Field>
              <Field label="Current Status">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "Approved" | "Testing")}
                  className="modern-input appearance-none cursor-pointer"
                >
                  <option value="Testing">🧪 Testing Phase</option>
                  <option value="Approved">✅ Approved Model</option>
                </select>
              </Field>
              <Field label="Execution Timeframe" icon={<Clock className="w-3.5 h-3.5" />}>
                <input
                  type="text"
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="modern-input"
                  placeholder="e.g., 1H / 15M / 5M"
                />
              </Field>
              <Field label="Ideal Market Condition" icon={<TrendingUp className="w-3.5 h-3.5" />}>
                <input
                  type="text"
                  value={marketCondition}
                  onChange={(e) => setMarketCondition(e.target.value)}
                  className="modern-input"
                  placeholder="e.g., Trending, Reversal"
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Optimal Killzones">
                  <input
                    type="text"
                    value={killzones}
                    onChange={(e) => setKillzones(e.target.value)}
                    className="modern-input"
                    placeholder="e.g., London Open, NY AM Session"
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Model Description / Definition">
                  <textarea
                    value={definition}
                    onChange={(e) => setDefinition(e.target.value)}
                    className="modern-input min-h-[120px] py-4 resize-none"
                    placeholder="Briefly describe the core logic of this model..."
                  />
                </Field>
              </div>
            </div>
          </section>

          {/* Confluences Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-border pb-4">
               <CheckSquare className="w-5 h-5 text-primary/40" />
               <h3 className="text-xs font-black tracking-[0.2em] text-muted-foreground uppercase">
                 Setup Confluences
               </h3>
            </div>
            
            <div className="flex gap-4">
              <input
                type="text"
                value={newConfluence}
                onChange={(e) => setNewConfluence(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addConfluence())}
                placeholder="Add new confluence (e.g., DOL, MSS, FVG...)"
                className="modern-input flex-1"
              />
              <button
                type="button"
                onClick={addConfluence}
                className="px-6 rounded-2xl bg-primary text-white font-bold text-xs uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all"
              >
                Add
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {confluences.map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between gap-4 p-4 rounded-2xl border-2 border-primary/20 bg-primary/[0.02] shadow-sm animate-in zoom-in-95 duration-200"
                >
                  <span className="text-xs font-black uppercase tracking-widest text-primary truncate">
                    {item}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeConfluence(item)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {confluences.length === 0 && (
                <div className="col-span-full py-8 text-center border-2 border-dashed border-border rounded-3xl text-muted-foreground text-xs font-medium italic">
                  No confluences added yet. Use the field above to add your strategy rules.
                </div>
              )}
            </div>
          </section>

          {/* Execution Rules Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-border pb-4">
               <Settings2 className="w-5 h-5 text-primary/40" />
               <h3 className="text-xs font-black tracking-[0.2em] text-muted-foreground uppercase">
                 Execution & Management
               </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Field label="Entry Trigger">
                <input
                  type="text"
                  value={execution.entry}
                  onChange={(e) => handleExecutionChange("entry", e.target.value)}
                  className="modern-input"
                  placeholder="e.g., Tap into 15m FVG"
                />
              </Field>
              <Field label="Risk Allocation (%)">
                <input
                  type="text"
                  value={execution.riskPercent}
                  onChange={(e) => handleExecutionChange("riskPercent", e.target.value)}
                  className="modern-input"
                  placeholder="e.g., 1%"
                />
              </Field>
              <Field label="Stop Loss Placement">
                <input
                  type="text"
                  value={execution.stopLoss}
                  onChange={(e) => handleExecutionChange("stopLoss", e.target.value)}
                  className="modern-input"
                  placeholder="e.g., Below Swing Low of MSS"
                />
              </Field>
              <Field label="Take Profit Target">
                <input
                  type="text"
                  value={execution.takeProfit}
                  onChange={(e) => handleExecutionChange("takeProfit", e.target.value)}
                  className="modern-input"
                  placeholder="e.g., Opposite Liquidity Pool"
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Management (BE / Partial) Rules">
                  <input
                    type="text"
                    value={execution.breakEven}
                    onChange={(e) => handleExecutionChange("breakEven", e.target.value)}
                    className="modern-input"
                    placeholder="e.g., Move SL to BE at 2R"
                  />
                </Field>
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="pt-8 flex justify-end gap-5 border-t border-border mt-8">
            <button
              type="button"
              onClick={onCancel}
              className="px-8 py-4 rounded-2xl text-xs font-black tracking-widest text-muted-foreground hover:text-foreground transition-all uppercase"
            >
              Discard Changes
            </button>
            <button
              type="submit"
              className="forest-gradient px-10 py-4 rounded-2xl text-xs font-black tracking-widest text-white shadow-xl hover:opacity-90 transition-all active:scale-95 uppercase flex items-center gap-3"
            >
              <Save className="w-4 h-4" /> Save Strategy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children, required, icon }: { label: string; children: React.ReactNode; required?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        {icon && <span className="text-muted-foreground/40">{icon}</span>}
        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
      </div>
      {children}
    </div>
  );
}
