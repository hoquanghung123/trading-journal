import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GITHUB_PAT = Deno.env.get("GITHUB_PAT")!;
const REPO_OWNER = "hoquanghung123";
const REPO_NAME = "trading-journal";
const WORKFLOW_ID = "daily-backup.yml";

Deno.serve(async (req) => {
  // CORS Preflight
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
    // 1. Get request auth header (User JWT)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 2. Resolve user session
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user session" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // 3. Verify user has admin role
    const { data: profile, error: dbError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (dbError || !profile || profile.role !== "admin") {
      console.warn(`User ${user.email} attempted to trigger backup without admin role.`);
      return new Response(JSON.stringify({ error: "Access Denied: Admin role required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // 4. Verify GITHUB_PAT exists
    if (!GITHUB_PAT) {
      console.error("GITHUB_PAT is not set in Supabase Edge Function environment.");
      return new Response(
        JSON.stringify({ error: "Server Configuration Error: GITHUB_PAT secret is missing." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    console.log(`Admin ${user.email} is triggering the GitHub daily-backup workflow.`);

    // 5. Trigger GitHub repository dispatch
    const githubUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_ID}/dispatches`;
    const ghRes = await fetch(githubUrl, {
      method: "POST",
      headers: {
        "Authorization": `token ${GITHUB_PAT}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "Supabase-Edge-Function",
      },
      body: JSON.stringify({
        ref: "main", // Runs on the main branch
      }),
    });

    if (!ghRes.ok) {
      const errorText = await ghRes.text();
      console.error(`GitHub API responded with error: ${ghRes.status} - ${errorText}`);
      throw new Error(`GitHub workflow trigger failed: ${ghRes.statusText} (${errorText})`);
    }

    // 6. Record a temporary log row as "running" in the DB so the dashboard shows immediate feedback
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("backup_logs").upsert(
      {
        date: today,
        db_status: "running",
        r2_status: "running",
        log_message: `Manual backup triggered by admin ${user.email} at ${new Date().toISOString()}. Waiting for pipeline completion...`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "date" }
    );

    return new Response(JSON.stringify({ success: true, message: "GitHub workflow triggered successfully." }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Workflow trigger failed:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
