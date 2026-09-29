"""
Unit Tests for FastAPI Resource-Oriented Endpoints
"""
import pytest
from fastapi.testclient import TestClient
import io
import json

from api.index import app

client = TestClient(app)

SAMPLE_PGN = """[Event "Live Chess"]
[Site "Chess.com"]
[Date "2024.03.15"]
[White "HeroPlayer"]
[Black "OpponentMaster"]
[Result "1-0"]
[ECO "B90"]
[WhiteElo "2400"]
[BlackElo "2350"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nb3 Be6 8. f3 1-0
"""

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["version"] == "2.0.0"

def test_import_pgn_file():
    file_bytes = io.BytesIO(SAMPLE_PGN.encode("utf-8"))
    response = client.post(
        "/api/import/pgn-file",
        files={"file": ("sample.pgn", file_bytes, "application/x-chess-pgn")},
        data={"max_games": 10}
    )
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    data = res_data["data"]
    assert data["total_found"] == 1
    assert data["imported_count"] == 1
    assert data["skipped_count"] == 0
    assert data["primary_player"] == "HeroPlayer"
    player_id = data["player_id"]

    # Deduplication test: re-importing the same game should skip duplicate!
    file_bytes2 = io.BytesIO(SAMPLE_PGN.encode("utf-8"))
    response2 = client.post(
        "/api/import/pgn-file",
        files={"file": ("sample2.pgn", file_bytes2, "application/x-chess-pgn")},
        data={"player_id": player_id, "max_games": 10}
    )
    assert response2.status_code == 200
    res_data2 = response2.json()
    assert res_data2["data"]["imported_count"] == 0
    assert res_data2["data"]["skipped_count"] == 1

    # Search & unlimited games test
    search_res = client.get(f"/api/players/{player_id}/games?search=HeroPlayer")
    assert search_res.status_code == 200
    assert len(search_res.json()["data"]["items"]) == 1

    search_empty = client.get(f"/api/players/{player_id}/games?search=NonExistentOpponent")
    assert search_empty.status_code == 200
    assert len(search_empty.json()["data"]["items"]) == 0

