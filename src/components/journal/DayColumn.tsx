import { useState } from "react";
import { Edit3, Check } from "lucide-react";
import type { DayEntry, Session, SlotKind } from "@/lib/journal";
import { biasStyle, biasLabel, ddmm, weekdayOf } from "@/lib/journal";
import { PasteSlot } from "./PasteSlot";

interface Props {
  entry: DayEntry;
  focusedSlot: { id: string; slot: SlotKind } | null;
  setFocus: (f: { id: string; slot: SlotKind } | null) => void;
  onUpdate: (e: DayEntry) => void;
  onEdit: (e: DayEntry) => void;
}

export function DayColumn({ entry, focusedSlot, setFocus, onUpdate, onEdit }: Props) {
  const [session, setSession] = useState<Session>("ASIA");
  const isFocused = (slot: SlotKind) => focusedSlot?.id === entry.id && focusedSlot?.slot === slot;
  const focus = (slot: SlotKind) => setFocus({ id: entry.id, slot });

  return (
    <div id={`bias-entry-${entry.id}`} className="glass rounded-lg w-[260px] shrink-0 flex flex-col overflow-hidden scroll-mx-6 transition-shadow data-[flash=true]:shadow-[0_0_0_2px_var(--neon-cyan),0_0_30px_var(--neon-cyan)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-terminal-border bg-terminal-bg/60">
        <div className="flex items-baseline gap-2">
          <span className="text-neon-cyan font-bold text-sm tracking-widest text-glow-cyan">{weekdayOf(entry.date)}</span>
          <span className="text-xs text-muted-foreground font-mono">{ddmm(entry.date)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neon-amber/80 font-bold tracking-wider text-base">{entry.asset}</span>
          <button onClick={() => onEdit(entry)} className="text-muted-foreground hover:text-neon-cyan transition-colors">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-2 space-y-2">
        {/* Weekly */}
        <SlotWithBias
          label="WEEKLY"
          image={entry.weeklyImg}
          bias={entry.weeklyBias}
          correct={entry.weeklyCorrect}
          focused={isFocused("weekly")}
          onFocus={() => focus("weekly")}
          onImg={(u) => onUpdate({ ...entry, weeklyImg: u })}
          onToggle={() => onUpdate({ ...entry, weeklyCorrect: !entry.weeklyCorrect })}
        />

        {/* Daily */}
        <SlotWithBias
          label="DAILY"
          image={entry.dailyImg}
          bias={entry.dailyBias}
          correct={entry.dailyCorrect}
          focused={isFocused("daily")}
          onFocus={() => focus("daily")}
          onImg={(u) => onUpdate({ ...entry, dailyImg: u })}
          onToggle={() => onUpdate({ ...entry, dailyCorrect: !entry.dailyCorrect })}
        />

        {/* 4H */}
        <div className="space-y-1.5">
          <div className="flex gap-1">
            {(["ASIA", "LDN", "NY"] as Session[]).map((s) => {
              const active = session === s;
              const has = !!entry.h4[s];
              return (
                <button key={s}
                  onClick={() => { setSession(s); focus(`h4-${s}` as SlotKind); }}
                  className={`flex-1 px-1 py-1 rounded text-[9px] font-bold tracking-widest border transition-all ${active ? "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/60 text-glow-cyan" : "border-terminal-border text-muted-foreground hover:text-foreground"}`}>
                  {s}{has && <span className="ml-1 inline-block w-1 h-1 rounded-full bg-neon-green align-middle" />}
                </button>
              );
            })}
          </div>
          <PasteSlot
            label={`4H ${session}`}
            image={entry.h4[session]}
            onChange={(u) => onUpdate({ ...entry, h4: { ...entry.h4, [session]: u } })}
            focused={isFocused(`h4-${session}` as SlotKind)}
            onFocus={() => focus(`h4-${session}` as SlotKind)}
            className="h-32"
          />
        </div>
      </div>
    </div>
  );
}

function SlotWithBias({
  label, image, bias, correct, focused, onFocus, onImg, onToggle,
}: {
  label: string;
  image?: string;
  bias: any;
  correct: boolean;
  focused: boolean;
  onFocus: () => void;
  onImg: (u: string | undefined) => void;
  onToggle: () => void;
}) {
  return (
    <PasteSlot
      label={label}
      image={image}
      focused={focused}
      onFocus={onFocus}
      onChange={onImg}
      className="h-28"
    >
      <span
        className="bias-tag absolute bottom-1 right-1 px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.18em] shadow-md leading-none"
        style={biasStyle(bias)}
      >
        {biasLabel(bias)}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        title="Mark accuracy correct"
        className={`absolute top-1 right-1 w-5 h-5 rounded border border-terminal-border bg-black/70 flex items-center justify-center transition-all ${correct ? "neon-correct" : "text-muted-foreground hover:text-neon-cyan"}`}>
        {correct && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
      </button>
    </PasteSlot>
  );
}
