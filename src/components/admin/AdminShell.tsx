import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAdminPulse } from "@/components/admin/useAdminPulse";
import { parseBackupTab, type AdminBackupTab } from "@/lib/admin";
import type { ReactNode } from "react";

type NavItem = {
  id: string;
  label: string;
  to: "/admin" | "/admin/users" | "/admin/backups";
  tab?: AdminBackupTab;
};

const NAV: NavItem[] = [
  { id: "overview", label: "Tổng quan", to: "/admin" },
  { id: "users", label: "Users", to: "/admin/users" },
  { id: "system", label: "Backup ngày", to: "/admin/backups", tab: "system" },
  { id: "realtime", label: "Sync chart", to: "/admin/backups", tab: "realtime" },
  { id: "history", label: "Rollback", to: "/admin/backups", tab: "history" },
];

function currentPage(pathname: string, tab: AdminBackupTab) {
  if (pathname.startsWith("/admin/users")) return "users";
  if (pathname.startsWith("/admin/backups")) return tab;
  return "overview";
}

function pageTitle(page: string) {
  return NAV.find((item) => item.id === page)?.label ?? "Tổng quan";
}

function Led({ tone }: { tone: "ok" | "warn" | "bad" }) {
  const color =
    tone === "ok" ? "bg-primary" : tone === "warn" ? "bg-warning" : "bg-destructive";
  return (
    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} />
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const pulse = useAdminPulse();
  const rawSearch = location.search as { tab?: unknown } | string;
  const tab = parseBackupTab(
    typeof rawSearch === "string"
      ? new URLSearchParams(rawSearch.startsWith("?") ? rawSearch : `?${rawSearch}`).get("tab")
      : rawSearch?.tab,
  );
  const page = currentPage(location.pathname, tab);
  const title = pageTitle(page);
  const todayLabel = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });

  const backupTone = pulse.backupRunning ? "warn" : pulse.backupOk ? "ok" : pulse.lastSync ? "bad" : "warn";
  const backupText = pulse.backupRunning
    ? "Đang chạy"
    : pulse.backupOk
      ? "Success"
      : pulse.lastSync
        ? "Failed"
        : "Chưa có";

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex">
      <aside className="hidden md:flex w-[212px] shrink-0 flex-col border-r border-border bg-card py-5 px-3">
        <div className="flex items-center gap-2 px-2 mb-6">
          <div className="w-8 h-8 rounded-lg forest-gradient grid place-items-center text-white text-xs font-bold">
            C
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Chartmate</p>
            <p className="text-[10px] text-muted-foreground">Admin</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 text-[13px] font-medium">
          {NAV.map((item) => {
            const active = page === item.id;
            const badge = item.id === "realtime" && pulse.failedToday.length > 0
              ? pulse.failedToday.length
              : null;
            const className = `flex w-full items-center justify-between rounded-xl px-3 py-2 transition-colors ${
              active
                ? "forest-gradient text-white"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`;
            const label = (
              <>
                <span>{item.label}</span>
                {badge != null && (
                  <span className={`tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    active ? "bg-white/20" : "bg-destructive/10 text-destructive"
                  }`}>
                    {badge}
                  </span>
                )}
              </>
            );
            if (item.tab) {
              return (
                <Link key={item.id} to="/admin/backups" search={{ tab: item.tab }} className={className}>
                  {label}
                </Link>
              );
            }
            return (
              <Link
                key={item.id}
                to={item.to}
                activeOptions={item.to === "/admin" ? { exact: true } : undefined}
                className={className}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <Link
          to="/"
          className="mt-auto mx-1 px-3 py-2 rounded-xl text-[12px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          ← Về Terminal
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="md:hidden flex items-center gap-3 border-b border-border bg-card px-4 h-12">
          <select
            className="flex-1 bg-transparent text-sm font-semibold outline-none"
            value={page}
            onChange={(e) => {
              const next = NAV.find((item) => item.id === e.target.value);
              if (!next) return;
              if (next.tab) {
                navigate({ to: "/admin/backups", search: { tab: next.tab } });
              } else {
                navigate({ to: next.to });
              }
            }}
          >
            {NAV.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <Led tone={pulse.needsAttention ? "warn" : "ok"} />
        </div>

        <div className="shrink-0 space-y-4 border-b border-border bg-card/90 px-5 py-5 lg:px-7">
          <div>
            <h1 className="text-lg font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {todayLabel}
              {pulse.sessionEmail ? (
                <>
                  {" · phiên của "}
                  <span className="font-semibold text-foreground">{pulse.sessionEmail}</span>
                </>
              ) : null}
            </p>
          </div>

          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card md:grid-cols-5">
            <div className="forest-gradient px-4 py-3 text-white col-span-2 md:col-span-1">
              <p className="text-[10px] font-medium text-white/70">Mức ưu tiên</p>
              <p className="mt-1 flex items-center gap-2 font-sans text-[13px] font-semibold tabular-nums">
                <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                  pulse.needsAttention ? "bg-warning" : "bg-white"
                }`} />
                {pulse.needsAttention ? "Cần xem" : "Ổn"}
              </p>
            </div>
            <PulseCell label="Backup lần cuối">
              {pulse.lastSync ? (
                <>
                  {pulse.lastSync.date} · <span className={backupTone === "ok" ? "text-primary" : backupTone === "bad" ? "text-destructive" : "text-warning"}>{backupText}</span>
                </>
              ) : (
                "—"
              )}
            </PulseCell>
            <PulseCell label="Sync chart hôm nay">
              {pulse.failedToday.length > 0 ? (
                <span className="text-destructive">{pulse.failedToday.length} Failed</span>
              ) : (
                <span className="text-primary">{pulse.successTodayCount} Success</span>
              )}
              {pulse.failedToday.length > 0 ? ` · ${pulse.successTodayCount} Success` : null}
            </PulseCell>
            <PulseCell label="OneDrive">
              {pulse.oneDriveLabel}
              {pulse.fileCount ? ` · ${pulse.fileCount.toLocaleString("vi-VN")} tệp` : null}
            </PulseCell>
            <PulseCell label="Đóng vai">
              {pulse.impersonating ? (
                <span className="text-warning">Đang đóng vai</span>
              ) : (
                <span className="text-muted-foreground">Không có phiên</span>
              )}
            </PulseCell>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-5 lg:p-7">{children}</div>
      </div>
    </div>
  );
}

function PulseCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-border px-4 py-3 md:border-t-0 md:border-l">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-sans text-[13px] font-semibold tabular-nums text-foreground">
        {children}
      </p>
    </div>
  );
}
