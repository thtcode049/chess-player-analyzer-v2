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
    AnalysisRunSyncEvaluations,
    OpeningTreeNodeResponse,
    OpeningContinuation
)
from api.services.analysis_service import AnalysisService
from api.services.import_service import ImportService
from api.services.db_service import DBService
from api.routes.players import PLAYERS_STORE, GAMES_STORE, get_guest_session
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

    # Guest Mode: strictly isolated to guest session, NEVER queries DB
    if not x_user_id:
        guest_session = get_guest_session(x_guest_session_id)
        if player_id in guest_session.get("players", {}):
            player_name = guest_session["players"][player_id].get("canonical_name", "Player")
        elif player_id in PLAYERS_STORE:
            player_name = PLAYERS_STORE[player_id].get("canonical_name", "Player")

        raw_games = guest_session.get("games", {}).get(player_id) or GAMES_STORE.get(player_id, [])
        if raw_games:
            if isinstance(raw_games[0].get("moves"), list):
                games = raw_games
            else:
                games = DBService.convert_db_games_to_analysis_games(raw_games, player_name)
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
            db_games = DBService.get_player_games(player_id, limit=500)
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
            engine_status=run_res["engine_status"],
            engine_coverage_pct=run_res["engine_coverage_pct"],
            engine_games_count=run_res["engine_games_count"],
            engine_name=run_res["engine_name"],
            engine_depth=run_res["engine_depth"],
            overall_win_rate=run_res["overall_win_rate"],
            overall_score=run_res["overall_score"],
            white_score=run_res["white_score"],
            black_score=run_res["black_score"],
            overall_acpl=run_res["overall_acpl"],
            acpl_opening=run_res["acpl_opening"],
            acpl_middlegame=run_res["acpl_middlegame"],
            acpl_endgame=run_res["acpl_endgame"],
            dominant_archetype=run_res["dominant_archetype"],
            repertoire_summary=run_res["repertoire_summary"],
            pawn_structures_summary=run_res["pawn_structures_summary"],
            style_radar_metrics=run_res["style_radar_metrics"],
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
        # GUEST MODE: Check memory cache and guest session runs only
        guest_session = get_guest_session(x_guest_session_id)
        if run_id in RUN_SNAPSHOTS_CACHE:
            cached = RUN_SNAPSHOTS_CACHE[run_id]
        elif run_id in guest_session.get("runs", {}):
            cached = guest_session["runs"][run_id]
            RUN_SNAPSHOTS_CACHE[run_id] = cached
        else:
            # Maybe run_id is a player_id in the guest session
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
                    "engine_status": db_run.get("engine_status", "statistical_only"),
                    "engine_coverage_pct": float(db_run.get("engine_coverage_pct", 0.0)),
                    "engine_games_count": db_run.get("engine_games_count", 0),
                    "engine_name": db_run.get("engine_name"),
                    "engine_depth": db_run.get("engine_depth"),
                    "overall_win_rate": float(db_run.get("overall_win_rate", 0.0)) if db_run.get("overall_win_rate") is not None else None,
                    "overall_score": float(db_run.get("overall_score", 0.0)) if db_run.get("overall_score") is not None else None,
                    "white_score": float(db_run.get("white_score", 0.0)) if db_run.get("white_score") is not None else None,
                    "black_score": float(db_run.get("black_score", 0.0)) if db_run.get("black_score") is not None else None,
                    "overall_acpl": float(db_run.get("overall_acpl")) if db_run.get("overall_acpl") is not None else None,
                    "acpl_opening": float(db_run.get("acpl_opening")) if db_run.get("acpl_opening") is not None else None,
                    "acpl_middlegame": float(db_run.get("acpl_middlegame")) if db_run.get("acpl_middlegame") is not None else None,
                    "acpl_endgame": float(db_run.get("acpl_endgame")) if db_run.get("acpl_endgame") is not None else None,
                    "dominant_archetype": db_run.get("dominant_archetype", "Universal Master"),
                    "repertoire_summary": db_run.get("repertoire_summary", {}),
                    "pawn_structures_summary": db_run.get("pawn_structures_summary", {}),
                    "style_radar_metrics": db_run.get("style_radar_metrics", {}),
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
        engine_status=cached["engine_status"],
        engine_coverage_pct=cached["engine_coverage_pct"],
        engine_games_count=cached["engine_games_count"],
        engine_name=cached["engine_name"],
        engine_depth=cached["engine_depth"],
        overall_win_rate=cached["overall_win_rate"],
        overall_score=cached["overall_score"],
        white_score=cached["white_score"],
        black_score=cached["black_score"],
        overall_acpl=cached["overall_acpl"],
        acpl_opening=cached["acpl_opening"],
        acpl_middlegame=cached["acpl_middlegame"],
        acpl_endgame=cached["acpl_endgame"],
        dominant_archetype=cached["dominant_archetype"],
        repertoire_summary=cached["repertoire_summary"],
        pawn_structures_summary=cached["pawn_structures_summary"],
        style_radar_metrics=cached["style_radar_metrics"],
        opening_tree_snapshot=cached["opening_tree_snapshot"],
        status="completed"
    )
    return BaseResponse(success=True, data=response_data)


