import { supabase } from "@/integrations/supabase/client";
import { generateId } from "./utils";
import { deleteChartImage } from "./journal";
import type { Database } from "@/integrations/supabase/types";

export const MISS_REASONS = [
  "Không có mặt",
  "Thấy quá muộn",
  "Do dự",
  "Chờ thêm xác nhận",
  "Lệnh chờ không khớp",
  "Lỗi kỹ thuật",
  "Khác",
] as const;
export type MissedTrade = Database["public"]["Tables"]["missed_trades"]["Row"];
export const missedTradesQueryKey = ["missed-trades"] as const;
export function newMissedTrade(): MissedTrade {
  return {
    id: generateId(),
    user_id: "",
    setup_time: new Date().toISOString(),
    symbol: "",
    side: "buy",
    setup_id: null,
    reason: "Do dự",
    analysis: "",
    lesson: "",
    planned_entry: null,
    planned_sl: null,
    planned_tp: null,
    hypothetical_r: null,
    before_img: "",
    after_img: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
export async function fetchMissedTrades(): Promise<MissedTrade[]> {
  const { data, error } = await supabase
    .from("missed_trades")
    .select("*")
    .order("setup_time", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function saveMissedTrade(trade: MissedTrade) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Vui lòng đăng nhập để lưu trade.");
  const { error } = await supabase.from("missed_trades").upsert({ ...trade, user_id: user.id });
  if (error) throw error;
}
export async function deleteMissedTrade(trade: MissedTrade) {
  const { error } = await supabase.from("missed_trades").delete().eq("id", trade.id);
  if (error) throw error;
  await Promise.allSettled(
    [trade.before_img, trade.after_img].filter((p): p is string => !!p).map(deleteChartImage),
  );
}
