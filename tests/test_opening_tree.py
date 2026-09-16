from pathlib import Path
import chess
from src.pgn_parser import parse_pgn, filter_games_by_player
from src.opening_tree import build_opening_tree, get_position_details


def test_build_opening_tree_starting_position():
    sample_path = Path("data/sample.pgn")
    games = parse_pgn(sample_path)
    nep_games = filter_games_by_player(games, "Nepomniachtchi, Ian")
    
    root, fen_map = build_opening_tree(nep_games)
    start_fen = chess.Board().fen()
    
    assert start_fen in fen_map
    assert fen_map[start_fen].games_count == 2
    assert root.games_count == 2


def test_opening_tree_continuations_stats():
    sample_path = Path("data/sample.pgn")
    games = parse_pgn(sample_path)
    nep_games = filter_games_by_player(games, "Nepomniachtchi, Ian")
    
    root, fen_map = build_opening_tree(nep_games)
    start_fen = chess.Board().fen()
    details = get_position_details(fen_map, start_fen)
    
    assert details["in_pgn"] is True
    assert details["total_games"] == 2
    assert len(details["continuations"]) > 0

    total_usage = sum(c["usage_pct"] for c in details["continuations"])
    assert abs(total_usage - 100.0) < 0.1


def test_position_not_in_pgn():
    fen_map = {}
    random_fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2"
    details = get_position_details(fen_map, random_fen)
    
    assert details["in_pgn"] is False
    assert details["total_games"] == 0
    assert details["score_pct"] == 0.0
    assert len(details["continuations"]) == 0


def test_single_game_info_extraction():
    dummy_games = [
        {
            "white": "PlayerA",
            "white_elo": 2000,
            "black": "PlayerB",
            "black_elo": 1900,
            "result": "1-0",
            "site": "https://lichess.org/test1234",
            "link": "https://lichess.org/test1234",
            "event": "Rated Blitz match",
            "date": "2024.01.01",
            "round": "1",
            "moves": ["e4", "e5", "Nf3"],
            "player_color": "white",
            "opening": "King's Knight Opening",
        }
    ]
    root, fen_map = build_opening_tree(dummy_games)
    start_fen = chess.Board().fen()
    details = get_position_details(fen_map, start_fen)
    
    assert len(details["continuations"]) == 1
    cont = details["continuations"][0]
    assert cont["games_count"] == 1
    assert cont["single_game_info"] is not None
    assert cont["single_game_info"]["white"] == "PlayerA"
    assert cont["single_game_info"]["black"] == "PlayerB"
    assert cont["single_game_info"]["result"] == "1-0"
    assert cont["single_game_info"]["link"] == "https://lichess.org/test1234"
    assert cont["single_game_info"]["event"] == "Rated Blitz match"
    assert cont["single_game_info"]["date"] == "2024.01.01"
    assert cont["single_game_info"]["round"] == "1"


def test_single_game_info_pgn_tournament_fields():
    dummy_games = [
        {
            "white": "Nepo",
            "white_elo": 2795,
            "black": "Ding",
            "black_elo": 2788,
            "result": "1/2-1/2",
            "site": "Astana KAZ",
            "event": "World Championship",
            "date": "2023.04.09",
            "round": "1",
            "moves": ["e4", "e5", "Nf3"],
            "player_color": "white",
        }
    ]
    root, fen_map = build_opening_tree(dummy_games)
    details = get_position_details(fen_map, chess.Board().fen())
    sg = details["continuations"][0]["single_game_info"]
    assert sg["event"] == "World Championship"
    assert sg["site"] == "Astana KAZ"
    assert sg["date"] == "2023.04.09"
    assert sg["round"] == "1"
    assert sg["link"] == ""


