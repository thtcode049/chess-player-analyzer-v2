from pathlib import Path
from src.pgn_parser import parse_pgn, filter_games_by_player
from src.statistics import calculate_game_stats
from src.opening_tree import build_opening_tree
from src.player_profile import (
    analyze_opening_repertoire,
    generate_player_insights,
    _get_opening_label,
)


def test_get_opening_label():
    g1 = {"opening": "Ruy Lopez", "eco": "C84", "moves": ["e4", "e5"]}
    assert _get_opening_label(g1) == "C84 - Ruy Lopez"

    g2 = {"opening": "", "eco": "D02", "moves": ["d4", "Nf6"]}
    assert _get_opening_label(g2) == "ECO D02"

    g3 = {"opening": "", "eco": "", "moves": ["e4", "c5"]}
    assert _get_opening_label(g3) == "1.e4 c5"


def test_analyze_opening_repertoire_empty():
    rep = analyze_opening_repertoire([])
    assert rep["all_openings"] == []
    assert rep["most_played"] == []
    assert rep["best_scoring"] == []


def test_generate_player_insights():
    sample_path = Path("data/sample.pgn")
    games = parse_pgn(sample_path)
    nep_games = filter_games_by_player(games, "Nepomniachtchi, Ian")

    stats = calculate_game_stats(nep_games)
    tree_data = build_opening_tree(nep_games)
    rep_data = analyze_opening_repertoire(nep_games)

    insights = generate_player_insights(nep_games, stats, rep_data, tree_data)

    assert len(insights) >= 3
    # Phải chứa thông tin Khai cuộc yêu thích hoặc Nước đi đầu tiên
    titles = [ins["title"] for ins in insights]
    assert any("Khai cuộc" in t or "yêu thích" in t or "First Move" in t or "Thiên hướng" in t for t in titles)
