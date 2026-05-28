---
type: project
created: 2026-05-17
updated: 2026-05-28
---

# Project Conventions: Telegram Bias Bot & Supabase Functions

This document summarizes the architectural and implementation conventions established for the Trading Journal Telegram Bot.

## 🤖 Telegram Webhook & Deploy Security
- **No-Verify-JWT Deploy:** Supabase Edge Functions acting as Telegram webhooks must be deployed with the `--no-verify-jwt` flag:
  `npx supabase functions deploy telegram-bot --no-verify-jwt --project-ref mlyowmvrpjtqruramrhp`
- **Self-Registration:** Visiting the Edge Function GET endpoint dynamically registers the Deno webhook URL secure link with Telegram.

## 💾 Telegram Callback Data 64-Byte Limits
- **Strict Byte-Size Constraint:** Telegram `callback_data` payload must not exceed **64 bytes**. 
- **Shortened Payload Conventions:**
  - `menub` for `menu_bias`
  - `menuh4` for `menu_h4_sessions`
  - `setb` for `set_bias`
  - `inch` for `input_chart`
  - `innotes` for `input_notes`
  - `backm` for `back_menu`
  - `finb` for `finish_bias`
  - Fields: `m` (monthly), `w` (weekly), `d` (daily), `h4` (h4)
  - Biases: `bull` (bullish), `bear` (bearish), `cons` (consolidation)
- **Database Mapping:** Map abbreviated codes back to database values (`m` ➡️ `monthly`, `cons` ➡️ `consolidation`) before Supabase insert/update queries.

## 📑 Parse Mode: HTML Protocol
- **Fragile Markdown Ban:** Do not use `parse_mode: "Markdown"` for interactive bot menus containing user inputs (like Notes) as unclosed symbols (like `_` or `*`) will crash the message update silently and hang the client.
- **Strict HTML Formatting:** Always use `parse_mode: "HTML"` and escape notes strings:
  `notes.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")`

## 🪙 Asset & Forex Filtering Rules
- **Non-Forex Select:** Only indices, metals, and cryptos are shown in the `/bias` command list. Always filter out forex symbols by checking `is_forex` value inside the database.

## 🎨 Premium HSL Dark Mode & Leak Prevention
- **Dark Mode Standard:** The interface is built on a custom, state-of-the-art "Solar Eclipse" dark theme.
- **Strict Leak Prevention:**
  - Never use plain light-theme utility classes like `bg-white` or `bg-white/50` for card views, dialog components, alert pop-ups, lists, or checklists.
  - Always use responsive, cohesive theme variables: `bg-card` for main cards and dialog elements, `bg-background` for inner slots or active tab indicators, and `border-border/50` or `border-primary/10` for subtle borders.
  - ACCENTS: For financial performance indicators or checklist states, use translucent contrast colors (e.g. `bg-emerald-500/10 border-emerald-500/20 text-emerald-500` for gains, `bg-rose-500/10 border-rose-500/20 text-rose-500` for losses or missed rules) to maintain high contrast and premium aesthetics without harsh glare.

## ☁️ Cloudflare Pages Deploy & Worker Safety
- **Wrangler Redirection File Requirement:**
  - When using a root `wrangler.json` with `"pages_build_output_dir": "dist/client"`, Cloudflare Pages mandates the existence of a corresponding `wrangler.json` inside the build output directory (`dist/client/wrangler.json`) after compilation with `"pages_build_output_dir": "."`. Deleting or skipping this generated file will fail the deployment immediately with code 1.
- **R2 Bucket Bindings UI Mapping:**
  - Declared bindings (like `R2` bound to `tradingjournal-chart`) must be manually linked in the Cloudflare Pages dashboard project settings under **Settings -> Functions -> R2 Bucket Bindings** for *both* **Production** and **Preview** environments. Failure to do so will result in an `"Unknown internal error occurred"` error at the publish stage.
- **Worker Robustness Guardrails:**
  - The SSR worker (`src/_worker.js`) must always wrap R2 operations in an existence check (`if (env.R2)`) before executing functions like `env.R2.get` or `env.R2.put`. This ensures graceful fallback to Supabase and prevents internal Server 500 crashes if the R2 bindings are disabled or unlinked.

## 💾 Hybrid Backup & Real-time OneDrive Sync
- **PostgreSQL Version Matching:** Supabase uses PostgreSQL v17. The GitHub Actions backup pipeline (`daily-backup.yml`) forces installation of `postgresql-client-17` and overrides the local runner `PATH` to resolve to `pg_dump` v17.
- **Rclone JSON Safe Config:** Passing rclone secrets as individual variables is highly prone to Bash character-escaping issues. Instead, inject the raw token as a single environment secret `RCLONE_CONFIG_ONEDRIVE` and parse it dynamically.
- **Real-time OneDrive Sync:** Image sync runs as a non-blocking background task on Cloudflare Pages. It intercepts both client-side uploads (`uploadToR2` in `src/lib/storage.ts`) and lazy backend migrations (`src/_worker.js`).
- **Worker Background Execution Context Fallback:** In runtimes where Cloudflare's `ctx.waitUntil` is not available (e.g. Server Functions or Standard Worker contexts), background sync promises must be explicitly `await`ed. This ensures the CPU execution thread is kept alive long enough to complete the Microsoft Graph API transfer.
- **Sync Logs Table Security (RLS) & Clean View:**
  - The `realtime_sync_logs` table has Row Level Security (RLS) enabled.
  - **INSERT** is allowed for both `anon` and `authenticated` roles to let workers log their sync attempts.
  - **SELECT** is strictly restricted to `authenticated` users, hiding log contents from the public anon key.
  - **UPDATE & DELETE** are completely disabled for anon and authenticated users, securing logs from malicious tampering.
  - **Client-Side Deduplication:** The Admin Dashboard filters and deduplicates real-time logs by `path` (keeping only the newest entry per file) to prevent duplicate starting/success rows and ensure a clean, modern UI.
- **Configuration Requirement:** Requires adding `RCLONE_CONFIG_ONEDRIVE` as a **Secret Environment Variable** under Settings in the Cloudflare Pages dashboard for live runtime integration.



