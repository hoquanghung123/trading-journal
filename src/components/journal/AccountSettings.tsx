import { Mt5Settings } from "./Mt5Integration";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSettings, updateSettings, type UserSettings } from "@/lib/settings";
import { fetchMyProfile } from "@/lib/journal";
import { useSymbols } from "@/lib/symbols";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BackupButton } from "@/components/dashboard/BackupButton";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const ADMIN_EMAIL = "bsleducduy@gmail.com";

const PRESET_COLORS = [
  { name: "Forest", hex: "#4C763B", deep: "#3B5E2E" },
  { name: "Blue", hex: "#0c3299", deep: "#08246e" },
  { name: "Orange", hex: "#f97316", deep: "#c2410c" },
  { name: "Purple", hex: "#7c3aed", deep: "#5b21b6" },
  { name: "Slate", hex: "#475569", deep: "#334155" },
  { name: "Amber", hex: "#d97706", deep: "#b45309" },
];

const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "AUD", "NZD", "JPY", "CAD"];
const IMPACTS = [
  { id: "high", name: "High", color: "bg-destructive" },
  { id: "medium", name: "Medium", color: "bg-orange-500" },
  { id: "low", name: "Low", color: "bg-amber-400", desc: "Crude inventories only" },
  { id: "holiday", name: "Holiday", color: "bg-slate-400" },
];

type FoldId = "rituals" | "news" | "local" | "assets";

function presetFor(hex?: string) {
  return PRESET_COLORS.find((c) => c.hex.toLowerCase() === (hex || "").toLowerCase());
}

