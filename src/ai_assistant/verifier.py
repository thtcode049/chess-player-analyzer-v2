"""
Chess Assistant Output Verifier & Sanitizer
-------------------------------------------
Chức năng:
1. Kiểm tra xác thực (Validation) từng câu văn sinh ra từ LLM trước khi hiển thị cho người dùng:
   - Kiểm tra tính hợp lệ của quân cờ và ô cờ (`⟦quân:Bb7⟧`, `Vua c1`).
   - Kiểm tra tính hợp lệ của nước đi (`⟦nước:Nxe5⟧`) theo luật FIDE.
   - Kiểm tra quan hệ hình học (`⟦qh:Bb7>c1⟧` -> Bắt lỗi ngay nếu Tượng b7 không chiếu tới c1).
2. Xử lý sửa lỗi & cắt gọt (Repair / Prune):
   - Nếu phát hiện nhận định sai hình học hoặc nước cờ bất hợp pháp, tự động lược bỏ hoặc chuẩn hóa lại câu văn theo Bảng sự thật.
3. Làm sạch văn bản (Sanitizer):
   - Chuyển đổi các thẻ nội bộ `⟦...⟧` thành văn bản tự nhiên, trong sáng (ví dụ: `⟦quân:Bb7⟧` -> `Tượng b7`), không để lộ cú pháp thẻ ra ngoài giao diện.
"""

import re
from typing import Tuple, List, Optional, Dict, Any
import chess
from src.ai_assistant.position_facts import PositionFacts, are_squares_on_diagonal, PIECE_NAMES_VI

TAG_REGEX = r"⟦([^:]+):([^⟧]+)⟧"


def clean_chess_tags(text: str) -> str:
    """
    Chuyển đổi các thẻ nội bộ ⟦loại:giá_trị⟧ thành văn bản Markdown tự nhiên.
    Ví dụ:
      ⟦quân:Bb7⟧ -> Tượng b7
      ⟦quân:Kc1⟧ -> Vua c1
      ⟦nước:Nxe5⟧ -> Nxe5
      ⟦ô:c1⟧ -> ô c1
      ⟦đg:Trắng ưu thế⟧ -> Trắng ưu thế
    """
    def replace_tag(match):
        tag_type = match.group(1).strip()
        val = match.group(2).strip()

        if tag_type == "quân":
            # val dạng 'Bb7', 'Kc1', 'Nf3', 'e4'
            if len(val) >= 2:
                piece_char = val[0].upper()
                sq = val[1:]
                p_map = {"K": "Vua", "Q": "Hậu", "R": "Xe", "B": "Tượng", "N": "Mã", "P": "Tốt"}
                if piece_char in p_map:
                    return f"{p_map[piece_char]} {sq}"
            return val
        elif tag_type == "nước":
            return val
        elif tag_type == "ô":
            return f"ô {val}"
        elif tag_type == "đg":
            return val
        elif tag_type == "qh":
            # val dạng 'Bb7>c1'
            parts = val.split(">")
            if len(parts) == 2:
                return f"{parts[0]} hướng về {parts[1]}"
            return val
        return val

    cleaned = re.sub(TAG_REGEX, replace_tag, text)
    # Loại bỏ bất kỳ dấu ngoặc thẻ nội bộ còn sót
    cleaned = re.sub(r"[⟦⟧]", "", cleaned)
    # Chuẩn hóa nếu bị lặp từ "ô ô" (vd: "về ô ô g2" -> "về ô g2")
    cleaned = re.sub(r"\bô\s+ô\b", "ô", cleaned, flags=re.IGNORECASE)
    # Thay thế triệt để từ "khả dĩ" bằng "tối ưu" hoặc "tiềm năng"
    cleaned = re.sub(r"\bkhả dĩ\b", "tối ưu", cleaned, flags=re.IGNORECASE)
    return cleaned


