# MT5 Pepperstone → Chartmate (chỉ đọc)

## Quyền và cách hoạt động

EA đọc giao dịch đã khớp, gửi thông tin vào **Chờ duyệt**. Bấm **Xác nhận nhập** trong Chartmate mới tạo/cập nhật Trade Log. Bỏ qua không tác động MT5. EA không đặt/sửa/đóng/hủy lệnh, không dùng DLL, không tải mã từ server. Khóa EA không duyệt được trade.

Giữ **Algo Trading toàn cục bật** cho Position Sizer. Trên một chart KHÁC, EA JournalReadOnly phải **tắt Allow Algo Trading riêng**. Nếu quyền riêng này bật, EA từ chối khởi động hoặc tự dừng. Không thay đổi cài đặt Position Sizer.

## Cài trên macOS

1. Trong Chartmate → Desk → Kết nối MT5, nhập số tài khoản và tên server chính xác trong MT5. Không nhập mật khẩu MT5.
2. Xác minh múi giờ SERVER Pepperstone cho những ngày sẽ nhập. Điền các quy tắc giờ ở dạng JSON, ví dụ định dạng:
   ```json
   [{"from":"2026-01-01T00:00:00","offsetMinutes":120}]
   ```
   Ví dụ này chỉ minh họa UTC+2, KHÔNG phải xác nhận lịch Pepperstone. Nếu server chuyển UTC+3 thì thêm mốc theo giờ broker, offsetMinutes=180. Phải bao phủ cả giờ mở và đóng. Không lấy offset hiện tại áp dụng ngược toàn bộ lịch sử. Thiếu quy tắc, hệ thống báo lỗi và giữ dữ liệu để gửi lại. Đối chiếu với xác nhận của broker; có thể xem giờ server gần hiện tại bằng Market Watch khi thị trường có tick, nhưng cách này không xác minh được lịch sử/DST.
3. Tạo khóa. Sao chép khóa một lần vào nơi an toàn; chỉ dán vào EA của bạn. Có thể thu hồi ở Desk. Tạo kết nối mới để thay khóa.
4. Tải `JournalReadOnly.ex5` (đã biên dịch) hoặc `.mq5`. MT5 → File → Open Data Folder → MQL5 → Experts. Chép file vào đây. Với `.mq5`, mở MetaEditor và Compile (F7).
5. Navigator → Expert Advisors → Refresh. Mở một chart riêng; gắn JournalReadOnly. Trong thuộc tính riêng của EA, **bỏ chọn Allow Algo Trading** và không bật DLL imports.
6. Inputs: `Endpoint` lấy từ Desk; `SyncKey` là khóa vừa tạo.
7. MT5 → Settings/Options → Expert Advisors → Allow WebRequest for listed URL: thêm origin endpoint, ví dụ `https://PROJECT.supabase.co`. Giữ công tắc Algo Trading toàn cục theo nhu cầu Position Sizer.
8. Kiểm tra tab Experts/Journal và trạng thái kết nối trong Desk. Khi mở/đóng trên tài khoản này bằng Mac hoặc iPhone, Chartmate hiện mục Chờ duyệt.

## Dữ liệu và thời gian

- Giá, lots và P&L là CFD Pepperstone; ánh xạ symbol không chuyển đổi thành hợp đồng futures.
- Mặc định: US100→NQ1!, US500→ES1!, US30→YM1!, XAUUSD→GC1!, XAGUSD→SI1!.
- Lưu UTC, hiển thị America/New_York đúng EST/EDT. Lấy thời điểm khớp MT5, không lấy giờ nhận/duyệt. Ngày nhập lịch sử theo New York.
- SL/TP ban đầu từ deal mở, cuối từ deal đóng. Thiếu thì để trống. Không thể khôi phục chính xác một SL được đặt thủ công SAU khi mở thành “SL tại lúc mở”.
- P&L = profit + commission + swap + fee liên quan các deal của vị thế. Khoản tổng hợp broker không gắn position ID không được tự phân bổ.
- R để chưa xác định; không lấy hệ số futures để suy ra risk của CFD. Review thủ công vẫn nhập được R.
- Một vị thế một trade; tổng hợp nhiều lần khớp/chốt, hoàn tất khi đóng hết. Đảo chiều được chia vòng theo deal mở.

## Offline, lịch sử và lỗi

MT5 phải chạy và Mac phải thức để gửi ngay. Khi mở lại, EA đọc lịch sử broker và bù phần chưa nhận. Queue và xác nhận lưu trong MQL5/Files; không lưu khóa trong queue. Không xóa các file JournalReadOnly khi còn dữ liệu chưa gửi. Chỉ chạy MỘT bản EA cho mỗi khóa kết nối.

“Từ lúc kết nối” nhập các vị thế đang mở và vị thế đóng từ thời điểm tạo kết nối. “Khoảng thời gian” bổ sung lịch sử đóng trong khoảng New York đã chọn; mọi dữ liệu vẫn chờ duyệt. Kiểm tra trade nhập tay để tránh trùng. Thay quy tắc múi giờ/nhập lịch sử sẽ yêu cầu EA quét lại.

HTTP 401: khóa sai/thu hồi; account/server mismatch: đang đăng nhập sai tài khoản; WebRequest -1: kiểm tra URL cho phép/kết nối. Thiếu offset: sửa quy tắc tại Desk. Một bản ghi lỗi sẽ được giữ trong queue để tránh âm thầm bỏ dữ liệu.

## Nghiệm thu trước khi dùng tài khoản thật

Trên demo Pepperstone, kiểm tra Position Sizer đặt lệnh được trong khi EA đồng bộ tắt quyền riêng; mở/đóng từ Mac và iPhone; journal không đổi trước khi duyệt; giờ New York đúng; SL/TP/P&L khớp; đóng trước khi duyệt mở không trùng; ngắt mạng và mở lại đồng bộ đủ. Mục tiêu khoảng 15 giây khi online và không có backlog; nhập lịch sử lớn cần lâu hơn.

Biên dịch thành công không thay thế kiểm thử demo. Không có thiết kế phần mềm nào bảo vệ tuyệt đối khi máy Mac, tài khoản hoặc một EA có quyền giao dịch khác bị chiếm quyền.
