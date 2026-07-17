# Changelog

All notable changes to this project will be documented in this file.

## [2026-07-17]
### Added
- Created `docs/PLAN-telegram-mini-app.md` detailing styling, fallback auth, NY time cutoff countdown, and TradingView URL preview.
- Created isolated stylesheet `src/tg-mini-app.css` for Telegram Mini App interface.
- Drafted database migration `supabase/migrations/20260717000000_create_telegram_users.sql` to map Telegram IDs to system user IDs.

### Changed
- Configured style isolation and ImpersonationBanner hiding logic for `/tg` routes in `src/routes/__root.tsx`.
- Refactored Telegram bot edge function `supabase/functions/telegram-bot/index.ts` with error handling, session validation, and database operations.
- Updated `tsconfig.json` to allow synthetic default imports and enable ESModule interop compatibility.
