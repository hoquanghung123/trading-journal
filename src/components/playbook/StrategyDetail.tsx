import { useState, useMemo } from "react";
import { PlaybookModel, PlaybookImage } from "@/types/playbook";
import { Trade, computeOutcome, outcomeStyle } from "@/lib/trades";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Clock,
  Activity,
  CheckSquare,
  Settings2,
  FileText,
  Image as ImageIcon,
  Plus,
  X,
  History,
  Save,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { generateId } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichEditor } from "@/components/ui/rich-editor";

interface StrategyDetailProps {
  model: PlaybookModel;
  trades: Trade[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdate: (updatedModel: PlaybookModel) => void;
  onTradeClick?: (trade: Trade) => void;
}

export function StrategyDetail({ model, trades, onBack, onEdit, onDelete, onUpdate, onTradeClick }: StrategyDetailProps) {
  const [activeImageType, setActiveImageType] = useState<"perfect" | "loss" | "mistake">("perfect");
  const [definition, setDefinition] = useState(model.definition || "");
  const [isEditingDefinition, setIsEditingDefinition] = useState(false);

  const filteredTrades = useMemo(() => {
    return trades
      .filter((t) => t.setupId === model.id)
      .sort((a, b) => +new Date(b.entryTime) - +new Date(a.entryTime));
  }, [trades, model.id]);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              const newImage: PlaybookImage = {
                id: generateId(),
                url: event.target.result as string,
                type: activeImageType,
              };
              onUpdate({
                ...model,
                images: [...model.images, newImage],
              });
              toast.success("Image added successfully");
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const removeImage = (id: string) => {
    onUpdate({
      ...model,
      images: model.images.filter((img) => img.id !== id),
    });
    toast.success("Image removed");
  };

  const saveDefinition = () => {
    onUpdate({ ...model, definition });
    setIsEditingDefinition(false);
    toast.success("Definition updated");
  };

  const imagesForActiveType = model.images.filter((img) => img.type === activeImageType);

  return (
    <div className="h-full flex flex-col space-y-4 mobile-pb" onPaste={handlePaste} tabIndex={0}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-terminal-border pb-4 gap-4 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/5 rounded-md text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h2 className="text-base sm:text-xl font-bold tracking-[0.1em] sm:tracking-[0.2em] text-neon-cyan text-glow-cyan uppercase truncate max-w-[150px] sm:max-w-none">
                {model.name}
              </h2>
              <select
                value={model.status}
                onChange={(e) => onUpdate({ ...model, status: e.target.value as any })}
                className={`px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold tracking-widest uppercase border outline-none bg-transparent cursor-pointer transition-all ${
                  model.status === "Approved"
                    ? "border-neon-green/30 text-neon-green"
                    : model.status === "Testing"
                    ? "border-neon-amber/30 text-neon-amber"
                    : "border-indigo-500/30 text-indigo-400"
                }`}
              >
                <option value="Approved">Approved</option>
                <option value="Testing">Testing</option>
                <option value="Under Review">Under Review</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] sm:text-xs text-muted-foreground mt-1 tracking-wider sm:tracking-widest">
              <span className="flex items-center gap-1">
                <Clock className="w-3 sm:w-3.5 h-3 sm:h-3.5" /> {model.timeframe}
              </span>
              <span className="flex items-center gap-1">
                <Activity className="w-3 sm:w-3.5 h-3 sm:h-3.5" /> {model.marketCondition}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:self-center">
          <button
            onClick={onEdit}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-[10px] sm:text-xs font-bold hover:bg-white/10 transition-all uppercase"
          >
            <Edit className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={() => {
              if (confirm("Are you sure?")) onDelete();
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 bg-neon-red/10 border border-neon-red/30 text-neon-red rounded-md text-[10px] sm:text-xs font-bold hover:bg-neon-red/20 transition-all uppercase"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      <Tabs defaultValue="definition" className="flex-1 flex flex-col min-h-0">
        <div className="overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="w-max sm:w-fit bg-white/5 border border-white/10 p-1 mb-4 flex">
            <TabsTrigger
              value="definition"
              className="data-[state=active]:bg-neon-cyan/20 data-[state=active]:text-neon-cyan px-4 sm:px-6 text-[10px] sm:text-xs font-bold tracking-widest uppercase whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5 mr-2" /> Definition
            </TabsTrigger>
            <TabsTrigger
              value="logic"
              className="data-[state=active]:bg-neon-cyan/20 data-[state=active]:text-neon-cyan px-4 sm:px-6 text-[10px] sm:text-xs font-bold tracking-widest uppercase whitespace-nowrap"
            >
              <CheckSquare className="w-3.5 h-3.5 mr-2" /> Logic
            </TabsTrigger>
            <TabsTrigger
              value="visuals"
              className="data-[state=active]:bg-neon-cyan/20 data-[state=active]:text-neon-cyan px-4 sm:px-6 text-[10px] sm:text-xs font-bold tracking-widest uppercase whitespace-nowrap"
            >
              <ImageIcon className="w-3.5 h-3.5 mr-2" /> Visuals
            </TabsTrigger>
            <TabsTrigger
              value="trades"
              className="data-[state=active]:bg-neon-cyan/20 data-[state=active]:text-neon-cyan px-4 sm:px-6 text-[10px] sm:text-xs font-bold tracking-widest uppercase whitespace-nowrap"
            >
              <History className="w-3.5 h-3.5 mr-2" /> History
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="definition" className="flex-1 min-h-0 overflow-hidden pb-4">
          {/* Definition & Confluences - Full Width */}
          <div className="h-full overflow-y-auto pr-2 space-y-6 scrollbar-terminal">
            {/* Definition Editor */}
            <div className="glass rounded-xl p-5 border border-terminal-border group relative">
              <div className="flex items-center justify-between border-b border-terminal-border pb-3 mb-3">
                <h3 className="text-sm font-bold tracking-widest text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-neon-amber" /> DEFINITION
                </h3>
                {isEditingDefinition ? (
                  <button
                    onClick={saveDefinition}
                    className="flex items-center gap-1.5 px-2 py-1 bg-neon-green/20 text-neon-green border border-neon-green/30 rounded text-[10px] font-bold uppercase hover:bg-neon-green/30 transition-all"
                  >
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditingDefinition(true)}
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-2 py-1 bg-white/5 text-muted-foreground border border-white/10 rounded text-[10px] font-bold uppercase hover:text-foreground hover:bg-white/10 transition-all"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
              </div>
              
              {isEditingDefinition ? (
                <div className="space-y-3">
                  <RichEditor
                    value={definition}
                    onChange={setDefinition}
                    className="min-h-[400px]"
                    placeholder="Enter strategy definition, rules, and logic..."
                  />
                  <p className="text-[10px] text-muted-foreground italic">
                    Tip: You can now use <b>Bold</b>, <i>Italic</i>, Bullet points, and Paste images directly!
                  </p>
                </div>
              ) : (
                <div 
                  className="text-sm text-slate-600 rich-content max-w-none min-h-[150px] cursor-pointer hover:text-slate-900 transition-colors"
                  onClick={() => setIsEditingDefinition(true)}
                  dangerouslySetInnerHTML={{ __html: model.definition || "No definition provided. Click to add one." }}
                />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="logic" className="flex-1 overflow-y-auto space-y-8 animate-in fade-in duration-500 pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Setup Confluences */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black tracking-[0.2em] text-slate-900 flex items-center gap-3 border-b border-slate-100 pb-5 mb-6">
                <CheckSquare className="w-5 h-5 text-emerald-500" /> SETUP CONFLUENCES
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {model.setupConfluences.map((label) => (
                  <div
                    key={label}
                    className="flex items-center gap-4 text-sm font-bold text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
                    {label}
                  </div>
                ))}
                {model.setupConfluences.length === 0 && (
                  <div className="text-sm text-slate-400 italic py-8 text-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                    No verification rules defined.
                  </div>
                )}
              </div>
            </div>

            {/* Execution Rules */}
            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black tracking-[0.2em] text-slate-900 flex items-center gap-3 border-b border-slate-100 pb-5 mb-6">
                <Settings2 className="w-5 h-5 text-blue-500" /> EXECUTION PROTOCOLS
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entry Trigger</div>
                  <div className="text-sm font-bold text-slate-700">{model.executionRules.entry || "NOT_DEFINED"}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capital Exposure</div>
                  <div className="text-sm font-bold text-slate-700">{model.executionRules.riskPercent || "NOT_DEFINED"}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Defensive Stop</div>
                  <div className="text-sm font-bold text-slate-700">{model.executionRules.stopLoss || "NOT_DEFINED"}</div>
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary Target</div>
                  <div className="text-sm font-bold text-slate-700">{model.executionRules.takeProfit || "NOT_DEFINED"}</div>
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Management Rules</div>
                  <div className="text-sm font-bold text-slate-700">{model.executionRules.breakEven || "NOT_DEFINED"}</div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="visuals" className="flex-1 min-h-0 overflow-hidden pb-4">
          <div className="glass rounded-xl border border-terminal-border h-full flex flex-col overflow-hidden relative">
            <div className="p-3 sm:p-4 border-b border-terminal-border shrink-0 bg-white/5">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-[10px] sm:text-sm font-bold tracking-widest text-foreground flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-neon-cyan" /> STRATEGY GALLERY
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: "perfect", label: "Perfect" },
                  { id: "loss", label: "Loss" },
                  { id: "mistake", label: "Mistake" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveImageType(tab.id as any)}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-[9px] sm:text-[10px] font-bold tracking-widest transition-all uppercase ${
                      activeImageType === tab.id
                        ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 text-glow-cyan"
                        : "bg-white/5 text-muted-foreground border border-transparent hover:bg-white/10 hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-terminal relative bg-terminal-bg/50">
              {imagesForActiveType.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30 border-2 border-dashed border-terminal-border/20 rounded-xl m-4 sm:m-8 p-8 sm:p-12 text-center">
                  <ImageIcon className="w-12 h-12 sm:w-16 sm:h-16 mb-4 opacity-20" />
                  <p className="text-[10px] sm:text-sm font-bold uppercase tracking-[0.1em] sm:tracking-[0.2em]">No {activeImageType} visuals</p>
                  <p className="text-[9px] sm:text-xs mt-2 opacity-60">Paste image to add (Cmd+V)</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {imagesForActiveType.map((img) => (
                    <div key={img.id} className="relative group rounded-xl overflow-hidden border border-terminal-border bg-black/40 shadow-xl">
                      <img src={img.url} alt="Setup" className="w-full aspect-video object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 sm:group-hover:opacity-100 transition-all flex items-center justify-center gap-3 backdrop-blur-[2px]">
                         <button
                            onClick={() => removeImage(img.id)}
                            className="p-2.5 sm:p-3 bg-neon-red/20 text-neon-red border border-neon-red/50 rounded-xl hover:bg-neon-red hover:text-white transition-all transform scale-90 sm:group-hover:scale-100"
                            title="Remove Image"
                         >
                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                         </button>
                      </div>
                      {/* Mobile delete button */}
                      <button
                        onClick={() => removeImage(img.id)}
                        className="sm:hidden absolute top-2 right-2 p-2 bg-black/60 text-neon-red rounded-lg border border-neon-red/30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  <div className="border-2 border-dashed border-terminal-border/20 rounded-xl flex flex-col items-center justify-center p-6 sm:p-8 bg-white/[0.02] text-muted-foreground/30">
                     <Plus className="w-6 h-6 sm:w-8 sm:h-8 mb-2 opacity-20" />
                     <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">Paste more</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="trades" className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
          <div className="glass rounded-xl border border-terminal-border flex-1 flex flex-col overflow-hidden">
             <div className="p-4 border-b border-terminal-border flex items-center justify-between shrink-0">
                <h3 className="text-sm font-bold tracking-widest text-foreground flex items-center gap-2">
                  <History className="w-4 h-4 text-neon-cyan" /> PLAYBOOK HISTORY
                </h3>
                <span className="text-[10px] font-bold text-muted-foreground bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase tracking-widest">
                  {filteredTrades.length} Trades Found
                </span>
             </div>
             
              <div className="flex-1 overflow-y-auto scrollbar-terminal">
                {filteredTrades.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
                    <History className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm font-medium uppercase tracking-widest">No trades recorded yet</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile View */}
                    <div className="sm:hidden divide-y divide-terminal-border/20">
                      {filteredTrades.map((t) => {
                        const outcome = computeOutcome(t.actualRr, t.maxRr, t.netPnl);
                        return (
                          <div
                            key={t.id}
                            onClick={() => onTradeClick?.(t)}
                            className="p-4 active:bg-white/5 space-y-3"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground text-sm">{t.symbol}</span>
                                <span className={`text-[9px] font-bold uppercase tracking-widest ${t.side === "buy" ? "text-neon-cyan" : "text-neon-red"}`}>
                                  {t.side}
                                </span>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${outcomeStyle[outcome.color]}`}>
                                {outcome.label}
                              </span>
                            </div>
                            <div className="flex justify-between items-end">
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(t.entryTime).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })}
                              </span>
                              <div className="text-right">
                                <div className={`text-sm font-bold ${t.netPnl >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                                  {t.netPnl >= 0 ? "+" : ""}{t.netPnl.toFixed(2)}
                                </div>
                                <div className="text-[10px] text-muted-foreground">RR {t.actualRr} / {t.maxRr}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop View */}
                    <table className="hidden sm:table w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-terminal-bg/90 backdrop-blur-md z-10">
                        <tr className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-terminal-border">
                          <th className="p-4">Date</th>
                          <th className="p-4">Outcome</th>
                          <th className="p-4">Symbol</th>
                          <th className="p-4 text-right">Net PnL</th>
                          <th className="p-4 text-right">RR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-terminal-border/30">
                        {filteredTrades.map((t) => {
                          const outcome = computeOutcome(t.actualRr, t.maxRr, t.netPnl);
                          return (
                            <tr
                              key={t.id}
                              onClick={() => onTradeClick?.(t)}
                              className="hover:bg-white/5 transition-colors group cursor-pointer"
                            >
                              <td className="p-4 text-xs font-medium text-muted-foreground">
                                {new Date(t.entryTime).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "2-digit",
                                })}
                              </td>
                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${outcomeStyle[outcome.color]}`}>
                                  {outcome.label}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-foreground">{t.symbol}</span>
                                  <span className={`text-[9px] font-bold uppercase tracking-widest ${t.side === "buy" ? "text-neon-cyan" : "text-neon-red"}`}>
                                    {t.side}
                                  </span>
                                </div>
                              </td>
                              <td className={`p-4 text-xs font-bold text-right ${t.netPnl >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                                {t.netPnl >= 0 ? "+" : ""}{t.netPnl.toFixed(2)}
                              </td>
                              <td className="p-4 text-[10px] font-medium text-muted-foreground text-right tabular-nums">
                                {t.actualRr} / {t.maxRr}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
