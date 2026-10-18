import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { computeOutcome, outcomeStyle, type Trade } from "@/lib/trades";
import { getAssetIconUrl } from "@/lib/symbols";
import { TradeImageThumb } from "./TradeImageThumb";
import { TradeAnalysisChips } from "./TradeAnalysisChips";
import {
  formatNyClock,
  formatNyDayKey,
  formatNyDayLabel,
  formatPnl,
  formatSigned,
  gradeStyle,
  notesExcerpt,
  tradeStatusClass,
} from "@/lib/trade-log";
import { focusBiasEntry, focusPlaybookModel, navigateToPage } from "@/lib/nav-bus";

type SortKey = "entryTime" | "netPnl" | "actualRr";

export function TradeLedgerView({
  trades,
  cols,
  showGrade,
  playbookName,
  executionSchema,
  onOpen,
}: {
  trades: Trade[];
  cols: Record<string, boolean>;
  showGrade?: boolean;
  playbookName: (id?: string) => string | undefined;
  executionSchema?: any[];
  onOpen: (t: Trade) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("entryTime");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const show = (k: string) => cols[k] !== false;

  const sorted = useMemo(() => {
    const copy = [...trades];
    copy.sort((a, b) => {
      const av = sortKey === "entryTime" ? +new Date(a.entryTime) : a[sortKey];
      const bv = sortKey === "entryTime" ? +new Date(b.entryTime) : b[sortKey];
      return dir === "desc" ? Number(bv) - Number(av) : Number(av) - Number(bv);
    });
    return copy;
  }, [trades, sortKey, dir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setDir("desc");
    }
  };

  const mark = (key: SortKey) => (sortKey === key ? (dir === "desc" ? " ↓" : " ↑") : "");

  const colSpan =
    3 +
    (show("outcome") ? 1 : 0) +
    (showGrade && show("grade") ? 1 : 0) +
    (show("entryTime") ? 1 : 0) +
    (show("side") ? 1 : 0) +
    (show("playbook") ? 1 : 0) +
    (show("bias") ? 1 : 0) +
    (show("stats") ? 2 : 0) +
    (show("images") ? 1 : 0) +
    (show("compliance") ? 1 : 0) +
    (show("status") ? 1 : 0) +
    (show("analysis") ? 1 : 0);

  const dayGroups = useMemo(() => {
    if (sortKey !== "entryTime") return [{ key: "all", label: null as string | null, pnl: 0, rows: sorted }];
    const map = new Map<string, { label: string; pnl: number; rows: Trade[] }>();
    for (const t of sorted) {
      const key = formatNyDayKey(t.entryTime);
      const g = map.get(key) ?? { label: formatNyDayLabel(t.entryTime), pnl: 0, rows: [] };
      g.pnl += t.netPnl;
      g.rows.push(t);
      map.set(key, g);
    }
    return Array.from(map.entries()).map(([key, g]) => ({ key, ...g }));
  }, [sorted, sortKey]);

  return (
    <div className="bg-card rounded-3xl border border-border/50 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[920px]">
          <thead>
            <tr className="text-[9px] lg:text-xs font-bold text-muted-foreground uppercase tracking-widest bg-muted/30 border-b border-border">
              <th className="sticky top-0 left-0 z-20 bg-muted text-center py-3 px-1 w-[36px]">#</th>
              <th className="sticky top-0 left-9 z-20 bg-muted text-left p-2 lg:p-3">Symbol</th>
              {show("outcome") && <th className="sticky top-0 z-10 bg-muted text-left p-2 lg:p-3">Out</th>}
              {showGrade && show("grade") && (
                <th className="sticky top-0 z-10 bg-muted text-left p-2 lg:p-3">Grade</th>
              )}
              {show("entryTime") && (
                <th
                  className="sticky top-0 z-10 bg-muted text-left p-2 lg:p-3 cursor-pointer"
                  onClick={() => toggleSort("entryTime")}
                >
                  Entry NY{mark("entryTime")}
                </th>
              )}
              {show("side") && <th className="sticky top-0 z-10 bg-muted text-left p-2 lg:p-3">Side</th>}
              {show("playbook") && <th className="sticky top-0 z-10 bg-muted text-left p-2 lg:p-3">Model</th>}
              {show("bias") && <th className="sticky top-0 z-10 bg-muted text-left p-2 lg:p-3">Bias</th>}
              {show("stats") && (
                <>
                  <th
                    className="sticky top-0 z-10 bg-muted text-left p-2 lg:p-3 cursor-pointer"
                    onClick={() => toggleSort("netPnl")}
                  >
                    PnL{mark("netPnl")}
                  </th>
                  <th
                    className="sticky top-0 z-10 bg-muted text-left p-2 lg:p-3 cursor-pointer"
                    onClick={() => toggleSort("actualRr")}
                  >
                    R{mark("actualRr")}
                  </th>
                </>
              )}
              {show("images") && <th className="sticky top-0 z-10 bg-muted text-left p-2 lg:p-3">Charts</th>}
              {show("compliance") && <th className="sticky top-0 z-10 bg-muted text-left p-2 lg:p-3">Rule</th>}
              {show("status") && <th className="sticky top-0 z-10 bg-muted text-left p-2 lg:p-3">Status</th>}
              {show("analysis") && <th className="sticky top-0 z-10 bg-muted text-left p-2 lg:p-3">Analysis</th>}
              <th className="sticky top-0 z-10 bg-muted text-left p-2 lg:p-3 min-w-[160px]">Notes</th>
            </tr>
          </thead>
          <tbody>
            {dayGroups.map((g) => (
              <DayBlock
                key={g.key}
                group={g}
                colSpan={colSpan}
                show={show}
                showGrade={showGrade}
                playbookName={playbookName}
                executionSchema={executionSchema}
                onOpen={onOpen}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DayBlock({
  group,
  colSpan,
  show,
  showGrade,
  playbookName,
  executionSchema,
  onOpen,
}: {
  group: { key: string; label: string | null; pnl: number; rows: Trade[] };
  colSpan: number;
  show: (k: string) => boolean;
  showGrade?: boolean;
  playbookName: (id?: string) => string | undefined;
  executionSchema?: any[];
  onOpen: (t: Trade) => void;
}) {
  return (
    <>
      {group.label && (
        <tr className="bg-[#EEF4EB] dark:bg-primary/10">
          <td colSpan={colSpan} className="px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black tracking-tight">{group.label} · NY</span>
              <span
                className={`tabular-nums text-[11px] font-bold ${
                  group.pnl >= 0 ? "text-primary" : "text-destructive"
                }`}
              >
                day {formatSigned(group.pnl)} · {group.rows.length}{" "}
                {group.rows.length === 1 ? "trade" : "trades"}
              </span>
            </div>
          </td>
        </tr>
      )}
      {group.rows.map((t, i) => {
        const outcome = computeOutcome(t.actualRr, t.maxRr, t.netPnl, t.brokerData);
        const model = playbookName(t.setupId);
        const excerpt = notesExcerpt(t.notes);
        return (
          <tr
            key={t.id}
            onClick={() => onOpen(t)}
            className="group border-b border-border/50 hover:bg-muted/30 cursor-pointer"
          >
            <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/30 py-3 px-1 text-center">
              <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {String(i + 1).padStart(2, "0")}
              </span>
            </td>
            <td className="sticky left-9 z-10 bg-card group-hover:bg-muted/30 p-2 lg:p-3">
              <div className="flex items-center gap-1.5">
                {getAssetIconUrl(t.symbol) && (
                  <img src={getAssetIconUrl(t.symbol)!} alt="" className="w-5 h-5 rounded-full" />
                )}
                <span className="font-black text-xs lg:text-sm">{t.symbol}</span>
              </div>
            </td>
            {show("outcome") && (
              <td className="p-2 lg:p-3">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${outcomeStyle[outcome.color]}`}
                >
                  {outcome.label}
                </span>
              </td>
            )}
            {showGrade && show("grade") && (
              <td className="p-2 lg:p-3">
                {t.grade ? (
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${gradeStyle[t.grade] ?? ""}`}>
                    {t.grade}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/30">—</span>
                )}
              </td>
            )}
            {show("entryTime") && (
              <td className="p-2 lg:p-3 tabular-nums text-[11px] text-muted-foreground">
                {formatNyClock(t.entryTime)}
              </td>
            )}
            {show("side") && (
              <td
                className={`p-2 lg:p-3 text-[10px] font-black uppercase ${
                  t.side === "buy" ? "text-primary" : "text-destructive"
                }`}
              >
                {t.side}
              </td>
            )}
            {show("playbook") && (
              <td className="p-2 lg:p-3">
                {t.setupId ? (
                  <button
                    type="button"
                    className="text-[11px] font-bold text-primary underline underline-offset-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateToPage("playbook");
                      setTimeout(() => focusPlaybookModel(t.setupId!), 50);
                    }}
                  >
                    {model ?? "Unknown"}
                  </button>
                ) : (
                  <span className="text-muted-foreground/30">—</span>
                )}
              </td>
            )}
            {show("bias") && (
              <td className="p-2 lg:p-3">
                {t.biasEntryId ? (
                  <button
                    type="button"
                    className="text-[11px] font-bold text-primary underline underline-offset-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateToPage("bias");
                      setTimeout(() => focusBiasEntry(t.biasEntryId!, t.symbol), 50);
                    }}
                  >
                    Bias
                  </button>
                ) : (
                  <span className="text-muted-foreground/30">—</span>
                )}
              </td>
            )}
            {show("stats") && (
              <>
                <td
                  className={`p-2 lg:p-3 tabular-nums font-bold ${
                    t.netPnl > 0 ? "text-primary" : t.netPnl < 0 ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {formatPnl(t.netPnl)}
                </td>
                <td className="p-2 lg:p-3 tabular-nums text-[12px]">
                  {t.brokerData && !t.brokerData.rKnown && t.actualRr === 0 ? "— / —" : `${formatSigned(t.actualRr, 1)} / ${t.maxRr}`}
                </td>
              </>
            )}
            {show("images") && (
              <td className="p-2 lg:p-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex overflow-hidden rounded-lg border border-border w-[88px]">
                  <TradeImageThumb path={t.beforeImg} label="PRE" pair={{ path: t.afterImg, label: "POST" }} />
                  <TradeImageThumb path={t.afterImg} label="POST" pair={{ path: t.beforeImg, label: "PRE" }} />
                </div>
              </td>
            )}
            {show("compliance") && (
              <td className="p-2 lg:p-3">
                {t.complianceCheck ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-primary">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Followed
                  </span>
                ) : (
                  <div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-destructive">
                      <AlertCircle className="w-3.5 h-3.5" /> Broke
                    </span>
                    {t.missedConfluences?.[0] && (
                      <span className="block text-[9px] text-destructive">{t.missedConfluences[0]}</span>
                    )}
                  </div>
                )}
              </td>
            )}
            {show("status") && (
              <td className="p-2 lg:p-3">
                <span
                  className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${tradeStatusClass(t.status)}`}
                >
                  {t.status === "Not Started" ? "Draft" : t.status}
                </span>
              </td>
            )}
            {show("analysis") && (
              <td className="p-2 lg:p-3 max-w-[200px] overflow-hidden">
                <TradeAnalysisChips trade={t} schema={executionSchema} compact />
              </td>
            )}
            <td className="p-2 lg:p-3 text-xs text-muted-foreground">
              <span className="block max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                {excerpt || "—"}
              </span>
            </td>
          </tr>
        );
      })}
    </>
  );
}
