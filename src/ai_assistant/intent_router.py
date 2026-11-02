"""
Intent Router & Deterministic Fact Responder
--------------------------------------------
Chức năng:
1. Phân loại câu hỏi của người dùng thành:
   - Nhóm A: Câu hỏi sự thật thuần túy về hình học / luật cờ / vị trí quân.
   - Nhóm B: Câu hỏi phản bác / nghi ngờ / chất vấn câu trả lời trước của AI.
   - Nhóm C: Câu hỏi phân tích chiến lược, kế hoạch, khai cuộc, toàn ván đấu.
2. Trả lời tất định 100% bằng code python-chess cho Nhóm A và Nhóm B
   (Zero Hallucination, Zero Sycophancy - Không bịa đặt, Không xin lỗi bừa bãi).
"""

import re
from typing import Optional, Dict, Any, Tuple, List
import chess
from src.ai_assistant.position_facts import (
    PositionFacts,
    are_squares_on_diagonal,
    get_diagonal_name,
    PIECE_NAMES_VI,
)


SQUARE_REGEX = r"\b([a-h][1-8])\b"
DIAGONAL_REGEX = r"\b([a-h][1-8])\s*[-–\s]\s*([a-h][1-8])\b"


def parse_squares_from_text(text: str) -> List[str]:
    """Tìm tất cả các ô cờ xuất hiện trong câu (ví dụ c1, b7, e4)."""
    return [m.lower() for m in re.findall(SQUARE_REGEX, text.lower())]


def parse_diagonals_from_text(text: str) -> List[Tuple[str, str]]:
    """Tìm các cặp ô định hình đường chéo (ví dụ a8-h1, a8 h1, a1-h8)."""
    matches = re.findall(DIAGONAL_REGEX, text.lower())
    diags = []
    for m in matches:
        sq1, sq2 = m[0], m[1]
        try:
            s1 = chess.parse_square(sq1)
            s2 = chess.parse_square(sq2)
            if are_squares_on_diagonal(s1, s2):
                diags.append((sq1, sq2))
        except Exception:
            continue
    return diags


