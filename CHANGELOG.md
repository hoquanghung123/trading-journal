# Changelog

All notable changes to this project will be documented in this file.

## [2026-07-18]
### Fixed
- Fixed Telegram Mini App "+" (Add Bias) button alignment on mobile WebViews by replacing fullwidth characters with standard ones and switching to flexbox layout.
- Fixed chart image saving issue by implementing automatic upload on bias save and a robust fallback to store direct TradingView S3 URLs when Cloudflare R2 uploads fail.
- Fixed Daily Reset cutoff synchronization (switched from 11:00 AM VN to 07:00 AM VN / 00:00 UTC) to align with Web App logic.
- Fixed empty timeframe chips showing up by conditionally rendering chips only when there is an active bias or an associated image.
- Fixed asset count dynamic subtitle to show today's completion count instead of hardcoded overall counts.

## [2026-07-17]
### Added
- Created `docs/PLAN-telegram-mini-app.md` detailing styling, fallback auth, NY time cutoff countdown, and TradingView URL preview.
- Created isolated stylesheet `src/tg-mini-app.css` for Telegram Mini App interface.
- Drafted database migration `supabase/migrations/20260717000000_create_telegram_users.sql` to map Telegram IDs to system user IDs.

### Changed
- Configured style isolation and ImpersonationBanner hiding logic for `/tg` routes in `src/routes/__root.tsx`.
- Refactored Telegram bot edge function `supabase/functions/telegram-bot/index.ts` with error handling, session validation, and database operations.
- Updated `tsconfig.json` to allow synthetic default imports and enable ESModule interop compatibility.
- Updated server functions in `src/lib/storage.ts` (uploadToR2, proxyFetchImage, deleteFromR2, fetchFromR2) to include proper `inputValidator` schemas for type safety.
- Refactored TanStack Query queryFn references to use anonymous functions `() => fetchEntries()` for compatibility.

### Fixed
- Fixed TypeScript type error (TS2322) in `AchievementsView.tsx` by explicitly casting milestone targets as `number`.
- Fixed data type mismatch in `src/lib/journal.ts` for `fetchWeeklyActivity` by utilizing proper double casting `(data as unknown) as WeeklyActivity[]`.
- Fixed `DateRangePicker.tsx` type compatibility issues.
- Fixed OneDrive sync real-time fallback to await the promise if `waitUntil` is unavailable on the Cloudflare context.
- Fixed `supabaseAdmin` proxy initialization error in `auth-middleware.ts` and `client.server.ts` using `NonNullable`.

