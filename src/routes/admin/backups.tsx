import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  Database,
  CloudLightning,
  RefreshCw,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  Layers,
  HardDrive,
  Eye,
  ArrowLeft,
  Image as ImageIcon,
  Activity,
  AlertTriangle,
  History,
  Clock,
  ChevronRight,
  Check,
  X,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { syncToOneDrive } from "@/lib/onedrive";

// Server function to manually trigger a re-sync of a specific file from R2 to OneDrive
const manualSyncFileFn = (createServerFn({ method: "POST" }) as any).handler(
  async ({ data: path }: { data: string }) => {
    try {
      const request = getRequest();
      // @ts-ignore
      const rawEnv = request?.context?.cloudflare?.env || request?.context || {};
      const r2 = rawEnv?.R2 || (globalThis as any).R2;
      const rcloneConfig = rawEnv?.RCLONE_CONFIG_ONEDRIVE || (globalThis as any).RCLONE_CONFIG_ONEDRIVE;

      if (!r2) {
        throw new Error("R2 storage binding not found.");
      }
      if (!rcloneConfig) {
        throw new Error("RCLONE_CONFIG_ONEDRIVE config not found.");
      }

      console.log(`Manual sync requested for path: ${path}`);
      const object = await r2.get(path);
      if (!object) {
        throw new Error(`File not found in R2 storage: ${path}`);
      }

      const contentType = object.httpMetadata?.contentType || "image/png";
      const buffer = await object.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      // Trigger the OneDrive sync
      await syncToOneDrive(path, uint8Array, contentType, rcloneConfig);

      return { success: true, message: `Successfully queued sync for ${path}` };
    } catch (err: any) {
      console.error(`Manual sync failed for ${path}:`, err);
      return { success: false, error: err.message };
    }
  }
);

export const Route = createFileRoute("/admin/backups")({
  component: AdminBackupsDashboard,
});

// Helper to format bytes to human readable sizes
function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Helper to format date
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// Helper to format date and time
function formatDateTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }) + " · " + date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

interface BackupLog {
  id: string;
  date: string;
  db_status: "success" | "failed" | "running";
  r2_status: "success" | "failed" | "running";
  db_size_bytes: number | null;
  r2_files_count: number | null;
  r2_size_bytes: number | null;
  log_message: string | null;
  created_at: string;
  updated_at: string;
}

interface RealtimeSyncLog {
  id: string;
  path: string;
  status: "success" | "failed" | "starting";
  error_message: string | null;
  created_at: string;
}

