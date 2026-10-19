import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, createHash, randomUUID } from "node:crypto";
import { biasTradingDate, canonicalJournalMessage, normalizeChartSource } from "../src/lib/bias-contract";
import { executeBiasHomework } from "../src/lib/bias-homework.server";

const userId = "a902f33a-fb42-4f1c-a72a-2530e8ac8bc0";
const entryId = "37e4fac2-7745-4d0d-a32f-1146eb8be191";
const secret = "integration-test-secret-at-least-32-characters";
const request = () => new Request("https://trading.hibacsi.com/_serverFn/test", { headers: { Authorization: "Bearer test-session" } });

function fixture(options: { receipt?: boolean; missing?: boolean; unauthorized?: boolean; redirectLms?: boolean; image?: boolean; failDelivery?: boolean; failBeforeDelivery?: boolean } = {}) {
  const originalFetch = globalThis.fetch;
  const calls: { url: string; body: any }[] = [];
  const archived = new Map<string, Uint8Array | string>();
  let deliveries = 0;
  let notes = "Original analysis";
  let lastReceipt: any = options.receipt ? { id: 12, request_id: "existing", status: "pending", version: 1, url: "https://lms.example/bias/12" } : null;
  const env: Record<string, any> = {
    LMS_BIAS_ENABLED: "true", LMS_BIAS_SECRET: secret, LMS_BIAS_URL: "https://lms.example",
    SUPABASE_URL: "https://supabase.example", SUPABASE_PUBLISHABLE_KEY: "test-anon",
    R2: { head: async (path: string) => archived.has(path), get: async (path: string) => archived.has(path) ? { json: async () => JSON.parse(archived.get(path) as string) } : null, put: async (path: string, bytes: Uint8Array | string) => { archived.set(path, bytes); } },
  };
  globalThis.fetch = async (input, init) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url);
    if (url.pathname === "/auth/v1/user") return Response.json(options.unauthorized ? { message: "invalid token" } : { id: userId, email: "student@example.test", aud: "authenticated", role: "authenticated" }, { status: options.unauthorized ? 401 : 200 });
    if (url.pathname === "/rest/v1/journal_entries") {
      assert.equal(url.searchParams.get("user_id"), `eq.${userId}`);
      assert.equal(url.searchParams.get("date"), `eq.${biasTradingDate()}`);
      assert.ok(url.searchParams.get("id")?.includes(entryId));
      return Response.json(options.missing ? [] : [{ id: entryId, user_id: userId, date: biasTradingDate(), asset: "GC1!", weekly_bias: "consolidation", daily_bias: "consolidation", notes, daily_img: options.image ? `${userId}/daily.png` : null, h4: options.image ? {"NY AM": { bias: "bullish", img: `${userId}/ny.png` }} : {} }]);
    }
    if (url.hostname === "trading.hibacsi.com" && url.pathname.startsWith("/storage/")) return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } });
    assert.equal(url.hostname, "lms.example");
    assert.equal(req.redirect, "manual");
    if (options.redirectLms) return new Response(null, { status: 302, headers: { Location: "https://other.example/" } });
    const bodyText = await req.text();
    const body = JSON.parse(bodyText);
    assert.equal(body.journal_user_id, userId);
    const message = canonicalJournalMessage("POST", url.pathname, req.headers.get("X-Journal-Timestamp")!, req.headers.get("X-Journal-Nonce")!, createHash("sha256").update(bodyText).digest("hex"));
    assert.equal(req.headers.get("X-Journal-Signature"), createHmac("sha256", secret).update(message).digest("hex"));
    calls.push({ url: url.pathname, body });
    if (url.pathname.endsWith("/status")) return Response.json({ linked: true, active: true, coach_name: "Coach", submission: lastReceipt, receipt: body.request_id ? lastReceipt : null });
    if (url.pathname.endsWith("/submissions")) {
      deliveries++;
      if (options.failBeforeDelivery && deliveries === 1) throw new Error("LMS unavailable before accepting");
      lastReceipt = { id: 12, request_id: body.request_id, status: "pending", version: 1, url: "https://lms.example/bias/12" };
      if (options.failDelivery) throw new Error("Response lost after LMS saved");
      return Response.json({ submission: lastReceipt });
    }
    return Response.json({ linked: true });
  };
  return { env, calls, archived, setNotes: (value: string) => { notes = value; }, deliveries: () => deliveries, restore: () => { globalThis.fetch = originalFetch; } };
}

