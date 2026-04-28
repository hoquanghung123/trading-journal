import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { useEffect } from "react";
import { toast, Toaster } from "sonner";
import { resolveTradingViewUrl, uploadChartImage, upsertEntry, fetchEntries, Session, weekdayOf } from "../lib/journal";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ICT Trading Journal" },
      { name: "description", content: "A trading journal app for ICT traders." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Listen for our specific extension message
      if (event.data?.source !== 'JOURNAL_EXTENSION') return;
      
      const data = event.data.payload;
      
      if ((window as any).__JOURNAL_SYNC_IN_PROGRESS__) return;
      (window as any).__JOURNAL_SYNC_IN_PROGRESS__ = true;

      const { asset: targetAsset, timeframe, url } = data;
      const tvUrl = resolveTradingViewUrl(url);
      
      if (!tvUrl) {
        toast.error('Link TradingView không hợp lệ');
        (window as any).__JOURNAL_SYNC_IN_PROGRESS__ = false;
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const tf = timeframe.toUpperCase();

      // Early validation for Monthly
      if ((tf === "M" || tf === "MONTH" || tf === "1M") && weekdayOf(today) !== "MON") {
        toast.error("Khung Monthly chỉ được phép lưu vào ngày Thứ 2!");
        (window as any).__JOURNAL_SYNC_IN_PROGRESS__ = false;
        return;
      }

      toast.info(`Nhận dữ liệu ${targetAsset}...`, { duration: 2000 });

      const toastId = toast.loading(`Đang đồng bộ ${targetAsset}...`);

      try {
        const currentEntries = await fetchEntries();
        let entry = currentEntries.find(e => e.date === today && e.asset === targetAsset);
        
        if (!entry) {
          entry = {
            id: crypto.randomUUID(),
            date: today,
            asset: targetAsset,
            weeklyBias: "consolidation",
            weeklyCorrect: false,
            monthlyBias: "consolidation",
            monthlyCorrect: false,
            dailyBias: "consolidation",
            dailyCorrect: false,
            h4: {},
          };
        }

        const path = await uploadChartImage(tvUrl);
        const updatedEntry = { ...entry };
        
        if (tf === "M" || tf === "MONTH" || tf === "1M") {
          toast.info("Đang lưu vào khung MONTHLY...");
          updatedEntry.monthlyImg = path;
        } else if (tf === "W" || tf === "WEEK") {
          toast.info("Đang lưu vào khung WEEKLY...");
          updatedEntry.weeklyImg = path;
        } else if (tf === "D" || tf === "DAY") {
          toast.info("Đang lưu vào khung DAILY...");
          updatedEntry.dailyImg = path;
        } else {
          const hour = new Date().getHours();
          let session: Session = "ASIA";
          if (hour >= 12 && hour < 18) session = "LDN";
          else if (hour >= 18 || hour < 5) session = "NY";
          toast.info(`Đang lưu vào khung H4 (${session})...`);
          updatedEntry.h4 = { ...entry.h4, [session]: path };
        }
        
        await upsertEntry(updatedEntry);
        toast.success(`Đã lưu ${targetAsset} thành công!`, { id: toastId });
        
        // Reload faster
        setTimeout(() => {
          window.location.reload();
        }, 300);
      } catch (err: any) {
        toast.error("Lỗi: " + err.message, { id: toastId });
      } finally {
        (window as any).__JOURNAL_SYNC_IN_PROGRESS__ = false;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <>
      <Outlet />
      <Toaster position="top-right" richColors />
    </>
  );
}
