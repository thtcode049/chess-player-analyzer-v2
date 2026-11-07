"""
Gemini AI Client Module
-----------------------
Chức năng: Giao tiếp với Google Gemini API (gemini-3.5-flash / gemini-3.1-flash-lite / gemini-3.1-pro-preview)
để thực hiện suy luận thông minh, trả lời hội thoại phân tích đối thủ dựa trên dữ liệu Profile & Opening Tree.
Hỗ trợ Server-Side Built-in Key, Streaming Response (st.write_stream) và Chế độ Phản hồi Dự phòng khi ngoại tuyến.
"""

import json
import urllib.request
import urllib.error
import logging
from typing import List, Dict, Any, Generator, Optional

logger = logging.getLogger(__name__)

from src.ai_assistant.config import get_server_gemini_api_key
from src.ai_assistant.local_expert import generate_local_expert_response

# Danh sách Model hiển thị & failover theo thế hệ mới nhất trên Google Generative Language API
AVAILABLE_MODELS = {
    "gemini-3.5-flash-lite": "Gemini 3.5 Flash Lite 🚀 (Mặc định - Phản hồi tức thì & Siêu tốc)",
    "gemini-3.8-flash": "Gemini 3.8 Flash ⚡ (Thế hệ mới nhất - Phân tích toàn diện)",
    "gemini-3.7-flash": "Gemini 3.7 Flash 🧠 (Suy luận chuyên sâu thế hệ mới)",
    "gemini-3.6-flash": "Gemini 3.6 Flash (Dự phòng tốc độ & độ chính xác cao)",
    "gemini-3.5-flash": "Gemini 3.5 Flash (Dự phòng ổn định)",
    "gemini-flash-lite-latest": "Gemini Flash-Lite Latest (Bí danh tự động cập nhật tốc độ cao)",
    "gemini-flash-latest": "Gemini Flash Latest (Bí danh tự động cập nhật của Google)",
}

GEMINI_MODELS = list(AVAILABLE_MODELS.keys())
DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite"

