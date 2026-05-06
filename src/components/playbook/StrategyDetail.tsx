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
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { generateId } from "@/lib/utils";
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
  onDelete: () => void;
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
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [expandedResourceId, setExpandedResourceId] = useState<string | null>(null);
  const [quickAddForm, setQuickAddForm] = useState({
    title: "",
    description: "",
    url: "",
    type: "video" as const,
    progress: 0,
    subLinks: [] as { id: string; title: string; url: string }[]
  });
  const [newSubLink, setNewSubLink] = useState({ title: "", url: "" });

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

  const groupedConfluences = useMemo(() => {
    return model.setupConfluences;
  }, [model.setupConfluences]);

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
    <div
      className="h-full flex flex-col space-y-6 mobile-pb animate-in fade-in slide-in-from-bottom-2 duration-500"
      onPaste={handlePaste}
      tabIndex={0}
    >
      {/* Institutional Header Section */}
      <div className="relative overflow-hidden bg-primary/[0.02] border border-primary/10 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px]" />
        </div>

        <div className="relative flex flex-col sm:flex-row gap-8 items-start sm:items-center">
          {/* Cover/Thumbnail */}
          <div className="w-full sm:w-48 aspect-video rounded-xl overflow-hidden border border-primary/20 shadow-xl shadow-primary/5 group relative bg-black/5">
            {coverImage ? (
              <img
                src={coverImage}
                alt="Strategy Cover"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
                <LayoutDashboard className="w-12 h-12" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <button
                    onClick={onBack}
                    className="p-2 hover:bg-primary/10 rounded-lg text-muted-foreground hover:text-primary transition-all shrink-0 border border-transparent hover:border-primary/20"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground uppercase truncate">
                    {model.name}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border ${
                      model.status === "Approved"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                        : model.status === "Testing"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-600"
                          : "bg-indigo-500/10 border-indigo-500/30 text-indigo-600"
                    }`}
                  >
                    {model.status}
                  </span>
                  <div className="h-4 w-[1px] bg-primary/10 hidden sm:block" />
                  <div className="flex items-center gap-4 text-xs text-muted-foreground/80 font-medium uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> {model.timeframe}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" /> {model.marketCondition}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={onEdit}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-xl text-xs font-bold text-foreground transition-all uppercase tracking-widest"
                >
                  <Edit className="w-4 h-4" /> Edit Model
                </button>
                <button
                  onClick={() => {
                    if (confirm("Permanently delete this strategy?")) onDelete();
                  }}
                  className="p-2.5 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all border border-transparent hover:border-rose-500/20"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="narrative" className="flex-1 flex flex-col min-h-0">
        <TabsList className="bg-primary/5 border border-primary/10 p-1 mb-8 self-start rounded-xl">
          <TabsTrigger
            value="narrative"
            className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm px-6 py-2 text-[10px] font-bold tracking-[0.15em] uppercase rounded-lg transition-all"
          >
            <FileText className="w-4 h-4 mr-2" /> DEFINITION
          </TabsTrigger>
          <TabsTrigger
            value="logic"
            className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm px-6 py-2 text-[10px] font-bold tracking-[0.15em] uppercase rounded-lg transition-all"
          >
            <Zap className="w-4 h-4 mr-2" /> LOGIC
          </TabsTrigger>
          <TabsTrigger
            value="visuals"
            className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm px-6 py-2 text-[10px] font-bold tracking-[0.15em] uppercase rounded-lg transition-all"
          >
            <ImageIcon className="w-4 h-4 mr-2" /> CHART STUDIES
          </TabsTrigger>
          <TabsTrigger
            value="trades"
            className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm px-6 py-2 text-[10px] font-bold tracking-[0.15em] uppercase rounded-lg transition-all"
          >
            <History className="w-4 h-4 mr-2" /> PERFORMANCE LOG
          </TabsTrigger>
        </TabsList>

        <TabsContent value="narrative" className="flex-1 min-h-0 overflow-hidden outline-none">
          <div className="h-full overflow-y-auto pr-2 space-y-6 scrollbar-thin">
            <div className="bg-white border border-primary/10 rounded-2xl p-8 shadow-sm group relative">
              <div className="flex items-center justify-between border-b border-primary/5 pb-6 mb-8">
                <div className="space-y-1">
                  <h3 className="text-sm font-black tracking-[0.2em] text-foreground uppercase">
                    Institutional Definition
                  </h3>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                    Framework for Bias & HTF Context
                  </p>
                </div>
                {isEditingDefinition ? (
                  <button
                    onClick={saveDefinition}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <Save className="w-4 h-4" /> Save Definition
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditingDefinition(true)}
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-2 px-4 py-2 bg-primary/5 text-primary rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-all"
                  >
                    <Edit className="w-4 h-4" /> Edit Framework
                  </button>
                )}
              </div>

              {isEditingDefinition ? (
                <div className="space-y-4">
                  <RichEditor
                    value={definition}
                    onChange={setDefinition}
                    className="min-h-[500px]"
                    placeholder="Establish the HTF narrative, daily bias rules, and situational context..."
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                  <div
                    className="lg:col-span-3 text-sm text-muted-foreground/90 rich-content max-w-none min-h-[300px] leading-relaxed cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => setIsEditingDefinition(true)}
                    dangerouslySetInnerHTML={{
                      __html: model.definition || "Establish your institutional framework here.",
                    }}
                  />
                  
                  {/* Academy Resources Sidebar */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <GraduationCap className="w-4 h-4 text-emerald-500" />
                        </div>
                        <h3 className="text-[10px] font-black tracking-[0.2em] text-foreground/40 uppercase">
                          Academy Resources
                        </h3>
                      </div>
                      
                      {/* Quick Add Modal */}
                      <Dialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
                        <DialogTrigger asChild>
                          <button className="w-8 h-8 rounded-lg bg-primary/5 hover:bg-primary/10 flex items-center justify-center text-primary/40 hover:text-primary transition-all">
                            <Plus className="w-4 h-4" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#1A1F2E] border-white/10 text-white rounded-[32px] sm:max-w-[500px] overflow-hidden">
                          <DialogHeader>
                            <DialogTitle className="text-[12px] font-black uppercase tracking-[0.3em] text-primary">
                              Pro Module Builder
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-6 py-6 overflow-y-auto max-h-[70vh] pr-2 scrollbar-thin">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-40">Title</Label>
                                <Input 
                                  value={quickAddForm.title}
                                  onChange={e => setQuickAddForm(prev => ({ ...prev, title: e.target.value }))}
                                  className="bg-white/5 border-white/10 rounded-2xl h-12 text-xs font-bold"
                                />
                              </div>
                              <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest opacity-40">Type</Label>
                                <select 
                                  value={quickAddForm.type}
                                  onChange={e => setQuickAddForm(prev => ({ ...prev, type: e.target.value as any }))}
                                  className="w-full bg-white/5 border border-white/10 rounded-2xl h-12 text-[10px] font-black uppercase tracking-widest px-4 outline-none"
                                >
                                  <option value="video">Video</option>
                                  <option value="reading">Reading</option>
                                  <option value="quiz">Quiz</option>
                                </select>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <Label className="text-[10px] font-black uppercase tracking-widest opacity-40">Description</Label>
                              <Input 
                                value={quickAddForm.description}
                                onChange={e => setQuickAddForm(prev => ({ ...prev, description: e.target.value }))}
                                className="bg-white/5 border-white/10 rounded-2xl h-12 text-xs font-bold"
                              />
                            </div>

                            <div className="space-y-4 pt-4 border-t border-white/5">
                              <Label className="text-[10px] font-black uppercase tracking-widest opacity-40">Module Playlist (Sub-links)</Label>
                              <div className="space-y-3">
                                {quickAddForm.subLinks.map((link) => (
                                  <div key={link.id} className="flex items-center gap-2 bg-white/5 p-3 rounded-xl border border-white/5">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[10px] font-bold truncate">{link.title}</p>
                                    </div>
                                    <button 
                                      onClick={() => setQuickAddForm(prev => ({ ...prev, subLinks: prev.subLinks.filter(l => l.id !== link.id) }))}
                                      className="text-rose-500/40 hover:text-rose-500"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                                <div className="flex gap-2">
                                  <Input 
                                    placeholder="Lesson Name"
                                    value={newSubLink.title}
                                    onChange={e => setNewSubLink(prev => ({ ...prev, title: e.target.value }))}
                                    className="bg-white/5 border-white/10 rounded-2xl h-10 text-[10px] font-bold flex-[2]"
                                  />
                                  <Input 
                                    placeholder="Lesson URL"
                                    value={newSubLink.url}
                                    onChange={e => setNewSubLink(prev => ({ ...prev, url: e.target.value }))}
                                    className="bg-white/5 border-white/10 rounded-2xl h-10 text-[10px] font-bold flex-[3]"
                                  />
                                  <button 
                                    onClick={addSubLinkToForm}
                                    className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center hover:bg-primary/30"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3 pt-4 border-t border-white/5">
                              <Label className="text-[10px] font-black uppercase tracking-widest opacity-40">Main URL (Optional if playlist exists)</Label>
                              <Input 
                                value={quickAddForm.url}
                                onChange={e => setQuickAddForm(prev => ({ ...prev, url: e.target.value }))}
                                className="bg-white/5 border-white/10 rounded-2xl h-12 text-xs font-bold"
                              />
                            </div>

                            <Button 
                              onClick={handleQuickAdd}
                              className="w-full bg-primary hover:bg-primary/90 text-white rounded-2xl h-14 text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20"
                            >
                              Initialize Module
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    
                    <div className="space-y-4">
                      {model.moodleResources?.map((res) => {
                        const isExpanded = expandedResourceId === res.id;
                        const hasSubLinks = res.subLinks && res.subLinks.length > 0;
                        
                        return (
                          <div
                            key={res.id}
                            className={`group relative overflow-hidden rounded-[32px] transition-all duration-500 border ${
                              isExpanded 
                                ? 'bg-[#1A1F2E] border-white/20 shadow-2xl shadow-black/50' 
                                : 'bg-[#1A1F2E] border-white/5 hover:border-white/10 hover:translate-y-[-2px]'
                            }`}
                          >
                            {/* Card Content */}
                            <div 
                              className="p-8 cursor-pointer"
                              onClick={() => setExpandedResourceId(isExpanded ? null : res.id)}
                            >
                              <div className="flex items-start justify-between mb-8">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                                  res.type === 'video' ? 'bg-amber-500/10 text-amber-500' :
                                  res.type === 'reading' ? 'bg-indigo-500/10 text-indigo-500' :
                                  'bg-emerald-500/10 text-emerald-500'
                                }`}>
                                  {res.type === 'video' ? <Play className="w-6 h-6" /> : 
                                   res.type === 'reading' ? <FileText className="w-6 h-6" /> : 
                                   <GraduationCap className="w-6 h-6" />}
                                </div>
                                {hasSubLinks && (
                                  <div className="flex items-center gap-3">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-white/20 bg-white/5 px-3 py-1.5 rounded-full">
                                      {res.subLinks?.length} Lessons
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-2 mb-8">
                                <h4 className="text-sm font-black text-white group-hover:text-primary transition-colors duration-300">
                                  {res.title}
                                </h4>
                                <p className="text-[11px] text-white/40 font-medium leading-relaxed line-clamp-2">
                                  {res.description}
                                </p>
                              </div>

                              <div className="space-y-4">
                                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                                  <span className="text-white/20">Progress</span>
                                  <span className="text-white">{res.progress || 0}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${res.progress || 0}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className={`h-full rounded-full ${
                                      res.type === 'video' ? 'bg-amber-500' :
                                      res.type === 'reading' ? 'bg-indigo-500' :
                                      'bg-emerald-500'
                                    }`}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Expandable Lessons List */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.4, ease: "easeInOut" }}
                                  className="border-t border-white/5 bg-black/20"
                                >
                                  <div className="p-6 space-y-2">
                                    {hasSubLinks ? (
                                      res.subLinks?.map((link, idx) => (
                                        <a
                                          key={link.id}
                                          href={link.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all group/link"
                                        >
                                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-white/40 group-hover/link:bg-primary/20 group-hover/link:text-primary transition-all">
                                            {idx + 1}
                                          </div>
                                          <div className="flex-1">
                                            <p className="text-[11px] font-bold text-white group-hover/link:text-primary transition-colors">
                                              {link.title}
                                            </p>
                                          </div>
                                          <ArrowRight className="w-3 h-3 text-white/20 group-hover/link:translate-x-1 group-hover/link:text-primary transition-all" />
                                        </a>
                                      ))
                                    ) : (
                                      <a
                                        href={res.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all group/link"
                                      >
                                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 group-hover/link:bg-primary/20 group-hover/link:text-primary">
                                          <Play className="w-3 h-3" />
                                        </div>
                                        <p className="text-[11px] font-bold text-white group-hover/link:text-primary">
                                          Watch Main Content
                                        </p>
                                        <ArrowRight className="w-3 h-3 text-white/20 ml-auto" />
                                      </a>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                      {(!model.moodleResources || model.moodleResources.length === 0) && (
                        <div className="flex flex-col items-center justify-center py-20 px-6 text-center border border-white/5 rounded-[40px] bg-[#1A1F2E]/50">
                          <GraduationCap className="w-12 h-12 text-white/10 mb-5" />
                          <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.25em]">
                            Curriculum Pending
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent
          value="logic"
          className="flex-1 overflow-y-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 outline-none pb-12"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Definition Group */}
            <div className="bg-white border border-primary/10 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 border-b border-primary/5 pb-4 mb-6">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                </div>
                <h3 className="text-[10px] font-black tracking-[0.2em] text-foreground uppercase">
                  HTF Analyst
                </h3>
              </div>
              <div className="space-y-3">
                {groupedConfluences.narrative.map((label) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 text-xs font-semibold text-foreground/80 bg-primary/[0.02] p-4 rounded-xl border border-primary/5 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      {label}
                    </div>
                    {model.moodleResources?.find(r => r.title.toLowerCase().includes(label.toLowerCase())) && (
                      <a 
                        href={model.moodleResources.find(r => r.title.toLowerCase().includes(label.toLowerCase()))?.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-40 group-hover:opacity-100 p-1.5 hover:bg-primary/10 rounded-lg transition-all"
                        title="View Lesson"
                      >
                        <LinkIcon className="w-3.5 h-3.5 text-primary" />
                      </a>
                    )}
                  </div>
                ))}
                {groupedConfluences.narrative.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/50 italic py-4 text-center">
                    No narrative confluences defined.
                  </p>
                )}
              </div>
            </div>

            {/* Context Area Group */}
            <div className="bg-white border border-primary/10 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 border-b border-primary/5 pb-4 mb-6">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-500" />
                </div>
                <h3 className="text-[10px] font-black tracking-[0.2em] text-foreground uppercase">
                  Context Area
                </h3>
              </div>
              <div className="space-y-3">
                {groupedConfluences.liquidity.map((label) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 text-xs font-semibold text-foreground/80 bg-primary/[0.02] p-4 rounded-xl border border-primary/5 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      {label}
                    </div>
                    {model.moodleResources?.find(r => r.title.toLowerCase().includes(label.toLowerCase())) && (
                      <a 
                        href={model.moodleResources.find(r => r.title.toLowerCase().includes(label.toLowerCase()))?.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-40 group-hover:opacity-100 p-1.5 hover:bg-primary/10 rounded-lg transition-all"
                        title="View Lesson"
                      >
                        <LinkIcon className="w-3.5 h-3.5 text-primary" />
                      </a>
                    )}
                  </div>
                ))}
                {groupedConfluences.liquidity.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/50 italic py-4 text-center">
                    No context area defined.
                  </p>
                )}
              </div>
            </div>

            {/* Logic Group */}
            <div className="bg-white border border-primary/10 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 border-b border-primary/5 pb-4 mb-6">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Target className="w-4 h-4 text-emerald-500" />
                </div>
                <h3 className="text-[10px] font-black tracking-[0.2em] text-foreground uppercase">
                  Confirmation (LTF)
                </h3>
              </div>
              <div className="space-y-3">
                {groupedConfluences.confirmation.map((label) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 text-xs font-semibold text-foreground/80 bg-primary/[0.02] p-4 rounded-xl border border-primary/5 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {label}
                    </div>
                    {model.moodleResources?.find(r => r.title.toLowerCase().includes(label.toLowerCase())) && (
                      <a 
                        href={model.moodleResources.find(r => r.title.toLowerCase().includes(label.toLowerCase()))?.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-primary/10 rounded transition-all"
                      >
                        <LinkIcon className="w-3 h-3 text-primary" />
                      </a>
                    )}
                  </div>
                ))}
                {groupedConfluences.confirmation.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/50 italic py-4 text-center">
                    No entry triggers defined.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Execution Protocol Grid */}
          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-8">
            <h3 className="text-[10px] font-black tracking-[0.2em] text-foreground uppercase mb-8 flex items-center gap-3">
              <Settings2 className="w-4 h-4 text-primary" /> Execution Protocol
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
              <div className="space-y-2">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em]">
                  Primary Entry
                </p>
                <p className="text-sm font-bold text-foreground">
                  {model.executionRules.entry || "PROTOCOL_UNDEFINED"}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em]">
                  Defensive Stop
                </p>
                <p className="text-sm font-bold text-foreground">
                  {model.executionRules.stopLoss || "PROTOCOL_UNDEFINED"}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em]">
                  Take Profit
                </p>
                <p className="text-sm font-bold text-foreground">
                  {model.executionRules.takeProfit || "PROTOCOL_UNDEFINED"}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em]">
                  Risk Allocation
                </p>
                <p className="text-sm font-bold text-foreground">
                  {model.executionRules.riskPercent || "PROTOCOL_UNDEFINED"}
                </p>
              </div>
              <div className="sm:col-span-4 space-y-2 pt-6 border-t border-primary/10">
                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.15em]">
                  Trade Management & Break Even
                </p>
                <p className="text-sm font-bold text-foreground leading-relaxed">
                  {model.executionRules.breakEven || "PROTOCOL_UNDEFINED"}
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="visuals" className="flex-1 min-h-0 overflow-hidden outline-none pb-8">
          <div className="bg-white border border-primary/10 rounded-2xl h-full flex flex-col overflow-hidden shadow-sm relative">
            <div className="px-6 py-4 border-b border-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-[10px] font-black tracking-[0.2em] text-foreground uppercase flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" /> Strategy Visuals
              </h3>
              <div className="flex gap-2">
                {[
                  { id: "perfect", label: "Model A+" },
                  { id: "loss", label: "Model Loss" },
                  { id: "mistake", label: "Compliance Failure" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveImageType(tab.id as "perfect" | "loss" | "mistake")}
                    className={`px-4 py-2 rounded-lg text-[9px] font-bold tracking-widest transition-all uppercase border ${
                      activeImageType === tab.id
                        ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                        : "bg-primary/5 text-muted-foreground border-transparent hover:bg-primary/10 hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
              {imagesForActiveType.length === 0 ? (
                <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-muted-foreground/30 border-2 border-dashed border-primary/10 rounded-2xl p-12 text-center">
                  <ImageIcon className="w-16 h-16 mb-6 opacity-10" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
                    No studies captured
                  </p>
                  <p className="text-[9px] font-medium uppercase tracking-widest opacity-60">
                    Paste image (Cmd+V) to build your visual library
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  {imagesForActiveType.map((img) => (
                    <div
                      key={img.id}
                      className="relative group rounded-2xl overflow-hidden border border-primary/10 bg-black/5 shadow-md aspect-video"
                    >
                      <img
                        src={img.url}
                        alt="Study"
                        className="w-full h-full object-contain bg-black/20"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-[2px]">
                        <button
                          onClick={() => removeImage(img.id)}
                          className="p-4 bg-rose-500 text-white rounded-2xl hover:bg-rose-600 transition-all transform scale-90 group-hover:scale-100 shadow-xl"
                        >
                          <Trash2 className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="border-2 border-dashed border-primary/10 rounded-2xl flex flex-col items-center justify-center p-8 bg-primary/[0.02] text-muted-foreground/40 hover:bg-primary/[0.04] transition-all cursor-pointer">
                    <Plus className="w-8 h-8 mb-3 opacity-20" />
                    <p className="text-[9px] font-bold uppercase tracking-widest">
                      Add more studies
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent
          value="trades"
          className="flex-1 min-h-0 flex flex-col gap-6 overflow-hidden outline-none pb-8"
        >
          <div className="bg-white border border-primary/10 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-sm">
            <div className="px-8 py-6 border-b border-primary/5 flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <h3 className="text-sm font-black tracking-[0.2em] text-foreground uppercase">
                  Performance History
                </h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                  Historical Execution Records
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-primary bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20 uppercase tracking-widest">
                  {filteredTrades.length} Samples
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {filteredTrades.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground/30 p-20 text-center">
                  <History className="w-16 h-16 mb-6 opacity-10" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]">
                    Log currently empty
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white/95 backdrop-blur-md z-10 border-b border-primary/10">
                    <tr className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                      <th className="p-6">Execution Date</th>
                      <th className="p-6">Outcome Status</th>
                      <th className="p-6">Asset Symbol</th>
                      <th className="p-6 text-right">Net PnL</th>
                      <th className="p-6 text-right">RR Ratio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {filteredTrades.map((t) => {
                      const outcome = computeOutcome(t.actualRr, t.maxRr, t.netPnl);
                      return (
                        <tr
                          key={t.id}
                          onClick={() => onTradeClick?.(t)}
                          className="hover:bg-primary/[0.02] transition-all group cursor-pointer"
                        >
                          <td className="p-6 text-xs font-bold text-muted-foreground/70">
                            {new Date(t.entryTime).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                            })}
                          </td>
                          <td className="p-6">
                            <span
                              className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${outcomeStyle[outcome.color]}`}
                            >
                              {outcome.label}
                            </span>
                          </td>
                          <td className="p-6">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-black text-foreground">{t.symbol}</span>
                              <span
                                className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                                  t.side === "buy"
                                    ? "bg-indigo-500/10 text-indigo-500"
                                    : "bg-rose-500/10 text-rose-500"
                                }`}
                              >
                                {t.side}
                              </span>
                            </div>
                          </td>
                          <td
                            className={`p-6 text-sm font-black text-right tabular-nums ${t.netPnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                          >
                            {t.netPnl >= 0 ? "+" : ""}
                            {t.netPnl.toFixed(2)}
                          </td>
                          <td className="p-6 text-xs font-bold text-muted-foreground/60 text-right tabular-nums">
                            {t.actualRr.toFixed(2)} <span className="opacity-30">/</span>{" "}
                            {t.maxRr.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
