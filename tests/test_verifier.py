import pytest
import chess
from src.ai_assistant.position_facts import PositionFacts
from src.ai_assistant.verifier import ChessOutputVerifier, clean_chess_tags


def test_tag_cleaning():
    text = "Trắng có thể phát triển ⟦quân:Nf3⟧ và nhắm vào ⟦ô:e5⟧ để đạt ⟦đg:ưu thế nhẹ⟧."
    cleaned = clean_chess_tags(text)
    assert "⟦" not in cleaned
    assert "Mã f3" in cleaned
    assert "ô e5" in cleaned
    assert "ưu thế nhẹ" in cleaned


def test_verifier_catches_false_claim_screenshot():
    # Thế cờ: Vua Trắng ở c1, Tượng Đen ở b7
    fen = "r2q1rk1/1b2bppp/p1n1pn2/1p1p4/3PP3/2N2N2/PPB2PPP/2KR3R b - - 1 12"
    facts = PositionFacts(fen)

    # Câu sai 1: Dùng thẻ qh:Bb7>c1
    bad_sentence_1 = "Đen có đòn nguy hiểm với ⟦qh:Bb7>c1⟧ nhắm thẳng vào Vua Trắng."
    is_valid, _, reason = ChessOutputVerifier.verify_sentence(bad_sentence_1, facts)
    assert not is_valid
    assert "không cùng đường chéo" in reason or "không chiếu tới" in reason

    # Câu sai 2: Không dùng thẻ, câu văn tự nhiên: 'Tượng ở b7 tấn công thẳng vào Vua ở c1'
    bad_sentence_2 = "Tượng ở b7 tấn công thẳng vào Vua ở c1 làm Trắng lâm nguy."
    is_valid_2, _, reason_2 = ChessOutputVerifier.verify_sentence(bad_sentence_2, facts)
    assert not is_valid_2
    assert "Tượng b7 không thể tấn công ô c1" in reason_2

    # Câu đúng: 'Tượng ở b7 kiểm soát đường chéo b7-h1'
    good_sentence = "Tượng ở b7 kiểm soát đường chéo hướng về cánh Vua."
    is_valid_3, sanitized_3, _ = ChessOutputVerifier.verify_sentence(good_sentence, facts)
    assert is_valid_3
    assert "Tượng ở b7" in sanitized_3

    # Toàn bộ đoạn văn có câu sai bị loại bỏ
    full_text = "Thế cờ đang diễn ra giằng co. Tượng ở b7 tấn công thẳng vào Vua ở c1. Trắng nên củng cố phòng thủ."
    verified_full = ChessOutputVerifier.verify_and_clean_full_text(full_text, facts)
    assert "Tượng ở b7 tấn công thẳng vào Vua ở c1" not in verified_full
    assert "Thế cờ đang diễn ra giằng co" in verified_full
    assert "Trắng nên củng cố phòng thủ" in verified_full
