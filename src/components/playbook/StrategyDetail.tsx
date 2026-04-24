import { useState } from "react";
import { PlaybookModel, PlaybookImage } from "@/types/playbook";
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
} from "lucide-react";
import { toast } from "sonner";
import { generateId } from "@/lib/utils";

interface StrategyDetailProps {
  model: PlaybookModel;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdate: (updatedModel: PlaybookModel) => void;
}

export function StrategyDetail({ model, onBack, onEdit, onDelete, onUpdate }: StrategyDetailProps) {
  const [activeImageType, setActiveImageType] = useState<"perfect" | "loss" | "mistake">("perfect");

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

  const imagesForActiveType = model.images.filter((img) => img.type === activeImageType);

  const confluencesList = [
    { key: "dol", label: "Draw on Liquidity" },
    { key: "mss", label: "Market Structure Shift" },
    { key: "fvg", label: "Fair Value Gap" },
    { key: "smt", label: "SMT Divergence" },
    { key: "ote", label: "Optimal Trade Entry" },
    { key: "volumeImbalance", label: "Volume Imbalance" },
  ];

  return (
    <div className="h-full flex flex-col space-y-4" onPaste={handlePaste} tabIndex={0}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-terminal-border pb-4 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-[0.2em] text-neon-cyan text-glow-cyan uppercase">
                {model.name}
              </h2>
              <select
                value={model.status}
                onChange={(e) => onUpdate({ ...model, status: e.target.value as any })}
                className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase border outline-none bg-transparent cursor-pointer transition-all ${
                  model.status === "Approved"
                    ? "border-neon-green/30 text-neon-green hover:bg-neon-green/10"
                    : model.status === "Testing"
                    ? "border-neon-amber/30 text-neon-amber hover:bg-neon-amber/10"
                    : "border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                }`}
              >
                <option value="Approved">Approved</option>
                <option value="Testing">Testing</option>
                <option value="Under Review">Under Review</option>
              </select>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 tracking-widest">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {model.timeframe}
              </span>
              <span className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" /> {model.marketCondition}
              </span>
              <span>KILLZONES: {model.killzones || "N/A"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-xs font-bold hover:bg-white/10 transition-all uppercase"
          >
            <Edit className="w-4 h-4" /> Edit
          </button>
          <button
            onClick={() => {
              if (confirm("Are you sure you want to delete this strategy?")) {
                onDelete();
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-neon-red/10 border border-neon-red/30 text-neon-red rounded-md text-xs font-bold hover:bg-neon-red/20 transition-all uppercase"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden pb-4">
        {/* Left Column: Text Content */}
        <div className="overflow-y-auto pr-2 space-y-6 scrollbar-terminal">
          {/* Definition */}
          <div className="glass rounded-xl p-5 border border-terminal-border">
            <h3 className="text-sm font-bold tracking-widest text-foreground flex items-center gap-2 border-b border-terminal-border pb-3 mb-3">
              <FileText className="w-4 h-4 text-neon-amber" /> DEFINITION
            </h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {model.definition || "No definition provided."}
            </p>
          </div>

          {/* Checklist */}
          <div className="glass rounded-xl p-5 border border-terminal-border">
            <h3 className="text-sm font-bold tracking-widest text-foreground flex items-center gap-2 border-b border-terminal-border pb-3 mb-3">
              <CheckSquare className="w-4 h-4 text-neon-green" /> SETUP CONFLUENCES
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {model.setupConfluences.map((label) => (
                <div
                  key={label}
                  className="flex items-center gap-2 text-sm text-foreground bg-white/5 p-2 rounded border border-white/5"
                >
                  <div className="w-2 h-2 rounded-full bg-neon-green shadow-[0_0_8px_oklch(0.82_0.24_145/0.8)]" />
                  {label}
                </div>
              ))}
              {model.setupConfluences.length === 0 && (
                <div className="text-sm text-muted-foreground italic col-span-2">No confluences defined.</div>
              )}
            </div>
          </div>

          {/* Execution Rules */}
          <div className="glass rounded-xl p-5 border border-terminal-border">
            <h3 className="text-sm font-bold tracking-widest text-foreground flex items-center gap-2 border-b border-terminal-border pb-3 mb-3">
              <Settings2 className="w-4 h-4 text-neon-cyan" /> EXECUTION RULES
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Entry</div>
                  <div className="text-sm font-medium">{model.executionRules.entry || "-"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Stop Loss</div>
                  <div className="text-sm font-medium">{model.executionRules.stopLoss || "-"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Target (TP)</div>
                  <div className="text-sm font-medium">{model.executionRules.takeProfit || "-"}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-3 border-t border-terminal-border/50">
                <div className="space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Risk</div>
                  <div className="text-sm font-medium text-neon-amber">{model.executionRules.riskPercent || "-"}</div>
                </div>
                <div className="col-span-2 space-y-1">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Management / BE</div>
                  <div className="text-sm font-medium">{model.executionRules.breakEven || "-"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Image Library */}
        <div className="glass rounded-xl border border-terminal-border flex flex-col overflow-hidden relative">
          {/* Header & Tabs */}
          <div className="p-4 border-b border-terminal-border shrink-0">
            <h3 className="text-sm font-bold tracking-widest text-foreground flex items-center gap-2 mb-4">
              <ImageIcon className="w-4 h-4 text-neon-cyan" /> IMAGE LIBRARY
            </h3>
            <div className="flex items-center gap-2">
              {[
                { id: "perfect", label: "Perfect Setup" },
                { id: "loss", label: "Losing Trade" },
                { id: "mistake", label: "Mistakes" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveImageType(tab.id as any)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold tracking-widest transition-all uppercase ${
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

          {/* Image Display Area */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-terminal relative bg-terminal-bg/50">
            {imagesForActiveType.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/50 border-2 border-dashed border-terminal-border/50 rounded-lg m-4 p-8 text-center">
                <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-sm font-medium">No images found for this category.</p>
                <p className="text-xs mt-2">Click here and press <kbd className="bg-white/10 px-1 rounded">Cmd+V</kbd> / <kbd className="bg-white/10 px-1 rounded">Ctrl+V</kbd> to paste an image.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {imagesForActiveType.map((img) => (
                  <div key={img.id} className="relative group rounded-lg overflow-hidden border border-terminal-border">
                    <img src={img.url} alt="Setup" className="w-full object-contain bg-black/50" />
                    <button
                      onClick={() => removeImage(img.id)}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-neon-red hover:text-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                {/* Paste instruction overlay at bottom */}
                 <div className="text-center text-xs text-muted-foreground py-4 border-t border-dashed border-terminal-border mt-4">
                    Press <kbd className="bg-white/10 px-1 rounded">Cmd+V</kbd> / <kbd className="bg-white/10 px-1 rounded">Ctrl+V</kbd> anywhere here to add more images.
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
