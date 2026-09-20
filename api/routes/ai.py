"""
AI Coach Route Handlers (Briefings & Streaming Tactical Chat)
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import Dict, Any, Tuple, Optional
import json
import logging

from api.schemas.common import BaseResponse
from api.schemas.ai import BriefingRequest, BriefingResponse, ChatRequest
from api.services.ai_service import AIService
from api.services.db_service import DBService
from api.routes.analyses import RUN_SNAPSHOTS_CACHE, _resolve_games_for_player
from api.services.analysis_service import AnalysisService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["AI Coach"])


def _resolve_run_snapshot(run_id: str) -> Tuple[Dict[str, Any], Dict[str, Any], str]:
    """
    Resolves (stats, deep_profile, player_name) from RAM cache, DB analysis_runs,
    or on-demand player games analysis.
    """
    clean_id = run_id[4:] if run_id.startswith("run-") else run_id

    # 1. Check in-memory cache
    cached = RUN_SNAPSHOTS_CACHE.get(run_id) or RUN_SNAPSHOTS_CACHE.get(clean_id)
    if cached and cached.get("stats_raw") and cached.get("deep_profile_raw"):
        return cached["stats_raw"], cached["deep_profile_raw"], cached.get("player_name", "Kỳ thủ")

    # 2. Query Supabase analysis_runs table
    import re
    db_run = None
    if re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", clean_id, re.I):
        db_run = DBService.get_analysis_run(clean_id) or DBService.get_latest_analysis_run_for_player(clean_id)

    if db_run:
        player_id = db_run.get("player_id") or clean_id
        player_name = "Kỳ thủ"
        try:
            for p in DBService.get_all_players():
                if p.get("id") == player_id:
                    player_name = p.get("canonical_name", "Kỳ thủ")
                    break
        except Exception as e:
            logger.warning(f"Error fetching player name: {e}")

        total_games = int(db_run.get("games_analyzed_count") or 0)
        win_rate = float(db_run.get("overall_win_rate") or 50.0)
        overall_score = float(db_run.get("overall_score") or 50.0)
        white_score = float(db_run.get("white_score") or 50.0)
        black_score = float(db_run.get("black_score") or 50.0)
        wins = int(round(total_games * (win_rate / 100.0)))
        repertoire = db_run.get("repertoire_summary") or {}
        pawn_structures = db_run.get("pawn_structures_summary") or {}
        radar_m = db_run.get("style_radar_metrics") or {}
        opening_acpl = db_run.get("acpl_opening")
        middlegame_acpl = db_run.get("acpl_middlegame")
        endgame_acpl = db_run.get("acpl_endgame")
        dominant_archetype = db_run.get("dominant_archetype") or radar_m.get("dominant_archetype") or "Toàn diện (Universal)"

        total_blunders = radar_m.get("total_blunders", 0)
        blunder_rate = round(total_blunders / max(1, total_games) * 100, 1) if total_games > 0 else 0.0

        stats = {
            "total_games": total_games,
            "score_percentage": overall_score,
            "win_rate": win_rate,
            "draw_rate": 0.0,
            "loss_rate": max(0.0, round(100.0 - win_rate, 1)),
            "wins": wins,
            "draws": 0,
            "losses": max(0, total_games - wins),
            "white_games": int(round(total_games / 2)),
            "black_games": max(0, total_games - int(round(total_games / 2))),
            "white_score_percentage": white_score,
            "black_score_percentage": black_score,
        }

        deep_profile = {
            "repertoire": repertoire,
            "structures": pawn_structures,
            "phases": {
                "phases": {
                    "opening": {"avg_acpl": opening_acpl, "accuracy": max(0, min(100, int(100 - (opening_acpl or 25) * 0.8))) if opening_acpl else None},
                    "middlegame": {"avg_acpl": middlegame_acpl, "accuracy": max(0, min(100, int(100 - (middlegame_acpl or 35) * 0.8))) if middlegame_acpl else None},
                    "endgame": {"avg_acpl": endgame_acpl, "accuracy": max(0, min(100, int(100 - (endgame_acpl or 30) * 0.8))) if endgame_acpl else None},
                }
            },
            "style_profile": {
                "primary_style": dominant_archetype,
                "dominant_archetype": dominant_archetype,
                "raw_metrics": radar_m,
                "evidence": [
                    f"Đạt hiệu suất tổng thể {overall_score}% trên {total_games} ván đấu đã phân tích.",
                    f"Độ chính xác các giai đoạn: Khai cuộc ACPL {opening_acpl or 'N/A'}, Trung cuộc ACPL {middlegame_acpl or 'N/A'}, Cờ tàn ACPL {endgame_acpl or 'N/A'}.",
                    f"Chỉ số thí quân: {radar_m.get('sacrifice_rate', 0)}% | Khả năng lội ngược dòng: {radar_m.get('resilience', 50)}%."
                ]
            },
            "dynamics": {
                "blunder_rate": blunder_rate,
                "throw_rate": 0.0,
                "resilience_rate": float(radar_m.get("resilience_rate", radar_m.get("resilience", 50.0)))
            }
        }

        # Cache in memory for subsequent requests
        snapshot = {
            "stats_raw": stats,
            "deep_profile_raw": deep_profile,
            "player_name": player_name,
            "player_id": player_id,
            "run_id": db_run.get("id", run_id)
        }
        RUN_SNAPSHOTS_CACHE[run_id] = snapshot
        RUN_SNAPSHOTS_CACHE[clean_id] = snapshot
        if db_run.get("id"):
            RUN_SNAPSHOTS_CACHE[db_run["id"]] = snapshot

        return stats, deep_profile, player_name

    # 3. Fallback: try resolving games for player and running complete analysis
    if re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", clean_id, re.I):
        try:
            games, player_name = _resolve_games_for_player(clean_id)
            if games:
                run_res = AnalysisService.run_complete_analysis(
                    games=games,
                    player_name=player_name,
                    color_filter="all",
                    run_label=f"Hồ sơ {player_name}"
                )
                run_res["player_name"] = player_name
                run_res["player_id"] = clean_id
                RUN_SNAPSHOTS_CACHE[run_id] = run_res
                RUN_SNAPSHOTS_CACHE[clean_id] = run_res
                return run_res.get("stats_raw", {}), run_res.get("deep_profile_raw", {}), player_name
        except Exception as e:
            logger.warning(f"Error on-demand analyzing games for player {clean_id}: {e}")

    # 4. Final default empty state if no player or games exist
    stats = {"total_games": 0, "score_percentage": 50.0, "win_rate": 50.0}
    deep_profile = {"style_profile": {"archetype": {"primary": "Toàn diện (Universal)"}}}
    return stats, deep_profile, "Player"


@router.post("/briefing", response_model=BaseResponse[BriefingResponse])
async def generate_briefing(req: BriefingRequest):
    """
    Generates a proactive strategic briefing (Self or Opponent view) based on an analysis run.
    """
    stats, deep_profile, player_name = _resolve_run_snapshot(req.run_id)

    briefing_text, suggested_q = AIService.generate_briefing(
        player_name=player_name,
        stats=stats,
        deep_profile=deep_profile,
        perspective_mode=req.perspective_mode
    )

    data = BriefingResponse(
        run_id=req.run_id,
        perspective_mode=req.perspective_mode,
        strategic_briefing=briefing_text,
        suggested_questions=suggested_q
    )
    return BaseResponse(success=True, data=data)


@router.post("/chat-stream")
async def chat_with_ai_coach(req: ChatRequest):
    """
    Server-Sent Events (SSE) streaming endpoint for real-time tactical chess coaching.
    """
    stats, deep_profile, player_name = _resolve_run_snapshot(req.run_id)

    # Build structured Ground Truth context
    context = AIService.build_prompt_context(
        player_name=player_name,
        stats=stats,
        deep_profile=deep_profile,
        current_fen=req.current_fen
    )

    history_dicts = [{"role": m.role, "content": m.content} for m in req.history]

    def event_generator():
        try:
            for chunk in AIService.stream_chat_response(
                prompt=req.message,
                context=context,
                stats=stats,
                deep_profile=deep_profile,
                chat_history=history_dicts,
                perspective_mode=req.perspective_mode,
                player_name=player_name
            ):
                payload = json.dumps({"chunk": chunk})
                yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Chat stream generation error: {e}")
            error_payload = json.dumps({"error": str(e)})
            yield f"data: {error_payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
