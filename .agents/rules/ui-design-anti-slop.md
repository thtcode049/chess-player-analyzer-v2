# UI Design & Anti-AI-Slop Guidelines

Áp dụng cho mọi tác vụ xây dựng và sửa đổi giao diện người dùng (Frontend - Next.js / TailwindCSS) trong dự án.

## 1. Đơn giản hóa & Tinh giản Bố cục (Layout & Clean Architecture)
- **Tránh bọc hộp thừa thãi (No Over-boxing)**: Không bọc mọi thông tin nhỏ lẻ vào trong các card `border border-border bg-card` lồng nhau. Ưu tiên bố cục mở (open layout), tận dụng khoảng trắng (whitespace) và phân cấp chữ (typography hierarchy) để phân định các vùng nội dung.
- **Tập trung vào dữ liệu & chức năng chính**: Bàn cờ phân tích và bảng số liệu ván đấu là trung tâm. Không chèn các khối banner quảng cáo, hộp giới thiệu hoặc panel lặp lại thông tin không cần thiết.

## 2. Giảm Độ Bo Cong (Restrained Border Radius)
- **Tuyệt đối tránh góc bo quá lớn**: Loại bỏ các lớp `rounded-3xl` (24px) hoặc `rounded-2xl` quá cong gây cảm giác "bong bóng đồ chơi", giao diện di động trẻ con hoặc template mẫu AI.
- **Tiêu chuẩn bo góc chuẩn mực**:
  - Nút bấm (buttons), ô nhập liệu (inputs), pill filter: dùng `rounded-md` (6px) hoặc tối đa `rounded-lg` (8px).
  - Bảng dữ liệu (tables), khung bàn cờ, panel chính: dùng `rounded-lg` (8px) hoặc tối đa `rounded-xl` (12px).
  - Các góc cạnh nên sắc sảo, dứt khoát và hiện đại.

## 3. Loại bỏ Triệt để "AI Slop"
- **Không dùng gradient trang trí vô nghĩa**: Tránh các dải màu chuyển sặc sỡ (gradient text, gradient animated bars, neon glow). Chỉ sử dụng màu đơn sắc (solid) hoặc biến thể HSL chuẩn trong bảng màu hệ thống.
- **Hạn chế bóng đổ rườm rà**: Tránh `shadow-2xl`, `shadow-xl` hoặc viền phát sáng (glow effects) quanh các thẻ. Ưu tiên `shadow-xs` / `shadow-sm` hoặc viền phẳng `border border-border/40`.
- **Không lạm dụng badge & icon thừa**: Không gắn badge màu mè cho mọi dòng chữ. Chỉ dùng nhãn khi thể hiện trạng thái dữ liệu cụ thể (Thắng/Thua/Hòa, Điểm mạnh/Điểm yếu).

## 4. Thẩm mỹ Công cụ Chuyên nghiệp (Desktop-grade Chess Software)
- Giao diện phải mang lại trải nghiệm của một công cụ nghiên cứu cờ vua thực thụ (tương tự Lichess Analysis, ChessBase, Chess.com Desktop):
  - Mật độ thông tin hợp lý (compact, high information density), không bắt người dùng cuộn trang quá nhiều vì các khoảng đệm (padding/margin) khổng lồ.
  - Tương phản màu chữ rõ ràng, dễ đọc trên cả nền sáng (Light) và nền tối (Dark).
