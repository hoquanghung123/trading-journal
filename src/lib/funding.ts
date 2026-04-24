import { supabase } from "@/integrations/supabase/client";

export interface MonthlyFunding {
  id: string;
  monthKey: string; // YYYY-MM
  amount: number;
}

type Row = {
  id: string;
  month_key: string;
  amount: number;
};

const fromRow = (r: Row): MonthlyFunding => ({
  id: r.id,
  monthKey: r.month_key,
  amount: Number(r.amount),
});

const toRow = (f: Partial<MonthlyFunding>, userId: string) => ({
  user_id: userId,
  month_key: f.monthKey,
  amount: f.amount,
});

export async function fetchFunding(): Promise<MonthlyFunding[]> {
  const { data, error } = await supabase
    .from("monthly_funding")
    .select("*")
    .order("month_key", { ascending: true });
  
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function upsertFunding(f: Partial<MonthlyFunding>): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("monthly_funding")
    .upsert(toRow(f, u.user.id), { onConflict: "user_id, month_key" });
  
  if (error) throw error;
}

export async function deleteFunding(id: string): Promise<void> {
  const { error } = await supabase.from("monthly_funding").delete().eq("id", id);
  if (error) throw error;
}
