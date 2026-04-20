// Psychology Journal storage — backed by Supabase `psychology_logs` table.
//
// One daily-only record per (user, date) when trade_id IS NULL.
// One record per (user, trade) when trade_id IS NOT NULL.
//
// NOTE: `psychology_logs` is created via migration; until the generated
// `Database` types are refreshed we cast the table call to `any`.
import { supabase } from "@/integrations/supabase/client";

export interface PsychologyLog {
  id: string;
  date: string; // YYYY-MM-DD
  tradeId: string | null;

  // Daily check-in (only meaningful when tradeId === null)
  morningMood?: string;
  energyLevel?: number; // 1-5
  morningNotes?: string;
  nonTradingFactors?: string;
  endDaySummary?: string;
  dailyNarrative?: string;

  // Per-trade evaluation (only meaningful when tradeId !== null)
  preTradeEmotion?: string;
  entryRationale?: string;
  postTradeEmotion?: string;
  exitAssessment?: string;
  disciplineScore?: number; // 1-10
  emotionNotes?: string;
  mistakes?: string;

  updatedAt: string;
}

type Row = {
  id: string;
  date: string;
  trade_id: string | null;
  morning_mood: string | null;
  energy_level: number | null;
  morning_notes: string | null;
  non_trading_factors: string | null;
  daily_narrative: string | null;
  end_day_summary: string | null;
  pre_trade_emotion: string | null;
  entry_rationale: string | null;
  post_trade_emotion: string | null;
  exit_assessment: string | null;
  discipline_score: number | null;
  emotion_notes: string | null;
  mistakes: string | null;
  updated_at: string;
};

const fromRow = (r: Row): PsychologyLog => ({
  id: r.id,
  date: r.date,
  tradeId: r.trade_id,
  morningMood: r.morning_mood ?? undefined,
  energyLevel: r.energy_level ?? undefined,
  morningNotes: r.morning_notes ?? undefined,
  nonTradingFactors: r.non_trading_factors ?? undefined,
  dailyNarrative: r.daily_narrative ?? undefined,
  endDaySummary: r.end_day_summary ?? undefined,
  preTradeEmotion: r.pre_trade_emotion ?? undefined,
  entryRationale: r.entry_rationale ?? undefined,
  postTradeEmotion: r.post_trade_emotion ?? undefined,
  exitAssessment: r.exit_assessment ?? undefined,
  disciplineScore: r.discipline_score ?? undefined,
  emotionNotes: r.emotion_notes ?? undefined,
  mistakes: r.mistakes ?? undefined,
  updatedAt: r.updated_at,
});

const toRow = (log: PsychologyLog, userId: string) => ({
  id: log.id,
  user_id: userId,
  date: log.date,
  trade_id: log.tradeId,
  morning_mood: log.morningMood ?? null,
  energy_level: log.energyLevel ?? null,
  morning_notes: log.morningNotes ?? null,
  non_trading_factors: log.nonTradingFactors ?? null,
  daily_narrative: log.dailyNarrative ?? null,
  end_day_summary: log.endDaySummary ?? null,
  pre_trade_emotion: log.preTradeEmotion ?? null,
  entry_rationale: log.entryRationale ?? null,
  post_trade_emotion: log.postTradeEmotion ?? null,
  exit_assessment: log.exitAssessment ?? null,
  discipline_score: log.disciplineScore ?? null,
  emotion_notes: log.emotionNotes ?? null,
  mistakes: log.mistakes ?? null,
});

// Cast helper — table is created via migration, types regenerate after.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = () => (supabase as any).from("psychology_logs");

export async function fetchPsychologyLogs(): Promise<PsychologyLog[]> {
  const { data, error } = await tbl()
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function fetchPsychologyForDate(date: string): Promise<PsychologyLog[]> {
  const { data, error } = await tbl().select("*").eq("date", date);
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function fetchPsychologyForTrade(tradeId: string): Promise<PsychologyLog | null> {
  const { data, error } = await tbl()
    .select("*")
    .eq("trade_id", tradeId)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as Row) : null;
}

export async function upsertPsychologyLog(log: PsychologyLog): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");

  // Use the natural-key conflict target so daily records and per-trade records
  // each get a deterministic row regardless of the local id we generated.
  const conflictTarget = log.tradeId
    ? "user_id,trade_id"
    : "user_id,date";

  const { error } = await tbl()
    .upsert(toRow(log, u.user.id), { onConflict: conflictTarget });
  if (error) throw error;
}

export async function deletePsychologyLog(id: string): Promise<void> {
  const { error } = await tbl().delete().eq("id", id);
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
