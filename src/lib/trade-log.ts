import { tradeWinRate } from "./trade-performance";
import { type Trade, type TradeStatus } from "@/lib/trades";
import { getActiveKillzone, KILLZONE_NY } from "@/lib/journal";

export type TradeLogView = "timeline" | "tape" | "ledger" | "tickets" | "killzone";
export type TradeKillzoneLane = "ASIA" | "LDN" | "NY";

export const TRADE_LOG_VIEWS: { id: TradeLogView; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "tape", label: "Tape" },
  { id: "ledger", label: "Ledger" },
  { id: "tickets", label: "Tickets" },
  { id: "killzone", label: "Killzone" },
];

export function normalizeTradeLogView(raw?: string | null): TradeLogView {
  if (raw === "timeline") return "timeline";
  if (raw === "ledger" || raw === "table") return "ledger";
  if (raw === "tape") return "tape";
  if (raw === "tickets" || raw === "gallery") return "tickets";
  if (raw === "killzone") return "killzone";
  return "timeline";
}

const nyParts = (iso: string, opts: Intl.DateTimeFormatOptions) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York",
    hour12: false,
    ...opts,
  })
    .formatToParts(new Date(iso))
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
  if (parts.hour === "24") parts.hour = "00";
  return parts;
};

export function formatNyDateTime(iso: string) {
  const p = nyParts(iso, {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

export function formatNyClock(iso: string) {
  const p = nyParts(iso, { hour: "2-digit", minute: "2-digit" });
  return `${p.hour}:${p.minute}`;
}

export function formatNyStamp(iso: string) {
  const p = nyParts(iso, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return `${p.day} ${p.month} ${p.hour}:${p.minute}`;
}

export function formatPnl(n: number) {
  if (n === 0) return "—";
  return formatSigned(n);
}

export function liveKillzoneLane(now = new Date()): TradeKillzoneLane {
  const session = getActiveKillzone(now).session;
  if (session === "ASIA") return "ASIA";
  if (session === "LDN") return "LDN";
  return "NY";
}

export function shortKillzoneSymbol(symbol: string) {
  const s = symbol.replace(/USD$/i, "").replace(/!$/, "");
  return s.length > 4 ? s.slice(0, 4) : s;
}

export function formatNyDayKey(iso: string) {
  const p = nyParts(iso, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}

export function formatNyDayLabel(iso: string) {
  const p = nyParts(iso, { weekday: "short", day: "2-digit", month: "short" });
  return `${p.weekday} ${p.day} ${p.month}`;
}

export function nyMinutes(iso: string) {
  const p = nyParts(iso, { hour: "2-digit", minute: "2-digit" });
  return Number(p.hour) * 60 + Number(p.minute);
}

export function notesExcerpt(html?: string, max = 88) {
  if (!html) return "";
  const text = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function tradeStatusClass(status: TradeStatus) {
  if (status === "Not Started") return "bg-muted text-muted-foreground";
  if (status === "Opened") return "bg-primary text-primary-foreground shadow-primary/20";
  return "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300";
}

export function tradeKillzoneLane(iso: string): TradeKillzoneLane {
  const session = getActiveKillzone(new Date(iso)).session;
  if (session === "ASIA") return "ASIA";
  if (session === "LDN") return "LDN";
  return "NY";
}

export function killzoneStamp(iso: string) {
  const session = getActiveKillzone(new Date(iso)).session;
  if (session === "LDN") return "LONDON";
  return session;
}

/** 8–92% along the lane so chips stay inside. */
export function lanePositionPct(iso: string, lane: TradeKillzoneLane) {
  const m = nyMinutes(iso);
  const clamp = (n: number) => Math.min(92, Math.max(8, n));
  if (lane === "ASIA") {
    const elapsed = m >= KILLZONE_NY.ASIA_OPEN ? m - KILLZONE_NY.ASIA_OPEN : m + 6 * 60;
    return clamp((elapsed / (8 * 60)) * 100);
  }
  if (lane === "LDN") {
    return clamp(((m - KILLZONE_NY.LDN_OPEN) / (6 * 60)) * 100);
  }
  return clamp(((m - KILLZONE_NY.NY_OPEN) / (10 * 60)) * 100);
}

export function formatSigned(n: number, digits = 2) {
  const abs = Math.abs(n).toFixed(digits);
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs}`;
  return abs;
}

export interface FilterPulse {
  count: number;
  pnl: number;
  winRate: number;
  avgR: number;
  followed: number;
}

export function computeFilterPulse(trades: Trade[]): FilterPulse {
  const count = trades.length;
  if (!count) return { count: 0, pnl: 0, winRate: 0, avgR: 0, followed: 0 };
  const pnl = trades.reduce((s, t) => s + t.netPnl, 0);
  const knownR = trades.filter(t => !t.brokerData || t.brokerData.rKnown || t.actualRr !== 0);
  const avgR = knownR.length ? knownR.reduce((s, t) => s + t.actualRr, 0) / knownR.length : 0;
  const followed = trades.filter((t) => t.complianceCheck).length;
  return { count, pnl, winRate: tradeWinRate(trades) ?? 0, avgR, followed };
}

export const MTF_SLOTS: { key: keyof Trade; label: string }[] = [
  { key: "monthlyImg", label: "MN" },
  { key: "weeklyImg", label: "W" },
  { key: "dailyImg", label: "D" },
  { key: "h4Img", label: "H4" },
  { key: "h1Img", label: "H1" },
  { key: "m15Img", label: "M15" },
  { key: "m5Img", label: "M5" },
];

export const gradeStyle: Record<string, string> = {
  "A+": "bg-primary text-primary-foreground shadow-primary/20",
  A: "bg-warning text-warning-foreground shadow-warning/20",
  B: "bg-destructive text-destructive-foreground shadow-destructive/20",
};
