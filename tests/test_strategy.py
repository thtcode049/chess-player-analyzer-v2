from pathlib import Path
from src.pgn_parser import parse_pgn, filter_games_by_player
from src.statistics import calculate_game_stats
from src.opening_tree import build_opening_tree
from src.player_profile import analyze_opening_repertoire
from src.strategy import generate_match_preparation


def test_generate_match_preparation_white():
    sample_path = Path("data/sample.pgn")
    games = parse_pgn(sample_path)
    nep_games = filter_games_by_player(games, "Nepomniachtchi, Ian")
    
    stats = calculate_game_stats(nep_games)
    _, fen_map = build_opening_tree(nep_games)
    repertoire_data = analyze_opening_repertoire(nep_games)
    
    prep_white = generate_match_preparation(
        nep_games, stats, repertoire_data, fen_map, user_color="white"
    )
    
    assert "target_weaknesses" in prep_white
    assert "recommended_lines" in prep_white
    assert "surprise_weapons" in prep_white
    assert "gameplan_checklist" in prep_white
    assert len(prep_white["gameplan_checklist"]) > 0


def test_generate_match_preparation_black():
    sample_path = Path("data/sample.pgn")
    games = parse_pgn(sample_path)
    nep_games = filter_games_by_player(games, "Nepomniachtchi, Ian")
    
    stats = calculate_game_stats(nep_games)
    _, fen_map = build_opening_tree(nep_games)
    repertoire_data = analyze_opening_repertoire(nep_games)
    
    prep_black = generate_match_preparation(
        nep_games, stats, repertoire_data, fen_map, user_color="black"
    )
    
    assert "target_weaknesses" in prep_black
    assert "recommended_lines" in prep_black
    assert len(prep_black["gameplan_checklist"]) > 0


def test_generate_match_preparation_empty():
    prep_empty = generate_match_preparation([], {}, {}, {})
    assert len(prep_empty["gameplan_checklist"]) == 1
    assert "Không đủ dữ liệu" in prep_empty["gameplan_checklist"][0]
