import type { CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateId } from "./utils";
import { uploadToR2, deleteFromR2, proxyFetchImage } from "./storage";

export type Bias = "bullish" | "bearish" | "consolidation";
export type Session = "ASIA" | "LDN" | "NY" | "NY AM" | "NY PM";
export type SlotKind =
  | "monthly"
  | "weekly"
  | "daily"
  | "h4-ASIA"
  | "h4-LDN"
  | "h4-NY"
  | "h4-NY AM"
  | "h4-NY PM";

export const SPLIT_NY_ASSETS = ["ES1!", "YM1!", "NQ1!", "ES", "YM", "NQ"];

export function getSessionsForAsset(asset: string): Session[] {
  if (SPLIT_NY_ASSETS.includes(asset)) {
    return ["ASIA", "LDN", "NY AM", "NY PM"];
  }
  return ["ASIA", "LDN", "NY"];
}

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
      typeof h4?.["NY AM"] === "string" ? h4["NY AM"] : h4?.["NY AM"]?.img,
      typeof h4?.["NY PM"] === "string" ? h4["NY PM"] : h4?.["NY PM"]?.img,
    ].filter((p): p is string => !!p && !p.startsWith("data:") && !p.startsWith("http"));
    
    if (paths.length) {
      // 1. Dọn dẹp Supabase (Legacy)
      await supabase.storage
        .from("journal-charts")
        .remove(paths)
        .catch(() => {});
        
      // 2. Dọn dẹp Cloudflare R2 (New)
      for (const path of paths) {
        await deleteFromR2({ data: path }).catch(() => {});
      }
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
  if (b === "bullish") return "var(--bull)";
  if (b === "bearish") return "var(--destructive)";
  return "var(--warning)";
}

export function biasStyle(b: Bias): CSSProperties {
  const fg =
    b === "bullish"
      ? "var(--bull-foreground)"
      : b === "bearish"
        ? "var(--destructive-foreground)"
        : "var(--warning-foreground)";
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


/** Upload a data URL or File to Storage. Returns a public path stored in DB. */
export async function uploadChartImage(input: string | File): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");

  let base64: string;
  let contentType: string;
  let ext = "png";

  if (typeof input === "string" && input.startsWith("http")) {
    // Remote URL (e.g. TradingView) - Fetch on Server Side
    const result = await proxyFetchImage({ data: input });
    base64 = result.base64;
    contentType = result.contentType;
    ext = (contentType.split("/")[1] || "png").replace("jpeg", "jpg");
  } else if (typeof input === "string") {
    // data URL
    const m = input.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!m) throw new Error("Invalid image data");
    contentType = m[1];
    base64 = m[2];
    ext = contentType.split("/")[1].replace("jpeg", "jpg");
  } else {
    // File object
    contentType = input.type;
    ext = (contentType.split("/")[1] || "png").replace("jpeg", "jpg");
    base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(input);
    });
  }

  const path = `${u.user.id}/${generateId()}.${ext}`;

  await uploadToR2({
    data: {
      path,
      base64,
      contentType,
    },
  });

  return path;
}

/** Resolve a stored path into a proxy URL for display. */
export function getChartUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("data:") || path.startsWith("http")) return path;

  // Khi chạy local, trỏ thẳng về production để xem được ảnh từ R2
  if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    return `https://trading-journal-3di.pages.dev/storage/${path}`;
  }

  // Sử dụng Splat Route (/storage/$) làm Proxy trên Cloudflare
  return `/storage/${path}`;
}

export async function deleteChartImage(path?: string): Promise<void> {
  if (!path || path.startsWith("data:") || path.startsWith("http")) return;
  await deleteFromR2({ data: path });
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
/**
 * A "Prep Day" is defined as a day where at least one asset has:
 * Weekly Chart + Daily Chart + H4 Asian Session Chart.
 */
export function isPrepDay(entries: DayEntry[]): boolean {
  return entries.some((e) => !!e.weeklyImg && !!e.dailyImg && !!e.h4["ASIA"]?.img);
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  streakDays: string[]; // Dates that qualify as prep days
  isTodayComplete: boolean;
}

export function calculateStreak(allEntries: DayEntry[]): StreakStats {
  // 1. Group entries by date
  const byDate: Record<string, DayEntry[]> = {};
  allEntries.forEach((e) => {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });

  // 2. Identify all prep days (sorted by date)
  const sortedDates = Object.keys(byDate).sort();
  const prepDates = sortedDates.filter((d) => isPrepDay(byDate[d]));

  if (prepDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, streakDays: [], isTodayComplete: false };
  }

  // 3. Calculate longest streak
  let longest = 0;
  let currentCounter = 0;
  let lastDate: Date | null = null;

  const getDayDiff = (d1: Date, d2: Date) => {
    const t1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime();
    const t2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate()).getTime();
    return Math.round((t1 - t2) / (1000 * 60 * 60 * 24));
  };

  prepDates.forEach((dateStr) => {
    const currDate = new Date(dateStr + "T00:00:00");
    if (!lastDate) {
      currentCounter = 1;
    } else {
      const diff = getDayDiff(currDate, lastDate);
      if (diff === 1) {
        currentCounter++;
      } else if (diff > 1) {
        currentCounter = 1;
      }
    }
    longest = Math.max(longest, currentCounter);
    lastDate = currDate;
  });

  // 4. Calculate current streak (working backwards from today/last entry)
  const todayStr = new Date().toISOString().split("T")[0];
  const isTodayComplete = isPrepDay(byDate[todayStr] ?? []);

  let current = 0;
  const reversedPrepDates = [...prepDates].reverse();
  
  if (reversedPrepDates.length > 0) {
    let lastCheckedDate = new Date().toISOString().split("T")[0];
    const latestPrepDate = reversedPrepDates[0];
    
    // If the latest prep was today or yesterday, the streak is alive
    const diffLatest = getDayDiff(new Date(lastCheckedDate + "T00:00:00"), new Date(latestPrepDate + "T00:00:00"));
    
    if (diffLatest <= 1) {
      current = 1;
      for (let i = 0; i < reversedPrepDates.length - 1; i++) {
        const d1 = new Date(reversedPrepDates[i] + "T00:00:00");
        const d2 = new Date(reversedPrepDates[i + 1] + "T00:00:00");
        if (getDayDiff(d1, d2) === 1) {
          current++;
        } else {
          break;
        }
      }
    }
  }

  return {
    currentStreak: current,
    longestStreak: longest,
    streakDays: prepDates,
    isTodayComplete,
  };
}
