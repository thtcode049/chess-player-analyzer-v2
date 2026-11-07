# ♟️ Chess Player Analyzer (ChessLook)

> **Nền tảng Phân tích Dữ liệu Kỳ thủ, Cây Khai cuộc, Cấu trúc Tốt Bayesian & Trợ lý AI Chiến lược Cờ vua Hiện đại**  
> *Production-Oriented Web Application for Chess Player Scouting, Repertoire Analysis, and AI Strategic Coaching.*

[![Next.js](https://img.shields.io/badge/Next.js-14%20App%20Router-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python)](https://python.org/)
[![Stockfish](https://img.shields.io/badge/Stockfish-Web%20Worker-red?style=flat-square)](https://stockfishchess.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20Auth-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Pytest](https://img.shields.io/badge/Pytest-95%2F95%20Passing-brightgreen?style=flat-square&logo=pytest)](https://docs.pytest.org/)
[![Frontend Tests](https://img.shields.io/badge/Node%20Tests-73%2F73%20Passing-brightgreen?style=flat-square)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)]()

---

## 🚀 Giới Thiệu & Các Điểm Đặc Trưng Cốt Lõi

**Chess Player Analyzer (ChessLook)** là hệ thống ứng dụng Web phân tán hiện đại phục vụ trinh sát đối thủ, phân tích chuyên sâu repertoire khai cuộc và huấn luyện chiến lược cờ vua. Hệ thống được kiến trúc tối ưu để vận hành **100% Miễn phí (Zero-Cost Free Tier)** trên nền tảng Vercel Serverless và Supabase BaaS:

1. **Giao Diện Không Gian Làm Việc Hợp Nhất (Unified Workspace)**:
   - Kiến trúc **Keep-Alive Workspace** thông qua `ProfileWorkspaceProvider` duy trì trạng thái phân tích, bàn cờ, cây biến thể và luồng hội thoại AI chuyển đổi tức thì giữa các chế độ mà không tải lại trang.
   - Hỗ trợ 3 chế độ làm việc: **Đơn hồ sơ (`single`)**, **Đa hồ sơ đối đầu (`multi` - đồng bộ cây đối đầu Cầm Trắng ⚪ / Cầm Đen ⚫ & chatbox đa hồ sơ)** và **Bàn cờ phân tích tự do (`sandbox`)**.
2. **Động Cơ Tính Toán Stockfish Phía Client (Zero Server CPU Load)**:
   - Động cơ Stockfish chạy trực tiếp trong luồng nền **Web Worker** (`/public/stockfish/stockfish.js`) ngay trên trình duyệt người dùng.
   - Giải phóng 100% tài nguyên CPU cho backend, loại bỏ nguy cơ vượt hạn mức thời gian thực thi của Serverless.
3. **Cơ Sở Dữ Liệu Tinh Gọn & Xử Lý Trên Bộ Nhớ (Zero Storage Bloat)**:
   - Cơ sở dữ liệu chuẩn hóa gồm **6 bảng quan hệ** có chỉ mục tối ưu và bảo mật đa tầng với **Supabase Row-Level Security (RLS)**.
   - Tệp PGN tải lên được phân tích trực tiếp trên RAM (`ImportService.parse_pgn_bytes`), không lưu tệp thô vào Storage Bucket.
4. **Hệ Thống Thuật Toán Cờ Vua Cốt Lõi Đồng Bộ (`src/`)**:
   - **Cây khai cuộc EPD (`src/opening_tree.py`)**: Gom nhóm thế cờ an toàn hoán vị (Transposition-Safe EPD Aggregation), lọc theo màu quân và trích xuất dòng biến đại diện.
   - **Đánh giá độ tin cậy Bayesian Shrinkage thống nhất (`src/analysis/confidence.py`)**: Áp dụng mô hình Empirical Bayes với trọng số tiên nghiệm đồng nhất **$K = 6.0$** cho cả **Danh mục Khai cuộc** và **Cấu trúc Tốt**, phân loại 5 cấp độ nhất quán:
     - `CONFIRMED_STRENGTH` / `CONFIRMED_WEAKNESS` (*★ Điểm mạnh / ⚠️ Điểm yếu Xác thực*): $N \ge 5$ ván và $|\Delta| \ge 10.0\%$.
     - `POTENTIAL_STRENGTH` / `POTENTIAL_WEAKNESS` (*▲ Điểm mạnh / ▽ Điểm yếu Tiềm năng*): Chưa đạt mức xác thực nhưng $N \ge 2$ ván và $|\Delta| \ge 6.0\%$.
     - `NEUTRAL` (*● Trung tính*): $|\Delta| < 6.0\%$ hoặc mẫu đơn lẻ $N < 2$.
   - **Nhận diện 28 cấu trúc Tốt trung cuộc chuẩn Grandmaster (`src/analysis/pawn_structure.py`)**: Hệ thống nhận diện cấu trúc Tốt được xây dựng theo chuẩn mực kinh điển ***Chess Structures: A Grandmaster Guide*** của Đại kiện tướng Mauricio Flores Rios. Quét trong cửa sổ trung cuộc định hình từ nước 8 đến hết nước 20 (`ply 15 -> 40`), tích hợp **Bộ lọc độ bền (Persistence Filter $\ge 3$ plies liên tiếp)** nhằm triệt tiêu hoàn toàn nhiễu từ các nước ăn đổi quân tạm thời (transient captures). Phân loại chuẩn mực thành 6 nhóm:
     - **Family One – d4 and ...d5 (Chương 1–7)**: *The Isolani*, *Hanging Pawns*, *Caro-Kann Formation*, *Slav Formation*, *The Carlsbad Formation*, *Stonewall*, *Grünfeld Centre*.
     - **Family Two – Open Sicilian (Chương 8–11)**: *Najdorf Type I*, *Najdorf Type II*, *The Hedgehog*, *The Maroczy*.
     - **Family Three – Benoni (Chương 12–13)**: *Asymmetric Benoni*, *Symmetric Benoni*.
     - **Family Four – King's Indian (Chương 14–18)**: *KID Type I*, *KID Type II*, *KID Type III*, *Open KID*, *KID Complex*.
     - **Family Five – French (Chương 19–21)**: *French Type I*, *French Type II*, *French Type III*.
     - **Miscellaneous – Various Structures (Chương 22)**: *3-3 vs 4-2 Break*, *Panov Formation*, *Dragon Formation*, *Scheveningen Formation*, *Benko Formation*, *Closed Ruy Lopez*, *Lopez Formation*.
     - *Kế hoạch chiến lược (Actionable GM Plans)*: Cung cấp kế hoạch hành động chi tiết cho cả hai bên Cầm Trắng ⚪ và Cầm Đen ⚫ tương ứng với từng cấu trúc (mục tiêu tấn công, đột phá tốt, kiểm soát ô trọng yếu, phương án chuyển hóa tàn cuộc).
   - **Tra cứu khai cuộc chuẩn quốc tế (`src/pgn_parser.py`)**: Cây Trie tiền tố 3.865 biến thể ECO chuẩn Lichess (`data/lichess_openings.json`).
5. **Trợ Lý AI Chiến Lược Chống Ảo Giác (AI Coach)**:
   - Kết hợp chuỗi mô hình **Google Gemini Flash** với bộ định tuyến ý định (`intent_router.py`), trích xuất dữ kiện thế cờ tất định (`position_facts.py`), bộ kiểm chứng nước đi hợp lệ (`verifier.py`) và hệ thống chuyên gia ngoại tuyến (**Local Expert** trong `local_expert.py`) đồng bộ trực tiếp với nhãn Bayesian.
   - Lưu trữ lịch sử hội thoại đa phiên (`ai_chat_sessions`) trực tiếp trên Supabase.
6. **Xác Thực Linh Hoạt & Chế Độ Khách (Auth & Guest Mode)**:
   - Bảo vệ route qua Middleware (tự động điều hướng về trang chủ khi chưa đăng nhập), hỗ trợ đăng nhập/đăng ký Supabase, liên kết OAuth PKCE Lichess và chế độ khách tự động dọn dẹp sau 24 giờ qua Vercel Cron.

---

## 🏛 Kiến Trúc Hệ Thống (Cloud-Native Architecture)

```
[Browser Client - Next.js 14 App Router]
  ├── Giao diện người dùng: TailwindCSS + Lucide Icons + React-Chessboard + chess.js
  ├── Quản lý trạng thái Workspace: React Context Store (ProfileWorkspaceProvider: Single / Multi / Sandbox)
  ├── Cây nước đi & đối đầu: MoveTree + MatchupTreeBuilder + Lichess Masters Explorer
  └── Động cơ phân tích: Stockfish Web Worker (/stockfish/stockfish.js, Client CPU)
           │
           │ REST API & Server-Sent Events (SSE)
           ▼
[Vercel Serverless Functions - Python 3.11+]
  └── FastAPI Application (/api/*)
        ├── api.routes (imports, players, games, analyses, ai) & /api/cron/cleanup-guests
        ├── src.opening_tree (Transposition-Safe EPD Trie & Representative Line Finder)
        ├── src.player_profile & src.strategy (Repertoire Analytics & Match Preparation, K=6.0)
        ├── src.analysis.confidence (Empirical Bayesian Shrinkage K=6.0, 5-Tier Assessment)
        ├── src.analysis.pawn_structure (28 Canonical Pawn Structures - Flores Rios, Ply 15-40, Persistence Filter >= 3 Plies)
        ├── src.pgn_parser & src.game_fetcher (Trie 3.865 ECO Variants, Lichess/Chess.com Fetcher)
        └── src.ai_assistant (Gemini Streaming + Intent Router + Position Verifier + Local Expert)
           │
           │ HTTPS / PostgreSQL REST / JWT Auth
           ▼
[Supabase BaaS Infrastructure]
  ├── PostgreSQL Database (6 Bảng quan hệ chuẩn hóa với RLS):
  │     ├── profiles          (Thông tin người dùng)
  │     ├── players           (Danh sách kỳ thủ được phân tích)
  │     ├── datasets          (Nguồn nạp: Lichess, Chess.com, PGN Upload)
  │     ├── games             (Kho lưu trữ ván đấu & nước đi SAN)
  │     ├── analysis_runs     (Dữ liệu thống kê Repertoire & 28 cấu trúc Tốt chuẩn Flores Rios)
  │     └── ai_chat_sessions  (Lịch sử trò chuyện với AI Coach)
  └── Supabase Auth (Quản lý phiên làm việc JWT & Guest Tenancy)
```

---

## 📂 Cấu Trúc Thư Mục Dự Án (Project Structure)

```
chess-player-analyzer-v2/
├── api/                             # Backend FastAPI Serverless
│   ├── index.py                     # Entrypoint FastAPI chính (/api/*, /api/health, /api/cron/*)
│   ├── requirements.txt             # Phụ thuộc Python cho môi trường Vercel
│   ├── routes/                      # Route handlers (ai, analyses, games, imports, players)
│   ├── schemas/                     # Pydantic v2 data models
│   └── services/                    # Business services (ai, analysis, db, import, lichess_masters)
├── app/                             # Frontend Next.js 14 (App Router)
│   ├── ai-coach/                    # Trung tâm Trợ lý AI chiến lược
│   ├── analyze/                     # Bàn cờ phân tích ván đấu tương tác & Stockfish
│   ├── api/validate-email/          # API kiểm tra hợp lệ email phía frontend
│   ├── auth/                        # Callback xác thực Supabase & Lichess OAuth
│   ├── dashboard/                   # Bảng điều khiển người dùng
│   ├── import/                      # Trung tâm nạp dữ liệu PGN / Lichess / Chess.com
│   ├── login/                       # Trang đăng nhập
│   ├── players/                     # Thư viện hồ sơ kỳ thủ & chi tiết Workspace
│   ├── register/                    # Trang đăng ký tài khoản
│   ├── layout.tsx                   # Layout gốc & providers
│   └── page.tsx                     # Landing Page chính thức
├── components/                      # Thư viện React Components dùng chung
│   ├── ai/                          # Chat UI & Floating AI Widget đa hồ sơ
│   ├── analysis/                    # Bảng cây khai cuộc, Matchup Tree & Lichess Masters
│   ├── chess/                       # Bàn cờ tương tác, cây nước đi, thanh đánh giá Stockfish
│   ├── profile/                     # Lưới 28 cấu trúc Tốt chuẩn Flores Rios & thống kê hồ sơ kỳ thủ
│   └── workspace/                   # Container quản lý không gian làm việc hợp nhất
├── data/                            # Dữ liệu phục vụ hệ thống & kiểm thử
│   ├── lichess_openings.json        # 3.865 biến thể ECO tra cứu khai cuộc
│   └── sample.pgn                   # Dữ liệu ván đấu mẫu phục vụ bộ kiểm thử tự động
├── lib/                             # Thư viện tiện ích Client & Core Types
│   ├── api/                         # HTTP Client & TypeScript interfaces kết nối backend
│   ├── auth/                        # Lichess PKCE OAuth & điều hướng xác thực
│   ├── chess/                       # MoveTree, MatchupTreeBuilder, chuẩn hóa ký hiệu cờ
│   ├── stockfish/                   # Web Worker controller & PV formatter
│   ├── stores/                      # ProfileWorkspaceProvider state store (React Context)
│   └── supabase/                    # Supabase SSR & browser client
├── public/                          # Tài nguyên tĩnh phía máy khách
│   ├── favicon.ico                  # Favicon website
│   ├── logo.png                     # Logo chính thức ChessLook
│   └── stockfish/stockfish.js       # Tệp thực thi động cơ Stockfish Client
├── src/                             # Lõi thuật toán cờ vua độc lập (Python)
│   ├── ai_assistant/                # Gemini client, context, briefing, intent router, verifier & local expert
│   ├── analysis/                    # Bayesian confidence (K=6.0) & 28 pawn structures (Flores Rios)
│   ├── game_fetcher.py              # Đồng bộ ván đấu từ Lichess & Chess.com API
│   ├── lichess_oauth.py             # Tiện ích xác thực OAuth2 PKCE Lichess
│   ├── opening_tree.py              # EPD tree builder & representative line finder
│   ├── pgn_parser.py                # Bộ phân tích PGN & ECO trie matcher
│   ├── player_profile.py            # Tổng hợp Repertoire khai cuộc & hồ sơ kỳ thủ
│   ├── statistics.py                # Thống kê hiệu suất & điểm số theo màu quân
│   ├── strategy.py                  # Đề xuất chuẩn bị trận đấu & khai thác điểm yếu
│   └── utils.py                     # Chuẩn hóa FEN/EPD & tiện ích xử lý kết quả ván cờ
├── supabase/                        # Hạ tầng Cơ sở dữ liệu Supabase
│   ├── migrations/                  # Các bản cập nhật schema SQL tuần tự
│   │   ├── 20260916000001_initial_schema.sql
│   │   ├── 20261026000002_cleanup_unused_schema.sql
│   │   └── 20261027000001_create_ai_chat_sessions.sql
│   └── seed.sql                     # Dữ liệu hạt giống khởi tạo cho môi trường dev
├── test/                            # Bộ kiểm thử Frontend (Node.js)
│   ├── moveTree.test.js             # Kiểm thử cây nước đi & biến thể (45/45 tests)
│   └── middlewareRedirect.test.js   # Kiểm thử bảo vệ route & Guest Mode (28/28 tests)
├── tests/                           # Bộ kiểm thử Backend Pytest (88/88 tests)
│   ├── api/test_routes.py           # Kiểm thử tích hợp toàn bộ API routes
│   └── test_*.py                    # 13 tệp kiểm thử đơn vị thuật toán cờ vua & AI
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

# 3. Chạy bộ kiểm thử backend (95/95 tests)
pytest

# 4. Khởi chạy máy chủ FastAPI cục bộ tại cổng 8000
npm run api
```

### 3. Thiết lập Môi trường Frontend (Next.js)
```bash
# 1. Cài đặt các gói npm
npm install

# 2. Chạy các bộ kiểm thử Frontend
npm test
node test/middlewareRedirect.test.js

# 3. Khởi chạy máy chủ phát triển Next.js
npm run dev
```
Mở trình duyệt tại: `http://localhost:3000`.

---

## 📦 Hướng Dẫn Triển Khai Lên Vercel & Supabase (100% Miễn Phí)

### Bước 1: Khởi tạo Cơ sở Dữ liệu Supabase
1. Đăng ký/đăng nhập tài khoản tại [supabase.com](https://supabase.com) và tạo một **Project** mới.
2. Mở mục **SQL Editor**, chạy tuần tự các tệp migration:
   - `supabase/migrations/20260916000001_initial_schema.sql`
   - `supabase/migrations/20261026000002_cleanup_unused_schema.sql`
   - `supabase/migrations/20261027000001_create_ai_chat_sessions.sql`
   *(Tùy chọn: chạy thêm `supabase/seed.sql` nếu muốn nạp kỳ thủ mẫu để trải nghiệm)*.
3. Mở **Project Settings** > **API** để lấy **Project URL**, **anon key** và **service_role key**.

### Bước 2: Triển khai Ứng dụng lên Vercel
1. Đăng nhập [vercel.com](https://vercel.com), chọn **Add New...** > **Project** và kết nối kho lưu trữ GitHub.
2. Thiết lập Framework: `Next.js`, Root Directory: `./`.
3. Cấu hình các biến môi trường trong mục **Environment Variables**:

| Tên Biến Môi Trường | Giá Trị Ví Dụ | Giải Thích |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xyzcompany.supabase.co` | Đường dẫn API Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Khóa công khai của Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | Khóa bí mật backend Supabase |
| `GEMINI_API_KEY` | `AIzaSy...` | Khóa Google AI Studio (tùy chọn, có Local Expert dự phòng) |
| `NEXT_PUBLIC_LICHESS_CLIENT_ID` | `chess-player-analyzer-v2` | Định danh OAuth PKCE Lichess |
| `CRON_SECRET` | `my-cron-secret` | Khóa bảo vệ endpoint dọn dẹp dữ liệu khách (tùy chọn) |

4. Nhấn **Deploy**. Vercel sẽ tự động build ứng dụng Next.js và đóng gói backend Python FastAPI serverless tại `/api/*`.

### Bước 3: Kiểm tra Sau Triển khai
1. Truy cập `https://<ten-du-an>.vercel.app/api/health`. Phản hồi trả về:
   ```json
   {
     "status": "healthy",
     "app": "ChessLook",
     "version": "2.0.0"
   }
   ```
2. Mở trang `/import` để tải thử một tệp PGN hoặc đồng bộ ván đấu từ Lichess/Chess.com.
3. Mở trang `/analyze` để xác nhận Stockfish Web Worker khởi tạo thành công trên trình duyệt.

---

## 🧪 Kết Quả Đánh Giá & Kiểm Thử Hệ Thống (Verification Suite)

- **Backend Pytest Suite**: **95/95 tests passed (100%)**
  - Kiểm chứng mô hình Bayesian Shrinkage ($K = 6.0$, ngưỡng 5 cấp độ $\pm 6\%$ / $\pm 10\%$), nhận diện 28 cấu trúc Tốt chuẩn Flores Rios (5 Families + 1 Miscellaneous) & bộ lọc độ bền $\ge 3$ plies, gom nhóm hoán vị EPD, bộ kiểm chứng nước đi AI, tích hợp Lichess/Chess.com và các REST API endpoints.
  - Kiểm thử thực tế trên 53 ván cờ mẫu của các Đại kiện tướng quốc tế (GM Games) trích xuất trực tiếp từ sách Flores Rios đạt tỷ lệ nhận diện chính xác 100% (53/53 ván đấu).
- **Frontend Node Test Suites**: **73/73 tests passed (100%)**
  - `test/moveTree.test.js` (**45/45**): Phân nhánh biến thể nhiều tầng, hoán đổi biến chính - phụ (Promote line), xuất PGN và đồng bộ ply nước cờ.
  - `test/middlewareRedirect.test.js` (**28/28**): Kiểm thử bảo vệ route đăng nhập và chế độ khách (Guest Mode).

---

## 📄 Bản Quyền & Giấy Phép (License)

Dự án được phân phối chính thức dưới giấy phép mã nguồn mở **MIT License**.
