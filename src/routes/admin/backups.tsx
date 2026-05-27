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
} from "lucide-react";
import { toast } from "sonner";

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

function AdminBackupsDashboard() {
  const [selectedLog, setSelectedLog] = useState<BackupLog | null>(null);

  // 1. React Query to fetch daily backup logs (with polling if active backup is running)
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
      return hasRunning ? 5000 : false; // Poll every 5s if active job is running
    },
  });

  // 2. Mutation to trigger backup workflow securely
  const triggerMutation = useMutation({
    mutationFn: async () => {
      // Use the official Supabase SDK functions invoker.
      // This automatically attaches the active (and auto-refreshed) user JWT session token.
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

  // Calculate quick stats from logs
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
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">
              Admin Control Panel
            </span>
          </div>
        </div>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/40">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-glow-cyan">
              OneDrive Backups Control
            </h1>
            <p className="text-xs text-muted-foreground/80 font-semibold mt-1">
              Quản lý đồng bộ sao lưu tự động toàn diện Database & Cloudflare R2 sang Microsoft OneDrive.
            </p>
          </div>

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
        </div>

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
                      {/* Date */}
                      <td className="px-6 py-4 whitespace-nowrap text-foreground flex items-center gap-3">
                        <Calendar size={14} className="text-primary/60" />
                        <span className="font-bold">{formatDate(log.date)}</span>
                      </td>

                      {/* DB Status */}
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

                      {/* R2 Status */}
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

                      {/* DB Size */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.db_size_bytes ? formatBytes(log.db_size_bytes) : "—"}
                      </td>

                      {/* Files Count */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.r2_files_count !== null ? log.r2_files_count.toLocaleString() : "—"}
                      </td>

                      {/* R2 Size */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.r2_size_bytes ? formatBytes(log.r2_size_bytes) : "—"}
                      </td>

                      {/* View Action */}
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

      {/* Modern Code-Terminal Modal for View Log Message */}
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
    </div>
  );
}
