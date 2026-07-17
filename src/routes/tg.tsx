import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../integrations/supabase/client";
import {
  fetchEntries,
  upsertEntry,
  calculateStreak,
  getSessionsForAsset,
  resolveTradingViewUrl,
  uploadChartImage,
  getChartUrl,
  weekdayOf,
  type DayEntry,
  type Bias,
} from "../lib/journal";
import { getAssetIconUrl } from "../lib/symbols";

// ─── Constants ───────────────────────────────────────────────────────────────
const MOCK_USER_ID = "a14a793c-cf04-4e80-9717-d7f077b6f5a3";
const TF_LABELS = ["M", "W", "D", "ASIA", "LDN", "NY"];
const TF_FULL: Record<string, string> = {
  M: "Monthly",
  W: "Weekly",
  D: "Daily",
  ASIA: "Asia",
  LDN: "London",
  NY: "NY",
  "NY AM": "NY AM",
  "NY PM": "NY PM",
};

type Tab = "bias" | "streak" | "trades";
type AuthState = "loading" | "ok" | "unlinked" | "error";
const TODAY_CHIP = "__today__";

// ─── NY Cutoff helpers ────────────────────────────────────────────────────────
/** Cutoff = 11:00 AM VN (GMT+7) = 00:00 America/New_York */
function getTradingDate(): string {
  const now = new Date();
  const vnHour = now.getUTCHours() + 7;
  const adjusted = new Date(now);
  if (vnHour < 11 || (vnHour === 11 && now.getUTCMinutes() === 0 && now.getUTCSeconds() === 0)) {
    adjusted.setUTCDate(adjusted.getUTCDate() - 1);
  }
  return adjusted.toISOString().slice(0, 10);
}

function getSecondsUntilCutoff(): number {
  const now = new Date();
  const vnMs = now.getTime() + 7 * 3600 * 1000;
  const vnNow = new Date(vnMs);
  const todayCutoff = new Date(vnMs);
  todayCutoff.setUTCHours(11, 0, 0, 0);
  let diff = (todayCutoff.getTime() - vnNow.getTime()) / 1000;
  if (diff <= 0) diff += 86400;
  return Math.floor(diff);
}

