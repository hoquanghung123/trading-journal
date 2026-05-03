import { supabase } from "@/integrations/supabase/client";

export interface UserSettings {
  userId: string;
  showTradeGrade: boolean;
  primaryColor: string;
  tradeLogView: "table" | "gallery";
  dailyReminder: boolean;
  weeklyReminder: boolean;
  reminderTime: string;
  telegramChatId?: string;
}

type Row = {
  user_id: string;
  show_trade_grade: boolean;
  primary_color: string;
  trade_log_view: string;
  daily_reminder: boolean;
  weekly_reminder: boolean;
  reminder_time: string;
  telegram_chat_id: string;
};

const fromRow = (r: Row): UserSettings => ({
  userId: r.user_id,
  showTradeGrade: !!r.show_trade_grade,
  primaryColor: r.primary_color || "#4C763B",
  tradeLogView: (r.trade_log_view as "table" | "gallery") || "table",
  dailyReminder: r.daily_reminder ?? false,
  weeklyReminder: r.weekly_reminder ?? false,
  reminderTime: r.reminder_time || "08:00",
  telegramChatId: r.telegram_chat_id,
});

export async function fetchSettings(): Promise<UserSettings> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", u.user.id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    // Initialize default settings if not exists
    const defaultSettings: Row = {
      user_id: u.user.id,
      show_trade_grade: false,
      primary_color: "#4C763B",
      trade_log_view: "table",
      daily_reminder: false,
      weekly_reminder: false,
      reminder_time: "08:00",
      telegram_chat_id: "",
    };
    const { error: insError } = await supabase.from("user_settings").insert(defaultSettings);
    if (insError) throw insError;
    return fromRow(defaultSettings);
  }

  const settings = fromRow(data as Row);
  if (settings.primaryColor) {
    localStorage.setItem("tg_primary_color", settings.primaryColor);
  }
  return settings;
}

export async function updateSettings(patch: Partial<UserSettings>): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");

  const update: any = {};
  if (patch.showTradeGrade !== undefined) update.show_trade_grade = patch.showTradeGrade;
  if (patch.primaryColor !== undefined) {
    update.primary_color = patch.primaryColor;
    localStorage.setItem("tg_primary_color", patch.primaryColor);
  }
  if (patch.tradeLogView !== undefined) update.trade_log_view = patch.tradeLogView;
  if (patch.dailyReminder !== undefined) update.daily_reminder = patch.dailyReminder;
  if (patch.weeklyReminder !== undefined) update.weekly_reminder = patch.weeklyReminder;
  if (patch.reminderTime !== undefined) update.reminder_time = patch.reminderTime;
  if (patch.telegramChatId !== undefined) update.telegram_chat_id = patch.telegramChatId;
  update.updated_at = new Date().toISOString();


  const { error } = await supabase.from("user_settings").update(update).eq("user_id", u.user.id);

  if (error) throw error;
}

