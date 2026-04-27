import { useEffect, useState } from "react";
import { Save, X, ArrowRight, Sparkles } from "lucide-react";
import { useReviewsStorage } from "@/hooks/useReviewsStorage";
import { useNavigate } from "@tanstack/react-router";

// Helper to get current week period, e.g., "2026-04-W3"
// Matches logic in ReviewPage.tsx
const getCurrentWeekPeriod = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  
  const firstDayOfMonth = new Date(year, d.getMonth(), 1);
  const dayOffset = (firstDayOfMonth.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const weekOfMonth = Math.ceil((d.getDate() + dayOffset) / 7);
  
  return `${year}-${month}-W${weekOfMonth}`;
};

export function WeekendReviewPrompt() {
  const { reviews, isLoaded } = useReviewsStorage();
  const [show, setShow] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoaded) return;

    const checkReview = () => {
      const now = new Date();
      const isSaturday = now.getDay() === 6;
      const isTest = new URLSearchParams(window.location.search).get("test") === "review";

      if (isSaturday || isTest) {
        const period = getCurrentWeekPeriod();
        const existing = reviews.find(r => r.period === period);
        
        // Show if no review exists or if it's empty
        if (!existing || (!existing.technicalReflection && !existing.psychologicalReflection)) {
          setShow(true);
        }
      }
    };

    checkReview();
  }, [isLoaded, reviews]);

  if (!show) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[110] w-[90%] max-w-2xl animate-in slide-in-from-top-10 duration-500">
      <div className="bg-white/80 backdrop-blur-xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[24px] overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Save className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                Weekend Review <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
              </h3>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Hôm nay là Thứ 7 rồi, bạn đã review chưa?</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                // @ts-ignore - navigation to string path
                navigate({ to: "/review" });
                setShow(false);
              }}
              className="bg-amber-500 text-white px-4 py-2 rounded-xl font-bold text-[11px] uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:bg-amber-600 active:scale-95 transition-all flex items-center gap-2"
            >
              Đi đến Review <ArrowRight className="w-3 h-3" />
            </button>

            <button 
              onClick={() => setShow(false)}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
