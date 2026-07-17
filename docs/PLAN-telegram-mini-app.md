# PLAN: Telegram Mini App Integration

Dự án này tích hợp Telegram Mini App (TMA) trực tiếp vào route `/tg` của ứng dụng Trading Journal hiện tại, đảm bảo giao diện Graphite Teal đẹp mắt, hoạt động mượt mà cả trong và ngoài Telegram.

---

## 📋 THÔNG TIN CHUNG (Overview)
- **Project Type**: WEB (React + Vite + TanStack Router & Query + Supabase)
- **Target Route**: `/tg` (Isolated styling & logic)
- **OS Target**: macOS / Linux (Phát triển cục bộ)

---

## 🎯 TIÊU CHÍ THÀNH CÔNG (Success Criteria)
1. **Style Isolation**: Route `/tg` tải độc lập stylesheet `src/tg-mini-app.css` (được tối ưu hóa cho mobile/TMA), không bị ảnh hưởng bởi styles.css toàn cục. Impersonation Banner của Web chính phải được ẩn hoàn toàn trên route này.
2. **Silent Mock Auth (Dev Only)**:
   - Trên môi trường phát triển (localhost/dev), nếu không chạy trong Telegram (không có initData), ứng dụng tự động đăng nhập ngầm cho user ID `a14a793c-cf04-4e80-9717-d7f077b6f5a3`.
   - Cơ chế này chạy ngầm hoàn toàn, không hiển thị spinner, loading screen, banner hay thông báo gây gián đoạn UX.
3. **Logic New York Cutoff (GMT-4/EST/EDT)**:
   - Sử dụng offset cố định tuyệt đối: Giờ New York chậm hơn giờ Việt Nam (GMT+7) **11 tiếng**.
   - Thời điểm Cutoff 00:00:00 America/New_York tương đương **11:00 AM giờ Việt Nam**.
   - Countdown đếm ngược sẽ tính thời gian còn lại đến mốc 11:00 AM VN gần nhất. Ngày lưu bias sẽ lùi 1 ngày nếu thời gian hiện tại trước 11:00 AM VN.
4. **TradingView URL Preview**:
   - Khi người dùng dán (paste) đường dẫn chia sẻ biểu đồ của TradingView dạng: `https://www.tradingview.com/x/abcdefgh/`
   - Frontend tự động trích xuất mã biểu đồ (`abcdefgh`) và chuyển đổi thành URL ảnh trực tiếp: `https://s3.tradingview.com/x/abcdefgh.png`.
   - Hiển thị preview trực tiếp trên màn hình nhập liệu trước khi lưu.
5. **Interactive UI**:
   - Cho phép chọn/cập nhật bias (Bullish, Bearish, Consolidation) cho Weekly, Daily, H4 (ASIA, LDN, NY AM, NY PM tùy asset).
   - Tích hợp lưu trữ trực tiếp vào Supabase database (`journal_entries`).

---

## 🛠️ CÔNG NGHỆ SỬ DỤNG (Tech Stack)
- **Frontend Framework**: React + Vite (sẵn có)
- **Routing**: TanStack Router (`src/routes/tg.tsx`)
- **State Management & Data Fetching**: TanStack Query
- **Styling**: Vanilla CSS (`src/tg-mini-app.css` - được cô lập ở root route)
- **Database / Backend**: Supabase Client SDK (để đọc/ghi `journal_entries` và map `telegram_users`)

---

## 📁 CẤU TRÚC THƯ MỤC CẦN SỬA ĐỔI (File Structure)
```
/Users/bsleducduy/trading-journal/
├── docs/
│   └── PLAN-telegram-mini-app.md       # File kế hoạch hiện tại (Kế hoạch hành động)
├── src/
│   ├── routes/
│   │   ├── __root.tsx                  # Thiết lập cô lập CSS & ẩn banner cho /tg
│   │   └── tg.tsx                      # Component & logic chính của Telegram Mini App (Tạo mới)
│   ├── tg-mini-app.css                 # CSS cô lập cho Mini App (Đã có sẵn, cần tinh chỉnh)
│   └── lib/
│       └── journal.ts                  # Logic hỗ trợ (Nếu cần bổ sung hàm tính ngày)
```

---

## 🔧 CHI TIẾT CÁC BƯỚC THỰC HIỆN (Task Breakdown)

