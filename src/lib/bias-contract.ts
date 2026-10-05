/** Match Journal's 17:00 New York rollover, including daylight saving time. */
export function biasTradingDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const day = new Date(Date.UTC(value("year"), value("month") - 1, value("day") + (value("hour") >= 17 ? 1 : 0)));
  return day.toISOString().slice(0, 10);
}

export function canonicalJournalMessage(method: string, path: string, timestamp: string, nonce: string, bodyHash: string): string {
  return [method, path, timestamp, nonce, bodyHash].join("\n");
}

export function normalizeChartSource(value: string, userId: string, journalUrl: string, supabaseUrl?: string): string {
  if (!value) return "";
  if (value.startsWith("https://")) {
    const url = new URL(value);
    const origin = new URL(journalUrl).origin;
    if (url.username || url.password || url.port) throw new Error("Nguồn chart không được hỗ trợ.");
    if (url.origin === origin && url.pathname.startsWith(`/storage/${userId}/`)) return url.toString();
    const legacyPrefix = `/storage/v1/object/public/journal-charts/${userId}/`;
    if (supabaseUrl && url.origin === new URL(supabaseUrl).origin && url.pathname.startsWith(legacyPrefix)) {
      return `${origin}/storage/${userId}/${url.pathname.slice(legacyPrefix.length)}`;
    }
    if (url.hostname === "s3.tradingview.com" && url.pathname.startsWith("/snapshots/")) return url.toString();
    throw new Error("Chart phải thuộc tài khoản của bạn hoặc là ảnh TradingView.");
  }
  if (!value.startsWith(`${userId}/`) || value.includes("..") || value.includes("\\")) throw new Error("Đường dẫn chart không hợp lệ.");
  return `${new URL(journalUrl).origin}/storage/${value.split("/").map(encodeURIComponent).join("/")}`;
}
