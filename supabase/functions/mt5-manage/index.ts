import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";
import { DEFAULT_MT5_MAPPINGS, validateRules, historyWindow } from "../mt5-sync/protocol.ts";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  const {
    data: { user },
    error,
  } = await db.auth.getUser(jwt);
  if (error || !user) return json({ error: "Unauthorized" }, 401);
  try {
    const text = await req.text();
    if (text.length > 32768) return json({ error: "Too large" }, 413);
    const b = JSON.parse(text);
    let result: unknown = { ok: true };
    if (b.action === "create") {
      if (
        typeof b.name !== "string" ||
        !b.name.trim() ||
        b.name.length > 80 ||
        !/^\d{1,30}$/.test(b.accountLogin) ||
        typeof b.server !== "string" ||
        !b.server.trim() ||
        b.server.length > 100
      )
        throw new Error("Nhập tên, số tài khoản và server MT5.");
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      const token_hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))),
      )
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      const { data, error } = await db
        .from("mt5_connections")
        .insert({
          user_id: user.id,
          name: b.name.trim(),
          account_login: b.accountLogin,
          server: b.server.trim(),
          token_hash,
          offset_rules: validateRules(b.offsetRules),
          mappings: DEFAULT_MT5_MAPPINGS,
        })
        .select("id")
        .single();
      if (error) throw error;
      result = { id: data.id, token };
    } else if (b.action === "review") {
      const { data, error } = await db.rpc("mt5_review", {
        p_user: user.id,
        p_id: b.id,
        p_revision: b.revision,
        p_action: b.decision,
        p_symbol: b.symbol ?? null,
        p_remember: b.remember === true,
      });
      if (error) throw error;
      result = { tradeId: data };
    } else {
      const { data: c, error } = await db
        .from("mt5_connections")
        .select("id,revoked_at")
        .eq("id", b.id)
        .eq("user_id", user.id)
        .single();
      if (error || !c) return json({ error: "Not found" }, 404);
      if (c.revoked_at) throw new Error("Kết nối đã thu hồi");
      let patch: Record<string, unknown>;
      if (b.action === "revoke") patch = { revoked_at: new Date().toISOString() };
      else if (b.action === "configure") {
        const mappings = b.mappings;
        if (
          !mappings ||
          Array.isArray(mappings) ||
          typeof mappings !== "object" ||
          Object.keys(mappings).length > 200 ||
          Object.entries(mappings).some(
            ([k, v]) => !k || k.length > 50 || typeof v !== "string" || !v.trim() || v.length > 50,
          )
        )
          throw new Error("Ánh xạ symbol không hợp lệ");
        patch = {
          mappings,
          offset_rules: validateRules(b.offsetRules),
          scan_version: crypto.randomUUID(),
        };
      } else if (b.action === "history")
        patch = { ...historyWindow(b.from, b.to), scan_version: crypto.randomUUID() };
      else if (b.action === "live")
        patch = { history_from: null, history_to: null, scan_version: crypto.randomUUID() };
      else throw new Error("Invalid action");
      const { error: updateError } = await db
        .from("mt5_connections")
        .update(patch)
        .eq("id", c.id)
        .eq("user_id", user.id);
      if (updateError) throw updateError;
    }
    return json(result);
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error
            ? e.message
            : ((e as { message?: string })?.message ?? "Request failed"),
      },
      400,
    );
  }
});