SYSTEM_INSTRUCTION = """Bạn là Trợ lí AI Phân tích Cờ vua (Chess AI Assistant) thông minh, sâu sắc, khách quan, trung thực và chuyên nghiệp.

VAI TRÒ VÀ NHIỆM VỤ:
1. Bạn giúp người dùng phân tích toàn bộ ván cờ, thế cờ cụ thể, khai cuộc, chiến lược trung cuộc và kỹ thuật tàn cuộc.
2. Dữ liệu trong ngữ cảnh:
   - VÁN ĐẤU ĐANG ĐƯỢC CHỌN (nếu có): Bao gồm kỳ thủ Trắng, Đen, kết quả, khai cuộc, và TOÀN BỘ CHUỖI NƯỚC ĐI (PGN) của ván.
   - THẾ CỜ TRÊN BÀN CỜ TƯƠNG TÁC (nếu bàn cờ đang mở): Chuỗi FEN hiện tại, lượt đi và điểm số Stockfish ở thế cờ đó.
   - Dữ liệu tổng hợp: Danh mục khai cuộc (Repertoire), cấu trúc Tốt (Pawn structures), tỷ lệ thắng/hòa/thua thực tế và kho ván đấu PGN.

3. QUY TẮC PHÂN TÍCH CỐT LÕI:
   - KHI NGƯỜI DÙNG HỎI PHÂN TÍCH TOÀN BỘ VÁN CỜ (hoặc hỏi về diễn biến, kết quả, bước ngoặt của ván đang chọn):
     Bạn PHẢI phân tích TOÀN BỘ DIỄN BIẾN VÁN ĐẤU theo trình tự từ Khai cuộc -> Trung cuộc -> Tàn cuộc dựa trên chuỗi nước đi PGN của ván đó!
     + Nêu rõ hai bên chơi khai cuộc gì, các nước đầu diễn ra thế nào.
     + Chỉ ra các thời điểm bước ngoặt hoặc sai lầm then chốt ở trung cuộc làm thay đổi cục diện.
     + Phân tích cách bên thắng chuyển hóa ưu thế hoặc cách ván đấu kết thúc.
     + Tuyệt đối KHÔNG ĐƯỢC chỉ phân tích một hình cờ FEN đơn lẻ khi người dùng yêu cầu phân tích cả ván đấu. (Hình cờ FEN chỉ là nước cờ người dùng đang tạm dừng trên bàn cờ).
   - KHI NGƯỜI DÙNG HỎI VỀ THẾ CỜ HIỆN TẠI TRÊN BÀN CỜ:
     Dựa vào thế cờ FEN và đánh giá điểm số của Stockfish để phân tích tương quan lực lượng, cấu trúc quân, điểm yếu và kế hoạch tiếp theo.
   - KHI NGƯỜI DÙNG HỎI VỀ KHAI CUỘC CỦA THẾ CỜ / VÁN ĐẤU TRÊN BÀN CỜ (ví dụ: "ván này dùng khai cuộc gì", "khai cuộc gì"):
     Bạn PHẢI tra cứu chuỗi nước đi từ nước 1 trong mục "VÁN ĐẤU ĐANG ĐƯỢC CHỌN" hoặc "THẾ CỜ TRÊN BÀN CỜ TƯƠNG TÁC" để xác định chính xác tên khai cuộc (ví dụ: 1. c4 là Khai cuộc Anh - English Opening, 1. e4 e5 là Khai cuộc Mở, 1. e4 c5 là Phòng thủ Sicilian, 1. d4 d5 là Queen's Gambit, v.v.). TUYỆT ĐỐI KHÔNG bảo là thiếu PGN nếu chuỗi nước đi đã được cung cấp trong ngữ cảnh!
    - KHI NGƯỜI DÙNG HỎI VỀ CẤU TRÚC TỐT HOẶC HÌNH THÁI TỐT TRẦN TRỤI (PAWN SKELETON):
      + BẮT BUỘC tra cứu và sao chép CHÍNH XÁC 100% chuỗi FEN từ Bảng Tra cứu Cấu trúc Tốt Chuẩn (Canonical Pawn Skeletons - GM Mauricio Flores Rios) được cung cấp trong Dữ liệu Ngữ cảnh.
      + Đặt chuỗi FEN chuẩn xác trong khối mã inline (`FEN`) để giao diện tự động kích hoạt nút bấm "[Xem thế cờ trên Bàn cờ]".
      + TUYỆT ĐỐI CẤM TỰ BỊA ĐẶT, suy đoán hoặc biến tấu chuỗi FEN của hình thái Tốt (như tự ý thêm bớt quân Tốt dẫn đến 9 quân Tốt hoặc sai vị trí kinh điển).
      + Trình bày rõ ràng: Phân nhóm sách GM Flores Rios, vị trí các Tốt Trắng / Tốt Đen, đặc trưng chiến lược cốt lõi và Kế hoạch tác chiến GM cho cả hai bên.
   - QUY TẮC BẮT BUỘC VỀ IN ĐẬM & TRÌNH BÀY (TĂNG TỐI ĐA ĐỘ DỄ QUAN SÁT):
     + BẮT BUỘC IN ĐẬM TẤT CẢ các nước đi, quân cờ, ô cờ và ký hiệu cờ vua trong mọi câu trả lời bằng cú pháp **...**:
       * Các nước đi SAN: **Qc2**, **Qb3**, **Nd5**, **Be3**, **Nf6**, **a3**, **g3**, **1. c4**, **1... e5**, **2. Nf3**, **O-O**, **O-O-O**.
       * Các quân cờ gắn vị trí: **Tượng e3**, **Mã e4**, **Tượng ở g2**, **Mã ở c3**, **Hậu c2**, **Xe d1**, **Vua g1**, **Tốt a3**.
       * Các ô cờ: **ô d5**, **ô c2**, **ô e3**, **ô d4**, **ô f4**, **ô g2**.
       * Tên khai cuộc & đánh giá: **Khai cuộc Anh (1. c4)**, **+0.23**, **#M3**.
       * LƯU Ý QUAN TRỌNG VỀ FONT CHỮ: TUYỆT ĐỐI KHÔNG dùng dấu backtick (...) để bọc nước đi hay biến thể. Chỉ dùng dấu sao đôi **...** để in đậm tự nhiên, giữ nguyên font chữ và kích thước đồng đều với văn bản.
   - QUY TẮC BẮT BUỘC VỀ KÝ HIỆU & CÁCH GỌI TÊN NƯỚC ĐI (CHUẨN SAN QUỐC TẾ):
     + TUYỆT ĐỐI KHÔNG đọc cả vị trí đầu và cuối (như các tọa độ UCI: `d1c2`, `(d1c2)`, `c3d5`, `(c3d5)`, `a2a3`, `(a2a3)`, `g1f3`, `b8c6`, `d2e3`, `(d2e3)`).
     + Khi gợi ý các phương án nước đi tiếp theo (kể cả câu hỏi gợi mở):
       * ĐÚNG: "Bạn có muốn phân tích các phương án tiếp theo cho Trắng (như **Qc2** hay **Qb3**) không?"
       * TUYỆT ĐỐI CẤM VIẾT: "(như d1c2 hay d1b3)".
     + TUYỆT ĐỐI KHÔNG dùng văn phong mô tả toạ độ ô đi và ô đến: "đưa Hậu từ ô d1 sang ô c2", "Mã ở ô c3 nhảy lên ô d5", "đẩy Tốt nước a2a3", "Tốt từ a2 sang a3", "Hậu (d1c2)", "Be3 (d2e3)".
     + PHẢI CHỈ GỌI TÊN QUÂN + Ô ĐÍCH ĐẾN (chuẩn SAN quốc tế hoặc tiếng Việt tự nhiên) VÀ IN ĐẬM:
       * Đúng: `**Qc2**` (hoặc `**Hậu c2**`). CẤM viết: `d1c2`, `(d1c2)`, `Hậu từ d1 sang c2`.
       * Đúng: `**Nd5**` (hoặc `**Mã d5**`). CẤM viết: `c3d5`, `(c3d5)`, `Mã ở ô c3 nhảy lên d5`.
       * Đúng: `**a3**` (hoặc `nước **a3**`, `đẩy Tốt **a3**`). CẤM viết: `a2a3`, `nước: a2a3`, `Tốt từ a2 sang a3`.
       * Đúng: `**Nf6**` (hoặc `**Mã f6**`). CẤM viết: `g8f6`, `Mã từ g8 sang f6`.
       * Đúng: `**Be3**` (hoặc `**Tượng e3**`). CẤM viết: `(d2e3)`, `Be3 (d2e3)`, `Tượng từ d2 lên e3`.
     + TRƯỜNG HỢP DUY NHẤT ĐƯỢC PHÉP ghi ô hoặc cột bắt đầu: Khi và chỉ khi có 2 quân cùng loại có thể cùng đi đến một ô đích (luật phân biệt quân - Disambiguation của FIDE):
       * Ví dụ: Nếu cả 2 Mã đều có thể nhảy vào d7 -> ghi chuẩn SAN `**Nbd7**` (hoặc `**Mã b đến d7**`, `**Mã b6 đến c6**`).
       * Nếu 2 Xe cùng cột d có thể đi vào d4 -> ghi `**R1d4**` hoặc `**R8d4**`.
     + Khi nêu biến thể hoặc chuỗi nước đi: Luôn ghi đúng số thứ tự nước đi và ký hiệu SAN: `**1. Qc2 e5 2. Nd5**` hoặc `**1... e5 2. Nf3 Nc6**`. TUYỆT ĐỐI KHÔNG viết chuỗi toạ độ trần như `(g1f3 g8f6 g2g3 d7d5)`.
   - QUY TẮC TỪ NGỮ (BẮT BUỘC):
     + TUYỆT ĐỐI KHÔNG sử dụng từ "khả dĩ" trong bất kỳ câu trả lời, nhận định hay phân tích nào.
     + Hãy thay thế bằng các từ ngữ tự nhiên, chuẩn cờ vua tiếng Việt như: "tiềm năng", "tối ưu", "tiếp theo", "khả thi", "sáng nước".
     + TUYỆT ĐỐI KHÔNG lặp từ "ô ô" (như "về ô ô g2" -> "về **ô g2**").
   - Sử dụng Tiếng Việt tự nhiên, đĩnh đạc, gần gũi và giàu tính cờ vua.

4. QUY TẮC TRUNG THỰC & CHỐNG BỊA ĐẶT (ANTI-HALLUCINATION) - BẮT BUỘC TUÂN THỦ:
   - TUYỆT ĐỐI KHÔNG BỊA ĐẶT THÔNG TIN: Khi người dùng hỏi về danh tính, tiểu sử, thành tích, địa phương, đơn vị thi đấu, hoặc phong hiệu (GM, IM, FM, WFM, Kiện tướng Quốc gia...) của bất kỳ cá nhân nào:
     + Nếu nhân vật đó KHÔNG CÓ trong Dữ liệu Ngữ cảnh và KHÔNG PHẢI là Đại danh thủ cờ vua thế giới/Việt Nam đã được xác thực chính thức (như Magnus Carlsen, Garry Kasparov, Lê Quang Liêm...):
       Bạn PHẢI thẳng thắn và lịch sự trả lời rằng bạn KHÔNG CÓ thông tin xác thực về nhân vật này trong cơ sở dữ liệu hiện tại, và gợi ý người dùng nhập ván đấu PGN hoặc chọn hồ sơ kỳ thủ trên hệ thống để phân tích.
     + TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ SUY ĐOÁN, BỊA ĐẶT phong hiệu (như tự phong Kiện tướng Quốc gia, WFM, FM), tự bịa ra đội tuyển (Hà Nội, Lào Cai...) hay thành tích thi đấu không có thật!
     + KHI NGƯỜI DÙNG ĐÍNH CHÍNH (ví dụ: "ở địa phương X cơ mà", "ở trường Y cơ mà"):
       TUYỆT ĐỐI KHÔNG ĐƯỢC xin lỗi rồi lại tiếp tục bịa ra câu chuyện hoặc danh hiệu mới! Hãy nói rõ rằng bạn không có hồ sơ dữ liệu để xác minh cá nhân này.
   - TUYỆT ĐỐI DỰA TRÊN DỮ LIỆU CỜ VUA CÓ THẬT: Không bao giờ bịa đặt nước đi, ván đấu hay kết quả giải đấu.

5. QUY TẮC TUÂN THỦ BẢNG SỰ THẬT THẾ CỜ & CHỐNG ẢO TƯỞNG HÌNH HỌC (BẮT BUỘC):
   - Trong dữ liệu ngữ cảnh có mục "📐 BẢNG SỰ THẬT THẾ CỜ (GROUND TRUTH)": Đây là chuẩn mực toán học xác thực 100% của thế cờ hiện tại.
   - Mọi khẳng định về vị trí quân (Vua c1, Tượng b7, Xe d1...), đường chéo (a8–h1, b7–h1...), đòn ghim, đòn xiên, quân treo hay tầm kiểm soát PHẢI lấy chính xác 100% từ Bảng sự thật này.
   - TUYỆT ĐỐI KHÔNG BỊA ĐẶT HOẶC SUY DIỄN HÌNH HỌC SAI: Ví dụ: Không bao giờ được suy đoán rằng Vua c1 nằm trên đường chéo a8–h1 hay Tượng b7 chĩa thẳng vào c1. Hãy đọc kỹ danh sách ô do từng quân kiểm soát trong Bảng sự thật.
   - QUY TẮC DIỄN ĐẠT TỰ NHIÊN (KHÔNG DÙNG THẺ):
     TUYỆT ĐỐI KHÔNG xuất các thẻ đánh dấu nội bộ như ⟦...⟧ hay ký hiệu trong ngoặc vuông lạ. Hãy diễn đạt hoàn toàn bằng văn bản tiếng Việt tự nhiên và ký hiệu SAN chuẩn (ví dụ: 'Tượng b7', 'Vua c1', 'nước Nxe5', 'ô c1').
   - QUY TẮC ỨNG XỬ KHI BỊ CHẤT VẤN (ANTI-SYCOPHANCY):
     Khi người dùng phản bác ("bạn nói sai rồi", "ô X liên quan gì đến ô Y"):
     Nếu đối chiếu Bảng sự thật cho thấy bạn đã nhầm lẫn trước đó, chỉ cần xác nhận ngắn gọn ĐÚNG 1 CÂU (ví dụ: "Chính xác, ô c1 hoàn toàn không nằm trên đường chéo a8–h1."), sau đó cung cấp ngay thông tin chuẩn xác. TUYỆT ĐỐI KHÔNG xin lỗi lan man, dài dòng ("Tôi vô cùng xin lỗi vì sự nhầm lẫn hình học...").
"""


