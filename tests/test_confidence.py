"""
Tests for Statistical Confidence & Bayesian Performance Assessment Module
-------------------------------------------------------------------------
Kiểm tra các yêu cầu:
1. 1/1 win is NOT confirmed strength.
2. 1/1 loss is NOT confirmed weakness.
3. 10 games 30% can become confirmed weakness.
4. Large sample has less shrinkage.
5. Baseline is correct.
6. Strongest opening ranking.
7. Weakest opening ranking.
8. Structure ranking.
9. Match Prep excludes unreliable rare sample.
10. Backward compatibility with existing repertoire and structure schemas.
"""

import pytest
from src.analysis.confidence import (
    calculate_adjusted_score,
    calculate_delta,
    assess_performance,
    get_sample_confidence,
    enrich_performance_item,
    rank_strongest_items,
    rank_weakest_items,
    DEFAULT_PRIOR_STRENGTH,
    MIN_CONFIRMED_SAMPLE,
    DELTA_STRENGTH_THRESHOLD,
    DELTA_WEAKNESS_THRESHOLD,
    ASSESSMENT_CONFIRMED_STRENGTH,
    ASSESSMENT_POTENTIAL_STRENGTH,
    ASSESSMENT_CONFIRMED_WEAKNESS,
    ASSESSMENT_POTENTIAL_WEAKNESS,
    ASSESSMENT_NEUTRAL,
)
from src.player_profile import analyze_opening_repertoire
from src.analysis.pawn_structure import analyze_structural_performance
from src.strategy import generate_match_preparation, generate_actionable_match_preparation


def test_bayes_shrinkage_small_vs_large_sample():
    """
    4. Large sample has less shrinkage than small sample.
    """
    baseline = 50.0  # 50%
    
    # 1 ván 1 thắng (100% raw)
    # (1 + 6 * 0.5) / (1 + 6) * 100 = 4 / 7 * 100 = 57.1%
    adj_1g = calculate_adjusted_score(wins=1, draws=0, games_count=1, baseline_score=baseline)
    assert adj_1g == 57.1
    # Bị co về baseline: 100% -> 57.1% (chênh lệch so với raw: 42.9%)

    # 10 ván 10 thắng (100% raw)
    # (10 + 3) / (10 + 6) * 100 = 13 / 16 * 100 = 81.2%
    adj_10g = calculate_adjusted_score(wins=10, draws=0, games_count=10, baseline_score=baseline)
    assert adj_10g == 81.2

    # 50 ván 50 thắng (100% raw)
    # (50 + 3) / (50 + 6) * 100 = 53 / 56 * 100 = 94.6%
    adj_50g = calculate_adjusted_score(wins=50, draws=0, games_count=50, baseline_score=baseline)
    assert adj_50g == 94.6
    assert abs(adj_50g - 100.0) < abs(adj_10g - 100.0) < abs(adj_1g - 100.0)


def test_one_game_one_win_not_confirmed_strength():
    """
    1. 1/1 win is NOT confirmed strength.
    """
    baseline = 50.0
    adj = calculate_adjusted_score(wins=1, draws=0, games_count=1, baseline_score=baseline)
    delta = calculate_delta(adj, baseline)
    assess = assess_performance(games_count=1, delta_vs_baseline=delta)
    
    assert assess != ASSESSMENT_CONFIRMED_STRENGTH
    assert assess in [ASSESSMENT_NEUTRAL, ASSESSMENT_POTENTIAL_STRENGTH]


def test_one_game_zero_win_not_confirmed_weakness():
    """
    2. 1/1 loss is NOT confirmed weakness.
    """
    baseline = 50.0
    # 1 ván 0 thắng 1 thua (0% raw)
    # (0 + 3) / 7 * 100 = 42.9%
    adj = calculate_adjusted_score(wins=0, draws=0, games_count=1, baseline_score=baseline)
    delta = calculate_delta(adj, baseline)  # 42.9 - 50.0 = -7.1%
    assess = assess_performance(games_count=1, delta_vs_baseline=delta)

    assert assess != ASSESSMENT_CONFIRMED_WEAKNESS
    assert assess in [ASSESSMENT_NEUTRAL, ASSESSMENT_POTENTIAL_WEAKNESS]


def test_ten_games_low_score_is_confirmed_weakness():
    """
    3. 10 games 30% can become confirmed weakness.
    """
    baseline = 58.0  # Overall baseline 58%
    # 10 ván: 3 thắng, 0 hòa, 7 thua (30% raw)
    # points = 3.0, prior = 6 * 0.58 = 3.48
    # adj = (3 + 3.48) / 16 * 100 = 40.5%
    # delta = 40.5 - 58.0 = -17.5% (<= -10% threshold và games = 10 >= 5)
    adj = calculate_adjusted_score(wins=3, draws=0, games_count=10, baseline_score=baseline)
    delta = calculate_delta(adj, baseline)
    assess = assess_performance(games_count=10, delta_vs_baseline=delta)

    assert delta <= -10.0
    assert assess == ASSESSMENT_CONFIRMED_WEAKNESS


def test_baseline_calculation_and_enrichment():
    """
    5. Baseline is correct and enrichment preserves original raw statistics.
    """
    fake_games = [
        {"opening": "Ruy Lopez", "player_color": "white", "result": "1-0"},
        {"opening": "Ruy Lopez", "player_color": "white", "result": "1-0"},
        {"opening": "Sicilian", "player_color": "black", "result": "0-1"},
        {"opening": "French", "player_color": "black", "result": "1-0"}, # Loss for black
    ]
    rep = analyze_opening_repertoire(fake_games)
    
    # 4 ván: 3 thắng (2 white, 1 black), 1 thua -> baseline = (3 / 4) * 100 = 75.0%
    assert rep["overall_baseline"] == 75.0

    # Kiểm tra Ruy Lopez
    ruy = next(op for op in rep["all_openings"] if op["name"] == "Ruy Lopez")
    assert ruy["games_count"] == 2
    assert ruy["wins"] == 2
    assert ruy["raw_score_pct"] == 100.0
    assert ruy["score_pct"] == 100.0  # Preserved raw score
    assert "adjusted_score_pct" in ruy
    assert "delta_vs_baseline" in ruy
    assert "assessment" in ruy


