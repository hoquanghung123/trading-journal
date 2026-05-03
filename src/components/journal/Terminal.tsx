import { useEffect, useState, useMemo } from "react";
import {
  LayoutDashboard,
  Crosshair,
  FileText,
  LogOut,
  Terminal as TerminalIcon,
  Construction,
  Settings,
  Brain,
  CalendarCheck,
  BookOpen,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  UserCircle,
  Flame,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/query-client";
import { supabase } from "@/integrations/supabase/client";
import { AuthGate } from "./AuthGate";
import { JournalView } from "./JournalView";
import { TradeLog } from "./TradeLog";
import { PsychologyView } from "./PsychologyView";
import { ManageAssetsModal } from "./ManageAssetsModal";
import { ReviewPage } from "@/components/review/ReviewPage";
import { PlaybookPage } from "@/components/playbook/PlaybookPage";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { DailyViewPage } from "@/components/dashboard/DailyViewPage";
import { AccountSettings } from "./AccountSettings";
import { WeekendReviewPrompt } from "@/components/review/WeekendReviewPrompt";
import { onPageChange, type PageId } from "@/lib/nav-bus";
import { ProgressView } from "./ProgressView";
import { fetchTrades, type Trade } from "@/lib/trades";
import { fetchEntries, calculateStreak, fetchMyProfile } from "@/lib/journal";

type Page =
  | "dashboard"
  | "bias"
  | "trades"
  | "psychology"
  | "review"
  | "playbook"
  | "progress"
  | "daily"
  | "account";

const NAV: { id: Page; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "playbook", label: "Playbook", icon: BookOpen },
  { id: "bias", label: "Bias Expect", icon: Crosshair },
  { id: "trades", label: "Trade Log", icon: FileText },
  { id: "psychology", label: "Psychology", icon: Brain },
  { id: "review", label: "Review", icon: CalendarCheck },
  { id: "progress", label: "Progress", icon: Flame },
  { id: "account", label: "Account", icon: UserCircle },
];


import { useQuery } from "@tanstack/react-query";
import { fetchSettings } from "@/lib/settings";

function ThemeApplier() {
  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: fetchSettings,
  });

  useEffect(() => {
    if (settings?.primaryColor) {
      document.documentElement.style.setProperty("--primary", settings.primaryColor);
      // Optional: compute a lighter version for secondary if needed
      // document.documentElement.style.setProperty("--secondary", `${settings.primaryColor}1a`);
    }
  }, [settings?.primaryColor]);

  return null;
}