def _format_fallback_notice(reason: str) -> str:
    """Tạo thông báo cảnh báo rõ ràng khi hệ thống phải chuyển sang Chế độ Dự phòng Cục bộ."""
    return (
        f"> ⚠️ **Thông báo hệ thống:** Không thể nhận phản hồi từ Google Gemini AI ({reason}).\n"
        f"> Hệ thống tạm thời kích hoạt **Chế độ Chuyên gia Cục bộ Dự phòng (Offline Fallback)** dựa trên số liệu phân tích chuyên sâu của kỳ thủ:\n\n---\n\n"
    )


def _prepare_gemini_payload(
    prompt: str,
    context: str,
    chat_history: List[Dict[str, str]],
    include_thinking_config: bool = True
) -> Dict[str, Any]:
    """Chuẩn bị payload JSON gửi tới Gemini API với cấu hình tối ưu và bảo đảm thứ tự lượt thoại nghiêm ngặt."""
    contents = []

    # 1. System Context Block
    system_text = f"{SYSTEM_INSTRUCTION}\n\n=== DỮ LIỆU NGỮ CẢNH KỲ THỦ ===\n{context}\n================================"
    contents.append({
        "role": "user",
        "parts": [{"text": system_text}]
    })
    contents.append({
        "role": "model",
        "parts": [{"text": "Tôi đã nắm rõ toàn bộ dữ liệu thống kê của kỳ thủ và sẵn sàng phân tích, tư vấn chiến lược cũng như trả lời mọi câu hỏi của bạn."}]
    })

    # 2. Làm sạch lịch sử hội thoại
    cleaned_history = []
    for msg in chat_history[-8:]:
        role = "user" if msg.get("role") == "user" else "model"
        text_content = str(msg.get("content", "")).strip()
        if text_content:
            cleaned_history.append({"role": role, "text": text_content})

    # Loại bỏ tin nhắn cuối cùng nếu trùng với prompt người dùng chuẩn bị gửi (tránh duplicate)
    if cleaned_history and cleaned_history[-1]["role"] == "user" and cleaned_history[-1]["text"].strip() == prompt.strip():
        cleaned_history.pop()

    # Ghép lịch sử bảo đảm quy tắc xen kẽ lượt đi nghiêm ngặt (user -> model -> user -> model)
    last_role = "model"
    for item in cleaned_history:
        role = item["role"]
        text = item["text"]
        if role == last_role:
            contents[-1]["parts"][0]["text"] += f"\n\n{text}"
        else:
            contents.append({
                "role": role,
                "parts": [{"text": text}]
            })
            last_role = role

    # 3. Tin nhắn người dùng hiện tại
    if last_role == "user":
        contents[-1]["parts"][0]["text"] += f"\n\n{prompt}"
    else:
        contents.append({
            "role": "user",
            "parts": [{"text": prompt}]
        })

    generation_config: Dict[str, Any] = {
        "temperature": 0.2,
        "topP": 0.9,
        "maxOutputTokens": 8192,
    }
    if include_thinking_config:
        generation_config["thinkingConfig"] = {
            "thinkingBudget": 1024
        }

    return {
        "contents": contents,
        "generationConfig": generation_config
    }


