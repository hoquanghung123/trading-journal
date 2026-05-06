import { supabase } from "@/integrations/supabase/client";

export type AchievementLevel = "None" | "Bronze" | "Silver" | "Gold" | "Diamond";

export interface UserAchievement {
  achievementKey: string;
  currentValue: number;
  highestLevel: AchievementLevel;
}

export const ACHIEVEMENT_CONFIG = {
  risk_manager: {
    name: "Kẻ Nhát Gan Có Kỷ Luật",
    category: "Psychology",
    description: "Đi lệnh <= 1% để tối ngủ ngon không cần dùng thuốc trợ tim",
    milestones: { Bronze: 5, Silver: 10, Gold: 15, Diamond: 20 },
    title: "Thần Hộ Mệnh Tài Khoản",
  },
  win_streak: {
    name: "Chuỗi Thắng Ảo Ma",
    category: "Performance",
    description: "Thắng liên tiếp nhiều lệnh (coi chừng ảo tưởng sức mạnh đó nha)",
    milestones: { Bronze: 3, Silver: 5, Gold: 8, Diamond: 12 },
    title: "Cụ Tổ Ngành Nến",
  },
  pnl_growth: {
    name: "Máy In Tiền Chạy Cơm",
    category: "Performance",
    description: "Gom góp bạc lẻ chờ ngày mua Roll-Royce, hiện tại đủ mua mì tôm",
    milestones: { Bronze: 1000, Silver: 5000, Gold: 10000, Diamond: 50000 },
    title: "Cá Voi Quận Cam",
  },
  knowledge_base: {
    name: "Chiến Thần Soi Chart",
    category: "Knowledge",
    description: "Soi nến kỹ hơn soi người yêu, ảnh nhiều đến mức Google Photos cũng sợ",
    milestones: { Bronze: 1000, Silver: 5000, Gold: 10000, Diamond: 20000 },
    title: "Trùm Cuối Soi Kèo",
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
