# Quy định Phiên làm việc (Agent Rules)

## 1. Tự động commit bằng Tiếng Việt
- **Tự động thực hiện**: Sau khi hoàn thành xong một yêu cầu/tính năng/sửa lỗi từ người dùng và toàn bộ kiểm thử hợp lệ (`tsc --noEmit` và `pytest` đạt 100%), Agent **bắt buộc phải tự động stage và commit mã nguồn ngay lập tức** trong phiên làm việc, không cần người dùng phải nhắc.
- **100% Tiếng Việt**: Toàn bộ tiêu đề (subject) và mô tả (body) của commit phải viết bằng tiếng Việt chuẩn ngữ, rõ nghĩa.
- **Quy chuẩn Conventional Commits**:
  - `feat(...)`: Thêm tính năng mới
  - `fix(...)`: Sửa lỗi
  - `refactor(...)`: Tái cấu trúc mã nguồn
  - `style(...)`: Tinh chỉnh giao diện, CSS, dọn dẹp icon
  - `perf(...)`: Tối ưu hiệu năng
  - `test(...)`: Cập nhật bài kiểm tra
  - `chore(...)`: Cấu hình, dọn dẹp phụ thuộc

## 2. Bảo vệ dữ liệu nhạy cảm
- Tuyệt đối không commit tệp `.env`, `.env.local` hoặc các file chứa API keys / bí mật.
