import { createFileRoute, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { fetchMyProfile } from "@/lib/journal";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setAuthorized(false);
          return;
        }

        const profile = await fetchMyProfile();
        setAuthorized(profile?.role === "admin");
      } catch (err) {
        console.error("Admin auth check failed:", err);
        setAuthorized(false);
      }
    }

    checkAuth();
  }, []);

  if (authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Đang kiểm tra quyền admin…</p>
        </div>
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
        <div className="max-w-md text-center bg-card rounded-2xl p-8 border border-border">
          <div className="w-14 h-14 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-7 h-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Không có quyền truy cập</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Khu vực này chỉ dành cho quản trị viên.
          </p>
          <div className="mt-7">
            <a
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-xl forest-gradient px-6 text-sm font-semibold text-white"
            >
              Về Terminal
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
