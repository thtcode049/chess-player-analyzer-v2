"""
Player Route Handlers
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

from api.schemas.common import BaseResponse, PaginatedResponse
from api.schemas.players import PlayerCreate, PlayerUpdate, PlayerResponse
from api.schemas.games import GameResponse

router = APIRouter(prefix="/api/players", tags=["Players"])

# In-memory store for session / local mode
PLAYERS_STORE: Dict[str, Dict[str, Any]] = {}
GAMES_STORE: Dict[str, List[Dict[str, Any]]] = {}

@router.get("", response_model=BaseResponse[List[PlayerResponse]])
async def list_players():
    """
    Returns list of players for current user.
    """
    players_list = [
        PlayerResponse(
            id=p["id"],
            user_id=p.get("user_id", "local_user"),
            canonical_name=p["canonical_name"],
            fide_id=p.get("fide_id"),
            title=p.get("title"),
            notes=p.get("notes"),
            total_games=len(GAMES_STORE.get(p["id"], [])),
            created_at=p.get("created_at", datetime.now()),
            updated_at=p.get("updated_at", datetime.now()),
            datasets=[]
        )
        for p in PLAYERS_STORE.values()
    ]
    return BaseResponse(success=True, data=players_list)

@router.post("", response_model=BaseResponse[PlayerResponse])
async def create_player(req: PlayerCreate):
    """
    Creates a new chess player profile.
    """
    new_id = str(uuid.uuid4())
    now = datetime.now()
    record = {
        "id": new_id,
        "user_id": "local_user",
        "canonical_name": req.canonical_name,
        "fide_id": req.fide_id,
        "title": req.title,
        "notes": req.notes,
        "created_at": now,
        "updated_at": now
    }
    PLAYERS_STORE[new_id] = record
    response_data = PlayerResponse(
        id=new_id,
        user_id="local_user",
        canonical_name=req.canonical_name,
        fide_id=req.fide_id,
        title=req.title,
        notes=req.notes,
        total_games=0,
        created_at=now,
        updated_at=now,
        datasets=[]
    )
    return BaseResponse(success=True, message="Player created successfully", data=response_data)

@router.get("/{player_id}", response_model=BaseResponse[PlayerResponse])
async def get_player(player_id: str):
    """
    Retrieves player details by ID.
    """
    if player_id not in PLAYERS_STORE:
        raise HTTPException(status_code=404, detail="Player not found")
    p = PLAYERS_STORE[player_id]
    response_data = PlayerResponse(
        id=p["id"],
        user_id=p.get("user_id", "local_user"),
        canonical_name=p["canonical_name"],
        fide_id=p.get("fide_id"),
        title=p.get("title"),
        notes=p.get("notes"),
        total_games=len(GAMES_STORE.get(player_id, [])),
        created_at=p.get("created_at", datetime.now()),
        updated_at=p.get("updated_at", datetime.now()),
        datasets=[]
    )
    return BaseResponse(success=True, data=response_data)

@router.get("/{player_id}/games", response_model=BaseResponse[PaginatedResponse[GameResponse]])
async def list_player_games(
    player_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    color: Optional[str] = Query(None),
    eco: Optional[str] = Query(None),
    result: Optional[str] = Query(None)
):
    """
    Queries games belonging to a player with pagination and filtering.
    """
    games = GAMES_STORE.get(player_id, [])
    
    # Filter
    filtered = games
    if color and color.lower() in ["white", "black"]:
        filtered = [g for g in filtered if g.get("player_color", "").lower() == color.lower()]
    if eco:
        filtered = [g for g in filtered if str(g.get("eco", "")).startswith(eco.upper())]
    if result:
        filtered = [g for g in filtered if g.get("result") == result]

    total = len(filtered)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_games = filtered[start_idx:end_idx]

    items = [
        GameResponse(
            id=g.get("id", str(uuid.uuid4())),
            dataset_id=g.get("dataset_id", "ds_default"),
            external_id=g.get("external_id"),
            site_url=g.get("site_url"),
            white_player=g.get("white_player", "White"),
            black_player=g.get("black_player", "Black"),
            white_elo=g.get("white_elo"),
            black_elo=g.get("black_elo"),
            result=g.get("result", "*"),
            eco=g.get("eco"),
            opening_name=g.get("opening_name"),
            time_control=g.get("time_control"),
            ply_count=g.get("ply_count", 0),
            moves_san=g.get("moves_san", ""),
            has_embedded_eval=g.get("has_embedded_eval", False),
            raw_headers=g.get("raw_headers", {})
        )
        for g in paginated_games
    ]

    paginated_data = PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size if total > 0 else 1
    )
    return BaseResponse(success=True, data=paginated_data)
