import { useEffect, useMemo, useState } from "react";
import {
  type KillzoneChip,
  getActiveKillzone,
  killzoneChipGroup,
  nextKillzoneOpen,
} from "@/lib/journal";

const ORDER: KillzoneChip[] = ["ASIA", "LDN", "NY"];
const URGENT_SECS = 15 * 60;

function formatCountdown(seconds: number, next: ReturnType<typeof nextKillzoneOpen>) {
  const s = Math.max(0, Math.floor(seconds));
  const urgent = s < URGENT_SECS;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  let remain: string;
  if (urgent) {
    remain = m === 0 ? `${sec}s` : `${m}m ${String(sec).padStart(2, "0")}s`;
  } else if (h === 0) {
    remain = `${Math.max(1, m)}m`;
  } else {
    remain = `${h}h ${m}m`;
  }

  return { remain, label: `${remain} to ${next.name} open`, clock: next.clock, urgent };
}

interface Props {
  selected?: KillzoneChip | null;
  onSelect?: (chip: KillzoneChip) => void;
}

export function SessionChip({ selected, onSelect }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const kz = useMemo(() => getActiveKillzone(new Date(now)), [now]);
  const live = killzoneChipGroup(kz.session);
  const focused = selected ?? live;
  const urgent = kz.secondsUntilNext < URGENT_SECS;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), urgent ? 1_000 : 30_000);
    return () => window.clearInterval(id);
  }, [urgent]);

  const countdown = formatCountdown(kz.secondsUntilNext, nextKillzoneOpen(kz.next));

  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-card px-2 py-1.5 shrink-0">
      {ORDER.map((s) => {
        const isLive = s === live;
        const isFocus = s === focused && s !== live;
        return (
          <button
            key={s}
            type="button"
            aria-pressed={s === focused}
            onClick={() => onSelect?.(s)}
            className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider transition-colors ${
              isLive
                ? "forest-gradient text-white"
                : isFocus
                  ? "bg-primary/15 text-primary ring-2 ring-primary/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {s === "NY" && (kz.session === "NY AM" || kz.session === "NY PM")
              ? kz.session === "NY AM"
                ? "NY AM"
                : "NY PM"
              : s}
          </button>
        );
      })}
      <span
        className={`text-[10px] font-bold pl-1 whitespace-nowrap ${
          countdown.urgent ? "text-primary animate-pulse" : "text-muted-foreground"
        }`}
      >
        {countdown.label}
        <span className="hidden sm:inline"> · {countdown.clock} ET</span>
      </span>
    </div>
  );
}