test("New York trading dates match summer/winter rollover and DST changes", () => {
  for (const [time, expected] of [
    ["2026-07-01T20:59:00Z", "2026-07-01"], ["2026-07-01T21:00:00Z", "2026-07-02"],
    ["2026-12-01T21:59:00Z", "2026-12-01"], ["2026-12-01T22:00:00Z", "2026-12-02"],
    ["2026-03-08T21:00:00Z", "2026-03-09"], ["2026-11-01T22:00:00Z", "2026-11-02"],
  ]) assert.equal(biasTradingDate(new Date(time)), expected);
});

test("chart sources must be owned paths or supported TradingView snapshots", () => {
  assert.equal(normalizeChartSource(`${userId}/daily.png`, userId, "https://trading.hibacsi.com"), `https://trading.hibacsi.com/storage/${userId}/daily.png`);
  for (const value of ["https://127.0.0.1/secret", "https://evil.test/chart", "other-user/chart.png", `${userId}/../private`, "https://user@s3.tradingview.com/snapshots/a.png"]) {
    assert.throws(() => normalizeChartSource(value, userId, "https://trading.hibacsi.com"));
  }
});

test("disabled integration does not read accounts or contact external services", async () => {
  const result = await executeBiasHomework({ action: "status" }, request(), { LMS_BIAS_ENABLED: "false" });
  assert.equal(result.enabled, false);
});

test("authenticated submission reads own current entries and copies charts before delivery", async () => {
  const f = fixture({ image: true });
  try {
    const requestId = randomUUID();
    const result = await executeBiasHomework({ action: "submit", requestId, entryIds: [entryId] }, request(), f.env);
    assert.equal(result.submission?.id, 12);
    assert.equal(f.deliveries(), 1);
    assert.equal(f.archived.size, 3);
    const entry = f.calls.find((c) => c.url.endsWith("/submissions"))!.body.entries[0];
    assert.equal(entry.notes, "Original analysis");
    assert.equal(entry.daily_bias, "consolidation");
    assert.ok(entry.daily_img.includes(`/bias-submissions/${requestId}/`));
    const decodedPath = decodeURIComponent(new URL(entry.h4["NY AM"].img).pathname.slice("/storage/".length));
    assert.ok(f.archived.has(decodedPath));
    assert.equal(entry.daily_correct, undefined);
  } finally { f.restore(); }
});

test("lost response retries recover the saved receipt without resubmitting", async () => {
  const f = fixture({ failDelivery: true });
  const data = { action: "submit" as const, requestId: randomUUID(), entryIds: [entryId] };
  try {
    await assert.rejects(executeBiasHomework(data, request(), f.env), /Chưa nhận được xác nhận/);
    const result = await executeBiasHomework(data, request(), f.env);
    assert.equal(result.submission?.id, 12);
    assert.equal(f.deliveries(), 1);
  } finally { f.restore(); }
});

test("unowned or unsaved entries never reach the submission endpoint", async () => {
  const f = fixture({ missing: true });
  try {
    await assert.rejects(executeBiasHomework({ action: "submit", requestId: randomUUID(), entryIds: [entryId] }, request(), f.env), /chưa lưu/);
    assert.equal(f.deliveries(), 0);
  } finally { f.restore(); }
});

test("retry before acceptance preserves prepared content when journal notes change", async () => {
  const f = fixture({ failBeforeDelivery: true });
  const data = { action: "submit" as const, requestId: randomUUID(), entryIds: [entryId] };
  try {
    await assert.rejects(executeBiasHomework(data, request(), f.env), /Chưa nhận được xác nhận/);
    f.setNotes("Changed after first attempt");
    await executeBiasHomework(data, request(), f.env);
    const attempts = f.calls.filter((call) => call.url.endsWith("/submissions"));
    assert.equal(attempts.length, 2);
    assert.deepEqual(attempts[0].body, attempts[1].body);
    assert.equal(attempts[1].body.entries[0].notes, "Original analysis");
  } finally { f.restore(); }
});

