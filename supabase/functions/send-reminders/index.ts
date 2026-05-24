import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// Global cache in V8 isolate memory to prevent rate limits
let cachedCalendar: any[] | null = null;
let lastFetchedTime = 0;

async function fetchCalendarEvents(): Promise<any[]> {
  const nowMs = Date.now();
  // Cache for 10 minutes to respect the 2 requests per 5 minutes limit
  if (cachedCalendar && (nowMs - lastFetchedTime < 10 * 60 * 1000)) {
    console.log("Using cached Forex calendar events");
    return cachedCalendar;
  }
  
  try {
    console.log("Fetching fresh Forex calendar events...");
    const res = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch Forex calendar: ${res.statusText}`);
    }
    const data = await res.json();
    cachedCalendar = data;
    lastFetchedTime = nowMs;
    return data;
  } catch (err) {
    console.error("Error fetching Forex calendar:", err);
    return cachedCalendar || [];
  }
}

// Vietnam Timezone Helpers (GMT+7)
const getVNTimezoneDay = (date: Date) => {
  const vnOffsetDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return vnOffsetDate.getUTCDay();
};

const getVNDayOfWeekString = (date: Date) => {
  const day = getVNTimezoneDay(date);
  const days = ["Chủ Nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  return days[day];
};

const getVNParts = (date: Date) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";
  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute")
  };
};

const getVNDateString = (date: Date) => {
  const p = getVNParts(date);
  return `${p.year}-${p.month}-${p.day}`;
};

const getVNTime = (date: Date) => {
  const p = getVNParts(date);
  return `${p.hour}:${p.minute}`;
};

const getNYParts = (date: Date) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";
  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute")
  };
};

const getNYTime = (date: Date) => {
  const p = getNYParts(date);
  return `${p.hour}:${p.minute}`;
};

// Premium economic news formatter
export function formatNewsMessage(
  events: any[],
  currencies: string[],
  impacts: string[],
  title: string
): string {
  const filtered = events.filter((e) => {
    const eventCurrency = e.country?.toUpperCase();
    if (!currencies.map(c => c.toUpperCase()).includes(eventCurrency)) {
      return false;
    }

    const eventImpact = e.impact?.toLowerCase();
    if (!impacts.map(i => i.toLowerCase()).includes(eventImpact)) {
      return false;
    }

    if (eventImpact === "low") {
      const eventTitle = e.title?.toLowerCase() || "";
      if (!eventTitle.includes("crude oil inventories")) {
        return false;
      }
    }

    return true;
  });

  if (filtered.length === 0) {
    return `📅 *${title}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n🟢 Không có tin tức kinh tế quan trọng nào cần lưu ý theo cấu hình bộ lọc của bạn.\n━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  }

  filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let message = `📅 *${title}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  let currentGroupDate = "";
  for (const e of filtered) {
    const eventDate = new Date(e.date);
    const dateStr = getVNDateString(eventDate);
    const dayName = getVNDayOfWeekString(eventDate);

    if (dateStr !== currentGroupDate) {
      if (currentGroupDate !== "") {
        message += "\n";
      }
      message += `*📅 ${dayName} (${dateStr})*\n`;
      currentGroupDate = dateStr;
    }

    const timeStr = getVNTime(eventDate);
    const nyTimeStr = getNYTime(eventDate);
    const eventCurrency = e.country?.toUpperCase() || "";
    
    let emoji = "⚪";
    if (e.impact.toLowerCase() === "high") emoji = "🔴";
    else if (e.impact.toLowerCase() === "medium") emoji = "🟠";
    else if (e.impact.toLowerCase() === "low") emoji = "🟡";

    message += `${emoji} *${timeStr} VN (${nyTimeStr} NY)* - *(${eventCurrency})* - ${e.title}\n`;
  }
  
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `*Mức độ ảnh hưởng:* 🔴 Cao | 🟠 Trung bình | 🟡 Thấp (dầu thô) | ⚪ Khác\n`;
  message += `_Lọc theo: ${currencies.join(", ")}_`;

  return message;
}

Deno.serve(async (req) => {
  const now = new Date();
  
  const currentTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  console.log(`Checking reminders for: ${currentTime}`);

  const { data: users, error } = await supabase
    .from("user_settings")
    .select("user_id, telegram_chat_id, daily_reminder, weekly_reminder, daily_reminder_time, weekly_reminder_time, asian_reminder, asian_time, london_reminder, london_time, ny_reminder, ny_time, forex_news_reminder, forex_news_currencies, forex_news_impacts, forex_news_time_daily, forex_news_time_weekly")
    .not("telegram_chat_id", "is", null);

  if (error) {
    console.error("Error fetching users:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const dayOfWeek = now.getDay();
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

    // C. Asian Bias Reminder
    if (user.asian_reminder && user.asian_time?.substring(0, 5) === currentTime) {
      await sendTelegramMessage(chat_id, "🌏 *Phiên Á (Asian Session)*\n\nĐã đến giờ lập kế hoạch Bias cho phiên Á rồi. Hãy xem qua các cặp tiền liên quan và cập nhật phân tích của bạn nhé! 🕯️");
      notificationsSent.push({ userId: user.user_id, type: "asian" });
    }

    // D. London Bias Reminder
    if (user.london_reminder && user.london_time?.substring(0, 5) === currentTime) {
      await sendTelegramMessage(chat_id, "🏛️ *Phiên Âu (London Session)*\n\nPhiên London sắp bắt đầu. Đã đến lúc xác định Bias và tìm kiếm cơ hội giao dịch cho phiên này rồi! ⚡");
      notificationsSent.push({ userId: user.user_id, type: "london" });
    }

    // E. NY Bias Reminder
    if (user.ny_reminder && user.ny_time?.substring(0, 5) === currentTime) {
      await sendTelegramMessage(chat_id, "🗽 *Phiên Mỹ (NY Session)*\n\nPhiên New York đã sẵn sàng. Hãy dành ít phút để kiểm tra lại Bias và tin tức quan trọng trước khi vào lệnh nhé! 🇺🇸");
      notificationsSent.push({ userId: user.user_id, type: "ny" });
    }

    // F. Forex Economic News Reminders
    if (user.forex_news_reminder && user.forex_news_currencies && user.forex_news_currencies.length > 0) {
      // 1. Tomorrow's News Reminder (Every Night)
      if (user.forex_news_time_daily?.substring(0, 5) === currentTime) {
        try {
          const events = await fetchCalendarEvents();
          const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          const tomorrowDateStr = getVNDateString(tomorrow);
          
          // CHECK IF FEED IS OUTDATED (Sunday morning New York timezone sync)
          const maxDateStr = events.reduce((max, e) => {
            if (!e.date) return max;
            const dateStr = getVNDateString(new Date(e.date));
            return dateStr > max ? dateStr : max;
          }, "");

          if (maxDateStr && maxDateStr < tomorrowDateStr) {
            const warningMessage = `⚠️ *Dữ liệu ngày mai chưa được cập nhật*\n\n` +
              `Hiện tại máy chủ Forex Factory (múi giờ Mỹ) chưa bước sang tuần mới nên lịch tin tức cho ngày *${tomorrowDateStr}* chưa sẵn sàng.\n\n` +
              `Bản tin ngày mai sẽ sẵn sàng vào khoảng *11:00 trưa hôm nay (Chủ Nhật)*. Bạn vui lòng thử lại sau thời gian này nhé! ☕`;
            await sendTelegramMessage(chat_id, warningMessage);
          } else {
            const tomorrowEvents = events.filter((e) => {
              const eventDate = new Date(e.date);
              return getVNDateString(eventDate) === tomorrowDateStr;
            });

            const formattedTitle = `TIN TỨC KINH TẾ NGÀY MAI (${getVNDayOfWeekString(tomorrow)}, ${tomorrowDateStr})`;
            const text = formatNewsMessage(
              tomorrowEvents,
              user.forex_news_currencies,
              user.forex_news_impacts || ["high", "medium"],
              formattedTitle
            );

            await sendTelegramMessage(chat_id, text);
          }
          notificationsSent.push({ userId: user.user_id, type: "forex_daily" });
        } catch (err) {
          console.error(`Error sending tomorrow's news reminder for ${user.user_id}:`, err);
        }
      }

      // 2. Weekly News Reminder (On Sunday)
      const vnDayOfWeek = getVNTimezoneDay(now);
      if (vnDayOfWeek === 0 && user.forex_news_time_weekly?.substring(0, 5) === currentTime) {
        try {
          const events = await fetchCalendarEvents();
          const startOfWeek = new Date(now.getTime());
          const endOfWeek = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
          const startOfWeekStr = getVNDateString(startOfWeek);
          const endOfWeekStr = getVNDateString(endOfWeek);

          // CHECK IF FEED IS OUTDATED (Sunday morning New York timezone sync)
          const maxDateStr = events.reduce((max, e) => {
            if (!e.date) return max;
            const dateStr = getVNDateString(new Date(e.date));
            return dateStr > max ? dateStr : max;
          }, "");

          if (maxDateStr && maxDateStr < startOfWeekStr) {
            const warningMessage = `⚠️ *Dữ liệu tuần mới chưa được cập nhật*\n\n` +
              `Hiện tại máy chủ Forex Factory (múi giờ Mỹ) chưa bước sang tuần mới nên lịch tin tức từ *${startOfWeekStr}* đến *${endOfWeekStr}* chưa sẵn sàng.\n\n` +
              `Bản tin tuần mới sẽ tự động khả dụng vào khoảng *11:00 trưa hôm nay (Chủ Nhật)*. Bạn vui lòng thử lại sau thời gian này hoặc điều chỉnh khung giờ nhận tin muộn hơn trong phần cài đặt nhé! ☕`;
            await sendTelegramMessage(chat_id, warningMessage);
          } else {
            const weeklyEvents = events.filter((e) => {
              const eventDate = new Date(e.date);
              const dateStr = getVNDateString(eventDate);
              return dateStr >= startOfWeekStr && dateStr <= endOfWeekStr;
            });

            const formattedTitle = `TIN TỨC KINH TẾ TUẦN MỚI (Từ ${startOfWeekStr} đến ${endOfWeekStr})`;
            const text = formatNewsMessage(
              weeklyEvents,
              user.forex_news_currencies,
              user.forex_news_impacts || ["high", "medium"],
              formattedTitle
            );

            await sendTelegramMessage(chat_id, text);
          }
          notificationsSent.push({ userId: user.user_id, type: "forex_weekly" });
        } catch (err) {
          console.error(`Error sending weekly news reminder for ${user.user_id}:`, err);
        }
      }
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
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown",
      }),
    });
    if (!res.ok) {
      console.error(`Telegram send failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error("Failed to send telegram message:", err);
  }
}
