import { supabase } from "@/integrations/supabase/client";

export type TradeSide = "buy" | "sell";

export interface Trade {
  id: string;
  entryTime: string; // ISO
  symbol: string;
  side: TradeSide;
  grossPnl: number;
  fees: number;
  netPnl: number;
  actualRr: number;
  maxRr: number;
  beforeImg?: string;
  afterImg?: string;
  biasEntryId?: string;
  notes?: string;
}

type Row = {
  id: string;
  entry_time: string;
  symbol: string;
  side: TradeSide;
  gross_pnl: number;
  fees: number;
  net_pnl: number;
  actual_rr: number;
  max_rr: number;
  before_img: string | null;
  after_img: string | null;
  bias_entry_id: string | null;
  notes: string | null;
};

const fromRow = (r: Row): Trade => ({
  id: r.id,
  entryTime: r.entry_time,
  symbol: r.symbol,
  side: r.side,
  grossPnl: Number(r.gross_pnl),
  fees: Number(r.fees),
  netPnl: Number(r.net_pnl),
  actualRr: Number(r.actual_rr),
  maxRr: Number(r.max_rr),
  beforeImg: r.before_img ?? undefined,
  afterImg: r.after_img ?? undefined,
  biasEntryId: r.bias_entry_id ?? undefined,
  notes: r.notes ?? undefined,
});

const toRow = (t: Trade, userId: string) => ({
  id: t.id,
  user_id: userId,
  entry_time: t.entryTime,
  symbol: t.symbol,
  side: t.side,
  gross_pnl: t.grossPnl,
  fees: t.fees,
  net_pnl: t.netPnl,
  actual_rr: t.actualRr,
  max_rr: t.maxRr,
  before_img: t.beforeImg ?? null,
  after_img: t.afterImg ?? null,
  bias_entry_id: t.biasEntryId ?? null,
  notes: t.notes ?? null,
});

export async function fetchTrades(): Promise<Trade[]> {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .order("entry_time", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function upsertTrade(t: Trade): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");
  const { error } = await supabase.from("trades").upsert(toRow(t, u.user.id));
  if (error) throw error;
}

export async function deleteTrade(id: string): Promise<void> {
  const { data: row } = await supabase
    .from("trades")
    .select("before_img, after_img")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("trades").delete().eq("id", id);
  if (error) throw error;

  if (row) {
    const paths = [row.before_img, row.after_img].filter(
      (p): p is string => !!p && !p.startsWith("data:") && !p.startsWith("http"),
    );
    if (paths.length) {
      await supabase.storage.from("journal-charts").remove(paths).catch(() => {});
    }
  }
}

// ---- Outcome logic ----
export type OutcomeColor = "green" | "red" | "amber" | "yellow" | "blue";

export interface Outcome {
  label: string;
  color: OutcomeColor;
}

export function computeOutcome(actualRr: number, maxRr: number, netPnl: number): Outcome {
  if (actualRr > 0) {
    const ratio = maxRr > 0 ? actualRr / maxRr : 1;
    if (ratio >= 0.9) return { label: "🚀 Maximum Profit!", color: "green" };
    if (ratio >= 0.6) return { label: "✅ Great Exit!", color: "green" };
    return { label: "💰 Profit Taken", color: "green" };
  }
  if (actualRr < 0) {
    if (maxRr > 0) return { label: "💔 Winning Trade Turned Loser", color: "red" };
    return { label: "🔴 Loss, Review Setup", color: "red" };
  }
  // actualRr === 0
  if (maxRr > 0) {
    if (netPnl < 0) return { label: "⚠️ Winner to BE but Fees Lost", color: "amber" };
    return { label: "🟡 Winner to Breakeven", color: "yellow" };
  }
  if (netPnl < 0) return { label: "⚠️ Breakeven but Fees Lost", color: "amber" };
  return { label: "🔵 Capital Protected", color: "blue" };
}

export const outcomeStyle: Record<OutcomeColor, string> = {
  green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  red: "bg-red-500/15 text-red-400 border-red-500/40",
  amber: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  yellow: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40",
  blue: "bg-sky-500/15 text-sky-400 border-sky-500/40",
};

export const SYMBOLS = ["XAUUSD", "NQ", "ES", "BTCUSD", "EURUSD", "GBPUSD"];

export function newTrade(): Trade {
  return {
    id: crypto.randomUUID(),
    entryTime: new Date().toISOString(),
    symbol: "XAUUSD",
    side: "buy",
    grossPnl: 0,
    fees: 0,
    netPnl: 0,
    actualRr: 0,
    maxRr: 0,
  };
}
