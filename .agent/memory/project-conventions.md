---
type: project
created: 2026-05-17
updated: 2026-05-17
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
