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
  AlertTriangle
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
  const [activeTab, setActiveTab] = useState<"system" | "realtime">("system");

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
    </div>
  );
}
