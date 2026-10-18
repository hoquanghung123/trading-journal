// Shared by Edge Functions, UI, and node tests. No terminal control protocol exists.
export const NY_ZONE = "America/New_York";
export const DEFAULT_MT5_MAPPINGS: Record<string, string> = {
  US100: "NQ1!",
  US500: "ES1!",
  US30: "YM1!",
  XAUUSD: "GC1!",
  XAGUSD: "SI1!",
};
export interface OffsetRule {
  from: string;
  offsetMinutes: number;
}
export interface BrokerData {
  sourceSymbol: string;
  positionKey: string;
  sequence: string;
  status: "Opened" | "Closed";
  side: "buy" | "sell";
  entryTime: string;
  exitTime: string | null;
  entryPrice: number;
  exitPrice: number | null;
  volume: number;
  initialSl: number | null;
  initialTp: number | null;
  finalSl: number | null;
  finalTp: number | null;
  grossPnl: number;
  commission: number;
  swap: number;
  brokerFee: number;
  fees: number;
  netPnl: number;
  currency: string;
  accountLogin: string;
  server: string;
  brokerEntryTime: number;
  brokerExitTime: number | null;
  entryOffsetMinutes: number;
  exitOffsetMinutes: number | null;
  rKnown: false;
}
export function validateRules(value: unknown): OffsetRule[] {
  if (!Array.isArray(value) || !value.length || value.length > 100)
    throw new Error("Cần ít nhất một quy tắc giờ broker đã xác minh.");
  const rules = value
    .map((r) => {
      if (
        !r ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(r.from) ||
        !Number.isFinite(Date.parse(r.from + "Z")) ||
        !Number.isInteger(r.offsetMinutes) ||
        Math.abs(r.offsetMinutes) > 840
      )
        throw new Error("Quy tắc giờ broker không hợp lệ.");
      return { from: r.from, offsetMinutes: r.offsetMinutes };
    })
    .sort((a, b) => a.from.localeCompare(b.from));
  if (new Set(rules.map((r) => r.from)).size !== rules.length)
    throw new Error("Mốc thời gian bị trùng.");
  return rules;
}
export function brokerTime(seconds: number, rules: OffsetRule[]) {
  if (!Number.isFinite(seconds) || seconds < 946684800 || seconds > 4102444800)
    throw new Error("Giờ broker không hợp lệ.");
  const wall = new Date(seconds * 1000).toISOString().slice(0, 19);
  const rule = rules.filter((r) => r.from <= wall).at(-1);
  if (!rule)
    throw new Error("Thiếu quy tắc múi giờ cho " + wall + ". Bổ sung offset rồi để EA gửi lại.");
  return {
    iso: new Date((seconds - rule.offsetMinutes * 60) * 1000).toISOString(),
    offset: rule.offsetMinutes,
  };
}
function number(v: unknown, name: string, positive = false): number {
  if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 1e15 || (positive && v <= 0))
    throw new Error("Invalid " + name);
  return v;
}
function price(v: unknown, name: string): number | null {
  return v === null || v === 0 ? null : number(v, name, true);
}
export function normalizeSnapshot(
  raw: Record<string, unknown>,
  c: { account_login: string; server: string; offset_rules: unknown },
): BrokerData {
  if (raw.accountLogin !== c.account_login || raw.server !== c.server)
    throw new Error("Tài khoản/server không khớp kết nối.");
  if (
    typeof raw.positionKey !== "string" ||
    !/^\d+:\d+$/.test(raw.positionKey) ||
    typeof raw.sequence !== "string" ||
    !/^\d+$/.test(raw.sequence)
  )
    throw new Error("Invalid position identifier");
  if (
    typeof raw.sourceSymbol !== "string" ||
    !raw.sourceSymbol.length ||
    raw.sourceSymbol.length > 50 ||
    !["buy", "sell"].includes(String(raw.side)) ||
    !["Opened", "Closed"].includes(String(raw.status))
  )
    throw new Error("Invalid trade");
  if (typeof raw.currency !== "string" || !/^[A-Z]{3,8}$/.test(raw.currency))
    throw new Error("Invalid currency");
  const rules = validateRules(c.offset_rules),
    entry = brokerTime(number(raw.brokerEntryTime, "entry"), rules);
  const exit =
    raw.status === "Closed" ? brokerTime(number(raw.brokerExitTime, "exit"), rules) : null;
  if (exit && exit.iso < entry.iso)
    throw new Error("Giờ đóng trước giờ mở. Kiểm tra quy tắc giờ broker.");
  const commission = number(raw.commission, "commission"),
    swap = number(raw.swap, "swap"),
    brokerFee = number(raw.brokerFee, "fee"),
    grossPnl = number(raw.grossPnl, "profit");
  return {
    sourceSymbol: raw.sourceSymbol,
    positionKey: raw.positionKey,
    sequence: raw.sequence,
    status: raw.status as BrokerData["status"],
    side: raw.side as BrokerData["side"],
    entryTime: entry.iso,
    exitTime: exit?.iso ?? null,
    entryPrice: number(raw.entryPrice, "entry price", true),
    exitPrice: exit ? number(raw.exitPrice, "exit price", true) : null,
    volume: number(raw.volume, "volume", true),
    initialSl: price(raw.initialSl, "SL"),
    initialTp: price(raw.initialTp, "TP"),
    finalSl: exit ? price(raw.finalSl, "SL") : null,
    finalTp: exit ? price(raw.finalTp, "TP") : null,
    grossPnl,
    commission,
    swap,
    brokerFee,
    fees: -(commission + swap + brokerFee),
    netPnl: grossPnl + commission + swap + brokerFee,
    currency: raw.currency,
    accountLogin: c.account_login,
    server: c.server,
    brokerEntryTime: raw.brokerEntryTime as number,
    brokerExitTime: exit ? (raw.brokerExitTime as number) : null,
    entryOffsetMinutes: entry.offset,
    exitOffsetMinutes: exit?.offset ?? null,
    rKnown: false,
  };
}
export function nyDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NY_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
export function nyDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: NY_ZONE,
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(iso));
}
export function nyMidnight(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Ngày không hợp lệ");
  const target = Date.parse(day + "T00:00:00Z");
  let utc = target;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: NY_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utc));
    const p = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const represented = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    utc += target - represented;
  }
  if (nyDay(new Date(utc).toISOString()) !== day) throw new Error("Ngày không hợp lệ");
  return new Date(utc).toISOString();
}
export function historyWindow(from: string, to: string) {
  if (from > to) throw new Error("Ngày kết thúc phải sau ngày bắt đầu");
  const end = new Date(to + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 1);
  return { history_from: nyMidnight(from), history_to: nyMidnight(end.toISOString().slice(0, 10)) };
}
