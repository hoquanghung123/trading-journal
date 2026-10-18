# MT5 integration verification

Verified on 2026-10-18:

- MetaEditor on this Mac compiled `JournalReadOnly.mq5`: **0 errors, 0 warnings**. Source and compiled `.ex5` are in `public/mt5/`.
- Six protocol tests passed: New York EST/EDT, 23/25-hour history days, broker offset failures, exact identifiers/prices, signed fees and missing SL/TP; exporter has no trading calls/imports. Shared protocol copies match.
- Isolated Postgres (PGlite) tests passed: staging never writes trades, explicit approval, idempotent/concurrent approvals, stale revisions, preservation of notes, open/close merging, ignored events, history boundaries including absent range, unknown symbol mapping/watchlist, RLS, restricted token hashes/RPC permissions and revocation.
- TypeScript `tsc --noEmit`, lint on the new frontend modules, and Deno checks for both new Edge Functions passed.
- Production build passed using Node 25.9.0. The host's Node 22.12.0 hits an existing Lovable/Vite require-cycle issue; Vite's `--configLoader runner` also builds successfully without changing project configuration.
- Real-component UI fixtures were checked at desktop and 375px width. Pending trade dialog and settings fit without horizontal overflow. Fixtures were removed after verification.
- Supabase migrations and both MT5 Edge Functions were deployed. Backup function was updated to include connection/inbox tables. RLS is enabled; anon cannot stage, authenticated cannot execute review RPC or SELECT token_hash, service_role can review. Unauthenticated requests to both HTTP endpoints return 401.
- Existing security advisor notices concern legacy functions/auth settings; the new MT5 tables/functions do not introduce those notices. This is not a full security audit of the journal.
- Frontend is available on the Cloudflare preview branch `codex-mt5-readonly`. Production domain was not replaced. No MT5 connection was created and no EA was attached to a trading account.

Still required before live use: user supplies the exact MT5 account/server, verifies broker offset periods, creates a connection, installs the EA with its private trading permission disabled, and completes the demo checklist in `public/mt5/README.md`. Runtime operation with Position Sizer and iPhone has not been claimed as tested.
