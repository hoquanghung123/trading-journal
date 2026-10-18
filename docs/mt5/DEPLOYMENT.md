# MT5 deployment and verification

Apply the `mt5_readonly_review`, `mt5_review_symbol_watchlist`, and `mt5_history_filter_null_guard` migrations in order, then deploy `mt5-sync` and `mt5-manage`. Both gateway JWT checks are disabled intentionally: sync authenticates its SHA-256 hashed 256-bit integration token, manage explicitly validates a Supabase user JWT with auth.getUser. Never expose service-role credentials to the browser or EA.

The two protocol.ts copies must remain identical (enforced by tests). `mt5_stage` and `mt5_review` are SECURITY INVOKER, restricted to service_role. Authenticated users can SELECT only their own inbox/connection metadata, never token_hash. EA endpoint never calls review. All management writes are owner-checked. Revoke serializes with staging/review through connection row locks. There are no foreign keys from trades to inbox so existing temporal restore's delete/reinsert behavior stays supported; the unique inbox identity survives in restored trade snapshots.

`backup-database` includes connections/inbox before trades; redeploy it with the new source if using that Edge Function. Existing full pg_dump backups already include these tables. Backups contain token hashes, never raw tokens. EA source and compiled binary are served as public static assets. The attached EA is installed by the user, not remotely attached to a trading account.

Checks:

```sh
node --experimental-strip-types --test tests/mt5/protocol.test.ts
PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node tests/mt5/database.mjs
npx tsc --noEmit
deno check supabase/functions/mt5-sync/index.ts supabase/functions/mt5-manage/index.ts
npm run build:dev
```

PGlite is a temporary test runtime, not an application dependency. The SQL harness verifies the migration and real Postgres functions/permissions in an isolated database. For compilation, use installed MetaEditor `/compile:<absolute-windows-path> /log:<absolute-windows-path>` and inspect its log for zero errors/warnings. Do not attach the EA or operate a live account during build verification.

Manual demo acceptance checklist is in `public/mt5/README.md`. Server offset schedules are explicit operator configuration; do not infer historic offsets from the Mac's present timezone. Backend response configuration is limited to a scan UUID and timestamp floor; it cannot express terminal actions. Polling stops while the app is closed; pending items remain persisted and appear when reopened. No OS push notifications are implemented.
