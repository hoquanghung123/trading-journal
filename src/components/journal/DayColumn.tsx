import { useState, useMemo, useEffect } from "react";
import { Edit3, Check } from "lucide-react";
import type { DayEntry, Session, SlotKind } from "@/lib/journal";
import { biasStyle, biasLabel, ddmm, weekdayOf } from "@/lib/journal";
import { getAssetIconUrl } from "@/lib/symbols";
import { PasteSlot } from "./PasteSlot";

interface Props {
  entry: DayEntry;
  focusedSlot: { id: string; slot: SlotKind } | null;
  setFocus: (f: { id: string; slot: SlotKind } | null) => void;
  onUpdate: (e: DayEntry) => void;
  onEdit: (e: DayEntry) => void;
}

const SPLIT_NY_ASSETS = ["ES1!", "YM1!", "NQ1!"];

export function DayColumn({ entry, focusedSlot, setFocus, onUpdate, onEdit }: Props) {
  const [session, setSession] = useState<Session>("ASIA");
  const isFocused = (slot: SlotKind) => focusedSlot?.id === entry.id && focusedSlot?.slot === slot;
  const focus = (slot: SlotKind) => setFocus({ id: entry.id, slot });

  const sessions = useMemo(() => {
    if (SPLIT_NY_ASSETS.includes(entry.asset)) {
      return ["ASIA", "LDN", "NY AM", "NY PM"] as Session[];
    }
    return ["ASIA", "LDN", "NY"] as Session[];
  }, [entry.asset]);

  // Adjust session if current one is not available for this asset
  useEffect(() => {
    if (!sessions.includes(session)) {
      if (session === "NY AM" || session === "NY PM") setSession("NY");
      else if (session === "NY") setSession("NY AM");
    }
  }, [sessions, session]);

  return (
    <div
      id={`bias-entry-${entry.id}`}
      className="bg-white rounded-2xl w-[85vw] md:w-[calc((100vw-var(--sidebar-width)-64px)/3)] shrink-0 flex flex-col overflow-hidden border border-border shadow-sm scroll-mx-6 transition-all duration-300"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border bg-muted/20">
        <div className="flex flex-col">
          <span className="text-primary font-bold text-sm tracking-tight">
            {weekdayOf(entry.date)}
          </span>
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{ddmm(entry.date)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary font-bold text-xs">
            {getAssetIconUrl(entry.asset) && (
              <div className="w-4 h-4 rounded-full overflow-hidden shrink-0 bg-white flex items-center justify-center">
                <img
                  src={getAssetIconUrl(entry.asset)!}
                  alt={entry.asset}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {entry.asset}
          </div>
          <button
            onClick={() => onEdit(entry)}
            className="text-muted-foreground hover:text-primary transition-colors p-1"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-4">
        {/* Monthly Outlook Area - Fixed Height for Alignment */}
        {weekdayOf(entry.date) === "MON" ? (
          <SlotWithBias
            label="Monthly Outlook"
            image={entry.monthlyImg}
            bias={entry.monthlyBias}
            correct={entry.monthlyCorrect}
            focused={isFocused("monthly")}
            onFocus={() => focus("monthly")}
            onImg={(u) => onUpdate({ ...entry, monthlyImg: u })}
            onToggle={() => onUpdate({ ...entry, monthlyCorrect: !entry.monthlyCorrect })}
          />
        ) : (
          /* Spacer for Tue-Fri to maintain horizontal alignment */
          <div className="h-44 rounded-xl border border-terminal-border/10 bg-black/5 flex items-center justify-center relative group/spacer">
            <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-black/20 backdrop-blur-sm text-[9px] uppercase tracking-widest text-muted-foreground/20 font-black border border-white/5">
              Monthly Outlook
            </div>
            <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/10 font-bold">MONDAY ONLY</span>
          </div>
        )}

        {/* Weekly */}
        <SlotWithBias
          label="W"
          image={entry.weeklyImg}
          bias={entry.weeklyBias}
          correct={entry.weeklyCorrect}
          focused={isFocused("weekly")}
          onFocus={() => focus("weekly")}
          onImg={(u) => onUpdate({ ...entry, weeklyImg: u })}
          onToggle={() => onUpdate({ ...entry, weeklyCorrect: !entry.weeklyCorrect })}
          hideBiasAndTick={weekdayOf(entry.date) !== "MON"}
        />

        {/* Daily */}
        <SlotWithBias
          label="D"
          image={entry.dailyImg}
          bias={entry.dailyBias}
          correct={entry.dailyCorrect}
          focused={isFocused("daily")}
          onFocus={() => focus("daily")}
          onImg={(u) => onUpdate({ ...entry, dailyImg: u })}
          onToggle={() => onUpdate({ ...entry, dailyCorrect: !entry.dailyCorrect })}
        />

        {/* 4H */}
        <div className="space-y-2">
          <div className="flex gap-1.5 p-1 bg-muted rounded-xl">
            {sessions.map((s) => {
              const active = session === s;
              const has = !!entry.h4[s]?.img || !!entry.h4[s]?.bias;
              return (
                <button
                  key={s}
                  onClick={() => {
                    setSession(s);
                    focus(`h4-${s}` as SlotKind);
                  }}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all ${active ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {s}
                  {has && (
                    <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-primary align-middle" />
                  )}
                </button>
              );
            })}
          </div>
          <PasteSlot
            label="4h"
            image={entry.h4[session]?.img}
            onChange={(u) => onUpdate({ ...entry, h4: { ...entry.h4, [session]: { ...entry.h4[session], img: u } } })}
            focused={isFocused(`h4-${session}` as SlotKind)}
            onFocus={() => focus(`h4-${session}` as SlotKind)}
            className="h-52 rounded-xl overflow-hidden border border-border/50"
          >
            {entry.h4[session]?.bias && (
              <span
                className="bias-tag absolute bottom-1 right-1 px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.18em] shadow-md leading-none"
                style={biasStyle(entry.h4[session]!.bias!)}
              >
                {biasLabel(entry.h4[session]!.bias!)}
              </span>
            )}
          </PasteSlot>
        </div>
      </div>
    </div>
  );
}

function SlotWithBias({
  label,
  image,
  bias,
  correct,
  focused,
  onFocus,
  onImg,
  onToggle,
  hideBiasAndTick,
}: {
  label: string;
  image?: string;
  bias: any;
  correct: boolean;
  focused: boolean;
  onFocus: () => void;
  onImg: (u: string | undefined) => void;
  onToggle: () => void;
  hideBiasAndTick?: boolean;
}) {
  return (
    <PasteSlot
      label={label}
      image={image}
      focused={focused}
      onFocus={onFocus}
      onChange={onImg}
      className="h-44"
    >
      {!hideBiasAndTick && (
        <>
          <span
            className="bias-tag absolute bottom-1 right-1 px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.18em] shadow-md leading-none"
            style={biasStyle(bias)}
          >
            {biasLabel(bias)}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            title="Mark accuracy correct"
            className={`absolute top-1 right-1 w-5 h-5 rounded border border-terminal-border bg-black/70 flex items-center justify-center transition-all ${correct ? "neon-correct" : "text-muted-foreground hover:text-neon-cyan"}`}
          >
            {correct && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
          </button>
        </>
      )}
    </PasteSlot>
  );
}
