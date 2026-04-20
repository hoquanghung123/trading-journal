// Psychology Journal storage layer — backed by Supabase `psychology_logs`.
//
// Stores both daily check-ins (trade_id = null) and per-trade evaluations
// (trade_id = <trade.id>) in the same table, scoped per user via RLS.
//
// On first call, any legacy localStorage data is auto-migrated then cleared.

import { supabase } from "@/integrations/supabase/client";

export interface PsychologyLog {
  id: string;
  date: string; // YYYY-MM-DD
  tradeId: string | null;

  // Daily check-in (only meaningful when tradeId === null)
  morningMood?: string;
  morningNotes?: string;

  // Per-trade evaluation (only meaningful when tradeId !== null)
  preTradeEmotion?: string;
  entryRationale?: string;
  postTradeEmotion?: string;
  exitAssessment?: string;

  updatedAt: string;
}

type Row = {
  id: string;
  user_id: string;
  date: string;
  trade_id: string | null;
  morning_mood: string | null;
  morning_notes: string | null;
  pre_trade_emotion: string | null;
  entry_rationale: string | null;
  post_trade_emotion: string | null;
  exit_assessment: string | null;
  created_at: string;
  updated_at: string;
};

const TABLE = "psychology_logs";

const fromRow = (r: Row): PsychologyLog => ({
  id: r.id,
  date: r.date,
  tradeId: r.trade_id,
  morningMood: r.morning_mood ?? undefined,
  morningNotes: r.morning_notes ?? undefined,
  preTradeEmotion: r.pre_trade_emotion ?? undefined,
  entryRationale: r.entry_rationale ?? undefined,
  postTradeEmotion: r.post_trade_emotion ?? undefined,
  exitAssessment: r.exit_assessment ?? undefined,
  updatedAt: r.updated_at,
});

const toRow = (log: PsychologyLog, userId: string) => ({
  id: log.id,
  user_id: userId,
  date: log.date,
  trade_id: log.tradeId,
  morning_mood: log.morningMood ?? null,
  morning_notes: log.morningNotes ?? null,
  pre_trade_emotion: log.preTradeEmotion ?? null,
  entry_rationale: log.entryRationale ?? null,
  post_trade_emotion: log.postTradeEmotion ?? null,
  exit_assessment: log.exitAssessment ?? null,
});

// Lazy one-shot migration from old localStorage store
const LEGACY_KEY = "chartmate-psychology-logs-v1";
const MIGRATION_DONE_KEY = "chartmate-psychology-migrated-v1";
let migrationPromise: Promise<void> | null = null;

async function migrateLocalStorageOnce(userId: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATION_DONE_KEY)) return;
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) {
    localStorage.setItem(MIGRATION_DONE_KEY, "1");
    return;
  }
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) {
      localStorage.setItem(MIGRATION_DONE_KEY, "1");
      return;
    }
    const rows = arr
      .filter((r: any) => r && r.id && r.date)
      .map((r: any) => ({
        id: r.id,
        user_id: userId,
        date: r.date,
        trade_id: r.tradeId ?? null,
        morning_mood: r.morningMood ?? null,
        morning_notes: r.morningNotes ?? null,
        pre_trade_emotion: r.preTradeEmotion ?? null,
        entry_rationale: r.entryRationale ?? null,
        post_trade_emotion: r.postTradeEmotion ?? null,
        exit_assessment: r.exitAssessment ?? null,
      }));
    if (rows.length) {
      const { error } = await (supabase.from(TABLE) as any).upsert(rows, {
        onConflict: "id",
      });
      if (error) {
        console.warn("[psychology] migration failed:", error.message);
        return; // don't mark done — try again next session
      }
      console.info(`[psychology] migrated ${rows.length} rows from localStorage`);
    }
    localStorage.setItem(MIGRATION_DONE_KEY, "1");
    // Keep legacy key as a backup; users can clear manually.
  } catch (e) {
    console.warn("[psychology] migration parse error:", e);
  }
}

async function ensureMigrated(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id ?? null;
  if (!userId) return null;
  if (!migrationPromise) migrationPromise = migrateLocalStorageOnce(userId);
  await migrationPromise;
  return userId;
}

/* ---------------- Public API ---------------- */

export async function fetchPsychologyLogs(): Promise<PsychologyLog[]> {
  await ensureMigrated();
  const { data, error } = await (supabase.from(TABLE) as any)
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(fromRow);
}

export async function fetchPsychologyForDate(date: string): Promise<PsychologyLog[]> {
  await ensureMigrated();
  const { data, error } = await (supabase.from(TABLE) as any)
    .select("*")
    .eq("date", date);
  if (error) throw error;
  return ((data ?? []) as Row[]).map(fromRow);
}

export async function fetchPsychologyForTrade(tradeId: string): Promise<PsychologyLog | null> {
  await ensureMigrated();
  const { data, error } = await (supabase.from(TABLE) as any)
    .select("*")
    .eq("trade_id", tradeId)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as Row) : null;
}

export async function upsertPsychologyLog(log: PsychologyLog): Promise<void> {
  const userId = await ensureMigrated();
  if (!userId) throw new Error("Not authenticated");
  const { error } = await (supabase.from(TABLE) as any).upsert(toRow(log, userId), {
    onConflict: "id",
  });
  if (error) throw error;
}

export async function deletePsychologyLog(id: string): Promise<void> {
  const { error } = await (supabase.from(TABLE) as any).delete().eq("id", id);
  if (error) throw error;
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

/**
 * Trades are entered in New York local time. Given a trade's ISO `entry_time`
 * (UTC), return the YYYY-MM-DD string of that timestamp **as observed in NY**.
 */
const NY_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function toNyDateStr(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return NY_DATE_FMT.format(date);
}

export function todayNyDateStr(): string {
  return toNyDateStr(new Date());
}
