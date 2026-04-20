// Psychology Journal storage layer.
// Stores both daily check-ins (trade_id = null) and per-trade evaluations
// (trade_id = <trade>) under the same per-(user,date) day record concept.
//
// Backed by localStorage for now so the feature works immediately without a
// schema migration. Public API matches what an eventual Supabase-backed
// `psychology_logs` table would expose, so swapping the impl is a one-file change.

export interface PsychologyLog {
  id: string;
  date: string; // YYYY-MM-DD
  tradeId: string | null;

  // Daily check-in (only meaningful when tradeId === null)
  morningMood?: string;          // emoji or label
  energyLevel?: number;          // 1-5
  morningNotes?: string;
  nonTradingFactors?: string;
  endDaySummary?: string;
  dailyNarrative?: string;

  // Per-trade evaluation (only meaningful when tradeId !== null)
  preTradeEmotion?: string;      // single tag
  entryRationale?: string;
  postTradeEmotion?: string;
  exitAssessment?: string;
  disciplineScore?: number;      // 1-10
  emotionNotes?: string;
  mistakes?: string;

  updatedAt: string;
}

const KEY = "chartmate-psychology-logs-v1";

function readAll(): PsychologyLog[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(rows: PsychologyLog[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export async function fetchPsychologyLogs(): Promise<PsychologyLog[]> {
  return readAll();
}

export async function fetchPsychologyForDate(date: string): Promise<PsychologyLog[]> {
  return readAll().filter((r) => r.date === date);
}

export async function fetchPsychologyForTrade(tradeId: string): Promise<PsychologyLog | null> {
  return readAll().find((r) => r.tradeId === tradeId) ?? null;
}

export async function upsertPsychologyLog(log: PsychologyLog): Promise<void> {
  const rows = readAll();
  const idx = rows.findIndex((r) => r.id === log.id);
  const stamped = { ...log, updatedAt: new Date().toISOString() };
  if (idx >= 0) rows[idx] = stamped;
  else rows.push(stamped);
  writeAll(rows);
}

export async function deletePsychologyLog(id: string): Promise<void> {
  writeAll(readAll().filter((r) => r.id !== id));
}

export function newDailyLog(date: string): PsychologyLog {
  return {
    id: crypto.randomUUID(),
    date,
    tradeId: null,
    updatedAt: new Date().toISOString(),
  };
}

export function newTradeLog(date: string, tradeId: string): PsychologyLog {
  return {
    id: crypto.randomUUID(),
    date,
    tradeId,
    updatedAt: new Date().toISOString(),
  };
}

export const MOOD_OPTIONS = ["😐", "😡", "🤔", "🙂", "😊", "🤩"];
export const PRE_EMOTIONS = ["FOMO", "Confidence", "Patience", "Anxiety", "Calm", "Greedy"];
export const POST_EMOTIONS = ["Greed", "Fear", "Disappointment", "Pride", "Relief", "Frustration"];

export function toLocalDateStr(d: Date): string {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
