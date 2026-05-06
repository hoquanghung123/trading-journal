import { supabase } from "@/integrations/supabase/client";

export type AchievementLevel = "None" | "Bronze" | "Silver" | "Gold" | "Diamond";

export interface UserAchievement {
  achievementKey: string;
  currentValue: number;
  highestLevel: AchievementLevel;
}

export const ACHIEVEMENT_CONFIG = {
  risk_manager: {
    name: "Risk Manager",
    category: "Psychology",
    description: "Trades with <= 1% risk and 1 trade/day",
    milestones: { Bronze: 5, Silver: 10, Gold: 15, Diamond: 20 },
    title: "Risk Sentinel",
  },
  win_streak: {
    name: "Streak Master",
    category: "Performance",
    description: "Consecutive winning trades",
    milestones: { Bronze: 3, Silver: 5, Gold: 8, Diamond: 12 },
    title: "Unstoppable",
  },
  pnl_growth: {
    name: "Wealth Builder",
    category: "Performance",
    description: "Total net profit milestones",
    milestones: { Bronze: 1000, Silver: 5000, Gold: 10000, Diamond: 50000 },
    title: "Market Whale",
  },
  knowledge_base: {
    name: "Research Scholar",
    category: "Knowledge",
    description: "Total images logged across all timeframes",
    milestones: { Bronze: 1000, Silver: 5000, Gold: 10000, Diamond: 20000 },
    title: "Alpha Sage",
  },
} as const;

export async function fetchUserAchievements(): Promise<UserAchievement[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_achievements")
    .select("achievement_key, current_value, highest_level")
    .eq("user_id", user.id);

  if (error) throw error;

  return data.map((r) => ({
    achievementKey: r.achievement_key,
    currentValue: Number(r.current_value),
    highestLevel: r.highest_level as AchievementLevel,
  }));
}

export async function updateAchievement(
  key: string,
  value: number,
  level: AchievementLevel,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("user_achievements").upsert(
    {
      user_id: user.id,
      achievement_key: key,
      current_value: value,
      highest_level: level,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id, achievement_key" },
  );

  if (error) throw error;
}

export function calculateLevel(
  key: keyof typeof ACHIEVEMENT_CONFIG,
  value: number,
): AchievementLevel {
  const config = ACHIEVEMENT_CONFIG[key];
  if (value >= config.milestones.Diamond) return "Diamond";
  if (value >= config.milestones.Gold) return "Gold";
  if (value >= config.milestones.Silver) return "Silver";
  if (value >= config.milestones.Bronze) return "Bronze";
  return "None";
}
