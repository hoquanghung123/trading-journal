import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalBiasStore } from "../scripts/local-bias-store";

test("local snapshots are immutable, durable and safe from path traversal", async () => {
  const directory = await mkdtemp(join(tmpdir(), "bias-store-"));
  try {
    const store = createLocalBiasStore(directory);
    const key = "bias-delivery/user/request/snapshot.json";
    const options = { httpMetadata: { contentType: "application/json" }, onlyIf: { etagDoesNotMatch: "*" } };
    await store.put(key, JSON.stringify({ notes: "Original" }), options);
    assert.equal(await store.put(key, JSON.stringify({ notes: "Changed" }), options), null);
    const restarted = createLocalBiasStore(directory);
    assert.deepEqual(await (await restarted.get(key))!.json(), { notes: "Original" });
    assert.equal(await restarted.get("missing"), null);
    await store.put("../../outside", new Uint8Array([1, 2, 3]), { httpMetadata: { contentType: "image/png" } });
    assert.deepEqual((await restarted.get("../../outside"))!.bytes, Buffer.from([1, 2, 3]));
    assert.equal((await restarted.get("../../outside"))!.contentType, "image/png");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
