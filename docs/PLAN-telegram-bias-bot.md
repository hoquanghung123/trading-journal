# PLAN: Telegram Bias Expect Bot Integration (Refined & Simplified)

## Overview
Sau khi khảo sát chi tiết Codebase, chúng tôi phát hiện ra dự án **đã có sẵn hạ tầng cốt lõi cực kỳ xịn xò**:
1. **Database Schema:** Cột `telegram_chat_id` đã có sẵn trong bảng `user_settings`.
2. **Account Linking:** Đã được cài đặt qua Supabase Edge Function `telegram-bot` nhận lệnh `/start <user_id>`.
3. **Daily Reminders:** Đã có sẵn Supabase Edge Function `send-reminders` gửi nhắc nhở.
4. **TradingView Link Resolution:** Web app đã có sẵn hàm helper `resolveTradingViewUrl` giúp tự động chuyển đổi link share của TradingView thành ảnh CDN trực tiếp (`https://s3.tradingview.com/snapshots/...`). Cột `weekly_img` / `daily_img` là kiểu `TEXT` nên có thể chứa thẳng URL ảnh CDN này để trình duyệt render trực tiếp (không cần qua R2 từ phía Telegram Bot).

Do đó, kế hoạch triển khai sẽ được **rút gọn tối đa**, tập trung 100% vào việc bổ sung lệnh `/bias` và giao diện **Interactive Dashboard (Option B)** trực tiếp bên trong Supabase Edge Function [telegram-bot/index.ts](file:///Users/bsleducduy/trading-journal/supabase/functions/telegram-bot/index.ts).

---

## Success Criteria
1. **Asset Selection:** Gõ `/bias`, bot tự truy vấn bảng `symbols` của người dùng đó để hiển thị các nút bấm chọn tài sản tương ứng (GC1!, NQ1!, BTCUSD, v.v.).
2. **Dynamic Dashboard:** Bấm vào tài sản sẽ khởi tạo/lấy bản ghi `journal_entries` của ngày hôm nay và hiển thị menu Dashboard dạng text đơn cập nhật trạng thái liên tục.
3. **Seamless Updates:** Các hành động click chọn Bias (Monthly/Weekly/Daily/H4 Sessions) sẽ cập nhật trực tiếp vào database Supabase và render lại tin nhắn Telegram ngay lập tức.
4. **Force Reply Input:** Khi click chọn gửi Link Chart hoặc viết Notes, Bot dùng tính năng `force_reply` của Telegram để người dùng nhập text/link nhanh, tự động xử lý và lưu vào DB.

---

## Tech Stack
- **Runtime:** Supabase Edge Functions (Deno Deploy).
- **Database:** Supabase PostgreSQL (`user_settings`, `symbols`, `journal_entries`).
- **Telegram Interface:** Deno Serve + direct HTTP calls to Telegram API (sendMessage, editMessageText, editMessageReplyMarkup) sử dụng `fetch`.

---

## Proposed Changes

We will only modify one core file:
- #### [MODIFY] [index.ts](file:///Users/bsleducduy/trading-journal/supabase/functions/telegram-bot/index.ts)

---

## Task Breakdown

### Phase 1: Interactive Flow & State Machine on Telegram Bot
- [ ] **Task 1: Cấu hình lệnh `/bias` và tra cứu User**
  - **Agent:** `backend-specialist`
  - **Logic:** Khi nhận `/bias`, bot tra cứu bảng `user_settings` để tìm `user_id` dựa trên `telegram_chat_id = chatId`.
  - **Verify:** Nhắn `/bias` trên Telegram, bot nhận diện đúng tài khoản và gửi lời chào kèm danh sách Assets (đọc từ bảng `symbols`).

- [ ] **Task 2: Thiết lập Giao diện Dashboard (Main Menu)**
  - **Agent:** `backend-specialist`
  - **Logic:** Khi chọn Asset (VD: `GC1!`), bot tìm kiếm dòng tương ứng trong `journal_entries` của ngày hôm nay (UTC/Local date). Nếu chưa có, bot tự tạo mới (tương tự như hàm `newEntry` trên web). Sau đó hiển thị nội dung Dashboard và các nút bấm Inline Keyboards chính.
  - **Verify:** Chọn tài sản, bot thay thế tin nhắn bằng giao diện Dashboard trực quan.

- [ ] **Task 3: Xử lý nút bấm cập nhật Bias**
  - **Agent:** `backend-specialist`
  - **Logic:** Khi click chọn các nút Bias (Weekly, Daily, H4 Session), bot hiển thị menu con (BULL, BEAR, CONS). Khi bấm chọn một Bias, bot cập nhật trực tiếp cột dữ liệu tương ứng trong bảng `journal_entries` của Supabase, sau đó edit tin nhắn chính về màn hình Dashboard cập nhật trạng thái mới.
  - **Verify:** Click bấm chọn Bias, dữ liệu Supabase được cập nhật lập tức và giao diện Dashboard hiển thị trạng thái `✅ Đã chọn`.

- [ ] **Task 4: Xử lý nhập liệu Link Chart & Notes qua Force Reply**
  - **Agent:** `backend-specialist`
  - **Logic:** 
    - Khi bấm `[🖼️ Gửi Link Chart (Weekly)]` hoặc `[✍️ Nhập Notes]`, bot gửi một tin nhắn trống có `force_reply: true` với tiêu đề chuẩn hóa (VD: `[GC1! - Weekly Chart] Nhập link:` hoặc `[GC1! - Notes] Nhập notes:`).
    - Webhook hứng các tin nhắn Reply này bằng cách kiểm tra thuộc tính `reply_to_message`. Tự động bóc tách link TradingView (nếu có) thông qua regex `resolveTradingViewUrl` rồi lưu URL trực tiếp này vào DB.
  - **Verify:** Gửi link TradingView hoặc gõ text notes, bot cập nhật đúng vào Supabase và Dashboard tự refresh trạng thái thành công.

- [ ] **Task 5: Nút bấm [✅ Hoàn Tất]**
  - **Agent:** `backend-specialist`
  - **Logic:** Khi người dùng thấy mọi thứ đã hoàn hảo, bấm nút Hoàn Tất để đóng phiên và thông báo chúc một ngày giao dịch thành công.
  - **Verify:** Click hoàn tất, bot gửi tin chúc mừng và khóa menu.

---

## Phase X: Verification

- [ ] **Supabase Edge Function Deploy & Test:**
  Deploy hàm `telegram-bot` lên Supabase bằng CLI:
  ```bash
  supabase functions deploy telegram-bot
  ```
- [ ] **Manual Workflow Validation:**
  - [ ] Mở Telegram trên điện thoại, gõ `/bias`.
  - [ ] Chọn cặp tiền `GC1!`.
  - [ ] Bấm chọn `Daily Bias` là `BULL`, check Web UI xem cột Daily của hôm nay đã nhảy màu Xanh lá cây chưa.
  - [ ] Copy một link share TradingView, bấm `Gửi Link Chart` cho Daily, reply link đó. Xem ảnh chart có xuất hiện ngay trên Web UI không.
  - [ ] Bấm `Nhập Notes`, gõ một đoạn note ngắn, check Web UI xem ghi chú đã cập nhật chưa.
  - [ ] Bấm `Hoàn Tất`.