@router.get("/runs/{run_id}/tree", response_model=BaseResponse[OpeningTreeNodeResponse])
async def query_opening_tree_branch(
    run_id: str,
    fen: str = Query("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", description="FEN position to query"),
    color: str = Query("all", description="Color filter: all, white, black"),
    x_user_id: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None)
):
    """
    Queries next available continuations from the opening tree for any given FEN position.
    Supports color filtering (all, white, black) with Transposition-Safe EPD matching.
    """
    if run_id not in RUN_SNAPSHOTS_CACHE:
        # Check guest session first if not logged in
        if not x_user_id:
            guest_session = get_guest_session(x_guest_session_id)
            if run_id in guest_session.get("runs", {}):
                RUN_SNAPSHOTS_CACHE[run_id] = guest_session["runs"][run_id]

        if run_id not in RUN_SNAPSHOTS_CACHE:
            # Check if run_id is a player_id
            games, player_name = _resolve_games_for_player(run_id, x_user_id=x_user_id, x_guest_session_id=x_guest_session_id)
            if games:
                run_res = AnalysisService.run_complete_analysis(games=games, player_name=player_name)
                _, fm_all = build_opening_tree(games, color="all")
                _, fm_w = build_opening_tree(games, color="white")
                _, fm_b = build_opening_tree(games, color="black")
                run_res["fen_map_all"] = fm_all
                run_res["fen_map_white"] = fm_w
                run_res["fen_map_black"] = fm_b
                run_res["run_id"] = run_id
                RUN_SNAPSHOTS_CACHE[run_id] = run_res
                if not x_user_id:
                    get_guest_session(x_guest_session_id)["runs"][run_id] = run_res
            else:
                raise HTTPException(status_code=404, detail="Analysis run not found")

    cached = RUN_SNAPSHOTS_CACHE[run_id]

    # Select color-specific fen_map
    c_lower = (color or "all").lower()
    if c_lower == "white":
        fen_map = cached.get("fen_map_white") or cached.get("fen_map", {})
    elif c_lower == "black":
        fen_map = cached.get("fen_map_black") or cached.get("fen_map", {})
    else:
        fen_map = cached.get("fen_map_all") or cached.get("fen_map", {})

    pos_details = AnalysisService.query_tree_position(fen_map, fen)

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


