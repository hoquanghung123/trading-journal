import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function ImpersonationBanner() {
  const [impersonating, setImpersonating] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const evaluateImpersonation = async () => {
      const hasAdminSession = !!localStorage.getItem("chartmate_original_admin_session");
      const { data: { session } } = await supabase.auth.getSession();
      
      if (hasAdminSession && session?.user) {
        setImpersonating(true);
        setUserEmail(session.user.email ?? "N/A");
      } else {
        setImpersonating(false);
      }
    };

    evaluateImpersonation();

    // Listen for authentication changes to instantly hide/show
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const stillHasAdminSession = !!localStorage.getItem("chartmate_original_admin_session");
      if (stillHasAdminSession && session?.user) {
        setImpersonating(true);
        setUserEmail(session.user.email ?? "N/A");
      } else {
        setImpersonating(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSwitchBack = async () => {
    if (busy) return;
    setBusy(true);
    
    try {
      const savedSessionStr = localStorage.getItem("chartmate_original_admin_session");
      if (!savedSessionStr) {
        throw new Error("Không tìm thấy phiên làm việc Admin gốc");
      }

      const adminSession = JSON.parse(savedSessionStr);

      // Restore original admin session
      const { error } = await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });

      if (error) throw error;

      // Clean up backup session from LocalStorage
      localStorage.removeItem("chartmate_original_admin_session");
      toast.success("Khôi phục tài khoản Admin thành công!");

      // Redirect back to Admin Users page
      setTimeout(() => {
        window.location.href = "/admin/users";
      }, 500);
    } catch (err: any) {
      toast.error("Lỗi khôi phục tài khoản Admin", {
        description: err.message,
      });
      setBusy(false);
    }
  };

  if (!impersonating) return null;

  return (
    <div className="sticky top-0 left-0 w-full z-50 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white font-sans text-xs font-bold py-2.5 px-4 shadow-[0_4px_20px_rgba(217,119,6,0.3)] flex items-center justify-between gap-4 animate-in slide-in-from-top duration-500">
      <div className="flex items-center gap-2">
        <ShieldAlert size={14} className="animate-pulse shrink-0 text-amber-100" />
        <span className="leading-none tracking-wide">
          Chế độ đóng vai: Bạn đang xem hệ thống với tư cách <strong className="underline text-amber-50">{userEmail}</strong>
        </span>
      </div>

      <button
        onClick={handleSwitchBack}
        disabled={busy}
        className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/25 rounded-md px-3 py-1 font-black uppercase tracking-widest text-[9px] transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
      >
        {busy ? (
          <Loader2 size={10} className="animate-spin" />
        ) : (
          <RefreshCw size={10} />
        )}
        Quay lại Admin
      </button>
    </div>
  );
}
