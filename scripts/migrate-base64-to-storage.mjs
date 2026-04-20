// One-time migration: convert all base64 data URLs in journal_entries
// (weekly_img, daily_img, h4.{ASIA,LDN,NY}) into files in the
// `journal-charts` Supabase Storage bucket. Updates each row to store
// just the storage path instead of the base64 string.
//
// USAGE
// -----
// 1. Get your service role key from:
//    https://supabase.com/dashboard/project/mlyowmvrpjtqruramrhp/settings/api
// 2. Run:
//      SUPABASE_URL="https://mlyowmvrpjtqruramrhp.supabase.co" \
//      SUPABASE_SERVICE_ROLE_KEY="<service_role_key>" \
//      node scripts/migrate-base64-to-storage.mjs
//
// Notes
// -----
// - Idempotent: rows that no longer contain `data:` URLs are skipped.
// - Uses service role key, so it BYPASSES RLS. Do NOT commit the key.
// - Files are written under `<user_id>/<uuid>.<ext>` to satisfy RLS once
//   you re-enable it for normal user access.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "journal-charts";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const isDataUrl = (v) => typeof v === "string" && v.startsWith("data:image/");

function dataUrlToBuffer(dataUrl) {
  const m = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL");
  const mime = m[1];
  const ext = mime.split("/")[1].replace("jpeg", "jpg");
  const buf = Buffer.from(m[2], "base64");
  return { buf, mime, ext };
}

async function uploadOne(userId, dataUrl) {
  const { buf, mime, ext } = dataUrlToBuffer(dataUrl);
  const path = `${userId}/${randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: mime,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

async function migrateRow(row) {
  const updates = {};
  let changed = false;

  if (isDataUrl(row.weekly_img)) {
    updates.weekly_img = await uploadOne(row.user_id, row.weekly_img);
    changed = true;
  }
  if (isDataUrl(row.daily_img)) {
    updates.daily_img = await uploadOne(row.user_id, row.daily_img);
    changed = true;
  }

  const h4 = row.h4 && typeof row.h4 === "object" ? { ...row.h4 } : {};
  for (const k of ["ASIA", "LDN", "NY"]) {
    if (isDataUrl(h4[k])) {
      h4[k] = await uploadOne(row.user_id, h4[k]);
      changed = true;
    }
  }
  if (changed) updates.h4 = h4;

  if (!changed) return { id: row.id, skipped: true };

  const { error } = await supabase
    .from("journal_entries")
    .update(updates)
    .eq("id", row.id);
  if (error) throw error;
  return { id: row.id, updated: Object.keys(updates) };
}

async function main() {
  console.log("Fetching entries with base64 images...");
  // Pull only rows that actually contain a data: url somewhere.
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, user_id, weekly_img, daily_img, h4")
    .or("weekly_img.like.data:%,daily_img.like.data:%,h4.cs.{}");
  if (error) throw error;

  // Filter client-side too (h4 jsonb match above is loose).
  const targets = (data ?? []).filter(
    (r) =>
      isDataUrl(r.weekly_img) ||
      isDataUrl(r.daily_img) ||
      (r.h4 &&
        ["ASIA", "LDN", "NY"].some((k) => isDataUrl(r.h4[k])))
  );

  console.log(`Found ${targets.length} row(s) to migrate.`);
  let ok = 0,
    skipped = 0,
    failed = 0;

  for (const row of targets) {
    try {
      const res = await migrateRow(row);
      if (res.skipped) {
        skipped++;
        console.log(`  - ${row.id} skipped`);
      } else {
        ok++;
        console.log(`  ✓ ${row.id} updated [${res.updated.join(", ")}]`);
      }
    } catch (e) {
      failed++;
      console.error(`  ✗ ${row.id} failed:`, e.message);
    }
  }

  console.log(`\nDone. updated=${ok} skipped=${skipped} failed=${failed}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
