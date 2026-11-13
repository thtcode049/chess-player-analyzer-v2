import asyncio

import pytest
from fastapi import HTTPException

from api.routes import ai, analyses, games as game_routes
from api.schemas.ai import BriefingRequest, ChatRequest
from api.schemas.analyses import AnalysisRunCreate
from api.services.analysis_service import AnalysisService, observed_profile, observed_snapshot_stats
from src.ai_assistant.context_builder import build_player_ai_context
from src.ai_assistant.local_expert import generate_local_expert_response
from src.analysis import pawn_structure


def game(game_id, result="1-0", color="white", opening="Italian Game"):
    return {
        "id": game_id,
        "white": "Alpha",
        "black": "Beta",
        "player_color": color,
        "opening": opening,
        "result": result,
        "moves": ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"],
    }


@pytest.mark.parametrize("count", [1, 2, 5])
def test_single_opening_has_one_observation_in_briefing(monkeypatch, count):
    snapshot = AnalysisService.run_complete_analysis([game(f"game-{i}") for i in range(count)], "Alpha")
    monkeypatch.setitem(ai.RUN_SNAPSHOTS_CACHE, "single-opening", {**snapshot, "player_name": "Alpha"})
    for mode in ("self", "opponent"):
        response = asyncio.run(ai.generate_briefing(BriefingRequest(run_id="single-opening", perspective_mode=mode)))
        text = response.data.strategic_briefing
        assert text.count("**Italian Game**") == 1
        assert f"{count} thắng, 0 hòa, 0 thua" in text
        assert "/analyze?gameId=game-0" in text
        assert not any(word in text.lower() for word in ("sở trường", "lỗ hổng", "xác thực", "bayes"))


def test_scope_and_draw_scoring():
    snapshot = AnalysisService.run_complete_analysis([
        game("1", "0-1"),
        game("2", "1/2-1/2"),
        game("3", color="black"),
    ], "Alpha", color_filter="white")
    assert [item["id"] for item in snapshot["games"]] == ["1", "2"]
    assert snapshot["overall_win_rate"] == 0
    assert snapshot["overall_score"] == 25
    assert snapshot["black_score"] is None
    item = snapshot["repertoire_summary"]["all_openings"][0]
    assert (item["wins"], item["draws"], item["losses"], item["score_pct"]) == (0, 1, 1, 25)
    assert item["game_indices"] == [0, 1]

    empty = AnalysisService.run_complete_analysis([game("1")], "Alpha", color_filter="black")
    assert empty["games_analyzed_count"] == 0
    assert empty["overall_score"] is None


def test_legacy_snapshot_projects_only_observed_data(monkeypatch):
    legacy = {
        "games_analyzed_count": 1,
        "overall_score": 0,
        "overall_win_rate": 0,
        "repertoire_summary": {
            "all_openings": [{
                "name": "Italian Game", "games_count": 1, "raw_score_pct": 0,
                "adjusted_score_pct": 70, "assessment": "NEUTRAL", "confidence_level": "HIGH",
            }],
            "worst_scoring": [{"name": "Italian Game"}],
        },
        "pawn_structures_summary": {"structures": [
            {"name": "Isolani", "games_count": 1, "score_pct": 0, "confidence": {"level": "HIGH"}},
        ]},
        "opening_tree_snapshot": {},
        "white_score": None,
        "black_score": None,
        "scope_filter": {"color": "all"},
    }
    monkeypatch.setitem(ai.RUN_SNAPSHOTS_CACHE, "old", legacy)
    stats, profile, _, source_games = ai._resolve_run_snapshot("old")
    assert stats == {"total_games": 1, "score_percentage": 0.0, "win_rate": 0.0}
    assert not source_games
    result = analyses.get_analysis_run("old", x_user_id="test").data
    assert result.repertoire_summary["all_openings"] == [
        {"name": "Italian Game", "games_count": 1, "score_pct": 0},
    ]
    assert "worst_scoring" not in profile["repertoire"]
    assert "confidence" not in result.pawn_structures_summary["structures"][0]


def test_legacy_exact_counts_can_be_restored():
    item = {"name": "Italian Game", "games_count": 2, "wins": 0, "draws": 0, "losses": 2}
    snapshot = {
        "games_analyzed_count": 2, "overall_score": 0,
        "repertoire_summary": {"all_openings": [item], "white_repertoire": [], "black_repertoire": [item]},
    }
    stats = observed_snapshot_stats(snapshot, observed_profile(snapshot)["repertoire"])
    assert stats["losses"] == 2
    assert stats["white_games"] == 0
    assert stats["black_games"] == 2
    assert stats["black_score_percentage"] == 0