@router.post("/runs/sync-evaluations", response_model=BaseResponse[AnalysisRunResponse])
async def sync_analysis_evaluations(
    req: AnalysisRunSyncEvaluations,
    x_user_id: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None)
):
    """
    Receives complete evaluations processed by client-side Stockfish WASM.
    Updates the active snapshot cache and persists to Supabase (if logged in).
    """
    try:
        run_id = req.run_id or req.player_id
        
        # 1. Look up existing snapshot from memory or guest session
        cached = None
        if run_id in RUN_SNAPSHOTS_CACHE:
            cached = RUN_SNAPSHOTS_CACHE[run_id]
        elif req.player_id in RUN_SNAPSHOTS_CACHE:
            cached = RUN_SNAPSHOTS_CACHE[req.player_id]
        
        guest_session = get_guest_session(x_guest_session_id)
        if not cached:
            if run_id in guest_session.get("runs", {}):
                cached = guest_session["runs"][run_id]
            elif req.player_id in guest_session.get("runs", {}):
                cached = guest_session["runs"][req.player_id]

        if not cached and x_user_id:
            # Check DB
            db_run = DBService.get_analysis_run(run_id) or DBService.get_latest_analysis_run_for_player(req.player_id)
            if db_run:
                cached = db_run

        if not cached:
            # Generate baseline deterministic snapshot to update
            games, player_name = _resolve_games_for_player(req.player_id, x_user_id=x_user_id, x_guest_session_id=x_guest_session_id)
            cached = AnalysisService.run_complete_analysis(
                games=games,
                player_name=player_name,
                color_filter="all",
                run_label=f"Hồ sơ {player_name}"
            )
            _, fm_all = build_opening_tree(games, color="all")
            _, fm_w = build_opening_tree(games, color="white")
            _, fm_b = build_opening_tree(games, color="black")
            cached["fen_map_all"] = fm_all
            cached["fen_map_white"] = fm_w
            cached["fen_map_black"] = fm_b
            cached["player_name"] = player_name
            cached["player_id"] = req.player_id
            cached["run_id"] = run_id

        # 2. Update engine evaluation metrics from client WASM
        cached["engine_status"] = req.engine_status or "stockfish_wasm"
        cached["engine_name"] = req.engine_name or "Stockfish 17 WASM (Browser Pool)"
        cached["engine_depth"] = req.engine_depth or 10
        cached["engine_coverage_pct"] = float(req.engine_coverage_pct or 100.0)
        cached["engine_games_count"] = int(req.engine_games_count or cached.get("games_analyzed_count", 0))

        if req.overall_acpl is not None:
            cached["overall_acpl"] = float(req.overall_acpl)
        if req.acpl_opening is not None:
            cached["acpl_opening"] = float(req.acpl_opening)
        if req.acpl_middlegame is not None:
            cached["acpl_middlegame"] = float(req.acpl_middlegame)
        if req.acpl_endgame is not None:
            cached["acpl_endgame"] = float(req.acpl_endgame)

        if req.dominant_archetype:
            cached["dominant_archetype"] = req.dominant_archetype

        if req.style_radar_metrics:
            cached["style_radar_metrics"] = {
                **(cached.get("style_radar_metrics") or {}),
                **req.style_radar_metrics
            }

        if req.critical_positions:
            cached["critical_positions"] = req.critical_positions

        actual_run_id = cached.get("run_id") or run_id
        cached["id"] = actual_run_id
        cached["run_id"] = actual_run_id
        cached["player_id"] = req.player_id

        # Update cache
        RUN_SNAPSHOTS_CACHE[actual_run_id] = cached
        RUN_SNAPSHOTS_CACHE[req.player_id] = cached
        guest_session["runs"][actual_run_id] = cached
        guest_session["runs"][req.player_id] = cached

        # 3. Persist to Supabase if authenticated
        if x_user_id:
            try:
                DBService.save_analysis_run(req.player_id, cached, run_id=actual_run_id)
                logger.info(f"[Analysis Sync] Successfully synced and persisted run {actual_run_id} to Supabase")
            except Exception as db_err:
                logger.warning(f"[Analysis Sync] DB persist error: {db_err}")

        response_data = AnalysisRunResponse(
            id=actual_run_id,
            player_id=req.player_id,
            run_label=cached.get("run_label", "Analytical Snapshot"),
            scope_filter=cached.get("scope_filter", {}),
            games_analyzed_count=cached.get("games_analyzed_count", 0),
            engine_status=cached.get("engine_status", "stockfish_wasm"),
            engine_coverage_pct=cached.get("engine_coverage_pct", 100.0),
            engine_games_count=cached.get("engine_games_count", 0),
            engine_name=cached.get("engine_name"),
            engine_depth=cached.get("engine_depth"),
            overall_win_rate=cached.get("overall_win_rate"),
            overall_score=cached.get("overall_score"),
            white_score=cached.get("white_score"),
            black_score=cached.get("black_score"),
            overall_acpl=cached.get("overall_acpl"),
            acpl_opening=cached.get("acpl_opening"),
            acpl_middlegame=cached.get("acpl_middlegame"),
            acpl_endgame=cached.get("acpl_endgame"),
            dominant_archetype=cached.get("dominant_archetype"),
            repertoire_summary=cached.get("repertoire_summary"),
            pawn_structures_summary=cached.get("pawn_structures_summary"),
            style_radar_metrics=cached.get("style_radar_metrics"),
            opening_tree_snapshot=cached.get("opening_tree_snapshot"),
            status="completed"
        )
        return BaseResponse(success=True, message="Stockfish WASM evaluations synced successfully", data=response_data)
    except Exception as e:
        logger.error(f"[Analysis Sync] Failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to sync evaluations: {str(e)}")

