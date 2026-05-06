import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchTrades, type Trade } from "@/lib/trades";
import {
  updateAchievement,
  calculateLevel,
  ACHIEVEMENT_CONFIG,
  fetchUserAchievements,
} from "@/lib/achievements";
import { toast } from "sonner";

export function useAchievementTracker() {
  const track = useCallback(async (currentTrade?: Trade) => {
    try {
      // Fetch current achievements to compare levels later
      const prevAchievements = await fetchUserAchievements();
      const trades = await fetchTrades();
      const { data: journalEntries } = await supabase
        .from("journal_entries")
        .select("yearly_img, monthly_img, weekly_img, daily_img, h4");

      // 0. Discipline Check (Specific to the current trade)
      if (currentTrade) {
        const date = new Date(currentTrade.entryTime).toISOString().split("T")[0];
        const tradesToday = trades.filter(
          (t) => new Date(t.entryTime).toISOString().split("T")[0] === date,
        );

        if (currentTrade.riskPercent && currentTrade.riskPercent > 1) {
          toast.warning("Discipline Alert: Risk exceeded 1% for this trade.", {
            description: "Consistency is key to longevity.",
            duration: 5000,
          });
        } else if (tradesToday.length > 1) {
          toast.warning("Discipline Alert: More than 1 trade taken today.", {
            description: "Overtrading is a common pitfall.",
            duration: 5000,
          });
        } else {
          toast.success("Discipline Maintained!", {
            description: "Risk rule followed. 1 trade/day limit respected.",
          });
        }
      }

      // 1. Risk Manager (Psychology)
      let riskStreak = 0;
      const tradesByDate: Record<string, number> = {};
      const sortedTrades = [...trades].sort(
        (a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime(),
      );

      for (const trade of sortedTrades) {
        const date = new Date(trade.entryTime).toISOString().split("T")[0];
        tradesByDate[date] = (tradesByDate[date] || 0) + 1;

        const isLowRisk = (trade.riskPercent || 0) <= 1;
        const isOnlyTrade = tradesByDate[date] === 1;

        if (isLowRisk && isOnlyTrade) {
          riskStreak++;
        } else {
          riskStreak = 0;
        }
      }

      const riskLevel = calculateLevel("risk_manager", riskStreak);
      await updateAchievement("risk_manager", riskStreak, riskLevel);

      // 2. Win Streak (Performance)
      let currentWinStreak = 0;
      let maxWinStreak = 0;
      for (const trade of sortedTrades) {
        if (trade.netPnl > 0) {
          currentWinStreak++;
          maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
        } else if (trade.netPnl < 0) {
          currentWinStreak = 0;
        }
      }
      const streakLevel = calculateLevel("win_streak", maxWinStreak);
      await updateAchievement("win_streak", maxWinStreak, streakLevel);

      // 3. Wealth Builder (Performance)
      const totalPnl = trades.reduce((sum, t) => sum + t.netPnl, 0);
      const pnlLevel = calculateLevel("pnl_growth", totalPnl);
      await updateAchievement("pnl_growth", totalPnl, pnlLevel);

      // 4. Research Scholar (Knowledge - Count total images)
      let totalImages = 0;
      journalEntries?.forEach((entry: any) => {
        if (entry.yearly_img) totalImages++;
        if (entry.monthly_img) totalImages++;
        if (entry.weekly_img) totalImages++;
        if (entry.daily_img) totalImages++;
        if (entry.h4 && typeof entry.h4 === "object") {
          Object.values(entry.h4).forEach((session: any) => {
            if (typeof session === "string" && session) totalImages++;
            else if (session?.img) totalImages++;
          });
        }
      });
      const researchLevel = calculateLevel("knowledge_base", totalImages);
      await updateAchievement("knowledge_base", totalImages, researchLevel);

      // Notification logic for new levels
      const newLevels = [
        { key: "risk_manager", level: riskLevel },
        { key: "win_streak", level: streakLevel },
        { key: "pnl_growth", level: pnlLevel },
        { key: "knowledge_base", level: researchLevel },
      ];

      for (const item of newLevels) {
        const prev = prevAchievements.find((a) => a.achievementKey === item.key);
        if (item.level !== "None" && (!prev || item.level !== prev.highestLevel)) {
          const config = ACHIEVEMENT_CONFIG[item.key as keyof typeof ACHIEVEMENT_CONFIG];
          toast.success(`Achievement Unlocked: ${config.name}!`, {
            description: `You've reached ${item.level} level. Keep going!`,
            duration: 8000,
          });
        }
      }
    } catch (error) {
      console.error("Error tracking achievements:", error);
    }
  }, []);

  return { track };
}
