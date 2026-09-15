import { useEffect, useMemo, useState } from "react";
import type { Session } from "@/lib/journal";
import { getActiveKillzone } from "@/lib/journal";

const ORDER: Session[] = ["ASIA", "LDN", "NY"];

export function SessionChip() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const kz = useMemo(() => getActiveKillzone(new Date(now)), [now]);
  const activeGroup = kz.session.startsWith("NY") ? "NY" : kz.session;
  const mins = Math.max(0, Math.floor(kz.secondsUntilNext / 60));
  const hh = String(Math.floor(mins / 60)).padStart(2, "0");
  const mm = String(mins % 60).padStart(2, "0");

  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-card px-2 py-1.5 shrink-0">
      {ORDER.map((s) => {
        const on = s === activeGroup;
        return (
          <span
            key={s}
            className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider ${
              on ? "forest-gradient text-white" : "text-muted-foreground"
            }`}
          >
            {s}
          </span>
        );
      })}
      <span className="text-[10px] font-bold text-muted-foreground pl-1 whitespace-nowrap">
        {hh}:{mm} to {kz.next.startsWith("NY") ? "NY" : kz.next}
      </span>
    </div>
  );
}
