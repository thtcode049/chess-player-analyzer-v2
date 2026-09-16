"""
Unit Tests for Stockfish Engine Integration & Config
---------------------------------------------------
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import chess
from src.engine.engine_config import find_stockfish_executable, ENGINE_DEPTH
from src.engine.stockfish_engine import StockfishEngine, normalize_score


def test_engine_config():
    assert isinstance(ENGINE_DEPTH, int) and ENGINE_DEPTH > 0
    # Executable path finding should return str or None without throwing
    exe_path = find_stockfish_executable()
    assert exe_path is None or isinstance(exe_path, str)


def test_normalize_score():
    # Test cp score
    class DummyCpScore:
        def is_mate(self):
            return False
        @property
        def relative(self):
            class Rel:
                def score(self, mate_score=1000):
                    return 150
            return Rel()

    norm = normalize_score(DummyCpScore())
    assert norm["cp"] == 150.0
    assert not norm["is_mate"]

    # Test mate score
    class DummyMateScore:
        def is_mate(self):
            return True
        @property
        def relative(self):
            class Rel:
                def mate(self):
                    return 3
            return Rel()

    norm_mate = normalize_score(DummyMateScore())
    assert norm_mate["cp"] == 1000.0
    assert norm_mate["is_mate"]
    assert norm_mate["mate_in"] == 3


def test_stockfish_engine_wrapper_graceful():
    # Test initialization with invalid path gracefully handles without crashing
    engine = StockfishEngine(path="/invalid/path/to/stockfish")
    assert not engine.is_available()
    
    eval_res = engine.evaluate_position(chess.STARTING_FEN)
    assert not eval_res["available"]
    assert eval_res["opponent_eval"] == 0.0

    engine.close()


def test_parse_pgn_embedded_evals():
    from src.pgn_parser import parse_pgn
    pgn_text = """[Event "Live Chess"]
[Site "https://lichess.org/test1234"]
[White "PlayerA"]
[Black "PlayerB"]
[Result "1-0"]

