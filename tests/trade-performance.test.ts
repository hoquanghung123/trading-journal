import test from "node:test";
import assert from "node:assert/strict";
import { tradeWinRate } from "../src/lib/trade-performance";

test("win rate divides wins by wins plus losses, excluding BE", () => {
  assert.ok(Math.abs(tradeWinRate([2, 1, -1, 0, 0].map(actualRr => ({ actualRr })))! - 200 / 3) < 1e-10);
  assert.equal(tradeWinRate([{ actualRr: 1 }, { actualRr: 0 }]), 100);
  assert.equal(tradeWinRate([{ actualRr: -1 }, { actualRr: 0 }]), 0);
});

test("no decided trades has no win rate", () => {
  assert.equal(tradeWinRate([]), null);
  assert.equal(tradeWinRate([{ actualRr: 0 }]), null);
});
