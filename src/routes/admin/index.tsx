import { createFileRoute, Link } from "@tanstack/react-router";
import { useAdminPulse } from "@/components/admin/useAdminPulse";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const pulse = useAdminPulse();

  const todos = [
    ...pulse.failedToday.slice(0, 4).map((log) => ({
      id: `sync-${log.id}`,
      tone: "bad" as const,
      title: "Chart không lên OneDrive",
      detail: log.path,
      href: "/admin/backups" as const,
      tab: "realtime" as const,
      action: "Re-sync",
    })),
    ...pulse.failedBackups.slice(0, 2).map((log) => ({
      id: `backup-${log.id}`,
      tone: "bad" as const,
      title: `Backup ${log.date} — ${log.r2_status === "failed" ? "R2 Failed" : "DB Failed"}`,
      detail: log.db_status === "success" ? "SQL xong, ảnh chưa đẩy đủ" : "Sao lưu database lỗi",
      href: "/admin/backups" as const,
      tab: "system" as const,
      action: "Xem log",
    })),
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-bold">Việc cần làm</h2>
          <span className="font-sans tabular-nums text-[11px] text-muted-foreground">
            {todos.length} mục
          </span>
        </div>
        {todos.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-8 text-sm text-muted-foreground">
            Không có ngoại lệ. Backup và sync đang sạch.
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {todos.map((item) => (
              <div key={item.id} className="flex items-center gap-4 px-4 py-3.5">
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                    item.tone === "bad" ? "bg-destructive" : "bg-warning"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{item.title}</p>
                  <p className="text-[12px] text-muted-foreground font-sans tabular-nums truncate">
                    {item.detail}
                  </p>
                </div>
                <Link
                  to={item.href}
                  search={{ tab: item.tab }}
                  className="shrink-0 h-8 px-3 rounded-lg forest-gradient text-white text-[12px] font-semibold grid place-items-center"
                >
                  {item.action}
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[12px] font-semibold text-muted-foreground mb-3">Phần còn lại ổn</p>
          <ul className="space-y-2 text-sm">
            {pulse.backupOk && (
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Postgres backup {pulse.lastSync?.db_size_bytes ? `${Math.round((pulse.lastSync.db_size_bytes) / 1048576 * 10) / 10} MB` : "xong"}
              </li>
            )}
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              {pulse.successTodayCount} chart đồng bộ hôm nay
            </li>
            {!pulse.impersonating && (
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Không có phiên đóng vai
              </li>
            )}
          </ul>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[12px] font-semibold text-muted-foreground mb-3">Lối tắt</p>
          <div className="flex flex-col gap-2 text-sm">
            <Link to="/admin/users" className="font-medium text-foreground hover:text-primary">
              Users — đóng vai để hỗ trợ
            </Link>
            <Link to="/admin/backups" search={{ tab: "history" }} className="font-medium text-foreground hover:text-primary">
              Rollback — khôi phục bản ghi
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
