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

# Isolated in-memory sessions for guest mode: session_id -> { "players": {}, "games": {}, "runs": {} }
GUEST_SESSIONS: Dict[str, Dict[str, Any]] = {}

# Legacy in-memory store for fallback compatibility
PLAYERS_STORE: Dict[str, Dict[str, Any]] = {}
GAMES_STORE: Dict[str, List[Dict[str, Any]]] = {}


def get_guest_session(guest_session_id: Optional[str]) -> Dict[str, Any]:
    """Retrieves or creates an isolated guest session container."""
    gid = (guest_session_id or "").strip() or "default_guest"
    if gid not in GUEST_SESSIONS:
        GUEST_SESSIONS[gid] = {
            "players": {},
            "games": {},
            "runs": {}
        }
    return GUEST_SESSIONS[gid]


@router.get("", response_model=BaseResponse[List[PlayerResponse]])
async def list_players(
    x_user_id: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None)
):
    """
    Returns player list:
    - Logged-in mode (x_user_id): Queries ONLY players belonging to this user from Supabase DB.
    - Guest mode (no x_user_id): Strictly returns players created in this browser guest session.
      NEVER queries or exposes players from the database.
    """
    players_dict: Dict[str, PlayerResponse] = {}

    # 1. LOGGED-IN USER: Fetch strictly from DB filtered by x_user_id
    if x_user_id:
        try:
            db_players = DBService.get_players(x_user_id)
            for p in db_players:
                p_id = p["id"]
                datasets = p.get("datasets", [])
                total_g = sum(d.get("games_count", 0) for d in datasets) if datasets else len(GAMES_STORE.get(p_id, []))

                players_dict[p_id] = PlayerResponse(
                    id=p_id,
                    user_id=p.get("user_id", x_user_id),
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
            logger.warning(f"Error fetching players for user {x_user_id} from DB: {e}")

        return BaseResponse(success=True, data=list(players_dict.values()))

    # 2. GUEST MODE: Pure in-memory session. Never touch Supabase DB.
    session = get_guest_session(x_guest_session_id)
    guest_players = session.get("players", {})

    for p_id, p in guest_players.items():
        total_g = len(session.get("games", {}).get(p_id, []))
        players_dict[p_id] = PlayerResponse(
            id=p_id,
            user_id="guest",
            canonical_name=p["canonical_name"],
            fide_id=p.get("fide_id"),
            title=p.get("title"),
            notes=p.get("notes"),
            total_games=total_g,
            created_at=p.get("created_at", datetime.now()),
            updated_at=p.get("updated_at", datetime.now()),
            datasets=[]
        )

    return BaseResponse(success=True, data=list(players_dict.values()))


@router.post("", response_model=BaseResponse[PlayerResponse])
async def create_player(
    req: PlayerCreate,
    x_user_id: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None)
):
    """
    Creates a new chess player profile.
    - If user is logged in: Persists to Supabase DB.
    - If user is guest: Saves only in guest session memory, NEVER writes to DB.
    """
    new_id = str(uuid.uuid4())
    now = datetime.now()

    # 1. Logged-in mode
    if x_user_id:
        try:
            db_p = DBService.upsert_player(user_id=x_user_id, canonical_name=req.canonical_name, title=req.title or "")
            new_id = db_p["id"]
        except Exception as e:
            logger.warning(f"Failed to create player in DB: {e}")

        record = {
            "id": new_id,
            "user_id": x_user_id,
            "canonical_name": req.canonical_name,
            "fide_id": req.fide_id,
            "title": req.title,
            "notes": req.notes,
            "created_at": now,
            "updated_at": now
        }
        PLAYERS_STORE[new_id] = record
        return BaseResponse(
            success=True,
            message="Player created successfully in account",
            data=PlayerResponse(
                id=new_id,
                user_id=x_user_id,
                canonical_name=req.canonical_name,
                fide_id=req.fide_id,
                title=req.title,
                notes=req.notes,
                total_games=0,
                created_at=now,
                updated_at=now,
                datasets=[]
            )
        )

    # 2. Guest mode: Pure session storage, no DB write
    session = get_guest_session(x_guest_session_id)
    record = {
        "id": new_id,
        "user_id": "guest",
        "canonical_name": req.canonical_name,
        "fide_id": req.fide_id,
        "title": req.title,
        "notes": req.notes,
        "created_at": now,
        "updated_at": now
    }
    session["players"][new_id] = record
    # Also keep in PLAYERS_STORE under new_id for local routing
    PLAYERS_STORE[new_id] = record

    response_data = PlayerResponse(
        id=new_id,
        user_id="guest",
        canonical_name=req.canonical_name,
        fide_id=req.fide_id,
        title=req.title,
        notes=req.notes,
        total_games=0,
        created_at=now,
        updated_at=now,
        datasets=[]
    )
    return BaseResponse(success=True, message="Player created in guest session", data=response_data)


