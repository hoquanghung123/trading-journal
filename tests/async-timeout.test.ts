import test from "node:test";
import assert from "node:assert/strict";
import { withTimeout } from "../src/lib/async-timeout";
test("never-settling requests release the caller with an actionable error", async () => {
  await assert.rejects(
    withTimeout(new Promise<never>(() => {}), 10, "Tải ảnh quá lâu"),
    /Tải ảnh quá lâu/,
  );
});
test("successful writes and original errors propagate", async () => {
  assert.equal(await withTimeout(Promise.resolve("saved"), 1000, "timeout"), "saved");
  const failure = new Error("database rejected");
  await assert.rejects(withTimeout(Promise.reject(failure), 1000, "timeout"), (e) => e === failure);
});
test("a timed-out request can settle later without an unhandled rejection", async () => {
  let reject!: (error: Error) => void;
  const operation = new Promise<never>((_, r) => {
    reject = r;
  });
  await assert.rejects(withTimeout(operation, 10, "timeout"), /timeout/);
  reject(new Error("late failure"));
  await new Promise((resolve) => setTimeout(resolve, 10));
});
