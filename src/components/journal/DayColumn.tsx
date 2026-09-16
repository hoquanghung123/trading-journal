import { useState, useMemo, useEffect, useRef } from "react";
import { Edit3, Check } from "lucide-react";
import {
  type DayEntry,
  type Session,
  type SlotKind,
  type Bias,
  biasStyle,
  biasLabel,
  ddmm,
  weekdayOf,
  getSessionsForAsset,
  isHtfBiasSet,
  h4TabForNow,
  cycleBias,
  type KillzoneChip,
  assetSessionForChip,
} from "@/lib/journal";
import { getAssetIconUrl } from "@/lib/symbols";
import { PasteSlot } from "./PasteSlot";

interface Props {
  entry: DayEntry;
  focusedSlot: { id: string; slot: SlotKind } | null;
  setFocus: (f: { id: string; slot: SlotKind } | null) => void;
  onUpdate: (e: DayEntry) => void;
  onEdit: (e: DayEntry) => void;
  focusKillzone?: KillzoneChip | null;
  focusTick?: number;
}

export function DayColumn({
  entry,
  focusedSlot,
  setFocus,
  onUpdate,
  onEdit,
  focusKillzone = null,
  focusTick = 0,
}: Props) {
  const [session, setSession] = useState<Session>(() => h4TabForNow(entry.asset));
  const userPickedSession = useRef(false);
  const isFocused = (slot: SlotKind) => focusedSlot?.id === entry.id && focusedSlot?.slot === slot;
  const focus = (slot: SlotKind) => setFocus({ id: entry.id, slot });

  const sessions = useMemo(() => getSessionsForAsset(entry.asset), [entry.asset]);

  const isMonday = useMemo(() => weekdayOf(entry.date) === "MON", [entry.date]);
  const isFirstOfMonth = useMemo(() => entry.date.endsWith("-01"), [entry.date]);
  const showMonthly = isMonday || isFirstOfMonth;

  // Adjust session if current one is not available for this asset
  useEffect(() => {
    if (!sessions.includes(session)) {
      if (session === "NY AM" || session === "NY PM") setSession("NY");
      else if (session === "NY") setSession("NY AM");
    }
  }, [sessions, session]);

  useEffect(() => {
    if (userPickedSession.current) return;
    setSession(h4TabForNow(entry.asset));
  }, [entry.asset]);

  useEffect(() => {
    if (!focusKillzone || !focusTick) return;
    userPickedSession.current = true;
    setSession(assetSessionForChip(entry.asset, focusKillzone));
  }, [focusKillzone, focusTick, entry.asset]);

  return (
    <div
      id={`bias-entry-${entry.id}`}
      className="bg-card rounded-2xl w-[85vw] md:w-[calc((100vw-var(--sidebar-width)-64px)/3)] shrink-0 flex flex-col overflow-hidden border border-border shadow-sm scroll-mx-6 transition-all duration-300"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border bg-muted/20">
        <div className="flex flex-col">
          <span className="text-primary font-bold text-sm tracking-tight">
            {weekdayOf(entry.date)}
          </span>
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
            {ddmm(entry.date)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary font-bold text-xs">
            {getAssetIconUrl(entry.asset) && (
              <div className="w-4 h-4 rounded-full overflow-hidden shrink-0 bg-background flex items-center justify-center">
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
        {showMonthly && (
          <SlotWithBias
            label="M"
            image={entry.monthlyImg}
            bias={entry.monthlyBias}
            correct={entry.monthlyCorrect}
            focused={isFocused("monthly")}
            onFocus={() => focus("monthly")}
            onImg={(u) => onUpdate({ ...entry, monthlyImg: u })}
            onToggle={() => onUpdate({ ...entry, monthlyCorrect: !entry.monthlyCorrect })}
            onCycle={() => onUpdate({ ...entry, monthlyBias: cycleBias(entry.monthlyBias) })}
          />
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
          onCycle={() => onUpdate({ ...entry, weeklyBias: cycleBias(entry.weeklyBias) })}
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
          onCycle={() => onUpdate({ ...entry, dailyBias: cycleBias(entry.dailyBias) })}
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
                    userPickedSession.current = true;
                    setSession(s);
                    focus(`h4-${s}` as SlotKind);
                  }}
                  className={`flex-1 px-1 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all ${active ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <div className="flex items-center justify-center gap-1">
                    {s}
                    {isHtfBiasSet(entry.h4[s]?.bias, entry.h4[s]?.img) ? (
                      <span
                        className="px-1 py-0.5 rounded-[4px] text-[7px] font-black leading-none shrink-0"
                        style={biasStyle(entry.h4[s]!.bias!)}
                      >
                        {biasLabel(entry.h4[s]!.bias!)}
                      </span>
                    ) : (
                      entry.h4[s]?.img && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      )
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <PasteSlot
            label="4h"
            image={entry.h4[session]?.img}
            onChange={(u) =>
              onUpdate({
                ...entry,
                h4: { ...entry.h4, [session]: { ...entry.h4[session], img: u } },
              })
            }
            focused={isFocused(`h4-${session}` as SlotKind)}
            onFocus={() => focus(`h4-${session}` as SlotKind)}
            className="h-52 rounded-xl overflow-hidden border border-border/50"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({
                  ...entry,
                  h4: {
                    ...entry.h4,
                    [session]: { ...entry.h4[session], bias: cycleBias(entry.h4[session]?.bias) },
                  },
                });
              }}
              className={`bias-tag absolute bottom-1 right-1 px-2 py-[3px] text-[10px] font-black uppercase tracking-[0.18em] shadow-md leading-none ${
                isHtfBiasSet(entry.h4[session]?.bias, entry.h4[session]?.img)
                  ? ""
                  : "bg-black/60 text-muted-foreground"
              }`}
              style={
                isHtfBiasSet(entry.h4[session]?.bias, entry.h4[session]?.img)
                  ? biasStyle(entry.h4[session]!.bias!)
                  : undefined
              }
            >
              {isHtfBiasSet(entry.h4[session]?.bias, entry.h4[session]?.img)
                ? biasLabel(entry.h4[session]!.bias!)
                : "—"}
            </button>
          </PasteSlot>
        </div>
        {entry.notes?.trim() && (
          <button
            type="button"
            onClick={() => onEdit(entry)}
            className="w-full text-left text-xs font-medium text-muted-foreground line-clamp-2 px-1 hover:text-foreground transition-colors"
          >
            {entry.notes.trim()}
          </button>
        )}
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
  onCycle,
  hideBiasAndTick,
}: {
  label: string;
  image?: string;
  bias: Bias;
  correct: boolean;
  focused: boolean;
  onFocus: () => void;
  onImg: (u: string | undefined) => void;
  onToggle: () => void;
  onCycle?: () => void;
  hideBiasAndTick?: boolean;
}) {
  const set = isHtfBiasSet(bias, image);
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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCycle?.();
            }}
            className={`bias-tag absolute bottom-1 right-1 px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.18em] shadow-md leading-none ${
              set ? "" : "bg-black/60 text-muted-foreground"
            }`}
            style={set ? biasStyle(bias) : undefined}
            title="Cycle bias"
          >
            {set ? biasLabel(bias) : "—"}
          </button>
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
