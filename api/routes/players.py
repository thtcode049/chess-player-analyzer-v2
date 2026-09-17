"""
Player Route Handlers
"""
from fastapi import APIRouter, HTTPException, Query, Header
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
import logging

from api.schemas.common import BaseResponse, PaginatedResponse
from api.schemas.players import PlayerCreate, PlayerUpdate, PlayerResponse
from api.schemas.games import GameResponse
from api.services.db_service import DBService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/players", tags=["Players"])

# In-memory store for session / local mode
PLAYERS_STORE: Dict[str, Dict[str, Any]] = {}
GAMES_STORE: Dict[str, List[Dict[str, Any]]] = {}

@router.get("", response_model=BaseResponse[List[PlayerResponse]])
async def list_players(x_user_id: Optional[str] = Header(None)):
    """
    Returns list of players for current user or all players in DB, merged with in-memory session.
    """
    players_dict: Dict[str, PlayerResponse] = {}

    # 1. Fetch from Supabase DB
    try:
        if x_user_id:
            db_players = DBService.get_players(x_user_id)
        else:
            db_players = DBService.get_all_players()

        for p in db_players:
            p_id = p["id"]
            datasets = p.get("datasets", [])
            total_g = sum(d.get("games_count", 0) for d in datasets) if datasets else len(GAMES_STORE.get(p_id, []))
            players_dict[p_id] = PlayerResponse(
                id=p_id,
                user_id=p.get("user_id", "local_user"),
                canonical_name=p["canonical_name"],
                fide_id=p.get("fide_id"),
                title=p.get("title"),
                notes=p.get("notes"),
                total_games=total_g,
                created_at=p.get("created_at") or datetime.now(),
                updated_at=p.get("updated_at") or datetime.now(),
                datasets=datasets
            )
    except Exception as e:
        logger.warning(f"Error fetching players from DB: {e}")

    # 2. Merge with in-memory PLAYERS_STORE
    for p_id, p in PLAYERS_STORE.items():
        if p_id not in players_dict:
            players_dict[p_id] = PlayerResponse(
                id=p_id,
                user_id=p.get("user_id", "local_user"),
                canonical_name=p["canonical_name"],
                fide_id=p.get("fide_id"),
                title=p.get("title"),
                notes=p.get("notes"),
                total_games=len(GAMES_STORE.get(p_id, [])),
                created_at=p.get("created_at", datetime.now()),
                updated_at=p.get("updated_at", datetime.now()),
                datasets=[]
            )

    return BaseResponse(success=True, data=list(players_dict.values()))

@router.post("", response_model=BaseResponse[PlayerResponse])
async def create_player(req: PlayerCreate, x_user_id: Optional[str] = Header(None)):
    """
    Creates a new chess player profile.
    """
    new_id = str(uuid.uuid4())
    now = datetime.now()
    user_id = x_user_id or "local_user"

    # Save to DB if user_id is present
    if x_user_id:
        try:
            db_p = DBService.upsert_player(user_id=x_user_id, canonical_name=req.canonical_name, title=req.title or "")
            new_id = db_p["id"]
        except Exception as e:
            logger.warning(f"Failed to create player in DB: {e}")

    record = {
        "id": new_id,
        "user_id": user_id,
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
        user_id=user_id,
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
async def get_player(player_id: str, x_user_id: Optional[str] = Header(None)):
    """
    Retrieves player details by ID.
    """
    if player_id in PLAYERS_STORE:
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

    # Check DB
    try:
        all_players = DBService.get_all_players()
        for p in all_players:
            if p.get("id") == player_id:
                datasets = p.get("datasets", [])
                total_g = sum(d.get("games_count", 0) for d in datasets) if datasets else 0
                return BaseResponse(success=True, data=PlayerResponse(
                    id=p["id"],
                    user_id=p.get("user_id", "local_user"),
                    canonical_name=p["canonical_name"],
                    fide_id=p.get("fide_id"),
                    title=p.get("title"),
                    notes=p.get("notes"),
                    total_games=total_g,
                    created_at=p.get("created_at") or datetime.now(),
                    updated_at=p.get("updated_at") or datetime.now(),
                    datasets=datasets
                ))
    except Exception as e:
        logger.warning(f"Error fetching player from DB: {e}")

    raise HTTPException(status_code=404, detail="Player not found")

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
    if not games:
        # Try fetching from DB
        db_games = DBService.get_player_games(player_id, limit=300)
        if db_games:
            GAMES_STORE[player_id] = db_games
            games = db_games

    # Filter
    filtered = games
    if color and color.lower() in ["white", "black"]:
        filtered = [g for g in filtered if str(g.get("player_color", "")).lower() == color.lower()]
    if eco:
        filtered = [g for g in filtered if str(g.get("eco", "")).upper().startswith(eco.upper())]
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
            site_url=g.get("site_url") or g.get("link"),
            white_player=g.get("white_player") or g.get("white", "White"),
            black_player=g.get("black_player") or g.get("black", "Black"),
            white_elo=g.get("white_elo"),
            black_elo=g.get("black_elo"),
            result=g.get("result", "*"),
            eco=g.get("eco"),
            opening_name=g.get("opening_name") or g.get("opening"),
            time_control=g.get("time_control"),
            ply_count=g.get("ply_count", len(g.get("moves", []))),
            moves_san=g.get("moves_san", " ".join(g.get("moves", []))),
            has_embedded_eval=bool(g.get("has_embedded_eval") or g.get("evaluations")),
            raw_headers=g.get("raw_headers", {})
        )
        for g in paginated_games
    ]

    return BaseResponse(
        success=True,
        data=PaginatedResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size if total > 0 else 0
        )
    )
