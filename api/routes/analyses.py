"""
Analysis Route Handlers (Snapshots, Bayesian Profile, Opening Tree)
"""
from fastapi import APIRouter, HTTPException, Query, Body, Header
from typing import Optional, Dict, Any, List
import uuid
import logging

from api.schemas.common import BaseResponse
from api.schemas.analyses import (
    AnalysisRunCreate,
    AnalysisRunResponse,
    OpeningTreeNodeResponse,
    OpeningContinuation
)
from api.services.analysis_service import AnalysisService
from api.services.import_service import ImportService
from api.services.db_service import DBService
from api.routes.players import PLAYERS_STORE, GAMES_STORE, get_guest_session
from api.services.lichess_masters_service import LichessMastersService
from src.opening_tree import build_opening_tree

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analysis", tags=["Analysis"])

# In-memory session cache for fast interactive opening tree drill-down during active sessions
RUN_SNAPSHOTS_CACHE: Dict[str, Dict[str, Any]] = {}


def _resolve_games_for_player(
    player_id: str,
    x_user_id: Optional[str] = None,
    x_guest_session_id: Optional[str] = None
) -> tuple[List[Dict[str, Any]], str]:
    """Resolves analysis-ready game list and player canonical name from memory or Supabase."""
    player_name = "Player"
    games = []

    # Guest Mode: check guest session memory, fallback to DB for serverless
    if not x_user_id:
        guest_session = get_guest_session(x_guest_session_id)
        if player_id in guest_session.get("players", {}):
            player_name = guest_session["players"][player_id].get("canonical_name", "Player")

        raw_games = guest_session.get("games", {}).get(player_id, [])
        if raw_games:
            if isinstance(raw_games[0].get("moves"), list):
                games = raw_games
            else:
                games = DBService.convert_db_games_to_analysis_games(raw_games, player_name)
        else:
            # Fallback to DB
            try:
                db_player = DBService.get_player(player_id)
                if db_player:
                    player_name = db_player.get("canonical_name", player_name)
                db_games = DBService.get_player_games(player_id, limit=None)
                if db_games:
                    games = DBService.convert_db_games_to_analysis_games(db_games, player_name)
                    guest_session.setdefault("games", {})[player_id] = db_games
            except Exception as e:
                logger.warning(f"Error resolving guest games from DB: {e}")
    else:
        # 1. Resolve player name for authenticated user
        if player_id in PLAYERS_STORE:
            player_name = PLAYERS_STORE[player_id].get("canonical_name", "Player")
        else:
            try:
                db_player = DBService.get_player(player_id)
                if db_player:
                    player_name = db_player.get("canonical_name", "Player")
            except Exception:
                pass

        # 2. Resolve games
        if player_id in GAMES_STORE and GAMES_STORE[player_id]:
            raw_games = GAMES_STORE[player_id]
            if raw_games and isinstance(raw_games[0].get("moves"), list):
                games = raw_games
            else:
                games = DBService.convert_db_games_to_analysis_games(raw_games, player_name)
        else:
            db_games = DBService.get_player_games(player_id, limit=None)
            if db_games:
                GAMES_STORE[player_id] = db_games
                games = DBService.convert_db_games_to_analysis_games(db_games, player_name)

    # Ensure player_color is populated
    from api.services.db_service import determine_player_color
    for g in games:
        if not g.get("player_color"):
            g["player_color"] = determine_player_color(player_name, g.get("white", ""), g.get("black", ""))

    return games, player_name


