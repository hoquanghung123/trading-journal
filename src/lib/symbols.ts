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
  const { error } = await supabase.from("symbols").update({ is_forex: isForex }).eq("id", id);
  if (error) throw error;
}

export async function countSymbolUsage(name: string): Promise<{ trades: number; biasDays: number }> {
  const [{ count: tradeCount, error: tErr }, { count: biasCount, error: bErr }] = await Promise.all([
    supabase.from("trades").select("id", { count: "exact", head: true }).eq("symbol", name),
    supabase.from("journal_entries").select("id", { count: "exact", head: true }).eq("asset", name),
  ]);
  if (tErr) throw tErr;
  if (bErr) throw bErr;
  return { trades: tradeCount ?? 0, biasDays: biasCount ?? 0 };
}

/**
 * Delete a symbol after verifying no trades or journal entries reference it
 * (matched by name, since current FKs are by string).
 */
export async function deleteSymbol(sym: Symbol): Promise<void> {
  const { trades, biasDays } = await countSymbolUsage(sym.name);
  if (trades > 0 || biasDays > 0) {
    throw new Error(`Still on ${trades} trades / ${biasDays} bias days — remove those first.`);
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

/** TV ticker families → journal watchlist names. */
const ASSET_ALIAS_GROUPS: string[][] = [
  ["GC1!", "GC", "XAUUSD", "XAU", "GOLD"],
  ["SI1!", "SI", "XAGUSD", "XAG", "SILVER"],
  ["BTCUSD", "BTCUSDT", "BTC"],
  ["NQ1!", "NQ", "NAS100", "US100", "NDX", "NASDAQ"],
  ["ES1!", "ES", "SPX", "SP500", "SPX500"],
  ["YM1!", "YM", "US30", "DJ30", "DJI"],
  ["CL1!", "CL", "WTI", "USOIL"],
  ["DXY", "DX", "DX1!", "DOLLAR"],
  ["FDAX1!", "FDAX", "DAX", "GER40"],
  ["EURUSD", "EUR"],
  ["GBPUSD", "GBP"],
];

/** Strip exchange prefix (`COMEX:GC1!`) and `.P` (`BTCUSDT.P`). */
export function canonicalizeAssetTicker(raw: string): string {
  let s = raw.trim().toUpperCase().replace(/\s/g, "");
  const colon = s.lastIndexOf(":");
  if (colon >= 0) s = s.slice(colon + 1);
  if (s.endsWith(".P")) s = s.slice(0, -2);
  return s;
}

/**
 * Map a TradingView symbol onto a name in `allowed` (watchlist + today's entries).
 * Returns null when nothing matches — caller must not create a ghost asset.
 */
export function normalizeJournalAsset(raw: string, allowed: string[]): string | null {
  if (!raw || allowed.length === 0) return null;
  const input = canonicalizeAssetTicker(raw);
  const canonAllowed = allowed.map((name) => ({ name, key: canonicalizeAssetTicker(name) }));

  const exact = canonAllowed.find((a) => a.key === input);
  if (exact) return exact.name;

  const group = ASSET_ALIAS_GROUPS.find((g) => g.includes(input));
  if (!group) return null;
  const hit = canonAllowed.find((a) => group.includes(a.key));
  return hit?.name ?? null;
}

export function getAssetIconUrl(asset: string): string | null {
  const symbol = asset.toUpperCase();
  if (symbol.startsWith("BTC")) return "https://s3-symbol-logo.tradingview.com/crypto/XTVCBTC.svg";
  if (symbol.startsWith("CL")) return "https://s3-symbol-logo.tradingview.com/crude-oil.svg";
  if (symbol.startsWith("DXY") || symbol.startsWith("DX"))
    return "https://s3-symbol-logo.tradingview.com/indices/u-s-dollar-index.svg";
  if (symbol.startsWith("ES") || symbol.includes("SPX"))
    return "https://s3-symbol-logo.tradingview.com/indices/s-and-p-500.svg";
  if (symbol.startsWith("FDAX") || symbol.startsWith("DAX"))
    return "https://s3-symbol-logo.tradingview.com/indices/dax.svg";
  if (symbol.startsWith("GC") || symbol.startsWith("XAU"))
    return "https://s3-symbol-logo.tradingview.com/metal/gold.svg";
  if (symbol.startsWith("NQ") || symbol.startsWith("NAS") || symbol.startsWith("US100"))
    return "https://s3-symbol-logo.tradingview.com/indices/nasdaq-100.svg";
  if (symbol.startsWith("SI") || symbol.startsWith("XAG"))
    return "https://s3-symbol-logo.tradingview.com/metal/silver.svg";
  if (symbol.startsWith("YM") || symbol.startsWith("US30"))
    return "https://s3-symbol-logo.tradingview.com/indices/dow-30.svg";
  return null;
}

const FX_CCY = ["EUR", "GBP", "AUD", "NZD", "USD", "CAD", "CHF", "JPY"] as const;

/** Six-letter pairs of known currencies land on the FX desk; everything else on Bias. */
export function guessIsForex(raw: string): boolean {
  const n = raw.toUpperCase().replace(/[^A-Z]/g, "");
  const a = n.slice(0, 3);
  const b = n.slice(3);
  return (
    n.length === 6 &&
    (FX_CCY as readonly string[]).includes(a) &&
    (FX_CCY as readonly string[]).includes(b)
  );
}

export function aliasesForSymbol(name: string): string[] {
  const key = canonicalizeAssetTicker(name);
  const upper = name.toUpperCase();
  const group = ASSET_ALIAS_GROUPS.find((g) => g.includes(key) || g.includes(upper));
  if (!group) return [];
  return group.filter((a) => a !== key && a !== upper);
}

export function kindLabelForAsset(name: string, isForex: boolean): string {
  if (isForex) return "FX pair";
  const s = name.toUpperCase();
  if (s.startsWith("GC") || s.startsWith("XAU") || s.startsWith("SI") || s.startsWith("XAG")) {
    return "Metals";
  }
  if (s.startsWith("CL")) return "Energy";
  if (s.startsWith("BTC")) return "Crypto";
  return "Index";
}

export function assetMarkLetters(name: string): string {
  return name.replace(/[^A-Z]/g, "").slice(0, 3) || "FX";
}
