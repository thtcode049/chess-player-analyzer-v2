"""
Tests for Bitboard Dynamic Phase Detection & Engine Performance Optimizations
-----------------------------------------------------------------------------
Kiểm thử:
1. Nhận diện Khai cuộc, Trung cuộc, Tàn cuộc Động (Bitboard & Material-based Dynamic Phase Detection).
2. Tính toán Tỷ lệ Chính xác theo Giai đoạn (Phase Accuracy % = 100 * exp(-0.005 * ACPL)).
3. Bộ tăng tốc Engine: FEN Transposition Caching & Chaining Evaluation.
4. Xử lý an toàn khi thiếu dữ liệu hoặc giá trị None.
"""

import math
import pytest
import chess

from src.analysis.phase_analysis import (
    count_material_non_pawns,
    minor_pieces_developed,
    classify_phase,
    calculate_phase_accuracy,
    analyze_phase_performance
)
from src.engine.stockfish_engine import StockfishEngine
from src.engine.evaluator import analyze_game_moves, batch_analyze_games
from src.player_profile import analyze_opening_repertoire, generate_deep_opponent_profile
from src.analysis.pawn_structure import analyze_structural_performance


# ------------------------------------------------------------------------------
# 1. PHASE ACCURACY FORMULA TESTS
# ------------------------------------------------------------------------------
def test_calculate_phase_accuracy_values():
    # ACPL = 0 -> 100.0%
    assert calculate_phase_accuracy(0.0) == 100.0
    assert calculate_phase_accuracy(-10.0) == 100.0

    # ACPL = 20 -> 100 * exp(-0.005 * 20) = 100 * exp(-0.1) = 90.4837... -> 90.5%
    assert calculate_phase_accuracy(20.0) == 90.5

    # ACPL = 28 -> 100 * exp(-0.005 * 28) = 100 * exp(-0.14) = 86.9358... -> 86.9%
    assert calculate_phase_accuracy(28.0) == 86.9

    # ACPL = 40 -> 100 * exp(-0.005 * 40) = 100 * exp(-0.2) = 81.873... -> 81.9%
    assert calculate_phase_accuracy(40.0) == 81.9

    # ACPL = 100 -> 100 * exp(-0.5) = 60.653... -> 60.7%
    assert calculate_phase_accuracy(100.0) == 60.7

    # None input -> None output
    assert calculate_phase_accuracy(None) is None


# ------------------------------------------------------------------------------
# 2. BITBOARD DYNAMIC PHASE DETECTION TESTS
# ------------------------------------------------------------------------------
def test_count_material_non_pawns():
    board = chess.Board()
    # Starting position: 1 Queen (9), 2 Rooks (10), 2 Bishops (6), 2 Knights (6) = 31 points per side
    assert count_material_non_pawns(board, chess.WHITE) == 31
    assert count_material_non_pawns(board, chess.BLACK) == 31


def test_minor_pieces_developed_bitboards():
    board = chess.Board()
    # Starting board: Knights on b1/g1, Bishops on c1/f1 -> not developed
    assert not minor_pieces_developed(board, chess.WHITE)
    assert not minor_pieces_developed(board, chess.BLACK)

    # Move white pieces off back rank
    board.set_fen("rnbqkbnr/pppppppp/8/8/8/2N2N2/PPPPPPPP/R1BQKB1R b KQkq - 0 1")
    # Still has bishops on c1 and f1
    assert not minor_pieces_developed(board, chess.WHITE)

    # Move white bishops off back rank too (all minor pieces off rank 1)
    board.set_fen("rnbqkbnr/pppppppp/8/4B3/3B4/2N2N2/PPPPPPPP/R2QK2R b KQkq - 0 1")
    assert minor_pieces_developed(board, chess.WHITE)
    assert not minor_pieces_developed(board, chess.BLACK)


