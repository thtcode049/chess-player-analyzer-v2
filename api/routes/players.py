"""
Player Route Handlers
"""
from fastapi import APIRouter, HTTPException, Query, Header
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone
import uuid
import logging

from api.schemas.common import BaseResponse, PaginatedResponse
from api.schemas.players import PlayerCreate, PlayerUpdate, PlayerResponse
from api.schemas.games import GameResponse
from api.services.db_service import DBService, GUEST_SYSTEM_USER_ID

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/players", tags=["Players"])

# Isolated in-memory sessions for guest mode: session_id -> { "players": {}, "games": {}, "runs": {} }
GUEST_SESSIONS: Dict[str, Dict[str, Any]] = {}

# Legacy in-memory store for fallback compatibility
PLAYERS_STORE: Dict[str, Dict[str, Any]] = {}
GAMES_STORE: Dict[str, List[Dict[str, Any]]] = {}


def _parse_created_at(val: Any) -> datetime:
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=timezone.utc)
        return val
    if isinstance(val, str):
        try:
            dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            pass
    return datetime.now(timezone.utc)


def _build_player_response(
    p: Dict[str, Any],
    p_id: str,
    user_id: str,
    total_g: int,
    datasets: List[Any],
    is_guest: bool = False
) -> PlayerResponse:
    created = _parse_created_at(p.get("created_at"))
    updated = _parse_created_at(p.get("updated_at"))
    expires = (created + timedelta(hours=24)) if is_guest else None

    return PlayerResponse(
        id=p_id,
        user_id=user_id,
        canonical_name=p["canonical_name"],
        fide_id=p.get("fide_id"),
        title=p.get("title"),
        notes=p.get("notes"),
        total_games=total_g,
        created_at=created,
        updated_at=updated,
        datasets=datasets,
        is_guest=is_guest,
        expires_at=expires
    )


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
                ds_sum = sum(d.get("games_count", 0) for d in datasets) if datasets else 0
                total_g = max(p.get("total_games") or 0, ds_sum) or len(GAMES_STORE.get(p_id, []))

                players_dict[p_id] = _build_player_response(
                    p=p,
                    p_id=p_id,
                    user_id=p.get("user_id", x_user_id),
                    total_g=total_g,
                    datasets=datasets,
                    is_guest=False
                )
        except Exception as e:
            logger.warning(f"Error fetching players for user {x_user_id} from DB: {e}")

        return BaseResponse(success=True, data=list(players_dict.values()))

    # 2. GUEST MODE: Check in-memory session, fallback to DB tagged with guest session
    now = datetime.now(timezone.utc)
    session = get_guest_session(x_guest_session_id)
    guest_players = session.get("players", {})

    for p_id, p in list(guest_players.items()):
        p_created = _parse_created_at(p.get("created_at"))
        # 24-hour TTL check: if older than 24h, prune from guest session
        if p_created + timedelta(hours=24) < now:
            session.get("players", {}).pop(p_id, None)
            session.get("games", {}).pop(p_id, None)
            continue

        total_g = len(session.get("games", {}).get(p_id, []))
        guest_datasets = p.get("datasets", [])
        if not guest_datasets and total_g > 0:
            guest_datasets = [{
                "id": f"ds-{p_id}",
                "player_id": p_id,
                "source_type": "pgn_upload",
                "source_identifier": "Bản ghi PGN cục bộ",
                "games_count": total_g,
                "imported_at": p.get("created_at") or now
            }]
        players_dict[p_id] = _build_player_response(
            p=p,
            p_id=p_id,
            user_id="guest",
            total_g=total_g,
            datasets=guest_datasets,
            is_guest=True
        )

    # Fallback to query persistent guest players for this browser session on serverless
    if x_guest_session_id:
        try:
            db_guests = DBService.get_players_by_notes_tag(f"guest:{x_guest_session_id}")
            for p in db_guests:
                p_id = p["id"]
                p_created = _parse_created_at(p.get("created_at"))
                # 24-hour TTL check: if expired, skip and delete
                if p_created + timedelta(hours=24) < now:
                    try:
                        DBService.delete_player(p_id)
                    except Exception:
                        pass
                    continue

                if p_id not in players_dict:
                    datasets = p.get("datasets", [])
                    total_g = sum(d.get("games_count", 0) for d in datasets) if datasets else 0
                    players_dict[p_id] = _build_player_response(
                        p=p,
                        p_id=p_id,
                        user_id="guest",
                        total_g=total_g,
                        datasets=datasets,
                        is_guest=True
                    )
        except Exception:
            pass

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
            data=_build_player_response(
                p=record,
                p_id=new_id,
                user_id=x_user_id,
                total_g=0,
                datasets=[],
                is_guest=False
            )
        )

    # 2. Guest mode: Pure session storage, no DB write, no shared PLAYERS_STORE
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

    response_data = _build_player_response(
        p=record,
        p_id=new_id,
        user_id="guest",
        total_g=0,
        datasets=[],
        is_guest=True
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
    - In guest mode, checks guest session first, then falls back to Supabase DB.
    - In logged-in mode, checks in-memory store and DB.
    """
    # 1. Guest mode: check guest session memory first
    now = datetime.now(timezone.utc)
    if not x_user_id:
        session = get_guest_session(x_guest_session_id)
        if player_id in session.get("players", {}):
            p = session["players"][player_id]
            p_created = _parse_created_at(p.get("created_at"))
            # 24h TTL expiration check
            if p_created + timedelta(hours=24) < now:
                session.get("players", {}).pop(player_id, None)
                session.get("games", {}).pop(player_id, None)
                raise HTTPException(status_code=404, detail="Phiên lưu tạm 24h của hồ sơ kỳ thủ này đã hết hạn")

            total_g = len(session.get("games", {}).get(player_id, []))
            guest_datasets = p.get("datasets", [])
            if not guest_datasets and total_g > 0:
                guest_datasets = [{
                    "id": f"ds-{player_id}",
                    "player_id": player_id,
                    "source_type": "pgn_upload",
                    "source_identifier": "Bản ghi PGN cục bộ",
                    "games_count": total_g,
                    "imported_at": p.get("created_at") or now
                }]
            return BaseResponse(
                success=True,
                data=_build_player_response(
                    p=p,
                    p_id=p["id"],
                    user_id="guest",
                    total_g=total_g,
                    datasets=guest_datasets,
                    is_guest=True
                )
            )
        # Fallback to Supabase DB in case of stateless serverless lambdas
        try:
            db_player = DBService.get_player(player_id)
            if db_player:
                p_created = _parse_created_at(db_player.get("created_at"))
                if p_created + timedelta(hours=24) < now:
                    try:
                        DBService.delete_player(player_id)
                    except Exception:
                        pass
                    raise HTTPException(status_code=404, detail="Phiên lưu tạm 24h của hồ sơ kỳ thủ này đã hết hạn")

                datasets = db_player.get("datasets", [])
                total_g = sum(d.get("games_count", 0) for d in datasets) if datasets else 0
                return BaseResponse(
                    success=True,
                    data=_build_player_response(
                        p=db_player,
                        p_id=db_player["id"],
                        user_id=db_player.get("user_id", "guest"),
                        total_g=total_g,
                        datasets=datasets,
                        is_guest=True
                    )
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Error fetching guest player from DB: {e}")

        # Final memory fallback
        if player_id in PLAYERS_STORE:
            p = PLAYERS_STORE[player_id]
            p_created = _parse_created_at(p.get("created_at"))
            if p_created + timedelta(hours=24) < now:
                PLAYERS_STORE.pop(player_id, None)
                raise HTTPException(status_code=404, detail="Phiên lưu tạm 24h của hồ sơ kỳ thủ này đã hết hạn")

            total_g = len(GAMES_STORE.get(player_id, []))
            return BaseResponse(
                success=True,
                data=_build_player_response(
                    p=p,
                    p_id=p["id"],
                    user_id="guest",
                    total_g=total_g,
                    datasets=p.get("datasets", []),
                    is_guest=True
                )
            )

        raise HTTPException(status_code=404, detail="Player not found in guest session")

    # 2. Check in-memory store
    if player_id in PLAYERS_STORE:
        p = PLAYERS_STORE[player_id]
        total_g = len(GAMES_STORE.get(player_id, []))
        mem_datasets = p.get("datasets", [])
        if not mem_datasets and total_g > 0:
            mem_datasets = [{
                "id": f"ds-{player_id}",
                "player_id": player_id,
                "source_type": "pgn_upload",
                "source_identifier": "Bản ghi PGN cục bộ",
                "games_count": total_g,
                "imported_at": p.get("created_at") or now
            }]
        return BaseResponse(
            success=True,
            data=_build_player_response(
                p=p,
                p_id=p["id"],
                user_id=p.get("user_id", x_user_id),
                total_g=total_g,
                datasets=mem_datasets,
                is_guest=False
            )
        )

    # 3. Check DB fallback (supports persisted players)
    try:
        db_player = DBService.get_player(player_id, x_user_id)
        if db_player:
            datasets = db_player.get("datasets", [])
            total_g = sum(d.get("games_count", 0) for d in datasets) if datasets else 0
            is_guest = (
                db_player.get("user_id") == GUEST_SYSTEM_USER_ID
                or "guest:" in str(db_player.get("notes", ""))
            )
            return BaseResponse(
                success=True,
                data=_build_player_response(
                    p=db_player,
                    p_id=db_player["id"],
                    user_id=db_player.get("user_id", x_user_id or "shared"),
                    total_g=total_g,
                    datasets=datasets,
                    is_guest=is_guest
                )
            )
    except Exception as e:
        logger.warning(f"Error fetching player from DB: {e}")

    raise HTTPException(status_code=404, detail="Player not found")


def _parse_game_datetime(g: Dict[str, Any]) -> Optional[datetime]:
    val = g.get("played_at")
    if isinstance(val, datetime):
        return val
    if isinstance(val, str) and val.strip():
        try:
            return datetime.fromisoformat(val.replace("Z", "+00:00"))
        except Exception:
            pass

    raw_h = g.get("raw_headers") or {}
    raw_date = str(g.get("date") or raw_h.get("Date") or raw_h.get("UTCDate") or "").strip()
    if raw_date and raw_date not in ["?", "????.??.??", "????-??-??"]:
        clean_d = raw_date.replace(".", "-").replace("?", "01")
        raw_time = str(g.get("time") or raw_h.get("Time") or raw_h.get("UTCTime") or "").strip()
        if raw_time and raw_time not in ["?", "??:??:??"]:
            try:
                return datetime.fromisoformat(f"{clean_d}T{raw_time}")
            except Exception:
                pass
        try:
            return datetime.fromisoformat(clean_d)
        except Exception:
            pass
    return None


@router.get("/{player_id}/games", response_model=BaseResponse[PaginatedResponse[GameResponse]])
async def list_player_games(
    player_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=50000),
    color: Optional[str] = Query(None),
    eco: Optional[str] = Query(None),
    result: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    all_games: bool = Query(False),
    x_user_id: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None)
):
    """
    Queries games belonging to a player with pagination, full-text search, and filtering.
    Supports all_games=True for loading the complete library without limit.
    """
    games: List[Dict[str, Any]] = []

    # Guest mode: First check in-memory guest session, fallback to DB for serverless
    if not x_user_id:
        session = get_guest_session(x_guest_session_id)
        games = session.get("games", {}).get(player_id, [])
        if not games:
            try:
                db_games = DBService.get_player_games(player_id, limit=None)
                if db_games:
                    games = db_games
                    session.setdefault("games", {})[player_id] = db_games
            except Exception as e:
                logger.warning(f"Error fetching guest games from DB: {e}")
        if not games and player_id in GAMES_STORE:
            games = GAMES_STORE[player_id]
    else:
        # Logged-in mode
        try:
            db_games = DBService.get_player_games(player_id, limit=None)
            if db_games:
                GAMES_STORE[player_id] = db_games
                games = db_games
        except Exception as e:
            logger.warning(f"Error fetching player games from DB: {e}")

        if not games and player_id in GAMES_STORE:
            games = GAMES_STORE[player_id]

    # Filter by Color
    filtered = games
    if color and color.lower() in ["white", "black"]:
        filtered = [g for g in filtered if str(g.get("player_color", "")).lower() == color.lower()]

    # Filter by ECO
    if eco:
        filtered = [g for g in filtered if str(g.get("eco", "")).upper().startswith(eco.upper())]

    # Filter by Result
    if result:
        filtered = [g for g in filtered if g.get("result") == result]

    # Search by opponent, player, ECO, opening, time control, date, event
    if search:
        s_low = search.strip().lower()
        filtered = [
            g for g in filtered
            if s_low in str(g.get("white_player") or g.get("white", "")).lower()
            or s_low in str(g.get("black_player") or g.get("black", "")).lower()
            or s_low in str(g.get("eco", "")).lower()
            or s_low in str(g.get("opening_name") or g.get("opening", "")).lower()
            or s_low in str(g.get("result", "")).lower()
            or s_low in str(g.get("time_control", "") or (g.get("raw_headers") or {}).get("TimeControl", "")).lower()
            or s_low in str(g.get("played_at", "")).lower()
            or s_low in str(g.get("date", "")).lower()
            or s_low in str((g.get("raw_headers") or {}).get("Date", "")).lower()
            or s_low in str(g.get("event", "")).lower()
            or s_low in str((g.get("raw_headers") or {}).get("Event", "")).lower()
        ]

    total = len(filtered)
    if all_games or page_size >= 10000:
        paginated_games = filtered
        page = 1
        page_size = total if total > 0 else 1
    else:
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_games = filtered[start_idx:end_idx]

    items = []
    for g in paginated_games:
        raw_h = dict(g.get("raw_headers") or {})
        played_at = _parse_game_datetime(g)
        if "Date" not in raw_h and (g.get("date") or g.get("played_at")):
            raw_h["Date"] = str(g.get("date") or str(g.get("played_at")).split("T")[0])
        if "Event" not in raw_h and g.get("event"):
            raw_h["Event"] = str(g.get("event"))
        if "Site" not in raw_h and g.get("site"):
            raw_h["Site"] = str(g.get("site"))
        if "Link" not in raw_h and (g.get("site_url") or g.get("link")):
            raw_h["Link"] = str(g.get("site_url") or g.get("link"))
        if "Round" not in raw_h and g.get("round"):
            raw_h["Round"] = str(g.get("round"))
        if "TimeControl" not in raw_h and g.get("time_control"):
            raw_h["TimeControl"] = str(g.get("time_control"))
        if "WhiteElo" not in raw_h and g.get("white_elo"):
            raw_h["WhiteElo"] = str(g.get("white_elo"))
        if "BlackElo" not in raw_h and g.get("black_elo"):
            raw_h["BlackElo"] = str(g.get("black_elo"))

        items.append(
            GameResponse(
                id=str(g.get("id") or uuid.uuid4()),
                dataset_id=str(g.get("dataset_id") or "ds_default"),
                external_id=g.get("external_id"),
                site_url=g.get("site_url") or g.get("link") or raw_h.get("Link") or (raw_h.get("Site") if str(raw_h.get("Site", "")).startswith("http") else None),
                played_at=played_at,
                white_player=g.get("white_player") or g.get("white", "White"),
                black_player=g.get("black_player") or g.get("black", "Black"),
                white_elo=g.get("white_elo"),
                black_elo=g.get("black_elo"),
                result=g.get("result", "*"),
                eco=g.get("eco"),
                opening_name=g.get("opening_name") or g.get("opening"),
                time_control=g.get("time_control") or raw_h.get("TimeControl"),
                ply_count=g.get("ply_count", len(g.get("moves", []))),
                moves_san=g.get("moves_san", " ".join(g.get("moves", []))),
                raw_headers=raw_h
            )
        )

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


@router.put("/{player_id}", response_model=BaseResponse[PlayerResponse])
async def update_player(
    player_id: str,
    req: PlayerUpdate,
    x_user_id: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None)
):
    """
    Updates player information (canonical_name, fide_id, title, notes).
    Updates guest session or DB accordingly.
    """
    now = datetime.now()
    updated = False
    player_data: Optional[Dict[str, Any]] = None

    # 1. Guest mode: strictly inside guest session
    if not x_user_id:
        session = get_guest_session(x_guest_session_id)
        if player_id in session["players"]:
            p = session["players"][player_id]
            if req.canonical_name is not None:
                p["canonical_name"] = req.canonical_name.strip()
            if req.title is not None:
                p["title"] = req.title.strip() or None
            if req.fide_id is not None:
                p["fide_id"] = req.fide_id
            if req.notes is not None:
                p["notes"] = req.notes.strip() or None
            p["updated_at"] = now
            session["players"][player_id] = p
            player_data = p
            updated = True
        else:
            raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ kỳ thủ trong phiên khách")

    # 2. Logged-in mode: Check DB / user store
    else:
        if player_id in PLAYERS_STORE:
            p = PLAYERS_STORE[player_id]
            if req.canonical_name is not None:
                p["canonical_name"] = req.canonical_name.strip()
            if req.title is not None:
                p["title"] = req.title.strip() or None
            if req.fide_id is not None:
                p["fide_id"] = req.fide_id
            if req.notes is not None:
                p["notes"] = req.notes.strip() or None
            p["updated_at"] = now
            PLAYERS_STORE[player_id] = p
            player_data = p
            updated = True

        updates = {}
        if req.canonical_name is not None:
            updates["canonical_name"] = req.canonical_name.strip()
        if req.title is not None:
            updates["title"] = req.title.strip() or None
        if req.fide_id is not None:
            updates["fide_id"] = req.fide_id
        if req.notes is not None:
            updates["notes"] = req.notes.strip() or None

        if updates:
            updates["updated_at"] = now.isoformat()
            try:
                db_res = DBService.update_player(player_id, updates, user_id=x_user_id)
                if db_res:
                    player_data = db_res
                    updated = True
            except Exception as e:
                logger.warning(f"Error updating player in DB: {e}")

    if not updated or not player_data:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ kỳ thủ cần chỉnh sửa")

    # Count total games
    total_g = 0
    if not x_user_id:
        total_g = len(session.get("games", {}).get(player_id, []))
    elif player_id in GAMES_STORE:
        total_g = len(GAMES_STORE.get(player_id, []))
    elif "datasets" in player_data:
        total_g = sum(d.get("games_count", 0) for d in player_data.get("datasets", []))

    is_g = (
        not x_user_id
        or player_data.get("user_id") == "guest"
        or "guest:" in str(player_data.get("notes", ""))
    )
    response_data = _build_player_response(
        p=player_data,
        p_id=player_data["id"],
        user_id=player_data.get("user_id", x_user_id or "guest"),
        total_g=total_g,
        datasets=player_data.get("datasets", []),
        is_guest=is_g
    )
    return BaseResponse(success=True, message="Đã cập nhật hồ sơ kỳ thủ thành công", data=response_data)


@router.delete("/{player_id}", response_model=BaseResponse[Dict[str, Any]])
async def delete_player(
    player_id: str,
    x_user_id: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None)
):
    """
    Deletes a player profile:
    - If guest, removes strictly from guest session.
    - If user, cascades delete across datasets, games, analysis_runs in Supabase DB.
    - Evicts any cached analysis snapshots.
    """
    deleted = False

    # Evict cached snapshots
    try:
        from api.routes.analyses import RUN_SNAPSHOTS_CACHE
        RUN_SNAPSHOTS_CACHE.pop(player_id, None)
    except Exception:
        pass

    # If guest mode, strictly remove from guest session
    if not x_user_id:
        session = get_guest_session(x_guest_session_id)
        if player_id in session["players"]:
            del session["players"][player_id]
            deleted = True
        if player_id in session["games"]:
            del session["games"][player_id]
        if "runs" in session and player_id in session["runs"]:
            del session["runs"][player_id]
        try:
            if DBService.delete_player(player_id):
                deleted = True
        except Exception:
            pass
    else:
        # Logged-in user mode
        if player_id in PLAYERS_STORE:
            del PLAYERS_STORE[player_id]
            deleted = True
        if player_id in GAMES_STORE:
            del GAMES_STORE[player_id]

        try:
            db_deleted = DBService.delete_player(player_id, user_id=x_user_id)
            if db_deleted:
                deleted = True
        except Exception as e:
            logger.warning(f"Error deleting player from DB: {e}")

    if not deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ kỳ thủ cần xóa")

    return BaseResponse(success=True, message="Đã xóa hồ sơ kỳ thủ thành công", data={"deleted": True, "player_id": player_id})


@router.post("/claim-guest-data", response_model=BaseResponse[Dict[str, Any]])
async def claim_guest_data_endpoint(
    req: Optional[Dict[str, Any]] = None,
    x_user_id: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None)
):
    """
    Transfers guest-imported players, games, and analyses to an authenticated user account.
    Triggered when a guest logs in or registers.
    """
    effective_user_id = x_user_id or (req.get("user_id") if req else None)
    effective_guest_session = x_guest_session_id or (req.get("guest_session_id") if req else None)

    if not effective_user_id:
        raise HTTPException(status_code=401, detail="Yêu cầu đăng nhập để liên kết dữ liệu khách")
    if not effective_guest_session:
        return BaseResponse(success=True, message="Không có phiên khách nào cần chuyển đổi", data={"claimed": 0})

    claimed = DBService.claim_guest_data(effective_guest_session, effective_user_id)
    GUEST_SESSIONS.pop(effective_guest_session, None)

    return BaseResponse(
        success=True,
        message=f"Đã chuyển đổi thành công {claimed} hồ sơ kỳ thủ vào tài khoản của bạn",
        data={"claimed": claimed}
    )


@router.get("/cleanup-expired-guests")
@router.post("/cleanup-expired-guests")
async def cleanup_expired_guests(
    max_age_hours: int = 24
):
    """
    Automated or manual cron job to delete guest players, datasets, and games older than max_age_hours.
    """
    deleted = DBService.cleanup_expired_guest_data(max_age_hours=max_age_hours)
    return {
        "success": True,
        "deleted_count": deleted,
        "message": f"Đã dọn dẹp {deleted} hồ sơ khách hết hạn sau {max_age_hours} giờ"
    }

