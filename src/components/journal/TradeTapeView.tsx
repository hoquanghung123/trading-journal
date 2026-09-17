import { computeOutcome, type Trade } from "@/lib/trades";
import { getAssetIconUrl } from "@/lib/symbols";
import { TradeImageThumb } from "./TradeImageThumb";
import {
  formatNyDateTime,
  formatSigned,
  gradeStyle,
} from "@/lib/trade-log";
import { focusPlaybookModel, navigateToPage } from "@/lib/nav-bus";

export function TradeTapeView({
  trades,
  playbookName,
  showGrade,
  onOpen,
}: {
  trades: Trade[];
  playbookName: (id?: string) => string | undefined;
  showGrade?: boolean;
  onOpen: (t: Trade) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="hidden lg:grid grid-cols-[52px_1.2fr_72px_96px_72px_92px_56px_88px] gap-2 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/40">
        <span>Pre</span>
        <span>Ticket</span>
        <span>Side</span>
        <span>NY time</span>
        <span>R</span>
        <span>PnL</span>
        <span>Grade</span>
        <span>Model</span>
      </div>
      {trades.map((t) => {
        const outcome = computeOutcome(t.actualRr, t.maxRr, t.netPnl);
        const model = playbookName(t.setupId);
        const rail =
          outcome.label === "Win"
            ? "shadow-[inset_3px_0_0_hsl(var(--primary))]"
            : outcome.label === "Loss"
              ? "shadow-[inset_3px_0_0_hsl(var(--destructive))]"
              : "shadow-[inset_3px_0_0_hsl(var(--warning))]";
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onOpen(t)}
            className={`w-full text-left px-3 py-2.5 border-b border-border/60 last:border-0 hover:bg-muted/40 transition-colors ${rail}`}
          >
            <div className="grid grid-cols-[52px_1fr_auto] lg:grid-cols-[52px_1.2fr_72px_96px_72px_92px_56px_88px] gap-2 items-center">
              <span onClick={(e) => e.stopPropagation()}>
                <TradeImageThumb
                  path={t.beforeImg}
                  label="PRE"
                  pair={{ path: t.afterImg, label: "POST" }}
                />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  {getAssetIconUrl(t.symbol) && (
                    <img
                      src={getAssetIconUrl(t.symbol)!}
                      alt=""
                      className="w-4 h-4 rounded-full"
                    />
                  )}
                  <span className="text-[13px] font-black tracking-tight">{t.symbol}</span>
                </span>
                <span className="block text-[10px] text-muted-foreground font-medium truncate">
                  {model ?? "No model"} · {outcome.label}
                </span>
              </span>
              <span
                className={`text-[10px] font-black uppercase tracking-wider ${
                  t.side === "buy" ? "text-primary" : "text-destructive"
                }`}
              >
                {t.side}
              </span>
              <span className="hidden lg:block tabular-nums text-[11px] font-semibold text-muted-foreground">
                {formatNyDateTime(t.entryTime)}
              </span>
              <span className="hidden lg:block tabular-nums text-[12px] font-bold">
                {formatSigned(t.actualRr, 1)}R
              </span>
              <span
                className={`tabular-nums text-[12px] font-bold ${
                  t.netPnl > 0 ? "text-primary" : t.netPnl < 0 ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {formatSigned(t.netPnl)}
              </span>
              <span className="hidden lg:block text-[10px] font-black">
                {showGrade && t.grade ? (
                  <span className={`px-1.5 py-0.5 rounded ${gradeStyle[t.grade] ?? ""}`}>{t.grade}</span>
                ) : (
                  <span className="text-muted-foreground/40">—</span>
                )}
              </span>
              <span className="hidden lg:block min-w-0">
                {t.setupId ? (
                  <button
                    type="button"
                    className="text-[10px] font-bold text-primary underline underline-offset-2 truncate"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateToPage("playbook");
                      setTimeout(() => focusPlaybookModel(t.setupId!), 50);
                    }}
                  >
                    {model ?? "Unknown"}
                  </button>
                ) : (
                  <span className="text-[10px] text-muted-foreground/40">—</span>
                )}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