def test_classify_phase_dynamic_scenarios():
    # Scenario A: Starting board, move 2 -> Opening
    board_start = chess.Board()
    assert classify_phase(board_start, 2) == "opening"

    # Scenario B: Move 10, both sides developed all minor pieces -> Middlegame
    board_mid = chess.Board("r2q1rk1/ppp2ppp/2n1bn2/3pp3/3PP3/2N1BN2/PPP2PPP/R2Q1RK1 w - - 0 10")
    assert classify_phase(board_mid, 10) == "middlegame"

    # Scenario C: Early Queen trade & piece exchanges at move 10 -> Endgame
    board_early_endgame = chess.Board("4k3/ppp2ppp/5n2/8/8/8/PPP2PPP/4K2R w K - 0 10")
    assert classify_phase(board_early_endgame, 10) == "endgame"

    # Scenario D: Move 35, Closed position with Queens and Rooks still alive -> Middlegame
    board_late_mid = chess.Board("r4rk1/1ppq1pbp/p2p1np1/4p3/4P3/P2P1NP1/1PPQ1PBP/R4RK1 w - - 0 35")
    assert classify_phase(board_late_mid, 35) == "middlegame"

    # Scenario E: Move 18, player hasn't moved c8 bishop -> Fallback to Middlegame (move > 15)
    board_stubborn = chess.Board("r1bqk2r/pppp1ppp/2n2n2/4p3/1b2P3/2NP1N2/PPP1BPPP/R1BQK2R w KQkq - 0 18")
    assert classify_phase(board_stubborn, 18) == "middlegame"


def test_analyze_phase_performance_accuracy():
    move_evals = [
        # Opening move: cpl = 15.0
        {"fen_before": chess.STARTING_FEN, "move_number": 2, "cpl": 15.0, "game_index": 0},
        # Middlegame move: cpl = 28.0 (with developed board)
        {"fen_before": "r2q1rk1/ppp2ppp/2n1bn2/3pp3/3PP3/2N1BN2/PPP2PPP/R2Q1RK1 w - - 0 10", "move_number": 10, "cpl": 28.0, "game_index": 0},
        # Endgame move: cpl = 40.0 (with low material)
        {"fen_before": "4k3/ppp2ppp/5n2/8/8/8/PPP2PPP/4K2R w K - 0 10", "move_number": 10, "cpl": 40.0, "game_index": 0}
    ]

    res = analyze_phase_performance([], move_evaluations=move_evals, lang="vi")
    phases = res["phases"]

    # Opening: avg_acpl = 15.0 -> accuracy = 100 * exp(-0.005 * 15) = 92.8%
    assert phases["opening"]["avg_acpl"] == 15.0
    assert phases["opening"]["accuracy"] == 92.8

    # Middlegame: avg_cpl = 28.0 -> accuracy = 100 * exp(-0.005 * 28) = 86.9%
    assert phases["middlegame"]["avg_acpl"] == 28.0
    assert phases["middlegame"]["accuracy"] == 86.9

    # Endgame: avg_cpl = 40.0 -> accuracy = 100 * exp(-0.005 * 40) = 81.9%
    assert phases["endgame"]["avg_acpl"] == 40.0
    assert phases["endgame"]["accuracy"] == 81.9


# ------------------------------------------------------------------------------
# 3. ENGINE BATCH EVALUATOR TESTS
# ------------------------------------------------------------------------------
def test_batch_analyze_games_fast():
    engine = StockfishEngine()
    if engine.is_available():
        games = [
            {"moves": ["e4", "e5", "Nf3", "Nc6"], "player_color": "white", "opening": "King Pawn"},
            {"moves": ["d4", "d5", "c4", "e6"], "player_color": "black", "opening": "Queen Gambit"}
        ]
        res = batch_analyze_games(games, engine, max_games=10, depth=6)
        assert res["available"] is True
        assert res["analyzed_games"] == 2
        assert games[0]["game_acpl"] is not None
        assert games[1]["game_acpl"] is not None
