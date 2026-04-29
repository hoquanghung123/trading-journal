import { useMemo, useState } from "react";
import { type DayEntry, type Bias, monthKey, ddmm, weekdayOf, biasStyle, biasLabel } from "@/lib/journal";
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
    // Sort months descending (newest first)
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  if (grouped.length === 0) {
    return null; // Should be handled by Empty state in JournalView
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-8">
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

  // Find all Monday entries for the Monthly frames
  const mondayEntries = entries.filter((e) => weekdayOf(e.date) === "MON");

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
    <div className="bg-white rounded-[24px] border border-border shadow-sm overflow-hidden flex flex-col">
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
                            ? "bg-emerald-500 text-white shadow-sm" 
                            : b === "bearish" 
                              ? "bg-rose-500 text-white shadow-sm"
                              : "bg-amber-500 text-white shadow-sm"
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
            Monthly Outlooks (Mondays)
          </h4>
          
          {mondayEntries.length === 0 ? (
            <div className="h-32 rounded-2xl border border-dashed border-border flex items-center justify-center bg-muted/30">
              <span className="text-xs text-muted-foreground font-semibold">No Mondays logged in this month.</span>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
              {mondayEntries.map((e) => (
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