function Shell() {
  const [page, setPage] = useState<Page>(() => {
    return (localStorage.getItem("terminal-active-page") as Page) || "bias";
  });
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    onPageChange((p) => {
      setPage(p as PageId as Page);
      setIsMobileOpen(false);
    });

    fetchTrades().then(setTrades).catch(console.error);
  }, []);

  // Persist page preference
  useEffect(() => {
    localStorage.setItem("terminal-active-page", page);
  }, [page]);

  const { data: entries } = useQuery({
    queryKey: ["journal_entries"],
    queryFn: fetchEntries,
  });

  const { data: profile } = useQuery({
    queryKey: ["my_profile"],
    queryFn: fetchMyProfile,
  });

  const streak = useMemo(() => {
    if (profile) return profile.currentStreak;
    if (!entries) return 0;
    return calculateStreak(entries).currentStreak;
  }, [profile, entries]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div
      className="min-h-screen flex bg-background font-sans overflow-hidden"
      style={
        {
          "--sidebar-width": isMobileOpen ? "0px" : isLeftCollapsed ? "80px" : "260px",
        } as React.CSSProperties
      }
    >
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-sidebar sidebar-transition
          ${isMobileOpen ? "translate-x-0 w-[280px] sidebar-mobile-shadow" : "-translate-x-full lg:translate-x-0"}
          ${isLeftCollapsed ? "lg:w-[80px]" : "lg:w-[260px]"}
          lg:shadow-none
        `}
      >
        <div
          className={`px-6 py-8 flex items-center justify-between gap-3 ${isLeftCollapsed ? "lg:justify-center lg:px-0" : ""}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center forest-gradient soft-shadow shrink-0">
              <TerminalIcon className="w-5 h-5 text-white" />
            </div>
            {(!isLeftCollapsed || isMobileOpen) && (
              <div className="overflow-hidden whitespace-nowrap">
                <div className="text-lg font-bold tracking-tight text-foreground">Chartmate</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  Trading Journal
                </div>
              </div>
            )}
          </div>

          {/* Close button for mobile */}
          {isMobileOpen && (
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <TooltipProvider delayDuration={0}>
          <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto hide-scrollbar">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = page === item.id;
              const button = (
                <button
                  onClick={() => {
                    setPage(item.id);
                    if (isMobileOpen) setIsMobileOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3.5 sm:py-3 rounded-xl text-sm font-semibold transition-all duration-200 
                    ${active ? "forest-gradient text-white soft-shadow" : "text-muted-foreground hover:text-foreground hover:bg-muted"}
                    ${isLeftCollapsed && !isMobileOpen ? "lg:justify-center lg:px-0" : ""}
                    ${item.id === "account" ? "mt-4 border-t border-border/50 pt-6" : ""}
                  `}
                >
                  {item.id === "account" ? (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden border-2 ${active ? "border-white/50" : "border-primary/20 bg-primary/5"}`}
                    >
                      <Icon
                        className={`w-5 h-5 shrink-0 ${active ? "text-white" : "text-primary"}`}
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <Icon
                        className={`w-5 h-5 shrink-0 ${active ? "text-white" : "text-muted-foreground"}`}
                      />
                      {item.id === "progress" && streak > 0 && (
                        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center border border-sidebar group-hover:border-muted transition-colors">
                          <span className="text-[9px] font-black text-white leading-none">
                            {streak}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {(!isLeftCollapsed || isMobileOpen) && <span>{item.label}</span>}
                </button>
              );

              if (isLeftCollapsed && !isMobileOpen) {
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return <div key={item.id}>{button}</div>;
            })}
          </nav>



          <div
            className={`p-4 border-t border-border space-y-2 ${isLeftCollapsed && !isMobileOpen ? "flex flex-col items-center" : ""}`}
          >
            {isLeftCollapsed && !isMobileOpen ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setAssetsOpen(true)}
                      className="w-full flex items-center justify-center py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                    >
                      <Settings className="w-4 h-4 shrink-0" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Manage Assets</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={signOut}
                      className="w-full flex items-center justify-center py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sign Out</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <>
                <button
                  onClick={() => setAssetsOpen(true)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                >
                  <Settings className="w-4 h-4 shrink-0" /> Manage Assets
                </button>
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
                >
                  <LogOut className="w-4 h-4 shrink-0" /> Sign Out
                </button>
              </>
            )}

            {/* Collapse Toggle Desktop */}
            <button
              onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
              className="hidden lg:flex w-full mt-4 items-center justify-center p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              {isLeftCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>
        </TooltipProvider>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden h-14 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-30">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 rounded-xl hover:bg-muted text-foreground transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center forest-gradient">
              <TerminalIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight text-foreground">Chartmate</span>
          </div>
          <div className="w-9" /> {/* Spacer to center the logo */}
        </header>

        {/* Viewport content */}
        <main className="flex-1 overflow-y-auto relative bg-[#F8FAF9]">
          {/* Desktop Left Sidebar Toggle Overlay Button - When Collapsed */}
          {isLeftCollapsed && (
            <button
              onClick={() => setIsLeftCollapsed(false)}
              className="fixed top-4 left-4 z-40 hidden lg:flex w-10 h-10 items-center justify-center rounded-xl bg-white border border-border shadow-md text-muted-foreground hover:text-primary transition-all"
              title="Expand Sidebar"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          <div className="h-full">
            {page === "bias" && <JournalView />}
            {page === "dashboard" && <DashboardPage />}
            {page === "daily" && <DailyViewPage />}
            {page === "trades" && <TradeLog />}
            {page === "psychology" && <PsychologyView />}
            {page === "review" && <ReviewPage />}
            {page === "playbook" && <PlaybookPage />}
            {page === "progress" && <ProgressView />}
            {page === "account" && <AccountSettings />}
          </div>
        </main>
      </div>

      <ManageAssetsModal open={assetsOpen} onClose={() => setAssetsOpen(false)} />
      <WeekendReviewPrompt />
    </div>
  );
}

function QuickStat({
  label,
  value,
  icon,
  subValue,
  isPositive,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  subValue?: string;
  isPositive?: boolean;
}) {
  return (
    <div className="bg-muted/30 rounded-2xl p-4 border border-border/50 hover:border-primary/20 transition-all group">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-white shadow-sm group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div
        className={`text-2xl font-black tracking-tight ${isPositive === undefined ? "text-foreground" : isPositive ? "text-emerald-600" : "text-rose-600"}`}
      >
        {value}
      </div>
      {subValue && (
        <div className="text-[10px] font-bold text-muted-foreground/60 mt-1 uppercase tracking-widest">
          {subValue}
        </div>
      )}
    </div>
  );
}

function UnderConstruction({ title }: { title: string }) {
  return (
    <div className="min-h-screen grid-bg flex items-center justify-center p-8">
      <div className="glass rounded-lg p-12 text-center max-w-md">
        <Construction className="w-12 h-12 mx-auto text-neon-amber mb-4" />
        <h2 className="text-xl font-bold tracking-[0.3em] text-neon-amber text-glow-cyan">
          {title}
        </h2>
        <p className="text-xs text-muted-foreground mt-2 tracking-widest">// UNDER CONSTRUCTION</p>
      </div>
    </div>
  );
}

export function Terminal() {
  return (
    <AuthGate>
      {() => (
        <>
          <ThemeApplier />
          <Shell />
        </>
      )}
    </AuthGate>
  );
}