def test_db_snapshot_reloads_only_the_games_recorded_in_that_run(monkeypatch):
    from uuid import uuid4

    run_id = str(uuid4())
    historical = [game("first", "0-1"), game("second", "1/2-1/2")]
    snapshot = AnalysisService.run_complete_analysis(historical, "Alpha")
    snapshot["repertoire_summary"]["_snapshot"] = {
        "version": 2, "stats": snapshot.pop("stats_raw"), "game_ids": ["first", "second"],
    }
    snapshot.pop("games")
    monkeypatch.setattr(ai.DBService, "get_analysis_run", lambda _: snapshot)
    monkeypatch.setattr(
        ai, "_resolve_games_for_player",
        lambda *args, **kwargs: ([game("new"), historical[1], historical[0]], "Alpha"),
    )
    stats, _, name, selected = ai._resolve_run_snapshot(run_id)
    assert name == "Alpha"
    assert stats["score_percentage"] == 25
    assert [item["id"] for item in selected] == ["first", "second"]

    monkeypatch.setattr(ai, "_resolve_games_for_player", lambda *args, **kwargs: ([game("new")], "Alpha"))
    assert ai._resolve_run_snapshot(run_id)[3] == []


def test_context_includes_all_pgns_and_prioritizes_requested_opening():
    games = [game(str(i)) for i in range(19)] + [game("requested", opening="Caro-Kann")]
    snapshot = AnalysisService.run_complete_analysis(games, "Alpha")
    sources = {}
    context = build_player_ai_context(
        snapshot["deep_profile_raw"], snapshot["stats_raw"],
        games=games, question="Cho tôi ván Caro-Kann", sources=sources,
    )
    assert "20/20 ván" in context
    pgn_section = context.split("## V. BIÊN BẢN ĐƯỢC CUNG CẤP CHO CÂU HỎI", 1)[1]
    assert pgn_section.count("**Biên bản nước đi (PGN)**") == len(games)
    assert pgn_section.index("{{G20}}") < pgn_section.index("{{G1}}")
    for index, source_game in enumerate(games, 1):
        assert f"{{{{G{index}}}}}" in pgn_section
        assert f"gameId={source_game['id']}" in sources[f"G{index}"]
    assert "Caro-Kann" in " ".join(value for key, value in sources.items() if key.startswith("S"))


def test_multi_profile_stream_resolves_sources_in_their_own_profile(monkeypatch):
    for key, name in (("first", "Alpha"), ("second", "Beta")):
        snapshot = AnalysisService.run_complete_analysis([game(key)], name)
        monkeypatch.setitem(ai.RUN_SNAPSHOTS_CACHE, key, {**snapshot, "player_name": name})

    def model_response(**kwargs):
        assert "{{P1G1}}" in kwargs["context"] and "{{P2G1}}" in kwargs["context"]
        assert kwargs["stats"] is None
        yield "{{P1"
        yield "G1}} và {{P2G1}} · {{P2G99}} · {{P2S1}}"

    monkeypatch.setattr(ai.AIService, "stream_chat_response", model_response)

    async def collect():
        response = await ai.chat_with_ai_coach(ChatRequest(
            run_id="first", player_ids=["first", "second"], message="So sánh các ván",
        ))
        return "".join([event async for event in response.body_iterator])

    import json
    events = asyncio.run(collect()).splitlines()
    content = "".join(json.loads(line[6:])["chunk"] for line in events if line.startswith("data: {"))
    assert "gameId=first" in content and "gameId=second" in content
    assert "[Nguồn chưa xác minh]" in content
    assert "1 thắng, 0 hòa, 0 thua" in content


def test_structure_membership_can_overlap_without_recounting_game(monkeypatch):
    monkeypatch.setattr(pawn_structure, "detect_all_pawn_structures", lambda *args, **kwargs: [
        {"name": "Structure A", "structure": "A"},
        {"name": "Structure B", "structure": "B"},
    ])
    snapshot = AnalysisService.run_complete_analysis([game("one", "0-1")], "Alpha")
    items = snapshot["pawn_structures_summary"]["structures"]
    assert [(item["games_count"], item["losses"], item["score_pct"]) for item in items] == [(1, 1, 0)] * 2
    assert all(item["games"][0]["id"] == "one" for item in items)
    text = generate_local_expert_response("Cấu trúc tốt", snapshot["deep_profile_raw"], snapshot["stats_raw"])
    assert "Một ván có thể xuất hiện trong nhiều nhóm" in text


