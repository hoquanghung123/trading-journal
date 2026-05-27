import { createFileRoute, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { fetchMyProfile } from "@/lib/journal";

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
        if (profile?.role === "admin") {
          setAuthorized(true);
        } else {
          setAuthorized(false);
        }
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
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">
            Checking Permissions...
          </p>
        </div>
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
        <div className="max-w-md text-center bg-card rounded-[32px] p-8 border border-border/80 shadow-2xl relative overflow-hidden">
          <div className="absolute top-[-10%] right-[-10%] w-40 h-40 bg-destructive/5 rounded-full blur-2xl" />
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Access Restricted</h1>
          <p className="mt-3 text-xs font-semibold text-muted-foreground/80 leading-relaxed">
            This workspace is locked. Only administrators are allowed to enter the backups panel.
          </p>
          <div className="mt-8">
            <a
              href="/"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-primary px-8 text-xs font-black uppercase tracking-widest text-white hover:opacity-95 active:scale-95 transition-all shadow-lg shadow-primary/20"
            >
              Return to Journal
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
