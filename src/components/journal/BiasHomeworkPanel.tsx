import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { biasHomework, type BiasHomeworkState } from "@/lib/bias-homework";
import { journalTradingDate, type DayEntry } from "@/lib/journal";
import { readBiasLinkHandoff, clearBiasLinkHandoff } from "@/lib/bias-link-handoff";

type Pending = { requestId: string; entryIds: string[] };

export function BiasHomeworkPanel({ entries, assets }: { entries: DayEntry[]; assets: string[] }) {
  const [state, setState] = useState<BiasHomeworkState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);
  const [code, setCode] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [connected, setConnected] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [storageKey, setStorageKey] = useState("");
  const [date, setDate] = useState(() => journalTradingDate());
  const today = entries.filter((entry) => entry.date === date && assets.includes(entry.asset));

  useEffect(() => {
    const incoming = readBiasLinkHandoff();
    if (incoming) { setCode(incoming); setOpened(true); }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setDate(journalTradingDate()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  async function call(data: Parameters<typeof biasHomework>[0]["data"]) {
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) throw new Error("Đăng nhập Trading Journal để kết nối LMS.");
    return biasHomework({ data, headers: { Authorization: `Bearer ${auth.session.access_token}` } });
  }

  useEffect(() => {
    let stopped = false;
    async function load() {
      if (date !== journalTradingDate()) { setDate(journalTradingDate()); return; }
      try {
        const { data: auth } = await supabase.auth.getSession();
        const key = `bias-homework-pending:${auth.session?.user.id}:${date}`;
        let saved: Pending | null = null;
        try { saved = JSON.parse(localStorage.getItem(key) || "null"); } catch { /* Ignore malformed local state. */ }
        const result = await call({ action: "status", ...(saved ? { requestId: saved.requestId } : {}) });
        if (stopped) return;
        setStorageKey(key);
        setAccountEmail(auth.session?.user.email || "");
        setState(result);
        setError("");
        if (result.receipt) { localStorage.removeItem(key); setPending(null); }
        else if (saved) { setPending(saved); setSelected(saved.entryIds); }
        else setPending(null);
      } catch (err) { if (!stopped) setError(err instanceof Error ? err.message : "Không đọc được trạng thái LMS."); }
    }
    void load();
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    return () => { stopped = true; window.removeEventListener("focus", refresh); };
  }, [date]);

  async function connect() {
    setBusy(true); setError("");
    try {
      if (readBiasLinkHandoff() !== code) throw new Error("Yêu cầu kết nối đã hết hạn. Quay lại LMS và bấm Kết nối Trading Journal.");
      const result = await call({ action: "link", code });
      setState(result);
      clearBiasLinkHandoff(); setCode(""); setConnected(true);
      if (result.linked && result.return_url) window.location.replace(result.return_url);
    }
    catch (err) { setError(err instanceof Error ? err.message : "Không liên kết được tài khoản."); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!selected.length && !pending) return;
    setBusy(true); setError("");
    const attempt = pending || { requestId: crypto.randomUUID(), entryIds: selected };
    setPending(attempt);
    try { localStorage.setItem(storageKey, JSON.stringify(attempt)); } catch { /* Retry remains available in this tab. */ }
    try {
      const result = await call({ action: "submit", ...attempt });
      if (result.error) {
        setError(result.error);
        if (result.can_restart) {
          setPending(null);
          try { localStorage.removeItem(storageKey); } catch { /* Keep in-memory state usable. */ }
        }
        return;
      }
      setState(result);
      setPending(null);
      try { localStorage.removeItem(storageKey); } catch { /* A later receipt check can recover the acknowledgement. */ }
      setOpened(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Chưa nhận được xác nhận. Bấm thử lại."); }
    finally { setBusy(false); }
  }

  if (state && !state.enabled) return null;
  const button = "rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed";
  return (
    <section className="mx-4 my-3 rounded-xl border border-border bg-card p-3 text-foreground lg:mx-6" aria-label="Bài tập LMS" style={{ color: "var(--foreground, #f4f7f8)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bài tập LMS · {date}</p>
          <p className="text-sm font-semibold">{state?.submission ? `${state.submission.status_label} · bản ${state.submission.version}` : "Nộp bias sáng cho coach"}</p>
          {state?.coach_name && <p className="text-xs text-muted-foreground">Coach: {state.coach_name}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {state?.submission && <a className={button} href={state.submission.url} target="_blank" rel="noopener noreferrer">Xem bài và nhận xét</a>}
          <button className={button} disabled={busy} onClick={() => {
            setOpened(!opened);
            if (!pending) setSelected(today.map((entry) => entry.id));
          }}>{state?.linked ? (state.submission ? "Nộp bản cập nhật" : "Nộp bias cho coach") : "Kết nối LMS"}</button>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      {connected && <p role="status" className="mt-3 text-sm">Đã kết nối Trading Journal với LMS. Bạn có thể nộp bias cho coach từ đây.</p>}
      {(opened || pending) && <div className="mt-4 border-t border-border pt-4">
        {!state ? <button className={button} disabled={busy} onClick={async () => {
          setBusy(true);
          try { setState(await call({ action: "status" })); setError(""); }
          catch (err) { setError(err instanceof Error ? err.message : "Không kết nối được LMS."); }
          finally { setBusy(false); }
        }}>Thử tải trạng thái</button> : !state.linked ? <div className="flex flex-wrap items-end gap-3">
          {code ? <>
            <p className="w-full text-sm">Liên kết tài khoản Trading Journal {accountEmail && <strong>{accountEmail}</strong>} đang đăng nhập với tài khoản LMS vừa mở kết nối.</p>
            <button className={button} disabled={busy} onClick={connect}>{busy ? "Đang kết nối…" : "Xác nhận kết nối LMS"}</button>
            <button className={button} disabled={busy} onClick={() => { clearBiasLinkHandoff(); setCode(""); setOpened(false); }}>Hủy</button>
            <p className="w-full text-xs text-muted-foreground">Nếu đây chưa phải tài khoản Journal của bạn, hãy đăng xuất và đăng nhập đúng tài khoản trước khi xác nhận. Yêu cầu có hiệu lực 10 phút.</p>
          </> : <p className="text-sm">Vào LMS → Bài tập Bias sáng → Kết nối Trading Journal. Bạn sẽ được chuyển về đây để xác nhận, không cần nhập mã.</p>}
        </div> : !state.active ? <p className="text-sm">Coach chưa mở bài Bias sáng cho bạn. Liên hệ coach trên LMS.</p> : <>
          <p className="mb-3 text-sm text-muted-foreground">Chọn bias đã lưu của ngày giao dịch hiện tại. Các chart và ghi chú được giữ cùng phiên bản bài nộp.</p>
          {today.length === 0 && !pending && <p className="text-sm">Chưa có bias đã lưu hôm nay. Lưu phân tích ít nhất một tài sản trước khi nộp.</p>}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {today.map((entry) => <label key={entry.id} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
              <input type="checkbox" disabled={busy || !!pending} checked={selected.includes(entry.id)} onChange={(e) => setSelected((ids) => e.target.checked ? [...ids, entry.id] : ids.filter((id) => id !== entry.id))} />
              <span><strong className="font-mono">{entry.asset}</strong><span className="block text-xs text-muted-foreground">Weekly {entry.weeklyBias.toUpperCase()} · Daily {entry.dailyBias.toUpperCase()}</span></span>
            </label>)}
          </div>
          {pending && <p className="mt-3 text-sm">Có lần nộp chưa được xác nhận. Thử lại sẽ kiểm tra cùng yêu cầu, không tạo bài trùng.</p>}
          <button className={`${button} mt-4 bg-primary text-primary-foreground`} disabled={busy || (!pending && !selected.length)} onClick={submit}>
            {busy ? "Đang gửi và chờ LMS xác nhận…" : pending ? "Thử lại lần nộp" : `Nộp ${selected.length} tài sản cho ${state.coach_name || "coach"}`}
          </button>
        </>}
      </div>}
    </section>
  );
}