@router.post("/runs", response_model=BaseResponse[AnalysisRunResponse])
async def create_analysis_run(
    req: AnalysisRunCreate,
    x_user_id: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None)
):
    """
    Executes core analysis pipeline (Statistics, Bayes, Tree, Pawn Structures, Style).
    Returns persistent analytical snapshot.
    """
    try:
        games = []
        player_name = "Player"

        # If raw PGN is supplied directly, parse it on the fly
        if req.raw_pgn_text:
            parsed_games, detected_player, _ = ImportService.parse_pgn_bytes(req.raw_pgn_text.encode("utf-8"))
            games = parsed_games
            if detected_player:
                player_name = detected_player
        elif req.player_id:
            # Luôn xóa cache cũ khi POST tạo run mới — đảm bảo Stockfish chạy lại
            RUN_SNAPSHOTS_CACHE.pop(req.player_id, None)

            # Resolve games from memory / DB (isolated in guest mode)
            games, player_name = _resolve_games_for_player(
                req.player_id,
                x_user_id=x_user_id,
                x_guest_session_id=x_guest_session_id
            )

        color_filter = req.scope_filter.get("color", "all") if req.scope_filter else "all"
        run_res = AnalysisService.run_complete_analysis(
            games=games,
            player_name=player_name,
            color_filter=color_filter,
            run_label=req.run_label or f"Hồ sơ {player_name}"
        )

        # Build color-specific opening trees for instant White/Black filtering
        _, fen_map_all = build_opening_tree(games, color="all")
        _, fen_map_white = build_opening_tree(games, color="white")
        _, fen_map_black = build_opening_tree(games, color="black")
        run_res["fen_map_all"] = fen_map_all
        run_res["fen_map_white"] = fen_map_white
        run_res["fen_map_black"] = fen_map_black
        run_res["player_name"] = player_name
        run_res["player_id"] = req.player_id

        run_id = str(uuid.uuid4())
        run_res["run_id"] = run_id
        RUN_SNAPSHOTS_CACHE[run_id] = run_res
        if req.player_id:
            RUN_SNAPSHOTS_CACHE[req.player_id] = run_res

        # If guest mode, store in guest session and DO NOT persist to Supabase DB
        if not x_user_id:
            guest_session = get_guest_session(x_guest_session_id)
            guest_session["runs"][run_id] = run_res
            if req.player_id:
                guest_session["runs"][req.player_id] = run_res
            logger.info(f"[Analysis] Stored run {run_id} in Guest session (no DB write)")
        elif req.player_id:
            # Persist to Supabase only for logged-in user
            try:
                DBService.save_analysis_run(req.player_id, run_res, run_id=run_id)
                logger.info(f"[Analysis] Persisted run {run_id} to Supabase for player {req.player_id}")
            except Exception as db_err:
                logger.warning(f"[Analysis] Could not persist run to DB: {db_err}")

        response_data = AnalysisRunResponse(
            id=run_id,
            player_id=req.player_id,
            run_label=run_res["run_label"],
            scope_filter=req.scope_filter or {},
            games_analyzed_count=run_res["games_analyzed_count"],
            overall_win_rate=run_res["overall_win_rate"],
            overall_score=run_res["overall_score"],
            white_score=run_res["white_score"],
            black_score=run_res["black_score"],
            repertoire_summary=run_res["repertoire_summary"],
            pawn_structures_summary=run_res.get("pawn_structures_summary") or {},
            opening_tree_snapshot=run_res["opening_tree_snapshot"],
            status="completed"
        )
        return BaseResponse(success=True, message="Analysis completed successfully", data=response_data)
    except Exception as e:
        logger.error(f"Analysis pipeline error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis pipeline error: {str(e)}")


