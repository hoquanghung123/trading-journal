import type { CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateId } from "./utils";

export type Bias = "bullish" | "bearish" | "consolidation";
export type Session = "ASIA" | "LDN" | "NY" | "NY AM" | "NY PM";
export type SlotKind = "monthly" | "weekly" | "daily" | "h4-ASIA" | "h4-LDN" | "h4-NY" | "h4-NY AM" | "h4-NY PM";

export interface DayEntry {
  id: string;
  date: string; // YYYY-MM-DD
  asset: string;
  weeklyImg?: string;
  weeklyBias: Bias;
  weeklyCorrect: boolean;
  yearlyImg?: string;
  yearlyBias: Bias;
  monthlyImg?: string;
  monthlyBias: Bias;
  monthlyCorrect: boolean;
  dailyImg?: string;
  dailyBias: Bias;
  dailyCorrect: boolean;
  h4: Record<string, { img?: string; bias?: Bias }>;
  notes?: string;
}

export const ASSETS = ["GC1!", "NQ1!", "ES1!", "BTCUSD", "EURUSD", "GBPUSD"];

// ---- Row mapping ----
type Row = {
  id: string;
  date: string;
  asset: string;
  weekly_img: string | null;
  weekly_bias: Bias;
  weekly_correct: boolean;
  yearly_img: string | null;
  yearly_bias: Bias;
  monthly_img: string | null;
  monthly_bias: Bias;
  monthly_correct: boolean;
  daily_img: string | null;
  daily_bias: Bias;
  daily_correct: boolean;
  h4: any;
  notes: string | null;
};

const parseH4 = (val: any) => {
  if (!val || typeof val !== "object") return {};
  const res: DayEntry["h4"] = {};
  for (const s of ["ASIA", "LDN", "NY", "NY AM", "NY PM"] as const) {
    const v = val[s];
    if (typeof v === "string") res[s] = { img: v };
    else if (v && typeof v === "object") res[s] = { img: v.img, bias: v.bias };
  }
  return res;
};

const fromRow = (r: Row): DayEntry => ({
  id: r.id,
  date: r.date,
  asset: r.asset,
  weeklyImg: r.weekly_img ?? undefined,
  weeklyBias: r.weekly_bias,
  weeklyCorrect: r.weekly_correct,
  yearlyImg: r.yearly_img ?? undefined,
  yearlyBias: r.yearly_bias ?? "consolidation",
  monthlyImg: r.monthly_img ?? undefined,
  monthlyBias: r.monthly_bias,
  monthlyCorrect: r.monthly_correct,
  dailyImg: r.daily_img ?? undefined,
  dailyBias: r.daily_bias,
  dailyCorrect: r.daily_correct,
  h4: parseH4(r.h4),
  notes: r.notes ?? undefined,
});

const toRow = (e: DayEntry, userId: string) => ({
  id: e.id,
  user_id: userId,
  date: e.date,
  asset: e.asset,
  weekly_img: e.weeklyImg ?? null,
  weekly_bias: e.weeklyBias,
  weekly_correct: e.weeklyCorrect,
  yearly_img: e.yearlyImg ?? null,
  yearly_bias: e.yearlyBias,
  monthly_img: e.monthlyImg ?? null,
  monthly_bias: e.monthlyBias,
  monthly_correct: e.monthlyCorrect,
  daily_img: e.dailyImg ?? null,
  daily_bias: e.dailyBias,
  daily_correct: e.dailyCorrect,
  h4: e.h4 ?? {},
  notes: e.notes ?? null,
});

export async function fetchEntries(): Promise<DayEntry[]> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function upsertEntry(e: DayEntry): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");
  const { error } = await supabase.from("journal_entries").upsert(toRow(e, u.user.id));
  if (error) throw error;
}

