"""
Game Detail Route Handlers
"""
from fastapi import APIRouter, HTTPException

from api.schemas.common import BaseResponse
from api.schemas.games import GameDetailResponse
from api.routes.players import GAMES_STORE
from api.services.db_service import DBService
from api.services.import_service import ImportService

router = APIRouter(prefix="/api/games", tags=["Games"])

@router.get("/{game_id}", response_model=BaseResponse[GameDetailResponse])
def get_game_detail(game_id: str):
    """
    Returns single game detail with moves and metadata.
    """
    # Search all player stores
    found_game = None
    for games_list in GAMES_STORE.values():
        for g in games_list:
            if g.get("id") == game_id:
                found_game = g
                break
        if found_game:
            break

    if not found_game:
        # Check DB
        found_game = DBService.get_game(game_id)

    if not found_game:
        raise HTTPException(status_code=404, detail="Game not found")

    if isinstance(found_game.get("moves"), list):
        normalized = ImportService.normalize_game_for_db(
            found_game, dataset_id=found_game.get("dataset_id") or "ds_default",
        )
        found_game = {**found_game, **normalized}

    response_data = GameDetailResponse(
        id=found_game["id"],
        dataset_id=found_game.get("dataset_id", "ds_default"),
        external_id=found_game.get("external_id"),
        site_url=found_game.get("site_url"),
        played_at=found_game.get("played_at"),
        white_player=found_game.get("white_player", "White"),
        black_player=found_game.get("black_player", "Black"),
        white_elo=found_game.get("white_elo"),
        black_elo=found_game.get("black_elo"),
        result=found_game.get("result", "*"),
        eco=found_game.get("eco"),
        opening_name=found_game.get("opening_name"),
        time_control=found_game.get("time_control"),
        ply_count=found_game.get("ply_count", 0),
        moves_san=found_game.get("moves_san", ""),
        raw_headers=found_game.get("raw_headers", {})
    )
    return BaseResponse(success=True, data=response_data)