function fmtCountdown(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── TradingView URL parser ───────────────────────────────────────────────────
function parseTvUrl(raw: string): string | null {
  const resolved = resolveTradingViewUrl(raw);
  if (resolved) return resolved;
  if (/\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i.test(raw)) return raw;
  return null;
}

// ─── Bias helpers ─────────────────────────────────────────────────────────────
function biasClass(b?: Bias): string {
  if (b === "bullish") return "";
  if (b === "bearish") return "bear";
  return "cons";
}

function biasAbbr(b?: Bias): string {
  if (b === "bullish") return "BULL";
  if (b === "bearish") return "BEAR";
  return "CONS";
}

function emptyEntry(date: string, asset: string): DayEntry {
  return {
    id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    date,
    asset,
    weeklyBias: "consolidation",
    weeklyCorrect: false,
    yearlyBias: "consolidation",
    monthlyBias: "consolidation",
    monthlyCorrect: false,
    dailyBias: "consolidation",
    dailyCorrect: false,
    h4: {},
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NotLinkedScreen() {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
      <h2 style={{ color: "#f4f7f8", marginBottom: 8, fontSize: 18 }}>Tài khoản chưa liên kết</h2>
      <p style={{ color: "#778792", fontSize: 14, lineHeight: 1.6 }}>
        Vui lòng đăng nhập vào{" "}
        <strong style={{ color: "#2cc7b4" }}>Trading Journal Web</strong> và liên kết tài khoản
        Telegram trong phần Cài đặt để sử dụng Mini App này.
      </p>
      <a
        href="https://trading-journal-3di.pages.dev"
        target="_blank"
        rel="noreferrer"
        style={{
          display: "inline-block",
          marginTop: 20,
          padding: "10px 20px",
          background: "linear-gradient(135deg, #25c7ae, #0f958c)",
          borderRadius: 11,
          color: "#fff",
          fontWeight: 600,
          textDecoration: "none",
          fontSize: 14,
        }}
      >
        Mở Trading Journal Web →
      </a>
    </div>
  );
}

// ─── Asset Editor ─────────────────────────────────────────────────────────────
interface AssetEditorProps {
  entry: DayEntry;
  onSave: (updated: DayEntry) => Promise<void>;
}

function AssetEditor({ entry, onSave }: AssetEditorProps) {
  const sessions = getSessionsForAsset(entry.asset);
  const isSplitNy = sessions.includes("NY AM");

  // Monthly chỉ hiển thị vào thứ 2 hoặc ngày 1 đầu tháng (giống web app)
  const isMonday = weekdayOf(entry.date) === "MON";
  const isFirstOfMonth = entry.date.endsWith("-01");
  const showMonthly = isMonday || isFirstOfMonth;

  const sessionTabs = isSplitNy
    ? ["ASIA", "LDN", "NY AM", "NY PM"]
    : ["ASIA", "LDN", "NY"];
  const tabs = [
    ...(showMonthly ? ["M"] : []),
    "W",
    "D",
    ...sessionTabs,
  ];

  const [draft, setDraft] = useState<DayEntry>(entry);
  // Default to W — M may not be available depending on day
  const [activeTab, setActiveTab] = useState<string>("W");
  const [urlInput, setUrlInput] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync draft khi entry prop thay đổi (ví dụ: fetch từ DB về sau khi mount)
  useEffect(() => {
    setDraft(entry);
  }, [entry.id, entry.asset, entry.date]);

  const getBias = (tab: string): Bias => {
    if (tab === "M") return draft.monthlyBias;
    if (tab === "W") return draft.weeklyBias;
    if (tab === "D") return draft.dailyBias;
    return draft.h4[tab]?.bias ?? "consolidation";
  };

  const setBias = (tab: string, b: Bias) => {
    if (tab === "M") setDraft((d) => ({ ...d, monthlyBias: b }));
    else if (tab === "W") setDraft((d) => ({ ...d, weeklyBias: b }));
    else if (tab === "D") setDraft((d) => ({ ...d, dailyBias: b }));
    else setDraft((d) => ({ ...d, h4: { ...d.h4, [tab]: { ...d.h4[tab], bias: b } } }));
  };

  const getImg = (tab: string): string | undefined => {
    if (tab === "M") return draft.monthlyImg;
    if (tab === "W") return draft.weeklyImg;
    if (tab === "D") return draft.dailyImg;
    return draft.h4[tab]?.img;
  };

  const setImg = (tab: string, img: string | undefined) => {
    if (tab === "M") setDraft((d) => ({ ...d, monthlyImg: img }));
    else if (tab === "W") setDraft((d) => ({ ...d, weeklyImg: img }));
    else if (tab === "D") setDraft((d) => ({ ...d, dailyImg: img }));
    else setDraft((d) => ({ ...d, h4: { ...d.h4, [tab]: { ...d.h4[tab], img } } }));
  };

  const handleUrlPaste = (val: string) => {
    setUrlInput(val);
    const img = parseTvUrl(val.trim());
    setPreviewUrl(img);
  };

  const handleApplyUrl = async () => {
    if (!previewUrl) return;
    setSaving(true);
    try {
      const path = await uploadChartImage(previewUrl);
      setImg(activeTab, path);
      setUrlInput("");
      setPreviewUrl(null);
    } catch {
      // Keep preview - user can retry
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  const currentBias = getBias(activeTab);
  const currentImg = getImg(activeTab);

  return (
    <div className="editor">
      {/* Timeframe tabs */}
      <div className={`tabs ${!isSplitNy ? "monthly-off" : ""}`}>
        {tabs.map((t) => (
          <button
            key={t}
            className={`control${activeTab === t ? " active" : ""}`}
            onClick={() => setActiveTab(t)}
            style={{ fontSize: 11 }}
          >
            {TF_FULL[t] ?? t}
          </button>
        ))}
      </div>

      {/* Bias direction */}
      <div className="directions">
        {(["bullish", "bearish", "consolidation"] as Bias[]).map((b) => (
          <button
            key={b}
            className={`subbtn${currentBias === b ? " active" : ""}`}
            onClick={() => setBias(activeTab, b)}
          >
            {b === "bullish" ? "📈 Bull" : b === "bearish" ? "📉 Bear" : "↔ Cons"}
          </button>
        ))}
      </div>

      {/* Existing image preview */}
      {currentImg && (
        <div className="image-preview-container">
          <img src={getChartUrl(currentImg)} alt="chart" />
          <button className="image-preview-delete" onClick={() => setImg(activeTab, undefined)}>
            ×
          </button>
        </div>
      )}

      {/* URL paste input */}
      <div className="url-input-container">
        <input
          type="text"
          placeholder="Dán link TradingView hoặc ảnh..."
          value={urlInput}
          onChange={(e) => handleUrlPaste(e.target.value)}
        />
        <button onClick={handleApplyUrl} disabled={!previewUrl || saving}>
          {saving ? "..." : "Lưu"}
        </button>
      </div>

      {/* URL preview before upload */}
      {previewUrl && !currentImg && (
        <div className="image-preview-container" style={{ marginTop: 8 }}>
          <img src={previewUrl} alt="preview" />
        </div>
      )}

      {/* Save button */}
      <button
        className="new"
        onClick={handleSave}
        disabled={saving}
        style={{ marginTop: 12 }}
      >
        {saving ? "Đang lưu..." : "✓ Lưu Bias"}
      </button>
    </div>
  );
}

// ─── Asset Card ───────────────────────────────────────────────────────────────
interface AssetCardProps {
  asset: string;
  entry?: DayEntry;
  tradingDate: string;
  onSave: (updated: DayEntry) => Promise<void>;
}

function AssetCard({ asset, entry, tradingDate, onSave }: AssetCardProps) {
  const [open, setOpen] = useState(false);
  const e = entry ?? emptyEntry(tradingDate, asset);
  const sessions = getSessionsForAsset(asset);
  const isSplitNy = sessions.includes("NY AM");

  // Monthly chip: chỉ hiển thị vào thứ 2 hoặc ngày 1 đầu tháng (giống web app)
  const isMonday = weekdayOf(tradingDate) === "MON";
  const isFirstOfMonth = tradingDate.endsWith("-01");
  const showMonthly = isMonday || isFirstOfMonth;

  // NO .slice() - CSS grid adapts to column count dynamically
  // Non-split: W D ASIA LDN NY = 5 (6 with Monthly)
  // Split (NQ/YM/ES): W D ASIA LDN NY-AM NY-PM = 6 (7 with Monthly)
  const tfGrid = [
    ...(showMonthly ? [{ key: "M", bias: e.monthlyBias }] : []),
    { key: "W", bias: e.weeklyBias },
    { key: "D", bias: e.dailyBias },
    ...(isSplitNy
      ? [
          { key: "ASIA", bias: e.h4["ASIA"]?.bias },
          { key: "LDN", bias: e.h4["LDN"]?.bias },
          { key: "NY AM", bias: e.h4["NY AM"]?.bias },
          { key: "NY PM", bias: e.h4["NY PM"]?.bias },
        ]
      : [
          { key: "ASIA", bias: e.h4["ASIA"]?.bias },
          { key: "LDN", bias: e.h4["LDN"]?.bias },
          { key: "NY", bias: e.h4["NY"]?.bias },
        ]),
  ];

  // Completion score: đếm TF đã có bias (không phải undefined)
  const totalTF = tfGrid.length;
  const filledTF = tfGrid.filter(({ bias }) => bias !== undefined && bias !== null).length;
  const isComplete = filledTF === totalTF;

  return (
    <div className={`asset${open ? " open" : ""}`}>
      <button className="asset-head" onClick={() => setOpen((o) => !o)}>
        <div
          className="symbol"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: "#1a2a2e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {getAssetIconUrl(asset) ? (
            <img
              src={getAssetIconUrl(asset)!}
              alt={asset}
              style={{ width: 24, height: 24, objectFit: "contain" }}
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = "none";
                el.parentElement!.innerHTML = `<span style="font-size:11px;color:#8fe4d8;font-weight:700">${asset.replace("1!", "").slice(0, 3)}</span>`;
              }}
            />
          ) : (
            <span style={{ fontSize: 11, color: "#8fe4d8", fontWeight: 700 }}>
              {asset.replace("1!", "").slice(0, 3)}
            </span>
          )}
        </div>
        <b style={{ fontSize: 14 }}>{asset}</b>
        {/* Completion score badge */}
        <span
          style={{
            marginLeft: "auto",
            fontSize: 12,
            fontWeight: 600,
            color: isComplete ? "#2cc7b4" : "#778792",
            letterSpacing: 0.2,
            flexShrink: 0,
          }}
        >
          {filledTF}/{totalTF}
        </span>
        <span style={{ color: "#778792", fontSize: 18 }}>{open ? "▾" : "▸"}</span>
      </button>

      {/* TF grid */}
      <div className={`tfgrid${isSplitNy ? "" : " monthly-off"}`} style={{ gridTemplateColumns: `repeat(${tfGrid.length}, minmax(0,1fr))` }}>
        {tfGrid.map(({ key, bias }) => (
          <div key={key} className={`tf${biasClass(bias) ? " " + biasClass(bias) : ""}`}>
            <small>{key === "NY AM" ? "NAM" : key === "NY PM" ? "NPM" : key}</small>
          </div>
        ))}
      </div>

      <AssetEditor entry={e} onSave={onSave} />
    </div>
  );
}