function darkenHex(hex: string) {
  const preset = presetFor(hex);
  if (preset) return preset.deep;
  const n = hex.replace("#", "");
  if (n.length !== 6) return hex;
  const v = parseInt(n, 16);
  const r = Math.max(0, ((v >> 16) & 255) - 24);
  const g = Math.max(0, ((v >> 8) & 255) - 24);
  const b = Math.max(0, (v & 255) - 24);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export function AccountSettings({ onManageAssets }: { onManageAssets?: () => void }) {
  const qc = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [local, setLocal] = useState<Partial<UserSettings>>({});
  const [openFold, setOpenFold] = useState<FoldId | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const debounceRef = useRef<Record<string, number>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      setUser(u ? { id: u.id, email: u.email } : null);
    });
  }, []);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["user_settings"],
    queryFn: fetchSettings,
  });
  const { data: profile } = useQuery({
    queryKey: ["my_profile"],
    queryFn: fetchMyProfile,
  });
  const { data: symbols = [] } = useSymbols();

  useEffect(() => {
    if (settings) setLocal(settings);
  }, [settings]);

  useEffect(() => {
    if (!local.primaryColor) return;
    document.documentElement.style.setProperty("--primary", local.primaryColor);
  }, [local.primaryColor]);

  useEffect(() => {
    const onFocus = () => qc.invalidateQueries({ queryKey: ["user_settings"] });
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [qc]);

  const mutation = useMutation({
    mutationFn: (patch: Partial<UserSettings>) => updateSettings(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_settings"] });
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1600);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchNow = useCallback(
    (patch: Partial<UserSettings>) => {
      setLocal((prev) => ({ ...prev, ...patch }));
      mutation.mutate(patch);
    },
    [mutation],
  );

  const patchDebounced = useCallback(
    (key: string, patch: Partial<UserSettings>) => {
      setLocal((prev) => ({ ...prev, ...patch }));
      window.clearTimeout(debounceRef.current[key]);
      debounceRef.current[key] = window.setTimeout(() => mutation.mutate(patch), 400);
    },
    [mutation],
  );

  const telegramOn = !!local.telegramChatId;
  const gradingOn = !!local.showTradeGrade;
  const accent = local.primaryColor || "#4C763B";
  const accentDeep = darkenHex(accent);
  const accentName = presetFor(accent)?.name ?? accent;
  const displayName = profile?.displayName || user?.email?.split("@")[0] || "Trader";
  const initial = (displayName.replace(/[^A-Za-z0-9]/g, "").charAt(0) || "?").toUpperCase();
  const botUser = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "ChartmateBot";
  const biasCount = symbols.filter((s) => !s.isForex).length;
  const fxCount = symbols.filter((s) => s.isForex).length;
  const assetsSummary = `${biasCount} on Bias desk · ${fxCount} FX pair${fxCount === 1 ? "" : "s"}`;

  const newsSummary = useMemo(() => {
    const ccys = (local.forexNewsCurrencies || []).slice(0, 4).join(" ");
    const impacts = (local.forexNewsImpacts || [])
      .map((id) => IMPACTS.find((i) => i.id === id)?.name)
      .filter(Boolean)
      .join(" + ");
    return `${ccys || "No pairs"} · ${impacts || "No impact"} · ${local.forexNewsTimeDaily || "21:00"} GMT+7`;
  }, [local.forexNewsCurrencies, local.forexNewsImpacts, local.forexNewsTimeDaily]);

  const sessionSummary = `${local.asianTime || "07:30"} · ${local.londonTime || "13:00"} · ${local.nyTime || "19:00"} GMT+7`;

  const scanSub = !telegramOn && !gradingOn
    ? "1 block · 1 warning · alerts not on phone"
    : !telegramOn
      ? "1 block · alerts not on phone"
      : !gradingOn
        ? "1 warning left (grading)"
        : "Desk is live";

  const toggleFold = (id: FoldId) => setOpenFold((cur) => (cur === id ? null : id));

  const toggleCurrency = (code: string) => {
    const cur = local.forexNewsCurrencies || [];
    const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
    patchNow({ forexNewsCurrencies: next });
  };

  const toggleImpact = (id: string) => {
    const cur = local.forexNewsImpacts || [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    patchNow({ forexNewsImpacts: next });
  };

  if (isLoading || !user) {
    return (
      <div className="flex h-full min-h-[40vh] items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-background animate-in fade-in duration-500">
      <div className="mx-auto max-w-4xl space-y-3 p-4 lg:p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-lg lg:text-2xl font-black tracking-tight text-foreground">Desk</h1>
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{scanSub}</p>
          </div>
          <p
            className={cn(
              "text-[11px] font-bold transition-opacity",
              mutation.isPending || savedFlash ? "opacity-100 text-primary" : "opacity-0",
            )}
          >
            {mutation.isPending ? "Saving…" : "Saved"}
          </p>
        </div>

        <Mt5Settings />
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-col gap-5 p-4 lg:flex-row lg:p-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt=""
                    className="h-14 w-14 rounded-2xl object-cover"
                    style={{ background: `linear-gradient(135deg, ${accent}, ${accentDeep})` }}
                  />
                ) : (
                  <div
                    className="grid h-14 w-14 place-items-center rounded-2xl text-lg font-black text-white"
                    style={{ background: `linear-gradient(135deg, ${accent}, ${accentDeep})` }}
                  >
                    {initial}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xl font-black tracking-tight text-foreground">{displayName}</p>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {telegramOn ? (
                  <>
                    <span className="inline-flex items-center rounded-lg border border-[#B8DFF0] bg-[#E8F4FA] px-2.5 py-1 text-[11px] font-bold text-[#0088cc] dark:border-[#0088cc]/40 dark:bg-[#0088cc]/15">
                      Telegram connected
                    </span>
                    <button
                      type="button"
                      onClick={() => patchNow({ telegramChatId: "" })}
                      className="h-8 rounded-lg border border-destructive/30 px-3 text-[11px] font-bold text-destructive hover:bg-destructive/10"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center rounded-lg border border-destructive/25 bg-destructive/10 px-2.5 py-1 text-[11px] font-bold text-destructive">
                      Telegram off
                    </span>
                    <a
                      href={`https://t.me/${botUser}?start=${user.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center rounded-lg bg-[#0088cc] px-3 text-[11px] font-bold text-white hover:opacity-90"
                    >
                      Connect
                    </a>
                  </>
                )}
                <span className="rounded-lg border border-border bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                  {accentName}
                </span>
              </div>
              {!telegramOn && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Session bias and news will not reach your phone. Popups on this computer still fire.
                </p>
              )}

              <p className="mt-5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Accent</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.name}
                    aria-label={c.name}
                    aria-pressed={accent.toLowerCase() === c.hex.toLowerCase()}
                    onClick={() => patchNow({ primaryColor: c.hex })}
                    className={cn(
                      "h-9 w-9 rounded-[10px] border-2 transition-shadow",
                      accent.toLowerCase() === c.hex.toLowerCase()
                        ? "border-foreground shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_25%,transparent)]"
                        : "border-transparent hover:border-border",
                    )}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
              <div className="mt-3 flex w-[168px] items-center gap-2">
                <span
                  className="h-8 w-8 shrink-0 rounded-lg border border-border"
                  style={{ backgroundColor: accent }}
                />
                <input
                  value={accent}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val.match(/^#[0-9A-Fa-f]{0,6}$/)) return;
                    setLocal((prev) => ({ ...prev, primaryColor: val }));
                    if (val.length === 7) patchDebounced("primaryColor", { primaryColor: val });
                  }}
                  className="h-8 flex-1 rounded-lg border border-border bg-background px-2 font-mono text-xs font-bold tabular-nums"
                  spellCheck={false}
                  aria-label="Custom hex"
                />
              </div>

              <div className="mt-4 flex max-w-md items-center gap-3">
                <Switch checked={theme === "dark"} onCheckedChange={() => toggleTheme()} />
                <div>
                  <p className="text-sm font-bold text-foreground">Night mode</p>
                  <p className="text-xs text-muted-foreground">Same control as the floating sun.</p>
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Live desk</p>
              <LiveDeskPreview accent={accent} accentDeep={accentDeep} telegramOn={telegramOn} />
              <p className="mt-2 text-[11px] text-muted-foreground">
                {telegramOn
                  ? "Bias Expect in your color."
                  : "Bias Expect in your color. Stamp lifts when Telegram is on."}
              </p>
            </div>
          </div>
        </section>

        {!gradingOn && (
          <div className="flex items-start gap-3 rounded-[14px] border border-amber-200 bg-amber-50 px-3.5 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">Grading is off</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Execution tickets hide A+ / A / B.</p>
            </div>
            <Switch checked={false} onCheckedChange={(on) => patchNow({ showTradeGrade: on })} />
          </div>
        )}

        {gradingOn && (
          <div className="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-card px-3.5 py-3">
            <div>
              <p className="text-sm font-bold text-foreground">Trade grading</p>
              <p className="text-xs text-muted-foreground">A+ / A / B on the execution ticket.</p>
            </div>
            <Switch checked onCheckedChange={(on) => patchNow({ showTradeGrade: on })} />
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
          <Fold
            open={openFold === "rituals"}
            onToggle={() => toggleFold("rituals")}
            title="Session bias"
            summary={sessionSummary}
            degraded={!telegramOn}
            degradedNote="Won’t send"
          >
            {!telegramOn && (
              <p className="mb-2 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                Times still save. Telegram is what delivers them.
              </p>
            )}
            <ReminderRow
              label="Asia bias"
              tz="GMT+7"
              checked={!!local.asianReminder}
              time={local.asianTime || "07:30"}
              onChecked={(v) => patchNow({ asianReminder: v })}
              onTime={(v) => patchDebounced("asianTime", { asianTime: v })}
            />
            <ReminderRow
              label="London bias"
              tz="GMT+7"
              checked={!!local.londonReminder}
              time={local.londonTime || "13:00"}
              onChecked={(v) => patchNow({ londonReminder: v })}
              onTime={(v) => patchDebounced("londonTime", { londonTime: v })}
            />
            <ReminderRow
              label="NY bias"
              tz="GMT+7"
              checked={!!local.nyReminder}
              time={local.nyTime || "19:00"}
              onChecked={(v) => patchNow({ nyReminder: v })}
              onTime={(v) => patchDebounced("nyTime", { nyTime: v })}
            />
          </Fold>

          <Fold
            open={openFold === "news"}
            onToggle={() => toggleFold("news")}
            title="News desk"
            summary={newsSummary}
            degraded={!telegramOn}
            degradedNote="Needs Telegram"
          >
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-semibold">Send nightly pack</span>
              <Switch
                checked={!!local.forexNewsReminder}
                onCheckedChange={(v) => patchNow({ forexNewsReminder: v })}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {CURRENCIES.map((c) => {
                const on = (local.forexNewsCurrencies || []).includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCurrency(c)}
                    className={cn(
                      "h-7 rounded-md border px-2 text-[10px] font-extrabold",
                      on
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground",
                    )}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {IMPACTS.map((impact) => {
                const on = (local.forexNewsImpacts || []).includes(impact.id);
                return (
                  <button
                    key={impact.id}
                    type="button"
                    onClick={() => toggleImpact(impact.id)}
                    className={cn(
                      "flex items-start gap-2 rounded-xl border p-3 text-left",
                      on ? "border-primary/40 bg-background" : "border-border bg-muted/30 text-muted-foreground",
                    )}
                  >
                    <span className={cn("mt-0.5 h-3 w-3 shrink-0 rounded-full", impact.color)} />
                    <span>
                      <span className="block text-xs font-bold">{impact.name}</span>
                      {impact.desc && (
                        <span className="text-[10px] font-medium text-amber-600">{impact.desc}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-semibold">
                Tomorrow’s news
                <span className="mt-1 flex items-center gap-2">
                  <input
                    type="time"
                    value={local.forexNewsTimeDaily || "21:00"}
                    onChange={(e) => patchDebounced("forexNewsTimeDaily", { forexNewsTimeDaily: e.target.value })}
                    className="h-9 flex-1 rounded-lg border border-border bg-background px-2 font-mono text-xs font-bold"
                  />
                  <span className="w-16 text-[10px] font-bold text-muted-foreground">GMT+7</span>
                </span>
              </label>
              <label className="text-xs font-semibold">
                Weekly pack
                <span className="mt-1 flex items-center gap-2">
                  <input
                    type="time"
                    value={local.forexNewsTimeWeekly || "08:00"}
                    onChange={(e) => patchDebounced("forexNewsTimeWeekly", { forexNewsTimeWeekly: e.target.value })}
                    className="h-9 flex-1 rounded-lg border border-border bg-background px-2 font-mono text-xs font-bold"
                  />
                  <span className="w-16 text-[10px] font-bold text-muted-foreground">Sun GMT+7</span>
                </span>
              </label>
            </div>
          </Fold>

          <Fold
            open={openFold === "local"}
            onToggle={() => toggleFold("local")}
            title="This computer"
            summary="Popups still work without Telegram"
          >
            <ReminderRow
              label="Daily psychology"
              tz="Local"
              checked={!!local.dailyReminder}
              time={local.dailyReminderTime || "08:00"}
              onChecked={(v) => patchNow({ dailyReminder: v })}
              onTime={(v) => patchDebounced("dailyReminderTime", { dailyReminderTime: v })}
            />
            <ReminderRow
              label="Weekend review"
              tz="Local"
              checked={!!local.weeklyReminder}
              time={local.weeklyReminderTime || "09:00"}
              onChecked={(v) => patchNow({ weeklyReminder: v })}
              onTime={(v) => patchDebounced("weeklyReminderTime", { weeklyReminderTime: v })}
            />
          </Fold>

          <Fold
            open={openFold === "assets"}
            onToggle={() => toggleFold("assets")}
            title="Assets"
            summary={assetsSummary}
          >
            <p className="font-mono text-sm font-bold text-muted-foreground">
              {symbols.length ? symbols.map((s) => s.name).join(" · ") : "No symbols yet."}
            </p>
            {onManageAssets && (
              <button
                type="button"
                onClick={onManageAssets}
                className="mt-3 h-9 rounded-xl border border-border px-3 text-xs font-bold hover:bg-muted"
              >
                Manage symbols
              </button>
            )}
          </Fold>
        </div>

        {user.email === ADMIN_EMAIL && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShieldAlert className="h-4 w-4" />
              <h2 className="text-sm font-bold text-foreground">Admin backup</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Export the database as SQL and store a copy on R2. Visible only to the system admin.
            </p>
            <div className="mt-3">
              <BackupButton />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function LiveDeskPreview({
  accent,
  accentDeep,
  telegramOn,
}: {
  accent: string;
  accentDeep: string;
  telegramOn: boolean;
}) {
  return (
    <div className="relative grid h-[148px] w-full overflow-hidden rounded-xl border border-border bg-background shadow-sm sm:h-[168px] sm:w-[260px] grid-cols-[72px_1fr]">
      <div
        className="flex flex-col gap-1.5 p-2"
        style={{ background: `linear-gradient(180deg, ${accent}, ${accentDeep})` }}
      >
        <span className="block h-2 w-8 rounded bg-white/30" />
        <span className="block h-2 w-10 rounded bg-white" />
        <span className="block h-2 w-7 rounded bg-white/30" />
        <span className="block h-2 w-9 rounded bg-white/30" />
        <span className="mt-auto block h-2 w-8 rounded bg-white/30" />
      </div>
      <div className="flex flex-col gap-2 bg-muted/40 p-2.5">
        <div className="h-3 w-16 rounded bg-border" />
        <div className="flex-1 rounded-md border border-border bg-card p-1.5">
          <div className="mb-1.5 h-1.5 w-10 rounded" style={{ background: accent }} />
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded bg-muted" />
            <div className="h-1.5 w-4/5 rounded bg-muted" />
            <div className="h-1.5 w-3/5 rounded bg-muted" />
          </div>
        </div>
        <div className="grid h-5 place-items-center rounded text-[8px] font-black text-white" style={{ background: accent }}>
          New trade
        </div>
      </div>
      {!telegramOn && (
        <div className="absolute right-2 top-2 max-w-[140px] rounded-lg bg-foreground/80 px-2 py-1.5 text-[10px] font-bold leading-snug text-background">
          Phone channel dark · news won’t land
        </div>
      )}
    </div>
  );
}

function Fold({
  open,
  onToggle,
  title,
  summary,
  degraded,
  degradedNote,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  summary: string;
  degraded?: boolean;
  degradedNote?: string;
  children: ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <div
        className={cn(
          degraded &&
            "bg-muted/40 bg-[repeating-linear-gradient(-45deg,transparent,transparent_8px,var(--border)_8px,var(--border)_9px)]",
        )}
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left">
          <span>
            <span className="block text-sm font-bold text-foreground">{title}</span>
            <span className="block text-xs text-muted-foreground">{summary}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {degraded && degradedNote && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                {degradedNote}
              </span>
            )}
            <span className="text-xs font-bold text-muted-foreground">{open ? "Hide" : "Show"}</span>
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">{children}</CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function ReminderRow({
  label,
  tz,
  checked,
  time,
  onChecked,
  onTime,
}: {
  label: string;
  tz: string;
  checked: boolean;
  time: string;
  onChecked: (v: boolean) => void;
  onTime: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-1 sm:flex-nowrap sm:gap-3">
      <Switch checked={checked} onCheckedChange={onChecked} />
      <span className="min-w-0 flex-1 text-sm font-semibold">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="time"
          value={time}
          onChange={(e) => onTime(e.target.value)}
          className="h-9 w-[108px] rounded-lg border border-border bg-background px-2 font-mono text-xs font-bold"
        />
        <span className="w-12 text-[10px] font-bold text-muted-foreground">{tz}</span>
      </span>
    </div>
  );
}
