"""
Analysis Route Handlers (Snapshots, Bayesian Profile, Opening Tree)
"""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import Optional, Dict, Any, List
import uuid

from api.schemas.common import BaseResponse
from api.schemas.analyses import (
    AnalysisRunCreate,
    AnalysisRunResponse,
    OpeningTreeNodeResponse,
    OpeningContinuation
)
from api.services.analysis_service import AnalysisService
from api.services.import_service import ImportService

router = APIRouter(prefix="/api/analysis", tags=["Analysis"])

# In-memory session cache for fast interactive opening tree drill-down during active sessions
RUN_SNAPSHOTS_CACHE: Dict[str, Dict[str, Any]] = {}

@router.post("/runs", response_model=BaseResponse[AnalysisRunResponse])
async def create_analysis_run(req: AnalysisRunCreate):
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

        color_filter = req.scope_filter.get("color", "all")
        run_res = AnalysisService.run_complete_analysis(
            games=games,
            player_name=player_name,
            color_filter=color_filter,
            run_label=req.run_label or "Analytical Snapshot"
        )

        run_id = str(uuid.uuid4())
        RUN_SNAPSHOTS_CACHE[run_id] = run_res

        response_data = AnalysisRunResponse(
            id=run_id,
            player_id=req.player_id,
            run_label=run_res["run_label"],
            scope_filter=req.scope_filter,
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
        raise HTTPException(status_code=500, detail=f"Analysis pipeline error: {str(e)}")

@router.get("/runs/{run_id}", response_model=BaseResponse[AnalysisRunResponse])
async def get_analysis_run(run_id: str):
    """
    Retrieves complete snapshot details for a run ID.
    """
    if run_id not in RUN_SNAPSHOTS_CACHE:
        raise HTTPException(status_code=404, detail="Analysis run not found or expired from cache")

    cached = RUN_SNAPSHOTS_CACHE[run_id]
    response_data = AnalysisRunResponse(
        id=run_id,
        player_id="cached_player",
        run_label=cached["run_label"],
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
    fen: str = Query("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -", description="FEN position to query")
):
    """
    Queries next available continuations from the opening tree for any given FEN position.
    """
    if run_id not in RUN_SNAPSHOTS_CACHE:
        raise HTTPException(status_code=404, detail="Analysis run not found")

    fen_map = RUN_SNAPSHOTS_CACHE[run_id].get("fen_map", {})
    pos_details = AnalysisService.query_tree_position(fen_map, fen)

    continuations = [
        OpeningContinuation(
            san=c["san"],
            games_count=c["games_count"],
            usage_pct=c["usage_pct"],
            win_pct=c["win_pct"],
            draw_pct=c["draw_pct"],
            loss_pct=c["loss_pct"],
            score_pct=c["score_pct"]
        )
        for c in pos_details.get("continuations", [])
    ]

    result = OpeningTreeNodeResponse(
        fen=pos_details.get("fen", fen),
        games_count=pos_details.get("games_count", 0),
        continuations=continuations
    )
    return BaseResponse(success=True, data=result)
