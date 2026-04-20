import { useEffect, useState } from "react";
import { X, Trash2, Save } from "lucide-react";
import type { Bias, DayEntry, Session } from "@/lib/journal";
import { biasStyle, biasLabel, weekdayOf } from "@/lib/journal";
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

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const update = <K extends keyof DayEntry>(k: K, v: DayEntry[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="glass-strong rounded-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto scrollbar-terminal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-terminal-border">
          <div className="flex items-center gap-3">
            <span className="text-neon-cyan font-bold tracking-widest text-sm text-glow-cyan">
              {weekdayOf(draft.date)} · {draft.date}
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:text-neon-cyan"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Date</span>
              <input type="date" value={draft.date} onChange={(e) => update("date", e.target.value)}
                className="w-full bg-terminal-bg border border-terminal-border rounded px-2 py-1.5 text-sm focus:neon-focus outline-none" />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Asset</span>
              <select value={draft.asset} onChange={(e) => update("asset", e.target.value)}
                className="w-full bg-terminal-bg border border-terminal-border rounded px-2 py-1.5 text-sm outline-none">
                {ASSETS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
          </div>

          {/* Weekly */}
          <Section title="WEEKLY">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <PasteSlot
                label="Weekly Chart"
                image={draft.weeklyImg}
                onChange={(u) => update("weeklyImg", u)}
                focused={focusKey === "weekly"}
                onFocus={() => setFocusKey("weekly")}
                className="h-44"
              />
              <BiasPicker value={draft.weeklyBias} onChange={(v) => update("weeklyBias", v)} />
            </div>
          </Section>

          {/* Daily */}
          <Section title="DAILY">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <PasteSlot
                label="Daily Chart"
                image={draft.dailyImg}
                onChange={(u) => update("dailyImg", u)}
                focused={focusKey === "daily"}
                onFocus={() => setFocusKey("daily")}
                className="h-44"
              />
              <BiasPicker value={draft.dailyBias} onChange={(v) => update("dailyBias", v)} />
            </div>
          </Section>

          {/* 4H Sessions */}
          <Section title="4H STRUCTURE">
            <div className="flex gap-2 mb-2">
              {(["ASIA", "LDN", "NY"] as Session[]).map((s) => (
                <button key={s}
                  onClick={() => { setSession(s); setFocusKey(`h4-${s}`); }}
                  className={`px-3 py-1 rounded text-xs font-bold tracking-widest border transition-all ${session === s ? "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/60 text-glow-cyan" : "border-terminal-border text-muted-foreground hover:text-foreground"}`}>
                  {s}
                </button>
              ))}
            </div>
            <PasteSlot
              label={`4H · ${session}`}
              image={draft.h4[session]}
              onChange={(u) => update("h4", { ...draft.h4, [session]: u })}
              focused={focusKey === `h4-${session}`}
              onFocus={() => setFocusKey(`h4-${session}`)}
              className="h-48"
            />
          </Section>

          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Notes</span>
            <textarea value={draft.notes ?? ""} onChange={(e) => update("notes", e.target.value)} rows={3}
              className="w-full bg-terminal-bg border border-terminal-border rounded px-2 py-1.5 text-sm outline-none resize-none" />
          </label>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-terminal-border">
          {onDelete ? (
            <button onClick={() => { onDelete(draft.id); onClose(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neon-red border border-neon-red/40 rounded hover:bg-neon-red/10">
              <Trash2 className="w-3.5 h-3.5" /> DELETE
            </button>
          ) : <span />}
          <button onClick={() => { onSave(draft); onClose(); }}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold tracking-widest bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/60 rounded hover:bg-neon-cyan/30 text-glow-cyan">
            <Save className="w-3.5 h-3.5" /> SAVE
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] tracking-[0.3em] text-neon-cyan/80 font-bold">// {title}</div>
      {children}
    </div>
  );
}

function BiasPicker({ value, onChange }: { value: Bias; onChange: (v: Bias) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      {BIASES.map((b) => {
        const active = value === b;
        return (
          <button
            key={b}
            onClick={() => onChange(b)}
            className="px-3 py-1.5 rounded border text-[10px] font-extrabold tracking-widest uppercase transition-all"
            style={
              active
                ? { ...biasStyle(b), borderColor: "transparent" }
                : { borderColor: "var(--terminal-border)", color: "var(--muted-foreground)", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }
            }
          >
            {biasLabel(b)}
          </button>
        );
      })}
    </div>
  );
}
