import asyncio
from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile

from api.routes import imports
from api.services.analysis_service import AnalysisService
from api.services.db_service import DBService
from api.services.import_service import ImportService
from src.utils import determine_player_color


PGN = """[White "Nguyễn An"]
[Black "Nguyễn Bình"]
[Result "0-1"]

1. e4 e5 0-1

[White "Chỉ Ván Dở"]
[Black "Đối Thủ"]
[Result "*"]

1. d4 d5 *
"""


def pgn_upload():
    return UploadFile(file=BytesIO(PGN.encode("utf-8")), filename="games.pgn")


def test_pgn_preview_lists_only_players_with_valid_games():
    preview = asyncio.run(imports.preview_pgn_players(pgn_upload(), max_games=1000))

    assert {item.name: (item.gameCount, item.whiteCount, item.blackCount) for item in preview.data} == {
        "Nguyễn An": (1, 1, 0),
        "Nguyễn Bình": (1, 0, 1),
    }


def test_pgn_import_rejects_zero_matches_before_writing(monkeypatch):
    def unexpected_write(*args, **kwargs):
        pytest.fail("The import must not write a player or dataset when no game matches.")

    monkeypatch.setattr(DBService, "upsert_player", unexpected_write)
    monkeypatch.setattr(DBService, "create_dataset", unexpected_write)

    with pytest.raises(HTTPException) as error:
        asyncio.run(imports.import_pgn_file(
            file=pgn_upload(),
            player_id=None,
            player_name="Chỉ Ván Dở",
            alias_names=None,
            max_games=1000,
            user_id="test-user",
            x_user_id=None,
            x_guest_session_id=None,
            force_new_player=False,
        ))

    assert error.value.status_code == 422


@pytest.mark.parametrize(("white", "black", "expected"), [
    ("Nguyễn An", "Nguyễn Bình", "white"),
    ("Nguyễn Bình", "Nguyễn An", "black"),
    ("Nguyễn Anh", "Nguyễn Bình", None),
    ("nguyễn an", "Nguyễn Bình", None),
    ("Nguyen An", "Nguyễn Bình", None),
    ("Nguyễn An", "Nguyễn An", None),
])
def test_missing_color_requires_one_exact_name_match(white, black, expected):
    assert determine_player_color("Nguyễn An", white, black) == expected


def test_analysis_skips_unresolved_games():
    known = {"white": "Nguyễn Bình", "black": "Nguyễn An", "result": "0-1", "moves": ["e4", "e5"]}
    unresolved = {**known, "black": "Nguyễn Anh"}

    snapshot = AnalysisService.run_complete_analysis([known, unresolved], "Nguyễn An")

    assert snapshot["games_analyzed_count"] == 1
    assert snapshot["stats_raw"]["black_wins"] == 1
    assert snapshot["stats_raw"]["white_games"] == 0


def test_imported_color_survives_database_reload_for_different_profile_name():
    game = {"white": "AnAccount", "black": "OtherAccount", "player_color": "white", "result": "1-0"}
    row = ImportService.normalize_game_for_db(game, "dataset-id")

    reloaded = DBService.convert_db_games_to_analysis_games([row], "Nguyễn An")

    assert reloaded[0]["player_color"] == "white"