def test_create_and_query_analysis_run():
    # 1. Create Analysis Run
    payload = {
        "player_id": "test-player-123",
        "run_label": "Automated Test Run",
        "scope_filter": {"color": "all"},
        "raw_pgn_text": SAMPLE_PGN
    }
    response = client.post("/api/analysis/runs", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    run = res_data["data"]
    assert run["games_analyzed_count"] == 1
    assert run["overall_win_rate"] == 100.0
    assert run["status"] == "completed"
    
    run_id = run["id"]

    # 2. Get Analysis Run by ID
    get_res = client.get(f"/api/analysis/runs/{run_id}")
    assert get_res.status_code == 200
    assert get_res.json()["data"]["id"] == run_id

    # 3. Query Opening Tree Branch for root FEN
    root_fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
    tree_res = client.get(f"/api/analysis/runs/{run_id}/tree?fen={root_fen}")
    assert tree_res.status_code == 200
    tree_data = tree_res.json()["data"]
    assert len(tree_data["continuations"]) >= 1
    first_move = tree_data["continuations"][0]
    assert first_move["san"] == "e4"
    assert first_move["win_pct"] == 100.0

def test_ai_briefing_endpoint():
    payload = {
        "run_id": "mock-run-id",
        "perspective_mode": "self"
    }
    response = client.post("/api/ai/briefing", json=payload)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    data = res_data["data"]
    assert "strategic_briefing" in data
    assert len(data["suggested_questions"]) >= 1

def test_players_crud_endpoints():
    # Create player
    create_res = client.post("/api/players", json={"canonical_name": "Hikaru Nakamura", "title": "GM"})
    assert create_res.status_code == 200
    player = create_res.json()["data"]
    player_id = player["id"]
    assert player["canonical_name"] == "Hikaru Nakamura"

    # Get player
    get_res = client.get(f"/api/players/{player_id}")
    assert get_res.status_code == 200
    assert get_res.json()["data"]["id"] == player_id

    # List players
    list_res = client.get("/api/players")
    assert list_res.status_code == 200
    assert len(list_res.json()["data"]) >= 1

    # Update player (PUT)
    update_res = client.put(f"/api/players/{player_id}", json={"canonical_name": "Hikaru N.", "notes": "Grandmaster streamer"})
    assert update_res.status_code == 200
    updated_player = update_res.json()["data"]
    assert updated_player["canonical_name"] == "Hikaru N."
    assert updated_player["notes"] == "Grandmaster streamer"

    # Delete player (DELETE)
    del_res = client.delete(f"/api/players/{player_id}")
    assert del_res.status_code == 200
    assert del_res.json()["data"]["deleted"] is True

    # Verify deleted (404)
    get_after_del = client.get(f"/api/players/{player_id}")
    assert get_after_del.status_code == 404

def test_lichess_verify_token_endpoint(monkeypatch):
    import json
    from unittest.mock import MagicMock

    def mock_urlopen(req, timeout=10):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps({
            "id": "trang66",
            "username": "trang66"
        }).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        return mock_resp

    monkeypatch.setattr("urllib.request.urlopen", mock_urlopen)

    res = client.post("/api/import/lichess/verify-token", json={"token": "lip_test_token_123"})
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["valid"] is True
    assert body["data"]["username"] == "trang66"

def test_lichess_oauth_exchange_endpoint(monkeypatch):
    import json
    from unittest.mock import MagicMock

    call_count = 0
    def mock_urlopen(req, timeout=15):
        nonlocal call_count
        call_count += 1
        mock_resp = MagicMock()
        mock_resp.status = 200
        if call_count == 1:
            # Token response
            mock_resp.read.return_value = json.dumps({
                "access_token": "lip_access_token_xyz",
                "token_type": "Bearer"
            }).encode("utf-8")
        else:
            # Account response
            mock_resp.read.return_value = json.dumps({
                "id": "trang66",
                "username": "trang66"
            }).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        return mock_resp

    monkeypatch.setattr("urllib.request.urlopen", mock_urlopen)

    payload = {
        "code": "auth_code_123",
        "code_verifier": "verifier_string_456",
        "redirect_uri": "http://localhost:3000/import",
        "client_id": "http://localhost:3000"
    }
    res = client.post("/api/import/lichess/oauth-token", json=payload)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["access_token"] == "lip_access_token_xyz"
    assert body["data"]["username"] == "trang66"


def test_lichess_masters_endpoint(monkeypatch):
    root_fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

    # 1. Without token: should return unauthenticated status without calling external API
    res = client.get(f"/api/analysis/lichess-masters?fen={root_fen}")
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    data = body["data"]
    assert data["authenticated"] is False
    assert data["total_games"] == 0
    assert len(data["moves"]) == 0
    assert "Ủy quyền" in data["message"]

    # 2. With valid token: mock urllib to verify authentic master parsing
    mock_raw_response = {
        "white": 100000,
        "draws": 80000,
        "black": 70000,
        "moves": [
            {"san": "e4", "uci": "e2e4", "white": 50000, "draws": 40000, "black": 35000, "averageRating": 2550},
            {"san": "d4", "uci": "d2d4", "white": 40000, "draws": 35000, "black": 25000, "averageRating": 2560}
        ]
    }

    class MockResp:
        status = 200
        def read(self):
            return json.dumps(mock_raw_response).encode("utf-8")
        def __enter__(self):
            return self
        def __exit__(self, exc_type, exc_val, exc_tb):
            pass

    monkeypatch.setattr("urllib.request.urlopen", lambda req, timeout=8: MockResp())

    # Clear cache for this specific test FEN to force fresh live query
    from api.services.lichess_masters_service import MASTERS_CACHE
    MASTERS_CACHE.clear()

    res_auth = client.get(
        f"/api/analysis/lichess-masters?fen={root_fen}",
        headers={"X-Lichess-Token": "lip_test_bearer_token_12345"}
    )
    assert res_auth.status_code == 200
    auth_body = res_auth.json()
    assert auth_body["success"] is True
    auth_data = auth_body["data"]
    assert auth_data["authenticated"] is True
    assert auth_data["total_games"] == 250000
    assert len(auth_data["moves"]) == 2

    e4_move = next(m for m in auth_data["moves"] if m["san"] == "e4")
    assert e4_move["games_count"] == 125000
    assert e4_move["win_pct"] == 40.0
    assert e4_move["draw_pct"] == 32.0
    assert e4_move["loss_pct"] == 28.0
    assert e4_move["score_pct"] == 56.0
    assert e4_move["average_rating"] == 2550


def test_opening_tree_branch_reconstruction():
    # Verify that when an analysis run lacks fen_map_all (e.g. freshly restored from DB),
    # the endpoint automatically rebuilds the tree instead of returning empty continuations.
    from api.routes.analyses import RUN_SNAPSHOTS_CACHE

    payload = {
        "player_id": "test-player-tree-reconstruct",
        "run_label": "Tree Reconstruct Test",
        "raw_pgn_text": SAMPLE_PGN
    }
    create_res = client.post("/api/analysis/runs", json=payload)
    assert create_res.status_code == 200
    run_id = create_res.json()["data"]["id"]

    # Deliberately strip fen_map_all to simulate a run loaded purely from database columns
    assert run_id in RUN_SNAPSHOTS_CACHE
    del RUN_SNAPSHOTS_CACHE[run_id]["fen_map_all"]
    del RUN_SNAPSHOTS_CACHE[run_id]["fen_map_white"]
    del RUN_SNAPSHOTS_CACHE[run_id]["fen_map_black"]

    # Now query tree branch: it should automatically reconstruct fen_map and return continuations!
    root_fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
    tree_res = client.get(f"/api/analysis/runs/{run_id}/tree?fen={root_fen}")
    assert tree_res.status_code == 200
    tree_data = tree_res.json()["data"]
    assert len(tree_data["continuations"]) >= 1
    assert tree_data["continuations"][0]["san"] == "e4"
