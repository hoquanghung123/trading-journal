import { useState } from "react";
import { Edit3, Check, ChevronDown, ChevronUp } from "lucide-react";
import type { DayEntry, Session, Bias } from "@/lib/journal";
import { getSessionsForAsset, biasStyle, biasLabel } from "@/lib/journal";
import { getAssetIconUrl } from "@/lib/symbols";
import { PasteSlot } from "./PasteSlot";

interface Props {
  entries: DayEntry[];
  onUpdate: (e: DayEntry) => void;
  onEdit: (e: DayEntry) => void;
}

export function TodaySwissTapes({ entries, onUpdate, onEdit }: Props) {
  // Track which rows are expanded: { [entryId]: boolean }
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Toggle expanded row
  const toggleRow = (entryId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [entryId]: !prev[entryId],
    }));
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-8">
      {entries.map((entry) => {
        const sessions = getSessionsForAsset(entry.asset);
        const isExpanded = !!expandedRows[entry.id];

        // Determine the H4 summary bias from the sessions
        const getH4SummaryBias = (e: DayEntry): { bias: Bias; session: Session } => {
          const directionalSession = sessions.find((s) => {
            const b = e.h4[s]?.bias;
            return b === "bullish" || b === "bearish";
          });
          if (directionalSession) {
            const b = e.h4[directionalSession]?.bias;
            if (b) {
              return { bias: b, session: directionalSession };
            }
          }
          return { bias: "consolidation", session: sessions[0] || "ASIA" };
        };

        const { bias: h4Bias, session: summaryH4Session } = getH4SummaryBias(entry);

        // Check triple confluence (all bullish or all bearish)
        const isTripleBull =
          entry.weeklyBias === "bullish" && entry.dailyBias === "bullish" && h4Bias === "bullish";
        const isTripleBear =
          entry.weeklyBias === "bearish" && entry.dailyBias === "bearish" && h4Bias === "bearish";

        return (
          <div
            key={entry.id}
            id={`bias-entry-${entry.id}`}
            className={`rounded-2xl border transition-all duration-300 overflow-hidden cursor-pointer select-none ${
              isExpanded
                ? isTripleBull
                  ? "border-bull/50 ring-1 ring-bull/25 bg-bull/10 dark:bg-bull/15"
                  : isTripleBear
                    ? "border-destructive/50 ring-1 ring-destructive/25 bg-destructive/10 dark:bg-destructive/15"
                    : "bg-card border-primary/40 ring-1 ring-primary/10 shadow-sm"
                : isTripleBull
                  ? "border-bull/45 bg-bull/10 dark:bg-bull/15 hover:bg-bull/15 dark:hover:bg-bull/20 shadow-sm"
                  : isTripleBear
                    ? "border-destructive/45 bg-destructive/10 dark:bg-destructive/15 hover:bg-destructive/15 dark:hover:bg-destructive/20 shadow-sm"
                    : "bg-card border-border hover:bg-muted/5 shadow-sm"
            }`}
            onClick={() => toggleRow(entry.id)}
          >
            {/* Header Ribbon / Tape Row */}
            <div
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 ${
                isTripleBull || isTripleBear ? "bg-transparent" : "bg-muted/5"
              }`}
            >
              {/* Left Info */}
              <div className="flex items-center gap-3">
                {getAssetIconUrl(entry.asset) && (
                  <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-white flex items-center justify-center border border-border/50">
                    <img
                      src={getAssetIconUrl(entry.asset)!}
                      alt={entry.asset}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-base text-foreground tracking-tight">
                      {entry.asset}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(entry);
                      }}
                      className="text-muted-foreground hover:text-primary transition-colors p-1"
                      title="Edit day entry details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-bold tracking-wider">
                    {entry.date}
                  </span>
                </div>
              </div>

              {/* Timeframe Badges & General Chevron */}
              <div className="flex items-center gap-3">
                {/* Weekly Badge */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-secondary/40 border border-border/80 text-foreground">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">W:</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[8px] font-black leading-none font-mono tracking-wider shrink-0"
                    style={biasStyle(entry.weeklyBias)}
                  >
                    {biasLabel(entry.weeklyBias)}
                  </span>
                </div>

                {/* Daily Badge */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-secondary/40 border border-border/80 text-foreground">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">D:</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[8px] font-black leading-none font-mono tracking-wider shrink-0"
                    style={biasStyle(entry.dailyBias)}
                  >
                    {biasLabel(entry.dailyBias)}
                  </span>
                </div>

                {/* Dynamic H4 Session Badges */}
                {sessions.map((sessionName) => {
                  const sessionData = entry.h4[sessionName];
                  const sessionBias = sessionData?.bias;
                  if (!sessionBias) return null; // Only show if bias is set
                  return (
                    <div
                      key={sessionName}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-secondary/40 border border-border/80 text-foreground"
                    >
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">
                        {sessionName}:
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[8px] font-black leading-none font-mono tracking-wider shrink-0"
                        style={biasStyle(sessionBias)}
                      >
                        {biasLabel(sessionBias)}
                      </span>
                    </div>
                  );
                })}

                {/* Unified Chevron indicator */}
                <div className="text-muted-foreground p-1 ml-1 hover:text-primary transition-colors">
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 opacity-80" />
                  ) : (
                    <ChevronDown className="w-4 h-4 opacity-80" />
                  )}
                </div>
              </div>
            </div>

            {/* Expandable Inline Unified Drawer */}
            {isExpanded && (
              <div
                className="border-t border-border bg-muted/10 p-6 animate-in slide-in-from-top-4 duration-200 space-y-8"
                onClick={(e) => e.stopPropagation()} // Prevent clicks inside the drawer from collapsing the row
              >
                {/* Top Section: Weekly & Daily Charts Side-by-Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Weekly Panel */}
                  <div className="space-y-4 bg-card/40 p-4 rounded-xl border border-border/60">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
                      <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                        Weekly Timeframe
                      </h4>

                      {/* Weekly Controls */}
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          {(["bullish", "bearish", "consolidation"] as Bias[]).map((b) => (
                            <button
                              key={b}
                              onClick={() => onUpdate({ ...entry, weeklyBias: b })}
                              className={`px-2.5 py-1 text-[9px] font-extrabold uppercase rounded-lg border transition-all ${
                                entry.weeklyBias === b
                                  ? b === "bullish"
                                    ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                                    : b === "bearish"
                                      ? "bg-rose-500 text-white border-rose-500 shadow-sm"
                                      : "bg-amber-500 text-white border-amber-500 shadow-sm"
                                  : "bg-card text-muted-foreground border-border hover:bg-muted"
                              }`}
                            >
                              {b === "bullish" ? "Bull" : b === "bearish" ? "Bear" : "Cons"}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-1.5 pl-3 border-l border-border/60">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase">
                            Correct
                          </span>
                          <button
                            onClick={() =>
                              onUpdate({ ...entry, weeklyCorrect: !entry.weeklyCorrect })
                            }
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                              entry.weeklyCorrect
                                ? "bg-primary border-primary text-primary-foreground shadow-sm"
                                : "border-border text-muted-foreground hover:border-primary/50"
                            }`}
                          >
                            {entry.weeklyCorrect && (
                              <Check className="w-3.5 h-3.5" strokeWidth={3} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <PasteSlot
                      label="Weekly Chart"
                      image={entry.weeklyImg}
                      onChange={(url) => onUpdate({ ...entry, weeklyImg: url })}
                      className="h-64 sm:h-80 w-full rounded-xl overflow-hidden border border-border"
                    />
                  </div>

                  {/* Daily Panel */}
                  <div className="space-y-4 bg-card/40 p-4 rounded-xl border border-border/60">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
                      <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                        Daily Timeframe
                      </h4>

                      {/* Daily Controls */}
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          {(["bullish", "bearish", "consolidation"] as Bias[]).map((b) => (
                            <button
                              key={b}
                              onClick={() => onUpdate({ ...entry, dailyBias: b })}
                              className={`px-2.5 py-1 text-[9px] font-extrabold uppercase rounded-lg border transition-all ${
                                entry.dailyBias === b
                                  ? b === "bullish"
                                    ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                                    : b === "bearish"
                                      ? "bg-rose-500 text-white border-rose-500 shadow-sm"
                                      : "bg-amber-500 text-white border-amber-500 shadow-sm"
                                  : "bg-card text-muted-foreground border-border hover:bg-muted"
                              }`}
                            >
                              {b === "bullish" ? "Bull" : b === "bearish" ? "Bear" : "Cons"}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-1.5 pl-3 border-l border-border/60">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase">
                            Correct
                          </span>
                          <button
                            onClick={() =>
                              onUpdate({ ...entry, dailyCorrect: !entry.dailyCorrect })
                            }
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                              entry.dailyCorrect
                                ? "bg-primary border-primary text-primary-foreground shadow-sm"
                                : "border-border text-muted-foreground hover:border-primary/50"
                            }`}
                          >
                            {entry.dailyCorrect && (
                              <Check className="w-3.5 h-3.5" strokeWidth={3} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <PasteSlot
                      label="Daily Chart"
                      image={entry.dailyImg}
                      onChange={(url) => onUpdate({ ...entry, dailyImg: url })}
                      className="h-64 sm:h-80 w-full rounded-xl overflow-hidden border border-border"
                    />
                  </div>
                </div>

                {/* Bottom Section: H4 Sessions (Dynamic Grid) */}
                <div className="space-y-4 pt-4 border-t border-border/40">
                  <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    H4 Timeframe Sessions
                  </h4>

                  <div
                    className={`grid grid-cols-1 sm:grid-cols-2 ${
                      sessions.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
                    } gap-6`}
                  >
                    {sessions.map((sessionName) => {
                      const sessionData = entry.h4[sessionName] || {};
                      const sessionBias = sessionData.bias || "consolidation";
                      const displaySessionLabel = sessionName.replace("_", " ");

                      return (
                        <div
                          key={sessionName}
                          className="space-y-3 bg-card/40 p-4 rounded-xl border border-border/60"
                        >
                          <div className="flex flex-col gap-2 pb-2 border-b border-border/40">
                            <span className="text-xs font-black uppercase tracking-wider text-foreground">
                              H4 {displaySessionLabel}
                            </span>

                            {/* Session Bias Controls */}
                            <div className="flex gap-1">
                              {(["bullish", "bearish", "consolidation"] as Bias[]).map((b) => (
                                <button
                                  key={b}
                                  onClick={() => {
                                    const currentH4 = entry.h4[sessionName] || {};
                                    onUpdate({
                                      ...entry,
                                      h4: {
                                        ...entry.h4,
                                        [sessionName]: { ...currentH4, bias: b },
                                      },
                                    });
                                  }}
                                  className={`flex-1 py-1 text-[9px] font-extrabold uppercase rounded border transition-all ${
                                    sessionBias === b
                                      ? b === "bullish"
                                        ? "bg-emerald-500 text-white border-emerald-500"
                                        : b === "bearish"
                                          ? "bg-rose-500 text-white border-rose-500"
                                          : "bg-amber-500 text-white border-amber-500"
                                      : "bg-card text-muted-foreground border-border hover:bg-muted"
                                  }`}
                                >
                                  {b === "bullish" ? "Bull" : b === "bearish" ? "Bear" : "Cons"}
                                </button>
                              ))}
                            </div>
                          </div>

                          <PasteSlot
                            label={`${displaySessionLabel} Chart`}
                            image={sessionData.img}
                            onChange={(url) => {
                              const currentH4 = entry.h4[sessionName] || {};
                              onUpdate({
                                ...entry,
                                h4: {
                                  ...entry.h4,
                                  [sessionName]: { ...currentH4, img: url },
                                },
                              });
                            }}
                            className="h-48 w-full rounded-lg overflow-hidden border border-border"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