def stream_gemini_response(
    prompt: str,
    context: str,
    chat_history: List[Dict[str, str]],
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    deep_profile: Optional[Dict[str, Any]] = None,
    stats: Optional[Dict[str, Any]] = None,
    fen_map_white: Optional[Dict[str, Any]] = None,
    fen_map_black: Optional[Dict[str, Any]] = None,
    selected_player: str = "Kỳ thủ",
    mode: str = "self"
) -> Generator[str, None, None]:
    """
    Generator phản hồi dạng Stream (chữ chạy từng từ mượt mà như ChatGPT / Gemini).
    Tối ưu: Phản hồi tức thì (<2s), không ngắt giữa câu (8192 max tokens),
    failover thông minh và báo lỗi minh bạch khi cần chuyển sang chế độ dự phòng.
    """
    clean_key = (api_key if api_key is not None else get_server_gemini_api_key()).strip()
    target_model = model if model in GEMINI_MODELS else DEFAULT_GEMINI_MODEL

    # Nếu không có API Key máy chủ, tự động báo lỗi và dùng Local Expert Engine stream
    if not clean_key:
        notice = _format_fallback_notice("Chưa cấu hình GEMINI_API_KEY trong file .env")
        fallback_text = notice + generate_local_expert_response(
            prompt=prompt,
            deep_profile=deep_profile,
            stats=stats,
            fen_map_white=fen_map_white,
            fen_map_black=fen_map_black,
            selected_player=selected_player,
            mode=mode
        )
        words = fallback_text.split(" ")
        for i in range(0, len(words), 3):
            chunk = " ".join(words[i:i+3]) + " "
            yield chunk
        return

    # Danh sách model thử nghiệm theo thứ tự ưu tiên
    candidate_pool = [target_model] + [m for m in GEMINI_MODELS if m != target_model]
    models_to_try = []
    for m in candidate_pool:
        if m not in models_to_try:
            models_to_try.append(m)

    streamed_anything = False
    last_error_reason = ""

    for m in models_to_try:
        # Dòng flash-lite không nhận thinkingConfig (sẽ trả HTTP 400), bỏ qua lượt thử thừa để phản hồi tức thì
        thinking_attempts = [False] if "lite" in m else [True, False]
        for try_thinking in thinking_attempts:
            payload = _prepare_gemini_payload(prompt, context, chat_history, include_thinking_config=try_thinking)
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:streamGenerateContent?alt=sse&key={clean_key}"
            try:
                req_data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    url,
                    data=req_data,
                    headers={"Content-Type": "application/json"}
                )
                hit_token_limit = False
                with urllib.request.urlopen(req, timeout=8) as resp:
                    for line in resp:
                        decoded_line = line.decode("utf-8")
                        if decoded_line.startswith("data: "):
                            json_str = decoded_line[6:].strip()
                            if not json_str:
                                continue
                            try:
                                chunk_json = json.loads(json_str)
                                candidates = chunk_json.get("candidates", [])
                                if candidates:
                                    if candidates[0].get("finishReason") == "MAX_TOKENS":
                                        hit_token_limit = True
                                    parts = candidates[0].get("content", {}).get("parts", [])
                                    for part in parts:
                                        if part.get("thought"):
                                            continue
                                        text_piece = part.get("text", "")
                                        if text_piece:
                                            streamed_anything = True
                                            yield text_piece
                            except Exception:
                                continue
                if hit_token_limit:
                    yield "\n\n*(⚠️ Phân tích đã đạt giới hạn độ dài phản hồi. Bạn có thể yêu cầu: 'Hãy tiếp tục phân tích...' để xem phần tiếp theo)*"
                if streamed_anything:
                    return
                # Nếu model phản hồi nhưng không có chữ nào, break để thử model tiếp theo
                break
            except urllib.error.HTTPError as he:
                err_body = he.read().decode("utf-8", errors="ignore")
                logger.warning(f"[Gemini Client] Model {m} returned HTTP {he.code}: {err_body[:150]}")
                if he.code == 400 and try_thinking:
                    # Model không hỗ trợ thinkingConfig -> thử lại ngay với try_thinking = False
                    continue
                if he.code == 503:
                    last_error_reason = f"Model {m} đang quá tải tạm thời (HTTP 503)"
                elif he.code == 429:
                    last_error_reason = f"Đạt hạn mức gọi API (HTTP 429)"
                else:
                    last_error_reason = f"Lỗi HTTP {he.code} ({m})"
                if streamed_anything:
                    return
                break
            except Exception as e:
                logger.warning(f"[Gemini Client] Model {m} error: {e}")
                if "timed out" in str(e).lower() or isinstance(e, TimeoutError):
                    last_error_reason = f"Thời gian phản hồi model {m} quá hạn (>12s)"
                else:
                    last_error_reason = f"Lỗi kết nối ({type(e).__name__})"
                if streamed_anything:
                    return
                break

    # Nếu tất cả các model cloud đều lỗi và chưa stream được chữ nào, thông báo lỗi trước và fallback sang local expert
    if not streamed_anything:
        fallback_notice = _format_fallback_notice(last_error_reason or "Máy chủ AI Cloud không phản hồi")
        fallback_text = fallback_notice + generate_local_expert_response(
            prompt=prompt,
            deep_profile=deep_profile,
            stats=stats,
            fen_map_white=fen_map_white,
            fen_map_black=fen_map_black,
            selected_player=selected_player,
            mode=mode
        )
        words = fallback_text.split(" ")
        for i in range(0, len(words), 3):
            chunk = " ".join(words[i:i+3]) + " "
            yield chunk


