import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  backupFailed,
  dedupeRealtimeLogs,
  formatBytes,
  isImpersonating,
  isSameLocalDay,
  type BackupLog,
  type RealtimeSyncLog,
} from "@/lib/admin";

export function useAdminPulse() {
  const [impersonating, setImpersonating] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    setImpersonating(isImpersonating());
    supabase.auth.getUser().then(({ data }) => {
      setSessionEmail(data.user?.email ?? null);
    });
  }, []);

  const backupsQuery = useQuery<BackupLog[]>({
    queryKey: ["backup_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backup_logs")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data || []) as BackupLog[];
    },
  });

  const realtimeQuery = useQuery<RealtimeSyncLog[]>({
    queryKey: ["realtime_sync_logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("realtime_sync_logs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as RealtimeSyncLog[];
    },
  });

  const lastSync = backupsQuery.data?.[0];
  const realtimeLogs = dedupeRealtimeLogs(realtimeQuery.data || []);
  const todayLogs = realtimeLogs.filter((log) => isSameLocalDay(log.created_at));
  const failedToday = todayLogs.filter((log) => log.status === "failed");
  const successToday = todayLogs.filter((log) => log.status === "success");
  const failedBackups = (backupsQuery.data || []).filter(backupFailed);
  const oneDriveBytes = lastSync
    ? (lastSync.db_size_bytes || 0) + (lastSync.r2_size_bytes || 0)
    : 0;

  const backupOk =
    lastSync &&
    lastSync.db_status === "success" &&
    lastSync.r2_status === "success";
  const backupRunning =
    lastSync?.db_status === "running" || lastSync?.r2_status === "running";

  const needsAttention = failedToday.length > 0 || failedBackups.length > 0 || backupRunning;

  return {
    sessionEmail,
    impersonating,
    lastSync,
    backupOk,
    backupRunning,
    oneDriveLabel: formatBytes(oneDriveBytes),
    fileCount: lastSync?.r2_files_count ?? 0,
    failedToday,
    successTodayCount: successToday.length,
    failedBackups,
    realtimeLogs,
    needsAttention,
    isLoading: backupsQuery.isLoading || realtimeQuery.isLoading,
  };
}