export async function deleteEntry(id: string): Promise<void> {
  // Fetch the row first so we can clean up its images from Storage.
  const { data: row } = await supabase
    .from("journal_entries")
    .select("yearly_img, monthly_img, weekly_img, daily_img, h4")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("journal_entries").delete().eq("id", id);
  if (error) throw error;

  if (row) {
    const h4 = (row.h4 ?? {}) as any;
    const paths = [
      row.yearly_img,
      row.monthly_img, 
      row.weekly_img, 
      row.daily_img, 
      typeof h4?.ASIA === "string" ? h4.ASIA : h4?.ASIA?.img,
      typeof h4?.LDN === "string" ? h4.LDN : h4?.LDN?.img,
      typeof h4?.NY === "string" ? h4.NY : h4?.NY?.img,
    ].filter(
      (p): p is string => !!p && !p.startsWith("data:") && !p.startsWith("http"),
    );
    if (paths.length) {
      await supabase.storage
        .from(BUCKET)
        .remove(paths)
        .catch(() => {});
    }
  }
}

// ---- Helpers ----
export function weekdayOf(date: string): string {
  const d = new Date(date + "T00:00:00");
  return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getDay()];
}

export function ddmm(date: string): string {
  const d = new Date(date + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function uid() {
  return generateId();
}

export function biasBgHex(b: Bias) {
  if (b === "bullish") return "var(--primary)";
  if (b === "bearish") return "var(--destructive)";
  return "var(--warning)";
}

export function biasStyle(b: Bias): CSSProperties {
  const fg = b === "bullish" ? "var(--primary-foreground)" : b === "bearish" ? "var(--destructive-foreground)" : "var(--warning-foreground)";
  return {
    backgroundColor: biasBgHex(b),
    color: fg,
    borderRadius: "6px",
    fontWeight: "800",
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  };
}

export function biasColor(_b: Bias) {
  // Kept for backwards compat; styling now driven by biasStyle().
  return "";
}

export function biasLabel(b: Bias) {
  return b === "bullish" ? "BULL" : b === "bearish" ? "BEAR" : "CONS";
}

export async function imageFromClipboard(e: ClipboardEvent): Promise<string | null> {
  const items = e.clipboardData?.items;
  if (!items) return null;
  for (const it of items) {
    if (it.type.startsWith("image/")) {
      const file = it.getAsFile();
      if (!file) continue;
      return await fileToDataURL(file);
    }
  }
  return null;
}

export function fileToDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

const BUCKET = "journal-charts";

/** Upload a data URL or File to Storage. Returns a public path stored in DB. */
export async function uploadChartImage(input: string | File): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");

  let blob: Blob;
  let ext = "png";

  if (typeof input === "string" && input.startsWith("http")) {
    // Remote URL
    const response = await fetch(input);
    if (!response.ok) throw new Error("Failed to fetch image from URL");
    blob = await response.blob();
    ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
  } else if (typeof input === "string") {
    // data URL
    const m = input.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!m) throw new Error("Invalid image data");
    const mime = m[1];
    ext = mime.split("/")[1].replace("jpeg", "jpg");
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    blob = new Blob([bytes], { type: mime });
  } else {
    blob = input;
    ext = (input.type.split("/")[1] || "png").replace("jpeg", "jpg");
  }

  const path = `${u.user.id}/${generateId()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Resolve a stored path into a proxy URL for display. */
export function getChartUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("data:") || path.startsWith("http")) return path;

  // Sử dụng Splat Route (/storage/$) làm Proxy
  // Cách này tương thích 100% với Cloudflare Pages và TanStack Start
  return `/storage/${path}`;
}

export async function deleteChartImage(path?: string): Promise<void> {
  if (!path || path.startsWith("data:") || path.startsWith("http")) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

/**
 * Resolve a TradingView snapshot URL to a direct image URL.
 * Example: https://www.tradingview.com/x/mlUOYC1G/ -> https://s3.tradingview.com/snapshots/m/mlUOYC1G.png
 */
export function resolveTradingViewUrl(url: string): string | null {
  const match = url.match(/tradingview\.com\/x\/([a-zA-Z0-9]+)\/?/);
  if (!match) return null;
  const id = match[1];
  const prefix = id[0].toLowerCase();
  return `https://s3.tradingview.com/snapshots/${prefix}/${id}.png`;
}
