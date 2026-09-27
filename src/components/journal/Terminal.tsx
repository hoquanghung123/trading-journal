import { useEffect, useState, useMemo } from "react";
import {
  LayoutDashboard,
  Crosshair,
  FileText,
  LogOut,
  Terminal as TerminalIcon,
  Brain,
  CalendarCheck,
  BookOpen,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Flame,
  Shield,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import {
  onPageChange,
  parseNavFromUrl,
  navigateToPage,
  type PageId,
} from "@/lib/nav-bus";
import { ProgressView } from "./ProgressView";
import { fetchEntries, calculateStreak, fetchMyProfile } from "@/lib/journal";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { CommandPalette } from "@/components/shared/CommandPalette";
import { OnboardingModal } from "@/components/shared/OnboardingModal";
import { AppErrorBoundary } from "@/components/shared/AppErrorBoundary";
import { useQuery } from "@tanstack/react-query";
import { useSyncProfileStreak } from "@/hooks/useSyncProfileStreak";
import { fetchSettings } from "@/lib/settings";

const NAV_PRIMARY: { id: PageId; label: string; icon: React.ComponentType<{ className?: string }> }[] =
  [
    { id: "bias", label: "Bias Expect", icon: Crosshair },
    { id: "trades", label: "Trade Log", icon: FileText },
    { id: "playbook", label: "Playbook", icon: BookOpen },
    { id: "review", label: "Review", icon: CalendarCheck },
    { id: "dashboard", label: "Stats", icon: LayoutDashboard },
  ];

const NAV_SECONDARY: {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "psychology", label: "Psychology", icon: Brain },
  { id: "progress", label: "Progress", icon: Flame },
];

function ThemeApplier() {
  const { data: settings } = useQuery({
    queryKey: ["user_settings"],
    queryFn: fetchSettings,
  });

  useEffect(() => {
    if (settings?.primaryColor) {
      document.documentElement.style.setProperty("--primary", settings.primaryColor);
    }
  }, [settings?.primaryColor]);

  return null;
}

function NavButton({
  item,
  active,
  collapsed,
  mobileOpen,
  badge,
  onClick,
}: {
  item: { id: PageId; label: string; icon: React.ComponentType<{ className?: string }> };
  active: boolean;
  collapsed: boolean;
  mobileOpen: boolean;
  badge?: number;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`
        w-full flex items-center gap-3 px-4 py-3.5 sm:py-3 rounded-xl text-sm font-semibold transition-all duration-200
        ${active ? "forest-gradient text-white soft-shadow" : "text-muted-foreground hover:text-foreground hover:bg-muted"}
        ${collapsed && !mobileOpen ? "lg:justify-center lg:px-0" : ""}
      `}
    >
      <div className="relative">
        <Icon className={`w-5 h-5 shrink-0 ${active ? "text-white" : "text-muted-foreground"}`} />
        {badge != null && badge > 0 && (
          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center border border-sidebar">
            <span className="text-[9px] font-black text-white leading-none">{badge}</span>
          </div>
        )}
      </div>
      {(!collapsed || mobileOpen) && <span>{item.label}</span>}
    </button>
  );

  if (collapsed && !mobileOpen) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

