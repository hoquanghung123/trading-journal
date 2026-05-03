import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

Deno.serve(async (req) => {
  const now = new Date();
  
  // Get current time in Vietnam (HH:mm format)
  const currentTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  console.log(`Checking reminders for: ${currentTime}`);

  // 1. Fetch users who have any kind of reminders enabled
  const { data: users, error } = await supabase
    .from("user_settings")
    .select("user_id, telegram_chat_id, daily_reminder, weekly_reminder, daily_reminder_time, weekly_reminder_time, asian_reminder, asian_time, london_reminder, london_time, ny_reminder, ny_time")
    .not("telegram_chat_id", "is", null);

  if (error) {
    console.error("Error fetching users:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  const notificationsSent = [];

  for (const user of users) {
    const chat_id = user.telegram_chat_id;

    // A. Daily Psychology Logic
    if (user.daily_reminder && user.daily_reminder_time?.substring(0, 5) === currentTime) {
      await sendTelegramMessage(chat_id, "🔔 *Nhắc nhở hằng ngày*\n\nChào bạn! Đã đến giờ ghi lại nhật ký tâm lý (Psychology Journal) cho ngày hôm nay rồi. Hãy dành 5 phút để nhìn lại cảm xúc của mình nhé! 🧘‍♂️");
      notificationsSent.push({ userId: user.user_id, type: "daily" });
    }

    // B. Weekend Review Logic (Only on Saturday)
    if (user.weekly_reminder && dayOfWeek === 6 && user.weekly_reminder_time?.substring(0, 5) === currentTime) {
      await sendTelegramMessage(chat_id, "📊 *Review cuối tuần*\n\nMột tuần giao dịch nữa đã trôi qua. Hãy dành chút thời gian để xem lại các lệnh (Trade Review) và rút kinh nghiệm cho tuần tới nhé! 📈");
      notificationsSent.push({ userId: user.user_id, type: "weekly" });
    }

    // B. Asian Bias Reminder
    if (user.asian_reminder && user.asian_time?.substring(0, 5) === currentTime) {
      await sendTelegramMessage(chat_id, "🌏 *Phiên Á (Asian Session)*\n\nĐã đến giờ lập kế hoạch Bias cho phiên Á rồi. Hãy xem qua các cặp tiền liên quan và cập nhật phân tích của bạn nhé! 🕯️");
      notificationsSent.push({ userId: user.user_id, type: "asian" });
    }

    // C. London Bias Reminder
    if (user.london_reminder && user.london_time?.substring(0, 5) === currentTime) {
      await sendTelegramMessage(chat_id, "🏛️ *Phiên Âu (London Session)*\n\nPhiên London sắp bắt đầu. Đã đến lúc xác định Bias và tìm kiếm cơ hội giao dịch cho phiên này rồi! ⚡");
      notificationsSent.push({ userId: user.user_id, type: "london" });
    }

    // D. NY Bias Reminder
    if (user.ny_reminder && user.ny_time?.substring(0, 5) === currentTime) {
      await sendTelegramMessage(chat_id, "🗽 *Phiên Mỹ (NY Session)*\n\nPhiên New York đã sẵn sàng. Hãy dành ít phút để kiểm tra lại Bias và tin tức quan trọng trước khi vào lệnh nhé! 🇺🇸");
      notificationsSent.push({ userId: user.user_id, type: "ny" });
    }
  }

  return new Response(JSON.stringify({ 
    status: "success", 
    currentTime, 
    notificationsSentCount: notificationsSent.length 
  }), {
    headers: { "Content-Type": "application/json" },
  });
});

async function sendTelegramMessage(chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown",
      }),
    });
  } catch (err) {
    console.error("Failed to send telegram message:", err);
  }
}
