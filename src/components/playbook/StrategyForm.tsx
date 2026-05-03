import { useState } from "react";
import { PlaybookModel, SetupConfluences, ExecutionRules } from "@/types/playbook";
import {
  X,
  Save,
  Target,
  Image as ImageIcon,
  Trash2,
  Upload,
  Settings2,
  Activity,
  FileText,
  Zap,
} from "lucide-react";
import { generateId } from "@/lib/utils";
import { RichEditor } from "@/components/ui/rich-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StrategyFormProps {
  initialData?: PlaybookModel;
  onSave: (model: PlaybookModel) => void;
  onCancel: () => void;
}

export function StrategyForm({ initialData, onSave, onCancel }: StrategyFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [timeframe, setTimeframe] = useState(initialData?.timeframe || "1H");
  const [marketCondition, setMarketCondition] = useState(
    initialData?.marketCondition || "Trending",
  );
  const [killzones, setKillzones] = useState(initialData?.killzones || "");
  const [status, setStatus] = useState<"Approved" | "Testing" | "Under Review">(
    initialData?.status || "Testing",
  );
  const [definition, setDefinition] = useState(initialData?.definition || "");
  const [thumbnail, setThumbnail] = useState<string>(
    initialData?.images.find((img) => img.type === "perfect")?.url || "",
  );

  const [confluences, setConfluences] = useState<SetupConfluences>(
    initialData?.setupConfluences || { narrative: [], liquidity: [], confirmation: [] },
  );
  const [newNarrative, setNewNarrative] = useState("");
  const [newLiquidity, setNewLiquidity] = useState("");
  const [newConfirmation, setNewConfirmation] = useState("");

  const [execution, setExecution] = useState<ExecutionRules>(
    initialData?.executionRules || {
      entry: "",
      stopLoss: "",
      takeProfit: "",
      riskPercent: "1%",
      breakEven: "",
    },
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
      images: thumbnail
        ? [
            { id: generateId(), url: thumbnail, type: "perfect" },
            ...(initialData?.images?.filter((img) => img.type !== "perfect") || []),
          ]
        : initialData?.images?.filter((img) => img.type !== "perfect") || [],
    };

    onSave(model);
  };

  const addConfluence = (type: keyof SetupConfluences, value: string) => {
    if (!value.trim()) return;
    if (confluences[type].includes(value.trim())) return;
    setConfluences((prev) => ({
      ...prev,
      [type]: [...prev[type], value.trim()],
    }));

    if (type === "narrative") setNewNarrative("");
    if (type === "liquidity") setNewLiquidity("");
    if (type === "confirmation") setNewConfirmation("");
  };

  const removeConfluence = (type: keyof SetupConfluences, item: string) => {
    setConfluences((prev) => ({
      ...prev,
      [type]: prev[type].filter((c) => c !== item),
    }));
  };

  const handleExecutionChange = (key: keyof ExecutionRules, value: string) => {
    setExecution((prev) => ({ ...prev, [key]: value }));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setThumbnail(event.target.result as string);
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setThumbnail(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 lg:p-8 overflow-y-auto scrollbar-hide">
      <div className="bg-background rounded-[48px] w-full max-w-5xl h-[92vh] overflow-hidden border border-border flex flex-col my-auto relative shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-10 pt-10 pb-6 border-b border-border/50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight text-foreground">
                  {initialData ? "Edit Strategy" : "Add New Strategy"}
                </h2>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">
                  Institutional Protocol Configuration
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all active:scale-90"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <Tabs defaultValue="core" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 sm:px-10 py-4 bg-muted/10 border-b border-border/50 overflow-x-auto scrollbar-hide shrink-0">
            <TabsList className="flex items-center gap-2 bg-transparent p-0 h-auto w-fit">
              <TabsTrigger
                value="core"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 data-[state=active]:[background:linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_15%))]! data-[state=active]:text-white! data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 data-[state=active]:scale-[1.02] bg-white/50 border border-border/50 text-muted-foreground hover:bg-white hover:border-primary/30"
              >
                <Activity className="w-3.5 h-3.5" />
                Core Specs
              </TabsTrigger>
              <TabsTrigger
                value="logic"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 data-[state=active]:[background:linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_15%))]! data-[state=active]:text-white! data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 data-[state=active]:scale-[1.02] bg-white/50 border border-border/50 text-muted-foreground hover:bg-white hover:border-primary/30"
              >
                <Zap className="w-3.5 h-3.5" />
                Logic
              </TabsTrigger>
              <TabsTrigger
                value="definition"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 data-[state=active]:[background:linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_15%))]! data-[state=active]:text-white! data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 data-[state=active]:scale-[1.02] bg-white/50 border border-border/50 text-muted-foreground hover:bg-white hover:border-primary/30"
              >
                <FileText className="w-3.5 h-3.5" />
                Definition
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-8 scrollbar-hide">
            {/* Tab 1: Core Specs */}
            <TabsContent value="core" className="m-0 space-y-10 animate-in fade-in-50 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Field label="Model Name">
                  <Input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 bg-muted/30 border-border rounded-xl font-bold px-4 focus:ring-primary/20"
                    placeholder="e.g., 2022 Mentorship Model"
                  />
                </Field>
                <Field label="Current Status">
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as "Approved" | "Testing" | "Under Review")
                    }
                    className="h-12 w-full rounded-xl bg-muted/30 border border-border px-4 text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/20 appearance-none transition-all"
                  >
                    <option value="Testing">🧪 TESTING_PHASE</option>
                    <option value="Approved">✅ APPROVED_MODEL</option>
                    <option value="Under Review">⚠️ UNDER_REVIEW</option>
                  </select>
                </Field>
                <Field label="Execution Timeframe">
                  <Input
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="h-12 bg-muted/30 border-border rounded-xl font-bold px-4 focus:ring-primary/20"
                    placeholder="e.g., 1H / 15M"
                  />
                </Field>
                <Field label="Ideal Market Condition">
                  <Input
                    value={marketCondition}
                    onChange={(e) => setMarketCondition(e.target.value)}
                    className="h-12 bg-muted/30 border-border rounded-xl font-bold px-4 focus:ring-primary/20"
                    placeholder="e.g., Trending / Reversal"
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Optimal Operating Killzones">
                    <Input
                      value={killzones}
                      onChange={(e) => setKillzones(e.target.value)}
                      className="h-12 bg-muted/30 border-border rounded-xl font-bold px-4 focus:ring-primary/20"
                      placeholder="e.g., London Open, New York AM..."
                    />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field label="Feature Visual (Thumbnail)">
                    <div
                      onPaste={handlePaste}
                      className="relative aspect-video w-full rounded-[32px] border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center overflow-hidden group transition-all hover:border-primary/50"
                    >
                      {thumbnail ? (
                        <>
                          <img
                            src={thumbnail}
                            alt="Thumbnail Preview"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-4 backdrop-blur-[2px]">
                            <label className="cursor-pointer p-4 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all active:scale-95">
                              <Upload className="w-6 h-6" />
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileUpload}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => setThumbnail("")}
                              className="p-4 bg-rose-500/20 hover:bg-rose-500/40 rounded-2xl text-rose-500 transition-all active:scale-95"
                            >
                              <Trash2 className="w-6 h-6" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-4 p-8 text-center">
                          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary">
                            <ImageIcon className="w-10 h-10" />
                          </div>
                          <div>
                            <p className="text-sm font-black uppercase tracking-widest text-foreground">
                              Paste or Upload Image
                            </p>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-2">
                              Perfect execution example
                            </p>
                          </div>
                          <label className="mt-4 px-6 py-3 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl cursor-pointer hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20">
                            Choose File
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={handleFileUpload}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </Field>
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Logic */}
            <TabsContent
              value="logic"
              className="m-0 space-y-10 animate-in fade-in-50 duration-500"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* HTF Analyst Section */}
                <div className="space-y-6 bg-primary/[0.02] border border-primary/5 p-6 rounded-[32px]">
                  <SectionHeader title="HTF Analyst" />
                  <div className="flex gap-2">
                    <Input
                      value={newNarrative}
                      onChange={(e) => setNewNarrative(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        (e.preventDefault(), addConfluence("narrative", newNarrative))
                      }
                      placeholder="e.g., Daily Bias"
                      className="h-10 bg-white border-border rounded-xl font-bold px-4 flex-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => addConfluence("narrative", newNarrative)}
                      className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:opacity-90 transition-all active:scale-95"
                    >
                      +
                    </button>
                  </div>
                  <div className="space-y-2">
                    {confluences.narrative.map((item) => (
                      <div
                        key={item}
                        className="group flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-white hover:border-primary/20 transition-all"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground truncate">
                          {item}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeConfluence("narrative", item)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Context Area Section */}
                <div className="space-y-6 bg-primary/[0.02] border border-primary/5 p-6 rounded-[32px]">
                  <SectionHeader title="Context Area" />
                  <div className="flex gap-2">
                    <Input
                      value={newLiquidity}
                      onChange={(e) => setNewLiquidity(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        (e.preventDefault(), addConfluence("liquidity", newLiquidity))
                      }
                      placeholder="e.g., BSL / SSL"
                      className="h-10 bg-white border-border rounded-xl font-bold px-4 flex-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => addConfluence("liquidity", newLiquidity)}
                      className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:opacity-90 transition-all active:scale-95"
                    >
                      +
                    </button>
                  </div>
                  <div className="space-y-2">
                    {confluences.liquidity.map((item) => (
                      <div
                        key={item}
                        className="group flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-white hover:border-primary/20 transition-all"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground truncate">
                          {item}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeConfluence("liquidity", item)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Confirmation Section */}
                <div className="space-y-6 bg-primary/[0.02] border border-primary/5 p-6 rounded-[32px]">
                  <SectionHeader title="Confirmation (LTF)" />
                  <div className="flex gap-2">
                    <Input
                      value={newConfirmation}
                      onChange={(e) => setNewConfirmation(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        (e.preventDefault(), addConfluence("confirmation", newConfirmation))
                      }
                      placeholder="e.g., MSS / FVG"
                      className="h-10 bg-white border-border rounded-xl font-bold px-4 flex-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => addConfluence("confirmation", newConfirmation)}
                      className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:opacity-90 transition-all active:scale-95"
                    >
                      +
                    </button>
                  </div>
                  <div className="space-y-2">
                    {confluences.confirmation.map((item) => (
                      <div
                        key={item}
                        className="group flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-white hover:border-primary/20 transition-all"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground truncate">
                          {item}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeConfluence("confirmation", item)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6 pt-10 border-t border-border/30">
                <SectionHeader title="Entry & Management" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Field label="Entry Trigger">
                    <Input
                      value={execution.entry}
                      onChange={(e) => handleExecutionChange("entry", e.target.value)}
                      className="h-12 bg-muted/30 border-border rounded-xl font-bold px-4"
                      placeholder="e.g., Tap into 15m FVG"
                    />
                  </Field>
                  <Field label="Risk Allocation (%)">
                    <Input
                      value={execution.riskPercent}
                      onChange={(e) => handleExecutionChange("riskPercent", e.target.value)}
                      className="h-12 bg-muted/30 border-border rounded-xl font-bold px-4"
                      placeholder="e.g., 1.0%"
                    />
                  </Field>
                  <Field label="Stop Loss Placement">
                    <Input
                      value={execution.stopLoss}
                      onChange={(e) => handleExecutionChange("stopLoss", e.target.value)}
                      className="h-12 bg-muted/30 border-border rounded-xl font-bold px-4"
                      placeholder="e.g., Swing Low Offset"
                    />
                  </Field>
                  <Field label="Take Profit Target">
                    <Input
                      value={execution.takeProfit}
                      onChange={(e) => handleExecutionChange("takeProfit", e.target.value)}
                      className="h-12 bg-muted/30 border-border rounded-xl font-bold px-4"
                      placeholder="e.g., External Liquidity"
                    />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Management Rules (BE / Partials)">
                      <Input
                        value={execution.breakEven}
                        onChange={(e) => handleExecutionChange("breakEven", e.target.value)}
                        className="h-12 bg-muted/30 border-border rounded-xl font-bold px-4"
                        placeholder="e.g., Move SL to BE at 2R"
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Tab 3: Definition */}
            <TabsContent
              value="definition"
              className="m-0 h-full animate-in fade-in-50 duration-500"
            >
              <div className="h-full flex flex-col space-y-6">
                <SectionHeader title="Institutional Definition" />
                <div className="flex-1 rounded-[32px] overflow-hidden border border-border bg-muted/10 min-h-[400px]">
                  <RichEditor
                    value={definition}
                    onChange={setDefinition}
                    className="h-full bg-muted/5 p-6"
                    placeholder="Provide detailed logic, rules, and examples..."
                  />
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="px-10 py-8 border-t border-border/50 bg-muted/10 flex justify-end gap-6 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-8 py-4 rounded-2xl text-[10px] font-black tracking-widest text-muted-foreground hover:text-foreground transition-all uppercase"
          >
            Discard Changes
          </button>
          <button
            onClick={handleSubmit}
            className="forest-gradient px-12 py-4 rounded-2xl text-sm font-black text-white shadow-xl hover:opacity-90 transition-all active:scale-95 uppercase tracking-widest flex items-center gap-3"
          >
            <Save className="w-5 h-5" /> Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-4 w-1 bg-primary rounded-full" />
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{title}</h3>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
        {label}
      </Label>
      {children}
    </div>
  );
}