def test_ranking_strongest_opening_prioritizes_confirmed_strength():
    """
    6. Strongest opening ranking prioritizes statistically confirmed strengths over 1-game 100% wins.
    """
    baseline = 50.0
    items = [
        # 1 ván 1 thắng (100% raw, adj = 57.1%, delta = +7.1% -> NEUTRAL)
        enrich_performance_item({"name": "Rare Opening", "games_count": 1, "wins": 1, "draws": 0, "losses": 0, "score_pct": 100.0}, baseline),
        # 10 ván 9 thắng 1 hòa (95% raw, adj = 78.1%, delta = +28.1% -> CONFIRMED_STRENGTH)
        enrich_performance_item({"name": "Main Weapon", "games_count": 10, "wins": 9, "draws": 1, "losses": 0, "score_pct": 95.0}, baseline),
    ]

    ranked = rank_strongest_items(items)
    # Main Weapon PHẢI đứng đầu mặc dù raw score 95% < 100% của Rare Opening
    assert ranked[0]["name"] == "Main Weapon"
    assert ranked[0]["assessment"] == ASSESSMENT_CONFIRMED_STRENGTH


def test_ranking_weakest_opening_prioritizes_confirmed_weakness():
    """
    7. Weakest opening ranking prioritizes confirmed weaknesses over 1-game 0% losses.
    """
    baseline = 58.0
    items = [
        # 1 ván 0 thắng 1 thua (0% raw, adj = 49.7%, delta = -8.3% -> NEUTRAL/POTENTIAL)
        enrich_performance_item({"name": "Rare Blunder", "games_count": 1, "wins": 0, "draws": 0, "losses": 1, "score_pct": 0.0}, baseline),
        # 12 ván 2 thắng 1 hòa 9 thua (20.8% raw, adj = 33.3%, delta = -24.7% -> CONFIRMED_WEAKNESS)
        enrich_performance_item({"name": "Systematic Weakness", "games_count": 12, "wins": 2, "draws": 1, "losses": 9, "score_pct": 20.8}, baseline),
    ]

    ranked = rank_weakest_items(items)
    # Systematic Weakness PHẢI đứng đầu làm mục tiêu khai thác chính
    assert ranked[0]["name"] == "Systematic Weakness"
    assert ranked[0]["assessment"] == ASSESSMENT_CONFIRMED_WEAKNESS


def test_structure_ranking_with_bayesian_framework():
    """
    8. Pawn Structure ranking correctly prioritizes confirmed structural weaknesses over 2-game 0% samples.
    """
    baseline = 55.0
    struct_items = [
        # 2 ván 0 thắng (0% raw, adj = 41.2%, delta = -13.8% -> POTENTIAL_WEAKNESS)
        enrich_performance_item({"name": "Isolani", "structure_key": "Isolani", "games_count": 2, "wins": 0, "draws": 0, "losses": 2, "score_pct": 0.0}, baseline),
        # 14 ván 3 thắng 2 hòa 9 thua (28.6% raw, adj = 36.5%, delta = -18.5% -> CONFIRMED_WEAKNESS)
        enrich_performance_item({"name": "Carlsbad", "structure_key": "Carlsbad", "games_count": 14, "wins": 3, "draws": 2, "losses": 9, "score_pct": 28.6}, baseline),
    ]

    ranked = rank_weakest_items(struct_items)
    assert ranked[0]["name"] == "Carlsbad"
    assert ranked[0]["assessment"] == ASSESSMENT_CONFIRMED_WEAKNESS


def test_match_prep_excludes_unreliable_rare_sample_as_main_weapon():
    """
    9. Match Prep actionable recommendations use statistically supported evidence.
    """
    baseline = 50.0
    op_confirmed_strong = enrich_performance_item(
        {"name": "Caro-Kann", "games_count": 8, "wins": 7, "draws": 1, "losses": 0, "score_pct": 93.8}, baseline
    )
    op_fluke_1g = enrich_performance_item(
        {"name": "Englund Gambit", "games_count": 1, "wins": 1, "draws": 0, "losses": 0, "score_pct": 100.0}, baseline
    )
    op_confirmed_weak = enrich_performance_item(
        {"name": "King's Indian", "games_count": 8, "wins": 1, "draws": 1, "losses": 6, "score_pct": 18.8}, baseline
    )

    fake_deep_profile = {
        "repertoire": {
            "all_openings": [op_confirmed_strong, op_fluke_1g, op_confirmed_weak],
            "black_repertoire": [op_confirmed_strong, op_fluke_1g, op_confirmed_weak],
            "white_repertoire": [],
        },
        "structures": {"target_structure": None},
        "phases": {},
        "dynamics": {},
        "simplification": {},
        "style_profile": {"scores": {}},
        "critical_positions": [],
    }

    prep = generate_actionable_match_preparation(fake_deep_profile, user_color="white")
    # Khi user cầm White (đối thủ cầm Black), vũ khí mạnh nhất của đối thủ phải là Caro-Kann chứ không phải Englund Gambit
    assert prep["strongest_opening"]["name"] == "Caro-Kann"
    assert prep["weakest_opening"]["name"] == "King's Indian"
