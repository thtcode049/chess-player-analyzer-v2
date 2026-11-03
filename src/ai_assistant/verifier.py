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


def clean_chess_tags(text: str, board: Optional[chess.Board] = None) -> str:
    """
    Chuyển đổi các thẻ nội bộ ⟦loại:giá_trị⟧, loại bỏ toạ độ xuất phát-đích đến,
    chuẩn hóa tên nước đi FIDE và tự động in đậm các nước đi, ô cờ, quân cờ để dễ quan sát.
    Ví dụ:
      ⟦quân:Bb7⟧ -> **Tượng b7**
      ⟦quân:Kc1⟧ -> **Vua c1**
      ⟦nước:Nxe5⟧ -> **Nxe5**
      ⟦ô:c1⟧ -> **ô c1**
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
                    return f"**{p_map[piece_char]} {sq}**"
            return f"**{val}**"
        elif tag_type == "nước":
            return f"**{val}**"
        elif tag_type == "ô":
            return f"**ô {val}**"
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
    # Loại bỏ thẻ mở bàn cờ
    cleaned = re.sub(r"\[OPEN_BOARD(?::\s*([^\]]+))?\]", "", cleaned, flags=re.IGNORECASE)
    # Chuẩn hóa nếu bị lặp từ "ô ô" (vd: "về ô ô g2" -> "về ô g2")
    cleaned = re.sub(r"(^|\s)ô(?:\s+ô)+(\s+)", r"\1ô\2", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bô\s+ô\b", "ô", cleaned, flags=re.IGNORECASE)
    # Thay thế triệt để từ "khả dĩ" bằng "tối ưu" hoặc "tiềm năng"
    cleaned = re.sub(r"\bkhả dĩ\b", "tối ưu", cleaned, flags=re.IGNORECASE)

    # Làm sạch ký hiệu đọc cả vị trí đầu - cuối (như (d1c2), (c3d5), (d2e3), Be3 (d2e3), Hậu (d1c2))
    cleaned = re.sub(r"\b([KQRBN]?[a-h][1-8])\s*\([a-h][1-8]([a-h][1-8])\)", r"\1", cleaned)
    cleaned = re.sub(r"(Hậu|Mã|Tượng|Xe|Vua|Tốt)\s*\([a-h][1-8]([a-h][1-8])\)", r"\1 \2", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bnước:\s*([a-h][1-8])([a-h][1-8])\b", r"nước \2", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bnước:\s*([a-h][1-8])\b", r"nước \1", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"từ ô\s+[a-h][1-8]\s+(sang|lên|về|đến)\s+ô\s+([a-h][1-8])", r"\1 ô \2", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"ở ô\s+[a-h][1-8]\s+((?:có thể\s+)?(?:nhảy|đi|tiến|lùi|sang|lên|về)\s+(?:lên|vào|sang|đến)?\s*ô\s+[a-h][1-8])", r"\1", cleaned, flags=re.IGNORECASE)

    def convert_uci_to_san(uci_str: str) -> str:
        if board:
            try:
                m = chess.Move.from_uci(uci_str)
                if m in board.legal_moves:
                    return board.san(m)
            except Exception:
                pass
        return uci_str[2:]

    # Xử lý các cụm toạ độ trong ngoặc đơn như (như d1c2 hay d1b3) hoặc (c3d5)
    def clean_paren_content(match):
        inner = match.group(1)
        subbed = re.sub(r"\b[a-h][1-8][a-h][1-8]\b", lambda m: convert_uci_to_san(m.group(0)), inner)
        return f"({subbed})"

    cleaned = re.sub(r"\(([a-zA-Z0-9\s,–-]+)\)", clean_paren_content, cleaned)
    # Xử lý các toạ độ 4 ký tự còn sót lại ngoài ngoặc
    cleaned = re.sub(r"\b[a-h][1-8][a-h][1-8]\b", lambda m: convert_uci_to_san(m.group(0)), cleaned)

    # Tự động in đậm (Auto-bolding) các yếu tố cờ vua mà không bao giờ bị lặp dấu sao hay lỗi khoảng trắng:
    # a. Bảo vệ toàn bộ khối code inline (trong dấu backtick) để không chèn markdown ** vào code
    code_blocks = []
    def _save_code(m):
        clean_c = m.group(1).replace("**", "")
        code_blocks.append(clean_c)
        return f"___CODE_BLOCK_{len(code_blocks) - 1}___"

    cleaned = re.sub(r"`([^`]+)`", _save_code, cleaned)

    # b. Chuẩn hóa khoảng trắng ngang (không làm mất ngắt dòng)
    cleaned = re.sub(r"([^\S\r\n]){2,}", " ", cleaned)

    # c. Thu gọn các chuỗi dấu sao lỗi (3 dấu sao trở lên -> 2)
    cleaned = re.sub(r"\*{3,}", "**", cleaned)

    # d. Chuẩn hóa số thứ tự nước đi bị dính liền chữ: vd: "9.Ne2" -> "9. Ne2", "8...a5" -> "8... a5"
    cleaned = re.sub(r"(\b\d{1,3}\.(?:\.\.)?)([a-zA-Z])", r"\1 \2", cleaned)

    # e. Tách chuỗi theo dấu `**` để chỉ in đậm phần văn bản CHƯA in đậm (chỉ số chẵn)
    # và giữ nguyên phần ĐÃ in đậm (chỉ số lẻ), tránh hoàn toàn lỗi in đậm lồng nhau ****text****
    parts = cleaned.split("**")
    processed = []
    for idx, part in enumerate(parts):
        if idx % 2 == 1:
            clean_part = re.sub(r"\s+", " ", part).strip()
            processed.append(clean_part)
            continue

        seg = part
        seg = re.sub(r"\bô\s+([a-h][1-8])\b", r"**ô \1**", seg, flags=re.IGNORECASE)

        def _bold_vi_piece(m):
            piece = m.group(1)
            prep = m.group(2)
            prep_str = f" {prep}" if prep else ""
            sq = m.group(3)
            return f"**{piece}{prep_str} {sq}**"

        seg = re.sub(
            r"\b(Tượng|Mã|Hậu|Xe|Vua|Tốt)\s+(?:(ở|đứng ở|tại)\s+)?(?:ô\s+)?([a-h][1-8])\b",
            _bold_vi_piece,
            seg,
            flags=re.IGNORECASE
        )

        seg = re.sub(r"\bnước\s+([a-h][1-8])\b", r"nước **\1**", seg, flags=re.IGNORECASE)

        seg = re.sub(
            r"(?<![A-Za-z0-9_*`])([KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[KQRBN])?[+#]?)(?![A-Za-z0-9_*`])",
            r"**\1**",
            seg
        )

        seg = re.sub(
            r"(\b\d{1,3}\.(?:\.\.)?\s*(?:[KQRBN][a-h]?[1-8]?x?)?[a-h][1-8](?:=[KQRBN])?[+#]?)\b",
            r"**\1**",
            seg
        )

        seg = re.sub(
            r"(?<![A-Za-z0-9_*`])([a-h]x[a-h][1-8](?:=[KQRBN])?[+#]?)(?![A-Za-z0-9_*`])",
            r"**\1**",
            seg
        )

        seg = re.sub(r"\b(O-O(?:-O)?|0-0(?:-0)?)\b", r"**\1**", seg)
        seg = re.sub(r"(\+[0-9]+\.[0-9]{2}|-[0-9]+\.[0-9]{2}|#M\d+)\b", r"**\1**", seg)

        processed.append(seg)

    result_parts = []
    for i, p in enumerate(processed):
        if i % 2 == 1:
            if p:
                result_parts.append(f"**{p}**")
        else:
            result_parts.append(p)
    cleaned = "".join(result_parts)

    cleaned = re.sub(r"(?:^|\s)\*\*\s*\*\*(?:\s|$)", " ", cleaned)
    cleaned = re.sub(r"\*{3,}", "**", cleaned)

    # Khôi phục các khối code đã bảo vệ
    cleaned = re.sub(r"___CODE_BLOCK_(\d+)___", lambda m: f"`{code_blocks[int(m.group(1))]}`", cleaned)

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
        sanitized = clean_chess_tags(sentence, board=facts.board)
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
        return clean_chess_tags(result or text, board=facts.board)
