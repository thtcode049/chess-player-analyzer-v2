# BÁO CÁO TOÀN DIỆN DỰ ÁN: CHESS PLAYER ANALYZER
> **Nền Tảng Phân Tích Dữ Liệu Ván Đấu & Trợ Lí AI Chiến Lược Cờ Vua**  
> *Tài liệu kiến trúc hệ thống, quy trình hoạt động và đặc tả kỹ thuật chi tiết từng module*

---

## MỤC LỤC
1. [Tổng Quan Dự Án & Bối Cảnh Thực Tiễn](#1-tổng-quan-dự-án--bối-cảnh-thực-tiễn)
2. [Mục Tiêu & Đối Tượng Sử Dụng](#2-mục-tiêu--đối-tượng-sử-dụng)
3. [Kiến Trúc Tổng Thể & Luồng Hoạt Động (System Architecture & Pipeline)](#3-kiến-trúc-tổng-thể--luồng-hoạt-động)
4. [Các Nền Tảng Khoa Học & Thuật Toán Cốt Lõi](#4-các-nền-tảng-khoa-học--thuật-toán-cốt-lõi)
5. [Đặc Tả Chi Tiết Ý Nghĩa & Chức Năng Từng File](#5-đặc-tả-chi-tiết-ý-nghĩa--chức-năng-từng-file)
6. [Hệ Thống Kiểm Thử Tự Động (Automated Testing Suite)](#6-hệ-thống-kiểm-thử-tự-động)
7. [Điểm Sáng Công Nghệ & Giá Trị Đóng Góp Của Đề Tài](#7-điểm-sáng-công-nghệ--giá-trị-đóng-góp-của-đề-tài)
8. [Mẫu Prompt Gợi Ý Khi Đưa Tài Liệu Vào ChatGPT](#8-mẫu-prompt-gợi-ý-khi-đưa-tài-liệu-vào-chatgpt)

---

## 1. TỔNG QUAN DỰ ÁN & BỐI CẢNH THỰC TIỄN

### 1.1. Bối cảnh
Trong kỷ nguyên số hóa của cờ vua hiện đại, các kỳ thủ thi đấu hàng ngàn ván đấu trực tuyến trên các nền tảng như Lichess và Chess.com. Dữ liệu ván đấu được lưu trữ dưới định dạng chuẩn **PGN (Portable Game Notation)**. 

Tuy nhiên, việc khai phá dữ liệu PGN hiện nay đang gặp phải các rào cản lớn:
- **Dữ liệu phân mảnh:** Các phần mềm truyền thống (như ChessBase) có giá thành rất cao, giao diện phức tạp và chủ yếu phục vụ các đại kiện tướng chuyên nghiệp.
- **Hiện tượng thiên lệch mẫu nhỏ (Small Sample Bias):** Một kỳ thủ thắng 1/1 ván ở một biến khai cuộc hiếm thường bị coi là "sở trường 100%", trong khi thực chất chỉ là ngẫu nhiên do kích thước mẫu quá nhỏ.
- **Thiếu tính định hướng hành động (Actionable Insights):** Các công cụ hiện tại chỉ dừng lại ở các con số thống kê khô khan (tỷ lệ thắng, số ván) mà thiếu đi khả năng suy luận chiến lược: *"Tôi cần tập luyện bài tập gì?", "Lỗ hổng khai cuộc nào cần sửa?", "Trước đối thủ này nên ép vào thế cờ nào?"*.

### 1.2. Giải pháp: Chess Player Analyzer
**Chess Player Analyzer** là nền tảng Web ứng dụng phân tích dữ liệu cờ vua toàn diện kết hợp cùng **Trợ lí Trí tuệ Nhân tạo (AI Coach & Tactical Advisor)**. Ứng dụng biến hàng trăm ván cờ PGN thô thành:
1. Cây khai cuộc trực quan với khả năng chống chuyển vị (Transposition-safe Opening Tree).
2. Hồ sơ phong cách kỳ thủ thực nghiệm (Độ biến động thế cờ, Tỉ lệ thí quân, Xu hướng đơn giản hóa, Khả năng chịu ép, Thế trận thường dùng).
3. Đánh giá độ chính xác từng giai đoạn ván đấu theo chuẩn động cơ Stockfish (ACPL).
4. Khắc phục thiên lệch mẫu bằng mô hình toán học **Co ngót Bayes (Empirical Bayesian Shrinkage)**.
5. **Trợ lí AI Chiến lược** đưa ra bản tóm tắt suy luận mở đầu tự động (Proactive Strategic Briefing) và đàm thoại đa chiều theo 2 góc nhìn linh hoạt.

---

## 2. MỤC TIÊU & ĐỐI TƯỢNG SỬ DỤNG

Dự án ban đầu hướng tới việc phân tích đối thủ, nhưng đã được nâng cấp toàn diện thành nền tảng **Phân tích Kỳ thủ (Chess Player Analyzer)** phục vụ 3 nhóm đối tượng mục tiêu:

| Nhóm đối tượng | Mục đích sử dụng | Chế độ AI tương ứng |
|---|---|---|
| **Kỳ thủ tự học (Self-Improvement)** | Tự nạp dữ liệu thi đấu của chính mình để tìm lỗ hổng trong Repertoire khai cuộc, xác định pha cờ thường mắc sai lầm (ví dụ: sụt giảm ACPL ở cờ tàn) để tập trung rèn luyện. | `[👤 Bản thân / Học viên]` |
| **Huấn luyện viên (Coaching / Mentoring)** | Nạp dữ liệu học trò để nắm bắt phong cách thi đấu, điểm mạnh/yếu thực nghiệm, từ đó thiết kế giáo án và bài tập chiến thuật phù hợp. | `[👤 Bản thân / Học viên]` |
| **Chuẩn bị thi đấu giải (Opponent Scouting)** | Do thám đối thủ sắp gặp: phát hiện các biến khai cuộc đối phương yếu nhất để chủ động ép thế trận vào đó, nhận diện thói quen đổi quân và tâm lý thi đấu. | `[🎯 Đối thủ sắp gặp]` |

---

## 3. KIẾN TRÚC TỔNG THỂ & LUỒNG HOẠT ĐỘNG

Hệ thống được thiết kế theo kiến trúc phân tầng (Layered Architecture) module hóa cao:

```
[NGUỒN DỮ LIỆU]
  ├── Tệp PGN cục bộ (Upload)
  ├── Lichess API (Đồng bộ trực tiếp hoặc qua OAuth 2.0 PKCE)
  └── Chess.com API (Đồng bộ theo tháng / năm)
         │
         ▼
[TẦNG TIỀN XỬ LÝ & CHUẨN HÓA]
  ├── src/pgn_parser.py (Parse cú pháp PGN, nhận diện kỳ thủ, gán nhãn ECO)
  └── src/game_fetcher.py (Xử lý HTTP requests, Rate limiting, chuẩn hóa dữ liệu mạng)
         │
         ▼
[TẦNG TÍNH TOÁN & ĐỘNG CƠ CỜ VUA]
  ├── src/opening_tree.py (Cây biến khai cuộc phân nhánh, EPD 4-part key)
  ├── src/statistics.py (Thống kê cơ bản: Win/Draw/Loss, Điểm số, Màu quân)
  ├── src/analysis/confidence.py (Mô hình Bayes Shrinkage, Performance Delta)
  ├── src/analysis/pawn_structure.py (Phân loại cấu trúc Tốt kinh điển)
  ├── src/analysis/phase_analysis.py (Phân tích 3 giai đoạn: Opening/Middle/Endgame)
  ├── src/analysis/style_metrics.py & style_classifier.py (Radar 8 trục phong cách)
  ├── src/engine/stockfish_engine.py (Tiến trình Stockfish UCI đa luồng)
  └── src/engine/evaluator.py (Đánh giá ACPL, Blunder, Mistake, Inaccuracy)
         │
         ▼
[TẦNG TỔNG HỢP HỒ SƠ & CHIẾN LƯỢC]
  ├── src/player_profile.py (Tổng hợp deep_profile hoàn chỉnh)
  └── src/strategy.py (Xếp hạng điểm mạnh, điểm yếu, khuyến nghị hành động)
         │
         ▼
[TẦNG TRỢ LÍ TRÍ TUỆ NHÂN TẠO (AI ASSISTANT)]
  ├── src/ai_assistant/context_builder.py (Xây dựng Ground Truth text cho LLM)
  ├── src/ai_assistant/briefing.py (Sinh bản tóm tắt chiến lược mở đầu chủ động)
  ├── src/ai_assistant/gemini_client.py (Google Gemini API streaming đa mô hình)
  └── src/ai_assistant/local_expert.py (Động cơ suy luận offline độc lập không cần mạng)
         │
         ▼
[TẦNG GIAO DIỆN NGƯỜI DÙNG (PRESENTATION)]
  └── app.py (Streamlit Web Dashboard, Sidebar điều hướng, Bàn cờ tương tác)
```

---

## 4. CÁC NỀN TẢNG KHOA HỌC & THUẬT TOÁN CỐT LÕI

### 4.1. Khắc phục thiên lệch mẫu nhỏ bằng Co ngót Bayes (Empirical Bayesian Shrinkage)
- **Vấn đề:** Nếu kỳ thủ chơi biến cờ $A$ chỉ 1 lần và thắng, tỷ lệ thắng thực tế là $100\%$. Nếu chơi biến $B$ 20 lần và thắng 14 lần, tỷ lệ thắng là $70\%$. Nếu xếp hạng thuần túy theo tỷ lệ thắng, biến $A$ ($100\%$) sẽ bị xếp cao hơn biến $B$ ($70\%$), dẫn đến kết luận sai lệch nghiêm trọng.
- **Giải pháp:** Hệ thống áp dụng công thức co ngót Bayes kéo điểm số của các mẫu nhỏ về hiệu suất cơ sở ($\text{Baseline Score}$) của kỳ thủ:

$$\text{Points} = \text{Wins} + 0.5 \times \text{Draws}$$

$$\text{Prior Points} = K \times \left(\frac{\text{Baseline Score}}{100}\right)$$

$$\text{Adjusted Score (\%)} = \frac{\text{Points} + \text{Prior Points}}{\text{Games Count} + K} \times 100$$

*Trong đó: $K = 6.0$ là trọng số tiên nghiệm ($\text{Prior Strength}$). Với các biến chơi nhiều ván ($\text{Games Count} \gg K$), mẫu thực tế sẽ chi phối hoàn toàn. Với các biến chơi ít ván, điểm số được kéo về mức trung bình của kỳ thủ.*

- **Phân loại 5 cấp bậc:**
  1. `CONFIRMED_STRENGTH`: Mẫu $\ge 5$ ván và $\text{Delta} \ge +10\%$.
  2. `POTENTIAL_STRENGTH`: Mẫu $< 5$ ván nhưng $\text{Delta} \ge +10\%$.
  3. `CONFIRMED_WEAKNESS`: Mẫu $\ge 5$ ván và $\text{Delta} \le -10\%$.
  4. `POTENTIAL_WEAKNESS`: Mẫu $< 5$ ván nhưng $\text{Delta} \le -10\%$.
  5. `NEUTRAL`: Nằm trong phạm vi bình thường so với baseline.

### 4.2. Chống chuyển vị thế cờ (Transposition-Safe EPD Hashing)
- Trong cờ vua, cùng một thế cờ có thể đạt được qua nhiều thứ tự nước đi khác nhau (ví dụ: `1.d4 Nf6 2.c4 e6` và `1.c4 e6 2.d4 Nf6`).
- Chuỗi FEN đầy đủ có chứa bộ đếm nước đi ($\text{halfmove clock}$ và $\text{fullmove number}$), khiến 2 thế cờ giống hệt nhau về mặt quân cờ và lượt đi lại có chuỗi FEN khác nhau.
- **Thuật toán của hệ thống:** Trích xuất 4 trường đầu tiên của FEN (quân cờ, lượt đi, quyền nhập thành, ô bắt tốt qua đường) để tạo khóa EPD chuẩn hóa, đảm bảo nhận diện chính xác $100\%$ các trường hợp chuyển vị.

### 4.3. Đánh giá chất lượng nước đi theo Centipawn Loss (ACPL)
- Kết nối trực tiếp với động cơ cờ vua **Stockfish 16/17** qua giao thức UCI.
- Đo lường mức độ sụt giảm ưu thế sau mỗi nước đi ($\text{Centipawn Loss}$):
  - $\Delta \le 20 \text{ cp}$: Nước đi chuẩn xác (Best/Good).
  - $20 < \Delta \le 50 \text{ cp}$: Thiếu chính xác ($\text{Inaccuracy}$).
  - $50 < \Delta \le 150 \text{ cp}$: Sai lầm ($\text{Mistake}$).
  - $\Delta > 150 \text{ cp}$: Sai lầm nghiêm trọng ($\text{Blunder}$).
- Phân đoạn ván cờ thành 3 giai đoạn tự động dựa trên số quân cờ trên bàn để tính ACPL riêng cho: **Khai cuộc (Moves 1–15)**, **Trung cuộc**, và **Tàn cuộc ($\le 6$ quân cờ)**.

---

## 5. ĐẶC TẢ CHI TIẾT Ý NGHĨA & CHỨC NĂNG TỪNG FILE

### 📁 Thư mục gốc (Root)
- **`app.py`**: Trọng tâm điều phối toàn bộ giao diện Web Streamlit. Quản lý trạng thái phiên (`st.session_state`), cấu hình giao diện, thanh điều hướng Sidebar 5 mục, điều phối các trang hiển thị (Dashboard, Phân tích ván đấu, Hồ sơ & Phong độ, Trợ lí AI, Nạp ván đấu), và tích hợp bàn cờ tương tác thời gian thực.
- **`requirements.txt`**: Khai báo danh sách các thư viện Python phụ thuộc: `streamlit`, `chess` (python-chess), `plotly`, `pandas`, `requests`, `google-genai`, `pytest`, v.v.
- **`README.md`**: Tài liệu hướng dẫn cài đặt, giới thiệu tính năng và cấu trúc dự án.

---

### 📁 Gói Nguồn Chính: `src/`

#### 1. Xử lý Dữ liệu & Mạng
- **`src/pgn_parser.py`**:
  - *Ý nghĩa:* Bộ phân tích cú pháp dữ liệu PGN.
  - *Chức năng:* Đọc file PGN, tách các ván đấu, nhận diện tên kỳ thủ cầm Trắng/Đen, trích xuất kết quả chuẩn hóa, gán nhãn hệ thống khai cuộc theo bảng tra cứu ECO chuẩn quốc tế (`OPENING_LOOKUP`).
- **`src/game_fetcher.py`**:
  - *Ý nghĩa:* Module thu thập ván đấu từ internet.
  - *Chức năng:* Gửi HTTP request tới API công khai của Lichess (`explorer.lichess.ovh`) và Chess.com (`api.chess.com/pub/player/`). Hỗ trợ lọc theo loại cờ (Bullet, Blitz, Rapid, Classical), số lượng ván tối đa và cơ chế thử lại khi gặp lỗi mạng.
- **`src/lichess_oauth.py`**:
  - *Ý nghĩa:* Xác thực người dùng bảo mật với Lichess.
  - *Chức năng:* Triển khai giao thức **OAuth 2.0 PKCE (Proof Key for Code Exchange)** không cần lưu Client Secret, tạo cặp mã `code_verifier` / `code_challenge`, lấy Access Token để tải lịch sử đấu cá nhân của người dùng.
- **`src/utils.py`**:
  - *Ý nghĩa:* Các hàm tiện ích dùng chung.
  - *Chức năng:* Định dạng phần trăm, chuẩn hóa FEN thành EPD 4 trường (`normalize_fen`), và hàm phân định kết quả thắng/hòa/thua độc lập góc nhìn màu quân (`determine_game_outcome`).

#### 2. Phân tích Cờ Vua & Chiến lược
- **`src/opening_tree.py`**:
  - *Ý nghĩa:* Xây dựng cấu trúc cây khai cuộc (Opening Tree).
  - *Chức năng:* Duyệt qua toàn bộ các nước đi của tập ván cờ, biểu diễn các thế cờ thành các node cha-con dạng cây, tính toán số ván đi vào mỗi nhánh, tỷ lệ thắng/hòa/thua trên từng nước đi, phát hiện biến đại diện ngắn nhất và hỗ trợ hiển thị tỷ lệ Win/Draw/Loss bar trên bàn cờ.
- **`src/statistics.py`**:
  - *Ý nghĩa:* Động cơ thống kê mô tả cơ bản.
  - *Chức năng:* Tính toán tổng số ván, điểm số giành được, tỷ lệ thắng, hòa, thua tổng thể và phân tách riêng biệt theo hai màu quân Trắng/Đen.
- **`src/player_profile.py`**:
  - *Ý nghĩa:* Tổng hợp hồ sơ kỳ thủ chuyên sâu.
  - *Chức năng:* Trích xuất Repertoire các khai cuộc chơi nhiều nhất, đạt điểm cao nhất và yếu nhất. Tích hợp kết quả từ các module phân tích cấu trúc Tốt, độ chính xác các pha, động lực học và phong cách để đóng gói thành đối tượng `deep_profile`.
- **`src/strategy.py`**:
  - *Ý nghĩa:* Module hoạch định chiến lược thi đấu và rèn luyện.
  - *Chức năng:* Phân tích phản ứng của kỳ thủ trước các nước cờ đầu tiên của đối phương (`analyze_opponent_responses`), xếp hạng các điểm mạnh nhất và điểm yếu nhất có trọng số Bayes, sinh khuyến nghị chiến thuật hành động (Nên chơi biến nào, nên tránh biến nào, mục tiêu khai thác là gì).

#### 3. Giao diện & Thành phần UI
- **`src/ui_components.py`**:
  - *Ý nghĩa:* Hệ thống thành phần giao diện chuẩn hóa (Design System).
  - *Chức năng:* Khai báo bảng màu tokens (`COLOR_WIN`, `COLOR_DRAW`, `COLOR_LOSS`, `COLOR_PRIMARY`), inject CSS toàn cục cho Streamlit, cung cấp các component tùy biến cao:
    - `MetricCard`: Thẻ KPI 3 tầng đồng bộ chiều cao và giãn cách 100% cột.
    - `InsightCard`: Thẻ nhận định chiến lược có icon và khung cân đối.
    - `PageHeader`: Tiêu đề trang chuẩn hóa.
    - `EmptyState`: Khung thông báo khi chưa có dữ liệu.
    - `get_icon_svg`: Nạp các icon SVG 2D sắc nét.
- **`src/board_component.py`**:
  - *Ý nghĩa:* Thành phần bàn cờ cờ vua tương tác.
  - *Chức năng:* Tạo iframe HTML/JS tích hợp thư viện `chessboard.js` và `chess.js`, cho phép người dùng click quân, lật bàn cờ (Flip Board), hiển thị tọa độ và tương tác nước đi mượt mà.
- **`src/move_history_component.py`**:
  - *Ý nghĩa:* Khung hiển thị biên bản ván cờ (Move Notation Sheet).
  - *Chức năng:* Hiển thị danh sách nước đi theo định dạng chuẩn (1. e4 e5 2. Nf3...), hỗ trợ nhấp vào từng nước cờ để tua lại vị trí bàn cờ tương ứng.

---

### 📁 Gói Phân Tích Chuyên Sâu: `src/analysis/`
- **`src/analysis/confidence.py`**:
  - *Ý nghĩa:* Trái tim toán học thống kê của dự án.
  - *Chức năng:* Chứa toàn bộ thuật toán **Co ngót Bayes (Empirical Bayesian Shrinkage)** tính toán `calculate_adjusted_score`, độ lệch `calculate_delta`, phân loại 5 cấp bậc điểm mạnh/yếu `assess_performance`, và các hàm xếp hạng `rank_strongest_items`, `rank_weakest_items`.
- **`src/analysis/pawn_structure.py`**:
  - *Ý nghĩa:* Nhận diện cấu trúc Tốt (Pawn Structures).
  - *Chức năng:* Phân tích thế trận Tốt để nhận diện các cấu trúc cờ kinh điển: Cấu trúc Carlsbad, Tốt cô lập (Isolani / d4-isolated pawn), Tốt treo (Hanging Pawns), Cấu trúc Nhím (Hedgehog), Cấu trúc Pháp (French Chain), Trung tâm đóng/mở. Đánh giá hiệu suất điểm số của kỳ thủ khi thi đấu trong từng cấu trúc đó.
- **`src/analysis/phase_analysis.py`**:
  - *Ý nghĩa:* Đo lường độ chính xác theo 3 giai đoạn ván cờ.
  - *Chức năng:* Tính toán sai số centipawn trung bình (ACPL) và chuyển đổi thành thang điểm độ chính xác $0-100\%$ riêng cho giai đoạn Khai cuộc, Trung cuộc và Tàn cuộc. Giúp phát hiện kỳ thủ mạnh ở giai đoạn nào và thường sụp đổ ở giai đoạn nào.
- **`src/analysis/simplification.py`**:
  - *Ý nghĩa:* Phân tích xu hướng đổi quân và đơn giản hóa.
  - *Chức năng:* Thống kê tần suất và hiệu suất khi đổi Hậu (Queen trade), đổi Xe (Rook trade), chuyển từ trung cuộc phức tạp sang tàn cuộc kỹ thuật để xác định kỳ thủ thích lối chơi đơn giản hay giữ thế trận phức tạp.
- **`src/analysis/game_dynamics.py`**:
  - *Ý nghĩa:* Phân tích động lực học ván đấu và tâm lý thời gian.
  - *Chức năng:* Đo lường độ dài trung bình của ván đấu, phân bổ thời gian suy nghĩ trên từng nước cờ, tần suất đảo chiều thế cờ (Swings/Turnarounds) để nhận định độ bền tâm lý thi đấu.
- **`src/analysis/style_metrics.py`**:
  - *Ý nghĩa:* Đo lường các chỉ số phong cách thi đấu thực nghiệm.
  - *Chức năng:* Trích xuất các chỉ số định lượng: Độ biến động (Volatility Score), Tỉ lệ thí quân (Sacrifice Rate), Xu hướng đơn giản hóa (Simplification Rate), Khả năng kiên cường chịu ép (Resilience Rate), Thế trận thường dùng (Dominant Structure - Open/Semi-Open/Closed).
- **`src/analysis/style_classifier.py`**:
  - *Ý nghĩa:* Phân loại hình mẫu kỳ thủ (Player Archetype).
  - *Chức năng:* So sánh điểm phong cách với các hình mẫu huyền thoại: *Attacker* (như Mikhail Tal), *Positional Master* (như Anatoly Karpov), *Universal* (như Magnus Carlsen), *Solid Defender* (như Tigran Petrosian).

---

### 📁 Gói Động Cơ Stockfish: `src/engine/`
- **`src/engine/stockfish_engine.py`**:
  - *Ý nghĩa:* Lớp trừu tượng bọc tiến trình Stockfish thực thi.
  - *Chức năng:* Tự động tìm kiếm file thực thi Stockfish trên hệ điều hành (Windows `.exe`), giao tiếp qua luồng chuẩn `stdin`/`stdout` bằng giao thức UCI, cấu hình số luồng CPU (Threads) và bộ nhớ băm (Hash).
- **`src/engine/evaluator.py`**:
  - *Ý nghĩa:* Bộ đánh giá nước cờ đa luồng.
  - *Chức năng:* Phân tích hàng loạt ván đấu song song (`parallel_batch_analyze_games`) bằng `concurrent.futures`, tính toán điểm đánh giá Centipawn từng nước, gán nhãn sai lầm (Blunder, Mistake, Inaccuracy) và tổng hợp ACPL.
- **`src/engine/engine_config.py`**:
  - *Ý nghĩa:* Cấu hình động cơ phân tích.
  - *Chức năng:* Thiết lập độ sâu mặc định (`depth=6` cho phân tích nhanh, `depth=12` cho phân tích sâu), ngưỡng phân loại sai số.

---

### 📁 Gói Trợ Lí AI: `src/ai_assistant/`
- **`src/ai_assistant/briefing.py`**:
  - *Ý nghĩa:* Bộ sinh Bản Tóm tắt Chiến lược Mở đầu Tự động (Executive Strategic Briefing).
  - *Chức năng:* Đọc dữ liệu từ `deep_profile` và `stats` để tự động viết một bản phân tích chiến lược sắc bén ngay khi người dùng mở tab AI. Hỗ trợ 2 góc nhìn:
    - Chế độ `self`: Đưa ra khuyến nghị huấn luyện, vá lỗ hổng repertoire, đề xuất bài tập tàn cuộc.
    - Chế độ `opponent`: Đưa ra kế hoạch triệt hạ đối thủ, tránh biến mạnh của họ, khai thác tử huyệt.
    - Tạo các nút câu hỏi gợi ý 1 chạm (`get_followup_prompts`).
- **`src/ai_assistant/context_builder.py`**:
  - *Ý nghĩa:* Xây dựng ngữ cảnh phân tích (Ground Truth Context).
  - *Chức năng:* Chuyển đổi toàn bộ dữ liệu thống kê, cây khai cuộc, cấu trúc Tốt, độ chính xác các pha thành văn bản có cấu trúc rõ ràng làm đầu vào cho LLM, ngăn chặn hiện tượng ảo giác (Hallucination).
- **`src/ai_assistant/gemini_client.py`**:
  - *Ý nghĩa:* Kết nối với Google Gemini Cloud API.
  - *Chức năng:* Cấu hình `SYSTEM_INSTRUCTION` cho AI đóng vai trò Đại kiện tướng cờ vua kiêm Huấn luyện viên chiến thuật, gọi API Gemini theo luồng streaming (`stream_gemini_response`) để chữ hiển thị mượt mà trên giao diện.
- **`src/ai_assistant/local_expert.py`**:
  - *Ý nghĩa:* Động cơ chuyên gia cờ vua ngoại tuyến (Offline Fallback Engine).
  - *Chức năng:* Khi không có mạng internet hoặc người dùng chưa cấu hình API Key, module này hoạt động dựa trên cây quyết định và luật tri thức chuyên gia (Rule-based Expert System) để giải đáp chính xác mọi câu hỏi về khai cuộc, cấu trúc tốt, và chiến thuật.
- **`src/ai_assistant/config.py`**:
  - *Ý nghĩa:* Quản lý cấu hình AI và danh sách mô hình (Gemini 2.5 Flash, Gemini 1.5 Pro, Flash Lite).

---

## 6. HỆ THỐNG KIỂM THỬ TỰ ĐỘNG (AUTOMATED TESTING SUITE)

Dự án sở hữu bộ kiểm thử tự động toàn diện gồm **13 tệp test với 96 kịch bản kiểm thử (test cases)**, đạt tỷ lệ vượt qua **100% (96/96 passed)**:

1. **`tests/test_accuracy_system.py`**: Kiểm thử độ chính xác tính ACPL, phân loại sai số cờ vua.
2. **`tests/test_ai_assistant.py`**: Kiểm thử bộ sinh tóm tắt chiến lược mở đầu (`briefing.py`), kiểm thử 2 chế độ `self`/`opponent` và ngữ cảnh LLM.
3. **`tests/test_analysis.py`**: Kiểm thử phân tích động lực học ván đấu, xu hướng đổi quân, mức độ tin cậy mẫu.
4. **`tests/test_confidence.py`**: Kiểm thử chuyên sâu mô hình Co ngót Bayes, tính điểm hiệu chỉnh và độ lệch chuẩn.
5. **`tests/test_engine.py`**: Kiểm thử khởi động Stockfish, phân tích ván đấu đơn lẻ và xử lý ngoại lệ động cơ.
6. **`tests/test_game_fetcher.py`**: Kiểm thử tải ván đấu từ API Lichess và Chess.com, chuẩn hóa tham số đầu vào.
7. **`tests/test_lichess_oauth.py`**: Kiểm thử cơ chế tạo URL đăng nhập OAuth và sinh cặp khóa PKCE.
8. **`tests/test_opening_tree.py`**: Kiểm thử dựng cây khai cuộc, đồng bộ nước đi và chống chuyển vị thế cờ.
9. **`tests/test_pgn_parser.py`**: Kiểm thử parse cú pháp PGN, lọc ván đấu theo kỳ thủ, tra cứu mã ECO.
10. **`tests/test_player_profile.py`**: Kiểm thử phân tích Repertoire khai cuộc và tạo hồ sơ kỳ thủ chuyên sâu.
11. **`tests/test_statistics.py`**: Kiểm thử tính toán tỷ lệ thắng/hòa/thua cơ bản.
12. **`tests/test_strategy.py`**: Kiểm thử xếp hạng điểm mạnh/yếu và sinh kế hoạch tác chiến.
13. **`tests/test_style_profile.py`**: Kiểm thử 8 chiều phong cách thi đấu và phân loại hình mẫu kỳ thủ.

---

## 7. ĐIỂM SÁNG CÔNG NGHỆ & GIÁ TRỊ ĐÓNG GÓP CỦA ĐỀ TÀI

1. **Mô hình Trí Tuệ Nhân Tạo Kép (Hybrid AI Architecture):**
   - Kết hợp giữa sức mạnh tính toán chính xác tuyệt đối của **Stockfish** (Deterministic Engine) và khả năng đàm thoại tự nhiên, giải thích chiến lược của **Google Gemini LLM** (Generative AI).
   - Tích hợp sẵn động cơ Offline Expert System giúp phần mềm hoạt động trơn tru ngay cả khi mất kết nối mạng.
2. **Giải Quyết Vấn Đề Khoa Học Thống Kê:**
   - Ứng dụng thành công **Empirical Bayesian Shrinkage** vào thể thao trí tuệ, loại bỏ hoàn toàn các nhận định sai lầm do mẫu dữ liệu nhỏ gây ra.
3. **Trải Nghiệm AI Chủ Động (Proactive Strategic Briefing):**
   - Thay vì để một khung chat trống rỗng chờ người dùng gõ, Trợ lí AI tự động phân tích hồ sơ và đưa ra bản tham mưu chiến lược ngay từ giây đầu tiên người dùng mở tab.
4. **Tính Thực Tiễn Cao:**
   - Hỗ trợ tải trực tiếp từ tài khoản Lichess/Chess.com chỉ với 1 cú click hoặc tải file PGN có sẵn.
   - Giao diện được tối ưu chuẩn mực, trực quan, hỗ trợ đắc lực cho cả người mới chơi, kỳ thủ thi đấu và huấn luyện viên cờ vua.

---

