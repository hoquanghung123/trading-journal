import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { biasTradingDate, canonicalJournalMessage, normalizeChartSource } from "./bias-contract";
import type { BiasHomeworkState } from "./bias-homework";

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
const encoder = new TextEncoder();
class BiasSubmissionRejected extends Error {}

export async function handleBiasHomework(data: { action: "status" | "link" | "submit"; code?: string; requestId?: string; entryIds?: string[] }): Promise<BiasHomeworkState> {
  const request = getRequest() as any;
  const bindings = request?.context?.cloudflare?.env || request?.context || {};
  try {
    return await executeBiasHomework(data, request, bindings);
  } catch (error) {
    if (data.action === "submit" && error instanceof BiasSubmissionRejected) {
      return { enabled: true, linked: true, active: true, submission: null, error: error.message, can_restart: true };
    }
    throw error;
  }
}

export async function executeBiasHomework(data: { action: "status" | "link" | "submit"; code?: string; requestId?: string; entryIds?: string[] }, request: Request, bindings: Record<string, any>): Promise<BiasHomeworkState> {
  const env = (key: string): any => bindings[key] ?? (globalThis as any)[key] ?? (typeof process !== "undefined" ? process.env[key] : undefined);
  if (env("LMS_BIAS_ENABLED") !== "true") return { enabled: false, linked: false, active: false, submission: null };
  const secret = env("LMS_BIAS_SECRET");
  const lmsUrl = env("LMS_BIAS_URL");
  const journalUrl = env("TRADING_JOURNAL_URL") || "https://trading.hibacsi.com";
  if (!secret || secret.length < 32 || !lmsUrl) throw new Error("Kết nối LMS chưa được cấu hình. Liên hệ coach.");
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new Error("Đăng nhập Trading Journal trước khi nộp bài.");
  const supabaseUrl = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
  const supabaseKey = env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseKey) throw new Error("Chưa cấu hình xác thực Trading Journal.");
  const db = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) throw new Error("Phiên đăng nhập hết hạn. Hãy đăng nhập lại.");
  const userId = auth.user.id;
  const tradingDate = biasTradingDate();

  async function callLms(endpoint: string, fields: Record<string, unknown>) {
    const target = new URL(`/api/trading-journal/${endpoint}`, lmsUrl);
    if (target.protocol !== "https:" && target.hostname !== "localhost" && target.hostname !== "127.0.0.1") throw new Error("LMS cần kết nối HTTPS.");
    const body = JSON.stringify({ journal_user_id: userId, ...fields });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomUUID();
    const bodyHash = hex(await crypto.subtle.digest("SHA-256", encoder.encode(body)));
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = hex(await crypto.subtle.sign("HMAC", key, encoder.encode(canonicalJournalMessage("POST", target.pathname, timestamp, nonce, bodyHash))));
    let response: Response;
    try {
      response = await fetch(target, { method: "POST", headers: {
        "Content-Type": "application/json", Accept: "application/json", "X-Journal-Timestamp": timestamp,
        "X-Journal-Nonce": nonce, "X-Journal-Signature": signature,
      }, body, signal: AbortSignal.timeout(30000), redirect: "error" });
    } catch {
      throw new Error("Chưa nhận được xác nhận từ LMS. Bấm thử lại để kiểm tra và nộp cùng yêu cầu.");
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const messages: Record<number, string> = {
        401: "Kết nối LMS chưa hợp lệ. Liên hệ coach.", 403: "Hãy liên kết tài khoản và nhờ coach mở bài Bias sáng.",
        404: "LMS chưa bật tính năng Bias sáng.", 409: "Tài khoản đã liên kết hoặc yêu cầu đang được xử lý. Kiểm tra lại kết nối.",
        422: endpoint === "link" ? "Mã liên kết không hợp lệ hoặc đã hết hạn. Tạo mã mới trên LMS." : "Bài nộp chưa hợp lệ. Kiểm tra ngày giao dịch và các chart.",
        413: "Bài nộp quá lớn. Chọn ít tài sản hơn hoặc rút gọn ghi chú.",
        429: "Bạn thao tác quá nhanh. Chờ một phút rồi thử lại.",
      };
      let message = messages[response.status] || "LMS tạm không nhận bài. Bấm thử lại với cùng yêu cầu.";
      if (response.status === 422 && endpoint === "submissions") {
        const errors = result.errors && typeof result.errors === "object" ? Object.entries(result.errors) : [];
        const chartError = errors.find(([field]) => /entries\.\d+\.(yearly_img|monthly_img|weekly_img|daily_img|h4\..*\.img)$/.test(field));
        if (chartError) {
          const labels: Record<string, string> = { yearly_img: "năm", monthly_img: "tháng", weekly_img: "tuần", daily_img: "ngày" };
          const frame = chartError[0].split(".").slice(2).join(".");
          message = `LMS không chấp nhận chart ${labels[frame] || "H4"} trong bài nộp. Liên hệ coach để kiểm tra kết nối kho chart.`;
        } else if (typeof result.message === "string" && result.message === "Chỉ nộp bias của ngày giao dịch hiện tại.") {
          message = "Bài nộp thuộc ngày giao dịch trước. Tải lại Journal và chọn bias của ngày hiện tại.";
        }
      }
      if (endpoint === "submissions" && [400, 413, 422].includes(response.status)) throw new BiasSubmissionRejected(message);
      throw new Error(message);
    }
    return result;
  }

  if (data.action === "link") {
    if (!data.code) throw new Error("Nhập mã liên kết từ LMS.");
    await callLms("link", { code: data.code });
  }
  const status = await callLms("status", { trading_date: tradingDate, ...(data.requestId ? { request_id: data.requestId } : {}) });
  if (data.action !== "submit") return {
    enabled: true, ...status,
    // Use the trusted server configuration; never accept a browser redirect URL.
    ...(data.action === "link" && status.linked ? { return_url: new URL("/dashboard/homework/bias", lmsUrl).href } : {}),
  };
  if (!data.requestId || !data.entryIds?.length) throw new Error("Chọn ít nhất một tài sản để nộp.");
  // Recover the original receipt before re-reading mutable journal data after a lost response.
  if (status.receipt) return { enabled: true, ...status, submission: status.receipt };
  if (!status.linked || !status.active) throw new Error("Liên kết tài khoản và nhờ coach mở bài Bias sáng trước khi nộp.");
  const r2 = env("R2") || env("LOCAL_BIAS_STORE");
  if (!r2) throw new Error("Kho bài nộp chưa sẵn sàng. Thử lại sau hoặc liên hệ coach.");
  const snapshotPath = `bias-delivery/${userId}/${data.requestId}/snapshot.json`;
  const frozenObject = await r2.get(snapshotPath);
  if (frozenObject) {
    const frozen = await frozenObject.json();
    if (frozen.trading_date !== tradingDate) throw new Error("Lần nộp này thuộc ngày giao dịch trước. Mở lại Journal để nộp ngày hiện tại.");
    const result = await callLms("submissions", frozen);
    return { enabled: true, ...status, submission: result.submission, receipt: result.submission };
  }
  const ids = [...new Set(data.entryIds)];
  const { data: rows, error } = await db.from("journal_entries").select("*").eq("user_id", userId).eq("date", tradingDate).in("id", ids).order("asset");
  if (error) throw new Error("Không đọc được bias đã lưu. Thử tải lại Journal.");
  if (!rows || rows.length !== ids.length) throw new Error("Có bias chưa lưu hoặc không thuộc ngày hiện tại. Tải lại và chọn các bản đã lưu.");

  async function snapshotImage(value: unknown, entryId: string, slot: string): Promise<string | null> {
    if (typeof value !== "string" || !value) return null;
    const source = normalizeChartSource(value, userId, journalUrl, supabaseUrl);
    if (!r2) throw new Error("Kho chart chưa sẵn sàng. Thử lại sau hoặc liên hệ coach.");
    const path = `${userId}/bias-submissions/${data.requestId}/${entryId}/${slot}`;
    if (!(await r2.head(path))) {
      const response = await fetch(source, { redirect: "error", signal: AbortSignal.timeout(20000) });
      const type = response.headers.get("content-type")?.split(";")[0];
      if (!response.ok || !type || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(type)) throw new Error("Không đọc được chart. Kiểm tra ảnh rồi thử nộp lại.");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Chart không có dữ liệu.");
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          length += chunk.length;
          if (length > 10 * 1024 * 1024) throw new Error("Chart vượt quá 10 MB.");
          chunks.push(chunk);
        }
      } finally { await reader.cancel(); }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      await r2.put(path, bytes, { httpMetadata: { contentType: type }, onlyIf: { etagDoesNotMatch: "*" } });
    }
    if (!env("R2") && env("LMS_BIAS_LOCAL_ARCHIVE_URL")) {
      const archiveUrl = new URL(`/local-bias-chart/${path.split("/").map(encodeURIComponent).join("/")}`, env("LMS_BIAS_LOCAL_ARCHIVE_URL"));
      if (archiveUrl.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(archiveUrl.hostname)) throw new Error("Địa chỉ kho local không hợp lệ.");
      const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      archiveUrl.searchParams.set("signature", hex(await crypto.subtle.sign("HMAC", key, encoder.encode(path))));
      return archiveUrl.href;
    }
    return `${new URL(journalUrl).origin}/storage/${path.split("/").map(encodeURIComponent).join("/")}`;
  }

  const entries = [];
  for (const row of rows) {
    const entry: Record<string, unknown> = { id: row.id, asset: row.asset, notes: row.notes ?? null };
    for (const frame of ["yearly", "monthly", "weekly", "daily"]) {
      entry[`${frame}_bias`] = row[`${frame}_bias`] ?? null;
      entry[`${frame}_img`] = await snapshotImage(row[`${frame}_img`], row.id, frame);
    }
    const h4: Record<string, unknown> = {};
    for (const session of ["ASIA", "LDN", "NY", "NY AM", "NY PM"]) {
      const value = row.h4?.[session];
      if (value) h4[session] = { bias: value.bias ?? null, notes: value.notes ?? null, img: await snapshotImage(value.img, row.id, `h4-${session}`) };
    }
    entry.h4 = h4;
    entries.push(entry);
  }
  const payload = { request_id: data.requestId, trading_date: tradingDate, entries };
  // Keep the exact prepared content across retries, even if the journal changes before LMS acknowledges.
  const written = await r2.put(snapshotPath, JSON.stringify(payload), { httpMetadata: { contentType: "application/json" }, onlyIf: { etagDoesNotMatch: "*" } });
  const stablePayload = written === null ? await (await r2.get(snapshotPath)).json() : payload;
  const result = await callLms("submissions", stablePayload);
  return { enabled: true, ...status, submission: result.submission, receipt: result.submission };
}