@router.get("/{player_id}", response_model=BaseResponse[PlayerResponse])
async def get_player(
    player_id: str,
    x_user_id: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None)
):
    """
    Retrieves player details by ID:
    - In guest mode, checks guest session.
    - In logged-in mode, checks DB / user store.
    """
    # 1. Check guest session first if in guest mode
    if not x_user_id:
        session = get_guest_session(x_guest_session_id)
        if player_id in session["players"]:
            p = session["players"][player_id]
            total_g = len(session.get("games", {}).get(player_id, []))
            return BaseResponse(success=True, data=PlayerResponse(
                id=p["id"],
                user_id="guest",
                canonical_name=p["canonical_name"],
                fide_id=p.get("fide_id"),
                title=p.get("title"),
                notes=p.get("notes"),
                total_games=total_g,
                created_at=p.get("created_at", datetime.now()),
                updated_at=p.get("updated_at", datetime.now()),
                datasets=[]
            ))

    # 2. Check in-memory store
    if player_id in PLAYERS_STORE:
        p = PLAYERS_STORE[player_id]
        total_g = len(GAMES_STORE.get(player_id, []))
        return BaseResponse(success=True, data=PlayerResponse(
            id=p["id"],
            user_id=p.get("user_id", x_user_id or "guest"),
            canonical_name=p["canonical_name"],
            fide_id=p.get("fide_id"),
            title=p.get("title"),
            notes=p.get("notes"),
            total_games=total_g,
            created_at=p.get("created_at", datetime.now()),
            updated_at=p.get("updated_at", datetime.now()),
            datasets=[]
        ))

    # 3. Check DB ONLY if user is logged in
    if x_user_id:
        try:
            db_player = DBService.get_player(player_id, x_user_id)
            if db_player:
                datasets = db_player.get("datasets", [])
                total_g = sum(d.get("games_count", 0) for d in datasets) if datasets else 0
                return BaseResponse(success=True, data=PlayerResponse(
                    id=db_player["id"],
                    user_id=db_player.get("user_id", x_user_id),
                    canonical_name=db_player["canonical_name"],
                    fide_id=db_player.get("fide_id"),
                    title=db_player.get("title"),
                    notes=db_player.get("notes"),
                    total_games=total_g,
                    created_at=db_player.get("created_at") or datetime.now(),
                    updated_at=db_player.get("updated_at") or datetime.now(),
                    datasets=datasets
                ))
        except Exception as e:
            logger.warning(f"Error fetching player from DB: {e}")

    raise HTTPException(status_code=404, detail="Player not found")


@router.get("/{player_id}/games", response_model=BaseResponse[PaginatedResponse[GameResponse]])
async def list_player_games(
    player_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    color: Optional[str] = Query(None),
    eco: Optional[str] = Query(None),
    result: Optional[str] = Query(None),
    x_user_id: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None)
):
    """
    Queries games belonging to a player with pagination and filtering.
    """
    games: List[Dict[str, Any]] = []

    # 1. Guest mode check
    if not x_user_id:
        session = get_guest_session(x_guest_session_id)
        games = session.get("games", {}).get(player_id, [])

    # 2. In-memory fallback
    if not games:
        games = GAMES_STORE.get(player_id, [])

    # 3. DB query ONLY for logged in users
    if not games and x_user_id:
        try:
            db_games = DBService.get_player_games(player_id, limit=1000)
            if db_games:
                GAMES_STORE[player_id] = db_games
                games = db_games
        except Exception as e:
            logger.warning(f"Error fetching player games from DB: {e}")

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


@router.delete("/{player_id}", response_model=BaseResponse[Dict[str, Any]])
async def delete_player(
    player_id: str,
    x_user_id: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None)
):
    """
    Deletes a player profile:
    - If guest, removes from guest session.
    - If user, removes from DB and user store.
    """
    deleted = False

    # Remove from guest session
    session = get_guest_session(x_guest_session_id)
    if player_id in session["players"]:
        del session["players"][player_id]
        deleted = True
    if player_id in session["games"]:
        del session["games"][player_id]

    if player_id in PLAYERS_STORE:
        del PLAYERS_STORE[player_id]
        deleted = True
    if player_id in GAMES_STORE:
        del GAMES_STORE[player_id]

    # Only delete from DB if user is logged in
    if x_user_id:
        try:
            sb = DBService.get_supabase()
            sb.table("players").delete().eq("id", player_id).eq("user_id", x_user_id).execute()
            deleted = True
        except Exception as e:
            logger.warning(f"Error deleting player from DB: {e}")

    return BaseResponse(success=True, message="Đã xóa hồ sơ kỳ thủ", data={"deleted": deleted, "player_id": player_id})
