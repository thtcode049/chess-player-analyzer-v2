# ♟️ Chess Player Analyzer V2 (ChessLook)

> **Nền tảng Phân tích Dữ liệu Kỳ thủ, Cây Khai cuộc Bayesian & Trợ lý AI Chiến lược Cờ vua Hiện đại**  
> *Production-Oriented Web Application for Chess Player Scouting, Repertoire Analysis, and AI Strategic Coaching.*

[![Next.js](https://img.shields.io/badge/Next.js-14%20App%20Router-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python)](https://python.org/)
[![Stockfish](https://img.shields.io/badge/Stockfish-Web%20Worker-red?style=flat-square)](https://stockfishchess.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20Auth-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Pytest](https://img.shields.io/badge/Pytest-100%2F100%20Passing-brightgreen?style=flat-square&logo=pytest)](https://docs.pytest.org/)
[![Frontend Tests](https://img.shields.io/badge/Node%20Test-45%2F45%20Passing-brightgreen?style=flat-square)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)]()

---

## 🚀 Giới Thiệu & Điểm Đột Phá Ở Phiên Bản V2

**Chess Player Analyzer V2 (ChessLook)** được tái kiến trúc toàn diện từ nguyên mẫu Streamlit nguyên khối thành hệ thống ứng dụng Web phân tán hiện đại, tối ưu hóa để vận hành **100% Miễn phí vĩnh viễn (Zero-Cost Free Tier)** trên nền tảng Vercel Serverless và Supabase BaaS:

1. **Giao Diện Không Gian Làm Việc Hợp Nhất (Unified Workspace)**:
   - Kiến trúc **Keep-Alive Workspace** duy trì trạng thái phân tích, bàn cờ và luồng hội thoại AI chuyển đổi tức thì (`0ms`) giữa các tab mà không cần tải lại trang.
   - Hỗ trợ 3 chế độ làm việc: **Đơn hồ sơ (`single`)**, **Đa hồ sơ đối đầu (`multi` - phân định vai trò Cầm Trắng ⚪ / Cầm Đen ⚫)** và **Bàn cờ phân tích tự do (`sandbox`)**.
2. **Động Cơ Tính Toán Stockfish Phía Client (Zero Server CPU Load)**:
   - Động cơ Stockfish chạy trực tiếp trong luồng nền **Web Worker** (`/public/stockfish/stockfish.js`) ngay trên trình duyệt người dùng.
   - Giải phóng 100% tài nguyên CPU cho backend, loại bỏ triệt để nguy cơ vượt hạn mức thời gian thực thi (10s timeout) của Serverless.
3. **Cơ Sở Dữ Liệu Tinh Gọn & Xử Lý Bộ Nhớ Đệm (Zero Storage Bloat)**:
   - Cơ sở dữ liệu chuẩn hóa gồm **6 bảng quan hệ** có ràng buộc toàn vẹn, chỉ mục tối ưu và bảo mật đa tầng với **Supabase Row-Level Security (RLS)**.
   - Tệp PGN tải lên được phân tích trực tiếp trên bộ nhớ RAM (`ImportService.parse_pgn_bytes`), không lưu trữ tệp thô vào kho đối tượng (Storage Bucket), tiết kiệm tuyệt đối hạn mức lưu trữ.
4. **Bảo Toàn Toàn Bộ Thuật Toán Cờ Vua Cốt Lõi (`src/`)**:
   - Cây khai cuộc EPD phân nhánh an toàn hoán vị (Transposition-Safe) kết hợp bộ lọc làm mượt thống kê Bayes thực nghiệm (**Empirical Bayesian Shrinkage** với $K=6.0$).
   - Nhận diện 5 cấu trúc Tốt chiến lược kinh điển: **Isolani (Tốt cô lập)**, **Carlsbad (Tấn công thiểu số)**, **Hedgehog (Nhím biển)**, **Hanging Pawns (Tốt treo)** và **French (Cấu trúc Pháp)**.
   - Cây tiền tố 3.865 biến thể ECO chuẩn Lichess (`data/lichess_openings.json`) tra cứu tức thì dưới 1ms.
5. **Trợ Lý AI Chiến Lược Đa Phiên (AI Coach)**:
   - Kết hợp mô hình **Google Gemini** (Gemini Flash qua Google AI Studio) và hệ thống dự phòng luật chuyên gia cục bộ (**Local Heuristic Expert**) hoạt động ổn định kể cả khi không có kết nối internet hoặc API key.
   - Lưu trữ lịch sử hội thoại nhiều phiên làm việc (`ai_chat_sessions`) trực tiếp trên Supabase.
6. **Chế Độ Khách Không Cần Đăng Nhập (Guest Mode)**:
   - Cho phép người dùng trải nghiệm tức thì toàn bộ tính năng phân tích mà không bắt buộc tạo tài khoản. Dữ liệu khách tự động dọn dẹp sau 24 giờ qua Vercel Cron.

---

## 🏛 Kiến Trúc Hệ Thống (4-Tier Cloud-Native Architecture)

```
[Browser Client - Next.js 14 App Router]
  ├── Giao diện người dùng: TailwindCSS + Lucide Icons + React-Chessboard
  ├── Không gian làm việc hợp nhất: Zustand / ProfileWorkspaceStore (Single / Multi / Sandbox)
  └── Động cơ phân tích: Stockfish Web Worker (/stockfish/stockfish.js, Client CPU)
           │
           │ REST API & Server-Sent Events (SSE)
           ▼
[Vercel Serverless Functions - Python 3.11+]
  └── FastAPI Application (/api/*)
        ├── api.routes (imports, players, games, analyses, ai, cron)
        ├── src.opening_tree (EPD Tree, Bayesian Shrinkage K=6.0)
        ├── src.analysis (Pawn Structures, Game Dynamics, ACPL Calculation)
        ├── src.pgn_parser (Trie 3.865 ECO Variants, In-Memory PGN Parsing)
        ├── src.engine (Embedded Eval Regex Extractor <10ms)
        └── src.ai_assistant (Gemini Flash + Local Heuristic Fallback)
           │
           │ HTTPS / PostgreSQL Connection Pooling / JWT Auth
           ▼
[Supabase BaaS Infrastructure]
  ├── PostgreSQL Database (6 Bảng quan hệ chuẩn hóa với RLS):
  │     ├── profiles          (Thông tin người dùng)
  │     ├── players           (Danh sách kỳ thủ được phân tích)
  │     ├── datasets          (Nguồn nạp: Lichess, Chess.com, PGN Upload)
  │     ├── games             (Kho lưu trữ ván đấu & nước đi SAN)
  │     ├── analysis_runs     (Dữ liệu thống kê Repertoire & cấu trúc Tốt)
  │     └── ai_chat_sessions  (Lịch sử trò chuyện với AI Coach)
  └── Supabase Auth (Quản lý phiên làm việc JWT & Guest Tenancy)
```

---

## 📂 Cấu Trúc Thư Mục Dự Án (Project Structure)

```
chess-player-analyzer-v2/
├── api/                             # Backend FastAPI Serverless
│   ├── index.py                     # Entrypoint FastAPI chính (gắn tại /api/*)
│   ├── requirements.txt             # Phụ thuộc Python cho môi trường Vercel
│   ├── routes/                      # Route handlers (ai, analyses, games, imports, players)
│   ├── schemas/                     # Pydantic v2 data models
│   └── services/                    # Business services (ai, analysis, db, import, lichess)
├── app/                             # Frontend Next.js 14 (App Router)
│   ├── (auth)/                      # Trang đăng nhập, đăng ký, xác thực Lichess OAuth
│   ├── ai-coach/                    # Trung tâm Trợ lý AI chiến lược
│   ├── analyze/                     # Bàn cờ phân tích ván đấu tương tác & Stockfish
│   ├── dashboard/                   # Bảng điều khiển người dùng
│   ├── import/                      # Trung tâm nạp dữ liệu PGN / Lichess / Chess.com
│   ├── players/                     # Thư viện hồ sơ kỳ thủ & chi tiết Workspace
│   ├── settings/                    # Cài đặt người dùng
│   ├── layout.tsx                   # Layout dùng chung & theme provider
│   └── page.tsx                     # Landing Page chính thức
├── components/                      # Thư viện React Components dùng chung
│   ├── ai/                          # Chat UI trợ lý AI
│   ├── analysis/                    # Bảng cây khai cuộc & Lichess Masters Explorer
│   ├── chess/                       # Bàn cờ, hiển thị nước đi, thanh đánh giá Stockfish
│   ├── profile/                     # Lưới cấu trúc Tốt, hồ sơ phong cách kỳ thủ
│   └── workspace/                   # Container quản lý trạng thái Workspace hợp nhất
├── data/                            # Dữ liệu phục vụ hệ thống & kiểm thử
│   ├── lichess_openings.json        # 3.865 biến thể ECO tra cứu khai cuộc
│   └── sample.pgn                   # Dữ liệu ván đấu mẫu phục vụ bộ kiểm thử tự động
├── lib/                             # Thư viện tiện ích Client & Core Types
│   ├── api/                         # HTTP Client kết nối backend API
│   ├── auth/                        # Lichess PKCE OAuth helper
│   ├── chess/                       # MoveTree, MatchupTreeBuilder, ký hiệu cờ
│   ├── stockfish/                   # Web Worker controller & PV formatter
│   ├── stores/                      # Zustand workspace state store
│   └── supabase/                    # Supabase browser client
├── public/                          # Tài nguyên tĩnh phía máy khách
│   ├── favicon.ico                  # Favicon website
│   ├── logo.png                     # Logo chính thức ChessLook
│   └── stockfish/stockfish.js       # Tệp thực thi động cơ Stockfish Client
├── src/                             # Lõi thuật toán cờ vua độc lập (Python)
│   ├── ai_assistant/                # Gemini client, context builder & local expert
│   ├── analysis/                    # Bayesian confidence, pawn structure, dynamics
│   ├── engine/                      # Stockfish engine config & evaluator
│   ├── opening_tree.py              # EPD tree builder
│   ├── pgn_parser.py                # Bộ phân tích PGN & ECO trie matcher
│   ├── player_profile.py            # Tổng hợp hồ sơ phong cách & cấu trúc Tốt
│   └── statistics.py                # Thống kê hiệu suất & điểm số
├── supabase/                        # Hạ tầng Cơ sở dữ liệu Supabase
│   ├── migrations/                  # Các bản cập nhật schema SQL tuần tự
│   │   ├── 20260916000001_initial_schema.sql
│   │   ├── 20261026000002_cleanup_unused_schema.sql
│   │   └── 20261027000001_create_ai_chat_sessions.sql
│   └── seed.sql                     # Dữ liệu hạt giống khởi tạo cho môi trường dev
├── test/                            # Bộ kiểm thử Frontend
│   └── moveTree.test.js             # Kiểm thử đơn vị cây nước đi & biến thể (45/45 tests)
├── tests/                           # Bộ kiểm thử Backend Pytest
│   ├── api/test_routes.py           # Kiểm thử tích hợp toàn bộ API routes
│   └── test_*.py                    # 12 bộ kiểm thử thuật toán cờ vua (100/100 tests)
├── vercel.json                      # Cấu hình định tuyến Serverless & Cron trên Vercel
├── pytest.ini                       # Cấu hình môi trường pytest
├── requirements.txt                 # Toàn bộ dependencies Python cho backend
└── package.json                     # Toàn bộ dependencies Node.js cho frontend
```

---

## 🛠 Hướng Dẫn Cài Đặt & Chạy Cục Bộ (Local Development)

### 1. Yêu cầu Hệ thống
- **Python**: Phiên bản 3.11 trở lên.
- **Node.js**: Phiên bản 18+ hoặc 20+.
- **Tài khoản Supabase** (miễn phí) để kết nối cơ sở dữ liệu.

### 2. Thiết lập Môi trường Backend (Python API)
```bash
# 1. Kích hoạt môi trường ảo Python
# Trên Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# Trên Linux/macOS:
source .venv/bin/activate

# 2. Cài đặt các thư viện cần thiết
pip install -r requirements.txt

# 3. Khởi chạy toàn bộ 100 bài kiểm thử backend
pytest
```

### 3. Thiết lập Môi trường Frontend (Next.js)
```bash
# 1. Cài đặt các gói npm
npm install

# 2. Chạy bộ kiểm thử tự động Frontend (45/45 tests)
npm test

# 3. Khởi chạy máy chủ phát triển
npm run dev
```
Mở trình duyệt tại: `http://localhost:3000`.

---

## 📦 Hướng Dẫn Triển Khai Lên Vercel & Supabase (100% Miễn Phí)

### Bước 1: Khởi tạo Cơ sở Dữ liệu Supabase
1. Đăng ký/đăng nhập tài khoản tại [supabase.com](https://supabase.com) và tạo một **Project** mới.
2. Mở mục **SQL Editor** trong thanh menu bên trái, chạy tuần tự các tệp migration:
   - `supabase/migrations/20260916000001_initial_schema.sql`
   - `supabase/migrations/20261026000002_cleanup_unused_schema.sql`
   - `supabase/migrations/20261027000001_create_ai_chat_sessions.sql`
   *(Tùy chọn: chạy thêm `supabase/seed.sql` nếu muốn nạp kỳ thủ mẫu để trải nghiệm)*.
3. Mở **Project Settings** > **API**:
   - Sao chép **Project URL**.
   - Sao chép **Project API Key (anon / public)**.
   - Sao chép **Project API Key (service_role / secret)**.

### Bước 2: Triển khai Ứng dụng lên Vercel
1. Đăng nhập [vercel.com](https://vercel.com) và chọn **Add New...** > **Project**.
2. Kết nối tới kho lưu trữ GitHub của bạn.
3. Thiết lập Framework: `Next.js`, Root Directory: `./`.
4. Mở mục **Environment Variables** và cấu hình các biến môi trường sau:

| Tên Biến Môi Trường | Giá Trị Ví Dụ | Giải Thích |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xyzcompany.supabase.co` | Đường dẫn API Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Khóa công khai của Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | Khóa bí mật backend Supabase |
| `GEMINI_API_KEY` | `AIzaSy...` | Khóa Google AI Studio (tùy chọn, có Local Expert dự phòng) |
| `NEXT_PUBLIC_LICHESS_CLIENT_ID` | `chess-player-analyzer-v2` | Định danh OAuth PKCE Lichess |

5. Nhấn **Deploy**. Vercel sẽ tự động build ứng dụng Next.js và đóng gói backend Python FastAPI serverless tại `/api/*`.

### Bước 3: Kiểm tra Sau Triển khai
1. Truy cập đường dẫn: `https://<ten-du-an>.vercel.app/api/health`. Phản hồi trả về:
   ```json
   {
     "status": "healthy",
     "app": "Chess Player Analyzer V2",
     "version": "2.0.0"
   }
   ```
2. Mở trang `/import` để tải thử một tệp PGN hoặc kéo ván đấu từ Lichess/Chess.com.
3. Mở trang `/analyze` để xác nhận Stockfish Web Worker khởi tạo thành công trên trình duyệt.

---

## 🧪 Kết Quả Đánh Giá & Kiểm Thử Hệ Thống (Verification Suite)

- **Backend Pytest Suite**: **100/100 tests passed (100%)**
  - Đánh giá độ chính xác thuật toán Bayesian Shrinkage, phân loại cấu trúc Tốt, băm chuyển vị thế cờ, tích hợp API Lichess/Chess.com và toàn bộ endpoints REST API.
- **Frontend Move Tree Suite**: **45/45 tests passed (100%)**
  - Đánh giá khả năng phân nhánh biến thể nhiều tầng, hoán đổi biến thể chính - phụ (Promote line), xuất chuẩn PGN và chuyển đổi ply nước cờ.
- **Next.js Production Build**: **16/16 routes compiled successfully** (0 lỗi TypeScript, 0 lỗi linting).

---

## 📄 Bản Quyền & Giấy Phép (License)

Dự án được phân phối chính thức dưới giấy phép mã nguồn mở **MIT License**.