function Shell() {
  const initial = parseNavFromUrl();
  const [page, setPage] = useState<PageId>(initial.page);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const unsub = onPageChange((p) => {
      setPage(p);
      setIsMobileOpen(false);
    });
    const onPop = () => setPage(parseNavFromUrl().page);
    window.addEventListener("popstate", onPop);
    navigateToPage(initial.page, initial.date ? { date: initial.date } : undefined);
    return () => {
      unsub();
      window.removeEventListener("popstate", onPop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem("terminal-active-page", page);
  }, [page]);

  const go = (id: PageId) => navigateToPage(id);

  const { data: entries } = useQuery({
    queryKey: ["journal_entries"],
    queryFn: () => fetchEntries(),
  });

  const { data: profile } = useQuery({
    queryKey: ["my_profile"],
    queryFn: fetchMyProfile,
  });

  useSyncProfileStreak(entries);

  const streak = useMemo(() => {
    if (entries) return calculateStreak(entries).currentStreak;
    return profile?.currentStreak ?? 0;
  }, [entries, profile]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const collapsed = isLeftCollapsed;

  return (
    <div
      className="min-h-screen flex bg-background font-sans overflow-hidden"
      style={
        {
          "--sidebar-width": isMobileOpen ? "0px" : collapsed ? "80px" : "260px",
        } as React.CSSProperties
      }
    >
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`
          fixed lg:relative inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-sidebar sidebar-transition
          ${isMobileOpen ? "translate-x-0 w-[280px] sidebar-mobile-shadow" : "-translate-x-full lg:translate-x-0"}
          ${collapsed ? "lg:w-[80px]" : "lg:w-[260px]"}
          lg:shadow-none
        `}
      >
        <div
          className={`px-6 py-8 flex items-center justify-between gap-3 ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center forest-gradient soft-shadow shrink-0">
              <TerminalIcon className="w-5 h-5 text-white" />
            </div>
            {(!collapsed || isMobileOpen) && (
              <div className="overflow-hidden whitespace-nowrap">
                <div className="text-lg font-bold tracking-tight text-foreground">Chartmate</div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  Trading Journal
                </div>
              </div>
            )}
          </div>

          {isMobileOpen && (
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              aria-label="Close menu"
              className="lg:hidden p-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <TooltipProvider delayDuration={0}>
          <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto hide-scrollbar" aria-label="Primary">
            {NAV_PRIMARY.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={page === item.id || (item.id === "dashboard" && page === "daily")}
                collapsed={collapsed}
                mobileOpen={isMobileOpen}
                onClick={() => go(item.id)}
              />
            ))}

            {(!collapsed || isMobileOpen) && (
              <div className="pt-4 pb-1 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                More
              </div>
            )}
            {collapsed && !isMobileOpen && <div className="h-px bg-border mx-3 my-2" />}

            {NAV_SECONDARY.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={page === item.id}
                collapsed={collapsed}
                mobileOpen={isMobileOpen}
                badge={item.id === "progress" ? streak : undefined}
                onClick={() => go(item.id)}
              />
            ))}
          </nav>

          <div
            className={`p-4 border-t border-border space-y-2 ${collapsed && !isMobileOpen ? "flex flex-col items-center" : ""}`}
          >
            {profile?.role === "admin" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="/admin"
                    className={`w-full flex items-center rounded-xl text-sm font-medium text-primary hover:bg-primary/10 border border-primary/20 bg-primary/5 transition-all ${
                      collapsed && !isMobileOpen
                        ? "justify-center py-2.5"
                        : "gap-3 px-4 py-2.5"
                    }`}
                  >
                    <Shield className="w-4 h-4 shrink-0 text-primary" />
                    {(!collapsed || isMobileOpen) && "Admin Panel"}
                  </a>
                </TooltipTrigger>
                {collapsed && !isMobileOpen && (
                  <TooltipContent side="right">Admin Panel</TooltipContent>
                )}
              </Tooltip>
            )}

            <NavButton
              item={{ id: "account", label: "Account", icon: UserCircle }}
              active={page === "account"}
              collapsed={collapsed}
              mobileOpen={isMobileOpen}
              onClick={() => go("account")}
            />

            {collapsed && !isMobileOpen ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={signOut}
                    aria-label="Sign out"
                    className="w-full flex items-center justify-center py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign Out</TooltipContent>
              </Tooltip>
            ) : (
              <button
                type="button"
                onClick={signOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
              >
                <LogOut className="w-4 h-4 shrink-0" /> Sign Out
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden lg:flex w-full mt-4 items-center justify-center p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </TooltipProvider>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="lg:hidden h-14 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-30">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            aria-label="Open menu"
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
          <div className="w-9" />
        </header>

        <main className="flex-1 overflow-y-auto relative bg-background text-foreground transition-colors duration-300">
          {collapsed && (
            <button
              type="button"
              onClick={() => setIsLeftCollapsed(false)}
              aria-label="Expand sidebar"
              className="fixed top-4 left-4 z-40 hidden lg:flex w-10 h-10 items-center justify-center rounded-xl bg-card border border-border text-muted-foreground hover:text-primary transition-all"
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
            {page === "account" && (
              <AccountSettings onManageAssets={() => setAssetsOpen(true)} />
            )}
          </div>
        </main>
      </div>

      <ManageAssetsModal open={assetsOpen} onClose={() => setAssetsOpen(false)} />
      <WeekendReviewPrompt />
      <OnboardingModal />
    </div>
  );
}

export function Terminal() {
  return (
    <AuthGate>
      {() => (
        <>
          <ThemeApplier />
          <ThemeToggle />
          <CommandPalette />
          <AppErrorBoundary>
            <Shell />
          </AppErrorBoundary>
        </>
      )}
    </AuthGate>
  );
}
