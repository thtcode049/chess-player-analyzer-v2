"""
AI Local Expert Module
-----------------------
Chức năng: Cung cấp bộ máy suy luận chiến thuật ngoại tuyến (Offline Rule-Based Expert Engine)
trả lời câu hỏi người dùng dựa trên dữ liệu thống kê khách quan từ Profile và Cây Khai cuộc
khi không có API Key của Gemini hoặc khi mạng Internet gián đoạn.
"""

from typing import Dict, Any, List, Optional
from src.analysis.pawn_structure import find_canonical_pawn_skeleton
from src.ai_assistant.intent_router import format_canonical_pawn_structure_markdown
from src.ai_assistant.briefing import (
    format_group_stats,
    generate_initial_strategic_briefing,
)


def generate_local_expert_response(
    prompt: str,
    deep_profile: Optional[Dict[str, Any]],
    stats: Optional[Dict[str, Any]],
    fen_map_white: Optional[Dict[str, Any]] = None,
    fen_map_black: Optional[Dict[str, Any]] = None,
    selected_player: str = "Kỳ thủ",
    mode: str = "self",
    **kwargs: Any
) -> str:
    """
    Sinh câu trả lời thông minh dựa trên luật (Rule-Based Expert System) từ dữ liệu thực nghiệm.
    """
    p_lower = prompt.lower().strip()
    is_intro_query = any(k in p_lower for k in ["giới thiệu", "gioi thieu", "pawn skeleton", "hình thái", "hinh thai", "thế nào là", "the nao la", "là gì", "la gi", "skeleton"])
    canonical_match = find_canonical_pawn_skeleton(prompt)
    if canonical_match and (is_intro_query or not deep_profile or not stats):
        return format_canonical_pawn_structure_markdown(
            key=canonical_match[0],
            data=canonical_match[1],
            deep_profile=deep_profile,
            selected_player=selected_player,
            mode=mode,
        )

    if not deep_profile or not stats:
        return (
            f"Hiện tại chưa có đủ dữ liệu phân tích ván đấu của **{selected_player}**. "
            f"Vui lòng nạp ván đấu tại trang **Nạp Ván đấu** để hệ thống có thể phân tích."
        )

    p = prompt.strip().lower()

    rep = deep_profile.get("repertoire", {})
    w_rep = rep.get("white_repertoire", [])
    b_rep = rep.get("black_repertoire", [])
    
    structs = deep_profile.get("structures", {}).get("structures", [])

    # =========================================================================
    # 1. TRẢ LỜI VỀ CẤU TRÚC TỐT (PAWN STRUCTURES)
    # =========================================================================
    pawn_keywords = [
        "cấu trúc", "tốt", "structure", "pawn", "carlsbad", "isolani", "iqp", "hanging",
        "hedgehog", "stonewall", "scheveningen", "boleslavsky", "maroczy", "french", "mar del plata",
        "benoni", "najdorf", "grunfeld", "grünfeld", "slav", "caro-kann", "caro kann",
        "panov", "dragon", "benko", "ruy lopez", "lopez", "kid", "king's indian",
    ]
    if any(k in p for k in pawn_keywords):
        lines = [f"### 🧬 Phân tích Chuyên sâu về Cấu trúc Tốt của **{selected_player}**\n"]
        if not structs:
            lines.append("Chưa phát hiện cấu trúc Tốt đặc trưng nào nổi bật trong các ván đấu đã phân tích.")
            return "\n".join(lines)

        # Kiểm tra nếu hỏi cấu trúc cụ thể
        specific_match = None
        for s in structs:
            s_name = s.get("name", "").lower()
            s_key = s.get("structure_key", "").lower()
            s_key_spaced = s_key.replace("_", " ") if s_key else ""
            if (s_name and s_name in p) or (s_key and (s_key in p or s_key_spaced in p)):
                specific_match = s
                break

        if specific_match:
            lines.append(f"- **{specific_match['name']}** · {format_group_stats(specific_match)}")
            move = specific_match.get("typical_formation_move")
            if move is not None:
                lines.append(f"- **Thời điểm hình thành thường gặp:** Khoảng nước {move}.")
            example = next(
                (game for game in specific_match.get("games", []) if game.get("formation_fen")),
                None,
            )
            if example:
                lines.append(
                    f"- **Thế cờ ghi nhận:** {example.get('white', 'Trắng')} – "
                    f"{example.get('black', 'Đen')} · `{example['formation_fen']}`."
                )
            return "\n".join(lines)

        lines.extend(f"- **{item['name']}** · {format_group_stats(item)}" for item in structs[:6])
        lines.append("Một ván có thể xuất hiện trong nhiều nhóm cấu trúc Tốt.")
        return "\n".join(lines)

    # =========================================================================
    # 2. TRẢ LỜI VỀ GIAI ĐOẠN (PHASES)
    # =========================================================================
    if any(k in p for k in ["giai đoạn", "phase", "chính xác", "accuracy", "trung cuộc", "tàn cuộc", "khai cuộc và trung cuộc"]):
        return (
            f"### ⏱ Đánh giá Giai đoạn & Động cơ đối với **{selected_player}**\n\n"
            f"Hệ thống phân tích tập trung vào **Danh mục Khai cuộc (Repertoire)** và **Cấu trúc Tốt (Pawn Structures)**.\n"
            f"Để phân tích chi tiết từng nước đi hoặc đánh giá độ sâu bàn cờ bằng Stockfish, bạn hãy mở bàn cờ tương tác và kích hoạt **Stockfish 19 Web Worker** trực tiếp trên trình duyệt."
        )

    # =========================================================================
    # 4. TRẢ LỜI VỀ KHAI CUỘC & PHẢN ỨNG NƯỚC ĐI (REPERTOIRE & OPENING TREE)
    # =========================================================================
    if any(k in p for k in ["khai cuộc", "opening", "repertoire", "1.e4", "1.d4", "1.c4", "1.nf3", "cầm trắng", "cầm đen", "sở trường", "vũ khí"]):
        lines = [f"### 📚 Phân tích Danh mục Khai cuộc (Repertoire) của **{selected_player}**\n"]
        
        for label, items in (("Cầm Trắng", w_rep), ("Cầm Đen", b_rep)):
            lines.append(f"#### {label}")
            if items:
                lines.extend(f"- **{item['name']}** · {format_group_stats(item)}" for item in items[:5])
            else:
                lines.append("- Chưa có dữ liệu khai cuộc theo màu quân này.")
        return "\n".join(lines)

    return generate_initial_strategic_briefing(deep_profile, stats, selected_player, mode)
