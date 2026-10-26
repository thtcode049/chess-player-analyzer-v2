# TÀI LIỆU TỔNG HỢP BÁO CÁO ĐỒ ÁN / KHÓA LUẬN TỐT NGHIỆP (V2 - CHESSLOOK)
**Tên đề tài**: Xây dựng nền tảng phân tích dữ liệu ván đấu và trợ lý AI chiến lược cờ vua (Chess Player Analyzer - ChessLook V2)
**Sinh viên thực hiện**: Trần Huyền Trang — MSV: `11226516` — Lớp: Khoa học máy tính K64
**Giảng viên hướng dẫn**: ThS. Trần Thị Mỹ Diệp
**Tài liệu báo cáo trực tuyến**: [Báo cáo Khóa luận Tốt nghiệp trên Google Docs](https://docs.google.com/document/d/1MjjAfoFWtiMzYLDFwy6w4J510UKbqlIqenIEF0PrTw4/edit?tab=t.0)

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG (4-TIER CLOUD-NATIVE ARCHITECTURE)

Hệ thống **Chess Player Analyzer V2 (ChessLook)** đã được nâng cấp toàn diện từ nguyên mẫu cục bộ sang kiến trúc ứng dụng Web đám mây phân tán 4 tầng, vận hành 100% trên gói miễn phí (Zero-Cost Free Tier) của Vercel, Supabase và Google Gemini:

1. **Tầng 1 — Tầng Trình diễn & Không gian làm việc Hợp nhất (Next.js 14 App Router + React 18 + TypeScript + TailwindCSS)**:
   - Duy trì trạng thái DOM thông qua kiến trúc **Keep-Alive Workspace** (`components/workspace/WorkspaceContainer.tsx` & `lib/stores/profileWorkspaceStore.tsx`), cho phép chuyển đổi tức thời (`0ms`) giữa 3 phân hệ chính (**Hồ sơ & Ván đấu**, **Bàn cờ Phân tích & Khai cuộc**, **Trợ lý AI**) mà không làm mất trạng thái bàn cờ, luồng tính toán Stockfish hay luồng hội thoại AI.
   - Hỗ trợ 3 chế độ làm việc linh hoạt: **Đơn hồ sơ (`single`)**, **Đa hồ sơ ghép đôi (`multi` - Multi-Profile Matchup gán vai trò cầm quân Trắng ⚪, Đen ⚫ hoặc Cả hai ⚪⚫)** và **Bàn cờ phân tích tự do (`sandbox`)**.
2. **Tầng 2 — Tầng Tính toán Cờ vua phía Trình duyệt (Stockfish 19 WebAssembly + Web Worker Controller)**:
   - Chạy trực tiếp động cơ **Stockfish 19 WASM** (`/public/stockfish/stockfish.wasm`) bên trong luồng nền Web Worker độc lập (`lib/stockfish/engineWorker.ts` và hook `useStockfish.ts`), kết hợp truy vấn **Lichess Cloud Evaluation API** và **Lichess Masters Database** cho các thế cờ khai cuộc.
   - Giải phóng 100% tải CPU cho máy chủ Serverless và loại bỏ hoàn toàn giới hạn timeout phía máy chủ.
3. **Tầng 3 — Tầng Dịch vụ API & Miền Phân tích (FastAPI Python 3.11+ Serverless)**:
   - Gắn kết tại `/api/py/*` (`api/index.py`), kiểm tra kiểu dữ liệu nghiêm ngặt bằng **Pydantic v2** và điều phối các dịch vụ `import_service.py`, `analysis_service.py`, `ai_service.py`, `db_service.py`, `lichess_masters_service.py`.
   - Tích hợp bộ trích xuất nhanh đánh giá nhúng `[%eval ...]` bằng biểu thức chính quy trong thời gian `<10ms` (`src/engine/evaluator.py`).
4. **Tầng 4 — Tầng Lưu trữ Bền vững & Xác thực (Supabase BaaS)**:
   - **Supabase PostgreSQL**: 5 bảng quan hệ chuẩn hóa & JSONB (`profiles`, `players`, `datasets`, `games`, `analysis_runs`) được bảo vệ bởi chính sách **Row-Level Security (RLS)** và hỗ trợ **Guest Mode** qua bộ nhớ phiên làm việc.
   - **Xử lý tệp trong bộ nhớ (Zero Storage Bloat)**: Tệp `.pgn` nạp vào được giải mã và chuẩn hóa trực tiếp trên RAM qua `ImportService.parse_pgn_bytes`, giải phóng hoàn toàn dung lượng lưu trữ kho đối tượng.

---

## 2. CÁC THUẬT TOÁN & PHƯƠNG PHÁP LUẬN CỐT LÕI TRONG MÃ NGUỒN

### 2.1. Mô hình Co ngót Bayes thực nghiệm (Empirical Bayesian Shrinkage — `src/analysis/confidence.py`)
- Công thức tính điểm số hiệu chỉnh Bayes và độ lệch hiệu suất $\Delta$ so với hiệu suất cơ sở $B$ (`baseline_score_pct`):
  $$\text{Points} = W + 0.5 \times D$$
  $$\text{Prior Points} = K \times \left(\frac{B}{100.0}\right)$$
  $$\text{Adjusted Score (\%)} = \text{round}\left(\frac{\text{Points} + \text{Prior Points}}{N + K} \times 100.0, 1\right)$$
  $$\Delta = \text{round}(\text{Adjusted Score} - B, 1)$$
- Trọng số tiên nghiệm: $K = 6.0$ cho đánh giá độ tin cậy tổng quát và Cấu trúc Tốt; $K = 3.0$ cho danh mục khai cuộc (`analyze_opening_repertoire`).
- 5 cấp bậc phân loại định tính (`MIN_CONFIRMED_SAMPLE = 5`, ngưỡng $|\Delta| \ge 10.0\%$):
  - `CONFIRMED_STRENGTH` ("Sở trường"): $\Delta \ge +10.0\%$ và $N \ge 5$.
  - `POTENTIAL_STRENGTH` ("Tiềm năng"): $\Delta \ge +10.0\%$ và $N < 5$.
  - `CONFIRMED_WEAKNESS` ("Điểm yếu cần khắc phục"): $\Delta \le -10.0\%$ và $N \ge 5$.
  - `POTENTIAL_WEAKNESS` ("Cần chú ý - ít ván"): $\Delta \le -10.0\%$ và $N < 5$.
  - `NEUTRAL` ("Ổn định"): $-10.0\% < \Delta < +10.0\%$.

### 2.2. Băm thế cờ EPD 4 trường, Cây tiền tố 3.865 mã ECO & Nhánh đại diện (`src/pgn_parser.py`, `src/opening_tree.py`)
- **Khóa EPD 4 trường (`extract_clean_fen`)**: Trích xuất 4 thành phần đầu của chuỗi FEN (`board turn castling ep`), gộp chính xác 100% các nhánh chuyển vị thế cờ tới độ sâu `max_ply = 40`.
- **Cây tiền tố 3.865 biến thể ECO (`data/lichess_openings.json`)**: Tra cứu kết hợp trên `_LICHESS_OPENINGS_TRIE` và bảng băm chuyển vị `_LICHESS_OPENINGS_BY_EPD` (tới độ sâu 36 plies), hỗ trợ **Auto Opening Transition** trên bàn cờ phân tích.
- **Thuật toán tìm Nhánh đại diện (`find_representative_line`)**: Tìm thế cờ EPD sâu nhất trong 24 plies đầu thỏa mãn tần suất xuất hiện $\ge \max(2, \lfloor 0.75 \times \text{max\_games\_count} \rfloor)$.
- **Gom cụm tên kỳ thủ mờ (`extractPlayersFromPgn`) & Khử trùng lặp ván đấu (`_compute_game_fingerprint`)**: Chuẩn hóa Unicode NFD kết hợp độ tương đồng Levenshtein $\ge 0.80$; sinh chữ ký `url:` hoặc `sig:` MD5 16 ký tự.

### 2.3. Nhận diện tự động 14 Cấu trúc Tốt trong cửa sổ Nước 8–20 (`src/analysis/pawn_structure.py`)
Quét từ **Ply 14 đến Ply 40 (Nước 8 đến Nước 20)**, ghi nhận nước đi hình thành (`formation_ply`, `formation_fen`), bằng chứng tọa độ và gắn kết **Kế hoạch chủ động (`ideas`)** & **Phương án đối ứng (`counter_ideas`)**:
- **Nhóm A — 6 Cấu trúc Trung tâm & Nền tảng (`group: "A"`)**: `IQP` (Tốt cô lập cột d), `Hanging_Pawns` (Cặp tốt treo c-d), `Open` (Trung tâm mở), `Closed` (Trung tâm đóng), `Semi-Open` (Trung tâm nửa mở), `Symmetrical` (Trung tâm đối xứng gương).
- **Nhóm B — 8 Cấu trúc Chiến lược Kinh điển (`group: "B"`)**: `Carlsbad`, `French_Chain` (Xích Tốt Pháp với điều kiện `not b_c6` tách biệt khỏi Caro-Kann), `Kings_Indian` (Ấn Độ Cổ), `Scheveningen`, `Boleslavsky_Hole` (Najdorf/Sveshnikov), `Maroczy_Bind` (Gọng kìm Maroczy), `Hedgehog` (Cấu trúc Nhím), `Stonewall` (Bức tường đá).

### 2.4. Phân đoạn Bitboard động, CPL/ACPL, Độ chính xác & Động lực tâm lý (`src/analysis/`)
- **Lực lượng phi Tốt (`_non_pawn_material`)**: $\text{Material} = 9Q + 5R + 3B + 3N$.
- **Phân đoạn giai đoạn (`classify_phase`)**: `endgame` ($\text{Material}_W \le 13 \land \text{Material}_B \le 13$, hoặc đổi hết Hậu và tổng lực lượng $\le 22$), `opening` (chưa tàn cuộc, $\text{move} \le 15$ và còn ít nhất 1 quân nhẹ ở hàng xuất phát), `middlegame` (các thế cờ còn lại).
- **Độ chính xác (`Accuracy %`)**: $\text{Accuracy (\%)} = \text{round}(100.0 \times e^{-0.005 \times \text{ACPL}}, 1)$.
- **Động lực tâm lý (`game_dynamics.py`) & Đổi Hậu (`simplification.py`)**: Đo lường `Throw Rate` ($\text{eval} \ge +2.0$), `Defensive Resilience` ($\text{eval} \le -2.0$), `Volatility` ($\sigma(|\Delta\text{eval}|)$) và so sánh hiệu suất `Queens Off` vs `Queens On`.

### 2.5. Trợ lý AI Chiến lược 5 khối ngữ cảnh (`src/ai_assistant/`)
- Lắp ghép tự động 5 khối dữ liệu định lượng vào Prompt (`build_dynamic_prompt`): (1) Bản tóm tắt hồ sơ kỳ thủ `<800 tokens` hoặc hồ sơ ghép đôi Matchup, (2) Trạng thái FEN hiện tại & khớp nối Cấu trúc Tốt trực tiếp trên bàn cờ (`match_board_structure_to_profile`), (3) Đánh giá trực tiếp từ Stockfish 19 WASM (`score_cp`, `mate`, `depth`, `pv`), (4) Thống kê Đại kiện tướng Lichess Masters 2400+, và (5) Câu hỏi của người dùng.
- Hỗ trợ truyền phát thời gian thực qua **Server-Sent Events (SSE)** với **Google Gemini Flash API** (`gemini-3.1-flash-lite`, `gemini-3.8-flash`, `gemini-3.5-flash`) và chuyển đổi dự phòng tự động sang **LocalExpertEngine** khi ngoại tuyến.
