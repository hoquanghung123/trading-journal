import { useEffect, useMemo, useState } from "react";
import {
  type KillzoneChip,
  KILLZONE_CHIPS,
  KILLZONE_OPEN_CLOCK,
  getKillzoneProgress,
  isKillzonePassed,
} from "@/lib/journal";

const URGENT_SECS = 15 * 60;

function formatRemain(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (s < URGENT_SECS) {
    return m === 0 ? `${sec}s` : `${m}m ${String(sec).padStart(2, "0")}s`;
  }
  if (h === 0) return `${Math.max(1, m)}m`;
  return `${h}h ${m}m`;
}

interface Props {
  selected?: KillzoneChip | null;
  onSelect?: (chip: KillzoneChip) => void;
}

export function SessionChip({ selected, onSelect }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const progress = useMemo(() => getKillzoneProgress(new Date(now)), [now]);
  const live = progress.live;
  const focused = selected ?? live;
  const urgent = progress.remainSeconds < URGENT_SECS;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), urgent ? 1_000 : 15_000);
    return () => window.clearInterval(id);
  }, [urgent]);

  const remain = formatRemain(progress.remainSeconds);
  const hint = progress.wait ? `${progress.leftPct}% to open` : `${progress.leftPct}% left`;

  return (
    <div className="flex items-center gap-2 min-w-0 w-full max-w-[640px]">
      <div className="flex flex-1 min-w-0 rounded-full border border-border bg-card overflow-hidden">
        {KILLZONE_CHIPS.map((chip, i) => {
          const isLive = chip === live;
          const isFocus = chip === focused && !isLive;
          const isNext = chip === progress.next && !isLive && !isFocus;
          const passed = isKillzonePassed(chip, new Date(now));
          return (
            <button
              key={chip}
              type="button"
              aria-pressed={chip === focused}
              onClick={() => onSelect?.(chip)}
              className={`relative flex-1 min-w-0 flex flex-col items-center justify-center px-1 pt-1.5 pb-2.5 border-border transition-colors ${
                i < KILLZONE_CHIPS.length - 1 ? "border-r" : ""
              } ${
                isLive
                  ? "forest-gradient text-white"
                  : isFocus
                    ? "bg-primary/15 text-primary"
                    : isNext
                      ? "bg-[#F4F8F1] text-primary"
                      : passed
                        ? "text-muted-foreground/70"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span className="text-[8px] sm:text-[9px] font-black tracking-wider leading-tight whitespace-nowrap">
                {chip}
              </span>
              <span className="text-[8px] font-semibold font-mono tabular-nums leading-tight mt-0.5 opacity-70">
                {KILLZONE_OPEN_CLOCK[chip]}
              </span>
              {isLive && (
                <span className="absolute left-2 right-2 bottom-1 h-0.5 rounded-full bg-white/25 overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-white"
                    style={{ width: `${progress.leftPct}%` }}
                  />
                </span>
              )}
              {passed && !isLive && (
                <span className="absolute left-2 right-2 bottom-1 h-0.5 rounded-full bg-foreground/10 overflow-hidden">
                  <span className="block h-full w-full rounded-full bg-muted-foreground/35" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        className={`rounded-2xl px-3 py-1.5 leading-none shrink-0 min-w-[5.5rem] ${
          urgent ? "bg-amber-50 text-amber-800" : "bg-primary/10 text-primary"
        }`}
      >
        <p
          className={`font-mono tabular-nums text-[13px] font-bold ${
            urgent ? "animate-pulse" : ""
          }`}
        >
          {remain}
        </p>
        <span className="mt-1.5 block h-0.5 rounded-full bg-primary/15 overflow-hidden">
          <span
            className={`block h-full rounded-full ${urgent ? "bg-amber-600" : "bg-primary"}`}
            style={{ width: `${progress.leftPct}%` }}
          />
        </span>
        <p className="text-[8px] font-black mt-1 whitespace-nowrap">{hint}</p>
      </div>
    </div>
  );
}
