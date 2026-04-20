import { Brain } from "lucide-react";
import type { PsychologyLog } from "@/lib/psychology";

/** Compact inline badges for pre/post emotion + discipline score. */
export function PsychologyBadges({
  log,
  size = "sm",
  onClick,
}: {
  log: PsychologyLog | null | undefined;
  size?: "sm" | "md";
  onClick?: () => void;
}) {
  if (!log) return null;
  const has = log.preTradeEmotion || log.postTradeEmotion || log.disciplineScore != null;
  if (!has) return null;

  const text = size === "sm" ? "text-[9px]" : "text-[10px]";
  const pad = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-0.5";

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 align-middle"
      title="Psychology evaluation"
    >
      <Brain className="w-3 h-3 text-[#48C0D8]" />
      {log.preTradeEmotion && (
        <span className={`${pad} ${text} rounded border border-[#48C0D8]/40 bg-[#48C0D8]/10 text-[#48C0D8] tracking-wider`}>
          PRE: {log.preTradeEmotion.toUpperCase()}
        </span>
      )}
      {log.postTradeEmotion && (
        <span className={`${pad} ${text} rounded border border-purple-400/40 bg-purple-500/10 text-purple-300 tracking-wider`}>
          POST: {log.postTradeEmotion.toUpperCase()}
        </span>
      )}
      {log.disciplineScore != null && (
        <span
          className={`${pad} ${text} rounded border tracking-wider ${
            log.disciplineScore >= 7
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : log.disciplineScore >= 4
              ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
              : "border-red-500/40 bg-red-500/10 text-red-400"
          }`}
        >
          D {log.disciplineScore}/10
        </span>
      )}
    </button>
  );
}
