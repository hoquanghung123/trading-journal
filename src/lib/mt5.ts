import { supabase } from "@/integrations/supabase/client";
import type { BrokerData, OffsetRule } from "./mt5/protocol";
export interface Mt5Connection {
  id: string;
  name: string;
  account_login: string;
  server: string;
  created_at: string;
  revoked_at: string | null;
  last_seen_at: string | null;
  last_error: string | null;
  mappings: Record<string, string>;
  offset_rules: OffsetRule[];
  history_from: string | null;
  history_to: string | null;
  scan_version: string;
}
export interface Mt5Pending {
  id: string;
  connection_id: string;
  position_key: string;
  revision: number;
  state: "pending" | "approved" | "ignored";
  payload: BrokerData;
  trade_id: string | null;
  updated_at: string;
}
export const mt5Keys = { connections: ["mt5", "connections"], inbox: ["mt5", "inbox"] };
export async function fetchMt5Connections(): Promise<Mt5Connection[]> {
  const { data, error } = await supabase
    .from("mt5_connections")
    .select(
      "id,name,account_login,server,created_at,revoked_at,last_seen_at,last_error,mappings,offset_rules,history_from,history_to,scan_version",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Mt5Connection[];
}
export async function fetchMt5Inbox(page = 0): Promise<{ items: Mt5Pending[]; total: number }> {
  const { data, error, count } = await supabase
    .from("mt5_inbox")
    .select("*", { count: "exact" })
    .eq("state", "pending")
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page * 25, page * 25 + 24);
  if (error) throw error;
  return { items: (data ?? []) as unknown as Mt5Pending[], total: count ?? 0 };
}
export async function manageMt5(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("mt5-manage", { body });
  if (error) {
    let message = error.message;
    try {
      message = (await error.context.json()).error ?? message;
    } catch {
      /* Keep the original transport error when the response is not JSON. */
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
export function mt5Endpoint() {
  return `${(supabase as unknown as { supabaseUrl: string }).supabaseUrl}/functions/v1/mt5-sync`;
}
