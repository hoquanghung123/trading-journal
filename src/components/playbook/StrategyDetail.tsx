import { useState, useMemo, useEffect } from "react";
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
  Shield,
  Zap,
  Target,
  LayoutDashboard,
  TrendingUp,
  GraduationCap,
  Link as LinkIcon,
  Play,
  Download,
  CheckCircle2,
  Lock,
  ArrowRight,
  FlaskConical,
  PlusCircle,
  FileText as FileTextIcon,
  Trash2 as TrashIcon,
  ChevronRight,
  Layout,
  Library
} from "lucide-react";
import { toast } from "sonner";
import { generateId } from "@/lib/utils";
import { uploadChartImage, getChartUrl } from "@/lib/journal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichEditor } from "@/components/ui/rich-editor";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface StrategyDetailProps {
  model: PlaybookModel;
  trades: Trade[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onUpdate: (updatedModel: PlaybookModel) => void;
  onTradeClick?: (trade: Trade) => void;
}

export function StrategyDetail({
  model,
  trades,
  onBack,
  onEdit,
  onDelete,
  onUpdate,
  onTradeClick,
}: StrategyDetailProps) {
  const [activeImageType, setActiveImageType] = useState<"perfect" | "loss" | "mistake">("perfect");
  const [definition, setDefinition] = useState(model.definition || "");
  const [isEditingDefinition, setIsEditingDefinition] = useState(false);
  const [labNotes, setLabNotes] = useState<any[]>(model.labNotes || []);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(model.labNotes?.[0]?.id || null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [expandedResourceId, setExpandedResourceId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [quickAddForm, setQuickAddForm] = useState({
    title: "",
    description: "",
    url: "",
    type: "video" as const,
    progress: 0,
    subLinks: [] as { id: string; title: string; url: string }[]
  });
  const [newSubLink, setNewSubLink] = useState({ title: "", url: "" });

  /** Upload an image file to R2 and return its display URL for the editor */
  const uploadImageForEditor = async (file: File): Promise<string> => {
    const path = await uploadChartImage(file);
    return getChartUrl(path);
  };

  const handleQuickAdd = () => {
    if (!quickAddForm.title || (!quickAddForm.url && quickAddForm.subLinks.length === 0)) {
      toast.error("Please provide a title and at least one link");
      return;
    }

    const newResource = {
      ...quickAddForm,
      id: generateId()
    };

    onUpdate({
      ...model,
      moodleResources: [...(model.moodleResources || []), newResource]
    });

    setQuickAddForm({
      title: "",
      description: "",
      url: "",
      type: "video",
      progress: 0,
      subLinks: []
    });
    setIsQuickAddOpen(false);
    toast.success("Academy Module added");
  };

  const addSubLinkToForm = () => {
    if (!newSubLink.title || !newSubLink.url) return;
    setQuickAddForm(prev => ({
      ...prev,
      subLinks: [...prev.subLinks, { ...newSubLink, id: generateId() }]
    }));
    setNewSubLink({ title: "", url: "" });
  };

  const coverImage = useMemo(
    () => model.images.find((img) => img.type === "perfect")?.url,
    [model.images],
  );

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

  const saveDefinition = () => {
    onUpdate({ ...model, definition });
    setIsEditingDefinition(false);
    toast.success("Definition updated");
  };


  const addLabNote = () => {
    const newNote = {
      id: generateId(),
      title: "New Research Item",
      content: "",
      createdAt: new Date().toISOString(),
    };
    const updated = [...labNotes, newNote];
    setLabNotes(updated);
    setActiveNoteId(newNote.id);
    // Auto-save the structure
    onUpdate({ ...model, labNotes: updated });
  };

  const updateActiveNote = (updates: any) => {
    const updated = labNotes.map(n => 
      n.id === activeNoteId ? { ...n, ...updates } : n
    );
    setLabNotes(updated);
  };

  const deleteLabNote = (id: string) => {
    if (!confirm("Delete this research item?")) return;
    const updated = labNotes.filter(n => n.id !== id);
    setLabNotes(updated);
    if (activeNoteId === id) setActiveNoteId(updated[0]?.id || null);
    onUpdate({ ...model, labNotes: updated });
  };

  const activeNote = useMemo(() => 
    labNotes.find(n => n.id === activeNoteId), 
    [labNotes, activeNoteId]
  );

  // Sync state with props when model changes (e.g. initial load)
  useEffect(() => {
    if (model.labNotes && model.labNotes.length > 0 && labNotes.length === 0) {
      setLabNotes(model.labNotes);
      setActiveNoteId(model.labNotes[0].id);
    }
  }, [model.labNotes, labNotes.length]);

  // Auto-save logic for Lab Notes
  const [isSaving, setIsSaving] = useState(false);
  const lastPropsNotes = JSON.stringify(model.labNotes);

  useEffect(() => {
    const currentNotesStr = JSON.stringify(labNotes);
    if (currentNotesStr === lastPropsNotes) return;
    
    setIsSaving(true);
    const timer = setTimeout(() => {
      onUpdate({ ...model, labNotes });
      setIsSaving(false);
      setLastSavedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    }, 2000);

    return () => {
      clearTimeout(timer);
    };
  }, [labNotes, lastPropsNotes, onUpdate]);

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC]">
      {/* Premium Breadcrumb Header - Sticky for quick navigation */}
      <div className="bg-white/80 backdrop-blur-md border-b border-primary/5 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
          <span className="hover:text-primary cursor-pointer transition-colors" onClick={onBack}>Playbook</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-primary">{model.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onEdit}
            className="p-2.5 hover:bg-primary/5 rounded-xl text-muted-foreground hover:text-primary transition-all active:scale-95 border border-transparent hover:border-primary/10"
            title="Edit Setup"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(model.id)}
            className="p-2.5 hover:bg-rose-500/5 rounded-xl text-muted-foreground hover:text-rose-500 transition-all active:scale-95 border border-transparent hover:border-rose-500/10"
            title="Delete Setup"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scroll-smooth" onPaste={handlePaste}>
        {/* Main Strategy Info Header */}
        <div className="px-4 md:px-8 py-16 bg-white">
          <div className="max-w-full mx-auto flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-12">
            {/* Strategy Logo Area */}
            <div className="w-32 h-32 rounded-[40px] bg-primary/5 border-2 border-primary/10 flex items-center justify-center shrink-0 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)] relative group">
              <FlaskConical className="w-12 h-12 text-primary" />
              <div className="absolute inset-0 rounded-[40px] bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Title & Description */}
            <div className="flex-1 space-y-6">
              <div className="space-y-3">
                <h1 className="text-5xl font-black tracking-tighter text-foreground uppercase leading-none">
                  {model.name}
                </h1>
                <div className="flex items-center justify-center md:justify-start gap-4 text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">
                  <span className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5" /> {model.timeframe}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-primary/20" />
                  <span className="flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5" /> {model.marketCondition}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-primary/20" />
                  <span className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5" /> {model.killzones}
                  </span>
                </div>
              </div>
            </div>

            {/* High Level Stats Panel */}
            <div className="flex flex-col sm:flex-row gap-4 shrink-0">
              <div className="px-10 py-8 rounded-[32px] bg-[#F8FAFC] border border-primary/5 text-center min-w-[160px] shadow-sm">
                <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-2">Win Rate</p>
                <p className="text-4xl font-black text-primary">64%</p>
              </div>
              <div className="px-10 py-8 rounded-[32px] bg-emerald-500/[0.03] border border-emerald-500/5 text-center min-w-[160px] shadow-sm">
                <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-2">Avg RR</p>
                <p className="text-4xl font-black text-emerald-500">2.4</p>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="lab" className="w-full">
          {/* Navigation Tabs */}
          <div className="bg-muted/30 border-y border-border/50 px-4 md:px-8 py-4 overflow-x-auto scrollbar-hide">
            <div className="max-w-full mx-auto">
              <TabsList className="bg-transparent p-0 flex items-center gap-2 h-auto w-fit">
                <TabsTrigger
                  value="definition"
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 data-[state=active]:[background:linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_15%))]! data-[state=active]:!text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 data-[state=active]:scale-[1.02] bg-white/50 border border-border/50 text-muted-foreground hover:bg-white hover:border-primary/30"
                >
                  <Layout className="w-3.5 h-3.5" /> DEFINITION
                </TabsTrigger>
                <TabsTrigger
                  value="logic"
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 data-[state=active]:[background:linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_15%))]! data-[state=active]:!text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 data-[state=active]:scale-[1.02] bg-white/50 border border-border/50 text-muted-foreground hover:bg-white hover:border-primary/30"
                >
                  <Zap className="w-3.5 h-3.5" /> LOGIC
                </TabsTrigger>
                <TabsTrigger
                  value="lab"
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 data-[state=active]:[background:linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_15%))]! data-[state=active]:!text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 data-[state=active]:scale-[1.02] bg-white/50 border border-border/50 text-muted-foreground hover:bg-white hover:border-primary/30"
                >
                  <FlaskConical className="w-3.5 h-3.5" /> PLAYBOOK LAB
                </TabsTrigger>
                <TabsTrigger
                  value="trades"
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 data-[state=active]:[background:linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_15%))]! data-[state=active]:!text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 data-[state=active]:scale-[1.02] bg-white/50 border border-border/50 text-muted-foreground hover:bg-white hover:border-primary/30"
                >
                  <History className="w-3.5 h-3.5" /> PERFORMANCE LOG
                </TabsTrigger>
                <TabsTrigger
                  value="resources"
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 data-[state=active]:[background:linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_15%))]! data-[state=active]:!text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 data-[state=active]:scale-[1.02] bg-white/50 border border-border/50 text-muted-foreground hover:bg-white hover:border-primary/30"
                >
                  <Library className="w-3.5 h-3.5" /> RESOURCES
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Dynamic Content Area */}
          <div className="px-4 md:px-8 py-16">
            <div className="max-w-full mx-auto">
              <TabsContent value="definition" className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white border border-primary/10 rounded-[40px] p-10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.02)] relative group">
                  <div className="max-w-full space-y-12">
                    {/* Academy Quick Access */}
                    {model.moodleResources && model.moodleResources.length > 0 && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <h3 className="text-[10px] font-bold tracking-[0.3em] text-primary uppercase flex items-center gap-2">
                              <Library className="w-3.5 h-3.5" /> Linked Academy Modules
                            </h3>
                            <p className="text-[9px] font-bold text-muted-foreground/30 uppercase tracking-widest">Recommended Learning Path</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {model.moodleResources.map((resource) => (
                            <div 
                              key={resource.id} 
                              className={`p-6 rounded-[32px] transition-all group/resource border ${
                                expandedResourceId === resource.id 
                                  ? "bg-white border-primary/20 shadow-2xl" 
                                  : "bg-primary/[0.02] border-primary/5 hover:bg-white hover:shadow-xl hover:shadow-primary/5"
                              }`}
                            >
                              <div 
                                className="flex items-center gap-4 cursor-pointer"
                                onClick={() => setExpandedResourceId(expandedResourceId === resource.id ? null : resource.id)}
                              >
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                                  expandedResourceId === resource.id ? "bg-primary text-white" : "bg-primary/10 text-primary group-hover/resource:scale-110"
                                }`}>
                                  <GraduationCap className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-xs font-bold text-foreground uppercase tracking-tight truncate">{resource.title}</h4>
                                  <div className="flex items-center justify-between mt-1">
                                    <p className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                                      {resource.subLinks?.length || 0} Lessons
                                    </p>
                                    <span className="text-[9px] font-bold text-primary uppercase tracking-widest">{resource.progress || 0}%</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden mt-2">
                                    <div 
                                      className="h-full bg-primary transition-all duration-1000 shadow-[0_0_8px_rgba(var(--primary),0.4)]" 
                                      style={{ width: `${resource.progress || 0}%` }} 
                                    />
                                  </div>
                                </div>
                                <ChevronRight className={`w-4 h-4 text-primary/30 transition-transform duration-300 ${expandedResourceId === resource.id ? "rotate-90" : ""}`} />
                              </div>

                              <AnimatePresence>
                                {expandedResourceId === resource.id && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="pt-6 space-y-2">
                                      {resource.subLinks?.map((link, idx) => (
                                        <a
                                          key={idx}
                                          href={link.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center justify-between p-3.5 rounded-2xl bg-primary/5 border border-primary/10 hover:border-primary/30 transition-all group/link"
                                        >
                                          <span className="truncate mr-4 text-[11px] font-bold text-foreground/80 group-hover/link:text-primary transition-colors">
                                            {link.title || `Lesson ${idx + 1}`}
                                          </span>
                                          <ExternalLink className="w-3.5 h-3.5 text-primary opacity-40 group-hover/link:opacity-100 transition-opacity shrink-0" />
                                        </a>
                                      ))}
                                      {resource.url && (
                                        <a 
                                          href={resource.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-primary/5 text-primary text-[9px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-all mt-2"
                                        >
                                          View Full Module <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          ))}
                        </div>
                        <div className="h-px bg-primary/5 w-full" />
                      </div>
                    )}

                    <div className="space-y-1">
                      <h3 className="text-sm font-bold tracking-[0.3em] text-primary uppercase flex items-center gap-3">
                        <Layout className="w-5 h-5" /> Strategy Definition
                      </h3>
                      <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Core Architecture & Principles</p>
                    </div>
                    
                    {isEditingDefinition ? (
                      <div className="space-y-6">
                        <RichEditor
                          value={definition}
                          onChange={setDefinition}
                          uploadImage={uploadImageForEditor}
                          className="min-h-[500px]"
                        />
                        <div className="flex justify-end">
                          <button
                            onClick={saveDefinition}
                            className="flex items-center gap-3 px-10 py-4 bg-primary text-white rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:opacity-90 transition-all shadow-xl shadow-primary/20"
                          >
                            <Save className="w-4 h-4" /> Update Definition
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="text-xl text-foreground/80 leading-relaxed rich-content cursor-pointer hover:text-foreground transition-colors min-h-[400px]"
                        onClick={() => setIsEditingDefinition(true)}
                        dangerouslySetInnerHTML={{ __html: definition || "Click to define the core principles of this strategy..." }}
                      />
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="logic" className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                  {/* Confluences Column */}
                  <div className="lg:col-span-8 space-y-12">
                    <div className="bg-white border border-primary/10 rounded-[40px] p-12 shadow-sm relative group">
                      <h3 className="text-sm font-bold tracking-[0.3em] text-primary uppercase mb-10 flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5" /> Setup Confluences
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        {Object.entries(model.setupConfluences).map(([key, value]) => (
                          <div key={key} className="p-6 rounded-3xl bg-primary/[0.01] border border-primary/5 flex items-start gap-4 transition-all hover:bg-primary/[0.03]">
                            <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">{key}</p>
                              <p className="text-base font-bold text-foreground leading-relaxed">{value || "NOT_DEFINED"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white border border-primary/10 rounded-[40px] p-12 shadow-sm relative group">
                      <h3 className="text-sm font-bold tracking-[0.3em] text-primary uppercase mb-10 flex items-center gap-3">
                        <Zap className="w-5 h-5" /> Execution Protocol
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">Entry Confirmation</p>
                          <p className="text-lg font-bold text-foreground leading-relaxed">
                            {model.executionRules.entrySignal || "NOT_DEFINED"}
                          </p>
                        </div>
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">Stop Loss Protocol</p>
                          <p className="text-lg font-bold text-foreground leading-relaxed">
                            {model.executionRules.stopLoss || "NOT_DEFINED"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Management Sidebar */}
                  <div className="lg:col-span-4">
                    <div className="bg-white border border-primary/10 rounded-[40px] p-10 shadow-sm sticky top-24">
                      <h3 className="text-sm font-bold tracking-[0.3em] text-primary uppercase mb-10 flex items-center gap-3">
                        <Shield className="w-5 h-5" /> Risk Management
                      </h3>
                      <div className="space-y-10">
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">Take Profit Strategy</p>
                          <p className="text-lg font-bold text-foreground">{model.executionRules.takeProfit || "NOT_DEFINED"}</p>
                        </div>
                        <div className="h-px bg-primary/5" />
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">Break Even Protocol</p>
                          <p className="text-lg font-bold text-foreground">{model.executionRules.breakEven || "NOT_DEFINED"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="lab" className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white border border-primary/10 rounded-[40px] min-h-[900px] flex overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.03)] relative">
                  {/* Notebook Sidebar - Sticky behavior */}
                  <div className="w-96 border-r border-primary/5 bg-primary/[0.01] flex flex-col shrink-0">
                    <div className="p-6 border-b border-primary/5 flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="text-[10px] font-bold tracking-[0.3em] text-foreground/30 uppercase">
                          Research Index
                        </h3>
                        <p className="text-[8px] font-bold text-primary/40 uppercase tracking-[0.2em]">
                          {labNotes.length} Items Found
                        </p>
                      </div>
                      <button 
                        onClick={addLabNote}
                        className="w-10 h-10 flex items-center justify-center bg-primary text-white rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                      >
                        <PlusCircle className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-thin">
                      {labNotes.map((note) => (
                        <div
                          key={note.id}
                          onClick={() => {
                            setActiveNoteId(note.id);
                          }}
                          className={`group/item relative p-6 rounded-[32px] cursor-pointer transition-all border ${
                            activeNoteId === note.id 
                              ? "bg-white border-primary/20 shadow-2xl translate-x-2" 
                              : "border-transparent hover:bg-primary/5 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${activeNoteId === note.id ? "bg-primary/10 text-primary shadow-inner" : "bg-primary/5 opacity-40"}`}>
                              <FileTextIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-bold truncate tracking-tight ${activeNoteId === note.id ? "text-foreground" : ""}`}>
                                {note.title || "Untitled Item"}
                              </p>
                              <p className="text-[9px] font-bold uppercase tracking-widest opacity-30 mt-1">
                                {new Date(note.createdAt).toLocaleDateString('en-GB')}
                              </p>
                            </div>
                          </div>
                          
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteLabNote(note.id);
                            }}
                            className="absolute -right-1 -top-1 w-8 h-8 bg-white border border-primary/10 shadow-xl flex items-center justify-center opacity-0 group-hover/item:opacity-100 text-rose-500 hover:bg-rose-500 hover:text-white rounded-full transition-all scale-75 group-hover/item:scale-100"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Main Research Content Area */}
                  <div className="flex-1 flex flex-col min-w-0 bg-white">
                    {activeNote ? (
                      <>
                         <div className="px-10 py-10 border-b border-primary/5 flex items-center justify-between shrink-0 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                          <div className="flex-1 mr-12">
                              <input
                                value={activeNote.title}
                                onChange={(e) => updateActiveNote({ title: e.target.value })}
                                className="w-full bg-transparent text-xl font-bold text-foreground outline-none border-b-2 border-transparent focus:border-primary/20 transition-all tracking-tighter hover:border-primary/10"
                                placeholder="Case Study Title..."
                              />
                              <p className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-[0.3em] mt-1">
                                Deep Research Case Study
                              </p>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            {isSaving ? (
                              <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em] bg-primary/5 px-4 py-2 rounded-full border border-primary/10 animate-pulse">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary" /> Syncing...
                              </div>
                            ) : lastSavedAt ? (
                              <div className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] bg-emerald-500/5 px-4 py-2 rounded-full border border-emerald-500/10">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Saved at {lastSavedAt}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex-1 p-10">
                          <RichEditor
                            value={activeNote.content}
                            onChange={(content) => updateActiveNote({ content })}
                            uploadImage={uploadImageForEditor}
                            className="min-h-[700px] border-none shadow-none ring-0"
                            placeholder="Record your case studies, market observations, and deep research findings here..."
                          />
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-24 text-center">
                        <div className="w-32 h-32 rounded-[48px] bg-primary/[0.02] flex items-center justify-center mb-12 shadow-inner border border-primary/5">
                          <FlaskConical className="w-16 h-16 text-primary opacity-20" />
                        </div>
                        <h4 className="text-2xl font-black text-foreground uppercase tracking-[0.3em] mb-6 leading-none">
                          Playbook Lab
                        </h4>
                        <p className="text-base font-medium text-muted-foreground/60 max-w-sm leading-relaxed mb-12">
                          Choose a research entry from the index or initialize a new deep dive to begin your analysis.
                        </p>
                        <button
                          onClick={addLabNote}
                          className="px-12 py-5 bg-primary text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.3em] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.15)] hover:scale-105 active:scale-95 transition-all"
                        >
                          Initialize New Study
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="trades" className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white border border-primary/10 rounded-[40px] p-12 shadow-sm">
                  <div className="flex items-center justify-between mb-12">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black tracking-[0.3em] text-primary uppercase flex items-center gap-3">
                        <History className="w-5 h-5" /> Performance History
                      </h3>
                      <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Global Sample Size: {filteredTrades.length} Trades</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {filteredTrades.map((trade) => {
                      const outcome = computeOutcome(trade.actualRr, trade.maxRr, trade.netPnl);
                      const style = outcomeStyle[outcome.color];
                      return (
                        <div
                          key={trade.id}
                          onClick={() => onTradeClick?.(trade)}
                          className="group p-6 rounded-3xl bg-[#F8FAFC] border border-primary/5 flex items-center justify-between cursor-pointer hover:bg-white hover:shadow-xl hover:shadow-primary/5 transition-all"
                        >
                          <div className="flex items-center gap-8">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm ${style}`}>
                              {outcome.label}
                            </div>
                            <div className="space-y-1">
                              <p className="text-base font-black text-foreground uppercase tracking-tight">{trade.symbol}</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                {new Date(trade.entryTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-12">
                            <div className="text-right">
                              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40 mb-1">Result</p>
                              <p className={`text-lg font-black ${trade.actualRr > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                {trade.actualRr > 0 ? "+" : ""}{trade.actualRr.toFixed(1)}R
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40 mb-1">Compliance</p>
                              <div className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${trade.complianceCheck ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                                {trade.complianceCheck ? "Pass" : "Fail"}
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="resources" className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white border border-primary/10 rounded-[40px] p-12 shadow-sm">
                  <div className="flex items-center justify-between mb-12">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black tracking-[0.3em] text-primary uppercase flex items-center gap-3">
                        <Library className="w-5 h-5" /> Academy Resources
                      </h3>
                      <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Learning Curriculum & Asset Library</p>
                    </div>
                    <button
                      onClick={() => setIsQuickAddOpen(true)}
                      className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                    >
                      <Plus className="w-4 h-4" /> Add Module
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {model.moodleResources?.map((resource) => (
                      <div key={resource.id} className="p-10 rounded-[40px] bg-[#F8FAFC] border border-primary/5 space-y-8 hover:bg-white hover:shadow-2xl transition-all group">
                        <div className="flex items-center justify-between">
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
                            <GraduationCap className="w-6 h-6" />
                          </div>
                          <div className="flex items-center gap-2">
                            <a href={resource.url} target="_blank" rel="noopener noreferrer" className="p-3 bg-white rounded-xl shadow-sm hover:text-primary transition-all">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                             <button
                              onClick={() => {
                                onUpdate({
                                  ...model,
                                  moodleResources: model.moodleResources?.filter((r) => r.id !== resource.id)
                                });
                                toast.success("Module removed");
                              }}
                              className="p-3 bg-white border border-rose-500/5 rounded-xl text-muted-foreground hover:text-rose-500 hover:border-rose-500/20 transition-all shadow-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <h4 className="text-xl font-black text-foreground uppercase tracking-tight leading-none">{resource.title}</h4>
                            <p className="text-sm font-medium text-muted-foreground/60 line-clamp-2 leading-relaxed">{resource.description}</p>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-primary/60">
                              <span>Module Completion</span>
                              <span>{resource.progress || 0}%</span>
                            </div>
                            <div className="h-2 w-full bg-primary/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary transition-all duration-1000" 
                                style={{ width: `${resource.progress || 0}%` }} 
                              />
                            </div>
                          </div>
                        </div>

                        {/* Lessons Accordion Style */}
                        {resource.subLinks && resource.subLinks.length > 0 && (
                          <div className="space-y-3 pt-4">
                            <div
                              className="flex items-center justify-between cursor-pointer group/label"
                              onClick={() => setExpandedResourceId(expandedResourceId === resource.id ? null : resource.id)}
                            >
                              <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                                <Play className="w-3 h-3" /> {resource.subLinks.length} Lessons
                              </p>
                              <ChevronRight className={`w-4 h-4 text-primary/30 transition-transform duration-300 ${expandedResourceId === resource.id ? "rotate-90" : ""}`} />
                            </div>
                            
                            <AnimatePresence>
                              {expandedResourceId === resource.id && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden space-y-2"
                                >
                                  {resource.subLinks.map((link) => (
                                    <a
                                      key={link.id}
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-between p-4 rounded-2xl bg-white border border-primary/5 hover:border-primary/20 hover:shadow-md transition-all group/link"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-primary/20 group-hover/link:bg-primary transition-colors" />
                                        <span className="text-[11px] font-bold text-muted-foreground group-hover/link:text-foreground transition-colors uppercase tracking-wide">
                                          {link.title}
                                        </span>
                                      </div>
                                      <ArrowRight className="w-3.5 h-3.5 text-primary/0 group-hover/link:text-primary group-hover/link:opacity-100 transition-all" />
                                    </a>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>

       {/* Quick Add Resource Dialog */}
      <Dialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
        <DialogContent className="sm:max-w-[600px] bg-white rounded-[40px] border-primary/10 p-10">
          <DialogHeader className="mb-8">
            <DialogTitle className="text-2xl font-black tracking-tight text-foreground uppercase flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-primary" /> New Academy Module
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Module Title</Label>
                <Input
                  value={quickAddForm.title}
                  onChange={(e) => setQuickAddForm({ ...quickAddForm, title: e.target.value })}
                  placeholder="Module Name..."
                  className="bg-primary/5 border-transparent focus:bg-white focus:border-primary/20 rounded-2xl h-12 px-6 text-sm font-bold transition-all"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Main URL (Optional)</Label>
                <Input
                  value={quickAddForm.url}
                  onChange={(e) => setQuickAddForm({ ...quickAddForm, url: e.target.value })}
                  placeholder="https://..."
                  className="bg-primary/5 border-transparent focus:bg-white focus:border-primary/20 rounded-2xl h-12 px-6 text-sm font-bold transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Description</Label>
              <Input
                value={quickAddForm.description}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, description: e.target.value })}
                placeholder="Brief module description..."
                className="bg-primary/5 border-transparent focus:bg-white focus:border-primary/20 rounded-2xl h-12 px-6 text-sm font-bold transition-all"
              />
            </div>

            {/* Sub-links builder */}
            <div className="p-6 rounded-3xl bg-primary/[0.02] border border-primary/5 space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <Play className="w-3 h-3" /> Lesson Builder
              </Label>
              
              <div className="grid grid-cols-2 gap-4">
                <Input
                  value={newSubLink.title}
                  onChange={(e) => setNewSubLink({ ...newSubLink, title: e.target.value })}
                  placeholder="Lesson Title"
                  className="bg-white border-primary/10 rounded-xl h-10 px-4 text-xs"
                />
                <div className="flex gap-2">
                  <Input
                    value={newSubLink.url}
                    onChange={(e) => setNewSubLink({ ...newSubLink, url: e.target.value })}
                    placeholder="URL"
                    className="bg-white border-primary/10 rounded-xl h-10 px-4 text-xs flex-1"
                  />
                  <button
                    onClick={addSubLinkToForm}
                    className="p-2 bg-primary text-white rounded-xl hover:opacity-90 shadow-lg shadow-primary/20"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {quickAddForm.subLinks.length > 0 && (
                <div className="space-y-2 pt-2">
                  {quickAddForm.subLinks.map((link) => (
                    <div key={link.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-primary/5">
                      <span className="text-[11px] font-bold text-foreground">{link.title}</span>
                      <button
                        onClick={() => setQuickAddForm(prev => ({
                          ...prev,
                          subLinks: prev.subLinks.filter(l => l.id !== link.id)
                        }))}
                        className="text-rose-500 p-1 hover:bg-rose-50 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={handleQuickAdd}
                className="px-10 h-14 bg-primary text-white rounded-[24px] text-xs font-black uppercase tracking-[0.2em] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.15)] hover:opacity-90 active:scale-95 transition-all"
              >
                Create Academy Module
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
