import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  brokerTime,
  validateRules,
  normalizeSnapshot,
  nyDay,
  nyDateTime,
  historyWindow,
  DEFAULT_MT5_MAPPINGS,
} from "../../src/lib/mt5/protocol.ts";
const rules = validateRules([
  { from: "2026-01-01T00:00:00", offsetMinutes: 120 },
  { from: "2026-03-08T09:00:00", offsetMinutes: 180 },
  { from: "2026-11-01T09:00:00", offsetMinutes: 120 },
]);
const wall = (s: string) => Date.parse(s + "Z") / 1000;
const connection = { account_login: "123", server: "Pepperstone-Demo", offset_rules: rules };
const raw = {
  accountLogin: "123",
  server: "Pepperstone-Demo",
  positionKey: "9007199254740993:9007199254740995",
  sequence: "1790000000000",
  sourceSymbol: "US100",
  side: "buy",
  status: "Closed",
  currency: "USD",
  brokerEntryTime: wall("2026-10-16T16:30:00"),
  brokerExitTime: wall("2026-10-16T17:00:00"),
  entryPrice: 25000,
  exitPrice: 25010,
  volume: 1,
  initialSl: 24990,
  initialTp: 25020,
  finalSl: 25000,
  finalTp: 25020,
  grossPnl: 10,
  commission: -2,
  swap: -1,
  brokerFee: -0.5,
};
test("Pepperstone summer and winter wall clocks map to correct UTC and New York", () => {
  assert.equal(brokerTime(wall("2026-10-16T16:30:00"), rules).iso, "2026-10-16T13:30:00.000Z");
  assert.match(nyDateTime("2026-10-16T13:30:00Z"), /09:30:00/);
  assert.equal(brokerTime(wall("2026-01-16T16:30:00"), rules).iso, "2026-01-16T14:30:00.000Z");
  assert.match(nyDateTime("2026-01-16T14:30:00Z"), /09:30:00/);
  assert.equal(nyDay("2026-10-17T02:30:00Z"), "2026-10-16");
});
test("New York history ranges include entire DST transition days", () => {
  const spring = historyWindow("2026-03-08", "2026-03-08");
  assert.equal(spring.history_from, "2026-03-08T05:00:00.000Z");
  assert.equal(spring.history_to, "2026-03-09T04:00:00.000Z");
  const fall = historyWindow("2026-11-01", "2026-11-01");
  assert.equal(Date.parse(fall.history_to) - Date.parse(fall.history_from), 25 * 3600000);
  assert.throws(() => historyWindow("2026-03-09", "2026-03-08"));
});
test("normalization preserves IDs and CFD prices, separates SL/TP, sums signed fees", () => {
  const b = normalizeSnapshot(raw, connection);
  assert.equal(b.positionKey, raw.positionKey);
  assert.equal(b.entryPrice, 25000);
  assert.equal(b.initialSl, 24990);
  assert.equal(b.finalSl, 25000);
  assert.equal(b.netPnl, 6.5);
  assert.equal(b.fees, 3.5);
  assert.equal(b.rKnown, false);
  assert.deepEqual(DEFAULT_MT5_MAPPINGS, {
    US100: "NQ1!",
    US500: "ES1!",
    US30: "YM1!",
    XAUUSD: "GC1!",
    XAGUSD: "SI1!",
  });
});
test("missing offsets, wrong account, malformed prices or dates fail closed", () => {
  assert.throws(() => normalizeSnapshot({ ...raw, accountLogin: "456" }, connection));
  assert.throws(() => normalizeSnapshot({ ...raw, entryPrice: NaN }, connection));
  assert.throws(() =>
    normalizeSnapshot({ ...raw, brokerExitTime: wall("2026-01-01T00:00:00") }, connection),
  );
  assert.throws(() => brokerTime(wall("2025-01-01T00:00:00"), rules));
  assert.throws(() => validateRules([]));
});
test("opened snapshots have no fabricated close data or zero SL/TP", () => {
  const b = normalizeSnapshot({ ...raw, status: "Opened", initialSl: 0, initialTp: 0 }, connection);
  assert.equal(b.exitTime, null);
  assert.equal(b.exitPrice, null);
  assert.equal(b.initialSl, null);
  assert.equal(b.finalTp, null);
});
test("EA contains no trading calls, imports, execution, or remote update mechanisms", () => {
  const ea = readFileSync(new URL("../../public/mt5/JournalReadOnly.mq5", import.meta.url), "utf8");
  assert.doesNotMatch(
    ea,
    /\b(OrderSend|OrderSendAsync|CTrade|OrderOpen|OrderDelete|PositionClose|PositionModify|ShellExecute|WinExec)\s*\(/,
  );
  assert.doesNotMatch(ea, /#import|#include/);
  assert.match(ea, /MQL_TRADE_ALLOWED/);
  assert.match(ea, /INIT_FAILED/);
  assert.match(ea, /"https:\/\/"/);
  assert.equal(
    readFileSync(new URL("../../src/lib/mt5/protocol.ts", import.meta.url), "utf8"),
    readFileSync(new URL("../../supabase/functions/mt5-sync/protocol.ts", import.meta.url), "utf8"),
  );
});