### Phase 1: Route & Style Isolation
#### Task 1: Thiết lập cô lập Style trong `src/routes/__root.tsx`
- **Agent**: `frontend-specialist`
- **Skill**: `frontend-design`
- **Priority**: P0
- **Dependencies**: Không
- **Mô tả**:
  - Nhận diện khi route bắt đầu bằng `/tg`.
  - Chỉ render thẻ `<link rel="stylesheet" href={tgCss} />` và loại bỏ global `styles.css`.
  - Ẩn component `<ImpersonationBanner />` toàn cục khi ở route `/tg`.
- **INPUT**: `src/routes/__root.tsx` hiện tại.
- **OUTPUT**: File `src/routes/__root.tsx` đã cập nhật logic switch style động.
- **VERIFY**: Truy cập `http://localhost:3000/tg`, mở Chrome DevTools để kiểm chứng:
  - Chỉ có stylesheet `tg-mini-app.css` được load.
  - Không có banner màu cam Impersonation ở đầu trang.

---

### Phase 2: Silent Auth & Integration
#### Task 2: Implement Cơ chế Silent Mock Authentication (Dev Only)
- **Agent**: `backend-specialist`
- **Skill**: `api-patterns`
- **Priority**: P0
- **Dependencies**: Task 1
- **Mô tả**:
  - Trong component `/tg`, thêm hook kiểm tra môi trường:
    - Nếu `window.location.hostname` là `localhost` hoặc `127.0.0.1`.
    - Và không phát hiện `window.Telegram?.WebApp?.initData`.
    - Thực hiện đăng nhập ngầm sử dụng mock user ID `a14a793c-cf04-4e80-9717-d7f077b6f5a3` qua Supabase auth client hoặc thiết lập session giả lập cục bộ.
  - Quá trình chạy ngầm hoàn toàn, không làm chớp tắt UI (flicker) hay hiển thị modal loading.
- **INPUT**: `src/routes/tg.tsx` (tạo mới) và cấu hình Supabase client.
- **OUTPUT**: Logic đăng nhập ngầm trong component route `/tg`.
- **VERIFY**: F5 trang `/tg` trên Chrome. Quan sát tab Network/Console:
  - Tài khoản đăng nhập thành công.
  - App tải trực tiếp data của user `a14a793c-cf04-4e80-9717-d7f077b6f5a3` mà không yêu cầu tương tác.

#### Task 3: Telegram User Mapping & Auth (Production fallback)
- **Agent**: `backend-specialist`
- **Skill**: `database-design`
- **Priority**: P1
- **Dependencies**: Task 2
- **Mô tả**:
  - Khi chạy trong môi trường Telegram thật, trích xuất `telegram_id` từ `window.Telegram.WebApp.initDataUnsafe.user.id`.
  - Gửi request truy vấn bảng `telegram_users` để tìm `user_id` tương ứng trong hệ thống.
  - Đăng nhập/gán session tương ứng.
- **INPUT**: Bảng `telegram_users` và API Supabase.
- **OUTPUT**: Khớp nối user ID thật giữa Telegram và Supabase.
- **VERIFY**: Kiểm tra bằng mock initData trên trình duyệt hoặc chạy Mini App trực tiếp trong Telegram client.

---

### Phase 3: Business Logic & UI Features
#### Task 4: Xử lý đếm ngược New York Cutoff (Offset 11 tiếng)
- **Agent**: `frontend-specialist`
- **Skill**: `frontend-design`
- **Priority**: P1
- **Dependencies**: Task 1
- **Mô tả**:
  - Viết logic tính toán thời gian: Giờ Cutoff NY = 11:00 AM giờ VN.
  - Tính toán khoảng cách (countdown) từ giờ local hiện tại của user tới mốc 11:00 AM VN tiếp theo.
  - Hiển thị bộ đếm ngược định dạng `HH:MM:SS` ở header Mini App.
  - Xác định "ngày giao dịch hiện tại":
    - Nếu trước 11:00 AM VN -> Ngày giao dịch là `Hôm qua` (YYYY-MM-DD - 1 ngày).
    - Nếu sau 11:00 AM VN -> Ngày giao dịch là `Hôm nay` (YYYY-MM-DD).
