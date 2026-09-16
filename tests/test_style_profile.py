"""
Unit Tests for Playing Style Profile Module (Factual & Explainable Metrics)
---------------------------------------------------------------------------
Kiểm thử các chỉ số thực nghiệm: Complexity, Volatility, Sacrifice Rate,
Simplification Metrics (Endgame <= Move 30 & Balanced Eval), Open/Closed, Resilience,
và sinh Bằng chứng thực tế (Evidence).
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import chess

from src.analysis.style_metrics import (
    clamp_normalize,
    compute_volatility_score,
    compute_open_closed_preference,
    compute_resilience_rate,
    compute_sacrifice_rate,
    compute_simplification_metrics,
    extract_all_style_metrics
)
from src.analysis.style_classifier import (
    generate_style_evidence,
    classify_player_style
)
from src.player_profile import generate_deep_opponent_profile


def test_clamp_normalization():
    assert clamp_normalize(50, 0, 100) == 50.0
    assert clamp_normalize(-10, 0, 100) == 0.0
    assert clamp_normalize(150, 0, 100) == 100.0
    assert clamp_normalize(10, 10, 10) == 50.0  # Zero division guard



def test_volatility_score():
    # No engine data
    assert compute_volatility_score(None) == 50.0
    assert compute_volatility_score([]) == 50.0

    # Flat evaluation (low volatility)
    flat_evals = [{"delta_eval": 0.05}, {"delta_eval": 0.02}, {"delta_eval": 0.04}, {"delta_eval": 0.03}]
    flat_vol = compute_volatility_score(flat_evals)

    # Wild evaluation swings (high volatility)
    wild_evals = [{"delta_eval": 3.5}, {"delta_eval": -2.8}, {"delta_eval": 4.0}, {"delta_eval": -1.9}]
    wild_vol = compute_volatility_score(wild_evals)

    assert wild_vol > flat_vol


def test_open_closed_preference():
    open_game = {
        "moves": ["e4", "e5", "Nf3", "Nc6", "d4", "exd4", "c3", "dxc3", "Bc4", "cxb2", "Bxb2", "d6", "O-O", "Nf6"],
        "player_color": "white"
    }
    closed_game = {
        "moves": ["d4", "d5", "c4", "c6", "Nf3", "Nf6", "e3", "e6", "Nbd2", "Nbd7", "Bd3", "Bd6", "O-O", "O-O"],
        "player_color": "white"
    }
    pref = compute_open_closed_preference([open_game, closed_game])
    assert pref["open_preference"] >= 0.0
    assert pref["closed_preference"] >= 0.0
    assert round(pref["open_preference"] + pref["semi_open_preference"] + pref["closed_preference"]) == 100.0
    assert "dominant_structure" in pref
    assert "dominant_structure_pct" in pref
    assert pref["dominant_structure_pct"] == max(pref["open_preference"], pref["semi_open_preference"], pref["closed_preference"])
    assert pref["dominant_structure"] in ["Cờ kín", "Cờ nửa mở", "Cờ mở"]


def test_resilience_rate():
    games = [
        {"player_color": "white", "result": "1-0"},     # Deficit -> Won (Resilient)
        {"player_color": "white", "result": "1/2-1/2"}, # Deficit -> Drew (Resilient)
        {"player_color": "white", "result": "0-1"}      # Deficit -> Lost (Not resilient)
    ]
    evals = [
        {"game_index": 0, "eval_after": -2.2},
        {"game_index": 1, "eval_after": -1.8},
        {"game_index": 2, "eval_after": -3.0}
    ]
    resil = compute_resilience_rate(games, evals)
    assert resil == round((2 / 3) * 100.0, 1)


def test_sacrifice_rate_vs_blunder():
    # Game 1: Evans Gambit pawn sacrifice (ply 6: 4. b4, followed by 4... Bxb4)
    sac_game = {
        "moves": ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4", "Bxb4", "c3", "Ba5", "d4", "exd4", "O-O"],
        "player_color": "white",
        "result": "1-0"
    }
    # Eval shows White has dynamic compensation (delta_eval = 0.1, cpl = 0)
    sac_evals = [
        {"game_index": 0, "ply": 6, "eval_before": 0.1, "delta_eval": 0.1, "cpl": 0.0, "eval_after": 0.2}
    ]

    # Game 2: Blunder where White hangs Queen for nothing (ply 6: Ng5 allowing 4... Bxd1)
    blunder_game = {
        "moves": ["e4", "e5", "Nf3", "d6", "Bc4", "Bg4", "Ng5", "Bxd1"],
        "player_color": "white",
        "result": "0-1"
    }
    # Eval drops heavily for White (delta_eval = -8.0, cpl = 500)
    blunder_evals = [
        {"game_index": 1, "ply": 6, "eval_before": 0.0, "delta_eval": -8.0, "cpl": 500.0, "eval_after": -8.0}
    ]

    all_games = [sac_game, blunder_game]
    all_evals = sac_evals + blunder_evals

    res = compute_sacrifice_rate(all_games, all_evals)
    assert res["sacrifice_games_count"] == 1
    assert res["total_sacrifices"] >= 1
    assert res["total_blunders"] >= 1
    assert res["sacrifice_rate"] == 50.0


def test_simplification_metrics_and_simplifier_criteria():
    # Game where early queen and minor piece trades lead to endgame by move 20
    early_endgame_moves = [
        "e4", "e5", "Nf3", "Nf6", "Nxe5", "d6", "Nf3", "Nxe4", "Qe2", "Qe7",
        "d3", "Nf6", "Qxe7+", "Bxe7", "Be2", "O-O", "O-O", "Re8", "Re1", "Bf8",
        "Bg5", "Nbd7", "Nbd2", "h6", "Bh4", "g5", "Bg3", "Nh5", "c3", "Nxg3",
        "hxg3", "Nf6", "d4", "Bf5", "Bc4", "Rxe1+", "Rxe1", "Re8", "Rxe8", "Nxe8"
    ]
    early_game = {"moves": early_endgame_moves, "player_color": "white"}
    evals = [
        {"game_index": 0, "move_number": 7, "eval_after": 0.2},
        {"game_index": 0, "move_number": 15, "eval_after": 0.1},
        {"game_index": 0, "move_number": 20, "eval_after": -0.2}
    ]

    simp_res = compute_simplification_metrics([early_game], evals)
    assert simp_res["avg_endgame_move"] <= 30.0
    assert simp_res["simplification_rate"] == 100.0
    assert simp_res["is_simplifier"] is True


def test_evidence_generation():
    raw_m = {
        "volatility_score": 70.0,
        "sacrifice_rate": 25.0,
        "total_sacrifices": 3,
        "simplification_rate": 45.0,
        "is_simplifier": True,
        "avg_endgame_move": 24.0,
        "closed_preference": 20.0,
        "open_preference": 65.0,
        "resilience_rate": 60.0,
        "has_engine_data": True
    }
    evidence_vi = generate_style_evidence(raw_m)
    assert len(evidence_vi) >= 3
    assert any("thí quân" in ev for ev in evidence_vi)
    assert any("đổi quân" in ev for ev in evidence_vi)


def test_classify_player_style_end_to_end():
    raw_m = extract_all_style_metrics([], {}, None, None)
    profile = classify_player_style(
        raw_m,
        sample_size=10,
        lang="vi",
        analyzed_games_count=3,
        total_games_count=10
    )

    assert "metrics" in profile
    assert "evidence" in profile
    assert "is_simplifier" in profile
    assert "sacrifice_rate" in profile
    assert "simplification_rate" in profile
    assert profile["analyzed_games_count"] == 3
    assert profile["total_games_count"] == 10
    assert profile["is_sample_only"] is True
    assert profile["confidence_level"] == "low"

    full_profile = classify_player_style(
        raw_m,
        sample_size=10,
        lang="vi",
        analyzed_games_count=10,
        total_games_count=10
    )
    assert full_profile["is_sample_only"] is False
    assert full_profile["confidence_level"] == "high"


def test_deep_opponent_profile_integration():
    games = [{
        "moves": ["e4", "e5", "Nf3", "Nc6"],
        "player_color": "white",
        "result": "1-0",
        "white": "Player A",
        "black": "Player B",
        "opening": "King's Pawn Game"
    }]
    stats = {"white_score_percentage": 100.0, "black_score_percentage": 0.0}
    deep_prof = generate_deep_opponent_profile(games, stats, move_evaluations=None)

    assert "style_profile" in deep_prof
    assert "metrics" in deep_prof["style_profile"]
    assert "evidence" in deep_prof["style_profile"]
    assert "sacrifice_rate" in deep_prof["style_profile"]["metrics"]
    assert "simplification_rate" in deep_prof["style_profile"]["metrics"]
    assert "confidence_level" in deep_prof["style_profile"]
    assert "analyzed_games_count" in deep_prof["style_profile"]
