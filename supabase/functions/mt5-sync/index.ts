import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";
import { normalizeSnapshot } from "./protocol.ts";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const hash = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const token = req.headers.get("x-mt5-key") ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) return new Response("Unauthorized", { status: 401 });
  const { data: c, error } = await db
    .from("mt5_connections")
    .select("*")
    .eq("token_hash", await hash(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !c) return new Response("Unauthorized", { status: 401 });
  try {
    const text = await req.text();
    if (text.length > 32768) return new Response("Too large", { status: 413 });
    const raw = JSON.parse(text);
    if (raw.accountLogin !== c.account_login || raw.server !== c.server)
      throw new Error("Tài khoản/server không khớp.");
    // Only a scan generation is returned. This cannot express terminal commands.
    if (raw.kind === "heartbeat") {
      await db
        .from("mt5_connections")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", c.id)
        .is("revoked_at", null);
      const floor =
        Math.floor(
          Math.min(
            Date.parse(c.created_at),
            c.history_from ? Date.parse(c.history_from) : Infinity,
          ) / 1000,
        ) - 86400;
      return new Response(c.scan_version + "\n" + floor, {
        headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
      });
    }
    const payload = normalizeSnapshot(raw, c);
    const { error: stagingError } = await db.rpc("mt5_stage", {
      p_connection: c.id,
      p_key: payload.positionKey,
      p_payload: payload,
      p_fingerprint: await hash(JSON.stringify(payload)),
    });
    if (stagingError) throw stagingError;
    await db
      .from("mt5_connections")
      .update({ last_seen_at: new Date().toISOString(), last_error: null })
      .eq("id", c.id)
      .is("revoked_at", null);
    return new Response("OK");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không thể nhận dữ liệu MT5";
    await db
      .from("mt5_connections")
      .update({ last_error: message.slice(0, 500) })
      .eq("id", c.id);
    return new Response(message, { status: 400 });
  }
});