// ─── Streak Screen ────────────────────────────────────────────────────────────
function StreakScreen({ entries }: { entries: DayEntry[] }) {
  const stats = calculateStreak(entries);
  const pct = stats.longestStreak > 0 ? Math.round((stats.currentStreak / stats.longestStreak) * 100) : 0;

  // Last 28 days calendar
  const days: { date: string; done: boolean }[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    days.push({ date: dateStr, done: stats.streakDays.includes(dateStr) });
  }

  return (
    <div className="screen active">
      <div className="hero">
        <p style={{ color: "#9dd4d0", fontSize: 13, margin: 0 }}>Chuỗi hiện tại</p>
        <div
          className="ring"
          style={{
            background: `conic-gradient(#34d5bd 0 ${pct}%, #ffffff1a ${pct}%)`,
          }}
        >
          <div>
            <b>{stats.currentStreak}</b>
            <small>ngày</small>
          </div>
        </div>
        <p style={{ color: "#9dd4d0", fontSize: 12 }}>
          {stats.isTodayComplete ? "✅ Hôm nay đã hoàn thành!" : "⏳ Chưa có bias hôm nay"}
        </p>
      </div>

      <div className="metrics">
        <div className="metric">
          <span style={{ color: "#778792", fontSize: 12 }}>Chuỗi dài nhất</span>
          <b style={{ fontSize: 22, color: "#2cc7b4" }}>{stats.longestStreak}</b>
        </div>
        <div className="metric">
          <span style={{ color: "#778792", fontSize: 12 }}>Tổng ngày prep</span>
          <b style={{ fontSize: 22, color: "#2cc7b4" }}>{stats.streakDays.length}</b>
        </div>
      </div>

      <p style={{ color: "#778792", fontSize: 12, marginBottom: 8 }}>28 ngày gần nhất</p>
      <div className="calendar">
        {days.map(({ date, done }) => (
          <div key={date} className={`day${done ? " done" : ""}`} title={date}>
            {new Date(date + "T00:00:00").getDate()}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Trades Screen ────────────────────────────────────────────────────────────
function TradesScreen({ entries, tradingDate }: { entries: DayEntry[]; tradingDate: string }) {
  const todayEntries = entries.filter((e) => e.date === tradingDate);
  return (
    <div className="screen active">
      {todayEntries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#778792" }}>
          <div style={{ fontSize: 40 }}>📋</div>
          <p>Chưa có entry nào hôm nay</p>
        </div>
      ) : (
        <div className="trades">
          {todayEntries.map((e) => (
            <div key={e.id} className="trade-card">
              <div className="trade">
                <div
                  className="symbol"
                  style={{ fontSize: 11, fontWeight: 700, color: "#8fe4d8", width: 38, height: 38 }}
                >
                  {e.asset.replace("1!", "").slice(0, 3)}
                </div>
                <div className="trade-info">
                  <b>{e.asset}</b>
                  <span style={{ color: "#778792", fontSize: 12 }}>{e.date}</span>
                </div>
                <div
                  style={{
                    color:
                      e.dailyBias === "bullish" ? "#27cbb2" : e.dailyBias === "bearish" ? "#ef4055" : "#e8b52b",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {biasAbbr(e.dailyBias)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
function TgMiniApp() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("bias");
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [countdown, setCountdown] = useState(getSecondsUntilCutoff());
  const [selectedAsset, setSelectedAsset] = useState<string>(TODAY_CHIP);
  const [userAssets, setUserAssets] = useState<string[]>([]);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addingAsset, setAddingAsset] = useState<string | null>(null);
  const tradingDate = getTradingDate();

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function initAuth() {
      const isLocalhost =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

      const tg = (window as any).Telegram?.WebApp;
      const hasRealTg = tg?.initData && tg.initData.length > 0;

      try {
        if (hasRealTg) {
          // Production: gọi Edge Function tma-auth để verify Telegram initData
          // và nhận JWT để set Supabase session (vượt qua RLS bình thường)
          const supabaseUrl: string = (supabase as any).supabaseUrl
            ?? document.documentElement.getAttribute("data-supabase-url")
            ?? (window as any).ENV?.SUPABASE_URL
            ?? import.meta.env.VITE_SUPABASE_URL
            ?? "https://mlyowmvrpjtqruramrhp.supabase.co";

          const res = await fetch(`${supabaseUrl}/functions/v1/tma-auth`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData: tg.initData }),
          });

          const json = await res.json();

          if (res.status === 404 || json.error === "unlinked") {
            setAuthState("unlinked");
            return;
          }
          if (!res.ok || json.error) {
            console.error("tma-auth error:", json.error);
            setAuthState("error");
            return;
          }

          // Exchange magic link token_hash cho session Supabase thật
          // (dùng verifyOtp vì project đã migrate sang asymmetric JWT signing)
          const { error: otpError } = await supabase.auth.verifyOtp({
            token_hash: json.token_hash,
            type: "magiclink",
          });

          if (otpError) {
            console.error("verifyOtp error:", otpError.message);
            setAuthState("error");
            return;
          }

          setLinkedUserId(json.user_id);
          setAuthState("ok");
        } else if (isLocalhost) {
          // Dev: dùng session đang đăng nhập trên browser
          const { data: existing } = await supabase.auth.getSession();
          if (existing.session) {
            setAuthState("ok");
          } else {
            setAuthState("ok"); // Render app, upsertEntry sẽ fail gracefully nếu chưa auth
          }
        } else {
          const { data: existing } = await supabase.auth.getSession();
          if (existing.session) {
            setAuthState("ok");
          } else {
            setAuthState("unlinked");
          }
        }
      } catch {
        setAuthState("error");
      }
    }

    initAuth();
  }, []);


  // ── Load entries & user symbols ──────────────────────────────────────────────
  useEffect(() => {
    if (authState !== "ok") return;

    // Fetch entries — RLS hoạt động bình thường sau setSession
    fetchEntries()
      .then(setEntries)
      .catch(() => {});

    // Fetch non-forex symbols from DB (same source as web app)
    supabase
      .from("symbols")
      .select("name, is_forex")
      .order("name", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          // Filter out forex symbols, same as web app Bias tab
          const nonForex = data
            .filter((s: any) => !s.is_forex)
            .map((s: any) => s.name as string);
          setUserAssets(nonForex);
        }
      })
      .catch(() => {});
  }, [authState, linkedUserId]);

  // ── Countdown timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setCountdown(getSecondsUntilCutoff()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Telegram theme ────────────────────────────────────────────────────────────
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, []);

  // ── Save handler ─────────────────────────────────────────────────────────────
  const handleSave = useCallback(async (updated: DayEntry) => {
    await upsertEntry(updated);
    setEntries((prev) => {
      const filtered = prev.filter((e) => !(e.date === updated.date && e.asset === updated.asset));
      return [...filtered, updated];
    });
  }, []);

  // ── Streak stats ──────────────────────────────────────────────────────────────
  const stats = calculateStreak(entries);
  const isBefore11 = new Date().getUTCHours() + 7 < 11;
  const cutoffLabel = isBefore11 ? `Ngày GD: ${tradingDate} (Hôm qua)` : `Ngày GD: ${tradingDate}`;

  // ── Render ────────────────────────────────────────────────────────────────────
  if (authState === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#00050a" }}>
        <div style={{ textAlign: "center", color: "#778792" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⟳</div>
          <p>Đang tải...</p>
        </div>
      </div>
    );
  }

  if (authState === "unlinked") {
    return (
      <div className="phone">
        <div className="glow" />
        <NotLinkedScreen />
      </div>
    );
  }

  if (authState === "error") {
    return (
      <div className="phone">
        <div className="glow" />
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <p style={{ color: "#778792" }}>Có lỗi kết nối. Thử lại sau.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="phone">
      <div className="glow" />

      {/* Header */}
      <div className="header">
        <div className="appbar">
          <div className="logo">TJ</div>
          <div className="title">
            <b style={{ fontSize: 14 }}>Trading Journal</b>
            <span>{cutoffLabel}</span>
          </div>
          <div className="header-streak">
            <span className="fire">🔥</span>
            <div>
              <b style={{ fontSize: 15 }}>{stats.currentStreak}</b>
              <small>streak</small>
            </div>
          </div>
        </div>

        {/* NY Cutoff countdown */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(145deg, #0d1f28, #081219)",
            border: "1px solid #1e3540",
            borderRadius: 14,
            padding: "10px 14px",
            marginBottom: 14,
          }}
        >
          <div>
            <div style={{ color: "#778792", fontSize: 11, marginBottom: 2 }}>NY Cutoff (11:00 AM VN)</div>
            <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, color: "#2cc7b4" }}>
              {fmtCountdown(countdown)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 24 }}>{isBefore11 ? "🌙" : "☀️"}</div>
            <div style={{ color: "#778792", fontSize: 11 }}>{isBefore11 ? "Trước cutoff" : "Sau cutoff"}</div>
          </div>
        </div>
      </div>

      {/* Bias Tab */}
      {tab === "bias" && (() => {
        // Chỉ hiển thị assets đã có entry trong DB cho ngày giao dịch
        const todayAssets = userAssets.filter((a) =>
          entries.some((e) => e.date === tradingDate && e.asset === a)
        );
        // Assets chưa có entry → dùng cho sheet thêm mới
        const availableToAdd = userAssets.filter(
          (a) => !entries.some((e) => e.date === tradingDate && e.asset === a)
        );
        const visibleAssets =
          selectedAsset === TODAY_CHIP
            ? todayAssets
            : todayAssets.filter((a) => a === selectedAsset);

        // Tính tổng TF filled / total để hiển thị trong section header
        const isMonday = weekdayOf(tradingDate) === "MON";
        const isFirstOfMonth = tradingDate.endsWith("-01");
        const showMonthlyStat = isMonday || isFirstOfMonth;
        let totalTFAll = 0;
        let completedTFAll = 0;
        for (const a of todayAssets) {
          const entry = entries.find((e) => e.date === tradingDate && e.asset === a);
          if (!entry) continue;
          const sessions = getSessionsForAsset(a);
          const isSplit = sessions.includes("NY AM");
          // Match tfGrid logic exactly (no slice)
          const tfCount = [
            ...(showMonthlyStat ? [entry.monthlyBias] : []),
            entry.weeklyBias,
            entry.dailyBias,
            ...(isSplit
              ? [entry.h4["ASIA"]?.bias, entry.h4["LDN"]?.bias, entry.h4["NY AM"]?.bias, entry.h4["NY PM"]?.bias]
              : [entry.h4["ASIA"]?.bias, entry.h4["LDN"]?.bias, entry.h4["NY"]?.bias]
            ),
          ];
          totalTFAll += tfCount.length;
          completedTFAll += tfCount.filter((b) => b !== undefined && b !== null).length;
        }

        return (
          <div className="screen active">
            {/* Asset scroll filter */}
            <div className="asset-scroll">
              <button
                className={`chip${selectedAsset === TODAY_CHIP ? " active" : ""}`}
                onClick={() => setSelectedAsset(TODAY_CHIP)}
                style={{ fontSize: 12 }}
              >
                ▣ Today
              </button>
              {todayAssets.map((a) => (
                <button
                  key={a}
                  className={`chip${selectedAsset === a ? " active" : ""}`}
                  onClick={() => setSelectedAsset(a)}
                  style={{ fontSize: 12 }}
                >
                  {a}
                </button>
              ))}
            </div>

            {/* Section header: "All biases today" + nút + FAB */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "4px 2px 10px",
                flexShrink: 0,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#f4f7f8" }}>
                  All biases today
                </div>
                <div style={{ fontSize: 11, color: "#4a6070", marginTop: 2 }}>
                  {userAssets.length} assets
                  {todayAssets.length > 0 && ` · ${completedTFAll}/${totalTFAll} completed`}
                </div>
              </div>
              {availableToAdd.length > 0 && (
                <button
                  onClick={() => setShowAddSheet(true)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #25c7ae, #0f958c)",
                    border: "none",
                    color: "#fff",
                    fontSize: 22,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    boxShadow: "0 4px 14px rgba(37,199,174,0.4)",
                    lineHeight: 1,
                    paddingBottom: 1,
                  }}
                >
                  +
                </button>
              )}
            </div>

            {/* Asset cards */}
            <div className="asset-list">
              {userAssets.length === 0 ? (
                <div style={{ textAlign: "center", color: "#778792", padding: "32px 0", fontSize: 13 }}>
                  Đang tải...
                </div>
              ) : visibleAssets.length === 0 ? (
                // Chưa có entry nào hôm nay
                <div style={{ textAlign: "center", color: "#778792", padding: "48px 20px" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                  <p style={{ fontSize: 14, marginBottom: 4 }}>Chưa có bias nào hôm nay</p>
                  <p style={{ fontSize: 12, color: "#4a6070" }}>Bấm <b style={{ color: "#2cc7b4" }}>+</b> để thêm cặp đầu tiên</p>
                </div>
              ) : (
                visibleAssets.map((asset) => {
                  const entry = entries.find((e) => e.date === tradingDate && e.asset === asset);
                  return (
                    <AssetCard
                      key={asset}
                      asset={asset}
                      entry={entry}
                      tradingDate={tradingDate}
                      onSave={handleSave}
                    />
                  );
                })
              )}
            </div>

            {/* Bottom Sheet: chọn asset để thêm */}
            {showAddSheet && (
              <>
                {/* Overlay */}
                <div
                  onClick={() => setShowAddSheet(false)}
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.55)",
                    zIndex: 90,
                  }}
                />
                {/* Sheet */}
                <div
                  style={{
                    position: "fixed",
                    bottom: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "100%",
                    maxWidth: 430,
                    background: "#0d1f28",
                    borderRadius: "20px 20px 0 0",
                    border: "1px solid #1e3540",
                    zIndex: 100,
                    padding: "16px 0 32px",
                    maxHeight: "70vh",
                    overflowY: "auto",
                  }}
                >
                  {/* Handle */}
                  <div style={{ width: 36, height: 4, background: "#2a4050", borderRadius: 2, margin: "0 auto 16px" }} />
                  <div style={{ padding: "0 16px 12px", borderBottom: "1px solid #1e3540" }}>
                    <b style={{ fontSize: 15, color: "#f4f7f8" }}>Chọn cặp để thêm bias</b>
                  </div>
                  {availableToAdd.map((asset) => (
                    <button
                      key={asset}
                      disabled={addingAsset === asset}
                      onClick={async () => {
                        setAddingAsset(asset);
                        const newEntry = emptyEntry(tradingDate, asset);
                        await handleSave(newEntry);
                        setSelectedAsset(asset);
                        setShowAddSheet(false);
                        setAddingAsset(null);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        width: "100%",
                        padding: "12px 16px",
                        background: addingAsset === asset ? "#142030" : "transparent",
                        border: "none",
                        borderBottom: "1px solid #0f1e28",
                        color: "#f4f7f8",
                        cursor: "pointer",
                        textAlign: "left",
                        fontSize: 14,
                        fontWeight: 600,
                        opacity: addingAsset !== null && addingAsset !== asset ? 0.4 : 1,
                      }}
                    >
                      <div style={{
                        width: 34, height: 34, borderRadius: 9,
                        background: "#1a2a2e",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, overflow: "hidden",
                      }}>
                        {getAssetIconUrl(asset) ? (
                          <img
                            src={getAssetIconUrl(asset)!}
                            alt={asset}
                            style={{ width: 22, height: 22, objectFit: "contain" }}
                            onError={(ev) => {
                              const el = ev.currentTarget;
                              el.style.display = "none";
                              el.parentElement!.innerHTML = `<span style="font-size:10px;color:#8fe4d8;font-weight:700">${asset.replace("1!", "").slice(0, 3)}</span>`;
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: 10, color: "#8fe4d8", fontWeight: 700 }}>
                            {asset.replace("1!", "").slice(0, 3)}
                          </span>
                        )}
                      </div>
                      {asset}
                      {addingAsset === asset && (
                        <span style={{ marginLeft: "auto", color: "#2cc7b4", fontSize: 12 }}>Đang thêm...</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* Streak Tab */}
      {tab === "streak" && <StreakScreen entries={entries} />}

      {/* Trades Tab */}
      {tab === "trades" && <TradesScreen entries={entries} tradingDate={tradingDate} />}

      {/* Bottom Nav */}
      <nav className="bottom">
        <button
          id="tg-nav-bias"
          className={`navbtn${tab === "bias" ? " active" : ""}`}
          onClick={() => setTab("bias")}
        >
          <span>📊</span>
          <small>Bias</small>
        </button>
        <button
          id="tg-nav-streak"
          className={`navbtn${tab === "streak" ? " active" : ""}`}
          onClick={() => setTab("streak")}
        >
          <span>🔥</span>
          <small>Streak</small>
        </button>
        <button
          id="tg-nav-trades"
          className={`navbtn${tab === "trades" ? " active" : ""}`}
          onClick={() => setTab("trades")}
        >
          <span>📋</span>
          <small>Trades</small>
        </button>
      </nav>
    </div>
  );
}

// ─── Route ────────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/tg")({
  component: TgMiniApp,
});
