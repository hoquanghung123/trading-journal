import test from "node:test";
import assert from "node:assert/strict";
import {
  timelineDay,
  timelinePeriod,
  shiftTimelinePeriod,
  timelinePerformance,
} from "../src/lib/trade-timeline";
import type { Trade } from "../src/lib/trades";

test("timeline uses UTC+7 at midnight and Monday–Sunday weeks", () => {
  assert.equal(timelineDay("2026-10-18T16:59:59Z"), "2026-10-18");
  assert.equal(timelineDay("2026-10-18T17:00:00Z"), "2026-10-19");
  assert.equal(timelinePeriod("2026-10-18", "week").start, "2026-10-12");
  assert.equal(timelinePeriod("2026-10-18", "week").end, "2026-10-18");
  assert.equal(timelinePeriod("2026-10-19", "week").start, "2026-10-19");
});
test("months and navigation handle leap years and year boundaries", () => {
  assert.equal(timelinePeriod("2028-02-29", "month").days.length, 29);
  assert.equal(timelinePeriod("2027-02-28", "month").days.length, 28);
  assert.equal(timelinePeriod("2026-12-31", "week").end, "2027-01-03");
  assert.equal(shiftTimelinePeriod("2026-12-31", "month", 1), "2027-01-01");
  assert.equal(shiftTimelinePeriod("2027-01-01", "month", -1), "2026-12-01");
  assert.equal(shiftTimelinePeriod("2027-01-01", "week", -1), "2026-12-25");
});
test("performance excludes drafts, open trades, and unknown broker R; BE is excluded from win-rate denominator", () => {
  const result = timelinePerformance([
    { status: "Closed", actualRr: 2, netPnl: 100 },
    { status: "Opened", actualRr: 99, netPnl: 999 },
    { status: "Not Started", actualRr: 99, netPnl: 999 },
    { status: "Closed", actualRr: -1, netPnl: -50 },
    { status: "Closed", actualRr: 0, netPnl: 0 },
    { status: "Closed", actualRr: 0, netPnl: 10, brokerData: { rKnown: false } },
  ] as Trade[]);
  assert.deepEqual(result, { r: 1, known: 3, closed: 4, pnl: 60, winRate: 50 });
  assert.deepEqual(timelinePerformance([]), { r: 0, known: 0, closed: 0, pnl: 0, winRate: null });
});

test("zero Actual R stays BE in win rate despite positive or negative P&L", () => {
  const result = timelinePerformance([
    { status: "Closed", actualRr: 0, netPnl: -3 },
    { status: "Closed", actualRr: 0, netPnl: -5, brokerData: { rKnown: false } },
    { status: "Closed", actualRr: 0, netPnl: 4, brokerData: { rKnown: false } },
  ] as Trade[]);
  assert.equal(result.winRate, null);
  assert.equal(result.pnl, -4);
});
