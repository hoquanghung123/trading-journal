import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface Symbol {
  id: string;
  name: string;
}

export const DEFAULT_SYMBOLS = ["XAUUSD", "NQ", "ES", "BTCUSD", "EURUSD", "GBPUSD"];

export const symbolsQueryKey = ["symbols"] as const;

export async function fetchSymbols(): Promise<Symbol[]> {
  const { data, error } = await supabase
    .from("symbols")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Symbol[];
}

export async function insertSymbol(name: string): Promise<Symbol> {
  const trimmed = name.trim().toUpperCase();
  if (!trimmed) throw new Error("Symbol name is required");
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("symbols")
    .insert({ name: trimmed, user_id: u.user.id })
    .select("id, name")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error(`Symbol "${trimmed}" already exists`);
    throw error;
  }
  return data as Symbol;
}

/**
 * Delete a symbol after verifying no trades or journal entries reference it
 * (matched by name, since current FKs are by string).
 */
export async function deleteSymbol(sym: Symbol): Promise<void> {
  const [{ count: tradeCount, error: tErr }, { count: biasCount, error: bErr }] = await Promise.all([
    supabase.from("trades").select("id", { count: "exact", head: true }).eq("symbol", sym.name),
    supabase.from("journal_entries").select("id", { count: "exact", head: true }).eq("asset", sym.name),
  ]);
  if (tErr) throw tErr;
  if (bErr) throw bErr;
  if ((tradeCount ?? 0) > 0 || (biasCount ?? 0) > 0) {
    throw new Error(
      "Không thể xóa cặp tiền này vì đang có dữ liệu giao dịch liên quan",
    );
  }
  const { error } = await supabase.from("symbols").delete().eq("id", sym.id);
  if (error) throw error;
}

export async function seedDefaultSymbolsIfEmpty(): Promise<void> {
  const existing = await fetchSymbols();
  if (existing.length > 0) return;
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return;
  const rows = DEFAULT_SYMBOLS.map((name) => ({ name, user_id: u.user!.id }));
  await supabase.from("symbols").insert(rows);
}

export function useSymbols() {
  return useQuery({
    queryKey: symbolsQueryKey,
    queryFn: async () => {
      await seedDefaultSymbolsIfEmpty();
      return fetchSymbols();
    },
    staleTime: 60_000,
  });
}