- **INPUT**: Utils date/time trong React component.
- **OUTPUT**: Component đếm ngược hoạt động chính xác theo mốc 11:00 AM VN.
- **VERIFY**: 
  - Đổi giờ hệ thống máy tính sang trước 11:00 AM (VD: 9:00 AM VN), kiểm tra xem app có lấy ngày giao dịch là hôm qua không và bộ đếm ngược còn 2 tiếng không.
  - Đổi sang sau 11:00 AM (VD: 2:00 PM VN), xem ngày giao dịch có trùng hôm nay không và countdown còn 21 tiếng không.

#### Task 5: TradingView Link Parsing & Image Preview
- **Agent**: `frontend-specialist`
- **Skill**: `frontend-design`
- **Priority**: P1
- **Dependencies**: Task 1
- **Mô tả**:
  - Trong editor chọn ảnh của bias/H4 session: thêm ô nhập URL link TradingView.
  - Sử dụng Regex nhận diện: `/https?:\/\/(?:www\.)?tradingview\.com\/x\/([a-zA-Z0-9]+)\/?/`
  - Tự động thay đổi giá trị nhập sang link ảnh trực tiếp: `https://s3.tradingview.com/x/$1.png`.
  - Hiển thị preview ảnh tức thì bên dưới ô nhập link.
  - Hỗ trợ dán các link ảnh thường (đuôi `.jpg`, `.png`, `.webp`) để render preview trực tiếp.
- **INPUT**: Input field paste link và component preview ảnh.
- **OUTPUT**: Tính năng tự động chuyển đổi URL & hiển thị preview.
- **VERIFY**: Dán `https://www.tradingview.com/x/ABCDEF/` vào ô nhập, kiểm tra xem ảnh preview có nguồn (src) là `https://s3.tradingview.com/x/ABCDEF.png` hay không.

#### Task 6: Hoàn thiện Layout Màn hình chính Mini App
- **Agent**: `frontend-specialist`
- **Skill**: `frontend-design`
- **Priority**: P2
- **Dependencies**: Task 4, 5
- **Mô tả**:
  - Thiết kế UI hoàn chỉnh theo file stylesheet `src/tg-mini-app.css`.
  - Các màn hình chính (Tabs dưới thanh dock):
    - **Bias Today**: Danh sách cặp tài sản, danh sách checklist bias (Weekly, Daily, H4) dạng lưới, bấm vào để mở Editor chỉnh sửa và nhập link TradingView/lưu.
    - **Streak**: Thống kê số ngày duy trì chuỗi làm chuẩn bị bài tập bias (hiển thị vòng tròn phần trăm, lịch tích xanh, huy hiệu đạt được).
    - **Trade Log**: Danh sách nhật ký lệnh đơn giản.
  - Liên kết sự kiện lưu bias để gửi dữ liệu cập nhật về Supabase thông qua `upsertEntry`.
- **INPUT**: `src/routes/tg.tsx`, `src/tg-mini-app.css`.
- **OUTPUT**: File `src/routes/tg.tsx` hoàn thiện tất cả tính năng UI/UX.
- **VERIFY**: Chạy thử trên local, click đổi bias, nhập link TV, lưu, và kiểm tra data trong DB Supabase được cập nhật đúng.

---

## 🏥 PHASE X: FINAL VERIFICATION (Quy trình kiểm thử)

Sau khi hoàn thành code, các bước kiểm thử sau đây bắt buộc phải chạy và thông qua:

1. **Linting & Type Check**:
   ```bash
   npm run lint && npx tsc --noEmit
   ```
2. **Security & UX Audits (Chạy Python script)**:
   ```bash
   python .agent/skills/vulnerability-scanner/scripts/security_scan.py .
   python .agent/skills/frontend-design/scripts/ux_audit.py .
   ```
3. **Build Testing**:
   ```bash
   npm run build
   ```
4. **Manual Checklists**:
   - [ ] Giao diện Graphite Teal đồng bộ, không bị lẫn CSS của phiên bản web lớn.
   - [ ] Silent auth chạy hoàn toàn ngầm trên localhost, không gây gián đoạn tải trang.
   - [ ] Mốc Cutoff luôn luôn là 11:00 AM VN (lấy ngày đúng trước/sau 11:00 AM).
   - [ ] Paste link TradingView chuyển đổi chuẩn và hiển thị được ảnh preview.
