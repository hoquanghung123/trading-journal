import { supabase } from "@/integrations/supabase/client";

export type TradeSide = "buy" | "sell";
export type TradeStatus = "Not Started" | "Opened" | "Closed";

export type TradeOutcome = "Win" | "Loss" | "BE";

export interface Trade {
  id: string;
  entryTime: string; // ISO
  exitTime?: string; // ISO
  symbol: string;
  side: TradeSide;
  grossPnl: number;
  fees: number;
  netPnl: number;
  actualRr: number;
  maxRr: number;
  beforeImg?: string;
  afterImg?: string;
  monthlyImg?: string;
  weeklyImg?: string;
  dailyImg?: string;
  h4Img?: string;
  h1Img?: string;
  m15Img?: string;
  m5Img?: string;
  biasEntryId?: string;
  setupId?: string;
  complianceCheck: boolean;
  missedConfluences?: string[];
  notes?: string;
  status: TradeStatus;
  grade?: string;
}

type Row = {
  id: string;
  entry_time: string;
  exit_time: string | null;
  symbol: string;
  side: TradeSide;
  gross_pnl: number;
  fees: number;
  net_pnl: number;
  actual_rr: number;
  max_rr: number;
  before_img: string | null;
  after_img: string | null;
  monthly_img: string | null;
  weekly_img: string | null;
  daily_img: string | null;
  h4_img: string | null;
  h1_img: string | null;
  m15_img: string | null;
  m5_img: string | null;
  bias_entry_id: string | null;
  setup_id: string | null;
  compliance_check: boolean;
  missed_confluences: any;
  notes: string | null;
  status: string;
  grade: string | null;
};

const fromRow = (r: Row): Trade => ({
  id: r.id,
  entryTime: r.entry_time,
  exitTime: r.exit_time ?? undefined,
  symbol: r.symbol,
  side: r.side,
  grossPnl: Number(r.gross_pnl),
  fees: Number(r.fees),
  netPnl: Number(r.net_pnl),
  actualRr: Number(r.actual_rr),
  maxRr: Number(r.max_rr),
  beforeImg: r.before_img ?? undefined,
  afterImg: r.after_img ?? undefined,
  monthlyImg: r.monthly_img ?? undefined,
  weeklyImg: r.weekly_img ?? undefined,
  dailyImg: r.daily_img ?? undefined,
  h4Img: r.h4_img ?? undefined,
  h1Img: r.h1_img ?? undefined,
  m15Img: r.m15_img ?? undefined,
  m5Img: r.m5_img ?? undefined,
  biasEntryId: r.bias_entry_id ?? undefined,
  setupId: r.setup_id ?? undefined,
  complianceCheck: !!r.compliance_check,
  missedConfluences: r.missed_confluences ?? [],
  notes: r.notes ?? undefined,
  status: (r.status as TradeStatus) ?? "Not Started",
  grade: r.grade ?? undefined,
});

const toRow = (t: Trade, userId: string) => ({
  id: t.id,
  user_id: userId,
  entry_time: t.entryTime,
  exit_time: t.exitTime ?? null,
  symbol: t.symbol,
  side: t.side,
  gross_pnl: t.grossPnl,
  fees: t.fees,
  net_pnl: t.netPnl,
  actual_rr: t.actualRr,
  max_rr: t.maxRr,
  before_img: t.beforeImg ?? null,
  after_img: t.afterImg ?? null,
  monthly_img: t.monthlyImg ?? null,
  weekly_img: t.weeklyImg ?? null,
  daily_img: t.dailyImg ?? null,
  h4_img: t.h4Img ?? null,
  h1_img: t.h1Img ?? null,
  m15_img: t.m15Img ?? null,
  m5_img: t.m5Img ?? null,
  bias_entry_id: t.biasEntryId ?? null,
  setup_id: t.setupId ?? null,
  compliance_check: t.complianceCheck,
  missed_confluences: t.missedConfluences ?? [],
  status: t.status,
  notes: t.notes ?? null,
  grade: t.grade ?? null,
});

export async function fetchTrades(): Promise<Trade[]> {
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .order("entry_time", { ascending: false });
  if (error) throw error;
  return (data as unknown as Row[]).map(fromRow);
}

export async function upsertTrade(t: Trade): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");
  const { error } = await supabase.from("trades").upsert(toRow(t, u.user.id) as never);
  if (error) throw error;
}

export async function deleteTrade(id: string): Promise<void> {
  const { data: row } = await supabase
    .from("trades")
    .select("before_img, after_img, monthly_img, weekly_img, daily_img, h4_img, h1_img, m15_img, m5_img")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("trades").delete().eq("id", id);
  if (error) throw error;

  if (row) {
    const images = row as Record<string, string | null>;
    const paths = Object.values(images).filter(
      (p): p is string => !!p && !p.startsWith("data:") && !p.startsWith("http"),
    );
    if (paths.length) {
      await supabase.storage
        .from("journal-charts")
        .remove(paths)
        .catch(() => {});
    }
  }
}

// ---- Outcome logic ----
export type OutcomeColor = "green" | "red" | "amber" | "yellow" | "blue";

export interface Outcome {
  label: string;
  color: OutcomeColor;
}

export function computeOutcome(actualRr: number, _maxRr: number, _netPnl: number): Outcome {
  if (actualRr > 0) return { label: "Win", color: "green" };
  if (actualRr < 0) return { label: "Loss", color: "red" };
  return { label: "BE", color: "amber" };
}

export const outcomeStyle: Record<OutcomeColor, string> = {
  green: "bg-primary text-primary-foreground shadow-primary/20",
  red: "bg-destructive text-destructive-foreground shadow-destructive/20",
  amber: "bg-amber-500 text-white shadow-amber-500/20",
  blue: "bg-blue-500 text-white shadow-blue-500/20",
  yellow: "bg-yellow-500 text-white shadow-yellow-500/20",
};

export const tradesQueryKey = ["trades"] as const;

import { generateId } from "./utils";

export function newTrade(): Trade {
  return {
    id: generateId(),
    entryTime: new Date().toISOString(),
    exitTime: new Date().toISOString(),
    symbol: "XAUUSD",
    side: "buy",
    grossPnl: 0,
    fees: 0,
    netPnl: 0,
    actualRr: 0,
    maxRr: 0,
    complianceCheck: true,
    missedConfluences: [],
    status: "Not Started",
  };
}
