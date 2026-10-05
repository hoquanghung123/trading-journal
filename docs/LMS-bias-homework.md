# Tích hợp homework Bias sáng

Hợp đồng API và hướng dẫn vận hành nằm trong project LMS tại `docs/trading-bias-homework.md`.

Các binding chỉ dùng phía máy chủ:

```dotenv
LMS_BIAS_ENABLED=true
LMS_BIAS_URL=https://<domain-lms>
LMS_BIAS_SECRET=<secret chung ít nhất 32 ký tự>
TRADING_JOURNAL_URL=https://trading.hibacsi.com
```

Mặc định tắt. Không đặt secret dưới tên `VITE_`, không inject vào `window.ENV`, không commit giá trị secret. Wrapper Cloudflare chỉ đưa các binding vào phía server. Giữ Supabase Auth và R2 như hiện tại; không có migration Supabase mới.

Học viên bấm **Kết nối Trading Journal** trên LMS → Bài tập Bias sáng. Journal mở trang Bias Expect, yêu cầu đăng nhập nếu cần rồi hiển thị tài khoản để bấm **Xác nhận kết nối LMS**. Kết nối thành công sẽ tự chuyển về trang **Bài tập Bias sáng** trên LMS; địa chỉ quay về lấy từ cấu hình LMS ở server Journal. Không cần nhập mã. Token dùng một lần được nhận qua URL fragment, xóa khỏi thanh địa chỉ và giữ trong sessionStorage của tab tối đa 10 phút; kết nối thành công hoặc hủy sẽ xóa token. Lưu bias trước, chọn các tài sản rồi nộp cả buổi. Journal gửi bản chụp đã lưu sang LMS, nhận trạng thái và link xem phản hồi. Cần được admin LMS giao bài có coach trước khi nộp.

Ngày bài nộp tuân theo 17:00 New York của Journal. Chart được sao chép độc lập; payload retry được giữ trong prefix R2 riêng `bias-delivery/`, không phục vụ công khai. Không đổi hoặc xóa các prefix lưu bài nộp khi dọn chart gốc.

Kiểm tra local:

```sh
node_modules/.bin/tsx --test tests/bias-homework.test.ts
npx tsc --noEmit
npm run build
```

Không cần thay đổi bot `/bias`: nút hoàn tất từng tài sản giữ chức năng hiện tại. Nộp cả buổi dùng web hoặc Mini App. Không tự nộp mỗi lần autosave; mỗi lần gửi hoặc nộp bản cập nhật đều do học viên chủ động bấm.

## Nộp bài khi chạy local

Đặt `LMS_BIAS_LOCAL_ARCHIVE_URL=http://127.0.0.1:5173` trong `.env.local`; Vite dev dùng kho `.local-bias-store/` giữ nguyên bản chụp qua các lần thử lại và restart. Nguồn chart gốc vẫn dùng `TRADING_JOURNAL_URL` (mặc định Journal production). LMS cần `APP_ENV=local`, `TRADING_BIAS_LOCAL_ARCHIVE_URL` trùng địa chỉ kho và worker queue bài tập. Kho chỉ bật cho Vite dev; build production dùng binding R2.
