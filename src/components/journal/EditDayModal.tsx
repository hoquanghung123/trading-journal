import { useEffect, useState, useMemo } from "react";
import { X, Trash2, Save, Plus } from "lucide-react";
import type { Bias, DayEntry, Session } from "@/lib/journal";
import { biasStyle, biasLabel, weekdayOf, getSessionsForAsset } from "@/lib/journal";
import { useSymbols } from "@/lib/symbols";
import { PasteSlot } from "./PasteSlot";

interface Props {
  entry: DayEntry;
  onSave: (e: DayEntry) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const BIASES: Bias[] = ["bullish", "bearish", "consolidation"];

export function EditDayModal({ entry, onSave, onDelete, onClose }: Props) {
  const { data: symbols = [] } = useSymbols();
  const ASSETS = symbols.map((s) => s.name);
  const [draft, setDraft] = useState<DayEntry>(entry);
  const [focusKey, setFocusKey] = useState<string>("weekly");
  const [session, setSession] = useState<Session>("ASIA");

  const sessions = useMemo(() => getSessionsForAsset(draft.asset), [draft.asset]);

  // Ensure session is valid when asset changes (e.g. from ES1! with NY AM to BTCUSD)
  useEffect(() => {
    if (!sessions.includes(session)) {
      if (session === "NY AM" || session === "NY PM") setSession("NY");
      else if (session === "NY") setSession("NY AM");
    }
  }, [sessions, session]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const update = <K extends keyof DayEntry>(k: K, v: DayEntry[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="bg-white sm:rounded-[32px] w-full max-w-3xl h-full sm:h-auto max-h-[100vh] sm:max-h-[94vh] overflow-y-auto shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-300 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-border/50 sticky top-0 bg-white/80 backdrop-blur-md z-20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Plus className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-foreground">
                Edit Trading Day
              </h2>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                {weekdayOf(draft.date)} · {draft.date}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl hover:bg-muted flex items-center justify-center transition-all text-muted-foreground hover:text-foreground"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-10">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Target Date</Label>
              <input
                type="date"
                value={draft.date}
                onChange={(e) => update("date", e.target.value)}
                className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label>Trading Asset</Label>
              <select
                value={draft.asset}
                onChange={(e) => update("asset", e.target.value)}
                className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all appearance-none"
              >
                {ASSETS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-10">
            {/* Monthly - Only on Mondays or 1st of Month */}
            {(weekdayOf(draft.date) === "MON" || draft.date.endsWith("-01")) && (
              <Section title="Monthly Outlook">
                <div className="grid grid-cols-[1fr_120px] gap-4">
                  <PasteSlot
                    label="Monthly Chart"
                    image={draft.monthlyImg}
                    onChange={(u) => update("monthlyImg", u)}
                    focused={focusKey === "monthly"}
                    onFocus={() => setFocusKey("monthly")}
                    className="h-48"
                  />
                  <BiasPicker
                    value={draft.monthlyBias}
                    onChange={(v) => update("monthlyBias", v)}
                  />
                </div>
              </Section>
            )}

            {/* Weekly */}
            <Section title="Weekly Outlook">
              <div className="grid grid-cols-[1fr_120px] gap-4">
                <PasteSlot
                  label="Weekly Chart"
                  image={draft.weeklyImg}
                  onChange={(u) => update("weeklyImg", u)}
                  focused={focusKey === "weekly"}
                  onFocus={() => setFocusKey("weekly")}
                  className="h-48"
                />
                <BiasPicker value={draft.weeklyBias} onChange={(v) => update("weeklyBias", v)} />
              </div>
            </Section>

            {/* Daily */}
            <Section title="Daily Direction">
              <div className="grid grid-cols-[1fr_120px] gap-4">
                <PasteSlot
                  label="Daily Chart"
                  image={draft.dailyImg}
                  onChange={(u) => update("dailyImg", u)}
                  focused={focusKey === "daily"}
                  onFocus={() => setFocusKey("daily")}
                  className="h-48"
                />
                <BiasPicker value={draft.dailyBias} onChange={(v) => update("dailyBias", v)} />
              </div>
            </Section>

            {/* 4H Sessions */}
            <Section title="H4 Structure & Sessions">
              <div className="flex gap-3 mb-4">
                {sessions.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSession(s);
                      setFocusKey(`h4-${s}`);
                    }}
                    className={`px-5 py-2 rounded-xl text-xs font-black tracking-widest border-2 transition-all ${session === s ? "bg-primary text-white border-primary shadow-lg scale-105" : "bg-white border-border text-muted-foreground hover:border-primary/30"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-[1fr_120px] gap-4">
                <PasteSlot
                  label={`H4 · ${session} SESSION`}
                  image={draft.h4[session]?.img}
                  onChange={(u) =>
                    update("h4", { ...draft.h4, [session]: { ...draft.h4[session], img: u } })
                  }
                  focused={focusKey === `h4-${session}`}
                  onFocus={() => setFocusKey(`h4-${session}`)}
                  className="h-56"
                />
                <BiasPicker
                  value={draft.h4[session]?.bias as Bias}
                  onChange={(v) =>
                    update("h4", { ...draft.h4, [session]: { ...draft.h4[session], bias: v } })
                  }
                />
              </div>
            </Section>

            <div className="space-y-3">
              <Label>Session Notes & Observations</Label>
              <textarea
                value={draft.notes ?? ""}
                onChange={(e) => update("notes", e.target.value)}
                rows={4}
                placeholder="Key market takeaways, mistakes, or wins..."
                className="w-full bg-muted/20 border border-border rounded-2xl px-5 py-4 text-sm font-medium text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 py-6 border-t border-border/50 bg-muted/10 sticky bottom-0 z-20">
          {onDelete ? (
            <button
              onClick={() => {
                onDelete(draft.id);
                onClose();
              }}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-black text-destructive bg-destructive/10 border border-destructive/20 rounded-xl hover:bg-destructive hover:text-white transition-all active:scale-95"
            >
              <Trash2 className="w-4 h-4" /> DELETE DAY
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="forest-gradient flex items-center gap-2 px-8 py-3 text-sm font-black text-white rounded-xl shadow-xl hover:opacity-90 transition-all active:scale-95 uppercase tracking-widest"
          >
            <Save className="w-4 h-4" /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-4 w-1 bg-primary rounded-full" />
        <h3 className="text-sm font-black uppercase tracking-widest text-primary">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
      {children}
    </span>
  );
}

function BiasPicker({ value, onChange }: { value: Bias; onChange: (v: Bias) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {BIASES.map((b) => {
        const active = value === b;
        return (
          <button
            key={b}
            onClick={() => onChange(b)}
            className={`px-3 py-3 rounded-xl border-2 text-[9px] font-black tracking-widest uppercase transition-all flex items-center justify-center text-center leading-none h-full ${
              active
                ? b === "bullish"
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                  : b === "bearish"
                    ? "bg-destructive text-destructive-foreground border-destructive shadow-lg shadow-destructive/20"
                    : "bg-warning text-warning-foreground border-warning shadow-lg shadow-warning/20"
                : "bg-white border-border text-muted-foreground hover:border-primary/30"
            }`}
          >
            {biasLabel(b)}
          </button>
        );
      })}
    </div>
  );
}
