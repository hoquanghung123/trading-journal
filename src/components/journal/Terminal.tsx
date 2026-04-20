import { useEffect, useState } from "react";
import { LayoutDashboard, Crosshair, FileText, LogOut, Terminal as TerminalIcon, Construction, Settings } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AuthGate } from "./AuthGate";
import { JournalView } from "./JournalView";
import { TradeLog } from "./TradeLog";
import { ManageAssetsModal } from "./ManageAssetsModal";
import { onPageChange, type PageId } from "@/lib/nav-bus";

type Page = "dashboard" | "bias" | "trades";

const NAV: { id: Page; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "bias", label: "Bias Expect", icon: Crosshair },
  { id: "trades", label: "Trade Log", icon: FileText },
];

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

function Shell() {
  const [page, setPage] = useState<Page>("bias");
  const [assetsOpen, setAssetsOpen] = useState(false);

  useEffect(() => onPageChange((p) => setPage(p as PageId as Page)), []);

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-40 w-[240px] flex flex-col border-r border-terminal-border"
        style={{ background: "#0D131A" }}
      >
        <div className="px-5 py-5 border-b border-terminal-border flex items-center gap-2">
          <TerminalIcon className="w-5 h-5 text-neon-cyan text-glow-cyan" />
          <div>
            <div className="text-sm font-bold tracking-[0.25em] text-neon-cyan text-glow-cyan">ICT_JOURNAL</div>
            <div className="text-[9px] text-muted-foreground tracking-widest">// v1.0 TERMINAL</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-bold tracking-[0.18em] border transition-all ${
                  active
                    ? "bg-neon-cyan/15 text-neon-cyan border-neon-cyan/50 text-glow-cyan shadow-[0_0_18px_oklch(0.85_0.18_200/0.25)]"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="uppercase">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-terminal-border space-y-1">
          <button
            onClick={() => setAssetsOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-bold tracking-widest border border-terminal-border text-muted-foreground hover:text-neon-cyan hover:border-neon-cyan/60 transition-all"
          >
            <Settings className="w-3.5 h-3.5" /> MANAGE ASSETS
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-bold tracking-widest border border-terminal-border text-muted-foreground hover:text-neon-red hover:border-neon-red/60 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" /> SIGN OUT
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 ml-[240px] min-w-0">
        {page === "bias" && <JournalView />}
        {page === "dashboard" && <UnderConstruction title="DASHBOARD" />}
        {page === "trades" && <TradeLog />}
      </div>

      <ManageAssetsModal open={assetsOpen} onClose={() => setAssetsOpen(false)} />
    </div>
  );
}

function UnderConstruction({ title }: { title: string }) {
  return (
    <div className="min-h-screen grid-bg flex items-center justify-center p-8">
      <div className="glass rounded-lg p-12 text-center max-w-md">
        <Construction className="w-12 h-12 mx-auto text-neon-amber mb-4" />
        <h2 className="text-xl font-bold tracking-[0.3em] text-neon-amber text-glow-cyan">{title}</h2>
        <p className="text-xs text-muted-foreground mt-2 tracking-widest">// UNDER CONSTRUCTION</p>
      </div>
    </div>
  );
}

export function Terminal() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>{() => <Shell />}</AuthGate>
    </QueryClientProvider>
  );
}
