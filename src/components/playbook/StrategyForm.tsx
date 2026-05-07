import { useState } from "react";
import { PlaybookModel, SetupConfluences, ExecutionRules, DEFAULT_CONFLUENCE_KEYS } from "@/types/playbook";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
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
  GraduationCap,
  Plus,
  Link,
  Edit,
  Shield,
  CheckCircle2,
  GripVertical,
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

  // Dynamic confluence groups
  const defaultKeys = [...DEFAULT_CONFLUENCE_KEYS];
  const [confluences, setConfluences] = useState<SetupConfluences>(
    initialData?.setupConfluences || Object.fromEntries(defaultKeys.map((k) => [k, []]))
  );
  const [confluenceOrder, setConfluenceOrder] = useState<string[]>(
    initialData?.confluenceOrder || defaultKeys
  );
  // Per-group input values: { [groupKey]: string }
  const [groupInputs, setGroupInputs] = useState<Record<string, string>>({});
  // Which group name is being edited: { [groupKey]: draft label }
  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");

  const [execution, setExecution] = useState<ExecutionRules>(
    initialData?.executionRules || {
      entry: "",
      stopLoss: "",
      takeProfit: "",
      riskPercent: "1%",
      breakEven: "",
    },
  );

  const [moodleResources, setMoodleResources] = useState(
    initialData?.moodleResources || [],
  );
  const [newResource, setNewResource] = useState({ 
    title: "", 
    description: "",
    url: "", 
    type: "video" as const,
    progress: 0,
    subLinks: [] as { id: string; title: string; url: string }[]
  });
  const [newSubLink, setNewSubLink] = useState({ title: "", url: "" });
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);

  // DnD state
  const [activeItem, setActiveItem] = useState<{ item: string; fromGroup: string } | null>(null);
  const [overGroup, setOverGroup] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragStart = (e: DragStartEvent) => {
    const { item, fromGroup } = e.active.data.current as { item: string; fromGroup: string };
    setActiveItem({ item, fromGroup });
  };

  const handleDragOver = (e: DragOverEvent) => {
    const overId = e.over?.id as string | undefined;
    setOverGroup(overId ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveItem(null);
    setOverGroup(null);
    const { item, fromGroup } = (e.active.data.current ?? {}) as { item: string; fromGroup: string };
    const toGroup = e.over?.id as string | undefined;
    if (!toGroup || toGroup === fromGroup) return;
    setConfluences((prev) => {
      const next = { ...prev };
      next[fromGroup] = (next[fromGroup] || []).filter((c) => c !== item);
      if (!(next[toGroup] || []).includes(item)) {
        next[toGroup] = [...(next[toGroup] || []), item];
      }
      return next;
    });
  };

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
      confluenceOrder,
      executionRules: execution,
      moodleResources,
      images: thumbnail
        ? [
            { id: generateId(), url: thumbnail, type: "perfect" },
            ...(initialData?.images?.filter((img) => img.type !== "perfect") || []),
          ]
        : initialData?.images?.filter((img) => img.type !== "perfect") || [],
    };

    onSave(model);
  };

  /** Add item to a group */
  const addConfluence = (groupKey: string, value: string) => {
    if (!value.trim()) return;
    if ((confluences[groupKey] || []).includes(value.trim())) return;
    setConfluences((prev) => ({
      ...prev,
      [groupKey]: [...(prev[groupKey] || []), value.trim()],
    }));
    setGroupInputs((prev) => ({ ...prev, [groupKey]: "" }));
  };

  /** Remove item from a group */
  const removeConfluence = (groupKey: string, item: string) => {
    setConfluences((prev) => ({
      ...prev,
      [groupKey]: (prev[groupKey] || []).filter((c) => c !== item),
    }));
  };

  /** Rename a group key */
  const renameGroup = (oldKey: string, newKey: string) => {
    const trimmed = newKey.trim();
    if (!trimmed || trimmed === oldKey) { setEditingGroupKey(null); return; }
    if (confluenceOrder.includes(trimmed)) { setEditingGroupKey(null); return; }

    setConfluences((prev) => {
      const next: SetupConfluences = {};
      for (const k of Object.keys(prev)) {
        next[k === oldKey ? trimmed : k] = prev[k];
      }
      return next;
    });
    setConfluenceOrder((prev) => prev.map((k) => (k === oldKey ? trimmed : k)));
    setGroupInputs((prev) => {
      const next = { ...prev };
      if (next[oldKey] !== undefined) { next[trimmed] = next[oldKey]; delete next[oldKey]; }
      return next;
    });
    setEditingGroupKey(null);
  };

  /** Add a new group */
  const addGroup = () => {
    const key = newGroupName.trim();
    if (!key || confluenceOrder.includes(key)) return;
    setConfluences((prev) => ({ ...prev, [key]: [] }));
    setConfluenceOrder((prev) => [...prev, key]);
    setNewGroupName("");
  };

  /** Remove an entire group */
  const removeGroup = (groupKey: string) => {
    if (confluenceOrder.length <= 1) return; // keep at least 1
    setConfluences((prev) => {
      const next = { ...prev };
      delete next[groupKey];
      return next;
    });
    setConfluenceOrder((prev) => prev.filter((k) => k !== groupKey));
  };

  const handleExecutionChange = (key: keyof ExecutionRules, value: string) => {
    setExecution((prev) => ({ ...prev, [key]: value }));
  };

  const addResource = () => {
    if (!newResource.title) return;
    
    if (editingResourceId) {
      setMoodleResources((prev) => 
        prev.map((r) => r.id === editingResourceId ? { ...newResource, id: r.id } : r)
      );
      setEditingResourceId(null);
      toast.success("Module updated");
    } else {
      setMoodleResources((prev) => [...prev, { ...newResource, id: generateId() }]);
      toast.success("Module added");
    }
    
    setNewResource({ 
      title: "", 
      description: "", 
      url: "", 
      type: "video", 
      progress: 0,
      subLinks: []
    });
    setNewSubLink({ title: "", url: "" });
  };

  const addSubLinkToResource = () => {
    if (!newSubLink.title || !newSubLink.url) return;
    setNewResource(prev => ({
      ...prev,
      subLinks: [...(prev.subLinks || []), { ...newSubLink, id: generateId() }]
    }));
    setNewSubLink({ title: "", url: "" });
  };

  const startEditResource = (res: any) => {
    setNewResource({
      title: res.title,
      description: res.description || "",
      url: res.url || "",
      type: res.type,
      progress: res.progress || 0,
      subLinks: res.subLinks || []
    });
    setEditingResourceId(res.id);
  };

  const cancelEdit = () => {
    setEditingResourceId(null);
    setNewResource({ title: "", description: "", url: "", type: "video", progress: 0, subLinks: [] });
  };

  const removeResource = (id: string) => {
    setMoodleResources((prev) => prev.filter((r) => r.id !== id));
    if (editingResourceId === id) cancelEdit();
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
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 data-[state=active]:data-active-forest data-[state=active]:!text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 data-[state=active]:scale-[1.02] bg-white/50 border border-border/50 text-muted-foreground hover:bg-white hover:border-primary/30"
              >
                <Activity className="w-3.5 h-3.5" />
                Core Specs
              </TabsTrigger>
              <TabsTrigger
                value="logic"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 data-[state=active]:data-active-forest data-[state=active]:!text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 data-[state=active]:scale-[1.02] bg-white/50 border border-border/50 text-muted-foreground hover:bg-white hover:border-primary/30"
              >
                <Zap className="w-3.5 h-3.5" />
                Logic
              </TabsTrigger>
              <TabsTrigger
                value="definition"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 data-[state=active]:data-active-forest data-[state=active]:!text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 data-[state=active]:scale-[1.02] bg-white/50 border border-border/50 text-muted-foreground hover:bg-white hover:border-primary/30"
              >
                <FileText className="w-3.5 h-3.5" />
                Definition
              </TabsTrigger>
              <TabsTrigger
                value="academy"
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 data-[state=active]:data-active-forest data-[state=active]:!text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 data-[state=active]:scale-[1.02] bg-white/50 border border-border/50 text-muted-foreground hover:bg-white hover:border-primary/30"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Academy
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
              {/* Dynamic Confluence Groups — DnD */}
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {confluenceOrder.map((groupKey) => (
                    <DroppableGroup
                      key={groupKey}
                      groupKey={groupKey}
                      isOver={overGroup === groupKey}
                      isEditing={editingGroupKey === groupKey}
                      canDelete={confluenceOrder.length > 1}
                      items={confluences[groupKey] || []}
                      inputValue={groupInputs[groupKey] || ""}
                      onInputChange={(v) => setGroupInputs((prev) => ({ ...prev, [groupKey]: v }))}
                      onAddItem={() => addConfluence(groupKey, groupInputs[groupKey] || "")}
                      onRemoveItem={(item) => removeConfluence(groupKey, item)}
                      onStartEdit={() => setEditingGroupKey(groupKey)}
                      onRename={(newKey) => renameGroup(groupKey, newKey)}
                      onCancelEdit={() => setEditingGroupKey(null)}
                      onRemoveGroup={() => removeGroup(groupKey)}
                    />
                  ))}

                  {/* Add new group card */}
                  <div className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-primary/10 rounded-[32px] p-6 min-h-[120px] hover:border-primary/30 transition-colors">
                    <Input
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addGroup())}
                      placeholder="New group name..."
                      className="h-10 bg-white border-border rounded-xl font-bold px-4 text-xs text-center"
                    />
                    <button
                      type="button"
                      onClick={addGroup}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Group
                    </button>
                  </div>
                </div>

                {/* Drag overlay — ghost card */}
                <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
                  {activeItem && (
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-white shadow-xl shadow-primary/10 opacity-95 rotate-1">
                      <GripVertical className="w-3.5 h-3.5 text-primary/40 shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                        {activeItem.item}
                      </span>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>

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

            {/* Tab 4: Academy Resources */}
            <TabsContent value="academy" className="m-0 space-y-8 animate-in fade-in-50 duration-500 pb-10">
              <div className="space-y-8">
                <div className="flex items-center justify-between px-2">
                  <SectionHeader title="Academy Curriculum Builder" />
                  <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary/5 border border-primary/10 shadow-sm">
                    <GraduationCap className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                      {moodleResources.length} Modules
                    </span>
                  </div>
                </div>
                
                {/* Advanced Resource Console */}
                <div className="relative group overflow-hidden bg-gradient-to-br from-white to-primary/[0.03] border border-primary/10 rounded-[40px] p-10 shadow-xl shadow-primary/5">
                  {/* Subtle Background Pattern */}
                  <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px]" />
                  
                  <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
                    <div className="lg:col-span-3 space-y-3">
                      <Field label="Module Title">
                        <Input
                          value={newResource.title}
                          onChange={(e) => setNewResource(prev => ({ ...prev, title: e.target.value }))}
                          className="h-14 bg-white border-primary/10 rounded-2xl font-black text-[11px] uppercase px-5"
                          placeholder="Module 3: Liquidity..."
                        />
                      </Field>
                    </div>
                    <div className="lg:col-span-3 space-y-3">
                      <Field label="Brief Description">
                        <Input
                          value={newResource.description}
                          onChange={(e) => setNewResource(prev => ({ ...prev, description: e.target.value }))}
                          className="h-14 bg-white border-primary/10 rounded-2xl font-bold text-[10px] px-5"
                          placeholder="Understanding Institutional Pools"
                        />
                      </Field>
                    </div>
                    <div className="lg:col-span-3 space-y-3">
                      <Field label="URL & Progress">
                        <div className="flex gap-2">
                          <Input
                            value={newResource.url}
                            onChange={(e) => setNewResource(prev => ({ ...prev, url: e.target.value }))}
                            className="h-14 flex-[2] bg-white border-primary/10 rounded-2xl font-bold text-[10px] px-5"
                            placeholder="Link..."
                          />
                          <Input
                            type="number"
                            value={newResource.progress}
                            onChange={(e) => setNewResource(prev => ({ ...prev, progress: parseInt(e.target.value) }))}
                            className="h-14 flex-1 bg-white border-primary/10 rounded-2xl font-bold text-[10px] px-4"
                            placeholder="%"
                          />
                        </div>
                      </Field>
                    </div>

                    <div className="lg:col-span-3">
                      <div className="flex gap-4">
                        <div className="flex-1 space-y-3">
                          <Field label={editingResourceId ? "Editing..." : "Type"}>
                            <select
                              value={newResource.type}
                              onChange={(e) => setNewResource(prev => ({ ...prev, type: e.target.value as any }))}
                              className={`h-14 w-full rounded-2xl bg-white border px-4 text-[10px] font-black uppercase tracking-widest outline-none appearance-none transition-colors ${
                                editingResourceId ? 'border-amber-500/40' : 'border-primary/10'
                              }`}
                            >
                              <option value="video">📹 VIDEO</option>
                              <option value="reading">📖 GUIDE</option>
                              <option value="quiz">🧠 QUIZ</option>
                            </select>
                          </Field>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={addResource}
                            className={`w-14 h-14 rounded-2xl text-white flex items-center justify-center hover:opacity-95 transition-all shrink-0 shadow-lg ${
                              editingResourceId ? 'bg-amber-500 shadow-amber-500/20' : 'bg-primary shadow-primary/20'
                            }`}
                          >
                            {editingResourceId ? <CheckCircle2 className="w-6 h-6" /> : <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" />}
                          </button>
                          {editingResourceId && (
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="w-14 h-8 rounded-xl bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80 transition-all text-[8px] font-black uppercase tracking-tighter"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                    </div>
                  </div>
                </div>

                {/* Playlist Builder */}
                  <div className="mt-8 pt-8 border-t border-primary/5 space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-40">Playlist / Lessons Builder</Label>
                      <span className="text-[9px] font-bold text-primary/40 uppercase">Add multiple video links for this module</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {newResource.subLinks?.map((link, idx) => (
                        <div key={link.id} className="flex items-center gap-3 bg-white border border-primary/5 p-4 rounded-2xl shadow-sm hover:border-primary/20 transition-all group/sub">
                          <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-[10px] font-black text-primary group-hover/sub:bg-primary/10 transition-colors">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black truncate uppercase tracking-tight">{link.title}</p>
                            <p className="text-[9px] font-medium text-slate-400 truncate">{link.url}</p>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setNewResource(prev => ({ ...prev, subLinks: prev.subLinks?.filter(l => l.id !== link.id) }))}
                            className="text-rose-500/40 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      
                      <div className="flex gap-2 p-2 bg-primary/5 rounded-2xl border border-dashed border-primary/20">
                        <Input 
                          placeholder="Lesson Title"
                          value={newSubLink.title}
                          onChange={e => setNewSubLink(prev => ({ ...prev, title: e.target.value }))}
                          className="bg-white border-none h-10 text-[10px] font-bold flex-[2] rounded-xl shadow-inner"
                        />
                        <Input 
                          placeholder="URL"
                          value={newSubLink.url}
                          onChange={e => setNewSubLink(prev => ({ ...prev, url: e.target.value }))}
                          className="bg-white border-none h-10 text-[10px] font-bold flex-[3] rounded-xl shadow-inner"
                        />
                        <button 
                          type="button"
                          onClick={addSubLinkToResource}
                          className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Curriculum Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {moodleResources.map((res) => (
                    <div
                      key={res.id}
                      className="group relative flex items-center justify-between gap-6 p-6 rounded-[32px] border border-white bg-white/60 backdrop-blur-sm hover:bg-white hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-700"
                    >
                      <div className="flex items-center gap-6 min-w-0">
                        <div className="w-14 h-14 rounded-[22px] bg-primary/5 flex items-center justify-center text-primary shrink-0 group-hover:scale-110 group-hover:bg-primary/10 transition-all duration-500">
                          {res.type === 'video' ? (
                            <Zap className="w-6 h-6 text-amber-500 fill-amber-500/20" />
                          ) : res.type === 'reading' ? (
                            <FileText className="w-6 h-6 text-indigo-500" />
                          ) : res.type === 'quiz' ? (
                            <Shield className="w-6 h-6 text-emerald-500" />
                          ) : (
                            <Link className="w-6 h-6 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0 py-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[8px] font-black text-primary/60 uppercase tracking-[0.25em] bg-primary/5 px-2 py-0.5 rounded-full">
                              {res.type}
                            </span>
                          </div>
                          <p className="text-[11px] font-black uppercase tracking-tight text-foreground truncate group-hover:text-primary transition-colors">
                            {res.title}
                          </p>
                          <p className="text-[9px] font-medium text-muted-foreground truncate opacity-40 group-hover:opacity-60 transition-opacity">
                            {res.url}
                          </p>
                        </div>
                      </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => startEditResource(res)}
                            className="p-3 text-amber-500/60 hover:text-amber-500 hover:bg-amber-500/10 rounded-2xl transition-all active:scale-90"
                            title="Edit Resource"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeResource(res.id)}
                            className="p-3 text-rose-500/40 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all active:scale-90"
                            title="Remove Resource"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                    </div>
                  ))}
                  {moodleResources.length === 0 && (
                    <div className="md:col-span-2 xl:col-span-3 py-24 flex flex-col items-center justify-center text-muted-foreground/30 border-2 border-dashed border-primary/10 rounded-[50px] bg-primary/[0.01]">
                      <div className="w-24 h-24 rounded-full bg-primary/5 flex items-center justify-center mb-8 relative">
                        <GraduationCap className="w-12 h-12 opacity-20" />
                        <div className="absolute inset-0 rounded-full border-2 border-dashed border-primary/20 animate-spin-slow" />
                      </div>
                      <p className="text-[12px] font-black uppercase tracking-[0.4em] mb-3 text-primary/30">Curriculum Vacant</p>
                      <p className="text-[10px] font-medium uppercase tracking-[0.2em] opacity-40">Architect your learning path above</p>
                    </div>
                  )}
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

// ─── DnD Sub-components ───────────────────────────────────────────────────────

interface DroppableGroupProps {
  groupKey: string;
  isOver: boolean;
  isEditing: boolean;
  canDelete: boolean;
  items: string[];
  inputValue: string;
  onInputChange: (v: string) => void;
  onAddItem: () => void;
  onRemoveItem: (item: string) => void;
  onStartEdit: () => void;
  onRename: (newKey: string) => void;
  onCancelEdit: () => void;
  onRemoveGroup: () => void;
}

function DroppableGroup({
  groupKey, isOver, isEditing, canDelete,
  items, inputValue, onInputChange, onAddItem, onRemoveItem,
  onStartEdit, onRename, onCancelEdit, onRemoveGroup,
}: DroppableGroupProps) {
  const { setNodeRef, isOver: dndIsOver } = useDroppable({ id: groupKey });

  const highlighted = isOver || dndIsOver;

  return (
    <div
      ref={setNodeRef}
      className={`space-y-4 border p-6 rounded-[32px] group/card transition-all duration-200 ${
        highlighted
          ? "bg-primary/[0.06] border-primary/30 shadow-lg shadow-primary/10 scale-[1.01]"
          : "bg-primary/[0.02] border-primary/5"
      }`}
    >
      {/* Group Header — editable title */}
      <div className="flex items-center justify-between gap-2">
        {isEditing ? (
          <input
            autoFocus
            defaultValue={groupKey}
            className="flex-1 bg-white border border-primary/20 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/20"
            onBlur={(e) => onRename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRename(e.currentTarget.value);
              if (e.key === "Escape") onCancelEdit();
            }}
          />
        ) : (
          <button
            type="button"
            onClick={onStartEdit}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-foreground/60 hover:text-primary transition-colors group/title"
            title="Click to rename"
          >
            <span>{groupKey}</span>
            <Edit className="w-3 h-3 opacity-0 group-hover/title:opacity-60 transition-opacity" />
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={onRemoveGroup}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all opacity-0 group-hover/card:opacity-100"
            title="Remove group"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Drop hint when dragging */}
      {highlighted && (
        <p className="text-[9px] font-black text-primary uppercase tracking-widest text-center py-1 animate-pulse">
          Drop here
        </p>
      )}

      {/* Add item input */}
      <div className="flex gap-2">
        <input
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && (e.preventDefault(), onAddItem())
          }
          placeholder="Add confluence rule..."
          className="h-10 bg-white border border-border rounded-xl font-bold px-4 flex-1 text-xs outline-none focus:ring-2 focus:ring-primary/20 transition-all"
        />
        <button
          type="button"
          onClick={onAddItem}
          className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:opacity-90 transition-all active:scale-95"
        >
          +
        </button>
      </div>

      {/* Draggable items */}
      <div className="space-y-2 min-h-[32px]">
        {items.map((item) => (
          <DraggableItem
            key={item}
            item={item}
            groupKey={groupKey}
            onRemove={() => onRemoveItem(item)}
          />
        ))}
      </div>
    </div>
  );
}

interface DraggableItemProps {
  item: string;
  groupKey: string;
  onRemove: () => void;
}

function DraggableItem({ item, groupKey, onRemove }: DraggableItemProps) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: `${groupKey}::${item}`,
    data: { item, fromGroup: groupKey },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/item flex items-center gap-2 p-3 rounded-xl border bg-white transition-all ${
        isDragging
          ? "opacity-40 border-primary/20 shadow-inner"
          : "border-border hover:border-primary/20"
      }`}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-primary/60 transition-colors shrink-0 touch-none"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <span className="text-[10px] font-bold uppercase tracking-widest text-foreground truncate flex-1">
        {item}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all opacity-0 group-hover/item:opacity-100 shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