test("local submissions use signed loopback chart URLs and retain retry snapshots", async () => {
  const f = fixture({ image: true });
  f.env.LOCAL_BIAS_STORE = f.env.R2;
  delete f.env.R2;
  f.env.LMS_BIAS_LOCAL_ARCHIVE_URL = "http://127.0.0.1:5173";
  try {
    const requestId = randomUUID();
    const result = await executeBiasHomework({ action: "submit", requestId, entryIds: [entryId] }, request(), f.env);
    assert.ok(result.submission);
    const payload = f.calls.find((call) => call.url.endsWith("/submissions"))!.body;
    const url = new URL(payload.entries[0].daily_img);
    assert.equal(url.origin, "http://127.0.0.1:5173");
    const path = decodeURIComponent(url.pathname.slice("/local-bias-chart/".length));
    assert.equal(url.searchParams.get("signature"), createHmac("sha256", secret).update(path).digest("hex"));
    assert.ok(f.archived.has(`bias-delivery/${userId}/${requestId}/snapshot.json`));
  } finally { f.restore(); }
});

test("successful account linking returns the configured LMS homework page", async () => {
  const f = fixture();
  try {
    const result = await executeBiasHomework({ action: "link", code: "a".repeat(24) }, request(), f.env);
    assert.equal(result.linked, true);
    assert.equal(result.return_url, "https://lms.example/dashboard/homework/bias");
    assert.deepEqual(f.calls.map((call) => call.url), ["/api/trading-journal/link", "/api/trading-journal/status"]);
    const status = await executeBiasHomework({ action: "status" }, request(), f.env);
    assert.equal(status.return_url, undefined);
  } finally { f.restore(); }
});

test("invalid Supabase sessions cannot link or submit", async () => {
  const f = fixture({ unauthorized: true });
  try {
    await assert.rejects(executeBiasHomework({ action: "link", code: "a-long-link-code" }, request(), f.env), /đăng nhập hết hạn/);
    assert.equal(f.calls.length, 0);
  } finally { f.restore(); }
});

test("LMS redirects are rejected without forwarding signed requests", async () => {
  const f = fixture({ redirectLms: true });
  try {
    await assert.rejects(executeBiasHomework({ action: "status" }, request(), f.env), /API LMS đang chuyển hướng/);
    assert.equal(f.calls.length, 0);
  } finally { f.restore(); }
});

test("R2 missing-key access denials are verified through listing before preparing a submission", async () => {
  const f = fixture({ image: true });
  const store = f.env.R2;
  const get = store.get;
  const head = store.head;
  store.get = async (path: string) => {
    if (!f.archived.has(path)) throw new Error("get: Access Denied (10003)");
    return get(path);
  };
  store.head = async (path: string) => {
    if (!f.archived.has(path)) throw new Error("head: Access Denied (10003)");
    return head(path);
  };
  store.list = async ({ prefix }: { prefix: string }) => ({ objects: [...f.archived.keys()].filter((key) => key.startsWith(prefix)).sort().slice(0, 1).map((key) => ({ key })) });
  try {
    const result = await executeBiasHomework({ action: "submit", requestId: randomUUID(), entryIds: [entryId] }, request(), f.env);
    assert.ok(result.submission);
    assert.equal(f.deliveries(), 1);
    assert.equal(f.archived.size, 3);
  } finally { f.restore(); }
});

test("R2 denial of an existing snapshot does not permit a replacement submission", async () => {
  const f = fixture();
  f.env.R2.get = async () => { throw new Error("get: Access Denied (10003)"); };
  f.env.R2.list = async ({ prefix }: { prefix: string }) => ({ objects: [{ key: prefix }] });
  try {
    await assert.rejects(executeBiasHomework({ action: "submit", requestId: randomUUID(), entryIds: [entryId] }, request(), f.env), /Access Denied/);
    assert.equal(f.deliveries(), 0);
    assert.equal(f.archived.size, 0);
  } finally { f.restore(); }
});
