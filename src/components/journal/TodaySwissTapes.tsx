import { useEffect, useState } from "react";
import { Edit3, Check, ChevronDown, ChevronUp } from "lucide-react";
import type { DayEntry, Session, Bias, KillzoneChip } from "@/lib/journal";
import {
  getSessionsForAsset,
  biasStyle,
  biasLabel,
  weekdayOf,
  isHtfBiasSet,
  assetSessionForChip,
} from "@/lib/journal";
import { getAssetIconUrl } from "@/lib/symbols";
import { PasteSlot } from "./PasteSlot";

function AssetIcon({
  asset,
  size = "md",
}: {
  asset: string;
  size?: "md" | "sm";
}) {
  const url = getAssetIconUrl(asset);
  const box = size === "sm" ? "w-5 h-5" : "w-8 h-8";
  const type = size === "sm" ? "text-[8px]" : "text-[10px]";
  if (url) {
    return (
      <div
        className={`${box} rounded-full overflow-hidden shrink-0 bg-white flex items-center justify-center border border-border/50`}
      >
        <img src={url} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`${box} rounded-full shrink-0 bg-muted flex items-center justify-center border border-border/50 ${type} font-black text-muted-foreground`}
    >
      {asset.slice(0, 2)}
    </div>
  );
}

function BiasChoice({
  value,
  image,
  onChange,
  stretch,
}: {
  value: Bias | undefined;
  image?: string;
  onChange: (b: Bias) => void;
  stretch?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {(["bullish", "bearish", "consolidation"] as Bias[]).map((b) => {
        const active = value === b && (b !== "consolidation" || isHtfBiasSet(value, image));
        return (
          <button
            key={b}
            type="button"
            onClick={() => onChange(b)}
            className={`${stretch ? "flex-1 py-1 rounded" : "px-2.5 py-1 rounded-lg"} text-[9px] font-extrabold uppercase border transition-all ${
              active
                ? "border-transparent shadow-sm"
                : "bg-card text-muted-foreground border-border hover:bg-muted"
            }`}
            style={active ? biasStyle(b) : undefined}
          >
            {b === "bullish" ? "Bull" : b === "bearish" ? "Bear" : "Cons"}
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  entries: DayEntry[];
  watchlist: string[];
  onUpdate: (e: DayEntry) => void;
  onEdit: (e: DayEntry) => void;
  onCreate: (asset: string) => void;
  expandId?: string | null;
  focusKillzone?: KillzoneChip | null;
  focusTick?: number;
}

export function TodaySwissTapes({
  entries,
  watchlist,
  onUpdate,
  onEdit,
  onCreate,
  expandId,
  focusKillzone = null,
  focusTick = 0,
}: Props) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [pasteTarget, setPasteTarget] = useState<{ id: string; slot: string } | null>(null);
  const loggedAssets = new Set(entries.map((e) => e.asset));
  const dock = watchlist.filter((name) => !loggedAssets.has(name));

  useEffect(() => {
    if (!expandId) return;
    setExpandedRows((prev) => ({ ...prev, [expandId]: true }));
  }, [expandId]);

  useEffect(() => {
    if (!focusKillzone || !focusTick) return;
    setExpandedRows((prev) => {
      const next = { ...prev };
      for (const e of entries) next[e.id] = true;
      return next;
    });
    const id = window.setTimeout(() => {
      const first = entries[0];
      if (!first) return;
      const sess = assetSessionForChip(first.asset, focusKillzone);
      document
        .getElementById(`today-h4-${first.id}-${sess}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    return () => window.clearTimeout(id);
  }, [focusKillzone, focusTick]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-paste-target]")) setPasteTarget(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const slotSelected = (entryId: string, slot: string) =>
    pasteTarget?.id === entryId && pasteTarget.slot === slot;

  // Toggle expanded row
  const toggleRow = (entryId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [entryId]: !prev[entryId],
    }));
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-8">
      {entries.length === 0 && dock.length > 0 && (
        <div className="rounded-2xl border border-border bg-card px-4 py-5">
          <p className="text-sm font-black text-foreground">Prep an asset</p>
          <p className="text-[11px] font-medium text-muted-foreground">
            Choose what you are biasing today.
          </p>
        </div>
      )}

      {entries.map((entry) => {
        const sessions = getSessionsForAsset(entry.asset);
        const isExpanded =
          entry.id in expandedRows ? !!expandedRows[entry.id] : expandId === entry.id;

        const isMonday = weekdayOf(entry.date) === "MON";
        const isFirstOfMonth = entry.date.endsWith("-01");
        const showMonthly = isMonday || isFirstOfMonth;

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

        const { bias: h4Bias } = getH4SummaryBias(entry);

        // Check triple confluence (all bullish or all bearish)
        const isTripleBull =
          entry.weeklyBias === "bullish" && entry.dailyBias === "bullish" && h4Bias === "bullish";
        const isTripleBear =
          entry.weeklyBias === "bearish" && entry.dailyBias === "bearish" && h4Bias === "bearish";

        const showW = isHtfBiasSet(entry.weeklyBias, entry.weeklyImg);
        const showD = isHtfBiasSet(entry.dailyBias, entry.dailyImg);
        const mSet = isHtfBiasSet(entry.monthlyBias, entry.monthlyImg);
        const h4Shown = sessions.filter((sessionName) => {
          const sessionData = entry.h4[sessionName];
          return isHtfBiasSet(sessionData?.bias, sessionData?.img);
        });

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
                <AssetIcon asset={entry.asset} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base text-foreground tracking-tight">
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
                  {entry.notes?.trim() && (
                    <p className="text-[10px] text-muted-foreground/80 font-medium line-clamp-1 mt-0.5 max-w-[14rem]">
                      {entry.notes.trim()}
                    </p>
                  )}
                </div>
              </div>

              {/* Timeframe Badges & General Chevron */}
              <div className="flex items-center gap-3 min-w-0 overflow-x-auto hide-scrollbar">
                {showMonthly && mSet && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-secondary/40 border border-border/80 text-foreground">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">
                      M:
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[8px] font-black leading-none tracking-wider shrink-0"
                      style={biasStyle(entry.monthlyBias)}
                    >
                      {biasLabel(entry.monthlyBias)}
                    </span>
                  </div>
                )}

                {showW && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-secondary/40 border border-border/80 text-foreground">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">W:</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[8px] font-black leading-none tracking-wider shrink-0"
                    style={biasStyle(entry.weeklyBias)}
                  >
                    {biasLabel(entry.weeklyBias)}
                  </span>
                </div>
                )}

                {showD && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-secondary/40 border border-border/80 text-foreground">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">D:</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[8px] font-black leading-none tracking-wider shrink-0"
                    style={biasStyle(entry.dailyBias)}
                  >
                    {biasLabel(entry.dailyBias)}
                  </span>
                </div>
                )}

                {h4Shown.map((sessionName) => {
                  const sessionData = entry.h4[sessionName];
                  const sessionBias = sessionData?.bias;
                  if (!sessionBias) return null;
                  return (
                    <div
                      key={sessionName}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-secondary/40 border border-border/80 text-foreground"
                    >
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">
                        {sessionName}:
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[8px] font-black leading-none tracking-wider shrink-0"
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
                className="border-t border-border bg-muted/10 p-4 animate-in slide-in-from-top-4 duration-200 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                {entry.notes?.trim() && (
                  <button
                    type="button"
                    onClick={() => onEdit(entry)}
                    className="w-full text-left text-sm font-medium text-muted-foreground line-clamp-2 hover:text-foreground transition-colors"
                  >
                    {entry.notes.trim()}
                  </button>
                )}
                {/* Top Section: Monthly, Weekly & Daily Charts Side-by-Side */}
                <div
                  className={`grid grid-cols-1 ${showMonthly ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2"} gap-4`}
                >
                  {/* Monthly Panel */}
                  {showMonthly && (
                    <div
                      data-paste-target
                      onClick={() => setPasteTarget({ id: entry.id, slot: "monthly" })}
                      className={`space-y-2 bg-card/40 p-3 rounded-xl border transition-colors ${
                        slotSelected(entry.id, "monthly")
                          ? "border-primary/50 ring-1 ring-primary/20"
                          : "border-border/60"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
                        <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                          Monthly Timeframe
                        </h4>

                        {/* Monthly Controls */}
                        <div className="flex items-center gap-3">
                          <BiasChoice
                            value={entry.monthlyBias}
                            image={entry.monthlyImg}
                            onChange={(b) => onUpdate({ ...entry, monthlyBias: b })}
                          />

                          <div className="flex items-center gap-1.5 pl-3 border-l border-border/60">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase">
                              Correct
                            </span>
                            <button
                              onClick={() =>
                                onUpdate({ ...entry, monthlyCorrect: !entry.monthlyCorrect })
                              }
                              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                entry.monthlyCorrect
                                  ? "bg-primary border-primary text-primary-foreground shadow-sm"
                                  : "border-border text-muted-foreground hover:border-primary/50"
                              }`}
                            >
                              {entry.monthlyCorrect && (
                                <Check className="w-3.5 h-3.5" strokeWidth={3} />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      <PasteSlot
                        label="M"
                        image={entry.monthlyImg}
                        onChange={(url) => onUpdate({ ...entry, monthlyImg: url })}
                        focused={slotSelected(entry.id, "monthly")}
                        onFocus={() => setPasteTarget({ id: entry.id, slot: "monthly" })}
                        selectToPaste
                        fitImage
                        className="w-full"
                      />
                    </div>
                  )}

                  {/* Weekly Panel */}
                  <div
                    data-paste-target
                    onClick={() => setPasteTarget({ id: entry.id, slot: "weekly" })}
                    className={`space-y-2 bg-card/40 p-3 rounded-xl border transition-colors ${
                      slotSelected(entry.id, "weekly")
                        ? "border-primary/50 ring-1 ring-primary/20"
                        : "border-border/60"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
                      <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                        Weekly Timeframe
                      </h4>

                      {/* Weekly Controls */}
                      <div className="flex items-center gap-3">
                        <BiasChoice
                          value={entry.weeklyBias}
                          image={entry.weeklyImg}
                          onChange={(b) => onUpdate({ ...entry, weeklyBias: b })}
                        />

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
                      label="W"
                      image={entry.weeklyImg}
                      onChange={(url) => onUpdate({ ...entry, weeklyImg: url })}
                      focused={slotSelected(entry.id, "weekly")}
                      onFocus={() => setPasteTarget({ id: entry.id, slot: "weekly" })}
                      selectToPaste
                      fitImage
                      className="w-full"
                    />
                  </div>

                  {/* Daily Panel */}
                  <div
                    data-paste-target
                    onClick={() => setPasteTarget({ id: entry.id, slot: "daily" })}
                    className={`space-y-2 bg-card/40 p-3 rounded-xl border transition-colors ${
                      slotSelected(entry.id, "daily")
                        ? "border-primary/50 ring-1 ring-primary/20"
                        : "border-border/60"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
                      <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                        Daily Timeframe
                      </h4>

                      {/* Daily Controls */}
                      <div className="flex items-center gap-3">
                        <BiasChoice
                          value={entry.dailyBias}
                          image={entry.dailyImg}
                          onChange={(b) => onUpdate({ ...entry, dailyBias: b })}
                        />

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
                      label="D"
                      image={entry.dailyImg}
                      onChange={(url) => onUpdate({ ...entry, dailyImg: url })}
                      focused={slotSelected(entry.id, "daily")}
                      onFocus={() => setPasteTarget({ id: entry.id, slot: "daily" })}
                      selectToPaste
                      fitImage
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Bottom Section: H4 Sessions (Dynamic Grid) */}
                <div className="space-y-3 pt-3 border-t border-border/40">
                  <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                    H4 Timeframe Sessions
                  </h4>

                  <div
                    className={`grid grid-cols-1 sm:grid-cols-2 ${
                      sessions.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
                    } gap-4`}
                  >
                    {sessions.map((sessionName) => {
                      const sessionData = entry.h4[sessionName] || {};
                      const sessionBias = sessionData?.bias;
                      const displaySessionLabel = sessionName.replace("_", " ");
                      const focusedH4 = focusKillzone
                        ? assetSessionForChip(entry.asset, focusKillzone)
                        : null;

                      return (
                        <div
                          key={sessionName}
                          id={`today-h4-${entry.id}-${sessionName}`}
                          data-paste-target
                          onClick={() =>
                            setPasteTarget({ id: entry.id, slot: `h4-${sessionName}` })
                          }
                          className={`space-y-2 bg-card/40 p-3 rounded-xl border transition-colors ${
                            slotSelected(entry.id, `h4-${sessionName}`) || sessionName === focusedH4
                              ? "border-primary/50 ring-1 ring-primary/20"
                              : "border-border/60"
                          }`}
                        >
                          <div className="flex flex-col gap-2 pb-2 border-b border-border/40">
                            <span className="text-xs font-black uppercase tracking-wider text-foreground">
                              H4 {displaySessionLabel}
                            </span>

                            {/* Session Bias Controls */}
                            <BiasChoice
                              stretch
                              value={sessionBias}
                              image={sessionData?.img}
                              onChange={(b) => {
                                const currentH4 = entry.h4[sessionName] || {};
                                onUpdate({
                                  ...entry,
                                  h4: {
                                    ...entry.h4,
                                    [sessionName]: { ...currentH4, bias: b },
                                  },
                                });
                              }}
                            />
                          </div>

                          <PasteSlot
                            label="H4"
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
                            focused={slotSelected(entry.id, `h4-${sessionName}`)}
                            onFocus={() =>
                              setPasteTarget({ id: entry.id, slot: `h4-${sessionName}` })
                            }
                            selectToPaste
                            fitImage
                            className="w-full"
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

      {dock.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pr-1">
            Add
          </span>
          {dock.map((assetName) => (
            <button
              key={assetName}
              type="button"
              onClick={() => onCreate(assetName)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border bg-card px-2.5 py-1.5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
            >
              <AssetIcon asset={assetName} size="sm" />
              <span className="text-[11px] font-bold text-foreground">{assetName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