@router.get("/runs/{run_id}", response_model=BaseResponse[AnalysisRunResponse])
async def get_analysis_run(
    run_id: str,
    x_user_id: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None)
):
    """
    Retrieves complete snapshot details for a run ID.
    If run_id is a player_id, dynamically generates or returns the run.
    Restores from Supabase DB only for logged-in users; guest mode strictly uses session memory.
    """
    if not x_user_id:
        # GUEST MODE: Check memory cache and guest session runs first
        guest_session = get_guest_session(x_guest_session_id)
        if run_id in RUN_SNAPSHOTS_CACHE:
            cached = RUN_SNAPSHOTS_CACHE[run_id]
        elif run_id in guest_session.get("runs", {}):
            cached = guest_session["runs"][run_id]
            RUN_SNAPSHOTS_CACHE[run_id] = cached
        else:
            # Check DB first for saved player run before expensive recalculation
            db_run = DBService.get_analysis_run(run_id) or DBService.get_latest_analysis_run_for_player(run_id)
            if db_run:
                run_dict = {
                    "id": db_run["id"],
                    "player_id": db_run.get("player_id"),
                    "run_label": db_run.get("run_label", "Analytical Snapshot"),
                    "scope_filter": db_run.get("scope_filter", {}),
                    "games_analyzed_count": db_run.get("games_analyzed_count", 0),
                    "overall_win_rate": float(db_run.get("overall_win_rate", 0.0)) if db_run.get("overall_win_rate") is not None else None,
                    "overall_score": float(db_run.get("overall_score", 0.0)) if db_run.get("overall_score") is not None else None,
                    "white_score": float(db_run.get("white_score", 0.0)) if db_run.get("white_score") is not None else None,
                    "black_score": float(db_run.get("black_score", 0.0)) if db_run.get("black_score") is not None else None,
                    "repertoire_summary": db_run.get("repertoire_summary", {}),
                    "pawn_structures_summary": db_run.get("pawn_structures_summary", {}),
                    "opening_tree_snapshot": db_run.get("opening_tree_snapshot", {}),
                    "status": "completed"
                }
                RUN_SNAPSHOTS_CACHE[run_id] = run_dict
                if db_run.get("player_id"):
                    RUN_SNAPSHOTS_CACHE[db_run["player_id"]] = run_dict
                cached = run_dict
            else:
                # Fallback: maybe run_id is a player_id in guest session / memory
                games, player_name = _resolve_games_for_player(run_id, x_user_id=None, x_guest_session_id=x_guest_session_id)
                if games:
                    run_res = AnalysisService.run_complete_analysis(
                        games=games,
                        player_name=player_name,
                        color_filter="all",
                        run_label=f"Hồ sơ {player_name}"
                    )
                    _, fm_all = build_opening_tree(games, color="all")
                    _, fm_w = build_opening_tree(games, color="white")
                    _, fm_b = build_opening_tree(games, color="black")
                    run_res["fen_map_all"] = fm_all
                    run_res["fen_map_white"] = fm_w
                    run_res["fen_map_black"] = fm_b
                    run_res["player_name"] = player_name
                    run_res["player_id"] = run_id
                    run_res["run_id"] = run_id
                    guest_session["runs"][run_id] = run_res
                    RUN_SNAPSHOTS_CACHE[run_id] = run_res
                    try:
                        DBService.save_analysis_run(run_id, run_res, run_id=run_id)
                    except Exception:
                        pass
                    cached = run_res
                else:
                    raise HTTPException(status_code=404, detail="Analysis run not found")
    else:
        # LOGGED-IN MODE: Query DB if not cached
        if run_id not in RUN_SNAPSHOTS_CACHE:
            db_run = DBService.get_analysis_run(run_id)
            if not db_run:
                db_run = DBService.get_latest_analysis_run_for_player(run_id)

            if db_run:
                run_dict = {
                    "id": db_run["id"],
                    "player_id": db_run.get("player_id"),
                    "run_label": db_run.get("run_label", "Analytical Snapshot"),
                    "scope_filter": db_run.get("scope_filter", {}),
                    "games_analyzed_count": db_run.get("games_analyzed_count", 0),
                    "overall_win_rate": float(db_run.get("overall_win_rate", 0.0)) if db_run.get("overall_win_rate") is not None else None,
                    "overall_score": float(db_run.get("overall_score", 0.0)) if db_run.get("overall_score") is not None else None,
                    "white_score": float(db_run.get("white_score", 0.0)) if db_run.get("white_score") is not None else None,
                    "black_score": float(db_run.get("black_score", 0.0)) if db_run.get("black_score") is not None else None,
                    "repertoire_summary": db_run.get("repertoire_summary", {}),
                    "pawn_structures_summary": db_run.get("pawn_structures_summary", {}),
                    "opening_tree_snapshot": db_run.get("opening_tree_snapshot", {}),
                    "status": "completed"
                }
                RUN_SNAPSHOTS_CACHE[run_id] = run_dict
                RUN_SNAPSHOTS_CACHE[db_run["id"]] = run_dict
                if db_run.get("player_id"):
                    RUN_SNAPSHOTS_CACHE[db_run["player_id"]] = run_dict
            else:
                games, player_name = _resolve_games_for_player(run_id, x_user_id=x_user_id)
                if games:
                    run_res = AnalysisService.run_complete_analysis(
                        games=games,
                        player_name=player_name,
                        color_filter="all",
                        run_label=f"Hồ sơ {player_name}"
                    )
                    _, fm_all = build_opening_tree(games, color="all")
                    _, fm_w = build_opening_tree(games, color="white")
                    _, fm_b = build_opening_tree(games, color="black")
                    run_res["fen_map_all"] = fm_all
                    run_res["fen_map_white"] = fm_w
                    run_res["fen_map_black"] = fm_b
                    run_res["player_name"] = player_name
                    run_res["player_id"] = run_id
                    run_res["run_id"] = run_id
                    RUN_SNAPSHOTS_CACHE[run_id] = run_res
                    try:
                        DBService.save_analysis_run(run_id, run_res, run_id=run_id)
                    except Exception:
                        pass
                else:
                    raise HTTPException(status_code=404, detail="Analysis run not found")

        cached = RUN_SNAPSHOTS_CACHE[run_id]

    response_data = AnalysisRunResponse(
        id=cached.get("id") or cached.get("run_id") or run_id,
        player_id=cached.get("player_id", "player"),
        run_label=cached.get("run_label", "Analytical Snapshot"),
        scope_filter={},
        games_analyzed_count=cached["games_analyzed_count"],
        overall_win_rate=cached["overall_win_rate"],
        overall_score=cached["overall_score"],
        white_score=cached["white_score"],
        black_score=cached["black_score"],
        repertoire_summary=cached["repertoire_summary"],
        pawn_structures_summary=cached.get("pawn_structures_summary") or {},
        opening_tree_snapshot=cached["opening_tree_snapshot"],
        status="completed"
    )
    return BaseResponse(success=True, data=response_data)


