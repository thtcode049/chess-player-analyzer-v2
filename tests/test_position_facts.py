import pytest
import chess
from src.ai_assistant.position_facts import (
    PositionFacts,
    are_squares_on_diagonal,
    get_diagonal_name,
)


def test_diagonal_geometry_and_screenshot_case():
    """
    Tái hiện chính xác tình huống trong ảnh:
    Tượng Đen ở b7, Vua Trắng ở c1.
    Kiểm tra: Ô c1 KHÔNG nằm trên đường chéo a8–h1!
    """
    b7 = chess.parse_square("b7")
    c1 = chess.parse_square("c1")
    assert not are_squares_on_diagonal(b7, c1)

    # Đường chéo a8–h1
    a8 = chess.parse_square("a8")
    h1 = chess.parse_square("h1")
    assert are_squares_on_diagonal(a8, h1)
    assert are_squares_on_diagonal(b7, h1)

    diag_name = get_diagonal_name(a8, h1)
    assert "a8–h1" in diag_name or "a8-h1" in diag_name

    # Thế cờ thử nghiệm có Bb7 và Kc1
    # Trắng: Kc1, pawn e4
    # Đen: Bb7, Kg8
    fen = "r2q1rk1/1b2bppp/p1n1pn2/1p1p4/3PP3/2N2N2/PPB2PPP/2RQK2R w K - 0 12"
    # Sửa cho Vua Trắng ở c1
    fen_with_kc1 = "r2q1rk1/1b2bppp/p1n1pn2/1p1p4/3PP3/2N2N2/PPB2PPP/2KR3R b - - 1 12"
    facts = PositionFacts(fen_with_kc1)

    # Kiểm tra Vua Trắng ở c1
    assert "c1" in facts.white_pieces["K"]
    # Kiểm tra Tượng Đen ở b7
    assert "b7" in facts.black_pieces["B"]

    # Kiểm tra tia của Tượng b7
    b7_rays = [r for r in facts.sliding_rays if r["square"] == "b7"]
    assert len(b7_rays) > 0

    # Khẳng định không có tia nào của Tượng b7 kiểm soát ô c1
    all_controlled_by_b7 = []
    for r in b7_rays:
        all_controlled_by_b7.extend(r["controlled_squares"])
    assert "c1" not in all_controlled_by_b7

    markdown = facts.generate_factsheet_markdown()
    assert "c1" in markdown
    assert "b7" in markdown


def test_tactical_motifs_and_combinations():
    # Thế cờ có đòn ghim và quân treo
    # Đen có Vua e8, Xe e4 bị ghim vào Vua bởi Xe Trắng e1
    fen = "4k3/8/8/8/4r3/8/8/4R1K1 b - - 0 1"
    facts = PositionFacts(fen)

    # Xe Đen e4 phải bị ghim tuyệt đối
    motifs = facts.tactical_motifs
    pin_motifs = [m for m in motifs if m["motif"] == "Đòn Ghim (Pin)"]
    assert len(pin_motifs) >= 1
    assert "e4" in pin_motifs[0]["square"]

    # Test dynamic combination detection
    eval_dict = {
        "score": 600,
        "isMate": False,
        "pv": ["e1e4", "e8f7", "e4e7"]
    }
    facts_combo = PositionFacts(fen, engine_eval=eval_dict)
    assert facts_combo.combination is not None
    assert "pv_san" in facts_combo.combination
