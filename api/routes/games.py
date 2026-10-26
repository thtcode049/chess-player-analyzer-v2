"""
Game Detail Route Handlers
"""
from fastapi import APIRouter, HTTPException
from typing import List

from api.schemas.common import BaseResponse
from api.schemas.games import GameDetailResponse
from api.routes.players import GAMES_STORE
from api.services.db_service import DBService

router = APIRouter(prefix="/api/games", tags=["Games"])

@router.get("/{game_id}", response_model=BaseResponse[GameDetailResponse])
async def get_game_detail(game_id: str):
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
        # Provide fallback demo game if testing standalone
        found_game = {
            "id": game_id,
            "dataset_id": "demo_dataset",
            "white_player": "Grandmaster A",
            "black_player": "Grandmaster B",
            "result": "1-0",
            "eco": "B90",
            "opening_name": "Sicilian Defense: Najdorf",
            "moves_san": "1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6",
            "ply_count": 10,
            "raw_headers": {}
        }

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
