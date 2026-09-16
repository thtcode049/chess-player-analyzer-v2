import io
from pathlib import Path
import pytest
from src.pgn_parser import (
    parse_pgn,
    _parse_elo,
    extract_players,
    detect_primary_player,
    filter_games_by_player,
)


def test_parse_elo():
    assert _parse_elo("2795") == 2795
    assert _parse_elo("?") == 0
    assert _parse_elo("") == 0
    assert _parse_elo("invalid") == 0


def test_parse_valid_pgn_file():
    sample_path = Path("data/sample.pgn")
    games = parse_pgn(sample_path)
    
    assert len(games) == 3
    
    # Kiểm tra ván 1
    g1 = games[0]
    assert g1["white"] == "Nepomniachtchi, Ian"
    assert g1["black"] == "Ding, Liren"
    assert g1["result"] == "1/2-1/2"
    assert g1["white_elo"] == 2795
    assert g1["black_elo"] == 2788
    assert g1["eco"] == "C84"
    assert g1["moves"][0] == "e4"
    assert g1["moves"][1] == "e5"


def test_extract_players():
    sample_path = Path("data/sample.pgn")
    games = parse_pgn(sample_path)
    players_dict = extract_players(games)
    
    # Nepomniachtchi và Ding Liren đều tham gia 2 trận trong sample.pgn
    assert "Nepomniachtchi, Ian" in players_dict
    assert "Ding, Liren" in players_dict
    assert players_dict["Nepomniachtchi, Ian"] == 2
    assert players_dict["Ding, Liren"] == 2
    assert players_dict["PlayerA"] == 1


def test_detect_primary_player():
    sample_path = Path("data/sample.pgn")
    games = parse_pgn(sample_path)
    primary = detect_primary_player(games)
    
    # Kỳ thủ xuất hiện nhiều nhất phải nằm trong nhóm top 2 (Nepomniachtchi hoặc Ding Liren)
    assert primary in ["Nepomniachtchi, Ian", "Ding, Liren"]


def test_filter_games_by_player():
    sample_path = Path("data/sample.pgn")
    games = parse_pgn(sample_path)
    
    # Lọc cho Nepomniachtchi, Ian
    nep_games = filter_games_by_player(games, "Nepomniachtchi, Ian")
    assert len(nep_games) == 2
    
    # Ván 1: Nepomniachtchi cầm White
    assert nep_games[0]["player_color"] == "white"
    assert nep_games[0]["opponent"] == "Ding, Liren"

    # Ván 2: Nepomniachtchi cầm Black
    assert nep_games[1]["player_color"] == "black"
    assert nep_games[1]["opponent"] == "Ding, Liren"


def test_corrupted_pgn_handling():
    corrupted_pgn = """
[Event "Valid Game 1"]
[White "W1"]
[Black "B1"]
[Result "1-0"]

1. e4 e5 1-0

INVALID PGN HEADER WITHOUT BRACKETS
random text 123456 !!!

[Event "Valid Game 2"]
[White "W2"]
[Black "B2"]
[Result "0-1"]

1. d4 d5 0-1
"""
    stream = io.StringIO(corrupted_pgn)
    games = parse_pgn(stream)
    
    assert len(games) >= 1
    assert any(g["white"] == "W1" for g in games)


def test_non_existent_file():
    with pytest.raises(FileNotFoundError):
        parse_pgn("non_existent_file_123.pgn")


def test_auto_clean_aborted_games_filter():
    mixed_pgn = """
[Event "Real Game 1"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 1-0

[Event "Aborted Game (0 moves)"]
[White "Player1"]
[Black "Player3"]
[Result "*"]

*

[Event "Early Resignation (1 move only)"]
[White "Player1"]
[Black "Player4"]
[Result "1-0"]

1. e4 1-0

[Event "Real Game 2"]
[White "Player5"]
[Black "Player1"]
[Result "0-1"]

1. d4 d5 2. c4 e6 0-1
"""
    stream = io.StringIO(mixed_pgn)
    games = parse_pgn(stream)
    # Must automatically discard the 2 aborted / 1-move games and only keep the 2 valid games
    assert len(games) == 2
    assert games[0]["white"] == "Player1"
    assert games[1]["white"] == "Player5"


def test_pgn_metadata_and_link_extraction():
    pgn_text = """
[Event "FIDE World Championship 2023"]
[Site "Astana KAZ"]
[Date "2023.04.09"]
[Round "1"]
[White "Nepomniachtchi, Ian"]
[Black "Ding, Liren"]
[Result "1/2-1/2"]
[TimeControl "120/40:60/20:15+30"]
[Time "15:00:00"]

1. e4 e5 2. Nf3 Nc6 1/2-1/2

[Event "Live Chess"]
[Site "Chess.com"]
[Date "2024.01.15"]
[Round "-"]
[White "ChesscomPlayerA"]
[Black "ChesscomPlayerB"]
[Result "1-0"]
[Link "https://www.chess.com/game/live/987654321"]
[TimeControl "180+2"]

1. d4 d5 2. c4 c6 1-0

[Event "Rated Blitz game"]
[Site "https://lichess.org/AbCdEfGh"]
[Date "2024.02.20"]
[Round "-"]
[White "LichessUser1"]
[Black "LichessUser2"]
[Result "0-1"]

1. e4 c5 2. Nf3 d6 0-1
"""
    stream = io.StringIO(pgn_text)
    games = parse_pgn(stream)
    assert len(games) == 3

    # Game 1: Tournament OTB PGN
    g1 = games[0]
    assert g1["event"] == "FIDE World Championship 2023"
    assert g1["site"] == "Astana KAZ"
    assert g1["date"] == "2023.04.09"
    assert g1["round"] == "1"
    assert g1["time"] == "15:00:00"
    assert g1["time_control"] == "120/40:60/20:15+30"
    assert g1["link"] == ""

    # Game 2: Chess.com PGN with Link header
    g2 = games[1]
    assert g2["event"] == "Live Chess"
    assert g2["site"] == "Chess.com"
    assert g2["date"] == "2024.01.15"
    assert g2["link"] == "https://www.chess.com/game/live/987654321"
    assert g2["time_control"] == "180+2"

    # Game 3: Lichess PGN with Site as URL
    g3 = games[2]
    assert g3["event"] == "Rated Blitz game"
    assert g3["site"] == "https://lichess.org/AbCdEfGh"
    assert g3["link"] == "https://lichess.org/AbCdEfGh"