@router.get("/runs/{run_id}/tree", response_model=BaseResponse[OpeningTreeNodeResponse])
async def query_opening_tree_branch(
    run_id: str,
    fen: str = Query("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", description="FEN position to query"),
    color: str = Query("all", description="Color filter: all, white, black"),
    player_id: Optional[str] = Query(None, description="Optional player ID for direct resolution"),
    x_user_id: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None)
):
    """
    Queries next available continuations from the opening tree for any given FEN position.
    Supports color filtering (all, white, black) with Transposition-Safe EPD matching.
    Automatically reconstructs color-specific tree branches if not already in memory.
    """
    cached = None
    if run_id in RUN_SNAPSHOTS_CACHE:
        cached = RUN_SNAPSHOTS_CACHE[run_id]
    elif player_id and player_id in RUN_SNAPSHOTS_CACHE:
        cached = RUN_SNAPSHOTS_CACHE[player_id]

    if not cached and not x_user_id:
        guest_session = get_guest_session(x_guest_session_id)
        if run_id in guest_session.get("runs", {}):
            cached = guest_session["runs"][run_id]
        elif player_id and player_id in guest_session.get("runs", {}):
            cached = guest_session["runs"][player_id]

    # Check DB if not found in memory
    if not cached:
        db_run = DBService.get_analysis_run(run_id) or DBService.get_latest_analysis_run_for_player(player_id or run_id)
        if db_run:
            cached = {
                "id": db_run["id"],
                "player_id": db_run.get("player_id"),
                "opening_tree_snapshot": db_run.get("opening_tree_snapshot", {}),
                "games_analyzed_count": db_run.get("games_analyzed_count", 0),
            }
            RUN_SNAPSHOTS_CACHE[run_id] = cached
            if db_run.get("player_id"):
                RUN_SNAPSHOTS_CACHE[db_run["player_id"]] = cached

    target_player_id = player_id or (cached.get("player_id") if cached else None) or run_id

    # Fast-path: If querying starting position with 'all' color and cached root snapshot has continuations,
    # return immediately in 0.001s without waiting 15s to rebuild entire tree from 1000 games!
    from src.utils import normalize_fen
    norm_fen = normalize_fen(fen)
    root_epd = normalize_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    is_root = (norm_fen == root_epd)
    c_lower = (color or "all").lower()

    if is_root and c_lower == "all" and cached and cached.get("opening_tree_snapshot"):
        snap = cached.get("opening_tree_snapshot") or {}
        if snap.get("continuations"):
            pos_details = snap
            continuations = [
                OpeningContinuation(
                    san=c["san"],
                    games_count=c["games_count"],
                    usage_pct=c["usage_pct"],
                    win_pct=c["win_pct"],
                    draw_pct=c["draw_pct"],
                    loss_pct=c["loss_pct"],
                    score_pct=c["score_pct"],
                    single_game_info=c.get("single_game_info")
                )
                for c in pos_details.get("continuations", [])
            ]
            return BaseResponse(
                success=True,
                data=OpeningTreeNodeResponse(
                    fen=pos_details.get("fen", fen),
                    games_count=pos_details.get("total_games", pos_details.get("games_count", 0)),
                    in_pgn=pos_details.get("in_pgn", True),
                    total_games=pos_details.get("total_games", 0),
                    score_pct=pos_details.get("score_pct", 0.0),
                    wins=pos_details.get("wins", 0),
                    draws=pos_details.get("draws", 0),
                    losses=pos_details.get("losses", 0),
                    continuations=continuations
                )
            )

    # If fen_map_all is missing (e.g. loaded from DB without full tree map) and deep or color branch is requested,
    # build the complete opening tree maps and populate cache!
    if not cached or "fen_map_all" not in cached or not cached.get("fen_map_all"):
        games, player_name = _resolve_games_for_player(target_player_id, x_user_id=x_user_id, x_guest_session_id=x_guest_session_id)
        if games:
            _, fm_all = build_opening_tree(games, color="all")
            _, fm_w = build_opening_tree(games, color="white")
            _, fm_b = build_opening_tree(games, color="black")
            if not cached:
                cached = {"player_id": target_player_id, "run_id": run_id}
            cached["fen_map_all"] = fm_all
            cached["fen_map_white"] = fm_w
            cached["fen_map_black"] = fm_b
            cached["player_name"] = player_name
            RUN_SNAPSHOTS_CACHE[run_id] = cached
            if target_player_id:
                RUN_SNAPSHOTS_CACHE[target_player_id] = cached
        elif not cached:
            raise HTTPException(status_code=404, detail="Analysis run or games not found")

    # Select color-specific fen_map
    if c_lower == "white":
        fen_map = cached.get("fen_map_white") or cached.get("fen_map", {})
    elif c_lower == "black":
        fen_map = cached.get("fen_map_black") or cached.get("fen_map", {})
    else:
        fen_map = cached.get("fen_map_all") or cached.get("fen_map", {})

    pos_details = AnalysisService.query_tree_position(fen_map, fen)

    # Seamless fallback for initial root position if pos_details is empty
    if not pos_details.get("continuations") and is_root:
        snap = cached.get("opening_tree_snapshot") or {}
        if snap and snap.get("continuations"):
            pos_details = snap

    continuations = [
        OpeningContinuation(
            san=c["san"],
            games_count=c["games_count"],
            usage_pct=c["usage_pct"],
            win_pct=c["win_pct"],
            draw_pct=c["draw_pct"],
            loss_pct=c["loss_pct"],
            score_pct=c["score_pct"],
            single_game_info=c.get("single_game_info")
        )
        for c in pos_details.get("continuations", [])
    ]

    result = OpeningTreeNodeResponse(
        fen=pos_details.get("fen", fen),
        games_count=pos_details.get("total_games", pos_details.get("games_count", 0)),
        in_pgn=pos_details.get("in_pgn", True),
        total_games=pos_details.get("total_games", 0),
        score_pct=pos_details.get("score_pct", 0.0),
        wins=pos_details.get("wins", 0),
        draws=pos_details.get("draws", 0),
        losses=pos_details.get("losses", 0),
        continuations=continuations
    )
    return BaseResponse(success=True, data=result)


