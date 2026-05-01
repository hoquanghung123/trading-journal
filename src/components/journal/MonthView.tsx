import { useMemo, useState } from "react";
import {
  type DayEntry,
  type Bias,
  monthKey,
  ddmm,
  weekdayOf,
  biasStyle,
  biasLabel,
} from "@/lib/journal";
import { getAssetIconUrl } from "@/lib/symbols";
import { PasteSlot } from "./PasteSlot";

const BIASES: Bias[] = ["bullish", "bearish", "consolidation"];

interface Props {
  entries: DayEntry[];
  onUpdate: (e: DayEntry) => void;
  asset: string;
}

export function MonthView({ entries, onUpdate, asset }: Props) {
  // Group entries by month
  const grouped = useMemo(() => {
    const map = new Map<string, DayEntry[]>();
    for (const e of entries) {
      const m = monthKey(e.date);
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(e);
    }
    // Sort months ascending (oldest first, newest last on the right)
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries]);

  if (grouped.length === 0) {
    return null; // Should be handled by Empty state in JournalView
  }

  const scrollRef = useMemo(() => (el: HTMLDivElement) => {
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  return (
    <div 
      ref={scrollRef}
      className="flex flex-row gap-8 overflow-x-auto pb-10 px-4 md:px-8 snap-x hide-scrollbar"
    >
      {grouped.map(([month, monthEntries]) => (
        <MonthBox
          key={month}
          month={month}
          asset={asset}
          entries={monthEntries}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}

function MonthBox({
  month,
  asset,
  entries,
  onUpdate,
}: {
  month: string;
  asset: string;
  entries: DayEntry[];
  onUpdate: (e: DayEntry) => void;
}) {
  // The first entry of the month will hold the yearly_img
  const firstEntry = entries[0];
  const yearlyImg = firstEntry?.yearlyImg;

  // Find all Monday and 1st-of-month entries for the Monthly frames
  const monthlyOutlookEntries = useMemo(() => {
    return entries
      .filter((e) => weekdayOf(e.date) === "MON" || e.date.endsWith("-01"))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [entries]);

  const [focusedSlot, setFocusedSlot] = useState<string | null>(null);

  // Format month label (e.g., "2024-05" -> "May 2024")
  const monthLabel = useMemo(() => {
    try {
      const d = new Date(`${month}-01T00:00:00`);
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return month;
    }
  }, [month]);

  return (
    <div className="bg-white rounded-[32px] border border-border shadow-md overflow-hidden flex flex-col w-[85vw] md:w-[800px] shrink-0 snap-center transition-all duration-300 hover:shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
        <h3 className="text-lg font-black tracking-tight text-foreground flex items-center">
          {monthLabel}
          <span className="text-muted-foreground font-medium ml-2 flex items-center gap-1.5">
            /
            {asset !== "ALL" && getAssetIconUrl(asset) && (
              <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 bg-white flex items-center justify-center shadow-sm">
                <img
                  src={getAssetIconUrl(asset)!}
                  alt={asset}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {asset === "ALL" ? "All Assets" : asset}
          </span>
        </h3>
        <div className="px-3 py-1 rounded-md bg-primary/10 text-primary font-bold text-xs uppercase tracking-widest">
          Month View
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Yearly Frame (Top) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Yearly Outlook
            </h4>
            {firstEntry && (
              <div className="flex bg-muted/50 p-1 rounded-lg border border-border">
                {BIASES.map((b) => {
                  const active = firstEntry.yearlyBias === b;
                  return (
                    <button
                      key={b}
                      onClick={() => onUpdate({ ...firstEntry, yearlyBias: b })}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                        active
                          ? b === "bullish"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : b === "bearish"
                              ? "bg-destructive text-destructive-foreground shadow-sm"
                              : "bg-warning text-warning-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {biasLabel(b)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <PasteSlot
            label={`Yearly - ${monthLabel}`}
            image={yearlyImg}
            focused={focusedSlot === "yearly"}
            onFocus={() => setFocusedSlot("yearly")}
            onChange={(u) => {
              if (firstEntry) {
                onUpdate({ ...firstEntry, yearlyImg: u });
              }
            }}
            className="h-[300px] rounded-2xl border border-border/50"
          >
            {firstEntry?.yearlyBias && (
              <span
                className="bias-tag absolute bottom-2 right-2 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.18em] shadow-md leading-none"
                style={biasStyle(firstEntry.yearlyBias)}
              >
                {biasLabel(firstEntry.yearlyBias)}
              </span>
            )}
          </PasteSlot>
        </div>

        {/* Monthly Frames (Bottom, Horizontal) */}
        <div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Monthly Outlooks (Mon / 1st)
          </h4>

          {monthlyOutlookEntries.length === 0 ? (
            <div className="h-32 rounded-2xl border border-dashed border-border flex items-center justify-center bg-muted/30">
              <span className="text-xs text-muted-foreground font-semibold">
                No Monday or 1st-of-month entries logged.
              </span>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
              {monthlyOutlookEntries.map((e) => (
                <div key={e.id} className="w-[280px] shrink-0">
                  <PasteSlot
                    label={`Monthly - ${ddmm(e.date)}`}
                    image={e.monthlyImg}
                    focused={focusedSlot === `monthly-${e.id}`}
                    onFocus={() => setFocusedSlot(`monthly-${e.id}`)}
                    onChange={(u) => onUpdate({ ...e, monthlyImg: u })}
                    className="h-[180px] rounded-xl border border-border/50"
                  >
                    <span
                      className="bias-tag absolute bottom-1 right-1 px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-[0.18em] shadow-md leading-none"
                      style={biasStyle(e.monthlyBias)}
                    >
                      {biasLabel(e.monthlyBias)}
                    </span>
                  </PasteSlot>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
