import pytest
from src.game_fetcher import (
    fetch_lichess_games,
    fetch_chesscom_games,
    _normalize_lichess_perf_types,
    _normalize_chesscom_time_classes,
)

def test_fetch_empty_username():
    data, err = fetch_lichess_games("")
    assert data is None
    assert "không được để trống" in err

    data_c, err_c = fetch_chesscom_games("   ")
    assert data_c is None
    assert "không được để trống" in err_c

def test_fetch_nonexistent_user():
    data, err = fetch_lichess_games("this_user_definitely_does_not_exist_99999", perf_types=["Rapid"])
    assert data is None
    assert "không tồn tại" in err or "Lỗi" in err

    data_c, err_c = fetch_chesscom_games("this_user_definitely_does_not_exist_99999", perf_types=["Blitz", "Rapid"])
    assert data_c is None
    assert "không tồn tại" in err_c or "Lỗi" in err_c

def test_normalize_lichess_perf_types():
    assert _normalize_lichess_perf_types(None) is None
    assert _normalize_lichess_perf_types([]) is None
    res = _normalize_lichess_perf_types(["Rapid", "Blitz", "Daily / Correspondence"])
    assert "rapid" in res
    assert "blitz" in res
    assert "correspondence" in res

def test_normalize_chesscom_time_classes():
    assert _normalize_chesscom_time_classes(None) is None
    assert _normalize_chesscom_time_classes([]) is None
    res = _normalize_chesscom_time_classes(["Rapid", "Bullet"])
    assert res == {"rapid", "bullet"}
    res_classical = _normalize_chesscom_time_classes(["Classical"])
    assert "rapid" in res_classical


def test_fetch_lichess_url_pure_pgn(monkeypatch):
    from unittest.mock import MagicMock

    captured_url = []

    def mock_urlopen(req, timeout=12):
        captured_url.append(req.full_url)
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = b'[Event "Rated Blitz"]\n[White "player1"]\n[Black "player2"]\n\n1. e4 e5 2. Nf3 1-0\n'
        mock_resp.__enter__.return_value = mock_resp
        return mock_resp

    monkeypatch.setattr("urllib.request.urlopen", mock_urlopen)

    data, err = fetch_lichess_games("test_user", max_games=25, perf_types=["Blitz"])
    assert err is None
    assert data is not None
    assert len(captured_url) == 1
    assert "opening=true" in captured_url[0]
    assert "evals=true" in captured_url[0]
    assert "max=25" in captured_url[0]
    assert "perfType=blitz" in captured_url[0]


def test_fetch_lichess_with_token(monkeypatch):
    from unittest.mock import MagicMock

    captured_headers = []

    def mock_urlopen(req, timeout=15):
        captured_headers.append(req.headers)
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = b'[Event "Game"]\n1. d4 d5\n'
        mock_resp.headers = {}
        mock_resp.__enter__.return_value = mock_resp
        return mock_resp

    monkeypatch.setattr("urllib.request.urlopen", mock_urlopen)

    data, err = fetch_lichess_games("test_user", max_games=10, token="lip_sample_token123")
    assert err is None
    assert data is not None
    assert any("Authorization" in h or "authorization" in h or h.get("Authorization") == "Bearer lip_sample_token123" for h in captured_headers)


def test_fetch_chesscom_parallel(monkeypatch):
    import json
    from unittest.mock import MagicMock

    def mock_urlopen(req, timeout=10):
        url = req.full_url
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.headers = {}
        if "archives" in url:
            mock_resp.read.return_value = json.dumps({
                "archives": [
                    "https://api.chess.com/pub/player/test/games/2026/07",
                    "https://api.chess.com/pub/player/test/games/2026/08"
                ]
            }).encode('utf-8')
        else:
            mock_resp.read.return_value = json.dumps({
                "games": [
                    {"pgn": '[Event "Blitz 1"]\n1. e4 e5', "time_class": "blitz"},
                    {"pgn": '[Event "Blitz 2"]\n1. d4 d5', "time_class": "blitz"}
                ]
            }).encode('utf-8')
        mock_resp.__enter__.return_value = mock_resp
        return mock_resp

    monkeypatch.setattr("urllib.request.urlopen", mock_urlopen)

    data, err = fetch_chesscom_games("test_player", max_games=3, perf_types=["Blitz"])
    assert err is None
    assert data is not None
    assert b"Blitz 1" in data or b"Blitz 2" in data


def test_fetch_lichess_rated(monkeypatch):
    from unittest.mock import MagicMock

    captured_url = []

    def mock_urlopen(req, timeout=15):
        captured_url.append(req.full_url)
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = b'[Event "Rated Game"]\n1. e4 e5 1-0\n'
        mock_resp.__enter__.return_value = mock_resp
        return mock_resp

    monkeypatch.setattr("urllib.request.urlopen", mock_urlopen)

    data, err = fetch_lichess_games("test_user", max_games=10, rated=True)
    assert err is None
    assert "rated=true" in captured_url[0]

    captured_url.clear()
    data2, err2 = fetch_lichess_games("test_user", max_games=10, rated=False)
    assert err2 is None
    assert "rated=false" in captured_url[0]


def test_fetch_chesscom_rated(monkeypatch):
    import json
    from unittest.mock import MagicMock

    def mock_urlopen(req, timeout=10):
        url = req.full_url
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.headers = {}
        if "archives" in url:
            mock_resp.read.return_value = json.dumps({
                "archives": ["https://api.chess.com/pub/player/test/games/2026/08"]
            }).encode('utf-8')
        else:
            mock_resp.read.return_value = json.dumps({
                "games": [
                    {"pgn": '[Event "Rated Game"]\n1. e4 e5', "time_class": "rapid", "rated": True},
                    {"pgn": '[Event "Casual Game"]\n1. d4 d5', "time_class": "rapid", "rated": False}
                ]
            }).encode('utf-8')
        mock_resp.__enter__.return_value = mock_resp
        return mock_resp

    monkeypatch.setattr("urllib.request.urlopen", mock_urlopen)

    data_rated, _ = fetch_chesscom_games("test_player", max_games=5, rated=True)
    assert b"Rated Game" in data_rated
    assert b"Casual Game" not in data_rated

    data_casual, _ = fetch_chesscom_games("test_player", max_games=5, rated=False)
    assert b"Casual Game" in data_casual
    assert b"Rated Game" not in data_casual


def test_fetch_chesscom_url_link_preservation(monkeypatch):
    import json
    from unittest.mock import MagicMock

    def mock_urlopen(req, timeout=10):
        url = req.full_url
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.headers = {}
        if "archives" in url:
            mock_resp.read.return_value = json.dumps({
                "archives": ["https://api.chess.com/pub/player/test/games/2026/08"]
            }).encode('utf-8')
        else:
            mock_resp.read.return_value = json.dumps({
                "games": [
                    {
                        "url": "https://www.chess.com/game/live/123456789",
                        "pgn": '[Event "Live Chess"]\n[Site "Chess.com"]\n1. e4 e5 1-0',
                        "time_class": "blitz",
                        "rated": True
                    }
                ]
            }).encode('utf-8')
        mock_resp.__enter__.return_value = mock_resp
        return mock_resp

    monkeypatch.setattr("urllib.request.urlopen", mock_urlopen)

    data, err = fetch_chesscom_games("test_player", max_games=1)
    assert err is None
    assert data is not None
    assert b'[Link "https://www.chess.com/game/live/123456789"]' in data
