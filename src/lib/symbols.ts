import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export interface Symbol {
  id: string;
  name: string;
  isForex: boolean;
}

export const DEFAULT_SYMBOLS = ["GC1!", "NQ1!", "ES1!", "BTCUSD", "EURUSD", "GBPUSD"];

export const symbolsQueryKey = ["symbols"] as const;

export async function fetchSymbols(): Promise<Symbol[]> {
  const { data, error } = await supabase
    .from("symbols")
    .select("id, name, is_forex")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    isForex: !!s.is_forex,
  }));
}

export async function insertSymbol(name: string, isForex = false): Promise<Symbol> {
  const trimmed = name.trim().toUpperCase();
  if (!trimmed) throw new Error("Symbol name is required");
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("symbols")
    .insert({ name: trimmed, user_id: u.user.id, is_forex: isForex })
    .select("id, name, is_forex")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error(`Symbol "${trimmed}" already exists`);
    throw error;
  }
  return {
    id: data.id,
    name: data.name,
    isForex: !!data.is_forex,
  };
}

export async function toggleForexSymbol(id: string, isForex: boolean): Promise<void> {
  const { error } = await supabase
    .from("symbols")
    .update({ is_forex: isForex })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Delete a symbol after verifying no trades or journal entries reference it
 * (matched by name, since current FKs are by string).
 */
export async function deleteSymbol(sym: Symbol): Promise<void> {
  const [{ count: tradeCount, error: tErr }, { count: biasCount, error: bErr }] = await Promise.all(
    [
      supabase.from("trades").select("id", { count: "exact", head: true }).eq("symbol", sym.name),
      supabase
        .from("journal_entries")
        .select("id", { count: "exact", head: true })
        .eq("asset", sym.name),
    ],
  );
  if (tErr) throw tErr;
  if (bErr) throw bErr;
  if ((tradeCount ?? 0) > 0 || (biasCount ?? 0) > 0) {
    throw new Error("Không thể xóa cặp tiền này vì đang có dữ liệu giao dịch liên quan");
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

export function getAssetIconUrl(asset: string): string | null {
  const symbol = asset.toUpperCase();
  if (symbol.includes("BTC")) return "https://s3-symbol-logo.tradingview.com/crypto/XTVCBTC.svg";
  if (symbol.includes("CL1!")) return "https://s3-symbol-logo.tradingview.com/crude-oil.svg";
  if (symbol.includes("DXY")) return "https://s3-symbol-logo.tradingview.com/indices/u-s-dollar-index.svg";
  if (symbol.includes("ES1!")) return "https://s3-symbol-logo.tradingview.com/indices/s-and-p-500.svg";
  if (symbol.includes("FDAX1!")) return "https://s3-symbol-logo.tradingview.com/indices/dax.svg";
  if (symbol.includes("GC1!")) return "https://s3-symbol-logo.tradingview.com/metal/gold.svg";
  if (symbol.includes("NQ1!")) return "https://s3-symbol-logo.tradingview.com/indices/nasdaq-100.svg";
  if (symbol.includes("SI1!")) return "https://s3-symbol-logo.tradingview.com/metal/silver.svg";
  if (symbol.includes("YM1!")) return "https://s3-symbol-logo.tradingview.com/indices/dow-30.svg";
  return null;
}