@router.get("/lichess-masters", response_model=BaseResponse[Dict[str, Any]])
async def get_lichess_masters_stats(
    fen: str = Query("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", description="FEN position to query"),
    token: Optional[str] = Query(None, description="Optional Lichess API Token"),
    x_lichess_token: Optional[str] = Header(None, description="Optional Lichess Token Header")
):
    """
    Returns Lichess Masters Database statistics (GM/IM/FM OTB games) for a given FEN position.
    Supports authenticated live requests to explorer.lichess.ovh/masters with high-speed in-memory caching
    and fallback to authentic precomputed master book.
    """
    user_token = (x_lichess_token or token or "").strip() or None
    result = LichessMastersService.get_masters_continuations(fen, user_token=user_token)
    return BaseResponse(success=True, data=result)


@router.get("/lichess-game/{game_id}", response_model=BaseResponse[Dict[str, Any]])
async def get_lichess_master_game_detail(
    game_id: str,
    token: Optional[str] = Query(None, description="Optional Lichess Token"),
    x_lichess_token: Optional[str] = Header(None, description="Optional Lichess Token Header")
):
    """
    Fetches full game details and complete move sequence from Lichess by game ID.
    Used to view and replay full master games in the analysis board.
    """
    try:
        user_token = (x_lichess_token or token or "").strip() or None
        game_detail = LichessMastersService.get_master_game(game_id, user_token=user_token)
        return BaseResponse(success=True, data=game_detail)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/openings/canonical", response_model=BaseResponse[Dict[str, Any]])
def get_canonical_opening(
    name: Optional[str] = Query(None, description="Opening name to look up"),
    moves: Optional[str] = Query(None, description="Comma-separated or space-separated SAN moves")
):
    """
    Tra cứu thông tin khai cuộc chuẩn (ECO, moves, FEN, PGN) từ bộ dữ liệu Lichess Openings (3,865 biến thể).
    """
    from src.pgn_parser import find_opening_by_name, find_opening_by_moves

    if moves:
        moves_list = [m.strip() for m in moves.replace(",", " ").split() if m.strip()]
        matched = find_opening_by_moves(moves_list)
        if matched:
            return BaseResponse(success=True, data=matched)

    if name:
        matched = find_opening_by_name(name)
        if matched:
            return BaseResponse(success=True, data=matched)

    raise HTTPException(status_code=404, detail="Opening not found in Lichess openings database")


