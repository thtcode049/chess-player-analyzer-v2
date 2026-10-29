# ♟️ Chess Player Analyzer V2

> **Production-Oriented Web Application for Chess Player Scouting, Repertoire Analysis, and AI Strategic Coaching**  
> *Hệ thống Phân tích Hồ sơ Kỳ thủ, Cây Khai cuộc Bayesian & Trợ lí AI Đại kiện tướng*

[![Next.js](https://img.shields.io/badge/Next.js-14%20App%20Router-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python)](https://python.org/)
[![Stockfish WASM](https://img.shields.io/badge/Stockfish-WASM%20Web%20Worker-red?style=flat-square)](https://stockfishchess.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20Auth-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Tests-94%2F94%20Passing-brightgreen?style=flat-square&logo=pytest)](https://docs.pytest.org/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)]()

---

## 🚀 Điểm Đột Phá Ở Phiên Bản V2 (What's New in V2)

**Chess Player Analyzer V2** được tái kiến trúc toàn diện từ phiên bản Streamlit nguyên khối (monolith) thành hệ thống web hiện đại, phân tán, tối ưu hóa để vận hành **100% Miễn phí vĩnh viễn (Free Tier)** trên Vercel và Supabase:

1. **Frontend Đỉnh Cao (Next.js 14 App Router + TailwindCSS)**:
   - Giao diện Dark Mode cao cấp với hiệu ứng kính mờ (Glassmorphism), biểu đồ SVG mượt mà và chuyển trang tức thì.
   - Thư viện Kỳ thủ (`/players`), Bảng điều khiển (`/dashboard`), Phòng Phân tích Thế cờ tương tác (`/analyze`), và Trung tâm Trợ lí AI (`/ai-coach`).
2. **Stockfish WASM trong Trình Duyệt (Zero Server Load)**:
   - Phân tích tương tác trực tiếp từng thế cờ chạy bằng Web Worker WebAssembly ngay trên máy người dùng.
   - Không gây quá tải hay timeout 10s cho serverless runtime.
3. **Bảo toàn 100% Thuật toán Cờ Vua Cốt Lõi (`src/`)**:
   - Cây khai cuộc EPD và hiệu chuẩn Bayesian Shrinkage ($K=6.0$).
   - Nhận diện cấu trúc Tốt kinh điển (Isolani, Carlsbad, Hedgehog, Tốt treo, Cấu trúc Pháp).
   - Đánh giá sai số Centipawn Loss (ACPL) từng giai đoạn (Khai cuộc, Trung cuộc, Cờ tàn).
4. **Cơ Sở Dữ Liệu Quan Hệ Chuẩn Hóa (Supabase PostgreSQL + RLS)**:
   - 8 bảng quan hệ có khóa ngoại, chỉ mục hiệu năng và ràng buộc duy nhất `UNIQUE(run_id, game_id)`.
   - Bảo mật đa người dùng với Supabase Row Level Security (RLS).
   - Quản lý tệp PGN dung lượng lớn qua Supabase Storage (`pgn-vault`), bảo vệ hạn mức 500MB DB.
5. **Trợ Lý AI Phân Tích (Gemini AI + Fallback Chuyên gia Cục bộ)**:
   - Đọc hiểu dữ liệu ván đấu và giải thích ý tưởng nước cờ tự nhiên, trực quan.
   - Tương tác hai chiều trực tiếp với bàn cờ cờ vua.

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
        ├── src.player_profile (Pawn Structures, Bayesian Repertoire)
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

# 3. Chạy kiểm thử tự động (94/94 tests)
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

Hệ thống được thiết kế tối ưu hóa để vận hành 100% trên các gói miễn phí vĩnh viễn (Free Tier) của Vercel và Supabase:

### 1. Thiết lập Supabase (Database & Storage)
1. Đăng nhập [supabase.com](https://supabase.com) và tạo một **Project** mới.
2. Mở tab **SQL Editor**, chạy tuần tự các tệp migration trong thư mục `supabase/migrations/`:
   - `20260916000001_initial_schema.sql`
   - `20261026000002_cleanup_unused_schema.sql`
   - `20261027000001_create_ai_chat_sessions.sql`
   *(Tùy chọn: chạy `supabase/seed.sql` nếu muốn nạp dữ liệu mẫu ban đầu)*.
3. Mở mục **Storage** > **New Bucket**: tạo bucket tên `pgn-vault`.
4. Mở **Project Settings** > **API**: sao chép **Project URL**, **Anon Key** (public), và **Service Role Key** (secret).

### 2. Triển khai Vercel (Frontend & Serverless Python API)
1. Import kho mã nguồn này vào [vercel.com](https://vercel.com).
2. Tại mục **Environment Variables**, khai báo các biến môi trường sau:
   - `NEXT_PUBLIC_SUPABASE_URL`: URL dự án Supabase.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anon key của Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role secret key của Supabase.
   - `GEMINI_API_KEY`: API key Google Gemini (tùy chọn, hệ thống tự kích hoạt Local Expert nếu bỏ trống).
3. Nhấn **Deploy**. Vercel sẽ tự động:
   - Biên dịch ứng dụng Next.js 14 App Router.
   - Đóng gói backend FastAPI (`api/index.py` & `src/`) thành Python Serverless Functions tại `/api/*`.

### 3. Kiểm tra Hoạt Động Sau Khi Triển Khai
- Endpoint kiểm tra sức khỏe backend: `https://<your-project>.vercel.app/api/health`
- Trang phân tích ván đấu (Stockfish WASM Client): `https://<your-project>.vercel.app/analyze`
- Bộ kiểm thử tự động: chạy `pytest` cho backend và `npm test` cho frontend.

---

## 📄 Bản Quyền (License)
Dự án được phân phối dưới giấy phép MIT License.
