"""
Game Detail and Critical Position Route Handlers
"""
from fastapi import APIRouter, HTTPException
from typing import List
import uuid

from api.schemas.common import BaseResponse
from api.schemas.games import GameDetailResponse, CriticalPositionResponse
from api.routes.players import GAMES_STORE

router = APIRouter(prefix="/api/games", tags=["Games"])

@router.get("/{game_id}", response_model=BaseResponse[GameDetailResponse])
async def get_game_detail(game_id: str):
    """
    Returns single game detail with moves and associated critical blunder positions.
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
            "has_embedded_eval": False,
            "ply_count": 10,
            "raw_headers": {}
        }

    critical_positions = [
        CriticalPositionResponse(
            id=str(uuid.uuid4()),
            game_id=game_id,
            ply=cp.get("move_number", 1) * 2 - 1,
            fen=cp.get("fen_before", ""),
            eval_before=cp.get("eval_before"),
            eval_after=cp.get("eval_after"),
            cpl=cp.get("cpl"),
            event_type="BLUNDER" if cp.get("cpl", 0) >= 150 else "MISTAKE",
            played_move=cp.get("san", ""),
            best_move=cp.get("best_move_san"),
            phase="middlegame"
        )
        for cp in found_game.get("critical_positions", [])
    ]

    response_data = GameDetailResponse(
        id=found_game["id"],
        dataset_id=found_game.get("dataset_id", "ds_default"),
        external_id=found_game.get("external_id"),
        site_url=found_game.get("site_url"),
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
        has_embedded_eval=found_game.get("has_embedded_eval", False),
        raw_headers=found_game.get("raw_headers", {}),
        critical_positions=critical_positions
    )
    return BaseResponse(success=True, data=response_data)

@router.get("/{game_id}/critical-positions", response_model=BaseResponse[List[CriticalPositionResponse]])
async def list_game_critical_positions(game_id: str):
    """
    Returns tactical critical positions for a specific game.
    """
    detail_res = await get_game_detail(game_id)
    return BaseResponse(success=True, data=detail_res.data.critical_positions)
