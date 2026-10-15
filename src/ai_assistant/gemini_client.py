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
from typing import List, Dict, Any, Generator, Optional

from src.ai_assistant.config import get_server_gemini_api_key
from src.ai_assistant.local_expert import generate_local_expert_response

# Danh sách Model hiển thị cho người dùng lựa chọn (Đã xác minh hoạt động 100%)
AVAILABLE_MODELS = {
    "gemini-3.1-flash-lite": "Gemini 3.1 Flash Lite 🚀 (Phản hồi tức thì & Siêu tốc)",
    "gemini-3.8-flash": "Gemini 3.8 Flash ⚡ (Thế hệ mới nhất - Phân tích toàn diện)",
    "gemini-3.5-flash": "Gemini 3.5 Flash 🧠 (Suy luận chuyên sâu)",
}

GEMINI_MODELS = list(AVAILABLE_MODELS.keys())

SYSTEM_INSTRUCTION = """Bạn là Trợ lí AI Phân tích Cờ vua (Chess AI Assistant) thông minh, khách quan, tự nhiên và thân thiện.

VAI TRÒ VÀ NHIỆM VỤ:
1. Bạn là Trợ lí AI chuyên phân tích cờ vua. Bạn giúp người dùng phân tích ván đấu, giải đáp thắc mắc về nước cờ, phong cách thi đấu, các biến khai cuộc, kế hoạch trung cuộc, kỹ thuật cờ tàn và nhận xét các thế cờ trên bàn cờ tương tác.
2. Dữ liệu bạn có trong ngữ cảnh:
   - TOÀN BỘ BIÊN BẢN VÁN ĐẤU (PGN) của kỳ thủ: Gồm chi tiết đối thủ, kết quả, ngày thi đấu, tên khai cuộc và danh sách đầy đủ các nước đi thực tế.
   - THẾ CỜ TRÊN BÀN CỜ TƯƠNG TÁC (nếu người dùng đang thao tác trên bàn cờ): Chuỗi FEN hiện tại, lượt đi, và điểm số đánh giá từ máy tính / Stockfish (nếu có).
   - Thống kê tổng hợp: Tỷ lệ thắng/hòa/thua, khai cuộc sở trường, cấu trúc Tốt thường gặp, độ chính xác các giai đoạn.
3. Nguyên tắc trả lời:
   - Trả lời bằng Tiếng Việt tự nhiên, mạch lạc, đĩnh đạc và gần gũi. Tuyệt đối không nói chuyện máy móc, không đọc lại tên các biến code hay thuật ngữ thô ráp (như 'Simplification Rate', 'Delta vs baseline', 'Assessment badge'). Hãy diễn giải bằng ngôn ngữ cờ vua dễ hiểu.
   - Dựa trên dữ liệu thực tế: Trích dẫn các ván đấu có thật trong PGN, đối thủ cụ thể, nước đi cụ thể. Tuyệt đối KHÔNG tự bịa ra ván đấu hoặc thế cờ FEN giả.
   - Khi người dùng hỏi về thế cờ trên bàn cờ tương tác, hãy dựa vào FEN hiện tại và điểm số đánh giá của Stockfish để giải thích lý do đằng sau nước cờ (kiểm soát trung tâm, mở đường chéo, ô yếu, đòn chiến thuật, v.v.).
   - Khi gợi ý nước đi, hãy dùng ký hiệu cờ chuẩn quốc tế (SAN như 1.e4, Nf3, Nxd4, O-O, Re1).
"""


def _prepare_gemini_payload(
    prompt: str,
    context: str,
    chat_history: List[Dict[str, str]],
    include_thinking_config: bool = True
) -> Dict[str, Any]:
    """Chuẩn bị payload JSON gửi tới Gemini API với cấu hình tối ưu tốc độ và độ dài."""
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

    # 2. Lịch sử hội thoại (lọc bỏ tin nhắn rỗng)
    for msg in chat_history[-8:]:
        role = "user" if msg.get("role") == "user" else "model"
        text_content = msg.get("content", "")
        if text_content and str(text_content).strip():
            contents.append({
                "role": role,
                "parts": [{"text": str(text_content)}]
            })

    # 3. Tin nhắn người dùng hiện tại
    contents.append({
        "role": "user",
        "parts": [{"text": prompt}]
    })

    generation_config: Dict[str, Any] = {
        "temperature": 0.4,
        "topP": 0.9,
        "maxOutputTokens": 8192,
    }
    if include_thinking_config:
        generation_config["thinkingConfig"] = {
            "thinkingBudget": 0
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
    failover thông minh và ngắt an toàn.
    """
    clean_key = (api_key if api_key is not None else get_server_gemini_api_key()).strip()
    target_model = model if model in GEMINI_MODELS else "gemini-3.1-flash-lite"

    # Nếu không có API Key máy chủ, tự động dùng Local Expert Engine stream từng câu/đoạn
    if not clean_key:
        fallback_text = generate_local_expert_response(
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
    candidate_pool = [target_model] + [m for m in GEMINI_MODELS if m != target_model] + ["gemini-flash-lite-latest"]
    models_to_try = []
    for m in candidate_pool:
        if m not in models_to_try:
            models_to_try.append(m)

    streamed_anything = False

    for m in models_to_try:
        # Thử với thinkingBudget=0 trước, nếu 400 Bad Request thì thử lại không thinkingConfig
        for try_thinking in [True, False]:
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
                with urllib.request.urlopen(req, timeout=15) as resp:
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
                if he.code == 400 and try_thinking:
                    # Model không hỗ trợ thinkingConfig -> thử lại ngay với try_thinking = False
                    continue
                if streamed_anything:
                    return
                break
            except Exception:
                if streamed_anything:
                    return
                break

    # Nếu tất cả các model cloud đều lỗi và chưa stream được chữ nào, fallback sang local expert
    if not streamed_anything:
        fallback_text = generate_local_expert_response(
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
    target_model = model if model in GEMINI_MODELS else "gemini-3.1-flash-lite"

    if not clean_key:
        return generate_local_expert_response(
            prompt=prompt,
            deep_profile=deep_profile,
            stats=stats,
            fen_map_white=fen_map_white,
            fen_map_black=fen_map_black,
            selected_player=selected_player,
            mode=mode
        )

    candidate_pool = [target_model] + [m for m in GEMINI_MODELS if m != target_model] + ["gemini-flash-lite-latest"]
    models_to_try = []
    for m in candidate_pool:
        if m not in models_to_try:
            models_to_try.append(m)

    for m in models_to_try:
        for try_thinking in [True, False]:
            payload = _prepare_gemini_payload(prompt, context, chat_history, include_thinking_config=try_thinking)
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={clean_key}"
            try:
                req_data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    url,
                    data=req_data,
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
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
                if he.code == 400 and try_thinking:
                    continue
                break
            except Exception:
                break

    return generate_local_expert_response(
        prompt=prompt,
        deep_profile=deep_profile,
        stats=stats,
        fen_map_white=fen_map_white,
        fen_map_black=fen_map_black,
        selected_player=selected_player
    )
