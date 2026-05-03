import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

Deno.serve(async (req) => {
  try {
    const { message } = await req.json();

    if (!message || !message.text) {
      return new Response("OK");
    }

    const chatId = message.chat.id.toString();
    const text = message.text;

    // Handle /start command with user_id parameter
    // Example: /start 12345678-1234-1234-1234-123456789012
    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      if (parts.length > 1) {
        const userId = parts[1];

        // Update the user's settings with their Telegram Chat ID
        const { error } = await supabase
          .from("user_settings")
          .update({ telegram_chat_id: chatId })
          .eq("user_id", userId);

        if (error) {
          console.error("Error updating telegram_chat_id:", error);
          await sendTelegramMessage(chatId, "❌ Rất tiếc, đã có lỗi xảy ra khi liên kết tài khoản. Vui lòng thử lại sau!");
        } else {
          await sendTelegramMessage(chatId, "✅ *Chúc mừng!*\n\nTài khoản của bạn đã được liên kết thành công với Chartmate Trading Journal. Bạn sẽ nhận được các thông báo nhắc nhở tại đây.");
        }
      } else {
        await sendTelegramMessage(chatId, "👋 Chào mừng bạn đến với Chartmate Bot! Vui lòng nhấn nút 'Connect Now' trên website để liên kết tài khoản.");
      }
    }

    return new Response("OK");
  } catch (err) {
    console.error("Error processing telegram update:", err);
    return new Response("Error", { status: 500 });
  }
});

async function sendTelegramMessage(chatId: string, text: string) {
  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown",
    }),
  });
}
