"""
AI Coach Route Handlers (Briefings & Streaming Tactical Chat)
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from typing import Dict, Any
import json

from api.schemas.common import BaseResponse
from api.schemas.ai import BriefingRequest, BriefingResponse, ChatRequest
from api.services.ai_service import AIService
from api.routes.analyses import RUN_SNAPSHOTS_CACHE

router = APIRouter(prefix="/api/ai", tags=["AI Coach"])

@router.post("/briefing", response_model=BaseResponse[BriefingResponse])
async def generate_briefing(req: BriefingRequest):
    """
    Generates a proactive strategic briefing (Self or Opponent view) based on an analysis run.
    """
    run_data = RUN_SNAPSHOTS_CACHE.get(req.run_id)
    if not run_data:
        # Fallback dummy profile for initial empty state
        stats = {"total_games": 0, "score_percentage": 50.0, "win_rate": 50.0}
        deep_profile = {"style_profile": {"archetype": {"primary": "Universal Master"}}}
        player_name = "Player"
    else:
        stats = run_data.get("stats_raw", {})
        deep_profile = run_data.get("deep_profile_raw", {})
        player_name = run_data.get("player_name", "Player")

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
    run_data = RUN_SNAPSHOTS_CACHE.get(req.run_id, {})
    stats = run_data.get("stats_raw", {})
    deep_profile = run_data.get("deep_profile_raw", {})
    player_name = run_data.get("player_name", "Player")

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