function AdminBackupsDashboard() {
  const [selectedLog, setSelectedLog] = useState<BackupLog | null>(null);
  const [selectedRealtimeLog, setSelectedRealtimeLog] = useState<RealtimeSyncLog | null>(null);
  const [activeTab, setActiveTab] = useState<"system" | "realtime" | "history">("system");

  // PITR States
  const getTodayLocalDate = () => {
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - tzOffset).toISOString().split("T")[0];
  };
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string>(getTodayLocalDate());
  const [historyFilterTable, setHistoryFilterTable] = useState<string>("all");
  const [selectedHistoryVersion, setSelectedHistoryVersion] = useState<any | null>(null);

  // React Query to fetch historical revisions for the selected date and table type
  const { data: historyRevisions, isLoading: isHistoryLoading, refetch: refetchHistory } = useQuery<any[]>({
    queryKey: ["system_history", selectedHistoryDate, historyFilterTable],
    queryFn: async () => {
      if (!selectedHistoryDate) return [];
      
      let query = (supabase as any)
        .from("system_temporal_history")
        .select("*")
        .gte("history_timestamp", `${selectedHistoryDate}T00:00:00+07:00`)
        .lte("history_timestamp", `${selectedHistoryDate}T23:59:59.999+07:00`);

      if (historyFilterTable !== "all") {
        query = query.eq("table_name", historyFilterTable);
      }

      const { data, error } = await query.order("history_timestamp", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: activeTab === "history" && !!selectedHistoryDate,
  });

  // Mutation to restore a specific revision
  const restoreVersionMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const { data, error } = await (supabase as any).rpc("restore_single_system_version", {
        version_id: versionId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Khôi phục bản ghi thành công!", {
        description: "Dữ liệu đã được quay về trạng thái đã chọn.",
      });
      refetchHistory();
      refetch(); // Refetch daily backup logs
    },
    onError: (err: any) => {
      toast.error("Khôi phục thất bại", {
        description: err.message,
      });
    },
  });

  // Mutation to restore bulk batch versions
  const restoreBatchMutation = useMutation({
    mutationFn: async (vars: { batchTimestamp: string; tableName: string }) => {
      const { data, error } = await (supabase as any).rpc("restore_batch_system_versions", {
        batch_timestamp: vars.batchTimestamp,
        target_table: vars.tableName,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Hoàn tác hàng loạt thành công!", {
        description: "Toàn bộ các dòng trong lô đã được khôi phục về trạng thái cũ.",
      });
      refetchHistory();
      refetch(); // Refetch daily backup logs
    },
    onError: (err: any) => {
      toast.error("Khôi phục hàng loạt thất bại", {
        description: err.message,
      });
    },
  });


  // 1. React Query to fetch daily backup logs
  const { data: logs, isLoading, refetch } = useQuery<BackupLog[]>({
    queryKey: ["backup_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backup_logs")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data as BackupLog[];
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasRunning = data?.some(
        (log) => log.db_status === "running" || log.r2_status === "running"
      );
      return hasRunning ? 5000 : false;
    },
  });

  // 2. React Query to fetch real-time sync logs
  const { data: realtimeLogsRaw, isLoading: isRealtimeLoading, refetch: refetchRealtime } = useQuery<RealtimeSyncLog[]>({
    queryKey: ["realtime_sync_logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("realtime_sync_logs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as RealtimeSyncLog[];
    },
    refetchInterval: () => {
      return activeTab === "realtime" ? 10000 : false; // Poll every 10s if we are watching live syncs
    }
  });

  // Deduplicate by path, keeping only the most recent entry for each file (since they are ordered descending by created_at)
  const realtimeLogs: RealtimeSyncLog[] = [];
  const seenPaths = new Set<string>();
  for (const log of realtimeLogsRaw || []) {
    if (log.path && !seenPaths.has(log.path)) {
      seenPaths.add(log.path);
      realtimeLogs.push(log);
    }
  }

  // 3. Mutation to trigger manual file re-sync
  const syncFileMutation = useMutation({
    mutationFn: async (path: string) => {
      const res = await (manualSyncFileFn as any)({ data: path });
      if (!res.success) {
        throw new Error(res.error || "Lỗi đồng bộ thủ công");
      }
      return res;
    },
    onSuccess: () => {
      toast.success("Đã đồng bộ lại tệp tin thành công!");
      refetchRealtime();
    },
    onError: (err: Error) => {
      toast.error("Không thể đồng bộ lại tệp tin", {
        description: err.message,
      });
    },
  });

  // 4. Mutation to trigger backup workflow securely
  const triggerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("trigger-backup-workflow", {
        method: "POST",
      });
      if (error) {
        throw new Error(error.message || "Không thể kích hoạt sao lưu");
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Đã kích hoạt sao lưu!", {
        description: "GitHub Action đang chạy ngầm để xuất Database và R2 sang OneDrive.",
      });
      refetch();
    },
    onError: (err: Error) => {
      toast.error("Không thể kích hoạt sao lưu", {
        description: err.message,
      });
    },
  });

  // Calculate quick stats from system logs
  const totalBackups = logs?.length || 0;
  const lastSync = logs?.[0];
  const successRate = totalBackups && logs
    ? Math.round(
        (logs.filter((l) => l.db_status === "success" && l.r2_status === "success")
          .length /
          totalBackups) *
          100
      )
    : 100;

  const totalOneDriveSpace = lastSync
    ? (lastSync.db_size_bytes || 0) + (lastSync.r2_size_bytes || 0)
    : 0;

  const handleForceSync = () => {
    if (triggerMutation.isPending) return;
    toast.promise(triggerMutation.mutateAsync(), {
      loading: "Đang gửi yêu cầu trigger đến GitHub Actions...",
      success: "Đã kích hoạt sao lưu thành công!",
      error: (err) => `Lỗi: ${err.message}`,
    });
  };

  const handleReSyncFile = (path: string) => {
    if (syncFileMutation.isPending) return;
    toast.promise(syncFileMutation.mutateAsync(path), {
      loading: `Đang gửi yêu cầu đồng bộ lại: ${path.substring(path.indexOf('/') + 1)}...`,
      success: "Đồng bộ ảnh sang OneDrive thành công!",
      error: (err) => `Lỗi: ${err.message}`,
    });
  };

  // Real-time stats calculations
  const isToday = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const todayLogs = realtimeLogs.filter((log) => isToday(log.created_at));
  const countSuccessToday = todayLogs.filter((log) => log.status === "success").length;
  const countFailedToday = todayLogs.filter((log) => log.status === "failed").length;

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 p-6 md:p-10 font-sans relative overflow-hidden">
      {/* Dynamic light glows */}
      <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-15%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 relative z-10">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            Về Terminal
          </a>
          <div className="h-6 px-3 rounded-full border border-primary/20 bg-primary/5 flex items-center justify-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">
              Admin Control Panel
            </span>
          </div>
        </div>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/40">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-glow-cyan">
              OneDrive Backups & Sync
            </h1>
            <p className="text-xs text-muted-foreground/80 font-semibold mt-1">
              Quản lý đồng bộ sao lưu tự động hệ thống định kỳ kết hợp truyền tải biểu đồ thời gian thực (Real-time) sang Microsoft OneDrive.
            </p>
          </div>

          {activeTab === "system" && (
            <button
              onClick={handleForceSync}
              disabled={triggerMutation.isPending || (lastSync && lastSync.db_status === "running")}
              className="inline-flex items-center justify-center gap-3 h-12 px-6 rounded-xl font-black text-xs uppercase tracking-widest text-white forest-gradient hover:opacity-95 active:scale-95 transition-all shadow-lg shadow-primary/10 disabled:opacity-50 disabled:pointer-events-none shrink-0"
            >
              {triggerMutation.isPending || (lastSync && lastSync.db_status === "running") ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Đang chạy sao lưu...
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  Force Sync Now
                </>
              )}
            </button>
          )}

          {activeTab === "realtime" && (
            <button
              onClick={() => refetchRealtime()}
              disabled={isRealtimeLoading}
              className="inline-flex items-center justify-center gap-3 h-12 px-6 rounded-xl font-black text-xs uppercase tracking-widest text-white border border-primary/30 bg-primary/10 hover:bg-primary/20 active:scale-95 transition-all shrink-0"
            >
              <RefreshCw size={14} className={isRealtimeLoading ? "animate-spin" : ""} />
              Làm mới Logs
            </button>
          )}

          {activeTab === "history" && (
            <button
              onClick={() => refetchHistory()}
              disabled={isHistoryLoading}
              className="inline-flex items-center justify-center gap-3 h-12 px-6 rounded-xl font-black text-xs uppercase tracking-widest text-white border border-primary/30 bg-primary/10 hover:bg-primary/20 active:scale-95 transition-all shrink-0"
            >
              <RefreshCw size={14} className={isHistoryLoading ? "animate-spin" : ""} />
              Làm mới Lịch sử
            </button>
          )}
        </div>

        {/* Tabs System Navigation */}
        <div className="flex gap-6 border-b border-border/20">
          <button
            onClick={() => setActiveTab("system")}
            className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all relative ${
              activeTab === "system"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground/60 hover:text-foreground"
            }`}
          >
            System Backups (Hàng Ngày)
            {activeTab === "system" && (
              <span className="absolute bottom-[-2px] left-0 w-full h-[2px] bg-primary blur-[2px]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("realtime")}
            className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all relative flex items-center gap-2 ${
              activeTab === "realtime"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground/60 hover:text-foreground"
            }`}
          >
            Chart Sync Monitor (Real-time)
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            {activeTab === "realtime" && (
              <span className="absolute bottom-[-2px] left-0 w-full h-[2px] bg-primary blur-[2px]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all relative flex items-center gap-2 ${
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground/60 hover:text-foreground"
            }`}
          >
            Temporal Rollback Explorer (PITR)
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/45 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            {activeTab === "history" && (
              <span className="absolute bottom-[-2px] left-0 w-full h-[2px] bg-primary blur-[2px]" />
            )}
          </button>
        </div>

        {/* TAB 1: SYSTEM BACKUPS */}
        {activeTab === "system" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Quick Stats Widgets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Stat 1: Sync Status */}
              <div className="bg-card/40 rounded-2xl p-5 border border-border/50 hover:border-primary/20 transition-all group backdrop-blur-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    <CloudLightning size={18} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Trạng thái mới nhất
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {lastSync ? (
                    lastSync.db_status === "running" ? (
                      <>
                        <Loader2 size={16} className="animate-spin text-amber-500" />
                        <span className="text-lg font-black text-amber-500 uppercase tracking-wider">Đang đồng bộ</span>
                      </>
                    ) : lastSync.db_status === "success" && lastSync.r2_status === "success" ? (
                      <>
                        <CheckCircle2 size={18} className="text-emerald-500" />
                        <span className="text-lg font-black text-emerald-500 uppercase tracking-wider">Đồng bộ xong</span>
                      </>
                    ) : (
                      <>
                        <XCircle size={18} className="text-rose-500" />
                        <span className="text-lg font-black text-rose-500 uppercase tracking-wider">Gặp lỗi</span>
                      </>
                    )
                  ) : (
                    <span className="text-lg font-black text-muted-foreground uppercase tracking-wider">Chưa có dữ liệu</span>
                  )}
                </div>
                <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mt-2">
                  {lastSync ? `Ngày chạy: ${lastSync.date}` : "Chưa thực hiện backup nào"}
                </p>
              </div>

              {/* Stat 2: DB Backup size */}
              <div className="bg-card/40 rounded-2xl p-5 border border-border/50 hover:border-primary/20 transition-all group backdrop-blur-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    <Database size={18} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    SQL Database Backup
                  </span>
                </div>
                <div className="text-lg font-black tracking-tight text-foreground mt-2">
                  {lastSync?.db_size_bytes ? formatBytes(lastSync.db_size_bytes) : "0 Bytes"}
                </div>
                <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mt-2">
                  Lưu trữ định dạng SQL nén
                </p>
              </div>

              {/* Stat 3: R2 synced assets count */}
              <div className="bg-card/40 rounded-2xl p-5 border border-border/50 hover:border-primary/20 transition-all group backdrop-blur-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    <Layers size={18} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    R2 Charts Đã Đồng Bộ
                  </span>
                </div>
                <div className="text-lg font-black tracking-tight text-foreground mt-2">
                  {lastSync?.r2_files_count ? `${lastSync.r2_files_count.toLocaleString()} Tệp` : "0 Tệp"}
                </div>
                <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mt-2">
                  Dung lượng: {lastSync?.r2_size_bytes ? formatBytes(lastSync.r2_size_bytes) : "0 Bytes"}
                </p>
              </div>

              {/* Stat 4: Total OneDrive Space used */}
              <div className="bg-card/40 rounded-2xl p-5 border border-border/50 hover:border-primary/20 transition-all group backdrop-blur-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    <HardDrive size={18} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Dung lượng trên OneDrive
                  </span>
                </div>
                <div className="text-lg font-black tracking-tight text-foreground mt-2">
                  {formatBytes(totalOneDriveSpace)}
                </div>
                <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mt-2">
                  Tỷ lệ sao lưu thành công: {successRate}%
                </p>
              </div>
            </div>

            {/* Backups History Table */}
            <div className="bg-card/30 rounded-3xl border border-border/50 overflow-hidden backdrop-blur-md">
              <div className="px-6 py-5 border-b border-border/40 bg-card/10 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                  Lịch sử sao lưu chi tiết mỗi ngày
                </h2>
                {isLoading && <Loader2 size={16} className="animate-spin text-primary" />}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground/60 font-black uppercase tracking-widest">
                      <th className="px-6 py-4">Ngày sao lưu</th>
                      <th className="px-6 py-4 text-center">Status DB</th>
                      <th className="px-6 py-4 text-center">Status R2 Sync</th>
                      <th className="px-6 py-4">Database Size</th>
                      <th className="px-6 py-4">Số lượng ảnh R2</th>
                      <th className="px-6 py-4">Dung lượng R2</th>
                      <th className="px-6 py-4 text-center">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20 font-semibold text-muted-foreground">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 size={24} className="animate-spin text-primary" />
                            <span className="text-xs tracking-widest font-black uppercase text-muted-foreground/40">
                              Đang tải lịch sử backup...
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : logs && logs.length > 0 ? (
                      logs.map((log) => (
                        <tr
                          key={log.id}
                          className="hover:bg-muted/10 transition-colors group/row"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-foreground flex items-center gap-3">
                            <Calendar size={14} className="text-primary/60" />
                            <span className="font-bold">{formatDate(log.date)}</span>
                          </td>

                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            {log.db_status === "success" ? (
                              <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Success
                              </span>
                            ) : log.db_status === "running" ? (
                              <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Loader2 size={10} className="animate-spin" />
                                Running
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                Failed
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            {log.r2_status === "success" ? (
                              <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Synced
                              </span>
                            ) : log.r2_status === "running" ? (
                              <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Loader2 size={10} className="animate-spin" />
                                Syncing
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                Failed
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            {log.db_size_bytes ? formatBytes(log.db_size_bytes) : "—"}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            {log.r2_files_count !== null ? log.r2_files_count.toLocaleString() : "—"}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            {log.r2_size_bytes ? formatBytes(log.r2_size_bytes) : "—"}
                          </td>

                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all active:scale-90"
                              title="Xem nhật ký chạy chi tiết"
                            >
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 size={24} className="text-muted-foreground/30 animate-pulse" />
                            <span className="text-xs tracking-widest font-black uppercase text-muted-foreground/30">
                              Chưa có nhật ký sao lưu nào. Hãy nhấn Force Sync để tạo lần đầu!
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: REAL-TIME CHART SYNC MONITOR */}
        {activeTab === "realtime" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Real-time Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Stat 1: Success Today */}
              <div className="bg-card/40 rounded-2xl p-5 border border-border/50 hover:border-primary/20 transition-all group backdrop-blur-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                    <CheckCircle2 size={18} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Đồng bộ hôm nay
                  </span>
                </div>
                <div className="text-2xl font-black tracking-tight text-emerald-400 mt-2">
                  {countSuccessToday} <span className="text-xs text-muted-foreground/60 font-semibold font-sans uppercase">Tệp tin</span>
                </div>
                <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mt-2">
                  Ghi nhận thành công thời gian thực
                </p>
              </div>

              {/* Stat 2: Failed Today */}
              <div className="bg-card/40 rounded-2xl p-5 border border-border/50 hover:border-primary/20 transition-all group backdrop-blur-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2.5 rounded-xl group-hover:scale-110 transition-transform ${countFailedToday > 0 ? "bg-rose-500/10 text-rose-400" : "bg-primary/10 text-primary"}`}>
                    {countFailedToday > 0 ? <AlertTriangle size={18} /> : <XCircle size={18} />}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Lỗi đồng bộ hôm nay
                  </span>
                </div>
                <div className={`text-2xl font-black tracking-tight mt-2 ${countFailedToday > 0 ? "text-rose-400 animate-pulse" : "text-foreground"}`}>
                  {countFailedToday} <span className="text-xs text-muted-foreground/60 font-semibold font-sans uppercase">Tệp tin</span>
                </div>
                <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mt-2">
                  {countFailedToday > 0 ? "Phát hiện lỗi cần được Re-sync!" : "Không phát hiện lỗi nào"}
                </p>
              </div>

              {/* Stat 3: Total Synced All Time */}
              <div className="bg-card/40 rounded-2xl p-5 border border-border/50 hover:border-primary/20 transition-all group backdrop-blur-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    <ImageIcon size={18} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Tổng số tệp đã log
                  </span>
                </div>
                <div className="text-2xl font-black tracking-tight text-foreground mt-2">
                  {realtimeLogs.length} <span className="text-xs text-muted-foreground/60 font-semibold font-sans uppercase">Tệp tin</span>
                </div>
                <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mt-2">
                  Bộ nhớ đệm log thời gian thực
                </p>
              </div>

              {/* Stat 4: OneDrive Real-time Status */}
              <div className="bg-card/40 rounded-2xl p-5 border border-border/50 hover:border-primary/20 transition-all group backdrop-blur-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                    <Activity size={18} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Đồng bộ R2 → OneDrive
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <span className="text-lg font-black text-emerald-400 uppercase tracking-wider">Hoạt động</span>
                </div>
                <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mt-2">
                  Tự động chuyển tiếp khi paste ảnh
                </p>
              </div>

            </div>

            {/* Realtime Logs History Table */}
            <div className="bg-card/30 rounded-3xl border border-border/50 overflow-hidden backdrop-blur-md animate-in fade-in duration-500">
              <div className="px-6 py-5 border-b border-border/40 bg-card/10 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                  Lịch sử hoạt động đồng bộ biểu đồ thời gian thực
                </h2>
                {isRealtimeLoading && <Loader2 size={16} className="animate-spin text-primary" />}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground/60 font-black uppercase tracking-widest">
                      <th className="px-6 py-4 w-20 text-center">Preview</th>
                      <th className="px-6 py-4">Thời gian</th>
                      <th className="px-6 py-4">Tên tệp tin R2 / OneDrive Path</th>
                      <th className="px-6 py-4 text-center">Trạng thái</th>
                      <th className="px-6 py-4 text-center">Đồng bộ lại</th>
                      <th className="px-6 py-4 text-center">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20 font-semibold text-muted-foreground">
                    {isRealtimeLoading && realtimeLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 size={24} className="animate-spin text-primary" />
                            <span className="text-xs tracking-widest font-black uppercase text-muted-foreground/40">
                              Đang tải dữ liệu Real-time logs...
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : realtimeLogs && realtimeLogs.length > 0 ? (
                      realtimeLogs.map((log) => {
                        const fileName = log.path.includes("/") 
                          ? log.path.substring(log.path.indexOf("/") + 1)
                          : log.path;
                        const userPrefix = log.path.includes("/")
                          ? log.path.substring(0, log.path.indexOf("/"))
                          : "";

                        return (
                          <tr
                            key={log.id}
                            className="hover:bg-muted/10 transition-colors group/row"
                          >
                            {/* Thumbnail Preview */}
                            <td className="px-6 py-3 text-center whitespace-nowrap">
                              {log.path.endsWith(".png") || log.path.endsWith(".jpg") || log.path.endsWith(".jpeg") ? (
                                <a 
                                  href={`/storage/${log.path}`} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="inline-block relative group/thumb cursor-pointer"
                                  title="Click để xem ảnh lớn"
                                >
                                  <img 
                                    src={`/storage/${log.path}`} 
                                    alt="Chart thumbnail"
                                    className="w-12 h-9 rounded-lg object-cover border border-border/40 group-hover/thumb:border-primary/60 group-hover/thumb:scale-105 transition-all shadow-md"
                                    onError={(e) => {
                                      // Fallback if image fails to render
                                      (e.target as HTMLElement).style.display = "none";
                                    }}
                                  />
                                </a>
                              ) : (
                                <FileText size={16} className="text-muted-foreground/40 mx-auto" />
                              )}
                            </td>

                            {/* Timestamp */}
                            <td className="px-6 py-4 whitespace-nowrap text-foreground flex items-center gap-3 h-full mt-2">
                              <Calendar size={14} className="text-primary/60" />
                              <span>{formatDateTime(log.created_at)}</span>
                            </td>

                            {/* Path info */}
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-0.5 max-w-md truncate">
                                <span className="font-bold text-slate-300 font-mono text-[11px] truncate" title={log.path}>
                                  {userPrefix && <span className="text-muted-foreground/60">{userPrefix}/</span>}
                                  <span className="text-foreground">{fileName}</span>
                                </span>
                                <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">
                                  OneDrive: /r2_charts/{log.path}
                                </span>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              {log.status === "success" ? (
                                <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  Success
                                </span>
                              ) : log.status === "starting" ? (
                                <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  <Loader2 size={10} className="animate-spin" />
                                  Syncing
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  Failed
                                </span>
                              )}
                            </td>

                            {/* Re-Sync Button */}
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              <button
                                onClick={() => handleReSyncFile(log.path)}
                                disabled={syncFileMutation.isPending}
                                className="inline-flex h-8 px-3 items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all active:scale-95 text-[10px] font-black uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none"
                                title="Đồng bộ thủ công lại ảnh này sang OneDrive"
                              >
                                <RefreshCw size={10} className={syncFileMutation.isPending ? "animate-spin" : ""} />
                                Re-sync
                              </button>
                            </td>

                            {/* View Log Detail */}
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              <button
                                onClick={() => setSelectedRealtimeLog(log)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all active:scale-90"
                                title="Xem log lỗi chi tiết"
                              >
                                <Eye size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 size={24} className="text-muted-foreground/30 animate-pulse" />
                            <span className="text-xs tracking-widest font-black uppercase text-muted-foreground/30">
                              Chưa ghi nhận logs đồng bộ thời gian thực nào hôm nay.
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TEMPORAL ROLLBACK EXPLORER (PITR) */}
        {activeTab === "history" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Filter controls row */}
            <div className="bg-card/30 p-6 rounded-3xl border border-border/50 backdrop-blur-md flex flex-col md:flex-row gap-6 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                  Chọn Ngày Nhật Ký
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={selectedHistoryDate}
                    onChange={(e) => setSelectedHistoryDate(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-black/40 border border-border/50 text-slate-100 text-xs font-bold font-mono focus:border-primary/60 focus:outline-none transition-colors animate-all"
                  />
                </div>
              </div>

              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                  Chọn Loại Bảng Dữ Liệu
                </label>
                <div className="relative">
                  <select
                    value={historyFilterTable}
                    onChange={(e) => setHistoryFilterTable(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-black/40 border border-border/50 text-slate-100 text-xs font-black focus:border-primary/60 focus:outline-none transition-colors appearance-none cursor-pointer"
                  >
                    <option value="all" className="bg-[#070b13] font-bold text-xs text-slate-100">
                      Tất cả bảng dữ liệu (All Tables)
                    </option>
                    <option value="journal_entries" className="bg-[#070b13] font-bold text-xs text-slate-100">
                      Nhật ký biểu đồ (journal_entries)
                    </option>
                    <option value="trades" className="bg-[#070b13] font-bold text-xs text-slate-100">
                      Giao dịch (trades)
                    </option>
                    <option value="psychology_logs" className="bg-[#070b13] font-bold text-xs text-slate-100">
                      Nhật ký tâm lý (psychology_logs)
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Revision List Block */}
            <div className="bg-card/30 rounded-3xl border border-border/50 overflow-hidden backdrop-blur-md">
              <div className="px-6 py-5 border-b border-border/40 bg-card/10 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-widest text-glow-cyan flex items-center gap-2">
                  <History size={16} className="text-primary animate-pulse" />
                  Danh sách phiên bản sửa đổi (Temporal Timeline)
                </h2>
                <div className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                  {historyRevisions ? `${historyRevisions.length} Revisions Found` : "0 Revisions"}
                </div>
              </div>

              <div className="p-6">
                {isHistoryLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <Loader2 size={24} className="animate-spin text-primary" />
                    <span className="text-xs tracking-widest font-black uppercase text-muted-foreground/40">
                      Đang tìm kiếm lịch sử dữ liệu...
                    </span>
                  </div>
                ) : historyRevisions && historyRevisions.length > 0 ? (
                  <div className="relative border-l-2 border-border/30 pl-6 ml-4 space-y-8 py-2">
                    {(() => {
                      // Grouping function inside rendering closure
                      const groups: any[] = [];
                      const seen = new Set();
                      
                      historyRevisions.forEach((rev) => {
                        const batchKey = `${rev.history_timestamp}_${rev.table_name}`;
                        if (!seen.has(batchKey)) {
                          seen.add(batchKey);
                          const items = historyRevisions.filter(
                            (r) => r.history_timestamp === rev.history_timestamp && r.table_name === rev.table_name
                          );
                          groups.push({
                            batch_id: batchKey,
                            history_timestamp: rev.history_timestamp,
                            history_action: rev.history_action,
                            table_name: rev.table_name,
                            items,
                          });
                        }
                      });

                      return groups.map((group) => {
                        const isBatch = group.items.length > 1;
                        const tableNameViet = 
                          group.table_name === "journal_entries" ? "Nhật ký biểu đồ" :
                          group.table_name === "trades" ? "Lịch sử Giao dịch" : "Nhật ký Tâm lý";

                        return (
                          <div key={group.batch_id} className="relative group/timeline animate-in slide-in-from-left duration-300">
                            {/* Timeline Dot Indicator */}
                            <span className="absolute -left-[33px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#070b13] border-2 border-primary/80 group-hover/timeline:border-primary transition-colors">
                              <span className={`h-1.5 w-1.5 rounded-full ${isBatch ? "bg-cyan-400 animate-ping" : "bg-primary"}`} />
                            </span>

                            <div className="bg-black/30 border border-border/50 hover:border-primary/30 p-5 rounded-2xl transition-all shadow-md hover:shadow-lg space-y-4">
                              <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
                                
                                {/* Left side: revision meta */}
                                <div className="space-y-1">
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs font-mono font-bold text-foreground">
                                      {formatDateTime(group.history_timestamp)}
                                    </span>
                                    {group.history_action === "UPDATE" ? (
                                      <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                        UPDATE
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                        DELETE
                                      </span>
                                    )}
                                    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[9px] font-black uppercase tracking-widest bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                                      {group.table_name}
                                    </span>
                                  </div>

                                  <div className="text-slate-300 font-bold text-xs">
                                    {isBatch ? (
                                      <span className="text-glow-cyan flex items-center gap-1.5">
                                        <Layers size={12} className="text-primary" />
                                        Khôi phục Hàng loạt {tableNameViet} ({group.items.length} bản ghi)
                                      </span>
                                    ) : (
                                      <span>Khôi phục bản ghi {tableNameViet}</span>
                                    )}
                                  </div>
                                </div>

                                {/* Right side: batch quick actions */}
                                <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-end">
                                  {isBatch && (
                                    <button
                                      onClick={() => {
                                        if (window.confirm(`Bạn có chắc chắn muốn HOÀN TÁC HÀNG LOẠT (${group.items.length} dòng) thuộc bảng ${group.table_name} về thời điểm ${formatDateTime(group.history_timestamp)}?`)) {
                                          restoreBatchMutation.mutate({
                                            batchTimestamp: group.history_timestamp,
                                            tableName: group.table_name,
                                          });
                                        }
                                      }}
                                      disabled={restoreBatchMutation.isPending}
                                      className="inline-flex h-9 px-4 items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all text-xs font-black uppercase tracking-wider active:scale-95 disabled:opacity-50"
                                    >
                                      {restoreBatchMutation.isPending ? (
                                        <Loader2 size={12} className="animate-spin" />
                                      ) : (
                                        <Layers size={12} />
                                      )}
                                      Undo Batch ({group.items.length})
                                    </button>
                                  )}
                                  
                                  {!isBatch && (
                                    <button
                                      onClick={() => {
                                        if (window.confirm(`Bạn có chắc chắn muốn khôi phục bản ghi ${tableNameViet} về phiên bản lưu lúc ${formatDateTime(group.history_timestamp)}?`)) {
                                          restoreVersionMutation.mutate(group.items[0].history_id);
                                        }
                                      }}
                                      disabled={restoreVersionMutation.isPending}
                                      className="inline-flex h-9 px-4 items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all text-xs font-black uppercase tracking-wider active:scale-95 disabled:opacity-50"
                                    >
                                      {restoreVersionMutation.isPending ? (
                                        <Loader2 size={12} className="animate-spin" />
                                      ) : (
                                        <RefreshCw size={12} />
                                      )}
                                      Rollback
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Nested items inside the batch */}
                              <div className="bg-black/40 border border-border/30 rounded-xl overflow-hidden divide-y divide-border/20">
                                {group.items.map((item: any) => {
                                  let summaryText = "";
                                  if (group.table_name === "journal_entries") {
                                    summaryText = `Tài sản: ${item.snapshot_data?.asset || "—"} | Notes: ${item.snapshot_data?.notes || "Không có ghi chú"}`;
                                  } else if (group.table_name === "trades") {
                                    summaryText = `Giao dịch: ${item.snapshot_data?.symbol} (${item.snapshot_data?.side}) | Net PnL: $${item.snapshot_data?.net_pnl || "0"} | R:R: ${item.snapshot_data?.actual_rr || "—"}`;
                                  } else if (group.table_name === "psychology_logs") {
                                    summaryText = `Tâm lý ngày: ${item.snapshot_data?.date} | Mood: ${item.snapshot_data?.morning_mood || "—"} | Emotion: ${item.snapshot_data?.pre_trade_emotion || "—"}`;
                                  }

                                  return (
                                    <div key={item.history_id} className="p-3.5 flex items-center justify-between gap-4 hover:bg-muted/5 transition-colors">
                                      <div className="text-[11px] text-slate-300 font-mono truncate max-w-lg">
                                        {summaryText}
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <button
                                          onClick={() => setSelectedHistoryVersion(item)}
                                          className="inline-flex h-7 px-3 items-center gap-1 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all text-[10px] font-black uppercase tracking-wider active:scale-95"
                                        >
                                          <Eye size={10} />
                                          Chi tiết
                                        </button>
                                        
                                        {isBatch && (
                                          <button
                                            onClick={() => {
                                              if (window.confirm(`Khôi phục riêng lẻ bản ghi này?`)) {
                                                restoreVersionMutation.mutate(item.history_id);
                                              }
                                            }}
                                            disabled={restoreVersionMutation.isPending}
                                            className="inline-flex h-7 px-3 items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-wider active:scale-95"
                                          >
                                            <RefreshCw size={10} />
                                            Rollback
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="p-3.5 rounded-full bg-muted/20 text-muted-foreground/30 border border-border/30">
                      <AlertCircle size={28} />
                    </div>
                    <div className="text-center space-y-1">
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">
                        Chưa ghi nhận phiên bản sửa đổi nào
                      </h3>
                      <p className="text-[11px] text-muted-foreground/60 max-w-sm mx-auto">
                        Hệ thống PITR tự động tạo revision khi bạn có thay đổi (UPDATE hoặc DELETE) trên bất kỳ bảng dữ liệu nào của ngày hôm nay.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* MODAL 1: System Backup detailed log terminal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div
            className="w-full max-w-2xl bg-[#0c1220] border border-border/80 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Terminal Header */}
            <div className="px-6 py-4 border-b border-border/40 bg-card/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                <span className="text-xs font-black uppercase tracking-widest text-foreground">
                  Backup Log details ({selectedLog.date})
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/30 px-3 py-1.5 rounded-lg border border-border/60 transition-all active:scale-95"
              >
                Đóng
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto font-mono text-xs text-slate-300 space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4 bg-muted/10 p-4 rounded-xl border border-border/40">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                    Postgres Backup size
                  </span>
                  <span className="font-bold text-foreground">
                    {selectedLog.db_size_bytes ? formatBytes(selectedLog.db_size_bytes) : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                    Cloudflare R2 sync count
                  </span>
                  <span className="font-bold text-foreground">
                    {selectedLog.r2_files_count !== null
                      ? `${selectedLog.r2_files_count.toLocaleString()} files`
                      : "—"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block">
                  Console Output Message
                </span>
                <pre className="w-full bg-black/40 border border-border/30 rounded-xl p-4 overflow-x-auto text-[11px] leading-relaxed text-slate-400 font-mono whitespace-pre-wrap select-all max-h-[300px]">
                  {selectedLog.log_message || "No logs messages generated."}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Real-time sync log detail & preview */}
      {selectedRealtimeLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedRealtimeLog(null)}>
          <div
            className="w-full max-w-2xl bg-[#0c1220] border border-border/80 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border/40 bg-card/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <CloudLightning size={16} className="text-primary animate-pulse" />
                <span className="text-xs font-black uppercase tracking-widest text-foreground">
                  Real-time Sync Log Details
                </span>
              </div>
              <button
                onClick={() => setSelectedRealtimeLog(null)}
                className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/30 px-3 py-1.5 rounded-lg border border-border/60 transition-all active:scale-95"
              >
                Đóng
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto font-sans text-xs text-slate-300 space-y-5 flex-1">
              
              {/* Detailed Path Info */}
              <div className="bg-muted/10 p-4 rounded-xl border border-border/40 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                      Tên tệp tin
                    </span>
                    <span className="font-mono font-bold text-foreground text-xs break-all">
                      {selectedRealtimeLog.path.substring(selectedRealtimeLog.path.indexOf("/") + 1)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                      Trạng thái đồng bộ
                    </span>
                    <span className="mt-1 block">
                      {selectedRealtimeLog.status === "success" ? (
                        <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Success
                        </span>
                      ) : selectedRealtimeLog.status === "starting" ? (
                        <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Syncing
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Failed
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/20">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                    Đường dẫn Cloudflare R2
                  </span>
                  <span className="font-mono text-slate-400 break-all">{selectedRealtimeLog.path}</span>
                </div>

                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                    Thời gian tạo ghi nhận
                  </span>
                  <span className="font-semibold text-slate-300">{formatDateTime(selectedRealtimeLog.created_at)}</span>
                </div>
              </div>

              {/* Error log if failed */}
              {selectedRealtimeLog.status === "failed" && (
                <div className="space-y-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-rose-400 block flex items-center gap-1.5">
                    <AlertTriangle size={12} /> Thông tin lỗi từ Microsoft Graph API
                  </span>
                  <pre className="w-full bg-rose-950/20 border border-rose-900/40 rounded-xl p-4 overflow-x-auto text-[11px] leading-relaxed text-rose-300 font-mono whitespace-pre-wrap select-all max-h-[150px]">
                    {selectedRealtimeLog.error_message || "Không ghi nhận thông điệp lỗi cụ thể từ API."}
                  </pre>
                </div>
              )}

              {/* Preview image inside modal */}
              <div className="space-y-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                  Xem trước biểu đồ gốc (Cloudflare R2 Proxy)
                </span>
                <div className="border border-border/40 rounded-2xl overflow-hidden bg-black/40 flex items-center justify-center p-2 max-h-[300px]">
                  <img 
                    src={`/storage/${selectedRealtimeLog.path}`} 
                    alt="Original chart full preview" 
                    className="max-w-full max-h-[280px] object-contain rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-border/20">
                <button
                  onClick={() => {
                    setSelectedRealtimeLog(null);
                    handleReSyncFile(selectedRealtimeLog.path);
                  }}
                  disabled={syncFileMutation.isPending}
                  className="inline-flex h-10 px-5 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all active:scale-95 text-xs font-black uppercase tracking-wider disabled:opacity-50"
                >
                  <RefreshCw size={12} className={syncFileMutation.isPending ? "animate-spin" : ""} />
                  Thử đồng bộ lại ngay
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Detailed History Revision Preview */}
      {selectedHistoryVersion && (() => {
        const snap = selectedHistoryVersion.snapshot_data || {};
        const tableName = selectedHistoryVersion.table_name;
        const tableNameViet = 
          tableName === "journal_entries" ? "Nhật ký biểu đồ" :
          tableName === "trades" ? "Lịch sử Giao dịch" : "Nhật ký Tâm lý";

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedHistoryVersion(null)}>
            <div
              className="w-full max-w-4xl bg-[#0c1220] border border-border/80 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-border/40 bg-card/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <History size={16} className="text-primary animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-200">
                    Bản sao lưu {tableNameViet} ({formatDateTime(selectedHistoryVersion.history_timestamp)})
                  </span>
                </div>
                <button
                  onClick={() => setSelectedHistoryVersion(null)}
                  className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/30 px-3 py-1.5 rounded-lg border border-border/60 transition-all active:scale-95"
                >
                  Đóng
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto font-sans text-xs text-slate-300 space-y-6 flex-1">
                
                {/* Revision Info Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-muted/10 p-4 rounded-xl border border-border/40">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                      Hành động
                    </span>
                    <span className={`font-bold text-xs uppercase ${selectedHistoryVersion.history_action === 'DELETE' ? 'text-rose-400 text-glow-rose' : 'text-amber-400 text-glow-cyan'}`}>
                      {selectedHistoryVersion.history_action}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                      ID bản ghi / Bảng hệ thống
                    </span>
                    <span className="font-bold text-foreground text-[10px] font-mono break-all block mt-0.5">
                      {selectedHistoryVersion.row_id} ({tableName})
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                      Thời điểm chụp snapshot
                    </span>
                    <span className="font-bold text-foreground text-xs block mt-0.5">
                      {formatDateTime(selectedHistoryVersion.history_timestamp)}
                    </span>
                  </div>
                </div>

                {/* 1. DYNAMIC LAYOUT: JOURNAL ENTRIES */}
                {tableName === "journal_entries" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4 bg-black/20 p-4 rounded-xl border border-border/20">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Tài sản (Asset)</span>
                        <span className="text-sm font-black text-primary uppercase mt-0.5 block">{snap.asset}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Ngày biểu đồ (Date)</span>
                        <span className="text-sm font-bold text-foreground mt-0.5 block">{snap.date}</span>
                      </div>
                    </div>

                    {snap.notes && (
                      <div className="space-y-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Ghi chú nhật ký</span>
                        <div className="bg-black/30 border border-border/40 p-4 rounded-xl text-slate-300 leading-relaxed font-semibold whitespace-pre-wrap">
                          {snap.notes}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Định hướng phân tích (Biases)</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-black/20 p-3 rounded-xl border border-border/30 text-center">
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 block">Weekly Bias</span>
                          <span className="font-bold text-foreground text-xs uppercase block mt-1">{snap.weekly_bias || "—"}</span>
                        </div>
                        <div className="bg-black/20 p-3 rounded-xl border border-border/30 text-center">
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 block">Daily Bias</span>
                          <span className="font-bold text-foreground text-xs uppercase block mt-1">{snap.daily_bias || "—"}</span>
                        </div>
                        <div className="bg-black/20 p-3 rounded-xl border border-border/30 text-center">
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 block">Monthly Bias</span>
                          <span className="font-bold text-foreground text-xs uppercase block mt-1">{snap.monthly_bias || "—"}</span>
                        </div>
                        <div className="bg-black/20 p-3 rounded-xl border border-border/30 text-center">
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 block">Yearly Bias</span>
                          <span className="font-bold text-foreground text-xs uppercase block mt-1">{snap.yearly_bias || "—"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Chart Images */}
                    <div className="space-y-4">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Biểu đồ kỹ thuật</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {snap.weekly_img && (
                          <div className="border border-border/40 rounded-2xl overflow-hidden bg-black/40 p-3 space-y-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-glow-cyan block">weekly outlook chart</span>
                            <a href={`/storage/${snap.weekly_img}`} target="_blank" rel="noreferrer" className="block relative group/img cursor-pointer max-h-[220px] overflow-hidden rounded-lg">
                              <img src={`/storage/${snap.weekly_img}`} alt="Weekly Outlook" className="w-full h-full object-contain rounded-lg hover:scale-102 transition-transform" />
                            </a>
                          </div>
                        )}
                        {snap.daily_img && (
                          <div className="border border-border/40 rounded-2xl overflow-hidden bg-black/40 p-3 space-y-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-glow-cyan block">daily outlook chart</span>
                            <a href={`/storage/${snap.daily_img}`} target="_blank" rel="noreferrer" className="block relative group/img cursor-pointer max-h-[220px] overflow-hidden rounded-lg">
                              <img src={`/storage/${snap.daily_img}`} alt="Daily Outlook" className="w-full h-full object-contain rounded-lg hover:scale-102 transition-transform" />
                            </a>
                          </div>
                        )}
                        {snap.monthly_img && (
                          <div className="border border-border/40 rounded-2xl overflow-hidden bg-black/40 p-3 space-y-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-glow-cyan block">monthly outlook chart</span>
                            <a href={`/storage/${snap.monthly_img}`} target="_blank" rel="noreferrer" className="block relative group/img cursor-pointer max-h-[220px] overflow-hidden rounded-lg">
                              <img src={`/storage/${snap.monthly_img}`} alt="Monthly Outlook" className="w-full h-full object-contain rounded-lg hover:scale-102 transition-transform" />
                            </a>
                          </div>
                        )}
                        {snap.yearly_img && (
                          <div className="border border-border/40 rounded-2xl overflow-hidden bg-black/40 p-3 space-y-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-glow-cyan block">yearly outlook chart</span>
                            <a href={`/storage/${snap.yearly_img}`} target="_blank" rel="noreferrer" className="block relative group/img cursor-pointer max-h-[220px] overflow-hidden rounded-lg">
                              <img src={`/storage/${snap.yearly_img}`} alt="Yearly Outlook" className="w-full h-full object-contain rounded-lg hover:scale-102 transition-transform" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* H4 Sessions Details */}
                    {snap.h4 && Object.keys(snap.h4).length > 0 && (
                      <div className="space-y-3">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">
                          Chi tiết các phiên H4 (H4 Sessions)
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {Object.entries(snap.h4).map(([sess, val]: [string, any]) => {
                            const img = typeof val === "string" ? val : val?.img;
                            const bias = typeof val === "string" ? null : val?.bias;

                            return (
                              <div key={sess} className="bg-black/30 border border-border/40 p-4 rounded-xl space-y-3">
                                <div className="flex items-center justify-between border-b border-border/20 pb-2">
                                  <span className="text-xs font-black uppercase text-primary tracking-widest">{sess} Session</span>
                                  {bias && (
                                    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
                                      {bias}
                                    </span>
                                  )}
                                </div>
                                {img && (
                                  <div className="rounded-lg overflow-hidden border border-border/20 max-h-[140px]">
                                    <a href={`/storage/${img}`} target="_blank" rel="noreferrer" className="block relative group/h4 cursor-pointer">
                                      <img src={`/storage/${img}`} alt={`${sess} Session`} className="w-full h-full object-cover rounded-lg group-hover/h4:scale-102 transition-transform" />
                                    </a>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. DYNAMIC LAYOUT: TRADES */}
                {tableName === "trades" && (
                  <div className="space-y-6">
                    {/* Header Financials banner */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-black/20 p-4 rounded-xl border border-border/30 text-center">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 block">Cặp Giao Dịch</span>
                        <span className="font-black text-primary text-sm uppercase block mt-1">{snap.symbol} ({snap.side})</span>
                      </div>
                      <div className="bg-black/20 p-4 rounded-xl border border-border/30 text-center">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 block">Net Profit/Loss</span>
                        <span className={`font-black text-sm block mt-1 ${parseFloat(snap.net_pnl || "0") >= 0 ? "text-emerald-400 text-glow-cyan" : "text-rose-400 text-glow-rose"}`}>
                          ${snap.net_pnl || "0.00"}
                        </span>
                      </div>
                      <div className="bg-black/20 p-4 rounded-xl border border-border/30 text-center">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 block">Tỷ lệ R:R Đạt được</span>
                        <span className="font-bold text-foreground text-sm block mt-1">{snap.actual_rr || "0.0"}R</span>
                      </div>
                      <div className="bg-black/20 p-4 rounded-xl border border-border/30 text-center">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 block">Rủi Ro (Risk %)</span>
                        <span className="font-bold text-foreground text-sm block mt-1">{snap.risk_percent || "0.0"}%</span>
                      </div>
                    </div>

                    {/* Detailed Metadata Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-black/20 p-4 rounded-xl border border-border/20">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Trạng thái</span>
                        <span className="font-semibold text-slate-200 uppercase mt-0.5 block">{snap.status || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Đánh giá (Grade)</span>
                        <span className="font-semibold text-slate-200 mt-0.5 block">{snap.grade || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Tuân thủ nguyên tắc</span>
                        <span className={`font-black uppercase text-[10px] mt-1 inline-block px-2 py-0.5 rounded ${snap.compliance_check ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                          {snap.compliance_check ? "PASSED" : "FAILED"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Thời gian vào lệnh</span>
                        <span className="font-semibold text-slate-300 mt-0.5 block">{snap.entry_time ? formatDateTime(snap.entry_time) : "—"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Thời gian thoát lệnh</span>
                        <span className="font-semibold text-slate-300 mt-0.5 block">{snap.exit_time ? formatDateTime(snap.exit_time) : "—"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">setup_id (Thiết lập)</span>
                        <span className="font-mono text-[10px] text-muted-foreground truncate block mt-0.5">{snap.setup_id || "Chưa gán"}</span>
                      </div>
                    </div>

                    {snap.notes && (
                      <div className="space-y-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Ghi chú lệnh giao dịch</span>
                        <div className="bg-black/30 border border-border/40 p-4 rounded-xl text-slate-300 leading-relaxed whitespace-pre-wrap font-semibold">
                          {snap.notes}
                        </div>
                      </div>
                    )}

                    {/* Chart Images for Trade */}
                    <div className="space-y-4">
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Hình ảnh lệnh giao dịch (Trade Charts)</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {snap.before_img && (
                          <div className="border border-border/40 rounded-2xl overflow-hidden bg-black/40 p-3 space-y-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-glow-cyan block">before entry chart</span>
                            <a href={`/storage/${snap.before_img}`} target="_blank" rel="noreferrer" className="block relative group/img cursor-pointer max-h-[220px] overflow-hidden rounded-lg">
                              <img src={`/storage/${snap.before_img}`} alt="Before Entry" className="w-full h-full object-contain rounded-lg hover:scale-102 transition-transform" />
                            </a>
                          </div>
                        )}
                        {snap.after_img && (
                          <div className="border border-border/40 rounded-2xl overflow-hidden bg-black/40 p-3 space-y-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-glow-cyan block">after exit chart</span>
                            <a href={`/storage/${snap.after_img}`} target="_blank" rel="noreferrer" className="block relative group/img cursor-pointer max-h-[220px] overflow-hidden rounded-lg">
                              <img src={`/storage/${snap.after_img}`} alt="After Exit" className="w-full h-full object-contain rounded-lg hover:scale-102 transition-transform" />
                            </a>
                          </div>
                        )}
                        {snap.daily_img && (
                          <div className="border border-border/40 rounded-2xl overflow-hidden bg-black/40 p-3 space-y-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-glow-cyan block">daily chart</span>
                            <a href={`/storage/${snap.daily_img}`} target="_blank" rel="noreferrer" className="block relative group/img cursor-pointer max-h-[220px] overflow-hidden rounded-lg">
                              <img src={`/storage/${snap.daily_img}`} alt="Daily Chart" className="w-full h-full object-contain rounded-lg hover:scale-102 transition-transform" />
                            </a>
                          </div>
                        )}
                        {snap.h1_img && (
                          <div className="border border-border/40 rounded-2xl overflow-hidden bg-black/40 p-3 space-y-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-glow-cyan block">H1 chart</span>
                            <a href={`/storage/${snap.h1_img}`} target="_blank" rel="noreferrer" className="block relative group/img cursor-pointer max-h-[220px] overflow-hidden rounded-lg">
                              <img src={`/storage/${snap.h1_img}`} alt="H1 Chart" className="w-full h-full object-contain rounded-lg hover:scale-102 transition-transform" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. DYNAMIC LAYOUT: PSYCHOLOGY LOGS */}
                {tableName === "psychology_logs" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-black/20 p-4 rounded-xl border border-border/20">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Ngày Nhật Ký</span>
                        <span className="text-sm font-bold text-slate-100 mt-0.5 block">{snap.date}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Trạng thái tâm trạng buổi sáng (Mood)</span>
                        <span className="text-sm font-black text-primary mt-0.5 block uppercase">{snap.morning_mood || "Chưa ghi nhận"}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">ID Giao Dịch liên kết</span>
                        <span className="font-mono text-[10px] text-muted-foreground mt-1 truncate block">{snap.trade_id || "N/A"}</span>
                      </div>
                    </div>

                    {snap.morning_notes && (
                      <div className="space-y-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Ghi chép đầu ngày (Morning Notes)</span>
                        <div className="bg-black/30 border border-border/40 p-4 rounded-xl text-slate-300 leading-relaxed whitespace-pre-wrap font-semibold">
                          {snap.morning_notes}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="bg-black/20 p-4 rounded-xl border border-border/30 space-y-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Cảm xúc trước giao dịch (Pre-trade Emotion)</span>
                        <span className="font-bold text-slate-200 text-xs block">{snap.pre_trade_emotion || "—"}</span>
                      </div>
                      <div className="bg-black/20 p-4 rounded-xl border border-border/30 space-y-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Cảm xúc sau giao dịch (Post-trade Emotion)</span>
                        <span className="font-bold text-slate-200 text-xs block">{snap.post_trade_emotion || "—"}</span>
                      </div>
                    </div>

                    {snap.entry_rationale && (
                      <div className="space-y-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Lý do vào lệnh (Entry Rationale)</span>
                        <div className="bg-black/30 border border-border/40 p-4 rounded-xl text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {snap.entry_rationale}
                        </div>
                      </div>
                    )}

                    {snap.exit_assessment && (
                      <div className="space-y-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground block">Đánh giá thoát lệnh (Exit Assessment)</span>
                        <div className="bg-black/30 border border-border/40 p-4 rounded-xl text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {snap.exit_assessment}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-border/20">
                  <button
                    onClick={() => setSelectedHistoryVersion(null)}
                    className="inline-flex h-10 px-5 items-center justify-center rounded-xl border border-border/60 text-muted-foreground hover:text-slate-100 hover:bg-muted/30 transition-all active:scale-95 text-xs font-black uppercase tracking-wider"
                  >
                    Đóng
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Bạn có chắc chắn muốn KHÔI PHỤC bản ghi này về phiên bản lưu lúc ${formatDateTime(selectedHistoryVersion.history_timestamp)}?`)) {
                        setSelectedHistoryVersion(null);
                        restoreVersionMutation.mutate(selectedHistoryVersion.history_id);
                      }
                    }}
                    disabled={restoreVersionMutation.isPending}
                    className="inline-flex h-10 px-5 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all active:scale-95 text-xs font-black uppercase tracking-wider disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={restoreVersionMutation.isPending ? "animate-spin" : ""} />
                    Khôi phục (Rollback) ngay
                  </button>
                </div>

              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
