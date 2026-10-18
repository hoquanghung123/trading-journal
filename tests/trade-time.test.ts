import test from "node:test";
import assert from "node:assert/strict";
import { toNyLocal, nyLocalToIso } from "../src/lib/trade-time";
test("NY inputs round-trip summer, winter and midnight independent of browser timezone", () => {
  for (const [local, iso] of [
    ["2026-07-15T09:30", "2026-07-15T13:30:00.000Z"],
    ["2026-01-15T09:30", "2026-01-15T14:30:00.000Z"],
    ["2026-10-18T00:00", "2026-10-18T04:00:00.000Z"],
  ]) {
    assert.equal(nyLocalToIso(local), iso);
    assert.equal(toNyLocal(iso), local);
  }
});
test("NY inputs handle DST boundaries and reject the missing spring hour", () => {
  assert.equal(nyLocalToIso("2026-03-08T03:30"), "2026-03-08T07:30:00.000Z");
  assert.throws(() => nyLocalToIso("2026-03-08T02:30"));
  assert.equal(nyLocalToIso("2026-11-01T01:30"), "2026-11-01T05:30:00.000Z");
  assert.equal(nyLocalToIso("2026-11-01T03:30"), "2026-11-01T08:30:00.000Z");
  assert.throws(() => nyLocalToIso("2026-02-30T09:30"));
});
