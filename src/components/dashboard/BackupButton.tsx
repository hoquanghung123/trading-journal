import { useState } from "react";
import { DatabaseBackup, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type BackupStatus = "idle" | "loading" | "success" | "error";

export function BackupButton() {
  const [status, setStatus] = useState<BackupStatus>("idle");

  const handleBackup = async () => {
    if (status === "loading") return;

    setStatus("loading");
    const toastId = toast.loading("Đang tạo SQL backup...", {
      description: "Đang export toàn bộ database, vui lòng đợi...",
    });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const functionUrl = `${supabaseUrl}/functions/v1/backup-database`;

      const res = await fetch(functionUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken ?? ""}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errData.error ?? `HTTP ${res.status}`);
      }

      // Trigger browser download
      const blob = await res.blob();
      const filename =
        res.headers.get("X-Backup-Filename") ??
        `backup_${new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-")}.sql`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const r2Uploaded = res.headers.get("X-R2-Uploaded") === "true";
      const r2Key = res.headers.get("X-R2-Key") ?? "";

      setStatus("success");
      toast.success("Backup thành công!", {
        id: toastId,
        description: r2Uploaded
          ? `Đã lưu lên R2: ${r2Key} & tải về máy.`
          : "Đã tải file SQL về máy (R2 chưa được cấu hình).",
        duration: 6000,
      });

      // Reset to idle after 3s
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Lỗi không xác định";
      setStatus("error");
      toast.error("Backup thất bại", {
        id: toastId,
        description: message,
        duration: 6000,
      });
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  const stateConfig = {
    idle: {
      icon: <DatabaseBackup size={15} />,
      label: "Backup Database",
      className: "backup-btn backup-btn--idle",
    },
    loading: {
      icon: <Loader2 size={15} className="backup-btn__spinner" />,
      label: "Đang backup...",
      className: "backup-btn backup-btn--loading",
    },
    success: {
      icon: <CheckCircle2 size={15} />,
      label: "Backup xong!",
      className: "backup-btn backup-btn--success",
    },
    error: {
      icon: <AlertCircle size={15} />,
      label: "Thất bại, thử lại",
      className: "backup-btn backup-btn--error",
    },
  };

  const config = stateConfig[status];

  return (
    <button
      id="backup-database-btn"
      className={config.className}
      onClick={handleBackup}
      disabled={status === "loading"}
      style={{ width: "100%" }}
      title="Export toàn bộ database thành file SQL và lưu lên Cloudflare R2"
    >
      <span className="backup-btn__icon">{config.icon}</span>
      <span className="backup-btn__label">{config.label}</span>
    </button>
  );
}