def test_find_common_move_prefix():
    from app import find_common_move_prefix
    
    games = [
        {"moves": ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"]},
        {"moves": ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"]},
        {"moves": ["e4", "e5", "Nf3", "Nc6", "Bc4", "Be7"]},
    ]
    prefix = find_common_move_prefix(games)
    assert prefix == ["e4", "e5", "Nf3", "Nc6", "Bc4"]


def test_find_representative_line_transposition():
    from app import find_representative_line_for_games

    # Transposition example: Dutch Defense played via different valid move orders
    games = [
        {"moves": ["d4", "f5", "c4", "Nf6", "g3", "e6"]},
        {"moves": ["d4", "f5", "c4", "Nf6", "g3", "g6"]},
        {"moves": ["d4", "e6", "c4", "f5", "g3", "Nf6"]},
        {"moves": ["d4", "e6", "c4", "f5", "g3", "Nf6"]},
    ]
    rep_line = find_representative_line_for_games(games)
    # The canonical position reached by all 4 games is after 5 plies (d4, f5, c4, Nf6, g3)
    assert len(rep_line) >= 5
    # Check that representative line is one of the valid move paths
    assert rep_line[:5] in [["d4", "f5", "c4", "Nf6", "g3"], ["d4", "e6", "c4", "f5", "g3"]]


def test_push_move_preserves_full_analysis_line():
    import streamlit as st
    import chess
    from app import push_move, pop_move, step_next

    st.session_state.chess_board = chess.Board()
    st.session_state.move_history = []
    st.session_state.full_analysis_line = ["e4", "e5", "Nf3", "Nc6", "Bc4"]

    # Play e4
    push_move("e4")
    assert st.session_state.move_history == ["e4"]
    assert st.session_state.full_analysis_line == ["e4", "e5", "Nf3", "Nc6", "Bc4"]

    # Pop move back to start
    pop_move()
    assert st.session_state.move_history == []
    assert st.session_state.full_analysis_line == ["e4", "e5", "Nf3", "Nc6", "Bc4"]

    # Step next twice
    step_next()
    step_next()
    assert st.session_state.move_history == ["e4", "e5"]
    assert st.session_state.full_analysis_line == ["e4", "e5", "Nf3", "Nc6", "Bc4"]


def test_opening_tree_transposition_stats_aggregation():
    """Kiểm tra không bị ghi đè FEN khi chuyển vị (transposition) và thống kê chính xác."""
    # Game 1: 1. d4 Nf6 2. c4 e6 3. Nf3 (White Win)
    # Game 2: 1. c4 e6 2. d4 Nf6 3. Nc3 (White Loss)
    # Both reach FEN after ply 4 (d4, Nf6, c4, e6)
    games = [
        {
            "white": "PlayerA",
            "black": "PlayerB",
            "result": "1-0",
            "player_color": "white",
            "moves": ["d4", "Nf6", "c4", "e6", "Nf3"],
            "opening": "Queen's Indian Defense",
        },
        {
            "white": "PlayerA",
            "black": "PlayerC",
            "result": "0-1",
            "player_color": "white",
            "moves": ["c4", "e6", "d4", "Nf6", "Nc3"],
            "opening": "English Opening",
        }
    ]

    root, fen_map = build_opening_tree(games)
    assert root.games_count == 2
    assert root.wins == 1
    assert root.losses == 1

    # Transposed position reached after: 1. d4 Nf6 2. c4 e6
    b1 = chess.Board()
    for m in ["d4", "Nf6", "c4", "e6"]:
        b1.push_san(m)
    transposed_fen = b1.fen()

    details = get_position_details(fen_map, transposed_fen)
    assert details["in_pgn"] is True
    # Must aggregate BOTH games (not overwritten to 1)
    assert details["total_games"] == 2
    assert details["wins"] == 1
    assert details["losses"] == 1
    assert details["score_pct"] == 50.0

    # Continuations from this position should contain both Nf3 and Nc3
    conts = {c["san"]: c for c in details["continuations"]}
    assert "Nf3" in conts
    assert "Nc3" in conts
    assert conts["Nf3"]["games_count"] == 1
    assert conts["Nf3"]["wins"] == 1
    assert conts["Nf3"]["score_pct"] == 100.0
    assert conts["Nc3"]["games_count"] == 1
    assert conts["Nc3"]["losses"] == 1
    assert conts["Nc3"]["score_pct"] == 0.0


def test_opening_tree_color_filtering():
    """Kiểm tra xây dựng cây khai cuộc theo bộ lọc màu quân Trắng/Đen/Tất cả."""
    mixed_games = [
        {
            "white": "Hero",
            "black": "Rival1",
            "result": "1-0",
            "player_color": "white",
            "moves": ["e4", "e5", "Nf3"],
            "opening": "King's Knight Opening",
        },
        {
            "white": "Rival2",
            "black": "Hero",
            "result": "0-1",
            "player_color": "black",
            "moves": ["d4", "d5", "c4"],
            "opening": "Queen's Gambit",
        }
    ]

    # 1. White only
    root_w, fen_map_w = build_opening_tree(mixed_games, color="white")
    assert root_w.games_count == 1
    start_fen = chess.Board().fen()
    details_w = get_position_details(fen_map_w, start_fen)
    assert len(details_w["continuations"]) == 1
    assert details_w["continuations"][0]["san"] == "e4"
    assert details_w["continuations"][0]["score_pct"] == 100.0

    # 2. Black only
    root_b, fen_map_b = build_opening_tree(mixed_games, color="black")
    assert root_b.games_count == 1
    details_b = get_position_details(fen_map_b, start_fen)
    assert len(details_b["continuations"]) == 1
    assert details_b["continuations"][0]["san"] == "d4"
    assert details_b["continuations"][0]["score_pct"] == 100.0

    # 3. All games
    root_all, fen_map_all = build_opening_tree(mixed_games, color="all")
    assert root_all.games_count == 2
    details_all = get_position_details(fen_map_all, start_fen)
    assert len(details_all["continuations"]) == 2


def test_determine_game_outcome():
    """Kiểm tra hàm determine_game_outcome với các định dạng kết quả PGN khác nhau."""
    from src.utils import determine_game_outcome

    # White wins
    assert determine_game_outcome("white", "1-0") == (True, False, False)
    assert determine_game_outcome("white", " 1-0 ") == (True, False, False)
    assert determine_game_outcome("white", "0-1") == (False, False, True)

    # Black wins
    assert determine_game_outcome("black", "0-1") == (True, False, False)
    assert determine_game_outcome("black", "1-0") == (False, False, True)

    # Draws
    assert determine_game_outcome("white", "1/2-1/2") == (False, True, False)
    assert determine_game_outcome("black", "1/2-1/2") == (False, True, False)
    assert determine_game_outcome("white", "1/2") == (False, True, False)
    assert determine_game_outcome("white", "½-½") == (False, True, False)

    # Unknown
    assert determine_game_outcome("white", "*") == (False, False, False)


def test_load_opening_onto_board_color_sync(monkeypatch):
    """Kiểm tra load_opening_onto_board đồng bộ màu quân và thiết lập trạng thái."""
    import streamlit as st
    from app import load_opening_onto_board

    # Mock st.rerun to prevent script termination during test
    monkeypatch.setattr(st, "rerun", lambda: None)

    st.session_state.chess_board = chess.Board()
    st.session_state.move_history = []
    st.session_state.full_analysis_line = []
    st.session_state.analysis_color_filter = "all"
    st.session_state.board_orientation = "white"

    games = [
        {
            "white": "Hero",
            "black": "Rival",
            "result": "1-0",
            "player_color": "white",
            "moves": ["e4", "c5", "Nf3", "d6", "d4"],
            "opening": "Sicilian Defense",
        },
        {
            "white": "Rival",
            "black": "Hero",
            "result": "0-1",
            "player_color": "black",
            "moves": ["d4", "Nf6", "c4", "g6"],
            "opening": "King's Indian Defense",
        }
    ]

    # Load Sicilian as White
    load_opening_onto_board("Sicilian Defense", games, color="white")
    assert st.session_state.analysis_color_filter == "white"
    assert st.session_state.board_orientation == "white"
    assert st.session_state.active_nav_page == "Analyze"
    assert len(st.session_state.move_history) > 0
    assert st.session_state.move_history[0] == "e4"

    # Load King's Indian as Black
    load_opening_onto_board("King's Indian Defense", games, color="black")
    assert st.session_state.analysis_color_filter == "black"
    assert st.session_state.board_orientation == "black"
    assert st.session_state.active_nav_page == "Analyze"
    assert len(st.session_state.move_history) > 0
    assert st.session_state.move_history[0] == "d4"