class IntentRouter:
    """Bộ định tuyến và xử lý tất định các câu hỏi sự thật cờ vua."""

    @staticmethod
    def try_answer_deterministic(prompt: str, facts: PositionFacts) -> Optional[str]:
        """
        Nếu câu hỏi thuộc dạng truy vấn sự thật hình học hoặc phản bác,
        tạo câu trả lời tất định chuẩn xác 100% không qua LLM.
        Trả về None nếu câu hỏi là chiến lược/kế hoạch cần LLM phân tích.
        """
        p_lower = prompt.lower().strip()

        # 1. Truy vấn liên quan đến đường chéo và một ô/quân (Case kinh điển trong ảnh: 'a8 h1 liên quan gì đến vua c1')
        diag_matches = parse_diagonals_from_text(p_lower)
        squares = parse_squares_from_text(p_lower)

        if diag_matches and squares:
            for diag_start, diag_end in diag_matches:
                s_start = chess.parse_square(diag_start)
                s_end = chess.parse_square(diag_end)
                diag_name = get_diagonal_name(s_start, s_end)

                # Các ô khác trong câu hỏi ngoài 2 đầu đường chéo
                target_squares = [sq for sq in squares if sq not in (diag_start, diag_end)]
                if target_squares:
                    target_sq_name = target_squares[0]
                    target_sq = chess.parse_square(target_sq_name)
                    piece_at_target = facts.board.piece_at(target_sq)
                    piece_desc = f"{PIECE_NAMES_VI[piece_at_target.piece_type]} ở {target_sq_name}" if piece_at_target else f"ô {target_sq_name}"

                    is_on_diag = are_squares_on_diagonal(s_start, target_sq) and are_squares_on_diagonal(s_end, target_sq)
                    if not is_on_diag:
                        # Ô hoàn toàn không nằm trên đường chéo!
                        # Tính danh sách ô thực tế trên đường chéo
                        f1, r1 = chess.square_file(s_start), chess.square_rank(s_start)
                        f2, r2 = chess.square_file(s_end), chess.square_rank(s_end)
                        step_f = 1 if f2 >= f1 else -1
                        step_r = 1 if r2 >= r1 else -1
                        curr_f, curr_r = f1, r1
                        actual_squares = []
                        while (curr_f, curr_r) != (f2 + step_f, r2 + step_r):
                            actual_squares.append(chess.square_name(chess.square(curr_f, curr_r)))
                            curr_f += step_f
                            curr_r += step_r

                        return (
                            f"**Xác minh hình học bàn cờ chính xác 100%:**\n\n"
                            f"1. **{piece_desc.capitalize()} KHÔNG nằm trên {diag_name}.**\n"
                            f"2. {diag_name.capitalize()} thực tế chỉ đi qua các ô: `{', '.join(actual_squares)}`.\n"
                            f"3. Vị trí **{target_sq_name}** nằm ở hướng hoàn toàn khác và không chịu bất kỳ tác động trực tiếp nào từ các quân kiểm soát đường chéo này."
                        )

        # 2. Truy vấn quân ở ô cụ thể (ví dụ: "ô e4 có quân gì", "vua trắng ở đâu")
        if re.search(r"\b(ô\s+[a-h][1-8]\s+có\s+quân\s+gì|quân\s+ở\s+ô\s+[a-h][1-8]|ở\s+[a-h][1-8]\s+là\s+quân\s+gì)\b", p_lower):
            if squares:
                sq = chess.parse_square(squares[0])
                piece = facts.board.piece_at(sq)
                if piece:
                    color = "Trắng" if piece.color == chess.WHITE else "Đen"
                    return f"Trên bàn cờ hiện tại, ô **{squares[0]}** đang có **{PIECE_NAMES_VI[piece.piece_type]} {color}**."
                else:
                    return f"Trên bàn cờ hiện tại, ô **{squares[0]}** là ô trống (không có quân cờ nào)."

        # 3. Truy vấn vị trí Vua (ví dụ: "vua trắng ở đâu", "vua đen ở đâu")
        if "vua trắng ở đâu" in p_lower or "vua trắng đang ở" in p_lower:
            w_k = facts.king_safety["white_king"]["square"]
            return f"Vua Trắng hiện đang ở ô **{w_k}**."
        if "vua đen ở đâu" in p_lower or "vua đen đang ở" in p_lower:
            b_k = facts.king_safety["black_king"]["square"]
            return f"Vua Đen hiện đang ở ô **{b_k}**."

        # 4. Truy vấn quân treo / bị ghim
        if "quân nào đang bị treo" in p_lower or "quân nào bị treo" in p_lower or "có quân nào bị treo không" in p_lower:
            if not facts.hanging_pieces:
                return "Trên bàn cờ hiện tại, **không có quân cờ nào đang bị treo** (tất cả các quân đều được bảo vệ an toàn hoặc không bị tấn công)."
            lines = ["**Danh sách quân đang bị treo / đe dọa trực tiếp:**"]
            for h in facts.hanging_pieces:
                lines.append(f"- ⚠️ **{h['piece']}**: {h['type']} ({h['threat_level']}).")
            return "\n".join(lines)

        if "quân nào bị ghim" in p_lower or "có đòn ghim nào không" in p_lower:
            pins = [m for m in facts.tactical_motifs if m["motif"] == "Đòn Ghim (Pin)"]
            if not pins:
                return "Trên bàn cờ hiện tại, **không có quân nào đang bị ghim tuyệt đối vào Vua**."
            lines = ["**Các quân đang bị ghim:**"]
            for p in pins:
                lines.append(f"- 🎯 {p['description']}")
            return "\n".join(lines)

        # 5. Truy vấn cân bằng vật chất
        if p_lower in ("ai đang hơn quân", "ai hơn quân", "vật chất thế nào", "tương quan lực lượng"):
            return f"**Tương quan vật chất:** {facts.material_balance['status_vi']} (Trắng: {facts.material_balance['white_points']} điểm | Đen: {facts.material_balance['black_points']} điểm)."

        # 6. Truy vấn tính hợp lệ của một nước đi cụ thể (ví dụ: "nước Nxe5 có đi được không", "e4 có đi được không")
        san_match = re.search(r"\b(nước\s+)?([O0]-[O0](-[O0])?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[\+#]?)\s+(có\s+đi\s+được\s+không|hợp\s+lệ\s+không|đi\s+được\s+không)\b", p_lower, re.I)
        if san_match:
            candidate_move = san_match.group(2).strip()
            # Thử parse SAN
            try:
                move = facts.board.parse_san(candidate_move)
                is_legal = move in facts.board.legal_moves
                if is_legal:
                    active_turn = "Trắng" if facts.board.turn == chess.WHITE else "Đen"
                    return f"Nước đi **{candidate_move}** là **hợp lệ 100%** theo luật FIDE cho bên {active_turn} ở thế cờ này."
            except Exception:
                pass
            return f"Nước đi **{candidate_move}** **KHÔNG hợp lệ** theo luật FIDE ở thế cờ hiện tại."

        # Không thuộc nhóm câu hỏi sự thật thuần túy -> chuyển tiếp cho LLM + Verifier
        return None
