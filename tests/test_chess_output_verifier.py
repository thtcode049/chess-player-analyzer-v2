import chess
import pytest

from src.ai_assistant.context_builder import build_player_ai_context
from src.ai_assistant.gemini_client import _prepare_gemini_payload
from src.ai_assistant.verifier import ChessOutputVerifier, VERIFICATION_NOTICE


@pytest.mark.parametrize("tag", [
    "⟦quân:Bb7⟧",  # Wrong color.
    "⟦quân:nb7⟧",  # Wrong piece.
    "⟦quân:ba4⟧",  # Empty square.
    "⟦quân:bi9⟧",
    "⟦qh:nb7>c6⟧",  # Wrong source piece despite a controlled square.
    "⟦qh:bb7>e4⟧",  # Blocked ray.
    "⟦qh:bb7>c1⟧",
    "⟦qh:bb7>⟧",
    "⟦nước:Qh5⟧",
    "⟦nước:--⟧",
    "⟦biến:Kd2 Qh4⟧",
    "⟦khác:b7⟧",
    "⟦quân:bb7",
])
def test_rejected_claim_is_never_emitted(tag):
    board = chess.Board("4k3/1b6/8/3p4/8/8/8/4K3 w - - 0 1")
    chunks = ChessOutputVerifier.verify_stream(["Nhận định " + tag], board)
    assert "".join(chunks).strip() == VERIFICATION_NOTICE


def test_stream_waits_for_a_complete_line_and_preserves_markdown():
    board = chess.Board("4k3/1b6/8/3p4/8/8/8/4K3 w - - 0 1")

    def model_chunks():
        yield "## Thế cờ\n\n- ⟦qu"
        yield "ân:bb7⟧ đứng trên đường chéo.\n- ⟦qh:bb7>"
        yield "c6⟧. {{G1}}\n"
        yield "[OPEN_BOARD]"

    checked = ChessOutputVerifier.verify_stream(model_chunks(), board)
    assert next(checked) == "## Thế cờ\n"
    assert next(checked) == "\n"
    assert next(checked) == "- **Tượng Đen b7** đứng trên đường chéo.\n"
    assert next(checked) == "- **Tượng Đen b7** khống chế **ô c6**. {{G1}}\n"
    assert list(checked) == ["[OPEN_BOARD]"]


def test_variations_replay_both_sides_and_restart_from_the_original_position():
    board = chess.Board()
    board.push_san("e4")
    original_fen = board.fen()
    text = (
        "⟦biến:c5 Nf3 d6⟧ hoặc ⟦biến:e5 Nf3 Nc6⟧.\n"
        "⟦nước:c5+⟧\n"
        "⟦biến:c5 Nf3 Qh4⟧\n"
        "⟦nước:e5⟧"
    )
    output = "".join(ChessOutputVerifier.verify_stream([text], board))
    assert "**1... c5 2. Nf3 d6** hoặc **1... e5 2. Nf3 Nc6**." in output
    assert "**e5**" in output
    assert "c5+" not in output and "Qh4" not in output
    assert VERIFICATION_NOTICE in output
    assert board.fen() == original_fen


@pytest.mark.parametrize("fen, san", [
    ("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "O-O"),
    ("7k/P7/8/8/8/8/8/7K w - - 0 1", "a8=Q+"),
    ("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "exd6"),
])
def test_san_special_moves(fen, san):
    chunks = ChessOutputVerifier.verify_stream([f"⟦nước:{san}⟧"], chess.Board(fen))
    assert "".join(chunks) == f"**{san}**"


def test_pawn_skeleton_only_supports_placement_and_control():
    board = chess.Board("8/8/8/8/8/8/4P3/8 w - - 0 1")
    text = "⟦qh:Pe2>d3⟧.\n⟦nước:e4⟧"
    output = "".join(ChessOutputVerifier.verify_stream([text], board))
    assert "**Tốt Trắng e2** khống chế **ô d3**." in output
    assert "e4" not in output
    assert VERIFICATION_NOTICE in output


def test_other_positions_and_profile_evidence_are_left_intact():
    original = "Khai cuộc Anh 1. c4 e5.\nDẫn ván {{G1}}.\n[OPEN_BOARD]"
    assert "".join(ChessOutputVerifier.verify_stream([original], None)) == original
    assert "".join(ChessOutputVerifier.verify_stream([original], chess.Board())) == original
    tagged = "⟦quân:Ke1⟧"
    assert "".join(ChessOutputVerifier.verify_stream([tagged], None)).strip() == VERIFICATION_NOTICE


def test_prompt_uses_tags_only_for_the_interactive_position():
    context = build_player_ai_context({}, {}, current_fen=chess.STARTING_FEN)
    assert chess.STARTING_FEN in context
    assert "BẢNG SỰ THẬT THẾ CỜ" in context
    assert "BẢNG SỰ THẬT THẾ CỜ" not in build_player_ai_context({}, {}, current_fen="bad FEN")

    plain = _prepare_gemini_payload("Phân tích ván đấu", context, [])
    verified = _prepare_gemini_payload("Phân tích thế cờ", context, [], verify_current_position=True)
    assert "⟦nước:Nf3⟧" not in plain["contents"][0]["parts"][0]["text"]
    assert "⟦nước:Nf3⟧" in verified["contents"][0]["parts"][0]["text"]
