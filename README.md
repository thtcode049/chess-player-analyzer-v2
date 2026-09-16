# ♟️ Chess Player Analyzer V2

> **Production-Oriented Web Application for Chess Player Scouting, Repertoire Analysis, and AI Strategic Coaching**  
> *Hệ thống Phân tích Hồ sơ Kỳ thủ, Cây Khai cuộc Bayesian & Trợ lí AI Đại kiện tướng*

[![Next.js](https://img.shields.io/badge/Next.js-14%20App%20Router-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python)](https://python.org/)
[![Stockfish WASM](https://img.shields.io/badge/Stockfish-WASM%20Web%20Worker-red?style=flat-square)](https://stockfishchess.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20Auth-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Tests-100%2F100%20Passing-brightgreen?style=flat-square&logo=pytest)](https://docs.pytest.org/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)]()

---

## 🚀 Điểm Đột Phá Ở Phiên Bản V2 (What's New in V2)

**Chess Player Analyzer V2** được tái kiến trúc toàn diện từ phiên bản Streamlit nguyên khối (monolith) thành hệ thống web hiện đại, phân tán, tối ưu hóa để vận hành **100% Miễn phí vĩnh viễn (Free Tier)** trên Vercel và Supabase:

1. **Frontend Đỉnh Cao (Next.js 14 App Router + TailwindCSS)**:
   - Giao diện Dark Mode cao cấp với hiệu ứng kính mờ (Glassmorphism), biểu đồ SVG mượt mà và chuyển trang tức thì.
   - Thư viện Kỳ thủ (`/players`), Bảng điều khiển (`/dashboard`), Phòng Phân tích Thế cờ tương tác (`/analyze`), và Trung tâm Huấn luyện AI (`/ai-coach`).
2. **Stockfish WASM trong Trình Duyệt (Zero Server Load)**:
   - Phân tích tương tác trực tiếp từng thế cờ chạy bằng Web Worker WebAssembly ngay trên máy người dùng.
   - Không gây quá tải hay timeout 10s cho serverless runtime.
3. **Bảo toàn 100% Thuật toán Cờ Vua Cốt Lõi (`src/`)**:
   - Cây khai cuộc EPD và hiệu chuẩn Bayesian Shrinkage ($K=6.0$).
   - Nhận diện cấu trúc Tốt (Isolani, Carlsbad, Hedgehog, v.v.).
   - Phân tích chân dung phong cách 8 trục (Style Radar Polygon).
   - Đánh giá sai số Centipawn Loss (ACPL) từng giai đoạn (Khai cuộc, Trung cuộc, Cờ tàn).
4. **Cơ Sở Dữ Liệu Quan Hệ Chuẩn Hóa (Supabase PostgreSQL + RLS)**:
   - 8 bảng quan hệ có khóa ngoại, chỉ mục hiệu năng và ràng buộc duy nhất `UNIQUE(run_id, game_id)`.
   - Bảo mật đa người dùng với Supabase Row Level Security (RLS).
   - Quản lý tệp PGN dung lượng lớn qua Supabase Storage (`pgn-vault`), bảo vệ hạn mức 500MB DB.
5. **Trợ Lý AI Đại Kiện Tướng (Gemini AI + Fallback Chuyên gia Cục bộ)**:
   - Tham mưu chiến lược chủ động 2 chiều (*Tự đánh giá bản thân* hoặc *Chuẩn bị đối đầu đối thủ*).
   - Truyền phát câu trả lời thời gian thực qua Server-Sent Events (SSE).

---

## 🏛 Kiến Trúc Hệ Thống (Architecture)

```
[Browser Client]
  ├── Next.js 14 (UI, Dashboard, Visualizations)
  └── Stockfish WASM Web Worker (Interactive Evaluation, Zero Server CPU)
           │
           │ HTTP API / SSE
           ▼
[Vercel Serverless]
  └── FastAPI Python Runtime (/api/*)
        ├── src.opening_tree (EPD Tree, Bayesian K=6.0)
        ├── src.player_profile (Pawn Structures, 8-Axis Radar)
        ├── src.accuracy (ACPL by Phase)
        └── src.ai_assistant (Gemini Flash + Local Heuristic Fallback)
           │
           │ SQL / JWT / S3 API
           ▼
[Supabase Infrastructure]
  ├── PostgreSQL Database (8 Tables with RLS)
  ├── Supabase Auth (JWT tenancy)
  └── Supabase Storage Bucket ('pgn-vault')
```

---

## 🛠 Hướng Dẫn Cài Đặt & Chạy Cục Bộ (Local Quickstart)

### 1. Yêu cầu Tiên quyết
- Python 3.11+
- Node.js 18+ hoặc 20+

### 2. Cài đặt Môi trường Python (Backend API)
```bash
# 1. Kích hoạt virtualenv
.\.venv\Scripts\Activate.ps1

# 2. Cài đặt phụ thuộc
pip install -r requirements.txt

# 3. Chạy kiểm thử tự động (100/100 tests)
pytest
```

### 3. Cài đặt Môi trường Frontend (Next.js)
```bash
# Cài đặt node modules
npm install

# Kiểm tra kiểu dữ liệu TypeScript
npm run typecheck

# Khởi chạy máy chủ phát triển
npm run dev
```
Truy cập ứng dụng tại: `http://localhost:3000`.

---

## 📦 Triển Khai Lên Vercel & Supabase (Free Tier)

Chi tiết từng bước cấu hình tài khoản miễn phí, chạy migration schema và khai báo biến môi trường xem tại:  
👉 [**Tài Liệu Triển Khai Vercel & Supabase (docs/DEPLOYMENT.md)**](docs/DEPLOYMENT.md)

---

## 📚 Bộ Tài Liệu Kỹ Thuật Dự Án (Documentation Suite)

- [**MIGRATION_AUDIT.md**](docs/MIGRATION_AUDIT.md): Phân tích phân rã mã nguồn cũ và đánh giá phụ thuộc.
- [**ARCHITECTURE.md**](docs/ARCHITECTURE.md): Đặc tả kiến trúc phân tầng 4 lớp và luồng dữ liệu.
- [**DATABASE.md**](docs/DATABASE.md): Chi tiết 8 bảng CSDL, quan hệ ERD, chỉ mục và chính sách RLS.
- [**API.md**](docs/API.md): Tài liệu đặc tả toàn bộ REST API endpoints và SSE streaming.
- [**MIGRATION_FINAL_REPORT.md**](docs/MIGRATION_FINAL_REPORT.md): Báo cáo nghiệm thu hoàn tất di chuyển dự án.

---

## 📄 Bản Quyền (License)
Dự án được phân phối dưới giấy phép MIT License.
