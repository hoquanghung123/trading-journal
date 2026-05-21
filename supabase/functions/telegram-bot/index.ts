import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

const SPLIT_NY_ASSETS = ["ES1!", "YM1!", "NQ1!", "ES", "YM", "NQ"];

Deno.serve(async (req) => {
  try {
    // --- 0. SELF-REGISTER TELEGRAM WEBHOOK ON GET REQUEST ---
    if (req.method === "GET" || req.url.includes("/setup")) {
      const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
      const functionUrl = `https://mlyowmvrpjtqruramrhp.supabase.co/functions/v1/telegram-bot`;
      
      const registerUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${functionUrl}`;
      const response = await fetch(registerUrl);
      const result = await response.json();
      
      return new Response(JSON.stringify({
        message: "Telegram Webhook self-registration result",
        success: result.ok,
        telegram_response: result,
        target_url: functionUrl
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const { message, callback_query } = body;

    // --- 1. HANDLE CALLBACK QUERIES (BUTTON CLICKS) ---
    if (callback_query) {
      const chatId = callback_query.message.chat.id.toString();
      const messageId = callback_query.message.message_id;
      const data = callback_query.data;

      const userId = await getUserByChatId(chatId);
      if (!userId) {
        await answerCallbackQuery(callback_query.id, "❌ Vui lòng liên kết tài khoản trước!");
        return new Response("OK");
      }

      if (data === "none") {
        await answerCallbackQuery(callback_query.id);
        return new Response("OK");
      }

      if (data.startsWith("select_asset:")) {
        // Select asset and show main dashboard
        const asset = data.split(":")[1];
        const todayStr = new Date().toISOString().slice(0, 10);
        const entry = await getOrCreateJournalEntry(userId, asset, todayStr);

        await editTelegramMessage(
          chatId,
          messageId,
          formatDashboardText(entry),
          getMainMenuReplyMarkup(entry.id, asset, entry.date)
        );
        await answerCallbackQuery(callback_query.id);
      } 
      else if (data === "change_asset") {
        const symbols = await getUserSymbols(userId);
        const keyboard = symbols.map((symbol) => [
          { text: symbol, callback_data: `select_asset:${symbol}` },
        ]);

        await editTelegramMessage(
          chatId,
          messageId,
          "🪙 <b>Chọn tài sản bạn muốn lên Bias hôm nay:</b>",
          { inline_keyboard: keyboard }
        );
        await answerCallbackQuery(callback_query.id);
      } 
      else if (data.startsWith("menub:")) {
        // Show bias choices sub-menu
        const parts = data.split(":");
        if (parts[1] === "h4") {
          const sessionName = parts[2];
          const entryId = parts[3];
          await editTelegramMessage(
            chatId,
            messageId,
            `🕒 <b>Phiên H4 - ${sessionName}:</b> Chọn Bias bên dưới hoặc gửi ảnh chart:`,
            getH4BiasSubMenuReplyMarkup(sessionName, entryId)
          );
        } else {
          const fieldCode = parts[1]; // "m", "w", "d"
          const field = fieldCode === "m" ? "monthly" : fieldCode === "w" ? "weekly" : fieldCode === "d" ? "daily" : fieldCode;
          const entryId = parts[2];
          await editTelegramMessage(
            chatId,
            messageId,
            `📊 <b>Khung ${field.toUpperCase()}:</b> Chọn Bias bên dưới hoặc gửi ảnh chart:`,
            getBiasSubMenuReplyMarkup(fieldCode, entryId)
          );
        }
        await answerCallbackQuery(callback_query.id);
      }
      else if (data.startsWith("menuh4:")) {
        const entryId = data.split(":")[1];
        const { data: entry } = await supabase
          .from("journal_entries")
          .select("asset")
          .eq("id", entryId)
          .single();

        await editTelegramMessage(
          chatId,
          messageId,
          `🕒 <b>H4 Sessions:</b> Chọn phiên làm việc bên dưới để cập nhật Bias:`,
          getH4SessionsMenuReplyMarkup(entryId, entry.asset)
        );
        await answerCallbackQuery(callback_query.id);
      } 
      else if (data.startsWith("setb:")) {
        // Update bias in database and return to main dashboard
        const parts = data.split(":");
        let entryId = "";
        const updateData: any = {};

        if (parts[1] === "h4") {
          const sessionName = parts[2];
          const shortBias = parts[3];
          const biasValue = shortBias === "bull" ? "bullish" : shortBias === "bear" ? "bearish" : shortBias === "cons" ? "consolidation" : shortBias;
          entryId = parts[4];

          const { data: entry } = await supabase
            .from("journal_entries")
            .select("h4")
            .eq("id", entryId)
            .single();

          const h4 = entry?.h4 || {};
          h4[sessionName] = { ...h4[sessionName], bias: biasValue };
          updateData.h4 = h4;
        } else {
          const fieldCode = parts[1]; // "m", "w", "d"
          const field = fieldCode === "m" ? "monthly" : fieldCode === "w" ? "weekly" : fieldCode === "d" ? "daily" : fieldCode;
          const shortBias = parts[2];
          const biasValue = shortBias === "bull" ? "bullish" : shortBias === "bear" ? "bearish" : shortBias === "cons" ? "consolidation" : shortBias;
          entryId = parts[3];
          updateData[`${field}_bias`] = biasValue;
        }

        await supabase.from("journal_entries").update(updateData).eq("id", entryId);

        const { data: updated } = await supabase
          .from("journal_entries")
          .select("*")
          .eq("id", entryId)
          .single();

        await editTelegramMessage(
          chatId,
          messageId,
          formatDashboardText(updated),
          getMainMenuReplyMarkup(entryId, updated.asset, updated.date)
        );
        await answerCallbackQuery(callback_query.id, "✅ Đã cập nhật bias!");
      } 
      else if (data.startsWith("inch:")) {
        // Prompt for chart link or photo using force_reply
        const parts = data.split(":");
        let fieldLabel = "";
        let entryId = "";

        if (parts[1] === "h4") {
          const sessionName = parts[2];
          entryId = parts[3];
          fieldLabel = `H4 ${sessionName} Chart`;
        } else {
          const fieldCode = parts[1];
          const field = fieldCode === "m" ? "monthly" : fieldCode === "w" ? "weekly" : fieldCode === "d" ? "daily" : fieldCode;
          entryId = parts[2];
          fieldLabel = `${field.charAt(0).toUpperCase() + field.slice(1)} Chart`;
        }

        const assetMatch = callback_query.message.text.match(/🪙 <b>Tài sản:<\/b>\s*<code>(.*?)<\/code>/i);
        const cleanAsset = assetMatch ? assetMatch[1] : "GC1!";
        const prompt = `[${cleanAsset} - ${fieldLabel}] Nhập link hoặc gửi ảnh cho ID [${entryId}]:`;
        
        await sendTelegramMessageWithForceReply(chatId, prompt);
        await answerCallbackQuery(callback_query.id);
      } 
      else if (data.startsWith("innotes:")) {
        // Prompt for notes using force_reply
        const entryId = data.split(":")[1];
        const assetMatch = callback_query.message.text.match(/🪙 <b>Tài sản:<\/b>\s*<code>(.*?)<\/code>/i);
        const cleanAsset = assetMatch ? assetMatch[1] : "GC1!";
        const prompt = `[${cleanAsset} - Notes] Nhập notes cho ID [${entryId}]:`;

        await sendTelegramMessageWithForceReply(chatId, prompt);
        await answerCallbackQuery(callback_query.id);
      } 
      else if (data.startsWith("backm:")) {
        // Go back to main dashboard
        const entryId = data.split(":")[1];
        const { data: entry } = await supabase
          .from("journal_entries")
          .select("*")
          .eq("id", entryId)
          .single();

        await editTelegramMessage(
          chatId,
          messageId,
          formatDashboardText(entry),
          getMainMenuReplyMarkup(entryId, entry.asset, entry.date)
        );
        await answerCallbackQuery(callback_query.id);
      } 
      else if (data.startsWith("finb:")) {
        // Lock and finish draft
        const entryId = data.split(":")[1];
        const { data: entry } = await supabase
          .from("journal_entries")
          .select("*")
          .eq("id", entryId)
          .single();

        await editTelegramMessage(
          chatId,
          messageId,
          `🎉 <b>ĐÃ HOÀN TẤT GHI CHÉP BIAS EXPECT!</b>\n\n📅 Ngày: <b>${entry.date}</b> | 🪙 Tài sản: <code>${entry.asset}</code>\n\nNhận định của bạn đã được cập nhật thành công lên Web App. Chúc bạn có một ngày giao dịch thuận lợi và gặt hái nhiều lợi nhuận! 🚀💰`
        );
        await answerCallbackQuery(callback_query.id, "✅ Nhật ký đã lưu!");
      }

      return new Response("OK");
    }

    // --- 2. HANDLE STANDARD MESSAGES ---
    if (!message) {
      return new Response("OK");
    }

    const chatId = message.chat.id.toString();
    const text = message.text || "";
    const reply = message.reply_to_message;

    // Handle Link Account
    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      if (parts.length > 1) {
        const userId = parts[1];
        const { error } = await supabase
          .from("user_settings")
          .update({ telegram_chat_id: chatId })
          .eq("user_id", userId);

        if (error) {
          console.error("Error updating telegram_chat_id:", error);
          await sendTelegramMessage(chatId, "❌ Rất tiếc, đã có lỗi xảy ra khi liên kết tài khoản. Vui lòng thử lại sau!");
        } else {
          await sendTelegramMessage(
            chatId,
            "✅ <b>Chúc mừng!</b>\n\nTài khoản của bạn đã được liên kết thành công với Chartmate Trading Journal. Bạn sẽ nhận được các thông báo nhắc nhở tại đây.\n\n<b>Các lệnh hỗ trợ:</b>\n• <code>/bias</code> - Ghi chép nhận định thị trường\n• <code>/news_tomorrow</code> - Tra cứu tin tức kinh tế ngày mai\n• <code>/news_week</code> - Tra cứu tin tức kinh tế tuần này"
          );
        }
      } else {
        await sendTelegramMessage(
          chatId,
          "👋 Chào mừng bạn đến với Chartmate Bot!\n\n<b>Các lệnh hỗ trợ:</b>\n• <code>/bias</code> - Ghi chép nhận định thị trường\n• <code>/news_tomorrow</code> - Tra cứu tin tức kinh tế ngày mai\n• <code>/news_week</code> - Tra cứu tin tức kinh tế tuần này\n\n<i>Nhấn nút 'Connect Now' trên website để liên kết tài khoản nếu chưa kết nối.</i>"
        );
      }
      return new Response("OK");
    }

    // Lookup user_id
    const userId = await getUserByChatId(chatId);
    if (!userId) {
      await sendTelegramMessage(chatId, "⚠️ Vui lòng liên kết tài khoản trước khi thực hiện ghi chép! Dùng nút kết nối trên website.");
      return new Response("OK");
    }

    // Handle /news_tomorrow command
    if (text.startsWith("/news_tomorrow")) {
      const userSettings = await getUserUserSettings(userId);
      if (!userSettings) {
        await sendTelegramMessage(chatId, "⚠️ Không tìm thấy cấu hình cài đặt của bạn.");
        return new Response("OK");
      }

      await sendTelegramMessage(chatId, "⏳ <b>Đang tải tin tức ngày mai từ Forex Factory...</b>");

      try {
        const events = await fetchCalendarEvents();
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const tomorrowDateStr = getVNDateString(tomorrow);
        
        const tomorrowEvents = events.filter((e) => {
          const eventDate = new Date(e.date);
          return getVNDateString(eventDate) === tomorrowDateStr;
        });

        const formattedTitle = `TRUY VẤN: TIN TỨC KINH TẾ NGÀY MAI (${getVNDayOfWeekString(tomorrow)}, ${tomorrowDateStr})`;
        const newsMessage = formatNewsMessage(
          tomorrowEvents,
          userSettings.forex_news_currencies || ['USD', 'EUR', 'GBP', 'CHF', 'AUD', 'NZD', 'JPY', 'CAD'],
          userSettings.forex_news_impacts || ["high", "medium"],
          formattedTitle
        );

        await sendTelegramMessage(chatId, newsMessage, undefined, "Markdown");
      } catch (err) {
        console.error("Error fetching news:", err);
        await sendTelegramMessage(chatId, "❌ Đã xảy ra lỗi khi tải tin tức kinh tế. Vui lòng thử lại sau!");
      }
      return new Response("OK");
    }

    // Handle /news_week command
    if (text.startsWith("/news_week")) {
      const userSettings = await getUserUserSettings(userId);
      if (!userSettings) {
        await sendTelegramMessage(chatId, "⚠️ Không tìm thấy cấu hình cài đặt của bạn.");
        return new Response("OK");
      }

      await sendTelegramMessage(chatId, "⏳ <b>Đang tải tin tức tuần này từ Forex Factory...</b>");

      try {
        const events = await fetchCalendarEvents();
        const now = new Date();
        const startOfWeek = new Date();
        const endOfWeek = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
        const startOfWeekStr = getVNDateString(startOfWeek);
        const endOfWeekStr = getVNDateString(endOfWeek);

        const weeklyEvents = events.filter((e) => {
          const eventDate = new Date(e.date);
          const dateStr = getVNDateString(eventDate);
          return dateStr >= startOfWeekStr && dateStr <= endOfWeekStr;
        });

        const formattedTitle = `TRUY VẤN: TIN TỨC KINH TẾ TUẦN NÀY (Từ ${startOfWeekStr} đến ${endOfWeekStr})`;
        const newsMessage = formatNewsMessage(
          weeklyEvents,
          userSettings.forex_news_currencies || ['USD', 'EUR', 'GBP', 'CHF', 'AUD', 'NZD', 'JPY', 'CAD'],
          userSettings.forex_news_impacts || ["high", "medium"],
          formattedTitle
        );

        await sendTelegramMessage(chatId, newsMessage, undefined, "Markdown");
      } catch (err) {
        console.error("Error fetching news:", err);
        await sendTelegramMessage(chatId, "❌ Đã xảy ra lỗi khi tải tin tức kinh tế. Vui lòng thử lại sau!");
      }
      return new Response("OK");
    }

    // Handle /bias command -> Show asset options
    if (text.startsWith("/bias")) {
      const symbols = await getUserSymbols(userId);
      if (symbols.length === 0) {
        await sendTelegramMessage(chatId, "⚠️ Bạn chưa cấu hình tài sản giao dịch (Symbols) nào trên website. Vui lòng thêm Symbol trước!");
        return new Response("OK");
      }

      const keyboard = symbols.map((symbol) => [
        { text: symbol, callback_data: `select_asset:${symbol}` },
      ]);

      await sendTelegramMessage(
        chatId,
        "🪙 <b>Chọn tài sản bạn muốn lên Bias hôm nay:</b>",
        { inline_keyboard: keyboard }
      );
      return new Response("OK");
    }

    // Handle Force Replies (Chart links or Notes uploads)
    if (reply && reply.text) {
      const replyText = reply.text;
      
      const matchChart = replyText.match(/\[(.*?) - (.*?) Chart\] Nhập link hoặc gửi ảnh cho ID \[(.*?)\]:/);
      const matchNotes = replyText.match(/\[(.*?) - Notes\] Nhập notes cho ID \[(.*?)\]:/);

      if (matchChart) {
        const fieldLabel = matchChart[2]; // e.g. "Monthly", "Weekly", "Daily", "H4 ASIA"
        const entryId = matchChart[3];

        let imageUrl = null;
        if (message.photo && message.photo.length > 0) {
          // Downlad & Upload direct photo from Telegram
          const fileId = message.photo[message.photo.length - 1].file_id;
          imageUrl = await uploadTelegramPhoto(userId, fileId);
        } else if (text && text.startsWith("http")) {
          // Resolve TV snapshot
          imageUrl = resolveTradingViewUrl(text) || text;
        }

        if (imageUrl) {
          const updateData: any = {};
          if (fieldLabel === "Monthly") updateData.monthly_img = imageUrl;
          else if (fieldLabel === "Weekly") updateData.weekly_img = imageUrl;
          else if (fieldLabel === "Daily") updateData.daily_img = imageUrl;
          else if (fieldLabel.startsWith("H4 ")) {
            const sessionName = fieldLabel.split(" ")[1];
            const { data: entry } = await supabase
              .from("journal_entries")
              .select("h4")
              .eq("id", entryId)
              .single();

            const h4 = entry?.h4 || {};
            h4[sessionName] = { ...h4[sessionName], img: imageUrl };
            updateData.h4 = h4;
          }

          await supabase.from("journal_entries").update(updateData).eq("id", entryId);
          await sendTelegramMessage(chatId, "✅ Đã lưu ảnh biểu đồ thành công!");
        } else {
          await sendTelegramMessage(chatId, "❌ Link ảnh hoặc file ảnh không hợp lệ. Vui lòng thử lại!");
        }

        // Return to main menu
        const { data: updated } = await supabase
          .from("journal_entries")
          .select("*")
          .eq("id", entryId)
          .single();

        await sendTelegramMessage(
          chatId,
          formatDashboardText(updated),
          getMainMenuReplyMarkup(entryId, updated.asset, updated.date)
        );
      } 
      else if (matchNotes) {
        const entryId = matchNotes[2];
        await supabase.from("journal_entries").update({ notes: text }).eq("id", entryId);
        await sendTelegramMessage(chatId, "✅ Đã ghi nhận Notes thành công!");

        const { data: updated } = await supabase
          .from("journal_entries")
          .select("*")
          .eq("id", entryId)
          .single();

        await sendTelegramMessage(
          chatId,
          formatDashboardText(updated),
          getMainMenuReplyMarkup(entryId, updated.asset, updated.date)
        );
      }
    }

    return new Response("OK");
  } catch (err) {
    console.error("Error processing telegram update:", err);
    return new Response("Error", { status: 500 });
  }
});

// --- FOREX NEWS HELPERS ---
let cachedCalendar: any[] | null = null;
let lastFetchedTime = 0;

async function fetchCalendarEvents(): Promise<any[]> {
  const nowMs = Date.now();
  if (cachedCalendar && (nowMs - lastFetchedTime < 10 * 60 * 1000)) {
    return cachedCalendar;
  }
  
  try {
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

function formatNewsMessage(
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
    const eventCurrency = e.country?.toUpperCase() || "";
    
    let emoji = "⚪";
    if (e.impact.toLowerCase() === "high") emoji = "🔴";
    else if (e.impact.toLowerCase() === "medium") emoji = "🟠";
    else if (e.impact.toLowerCase() === "low") emoji = "🟡";

    message += `${emoji} *${timeStr} (${eventCurrency})* - ${e.title}\n`;
  }
  
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `*Mức độ ảnh hưởng:* 🔴 Cao | 🟠 Trung bình | 🟡 Thấp (dầu thô) | ⚪ Khác\n`;
  message += `_Lọc theo: ${currencies.join(", ")}_`;

  return message;
}

async function getUserUserSettings(userId: string) {
  const { data, error } = await supabase
    .from("user_settings")
    .select("forex_news_currencies, forex_news_impacts")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

// --- 3. HELPER DATABASE FUNCTIONS ---
async function getUserByChatId(chatId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("user_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (error || !data) return null;
  return data.user_id;
}

async function getUserSymbols(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("symbols")
    .select("name, is_forex")
    .eq("user_id", userId);

  if (error || !data) return [];
  return data.filter((s: any) => !s.is_forex).map((s: any) => s.name);
}

async function getOrCreateJournalEntry(userId: string, asset: string, dateStr: string) {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("date", dateStr)
    .eq("asset", asset)
    .maybeSingle();

  if (data) return data;

  const newEntry = {
    user_id: userId,
    date: dateStr,
    asset: asset,
    weekly_bias: "consolidation",
    weekly_correct: false,
    daily_bias: "consolidation",
    daily_correct: false,
    monthly_bias: "consolidation",
    monthly_correct: false,
    h4: {},
    notes: "",
  };

  const { data: inserted, error: insertError } = await supabase
    .from("journal_entries")
    .insert(newEntry)
    .select()
    .single();

  if (insertError) throw insertError;
  return inserted;
}

// --- 4. FORMATTERS & TELEGRAM API CALLS ---
function getSessionsForAsset(asset: string): string[] {
  if (SPLIT_NY_ASSETS.includes(asset)) {
    return ["ASIA", "LDN", "NY AM", "NY PM"];
  }
  return ["ASIA", "LDN", "NY"];
}

function formatDashboardText(entry: any) {
  const dateStr = entry.date;
  const asset = entry.asset;

  const mBias = formatBiasIcon(entry.monthly_bias) + " " + formatBiasLabel(entry.monthly_bias);
  const mImg = entry.monthly_img ? "✅ Có Chart" : "❌ Chưa có";

  const wBias = formatBiasIcon(entry.weekly_bias) + " " + formatBiasLabel(entry.weekly_bias);
  const wImg = entry.weekly_img ? "✅ Có Chart" : "❌ Chưa có";

  const dBias = formatBiasIcon(entry.daily_bias) + " " + formatBiasLabel(entry.daily_bias);
  const dImg = entry.daily_img ? "✅ Có Chart" : "❌ Chưa có";

  const h4 = entry.h4 || {};
  const sessions = getSessionsForAsset(asset);
  const formatSession = (sName: string) => {
    const s = h4[sName] || {};
    const bias = s.bias ? `${formatBiasIcon(s.bias)} ${formatBiasLabel(s.bias)}` : "❌ Chưa chọn";
    const img = s.img ? "✅ Chart" : "❌ Chart";
    return `${sName}: ${bias} | ${img}`;
  };

  const h4Text = sessions.map((s) => `• ${formatSession(s)}`).join("\n");
  
  // Escape HTML characters for Notes
  const safeNotes = entry.notes
    ? entry.notes.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    : "❌ Trống";
  const notesText = entry.notes ? `<i>${safeNotes}</i>` : "❌ Trống";

  return `📝 <b>NHẬN ĐỊNH GIAO DỊCH (BIAS EXPECT)</b>
📅 <b>Ngày:</b> <code>${dateStr}</code> | 🪙 <b>Tài sản:</b> <code>${asset}</code>

━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 <b>MONTHLY OUTLOOK</b>
• Bias: ${mBias}
• Chart: ${mImg}

📉 <b>WEEKLY OUTLOOK</b>
• Bias: ${wBias}
• Chart: ${wImg}

📊 <b>DAILY DIRECTION</b>
• Bias: ${dBias}
• Chart: ${dImg}

🕒 <b>H4 SESSIONS</b>
${h4Text}

✍️ <b>NOTES & OBSERVATIONS:</b>
${notesText}
━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ <i>Nhấn các nút bên dưới để chọn Bias hoặc cập nhật hình ảnh!</i>`;
}

function formatBiasIcon(bias: string) {
  if (bias === "bullish") return "🟢";
  if (bias === "bearish") return "🔴";
  return "⚪";
}

function formatBiasLabel(bias: string) {
  if (bias === "bullish") return "BULL";
  if (bias === "bearish") return "BEAR";
  if (bias === "consolidation") return "CONS";
  return "Chưa chọn";
}

function getMainMenuReplyMarkup(entryId: string, asset: string, dateStr: string) {
  const dateParts = dateStr.split("-");
  const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : dateStr;

  const keyboard = [
    [
      { text: `📅 Ngày: ${formattedDate}`, callback_data: "none" },
      { text: `🪙 Tài sản: ${asset}`, callback_data: "change_asset" },
    ],
    [
      { text: "📈 Monthly Bias", callback_data: `menub:m:${entryId}` },
      { text: "📉 Weekly Bias", callback_data: `menub:w:${entryId}` },
      { text: "📊 Daily Bias", callback_data: `menub:d:${entryId}` },
    ],
    [
      { text: "🕒 H4 Session Bias", callback_data: `menuh4:${entryId}` },
      { text: "✍️ Nhập Notes", callback_data: `innotes:${entryId}` },
    ],
    [
      { text: "💾 LƯU NHẬT KÝ", callback_data: `finb:${entryId}` },
    ],
  ];

  return { inline_keyboard: keyboard };
}

function getH4SessionsMenuReplyMarkup(entryId: string, asset: string) {
  const sessions = getSessionsForAsset(asset);
  const buttons = [];
  
  for (let i = 0; i < sessions.length; i += 2) {
    const row = [
      { text: `🕒 H4 ${sessions[i]}`, callback_data: `menub:h4:${sessions[i]}:${entryId}` }
    ];
    if (i + 1 < sessions.length) {
      row.push({ text: `🕒 H4 ${sessions[i+1]}`, callback_data: `menub:h4:${sessions[i+1]}:${entryId}` });
    }
    buttons.push(row);
  }
  
  buttons.push([
    { text: "🔙 Quay lại", callback_data: `backm:${entryId}` }
  ]);
  
  return { inline_keyboard: buttons };
}

function getBiasSubMenuReplyMarkup(fieldCode: string, entryId: string) {
  return {
    inline_keyboard: [
      [
        { text: "🟢 BULLISH (BULL)", callback_data: `setb:${fieldCode}:bull:${entryId}` },
        { text: "🔴 BEARISH (BEAR)", callback_data: `setb:${fieldCode}:bear:${entryId}` },
        { text: "⚪ CONSOLIDATION", callback_data: `setb:${fieldCode}:cons:${entryId}` },
      ],
      [
        { text: "🖼️ Gửi Link / Upload Chart", callback_data: `inch:${fieldCode}:${entryId}` },
      ],
      [
        { text: "🔙 Quay lại", callback_data: `backm:${entryId}` },
      ],
    ],
  };
}

function getH4BiasSubMenuReplyMarkup(sessionName: string, entryId: string) {
  return {
    inline_keyboard: [
      [
        { text: "🟢 ASIA/NY BULL", callback_data: `setb:h4:${sessionName}:bull:${entryId}` },
        { text: "🔴 ASIA/NY BEAR", callback_data: `setb:h4:${sessionName}:bear:${entryId}` },
        { text: "⚪ CONSOLIDATION", callback_data: `setb:h4:${sessionName}:cons:${entryId}` },
      ],
      [
        { text: "🖼️ Gửi Link / Upload Chart", callback_data: `inch:h4:${sessionName}:${entryId}` },
      ],
      [
        { text: "🔙 Quay lại", callback_data: `menuh4:${entryId}` },
      ],
    ],
  };
}

async function sendTelegramMessage(chatId: string, text: string, replyMarkup?: any, parseMode?: string) {
  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  const body: any = {
    chat_id: chatId,
    text: text,
    parse_mode: parseMode || "HTML",
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function editTelegramMessage(chatId: string, messageId: number, text: string, replyMarkup?: any) {
  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`;

  const body: any = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: "HTML",
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function sendTelegramMessageWithForceReply(chatId: string, text: string) {
  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      reply_markup: {
        force_reply: true,
        selective: true,
      },
    }),
  });
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`;

  const body: any = { callback_query_id: callbackQueryId };
  if (text) body.text = text;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function resolveTradingViewUrl(url: string): string | null {
  const match = url.match(/tradingview\.com\/x\/([a-zA-Z0-9]+)\/?/);
  if (!match) return null;
  const id = match[1];
  const prefix = id[0].toLowerCase();
  return `https://s3.tradingview.com/snapshots/${prefix}/${id}.png`;
}

async function uploadTelegramPhoto(userId: string, fileId: string): Promise<string | null> {
  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

  // 1. Get file path from Telegram API
  const fileInfoResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
  if (!fileInfoResponse.ok) return null;
  const fileInfo = await fileInfoResponse.json();
  const filePath = fileInfo.result?.file_path;
  if (!filePath) return null;

  // 2. Fetch the image binary
  const fileResponse = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
  if (!fileResponse.ok) return null;
  const arrayBuffer = await fileResponse.arrayBuffer();

  // 3. Upload directly to Supabase Storage Bucket
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("journal-charts")
    .upload(path, arrayBuffer, {
      contentType: "image/jpeg",
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    console.error("Supabase Storage upload error:", error);
    return null;
  }

  // 4. Return Public HTTP URL
  const { data: { publicUrl } } = supabase.storage
    .from("journal-charts")
    .getPublicUrl(path);

  return publicUrl;
}