1. e4 { [%eval 0.25] [%clk 0:03:00] } 1... e5 { [%eval 0.18] } 2. Nf3 { [%eval 0.35] } 2... Nc6 { [%eval -1.50] } 1-0
"""
    games = parse_pgn(pgn_text)
    assert len(games) == 1
    g = games[0]
    assert g["has_evals"] is True
    assert len(g["evals"]) == 4
    assert g["evals"][0]["eval_white"] == 0.25
    assert g["evals"][3]["eval_white"] == -1.50


def test_extract_all_embedded_evaluations():
    from src.engine.evaluator import extract_all_embedded_evaluations
    games = [
        {
            "white": "PlayerA",
            "black": "PlayerB",
            "result": "1-0",
            "player_color": "white",
            "moves": ["e4", "e5", "Nf3", "Nc6"],
            "has_evals": True,
            "evals": [
                {"eval_white": 0.25, "cp": 25},
                {"eval_white": 0.20, "cp": 20},
                {"eval_white": 0.35, "cp": 35},
                {"eval_white": 1.50, "cp": 150},
            ]
        }
    ]

    res = extract_all_embedded_evaluations(games)
    assert res["available"] is True
    assert res["source"] == "embedded_pgn"
    assert res["analyzed_games"] == 1
    assert res["total_moves_analyzed"] == 2
    assert res["overall_acpl"] is not None
    assert len(res["move_evaluations"]) == 2


def test_get_comprehensive_move_evaluations_priority():
    from src.engine.evaluator import get_comprehensive_move_evaluations
    # When embedded evals exist, it uses them directly without local engine
    games = [
        {
            "white": "Hero",
            "black": "Rival",
            "result": "1-0",
            "player_color": "white",
            "moves": ["e4", "c5", "Nf3"],
            "has_evals": True,
            "evals": [
                {"eval_white": 0.25, "cp": 25},
                {"eval_white": 0.30, "cp": 30},
                {"eval_white": 0.40, "cp": 40},
            ]
        }
    ]
    res = get_comprehensive_move_evaluations(games)
    assert res["available"] is True
    assert res["source"] == "embedded_pgn"
    assert res["analyzed_games"] == 1


def test_extract_all_embedded_evaluations_black():
    from src.engine.evaluator import extract_all_embedded_evaluations
    games = [
        {
            "white": "PlayerA",
            "black": "PlayerB",
            "result": "0-1",
            "player_color": "black",
            "moves": ["e4", "c5", "Nf3", "d6"],
            "has_evals": True,
            "evals": [
                {"eval_white": 0.20, "cp": 20},
                {"eval_white": 0.10, "cp": 10},
                {"eval_white": 0.15, "cp": 15},
                {"eval_white": -0.40, "cp": -40},
            ]
        }
    ]
    res = extract_all_embedded_evaluations(games)
    assert res["available"] is True
    assert res["analyzed_games"] == 1
    assert len(res["move_evaluations"]) == 2
    # Check that Black's moves have Opponent POV eval computed properly
    move1 = res["move_evaluations"][0]  # move 1... c5
    assert move1["move_san"] == "c5"
    assert move1["eval_after"] == -0.10  # Black POV is -0.10 when White eval is +0.10


def test_get_comprehensive_move_evaluations_empty():
    from src.engine.evaluator import get_comprehensive_move_evaluations
    res = get_comprehensive_move_evaluations([])
    assert res["available"] is False
    assert res["analyzed_games"] == 0
    assert res["total_moves_analyzed"] == 0


def test_extract_evaluations_clamped_mate_and_outlier():
    from src.engine.evaluator import extract_all_embedded_evaluations
    # Test that mate and extreme evaluations are safely clamped so ACPL doesn't blow up
    games = [
        {
            "white": "Grandmaster",
            "black": "Rival",
            "result": "1-0",
            "player_color": "white",
            "moves": ["e4", "e5", "Qh5", "Ke7", "Qxe5#"],
            "has_evals": True,
            "evals": [
                {"eval_white": 0.20, "cp": 20},
                {"eval_white": 0.15, "cp": 15},
                {"eval_white": 1.50, "cp": 150},
                {"eval_white": 10.0, "cp": 1000, "is_mate": True, "mate": 1},
                {"eval_white": 10.0, "cp": 1000, "is_mate": True, "mate": 0},
            ]
        }
    ]
    res = extract_all_embedded_evaluations(games)
    assert res["available"] is True
    assert res["analyzed_games"] == 1
    for ev in res["move_evaluations"]:
        assert ev["cpl"] <= 500.0
        assert -10.0 <= ev["eval_before"] <= 10.0
def test_parallel_batch_analyze_incremental_skip():
    from src.engine.evaluator import parallel_batch_analyze_games
    games = [
        {"white": "A", "black": "B", "result": "1-0", "player_color": "white", "moves": ["e4", "e5"]},
        {"white": "A", "black": "C", "result": "1-0", "player_color": "white", "moves": ["d4", "d5"]},
    ]
    # Game index 0 is already analyzed
    existing = [
        {"game_index": 0, "ply": 0, "move_san": "e4", "cpl": 10.0, "eval_before": 0.2, "eval_after": 0.3}
    ]
    # Run with existing evaluations
    res = parallel_batch_analyze_games(games, max_games=2, existing_evaluations=existing)
    assert res["available"] is True
    # Verify game 0 evaluation is preserved
    game0_evals = [e for e in res["move_evaluations"] if e.get("game_index") == 0]
    assert len(game0_evals) == 1
    assert game0_evals[0]["move_san"] == "e4"


def test_parallel_batch_analyze_empty_and_short_games():
    from src.engine.evaluator import parallel_batch_analyze_games
    games = [
        {"white": "A", "black": "B", "result": "1-0", "player_color": "white", "moves": ["e4", "e5", "Nf3", "Nc6"]},
        {"white": "A", "black": "C", "result": "1-0", "player_color": "white", "moves": []}, # 0 moves (aborted)
        {"white": "A", "black": "D", "result": "0-1", "player_color": "white", "moves": ["e4"]}, # 1 move only
    ]
    res = parallel_batch_analyze_games(games, max_games=3)
    assert res["available"] is True
    analyzed_indices = set(e["game_index"] for e in res["move_evaluations"] if "game_index" in e)
    # All 3 game indices (0, 1, 2) must be present so analyzed_count == total_games
    assert len(analyzed_indices) == 3
    assert analyzed_indices == {0, 1, 2}