def test_fallback_reports_observations_on_missing_api_key(monkeypatch):
    from src.ai_assistant import gemini_client

    monkeypatch.setattr(gemini_client, "get_server_gemini_api_key", lambda: "")
    snapshot = AnalysisService.run_complete_analysis([game("1", "0-1")], "Alpha")
    output = "".join(ai.AIService.stream_chat_response(
        prompt="Thống kê khai cuộc", context="", stats=snapshot["stats_raw"],
        deep_profile=snapshot["deep_profile_raw"],
    ))
    assert "Italian Game" in output
    assert "0.0% điểm" in output
    assert "Độ tin cậy" not in output


def test_raw_pgn_uses_the_players_actual_color(monkeypatch):
    pgn = '[White "Other"]\n[Black "Alpha"]\n[Result "0-1"]\n\n1. e4 e5 0-1\n'
    monkeypatch.setattr(analyses.ImportService, "parse_pgn_bytes", lambda data: (
        [dict(game("1", "0-1"), white="Other", black="Alpha")], "Alpha", 1,
    ))
    monkeypatch.setattr(analyses, "get_guest_session", lambda *args: {"runs": {}})
    monkeypatch.setattr(analyses, "RUN_SNAPSHOTS_CACHE", {})
    response = analyses.create_analysis_run(AnalysisRunCreate(
        player_id="", scope_filter={"color": "black"}, raw_pgn_text=pgn,
    ))
    assert response.data.games_analyzed_count == 1
    assert response.data.overall_score == 100
    assert response.data.white_score is None


def test_missing_evidence_game_returns_404(monkeypatch):
    monkeypatch.setattr(game_routes, "GAMES_STORE", {})
    monkeypatch.setattr(game_routes.DBService, "get_game", lambda _: None)
    with pytest.raises(HTTPException) as exc:
        game_routes.get_game_detail("missing")
    assert exc.value.status_code == 404


def test_inserted_game_ids_stay_with_the_correct_input(monkeypatch):
    from types import SimpleNamespace
    from api.services import db_service

    class GameTable:
        def insert(self, records):
            assert all(record["dataset_id"] == "dataset" for record in records)
            self.saved = [records[1]]
            return self

        def execute(self):
            return SimpleNamespace(data=self.saved)

    table = GameTable()
    monkeypatch.setattr(db_service, "get_supabase", lambda: SimpleNamespace(table=lambda _: table))
    records = [{"result": "1-0"}, {"result": "0-1"}]
    assert db_service.DBService.bulk_insert_games(records, "dataset") == 1
    assert "id" not in records[0]
    assert records[1]["id"] == table.saved[0]["id"]


def test_game_reference_opens_the_saved_moves(monkeypatch):
    monkeypatch.setattr(game_routes, "GAMES_STORE", {"player": [game("cited")]})
    detail = game_routes.get_game_detail("cited").data
    assert detail.white_player == "Alpha"
    assert detail.moves_san == "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5"


def test_fallback_keeps_multi_profile_summary_separate(monkeypatch):
    from src.ai_assistant import gemini_client

    monkeypatch.setattr(gemini_client, "get_server_gemini_api_key", lambda: "")
    fallback = "### Hồ sơ Alpha\n1 thắng\n\n### Hồ sơ Beta\n1 thua"
    output = "".join(ai.AIService.stream_chat_response(
        prompt="So sánh hai hồ sơ", context="", fallback_response=fallback,
    ))
    assert "Hồ sơ Alpha" in output and "Hồ sơ Beta" in output
    assert "1 thắng" in output and "1 thua" in output


def test_chat_prefers_requested_run_over_latest_player_snapshot(monkeypatch):
    for key, result in (("requested-run", "0-1"), ("player", "1-0")):
        snapshot = AnalysisService.run_complete_analysis([game(key, result)], "Alpha")
        monkeypatch.setitem(ai.RUN_SNAPSHOTS_CACHE, key, {**snapshot, "player_name": "Alpha"})

    def model_response(**kwargs):
        assert kwargs["stats"]["score_percentage"] == 0
        yield "{{G1}}"

    monkeypatch.setattr(ai.AIService, "stream_chat_response", model_response)

    async def collect():
        response = await ai.chat_with_ai_coach(ChatRequest(
            run_id="requested-run", player_id="player", message="Kết quả của lượt này",
        ))
        return "".join([event async for event in response.body_iterator])

    assert "gameId=requested-run" in asyncio.run(collect())
