// Run with PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node tests/mt5/database.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { PGlite } = await import(process.env.PGLITE_MODULE ?? "@electric-sql/pglite");
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated;
create table public.symbols(id uuid default gen_random_uuid(),user_id uuid,name text,unique(user_id,name));
create type public.trade_side as enum('buy','sell');
create table public.trades(id uuid primary key default gen_random_uuid(),user_id uuid,entry_time timestamptz,exit_time timestamptz,symbol text,side public.trade_side,status text,gross_pnl numeric,fees numeric,net_pnl numeric,actual_rr numeric,max_rr numeric,compliance_check boolean,notes text);
create function public.restore_single_system_version(version_id uuid) returns boolean language plpgsql as $$begin return true;end$$;
insert into auth.users values('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');`);
await db.exec(
  readFileSync(
    new URL("../../supabase/migrations/20261018025524_mt5_readonly_review.sql", import.meta.url),
    "utf8",
  ),
);
await db.exec(
  readFileSync(
    new URL(
      "../../supabase/migrations/20261018025718_mt5_review_symbol_watchlist.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.exec(
  readFileSync(
    new URL(
      "../../supabase/migrations/20261018025957_mt5_history_filter_null_guard.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
const user = "11111111-1111-1111-1111-111111111111",
  other = "22222222-2222-2222-2222-222222222222";
const [
  {
    rows: [c],
  },
] = await db.exec(
  `insert into mt5_connections(user_id,name,account_login,server,token_hash,offset_rules,created_at)values('${user}','test','123','demo','hash','[]','2026-10-01') returning id`,
);
const payload = {
  sourceSymbol: "US100",
  positionKey: "1:1",
  sequence: "10",
  status: "Opened",
  side: "buy",
  entryTime: "2026-10-17T13:30:00Z",
  exitTime: null,
  grossPnl: 0,
  fees: 0,
  netPnl: 0,
};
const stage = (p, f) =>
  db.query("select mt5_stage($1,$2,$3::jsonb,$4)", [c.id, "1:1", JSON.stringify(p), f]);
await stage(payload, "open");
assert.equal(
  (await db.query("select * from trades")).rows.length,
  0,
  "staging must not write trades",
);
await stage(payload, "open");
let r = (await db.query("select * from mt5_inbox")).rows[0];
assert.equal(r.revision, 1);
await assert.rejects(
  db.query("select mt5_review($1,$2,1,'approve',null,false)", [other, r.id]),
  /Not found/,
);
const review = (rev, action, symbol = null) =>
  db.query("select mt5_review($1,$2,$3,$4,$5,false)", [user, r.id, rev, action, symbol]);
await review(1, "approve");
let trade = (await db.query("select * from trades")).rows[0];
assert.equal(trade.symbol, "NQ1!");
assert.equal(trade.status, "Opened");
await db.query("update trades set notes='my review' where id=$1", [trade.id]);
await stage(
  {
    ...payload,
    status: "Closed",
    sequence: "20",
    exitTime: "2026-10-17T14:00:00Z",
    netPnl: 100,
    grossPnl: 100,
  },
  "closed",
);
assert.equal(
  (await db.query("select status from trades")).rows[0].status,
  "Opened",
  "close must wait for approval",
);
await assert.rejects(review(1, "approve"), /thay đổi/);
await review(2, "approve");
await review(2, "approve");
trade = (await db.query("select * from trades")).rows[0];
assert.equal(trade.status, "Closed");
assert.equal(trade.notes, "my review");
assert.equal((await db.query("select * from trades")).rows.length, 1);
await stage(payload, "stale-open");
assert.equal(
  (await db.query("select revision from mt5_inbox")).rows[0].revision,
  2,
  "stale open cannot regress closed",
);
// A full close arriving before review merges with its opening instead of creating two trades.
async function stageOther(key, p, fingerprint) {
  await db.query("select mt5_stage($1,$2,$3::jsonb,$4)", [
    c.id,
    key,
    JSON.stringify({ ...p, positionKey: key }),
    fingerprint,
  ]);
  return (await db.query("select * from mt5_inbox where position_key=$1", [key])).rows[0];
}
let merged = await stageOther("2:2", payload, "merge-open");
merged = await stageOther(
  "2:2",
  { ...payload, status: "Closed", sequence: "20", exitTime: "2026-10-17T14:00:00Z" },
  "merge-closed",
);
assert.equal(merged.revision, 2);
assert.equal(merged.state, "pending");
await Promise.all([
  db.query("select mt5_review($1,$2,2,'approve',null,false)", [user, merged.id]),
  db.query("select mt5_review($1,$2,2,'approve',null,false)", [user, merged.id]),
]);
assert.equal(
  (await db.query("select count(*)::int n from trades where mt5_inbox_id=$1", [merged.id])).rows[0]
    .n,
  1,
);
let ignored = await stageOther("3:3", payload, "ignore-open");
await db.query("select mt5_review($1,$2,1,'ignore',null,false)", [user, ignored.id]);
ignored = await stageOther("3:3", payload, "ignore-open");
assert.equal(ignored.state, "ignored");
ignored = await stageOther(
  "3:3",
  { ...payload, status: "Closed", sequence: "20", exitTime: "2026-10-17T14:00:00Z" },
  "ignore-close",
);
assert.equal(ignored.state, "pending");
const historical = {
  ...payload,
  status: "Closed",
  entryTime: "2026-09-15T13:00:00Z",
  exitTime: "2026-09-15T14:00:00Z",
};
assert.equal(
  await stageOther("4:4", historical, "history"),
  undefined,
  "out-of-range history excluded",
);
await db.query(
  "update mt5_connections set history_from='2026-09-01',history_to='2026-10-01' where id=$1",
  [c.id],
);
assert.equal((await stageOther("4:4", historical, "history")).state, "pending");
let unknown = await stageOther("5:5", { ...payload, sourceSymbol: "UNKNOWN" }, "unknown");
await assert.rejects(
  db.query("select mt5_review($1,$2,1,'approve',null,false)", [user, unknown.id]),
  /symbol/,
);
await db.query("select mt5_review($1,$2,1,'approve','CUSTOM!',true)", [user, unknown.id]);
assert.equal(
  (await db.query("select name from symbols where user_id=$1 and name='CUSTOM!'", [user])).rows
    .length,
  1,
);
assert.equal(
  (await db.query("select mappings->>'UNKNOWN' symbol from mt5_connections where id=$1", [c.id]))
    .rows[0].symbol,
  "CUSTOM!",
);
await db.exec(`set role authenticated;set request.jwt.claim.sub='${other}';`);
assert.equal((await db.query("select * from mt5_inbox")).rows.length, 0, "RLS isolates users");
await assert.rejects(db.query("select token_hash from mt5_connections"), /permission denied/);
await assert.rejects(db.query("delete from mt5_inbox"), /permission denied/);
await assert.rejects(review(2, "approve"), /permission denied/);
await db.exec("reset role;");
await db.query("update mt5_connections set revoked_at=now() where id=$1", [c.id]);
await assert.rejects(stage(payload, "x"), /revoked/);
await db.close();
console.log(
  "MT5 database integration tests passed: staging, approval, concurrency, dedupe, ownership, RLS, revocation.",
);
