import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BACKUP_API_SECRET = Deno.env.get("BACKUP_API_SECRET")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  // 1. CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // 2. Authenticate using static API secret
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${BACKUP_API_SECRET}`) {
      console.error("Unauthorized backup log attempt: Invalid token.");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // 3. Parse request payload
    const body = await req.json();
    const {
      db_status,
      r2_status,
      db_size_bytes,
      r2_files_count,
      r2_size_bytes,
      log_message,
      date,
    } = body;

    // Use current date if not specified
    const targetDate = date || new Date().toISOString().slice(0, 10);

    console.log(`Upserting backup log for ${targetDate}: DB=${db_status}, R2=${r2_status}`);

    // 4. Upsert into public.backup_logs
    const { data, error } = await supabase
      .from("backup_logs")
      .upsert(
        {
          date: targetDate,
          db_status,
          r2_status,
          db_size_bytes: db_size_bytes || null,
          r2_files_count: r2_files_count || null,
          r2_size_bytes: r2_size_bytes || null,
          log_message,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "date" }
      )
      .select();

    if (error) {
      console.error("Database insert error:", error.message);
      throw new Error(`Database error: ${error.message}`);
    }

    return new Response(JSON.stringify({ success: true, log: data?.[0] }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Log recording failed:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
