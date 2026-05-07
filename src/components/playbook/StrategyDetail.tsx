import { useState, useMemo, useEffect, useRef } from "react";
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
  Library,
  FileJson,
  Globe,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { generateId } from "@/lib/utils";
import { uploadChartImage, getChartUrl, deleteChartImage } from "@/lib/journal";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/** Extract R2 storage paths from all <img> src attributes in an HTML string. */
function extractR2Paths(html: string): Set<string> {
  const paths = new Set<string>();
  if (!html) return paths;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('img').forEach((img) => {
    const match = (img.getAttribute('src') || '').match(/\/storage\/(.+)/);
    if (match) paths.add(match[1]);
  });
  return paths;
}

/** Flatten R2 paths from all lab note content fields. */
function flattenR2Paths(notes: Array<{ content?: string }>): Set<string> {
  const paths = new Set<string>();
  notes.forEach((note) => {
    extractR2Paths(note.content || '').forEach((p) => paths.add(p));
  });
  return paths;
}

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
  const [isSavingDef, setIsSavingDef] = useState(false);
  const [lastSavedAtDef, setLastSavedAtDef] = useState<string | null>(null);
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

  // Auto-save + R2 cleanup for Definition (2s debounce)
  useEffect(() => {
    if (definition === (model.definition || "")) return;
    setIsSavingDef(true);
    const timer = setTimeout(async () => {
      // Find image paths removed from editor since last save
      const oldPaths = extractR2Paths(model.definition || "");
      const newPaths = extractR2Paths(definition);
      const removed = [...oldPaths].filter((p) => !newPaths.has(p));

      onUpdate({ ...model, definition });

      // Silently delete orphaned R2 objects
      await Promise.allSettled(removed.map((p) => deleteChartImage(p)));

      setIsSavingDef(false);
      setLastSavedAtDef(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    }, 2000);
    return () => clearTimeout(timer);
  }, [definition]);


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

  // Auto-save + R2 cleanup for Lab Notes
  const [isSaving, setIsSaving] = useState(false);
  const lastPropsNotes = JSON.stringify(model.labNotes);

  useEffect(() => {
    const currentNotesStr = JSON.stringify(labNotes);
    if (currentNotesStr === lastPropsNotes) return;

    setIsSaving(true);
    const timer = setTimeout(async () => {
      // Flatten all image paths from old notes vs new notes
      const oldPaths = flattenR2Paths(model.labNotes ?? []);
      const newPaths = flattenR2Paths(labNotes);
      const removed = [...oldPaths].filter((p) => !newPaths.has(p));

      onUpdate({ ...model, labNotes });

      // Silently delete orphaned R2 objects
      await Promise.allSettled(removed.map((p) => deleteChartImage(p)));

      setIsSaving(false);
      setLastSavedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    }, 2000);

    return () => clearTimeout(timer);
  }, [labNotes, lastPropsNotes, onUpdate]);

  // ─── Export / Import helpers ──────────────────────────────────────────
  const importFileRef = useRef<HTMLInputElement>(null);

  /** Trigger a browser file download. */
  function triggerDownload(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Slugify setup name for filenames. */
  function slugify(text: string) {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  function handleExportJson() {
    const date = new Date().toISOString().slice(0, 10);
    const payload = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      setup: {
        name: model.name,
        timeframe: model.timeframe,
        marketCondition: model.marketCondition,
        killzones: model.killzones,
        definition: model.definition ?? '',
        labNotes: (model.labNotes ?? []).map((n) => ({
          id: n.id,
          title: n.title,
          content: n.content ?? '',
        })),
      },
    };
    triggerDownload(
      `${slugify(model.name)}_backup_${date}.json`,
      JSON.stringify(payload, null, 2),
      'application/json',
    );
    toast.success('JSON backup downloaded!');
  }

  /**
   * Rewrite relative /storage/ paths to absolute production URLs so images
   * display correctly when the HTML file is opened offline.
   */
  function absolutizeHtml(html: string): string {
    const PROD = 'https://trading-journal-3di.pages.dev';
    // Use regex to replace src="/storage/..." → src="https://...pages.dev/storage/..."
    // Handles both single and double quotes.
    return html.replace(
      /(src=["'])\/storage\//g,
      `$1${PROD}/storage/`,
    );
  }

  function handleExportHtml() {
    const date = new Date().toLocaleDateString('vi-VN');
    const labNotesHtml = (model.labNotes ?? []).length === 0
      ? '<p style="color:#94a3b8;font-style:italic">No lab notes yet.</p>'
      : (model.labNotes ?? []).map((n, i) => `
        <article style="margin-bottom:3rem;padding:2rem;background:#f8fafc;border-radius:24px;border:1px solid #e2e8f0">
          <h3 style="font-size:1rem;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:#6366f1;margin:0 0 1.5rem">
            Note ${i + 1} · ${n.title || 'Untitled'}
          </h3>
          <div class="rich-content">${absolutizeHtml(n.content ?? '')}</div>
        </article>`).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${model.name} — Playbook Backup</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; padding: 3rem 1rem; }
    .wrapper { max-width: 900px; margin: 0 auto; }
    .header { background: #fff; border-radius: 32px; padding: 2.5rem; margin-bottom: 2rem; border: 1px solid #e2e8f0; box-shadow: 0 4px 24px rgba(0,0,0,.04); }
    .header h1 { font-size: 2.5rem; font-weight: 900; letter-spacing: -.04em; text-transform: uppercase; color: #6366f1; }
    .header .meta { font-size: .75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .1em; margin-top: .75rem; }
    .section { background: #fff; border-radius: 32px; padding: 2.5rem; margin-bottom: 2rem; border: 1px solid #e2e8f0; box-shadow: 0 4px 24px rgba(0,0,0,.04); }
    .section-title { font-size: .65rem; font-weight: 900; text-transform: uppercase; letter-spacing: .2em; color: #6366f1; margin-bottom: 1.5rem; display: flex; align-items: center; gap: .5rem; }
    .section-title::before { content: ''; display: inline-block; width: 8px; height: 8px; background: #6366f1; border-radius: 50%; }
    .rich-content h1 { font-size: 2rem; font-weight: 700; margin: 2rem 0 1rem; }
    .rich-content h2 { font-size: 1.5rem; font-weight: 700; margin: 1.5rem 0 .75rem; }
    .rich-content h3 { font-size: 1.2rem; font-weight: 700; margin: 1.25rem 0 .5rem; }
    .rich-content p { line-height: 1.7; margin-bottom: 1rem; }
    .rich-content img { max-width: 100%; border-radius: 16px; margin: 1.5rem 0; box-shadow: 0 8px 32px rgba(0,0,0,.08); }
    .rich-content ul, .rich-content ol { padding-left: 1.5rem; margin-bottom: 1rem; }
    .rich-content li { line-height: 1.7; margin-bottom: .25rem; }
    .rich-content blockquote { border-left: 4px solid #6366f1; padding-left: 1.5rem; color: #475569; font-style: italic; margin: 1.5rem 0; }
    .rich-content strong { font-weight: 800; }
    .rich-content a { color: #6366f1; text-decoration: underline; }
    .empty { color: #94a3b8; font-style: italic; font-size: .875rem; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>${model.name}</h1>
      <div class="meta">
        ${model.timeframe} · ${model.marketCondition} · ${model.killzones}
        &nbsp;·&nbsp; Exported ${date}
      </div>
    </div>

    <div class="section">
      <div class="section-title">📖 Definition</div>
      ${model.definition
        ? `<div class="rich-content">${absolutizeHtml(model.definition)}</div>`
        : '<p class="empty">No definition content yet.</p>'
      }
    </div>

    <div class="section">
      <div class="section-title">🔬 Playbook Lab — ${(model.labNotes ?? []).length} Note(s)</div>
      ${labNotesHtml}
    </div>
  </div>
</body>
</html>`;

    const date2 = new Date().toISOString().slice(0, 10);
    triggerDownload(
      `${slugify(model.name)}_backup_${date2}.html`,
      html,
      'text/html',
    );
    toast.success('HTML backup downloaded!');
  }

  function handleImportJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const setup = json?.setup;
        if (!setup) throw new Error('Invalid backup file — missing setup field.');
        const updated: PlaybookModel = {
          ...model,
          definition: typeof setup.definition === 'string' ? setup.definition : model.definition,
          labNotes: Array.isArray(setup.labNotes) ? setup.labNotes : model.labNotes,
        };
        onUpdate(updated);
        toast.success('Playbook restored from JSON backup!');
      } catch (err: any) {
        toast.error(`Import failed: ${err.message}`);
      } finally {
        // Reset input so same file can be re-selected
        if (importFileRef.current) importFileRef.current.value = '';
      }
    };
    reader.readAsText(file);
  }
  // ────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC]">
      {/* Premium Breadcrumb Header - Sticky for quick navigation */}
      <div className="bg-white/80 backdrop-blur-md border-b border-primary/5 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
          <span className="hover:text-primary cursor-pointer transition-colors" onClick={onBack}>Playbook</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-primary">{model.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Export / Import dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/10 transition-all active:scale-95"
                title="Export / Import"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-2xl p-2 border-primary/10 shadow-2xl">
              <DropdownMenuItem
                onClick={handleExportJson}
                className="rounded-xl font-black uppercase text-[10px] p-3 flex items-center gap-3 cursor-pointer"
              >
                <FileJson className="w-4 h-4 text-primary" />
                <div>
                  <div>Export JSON</div>
                  <div className="text-[9px] font-medium normal-case text-muted-foreground tracking-normal">Để restore lại app</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportHtml}
                className="rounded-xl font-black uppercase text-[10px] p-3 flex items-center gap-3 cursor-pointer"
              >
                <Globe className="w-4 h-4 text-emerald-500" />
                <div>
                  <div>Export HTML</div>
                  <div className="text-[9px] font-medium normal-case text-muted-foreground tracking-normal">Đọc offline / lưu trữ</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                onClick={() => importFileRef.current?.click()}
                className="rounded-xl font-black uppercase text-[10px] p-3 flex items-center gap-3 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-amber-500" />
                <div>
                  <div>Import JSON</div>
                  <div className="text-[9px] font-medium normal-case text-muted-foreground tracking-normal">Khôi phục từ backup</div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Hidden file input for JSON import */}
          <input
            ref={importFileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportJson}
          />

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

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold tracking-[0.3em] text-primary uppercase flex items-center gap-3">
                          <Layout className="w-5 h-5" /> Strategy Definition
                        </h3>
                        <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Core Architecture & Principles</p>
                      </div>
                      {/* Auto-save indicator */}
                      {isSavingDef ? (
                        <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em] bg-primary/5 px-4 py-2 rounded-full border border-primary/10 animate-pulse">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" /> Syncing...
                        </div>
                      ) : lastSavedAtDef ? (
                        <div className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] bg-emerald-500/5 px-4 py-2 rounded-full border border-emerald-500/10">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Saved at {lastSavedAtDef}
                        </div>
                      ) : null}
                    </div>

                    <RichEditor
                      value={definition}
                      onChange={setDefinition}
                      uploadImage={uploadImageForEditor}
                      className="min-h-[500px]"
                    />
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
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                        {model.confluenceOrder.map((groupKey) => {
                          const items = model.setupConfluences[groupKey] || [];
                          return (
                            <div key={groupKey} className="space-y-3">
                              <p className="text-[10px] font-bold text-primary uppercase tracking-widest opacity-70 flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                {groupKey}
                              </p>
                              {items.length === 0 ? (
                                <p className="text-xs text-muted-foreground/30 italic">No rules defined</p>
                              ) : (
                                <ul className="space-y-2">
                                  {items.map((item) => (
                                    <li key={item} className="flex items-start gap-2 p-3 rounded-2xl bg-primary/[0.01] border border-primary/5 hover:bg-primary/[0.03] transition-all">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                                      <span className="text-sm font-medium text-foreground leading-relaxed">{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
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