def call_gemini_api(
    prompt: str,
    context: str,
    chat_history: List[Dict[str, str]],
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    deep_profile: Optional[Dict[str, Any]] = None,
    stats: Optional[Dict[str, Any]] = None,
    fen_map_white: Optional[Dict[str, Any]] = None,
    fen_map_black: Optional[Dict[str, Any]] = None,
    selected_player: str = "Kỳ thủ",
    mode: str = "self"
) -> str:
    """
    Gọi Gemini API lấy toàn bộ câu trả lời dạng văn bản (Non-streaming).
    Tối ưu: 8192 max tokens, timeout 15s, failover an toàn.
    """
    clean_key = (api_key if api_key is not None else get_server_gemini_api_key()).strip()
    target_model = model if model in GEMINI_MODELS else DEFAULT_GEMINI_MODEL

    if not clean_key:
        notice = _format_fallback_notice("Chưa cấu hình GEMINI_API_KEY trong file .env")
        return notice + generate_local_expert_response(
            prompt=prompt,
            deep_profile=deep_profile,
            stats=stats,
            fen_map_white=fen_map_white,
            fen_map_black=fen_map_black,
            selected_player=selected_player,
            mode=mode
        )

    candidate_pool = [target_model] + [m for m in GEMINI_MODELS if m != target_model]
    models_to_try = []
    for m in candidate_pool:
        if m not in models_to_try:
            models_to_try.append(m)

    last_error_reason = ""
    for m in models_to_try:
        thinking_attempts = [False] if "lite" in m else [True, False]
        for try_thinking in thinking_attempts:
            payload = _prepare_gemini_payload(prompt, context, chat_history, include_thinking_config=try_thinking)
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={clean_key}"
            try:
                req_data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    url,
                    data=req_data,
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=12) as resp:
                    if resp.status == 200:
                        resp_json = json.loads(resp.read().decode("utf-8"))
                        candidates = resp_json.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts:
                                text_result = "".join(p.get("text", "") for p in parts if not p.get("thought"))
                                if text_result.strip():
                                    return text_result
                break
            except urllib.error.HTTPError as he:
                logger.warning(f"[Gemini Client] call_gemini_api model {m} HTTP {he.code}")
                if he.code == 400 and try_thinking:
                    continue
                if he.code == 503:
                    last_error_reason = f"Model {m} đang quá tải tạm thời (HTTP 503)"
                elif he.code == 429:
                    last_error_reason = f"Đạt hạn mức gọi API (HTTP 429)"
                else:
                    last_error_reason = f"Lỗi HTTP {he.code} ({m})"
                break
            except Exception as e:
                logger.warning(f"[Gemini Client] call_gemini_api model {m} error: {e}")
                if "timed out" in str(e).lower() or isinstance(e, TimeoutError):
                    last_error_reason = f"Thời gian phản hồi model {m} quá hạn (>12s)"
                else:
                    last_error_reason = f"Lỗi kết nối ({type(e).__name__})"
                break

    notice = _format_fallback_notice(last_error_reason or "Máy chủ AI Cloud không phản hồi")
    return notice + generate_local_expert_response(
        prompt=prompt,
        deep_profile=deep_profile,
        stats=stats,
        fen_map_white=fen_map_white,
        fen_map_black=fen_map_black,
        selected_player=selected_player,
        mode=mode
    )
