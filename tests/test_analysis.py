"""
Unit Tests for Deep Analytics Modules
-------------------------------------
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import chess

from src.analysis.phase_analysis import classify_phase, analyze_phase_performance
from src.analysis.pawn_structure import detect_pawn_structure, analyze_structural_performance
from src.analysis.game_dynamics import analyze_game_dynamics
from src.analysis.simplification import analyze_simplification_performance
from src.analysis.confidence import get_confidence_level
from src.strategy import generate_actionable_match_preparation


def test_confidence_level():
    assert get_confidence_level(12) == "HIGH"
    assert get_confidence_level(7) == "MEDIUM"
    assert get_confidence_level(3) == "LOW"


def test_classify_phase():
    board = chess.Board()
    # Move 5 with undeveloped pieces is Opening
    assert classify_phase(board, 5) == "opening"
    # Move 18 with starting pieces (move > 15) is Middlegame
    assert classify_phase(board, 18) == "middlegame"

    # Endgame board (low material) is Endgame
    endgame_board = chess.Board("4k3/ppp2ppp/5n2/8/8/8/PPP2PPP/4K2R w K - 0 35")
    assert classify_phase(endgame_board, 35) == "endgame"

    # Empty board material except kings is Endgame
    empty_board = chess.Board("8/8/8/4k3/4K3/8/8/8 w - - 0 1")
    assert classify_phase(empty_board, 15) == "endgame"


def test_detect_pawn_structure():
    # Starting board structure is Symmetrical/Standard
    board = chess.Board()
    res = detect_pawn_structure(board)
    assert "structure" in res

    # IQP position (White pawn d4, no c/e pawns for White)
    iqp_board = chess.Board("r1bqk2r/pp3ppp/2n5/3p4/3P4/5N2/PP1Q1PPP/R3KB1R w KQkq - 0 10")
    res_iqp = detect_pawn_structure(iqp_board)
    assert res_iqp["structure"] == "IQP"


def test_analyze_game_dynamics():
    games = [
        {"player_color": "white", "result": "1/2-1/2"},
        {"player_color": "white", "result": "0-1"},
    ]
    # Game 0 reached opp_eval = +2.5 but ended in Draw (Throw)
    # Game 1 reached opp_eval = -2.5 but ended in Loss (Not resilient)
    evals = [
        {"game_index": 0, "eval_after": 2.5, "delta_eval": 0.5},
        {"game_index": 1, "eval_after": -2.5, "delta_eval": -0.8},
    ]

    dyn = analyze_game_dynamics(games, move_evaluations=evals)
    assert dyn["available"]
    assert dyn["eligible_advantage_games"] == 1
    assert dyn["throw_games"] == 1
    assert dyn["throw_rate"] == 100.0


def test_actionable_match_preparation():
    deep_profile = {
        "repertoire": {
            "all_openings": [{"name": "Sicilian Defense", "games_count": 10, "score_pct": 70.0}],
            "black_repertoire": [{"name": "Sicilian Defense", "games_count": 10, "score_pct": 70.0}]
        },
        "structures": {
            "target_structure": {"name": "IQP", "score_pct": 30.0, "games_count": 8, "confidence": {"label": "Medium"}}
        },
        "phases": {
            "weakest_phase": {"phase": "endgame", "avg_acpl": 55.0}
        },
        "dynamics": {
            "throw_rate": 40.0,
            "resilience_rate": 10.0
        },
        "critical_positions": []
    }

    action_prep = generate_actionable_match_preparation(deep_profile, user_color="white")
    assert "play_plan" in action_prep
    assert "target_plan" in action_prep
    assert "avoid_plan" in action_prep
    assert len(action_prep["play_plan"]) > 0
    assert len(action_prep["target_plan"]) > 0


def test_analyze_structural_performance():
    # Game reaching IQP around move 10 (ply 18)
    game_iqp_moves = [
        "e4", "c5", "Nf3", "e6", "d4", "cxd4", "Nxd4", "a6",
        "c4", "Nf6", "Nc3", "d5", "exd5", "exd5", "cxd5", "Nxd5",
        "Nxd5", "Qxd5"  # IQP formed around ply 17
    ]
    games = [{
        "moves": game_iqp_moves,
        "player_color": "white",
        "result": "1-0",
        "white": "Player A",
        "black": "Player B",
        "opening": "Sicilian Defense",
        "date": "2026.01.01"
    }]
    res = analyze_structural_performance(games)
    structs = res.get("structures", [])
    assert len(structs) >= 1
    iqp_struct = next((s for s in structs if s["structure_key"] == "IQP"), None)
    assert iqp_struct is not None
    assert iqp_struct["games_count"] == 1
    assert "typical_formation_move" in iqp_struct
    assert len(iqp_struct["games"]) == 1
    g_info = iqp_struct["games"][0]
    assert g_info["game_index"] == 0
    assert g_info["formation_move"] >= 8
    assert g_info["white"] == "Player A"