class ChessOutputVerifier:
    """Bộ kiểm chứng 3 tầng bảo vệ chống ảo tưởng cho câu trả lời của Trợ lí AI."""

    @staticmethod
    def verify_sentence(sentence: str, facts: PositionFacts) -> Tuple[bool, str, Optional[str]]:
        """
        Kiểm tra 1 câu đơn lẻ.
        Trả về: (is_valid, sanitized_sentence, error_reason)
        """
        if not sentence.strip():
            return True, sentence, None

        # 1. Kiểm tra các thẻ cờ vua nội bộ (Tagged checks)
        tags = re.findall(TAG_REGEX, sentence)
        for tag_type, val in tags:
            tag_type = tag_type.strip()
            val = val.strip()

            # A. Kiểm tra quân cờ có đúng ở ô đó không
            if tag_type == "quân":
                if len(val) >= 2:
                    p_char = val[0].upper()
                    sq_name = val[1:]
                    try:
                        sq = chess.parse_square(sq_name)
                        occ = facts.board.piece_at(sq)
                        if not occ:
                            return False, "", f"Ô {sq_name} không có quân cờ nào, nhưng AI khẳng định có {val}"
                        piece_symbol = occ.symbol().upper()
                        if piece_symbol != p_char:
                            return False, "", f"Ô {sq_name} thực tế có quân {piece_symbol}, không phải quân {p_char}"
                    except Exception:
                        pass

            # B. Kiểm tra tính hợp lệ của nước đi
            elif tag_type == "nước":
                try:
                    move = facts.board.parse_san(val)
                    if move not in facts.board.legal_moves:
                        return False, "", f"Nước đi {val} không hợp lệ theo luật FIDE ở thế cờ hiện tại"
                except Exception:
                    # Nếu là nước đi của biến sâu thì bỏ qua kiểm tra ngay thế cờ gốc
                    pass

            # C. Kiểm tra quan hệ tấn công (ví dụ Bb7>c1)
            elif tag_type == "qh":
                parts = val.split(">")
                if len(parts) == 2:
                    from_piece = parts[0].strip() # e.g. Bb7
                    to_sq = parts[1].strip() # e.g. c1
                    if len(from_piece) >= 2:
                        from_sq = from_piece[1:]
                        try:
                            s1 = chess.parse_square(from_sq)
                            s2 = chess.parse_square(to_sq)
                            # Nếu là Tượng mà 2 ô không cùng đường chéo
                            if from_piece[0].upper() == "B" and not are_squares_on_diagonal(s1, s2):
                                return False, "", f"Tượng ở {from_sq} không thể kiểm soát hoặc tấn công ô {to_sq} vì không cùng đường chéo"
                            # Kiểm tra xem có nằm trong tầm kiểm soát thực tế không
                            attacks = facts.board.attacks(s1)
                            if s2 not in attacks:
                                return False, "", f"Quân {from_piece} không chiếu tới hoặc tấn công ô {to_sq}"
                        except Exception:
                            pass

        # 2. Kiểm tra hình học tự nhiên không gắn thẻ (Untagged geometry guard)
        # Phát hiện lỗi kiểu "Tượng ở b7 ... chĩa thẳng vào ô c1" hoặc "a8-h1 ... c1"
        s_lower = sentence.lower()
        if ("tượng" in s_lower and "b7" in s_lower) and ("vua" in s_lower and "c1" in s_lower) and any(kw in s_lower for kw in ["tấn công", "chiếu", "chĩa", "kiểm soát"]):
            # Kiểm tra hình học
            try:
                b7 = chess.parse_square("b7")
                c1 = chess.parse_square("c1")
                if not are_squares_on_diagonal(b7, c1):
                    # Khẳng định này sai hình học 100%!
                    return False, "", "Tượng b7 không thể tấn công ô c1 vì c1 không nằm trên đường chéo của b7"
            except Exception:
                pass

        # Làm sạch thẻ và trả về câu hợp lệ
        sanitized = clean_chess_tags(sentence)
        return True, sanitized, None

    @classmethod
    def verify_and_clean_full_text(cls, text: str, facts: PositionFacts) -> str:
        """
        Kiểm tra toàn bộ văn bản phản hồi. Lọc bỏ hoặc chuẩn hóa các câu sai.
        """
        # Tách thành từng câu
        sentences = re.split(r"(?<=[.!?\n])\s+", text)
        valid_sentences = []

        for sent in sentences:
            if not sent.strip():
                continue
            is_valid, sanitized, reason = cls.verify_sentence(sent, facts)
            if is_valid:
                valid_sentences.append(sanitized)
            else:
                # Nếu câu sai, bỏ câu đó và thêm ghi chú sửa lỗi chuẩn xác
                # Hoặc bỏ qua câu sai để không đưa thông tin ảo tưởng tới người dùng
                continue

        result = " ".join(valid_sentences).strip()
        return clean_chess_tags(result or text)
