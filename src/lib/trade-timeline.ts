import { tradeWinRate } from "./trade-performance";
import type { Trade } from "./trades";

type TimelineTrade = Trade & { brokerData?: { rKnown: boolean } };

export const TIMELINE_ZONE = "Asia/Ho_Chi_Minh";
export function timelineDay(iso: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMELINE_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const p = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function dayDate(key: string) {
  return new Date(`${key}T00:00:00Z`);
}
export function addTimelineDays(key: string, amount: number) {
  const d = dayDate(key);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function timelinePeriod(anchor: string, mode: "week" | "month") {
  const d = dayDate(anchor);
  const start =
    mode === "week"
      ? addTimelineDays(anchor, -((d.getUTCDay() + 6) % 7))
      : `${anchor.slice(0, 7)}-01`;
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  const end = mode === "week" ? addTimelineDays(start, 6) : last.toISOString().slice(0, 10);
  const days: string[] = [];
  for (let k = start; k <= end; k = addTimelineDays(k, 1)) days.push(k);
  return { start, end, days };
}
export function shiftTimelinePeriod(anchor: string, mode: "week" | "month", delta: number) {
  if (mode === "week") return addTimelineDays(anchor, delta * 7);
  const d = dayDate(anchor);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1))
    .toISOString()
    .slice(0, 10);
}
export function timelinePerformance(trades: TimelineTrade[]) {
  const closed = trades.filter((t) => t.status === "Closed");
  const known = closed.filter((t) => !t.brokerData || t.brokerData.rKnown || t.actualRr !== 0);
  return {
    r: known.reduce((s, t) => s + t.actualRr, 0),
    known: known.length,
    closed: closed.length,
    pnl: closed.reduce((s, t) => s + t.netPnl, 0),
    winRate: tradeWinRate(closed),
  };
}
