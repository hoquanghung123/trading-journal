import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  X,
  Trash2,
  Save,
  Plus,
  Pencil,
  Loader2,
  ChevronDown,
  Check,
  AlertCircle,
  Copy,
} from "lucide-react";
import type { Bias, DayEntry, Session } from "@/lib/journal";
import {
  biasLabel,
  getSessionsForAsset,
  isHtfBiasSet,
  h4TabForNow,
  getChartUrl,
  isMonthlyOutlookDay,
  previousEntryForAsset,
  lastMondayEntryForAsset,
  applyHtfCarry,
  duplicateChartImage,
} from "@/lib/journal";
import { useSymbols } from "@/lib/symbols";
import { toast } from "sonner";
import { PasteSlot } from "./PasteSlot";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  entry: DayEntry;
  priorEntries?: DayEntry[];
  onSave: (e: DayEntry) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  onClose: () => void;
}

const BIASES: Bias[] = ["bullish", "bearish", "consolidation"];

type LadderKey = "yearly" | "monthly" | "weekly" | "daily" | "h4";
type ConfirmKind = "dirty" | "upload" | "delete";

function longDate(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initialPicked(entry: DayEntry): Record<string, boolean> {
  return {
    yearly: isHtfBiasSet(entry.yearlyBias, entry.yearlyImg),
    monthly: isHtfBiasSet(entry.monthlyBias, entry.monthlyImg),
    weekly: isHtfBiasSet(entry.weeklyBias, entry.weeklyImg),
    daily: isHtfBiasSet(entry.dailyBias, entry.dailyImg),
  };
}

function initialExpanded(entry: DayEntry): LadderKey {
  if (!isHtfBiasSet(entry.dailyBias, entry.dailyImg)) return "daily";
  return "h4";
}

function initialFocus(entry: DayEntry, session: Session): string {
  const exp = initialExpanded(entry);
  if (exp === "h4") return `h4-${session}`;
  return exp;
}

export function EditDayModal({ entry, priorEntries = [], onSave, onDelete, onClose }: Props) {
  const isNew = !onDelete;
  const { data: symbols = [] } = useSymbols();
  const ASSETS = symbols
    .filter((s) => !s.isForex || s.name === entry.asset)
    .map((s) => s.name);

  const [draft, setDraft] = useState<DayEntry>(entry);
  const [focusKey, setFocusKey] = useState<string>(() =>
    initialFocus(entry, h4TabForNow(entry.asset)),
  );
  const [session, setSession] = useState<Session>(() => h4TabForNow(entry.asset));
  const [expanded, setExpanded] = useState<LadderKey>(() => initialExpanded(entry));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [uploadingSlots, setUploadingSlots] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<Record<string, boolean>>(() => initialPicked(entry));
  const [conflict, setConflict] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);
  const userPickedSession = useRef(false);
  const snapshotRef = useRef(JSON.stringify(entry));
  const bodyRef = useRef<HTMLDivElement>(null);

  const isUploading = useMemo(
    () => Object.values(uploadingSlots).some(Boolean),
    [uploadingSlots],
  );

  const dirty = JSON.stringify(draft) !== snapshotRef.current;
  const monthlyOpen = isMonthlyOutlookDay(draft.date);
  const sessions = useMemo(() => getSessionsForAsset(draft.asset), [draft.asset]);
  const previous = useMemo(
    () => previousEntryForAsset(priorEntries, draft.asset, draft.date, draft.id),
    [priorEntries, draft.asset, draft.date, draft.id],
  );
  const lastMonday = useMemo(
    () => lastMondayEntryForAsset(priorEntries, draft.asset, draft.date, draft.id),
    [priorEntries, draft.asset, draft.date, draft.id],
  );

  const h4SetCount = sessions.filter((s) => isHtfBiasSet(draft.h4[s]?.bias, draft.h4[s]?.img)).length;

  const progress = useMemo(() => {
    const items = [
      { key: "Y", set: isHtfBiasSet(draft.yearlyBias, draft.yearlyImg) },
      monthlyOpen ? { key: "M", set: isHtfBiasSet(draft.monthlyBias, draft.monthlyImg) } : null,
      { key: "W", set: isHtfBiasSet(draft.weeklyBias, draft.weeklyImg) },
      { key: "D", set: isHtfBiasSet(draft.dailyBias, draft.dailyImg) },
      { key: `H4 ${h4SetCount}/${sessions.length}`, set: h4SetCount === sessions.length },
    ].filter(Boolean) as { key: string; set: boolean }[];
    return items;
  }, [draft, monthlyOpen, h4SetCount, sessions.length]);

  useEffect(() => {
    setDraft(entry);
    snapshotRef.current = JSON.stringify(entry);
    setPicked(initialPicked(entry));
    const sess = h4TabForNow(entry.asset);
    setSession(sess);
    setExpanded(initialExpanded(entry));
    setFocusKey(initialFocus(entry, sess));
    setConflict(false);
    userPickedSession.current = false;
    bodyRef.current?.scrollTo({ top: 0 });
  }, [entry.id]);

  const requestClose = useCallback(() => {
    if (isUploading || isCopying) {
      setConfirm("upload");
      return;
    }
    if (dirty) {
      setConfirm("dirty");
      return;
    }
    onClose();
  }, [isUploading, isCopying, dirty, onClose]);

  const handleSave = useCallback(async () => {
    if (isUploading || isSaving || isCopying) return;
    setIsSaving(true);
    setConflict(false);
    try {
      await onSave(draft);
      toast.success("Bias saved");
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("already exists")) setConflict(true);
    } finally {
      setIsSaving(false);
    }
  }, [draft, onSave, onClose, isUploading, isSaving, isCopying]);

  const handleDelete = useCallback(async () => {
    if (!onDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(draft.id);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete this day");
    } finally {
      setIsDeleting(false);
      setConfirm(null);
    }
  }, [onDelete, isDeleting, draft.id, onClose]);

  useEffect(() => {
    if (!sessions.includes(session)) {
      if (session === "NY AM" || session === "NY PM") setSession("NY");
      else if (session === "NY") setSession("NY AM");
    }
  }, [sessions, session]);

  useEffect(() => {
    if (userPickedSession.current) return;
    setSession(h4TabForNow(draft.asset));
  }, [draft.asset]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave]);

  const update = <K extends keyof DayEntry>(k: K, v: DayEntry[K]) => {
    if (k === "date" || k === "asset") setConflict(false);
    setDraft((d) => ({ ...d, [k]: v }));
  };

  const openLadder = (key: LadderKey, pasteKey?: string) => {
    setExpanded(key);
    if (pasteKey) setFocusKey(pasteKey);
  };

  const applyPreviousBias = () => {
    if (!previous) return;
    setDraft((d) => applyHtfCarry(d, previous, "bias"));
    setPicked((p) => ({
      ...p,
      yearly: isHtfBiasSet(previous.yearlyBias, previous.yearlyImg),
      weekly: isHtfBiasSet(previous.weeklyBias, previous.weeklyImg),
      monthly: isHtfBiasSet(previous.monthlyBias, previous.monthlyImg),
    }));
    toast.success("Copied last HTF bias");
  };

  const copyMondayWeekly = async () => {
    if (!lastMonday) return;
    setIsCopying(true);
    try {
      const img = lastMonday.weeklyImg
        ? await duplicateChartImage(lastMonday.weeklyImg)
        : draft.weeklyImg;
      setDraft((d) => ({
        ...d,
        weeklyBias: lastMonday.weeklyBias,
        weeklyImg: img ?? d.weeklyImg,
      }));
      setPicked((p) => ({ ...p, weekly: true }));
      openLadder("weekly", "weekly");
      toast.success("Copied weekly from last Monday");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't copy weekly chart");
    } finally {
      setIsCopying(false);
    }
  };

  const confirmCopy = {
    dirty: {
      title: "Discard unsaved changes?",
      body: "Edits to this bias day will be lost.",
      action: "Discard",
      destructive: true,
      onConfirm: onClose,
    },
    upload: {
      title: "Upload still running",
      body: "Leave now and cancel the upload?",
      action: "Leave",
      destructive: true,
      onConfirm: onClose,
    },
    delete: {
      title: "Delete this trading day?",
      body: "Charts for this day will be removed. This cannot be undone.",
      action: "Delete now",
      destructive: true,
      onConfirm: () => void handleDelete(),
    },
  } as const;

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && requestClose()}>
        <DialogContent
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            e.preventDefault();
            requestClose();
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            requestClose();
          }}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-1.5rem)] sm:w-full max-w-3xl max-h-[90dvh] h-auto -translate-x-1/2 -translate-y-1/2 p-0 gap-0 bg-card border-white/20 text-foreground flex flex-col overflow-hidden rounded-[32px] shadow-2xl [&>button.absolute]:hidden"
        >
          <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-border/50 shrink-0 bg-card z-10">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                {isNew ? (
                  <Plus className="w-6 h-6 text-primary" />
                ) : (
                  <Pencil className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-2xl font-black tracking-tight text-foreground">
                  {isNew ? "New Bias" : "Edit Bias"}
                </DialogTitle>
                <p className="text-xs font-bold text-muted-foreground mt-0.5 truncate">
                  {draft.asset} · {longDate(draft.date)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={requestClose}
              className="w-10 h-10 rounded-xl hover:bg-muted flex items-center justify-center transition-all text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div
            ref={bodyRef}
            className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-8 py-6 space-y-6"
          >
            <div className="flex flex-wrap gap-1.5">
              {progress.map((p) => (
                <span
                  key={p.key}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border",
                    p.set
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-muted/40 text-muted-foreground border-border",
                  )}
                >
                  {p.key}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="bias-date"
                  className="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
                >
                  Target Date
                </Label>
                <input
                  id="bias-date"
                  type="date"
                  value={draft.date}
                  onChange={(e) => update("date", e.target.value)}
                  aria-invalid={conflict}
                  className={cn(
                    "w-full bg-muted/30 border rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all",
                    conflict ? "border-destructive ring-2 ring-destructive/20" : "border-border",
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="bias-asset"
                  className="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
                >
                  Trading Asset
                </Label>
                <select
                  id="bias-asset"
                  value={draft.asset}
                  onChange={(e) => update("asset", e.target.value)}
                  aria-invalid={conflict}
                  className={cn(
                    "w-full bg-muted/30 border rounded-xl px-4 py-2.5 text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all appearance-none",
                    conflict ? "border-destructive ring-2 ring-destructive/20" : "border-border",
                  )}
                >
                  {ASSETS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {conflict && (
              <p className="text-xs font-bold text-destructive">
                A bias for {draft.asset} on {longDate(draft.date)} already exists. Change date or
                asset.
              </p>
            )}

            {(previous || lastMonday?.weeklyImg) && (
              <div className="flex flex-wrap gap-2">
                {previous && (
                  <button
                    type="button"
                    onClick={applyPreviousBias}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                  >
                    <Copy className="w-3 h-3" /> Use last HTF
                  </button>
                )}
                {lastMonday?.weeklyImg && !draft.weeklyImg && (
                  <button
                    type="button"
                    onClick={() => void copyMondayWeekly()}
                    disabled={isCopying}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all disabled:opacity-50"
                  >
                    {isCopying ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    Copy weekly from last Monday
                  </button>
                )}
              </div>
            )}

            <div className="space-y-3">
              <LadderRow
                code="Y"
                title="Yearly Outlook"
                expanded={expanded === "yearly"}
                onToggle={() =>
                  expanded === "yearly" ? setExpanded("h4") : openLadder("yearly", "yearly")
                }
                bias={draft.yearlyBias}
                image={draft.yearlyImg}
                committed={picked.yearly}
                onBias={(v, c) => {
                  setPicked((p) => ({ ...p, yearly: c }));
                  update("yearlyBias", v);
                }}
                paste={
                  <PasteSlot
                    label="Yearly Chart"
                    image={draft.yearlyImg}
                    onChange={(u) => update("yearlyImg", u)}
                    onBusyChange={(busy) =>
                      setUploadingSlots((prev) => ({ ...prev, yearly: busy }))
                    }
                    focused={focusKey === "yearly"}
                    onFocus={() => setFocusKey("yearly")}
                    className="h-56"
                    showChartActions
                    showPasteTarget
                  />
                }
              />

              <LadderRow
                code="M"
                title="Monthly Outlook"
                hint={monthlyOpen ? undefined : "Monday or 1st only"}
                disabled={!monthlyOpen}
                expanded={expanded === "monthly" && monthlyOpen}
                onToggle={() => {
                  if (!monthlyOpen) return;
                  expanded === "monthly" ? setExpanded("h4") : openLadder("monthly", "monthly");
                }}
                bias={draft.monthlyBias}
                image={draft.monthlyImg}
                committed={picked.monthly}
                onBias={(v, c) => {
                  setPicked((p) => ({ ...p, monthly: c }));
                  update("monthlyBias", v);
                }}
                correct={draft.monthlyCorrect}
                onCorrect={() => update("monthlyCorrect", !draft.monthlyCorrect)}
                paste={
                  <PasteSlot
                    label="Monthly Chart"
                    image={draft.monthlyImg}
                    onChange={(u) => update("monthlyImg", u)}
                    onBusyChange={(busy) =>
                      setUploadingSlots((prev) => ({ ...prev, monthly: busy }))
                    }
                    focused={focusKey === "monthly"}
                    onFocus={() => setFocusKey("monthly")}
                    className="h-56"
                    showChartActions
                    showPasteTarget
                  />
                }
              />

              <LadderRow
                code="W"
                title="Weekly Outlook"
                expanded={expanded === "weekly"}
                onToggle={() =>
                  expanded === "weekly" ? setExpanded("h4") : openLadder("weekly", "weekly")
                }
                bias={draft.weeklyBias}
                image={draft.weeklyImg}
                committed={picked.weekly}
                onBias={(v, c) => {
                  setPicked((p) => ({ ...p, weekly: c }));
                  update("weeklyBias", v);
                }}
                correct={draft.weeklyCorrect}
                onCorrect={() => update("weeklyCorrect", !draft.weeklyCorrect)}
                paste={
                  <PasteSlot
                    label="Weekly Chart"
                    image={draft.weeklyImg}
                    onChange={(u) => update("weeklyImg", u)}
                    onBusyChange={(busy) =>
                      setUploadingSlots((prev) => ({ ...prev, weekly: busy }))
                    }
                    focused={focusKey === "weekly"}
                    onFocus={() => setFocusKey("weekly")}
                    className="h-56"
                    showChartActions
                    showPasteTarget
                  />
                }
              />

              <LadderRow
                code="D"
                title="Daily Direction"
                expanded={expanded === "daily"}
                onToggle={() => openLadder(expanded === "daily" ? "h4" : "daily", "daily")}
                bias={draft.dailyBias}
                image={draft.dailyImg}
                committed={picked.daily}
                onBias={(v, c) => {
                  setPicked((p) => ({ ...p, daily: c }));
                  update("dailyBias", v);
                }}
                correct={draft.dailyCorrect}
                onCorrect={() => update("dailyCorrect", !draft.dailyCorrect)}
                paste={
                  <PasteSlot
                    label="Daily Chart"
                    image={draft.dailyImg}
                    onChange={(u) => update("dailyImg", u)}
                    onBusyChange={(busy) =>
                      setUploadingSlots((prev) => ({ ...prev, daily: busy }))
                    }
                    focused={focusKey === "daily"}
                    onFocus={() => setFocusKey("daily")}
                    className="h-64"
                    showChartActions
                    showPasteTarget
                  />
                }
              />

              <section
                className={cn(
                  "rounded-2xl border overflow-hidden transition-colors",
                  expanded === "h4" ? "border-primary/30 bg-card" : "border-border bg-muted/10",
                )}
              >
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => openLadder("h4", `h4-${session}`)}
                    className="flex items-center gap-3 min-w-0"
                  >
                    <span className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-[10px] font-black tracking-widest text-primary">
                      H4
                    </span>
                    <h3 className="text-sm font-black uppercase tracking-widest text-primary">
                      Structure & Sessions
                    </h3>
                  </button>
                  <div className="flex flex-wrap gap-2 ml-auto">
                    {sessions.map((s) => {
                      const set = isHtfBiasSet(draft.h4[s]?.bias, draft.h4[s]?.img);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            userPickedSession.current = true;
                            setSession(s);
                            openLadder("h4", `h4-${s}`);
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest border-2 transition-all",
                            session === s
                              ? "bg-primary text-white border-primary"
                              : set
                                ? "bg-primary/10 text-primary border-primary/30"
                                : "bg-background border-border text-muted-foreground hover:border-primary/30",
                          )}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="px-4 pb-4 space-y-3">
                  <div className="flex flex-col gap-3">
                    <BiasSegment
                      value={draft.h4[session]?.bias as Bias}
                      image={draft.h4[session]?.img}
                      committed={picked[`h4-${session}`]}
                      onChange={(v, c) => {
                        setPicked((p) => ({ ...p, [`h4-${session}`]: c }));
                        setDraft((d) => ({
                          ...d,
                          h4: {
                            ...d.h4,
                            [session]: { ...d.h4[session], bias: v },
                          },
                        }));
                      }}
                    />
                    <PasteSlot
                      key={session}
                      label={`H4 · ${session} SESSION`}
                      image={draft.h4[session]?.img}
                      onChange={(u) =>
                        setDraft((d) => ({
                          ...d,
                          h4: { ...d.h4, [session]: { ...d.h4[session], img: u } },
                        }))
                      }
                      onBusyChange={(busy) =>
                        setUploadingSlots((prev) => ({ ...prev, [`h4-${session}`]: busy }))
                      }
                      focused={focusKey === `h4-${session}`}
                      onFocus={() => setFocusKey(`h4-${session}`)}
                      className="h-64"
                      showChartActions
                      showPasteTarget
                    />
                    <div className="space-y-2">
                      <Label
                        htmlFor="h4-notes"
                        className="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
                      >
                        {session} observation
                      </Label>
                      <textarea
                        id="h4-notes"
                        value={draft.h4[session]?.notes ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            h4: {
                              ...d.h4,
                              [session]: { ...d.h4[session], notes: e.target.value },
                            },
                          }))
                        }
                        rows={2}
                        placeholder={`What ${session} did — delivery, raid, leftover...`}
                        className="w-full bg-muted/20 border border-border rounded-2xl px-4 py-3 text-sm font-medium text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="daily-thesis"
                className="text-[10px] font-black uppercase tracking-widest text-muted-foreground"
              >
                Daily thesis
              </Label>
              <textarea
                id="daily-thesis"
                value={draft.notes ?? ""}
                onChange={(e) => update("notes", e.target.value)}
                rows={3}
                placeholder="What you expect from the day — draw, PD array, invalidation..."
                className="w-full bg-muted/20 border border-border rounded-2xl px-5 py-4 text-sm font-medium text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-6 sm:px-8 py-5 border-t border-border/50 bg-muted/10 shrink-0 z-10">
            {onDelete ? (
              <button
                type="button"
                onClick={() => setConfirm("delete")}
                disabled={isDeleting || isUploading || isCopying}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-black text-destructive bg-destructive/10 border border-destructive/20 rounded-xl hover:bg-destructive hover:text-white transition-all active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete day
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={requestClose}
                className="px-5 py-2.5 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-all"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isUploading || isSaving || isCopying}
                className={cn(
                  "forest-gradient flex items-center gap-2 px-8 py-3 text-sm font-black text-white rounded-xl shadow-xl hover:opacity-90 transition-all active:scale-95 uppercase tracking-widest",
                  (isUploading || isSaving || isCopying) && "opacity-50 cursor-not-allowed",
                )}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : isUploading || isCopying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Uploading Charts...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Changes
                  </>
                )}
              </button>
            </div>
          </div>

          {confirm && (
            <div className="absolute inset-0 z-30 bg-card/80 backdrop-blur-md flex items-center justify-center p-6">
              <div
                role="alertdialog"
                aria-modal="true"
                className="bg-card border border-border rounded-[32px] shadow-2xl p-8 max-w-sm w-full text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-5">
                  <AlertCircle className="w-7 h-7 text-destructive" />
                </div>
                <h3 className="text-xl font-black text-foreground mb-2">
                  {confirmCopy[confirm].title}
                </h3>
                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                  {confirmCopy[confirm].body}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => setConfirm(null)}
                    className="flex-1 h-12 rounded-2xl border border-border text-foreground font-bold hover:bg-muted transition-all"
                  >
                    Keep editing
                  </button>
                  <button
                    type="button"
                    onClick={confirmCopy[confirm].onConfirm}
                    className="flex-1 h-12 rounded-2xl bg-destructive text-white font-black uppercase tracking-widest hover:bg-destructive/90 shadow-lg shadow-destructive/20 transition-all active:scale-95"
                  >
                    {confirmCopy[confirm].action}
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function LadderRow({
  code,
  title,
  hint,
  disabled,
  expanded,
  onToggle,
  bias,
  image,
  committed,
  onBias,
  correct,
  onCorrect,
  paste,
}: {
  code: string;
  title: string;
  hint?: string;
  disabled?: boolean;
  expanded: boolean;
  onToggle: () => void;
  bias: Bias;
  image?: string;
  committed?: boolean;
  onBias: (v: Bias, committed: boolean) => void;
  correct?: boolean;
  onCorrect?: () => void;
  paste: React.ReactNode;
}) {
  const shown = committed || isHtfBiasSet(bias, image) ? bias : undefined;
  const thumb = image ? getChartUrl(image) : "";

  return (
    <section
      className={cn(
        "rounded-2xl border overflow-hidden transition-colors",
        disabled && "opacity-60",
        expanded
          ? "border-primary/30 bg-card"
          : shown === "bullish"
            ? "border-primary/25 bg-primary/5"
            : shown === "bearish"
              ? "border-destructive/25 bg-destructive/5"
              : shown === "consolidation"
                ? "border-warning/25 bg-warning/5"
                : "border-border bg-muted/10",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className="flex items-center gap-3 min-w-0 flex-1 text-left disabled:cursor-not-allowed"
        >
          {thumb ? (
            <img
              src={thumb}
              alt=""
              className="w-12 h-8 rounded-md object-cover border border-border shrink-0"
            />
          ) : (
            <span className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-[10px] font-black tracking-widest text-primary shrink-0">
              {code}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-black uppercase tracking-widest text-primary leading-none">
              {title}
            </h3>
            {hint && (
              <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-wider">
                {hint}
              </p>
            )}
            {!expanded && !hint && (
              <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-wider">
                {shown ? biasLabel(shown) : "Not set"}
              </p>
            )}
          </div>
        </button>
        <BiasSegment
          value={bias}
          image={image}
          committed={committed}
          disabled={disabled}
          onChange={onBias}
        />
        {onCorrect && !disabled && (
          <button
            type="button"
            onClick={onCorrect}
            title="Mark accuracy correct"
            className={cn(
              "w-8 h-8 rounded-full border flex items-center justify-center transition-all",
              correct
                ? "border-primary bg-primary text-primary-foreground"
                : "border-dashed border-muted-foreground/40 text-muted-foreground/50 hover:text-foreground hover:border-primary/40",
            )}
          >
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronDown
            className={cn("w-4 h-4 transition-transform", expanded && "rotate-180")}
          />
        </button>
      </div>
      {expanded && !disabled && <div className="px-4 pb-4">{paste}</div>}
    </section>
  );
}

function BiasSegment({
  value,
  image,
  committed,
  disabled,
  onChange,
}: {
  value: Bias;
  image?: string;
  committed?: boolean;
  disabled?: boolean;
  onChange: (v: Bias, committed: boolean) => void;
}) {
  const shown = committed || isHtfBiasSet(value, image) ? value : undefined;
  return (
    <div className="flex rounded-xl border border-border overflow-hidden shrink-0" role="group" aria-label="Bias">
      {BIASES.map((b) => {
        const active = shown === b;
        return (
          <button
            key={b}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (active) onChange("consolidation", false);
              else onChange(b, true);
            }}
            className={cn(
              "px-2.5 py-1.5 text-[9px] font-black tracking-widest uppercase transition-all disabled:cursor-not-allowed",
              active
                ? b === "bullish"
                  ? "bg-primary text-primary-foreground"
                  : b === "bearish"
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-warning text-warning-foreground"
                : "bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {biasLabel(b)}
          </button>
        );
      })}
    </div>
  );
}
