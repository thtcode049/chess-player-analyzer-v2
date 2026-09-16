# Chess Player Analyzer

> Systems for Analyzing Game Data & AI Strategic Coaching  
> *Hệ thống phân tích dữ liệu ván đấu và Trợ lí AI Huấn luyện & Chuẩn bị chiến thuật cờ vua*

---

## 📌 Tổng quan dự án (Overview)
**Chess Player Analyzer** là ứng dụng Web giúp phân tích toàn diện dữ liệu lịch sử thi đấu cờ vua từ file PGN hoặc Lichess/Chess.com. Hệ thống phục vụ đa mục đích: **Tự phân tích bản thân (Self-Improvement)**, **Huấn luyện học viên (Coaching)**, hoặc **Chuẩn bị đối đầu với đối thủ (Match Prep)**. Hệ thống tự động trích xuất Repertoire khai cuộc, cây nước đi (Opening Tree), độ chính xác từng giai đoạn theo chuẩn Stockfish, cấu trúc Tốt, phong cách thi đấu và đồng hành cùng **Trợ lí AI Đại kiện tướng** đưa ra bản tóm tắt chiến lược mở đầu chủ động.

---

## 🛠 Công nghệ sử dụng (Tech Stack)
- **Ngôn ngữ chính**: Python 3.11+
- **Giao diện Web**: Streamlit
- **Xử lý cờ vua (PGN/FEN/Moves)**: `python-chess` (`chess`)
- **Xử lý & Thống kê Dữ liệu**: Pandas
- **Trực quan hóa**: Plotly
- **Kiểm thử (Testing)**: Pytest

---

## 🚀 Hướng dẫn cài đặt & Chạy ứng dụng (Installation & Usage)

### 1. Khởi tạo môi trường ảo (Virtual Environment)
```bash
# Trên Windows PowerShell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2. Cài đặt các thư viện cần thiết
```bash
pip install -r requirements.txt
```

### 3. Chạy ứng dụng Streamlit
```bash
streamlit run app.py
```

### 4. Chạy kiểm thử tự động (Unit Tests)
```bash
pytest
```

---

## 📂 Cấu trúc dự án (Project Structure)
```text
chess-player-analyzer/
│
├── app.py                      # Giao diện Web Streamlit chính
├── requirements.txt            # Danh sách thư viện phụ thuộc
├── README.md                   # Tài liệu hướng dẫn dự án
│
├── data/                       # Dữ liệu ván đấu mẫu
│   └── sample.pgn
│
├── src/                        # Các module xử lý nghiệp vụ chính
│   ├── ai_assistant/           # Trợ lí AI Chiến lược & Huấn luyện (Gemini & Offline Engine)
│   │   ├── briefing.py         # Bản tóm tắt chiến lược mở đầu chủ động
│   │   ├── context_builder.py  # Xây dựng ngữ cảnh phân tích cho AI
│   │   ├── gemini_client.py    # Kết nối API Google Gemini
│   │   └── local_expert.py     # Bộ máy phân tích cờ vua offline
│   ├── analysis/               # Phân tích cờ vua nâng cao
│   │   ├── confidence.py       # Co ngót Bayes (Bayesian Shrinkage) & Đánh giá mức độ tin cậy
│   │   ├── game_dynamics.py    # Động lực học ván đấu & Tâm lý thời gian
│   │   ├── pawn_structure.py   # Phân loại & hiệu suất cấu trúc Tốt (Carlsbad, Isolani...)
│   │   ├── phase_analysis.py   # Phân tích sai số ACPL theo 3 giai đoạn cờ
│   │   ├── simplification.py   # Xu hướng đổi quân & đơn giản hóa thế trận
│   │   └── style_metrics.py    # Đo lường phong cách (Tấn công, Chiến thuật, Rủi ro...)
│   ├── engine/                 # Động cơ Stockfish & Hệ thống đánh giá nước đi
│   ├── pgn_parser.py           # Module đọc & chuẩn hóa dữ liệu PGN
│   ├── opening_tree.py         # Module xây dựng cây khai cuộc (Opening Tree)
│   ├── statistics.py           # Module tính toán thống kê cơ bản (Win rate, Score)
│   ├── player_profile.py       # Module tổng hợp hồ sơ kỳ thủ chuyên sâu
│   ├── strategy.py             # Module xếp hạng điểm mạnh / điểm yếu & chiến lược thi đấu
│   ├── game_fetcher.py         # Module nạp ván đấu từ Lichess & Chess.com API
│   ├── ui_components.py        # Các thành phần UI dùng chung (MetricCard, InsightCard...)
│   └── utils.py                # Tiện ích bổ trợ dùng chung
│
└── tests/                      # Bộ kiểm thử tự động (Unit Tests)
    ├── test_accuracy_system.py
    ├── test_ai_assistant.py
    ├── test_analysis.py
    ├── test_confidence.py
    ├── test_engine.py
    ├── test_game_fetcher.py
    ├── test_lichess_oauth.py
    ├── test_opening_tree.py
    ├── test_pgn_parser.py
    ├── test_player_profile.py
    ├── test_statistics.py
    ├── test_strategy.py
    └── test_style_profile.py
```
