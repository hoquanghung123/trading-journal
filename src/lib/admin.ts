export type BackupStatus = "success" | "failed" | "running";

export interface BackupLog {
  id: string;
  date: string;
  db_status: BackupStatus;
  r2_status: BackupStatus;
  db_size_bytes: number | null;
  r2_files_count: number | null;
  r2_size_bytes: number | null;
  log_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface RealtimeSyncLog {
  id: string;
  path: string;
  status: "success" | "failed" | "starting";
  error_message: string | null;
  created_at: string;
}

export type AdminBackupTab = "system" | "realtime" | "history";

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function isSameLocalDay(dateStr: string, now = new Date()): boolean {
  const d = new Date(dateStr);
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

export function backupFailed(log: BackupLog): boolean {
  return log.db_status === "failed" || log.r2_status === "failed";
}

export function dedupeRealtimeLogs(logs: RealtimeSyncLog[]): RealtimeSyncLog[] {
  const seen = new Set<string>();
  const out: RealtimeSyncLog[] = [];
  for (const log of logs) {
    if (log.path && !seen.has(log.path)) {
      seen.add(log.path);
      out.push(log);
    }
  }
  return out;
}

export function sortFailedFirst<T>(items: T[], isFailed: (item: T) => boolean): T[] {
  return [...items].sort((a, b) => {
    const fa = isFailed(a);
    const fb = isFailed(b);
    if (fa === fb) return 0;
    return fa ? -1 : 1;
  });
}

export function parseBackupTab(value: unknown): AdminBackupTab {
  if (value === "realtime" || value === "history" || value === "system") return value;
  return "system";
}

export function isImpersonating(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("chartmate_original_admin_session");
}
