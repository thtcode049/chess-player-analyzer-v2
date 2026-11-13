"""
AI Coach Route Handlers (Briefings & Streaming Tactical Chat)
"""
from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from typing import Dict, Any, Tuple, Optional, List
import json
import uuid
import logging
import re

from api.schemas.common import BaseResponse
from api.schemas.ai import (
    BriefingRequest,
    BriefingResponse,
    ChatRequest,
    ChatSessionResponse,
    ChatSessionCreateRequest,
    ChatSessionUpdateRequest,
)
from api.services.ai_service import AIService
from api.services.db_service import DBService
from api.routes.analyses import RUN_SNAPSHOTS_CACHE, _resolve_games_for_player
from api.services.analysis_service import AnalysisService, observed_profile, observed_snapshot_stats
from src.ai_assistant.context_builder import resolve_chat_position

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])


def _resolve_run_snapshot(
    run_id: str,
    x_user_id: Optional[str] = None,
    x_guest_session_id: Optional[str] = None
) -> Tuple[Dict[str, Any], Dict[str, Any], str, List[Dict[str, Any]]]:
    """
    Resolves (stats, deep_profile, player_name, games) from RAM cache, DB analysis_runs,
    or on-demand player games analysis.
    """
    clean_id = run_id[4:] if run_id.startswith("run-") else run_id

    # 1. Check in-memory cache
    cached = RUN_SNAPSHOTS_CACHE.get(run_id) or RUN_SNAPSHOTS_CACHE.get(clean_id)
    if cached and "repertoire_summary" in cached:
        profile = observed_profile(cached)
        stats = observed_snapshot_stats(cached, profile["repertoire"])
        if cached.get("snapshot_version") == 2:
            return stats, profile, cached.get("player_name", "Kỳ thủ"), cached["games"]

    # 2. Query Supabase analysis_runs table
    db_run = None
    if re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", clean_id, re.I):
        db_run = DBService.get_analysis_run(clean_id) or DBService.get_latest_analysis_run_for_player(clean_id)

    if db_run:
        player_id = db_run.get("player_id") or clean_id
        player_name = "Kỳ thủ"
        games = []
        profile = observed_profile(db_run)
        stats = observed_snapshot_stats(db_run, profile["repertoire"])
        metadata = (db_run.get("repertoire_summary") or {}).get("_snapshot") or {}
        game_ids = metadata.get("game_ids", [])
        if metadata.get("version") == 2 and game_ids and all(game_ids):
            try:
                available, player_name = _resolve_games_for_player(
                    player_id, x_user_id=x_user_id, x_guest_session_id=x_guest_session_id,
                )
                by_id = {game.get("id"): game for game in available}
                if len(game_ids) == stats.get("total_games") and all(game_id in by_id for game_id in game_ids):
                    games = [by_id[game_id] for game_id in game_ids]
            except Exception as exc:
                logger.warning("Could not resolve snapshot games: %s", exc)
        if player_name in ("Kỳ thủ", "Player"):
            try:
                player = DBService.get_player(player_id) or {}
                player_name = player.get("canonical_name") or "Kỳ thủ"
            except Exception as exc:
                logger.warning("Could not resolve player name: %s", exc)
        return stats, profile, player_name, games

    if cached and "repertoire_summary" in cached:
        return stats, profile, cached.get("player_name", "Kỳ thủ"), []

    # 3. Fallback: try resolving games for player and running complete analysis
    if re.match(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", clean_id, re.I):
        try:
            games, player_name = _resolve_games_for_player(
                clean_id,
                x_user_id=x_user_id,
                x_guest_session_id=x_guest_session_id
            )
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
                return run_res["stats_raw"], run_res["deep_profile_raw"], player_name, run_res["games"]
        except Exception as e:
            logger.warning(f"Error on-demand analyzing games for player {clean_id}: {e}")

    # 4. Final default empty state if no player or games exist
    stats = {"total_games": 0}
    deep_profile = {"repertoire": {}, "structures": {}}
    return stats, deep_profile, "Player", []


@router.post("/briefing", response_model=BaseResponse[BriefingResponse])
async def generate_briefing(
    req: BriefingRequest,
    x_user_id: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None)
):
    """
    Generates a proactive strategic briefing (Self or Opponent view) based on an analysis run.
    """
    stats, deep_profile, player_name, games = _resolve_run_snapshot(
        req.run_id,
        x_user_id=x_user_id,
        x_guest_session_id=x_guest_session_id
    )
    effective_mode = "opponent" if req.perspective_mode == "opponent" else "self"

    briefing_text, suggested_q = AIService.generate_briefing(
        player_name=player_name,
        stats=stats,
        deep_profile=deep_profile,
        perspective_mode=effective_mode,
        games=games,
    )

    data = BriefingResponse(
        run_id=req.run_id,
        perspective_mode=effective_mode,
        strategic_briefing=briefing_text,
        suggested_questions=suggested_q
    )
    return BaseResponse(success=True, data=data)

EVIDENCE_REFERENCE = re.compile(r"\{\{((?:P[0-9]+)?[GS][0-9]+|CURRENT_FEN)\}\}")
PARTIAL_REFERENCE = re.compile(r"\{(?:\{[A-Z0-9_]*\}?)?$")


def _render_evidence_stream(chunks, sources):
    """Resolve only references supplied for this request, including split stream chunks."""
    pending = ""

    def render(text):
        return EVIDENCE_REFERENCE.sub(
            lambda match: sources.get(match[1], "[Nguồn chưa xác minh]"), text,
        )

    for chunk in chunks:
        text = pending + chunk
        partial = PARTIAL_REFERENCE.search(text)
        if partial:
            pending = partial[0]
            text = text[:partial.start()]
        else:
            pending = ""
        if text:
            yield render(text)
    if pending:
        yield "[Nguồn chưa xác minh]"


@router.post("/chat-stream")
async def chat_with_ai_coach(
    req: ChatRequest,
    x_user_id: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None)
):
    """
    Server-Sent Events (SSE) streaming endpoint for real-time tactical chess coaching.
    """
    target_ids = [pid for pid in (req.player_ids or []) if pid and pid != "general"]
    if not target_ids and req.player_id and req.player_id != "general":
        target_ids = [req.player_id]

    sources: Dict[str, str] = {}
    fallback_response = None
    effective_perspective = "opponent" if req.perspective_mode == "opponent" else "self"
    is_board_open = req.is_board_open is not False
    current_fen, engine_eval = resolve_chat_position(
        req.current_fen if is_board_open else None, req.selected_game, req.engine_eval,
    )
    if current_fen:
        sources["CURRENT_FEN"] = current_fen
    if len(target_ids) > 1:
        # Multi-profile mode: Resolve snapshots and build composite ground truth context
        contexts = []
        summaries = []
        names = []
        for index, pid in enumerate(target_ids, 1):
            p_stats, p_deep_profile, p_name, p_games = _resolve_run_snapshot(
                pid,
                x_user_id=x_user_id,
                x_guest_session_id=x_guest_session_id
            )
            names.append(p_name)
            summary, _ = AIService.generate_briefing(
                p_name, p_stats, p_deep_profile, effective_perspective, games=p_games,
            )
            summaries.append(summary)
            p_context = AIService.build_prompt_context(
                player_name=p_name,
                stats=p_stats,
                deep_profile=p_deep_profile,
                current_fen=current_fen,
                engine_eval=engine_eval,
                selected_game=req.selected_game,
                is_board_open=is_board_open,
                games=p_games,
                question=req.message,
                sources=sources,
                source_prefix=f"P{index}",
            )
            contexts.append(f"### DỮ LIỆU HỒ SƠ KỲ THỦ: {p_name}\n{p_context}")

        combined_player_name = " & ".join(names)
        context = (
            f"=== CHẾ ĐỘ PHÂN TÍCH ĐA HỒ SƠ (MULTI-PROFILE MATCHUP) ===\n"
            f"Người dùng đang chọn cùng lúc {len(names)} hồ sơ kỳ thủ ({combined_player_name}) để đối chiếu, so sánh phong cách, khai cuộc và chiến thuật đối đầu.\n\n"
            + ("\n\n" + "=" * 40 + "\n\n").join(contexts)
        )
        fallback_response = "\n\n".join(summaries)
        stats = None
        deep_profile = None
        player_name = combined_player_name
    else:
        target_id = req.run_id
        if target_id in ("", "general", "run-general", "default_run", "multi"):
            target_id = target_ids[0] if target_ids else "general"
        stats, deep_profile, player_name, games = _resolve_run_snapshot(
            target_id,
            x_user_id=x_user_id,
            x_guest_session_id=x_guest_session_id
        )
        context = AIService.build_prompt_context(
            player_name=player_name,
            stats=stats,
            deep_profile=deep_profile,
            current_fen=current_fen,
            engine_eval=engine_eval,
            selected_game=req.selected_game,
            is_board_open=is_board_open,
            games=games,
            question=req.message,
            sources=sources,
        )

    history_dicts = [{"role": m.role, "content": m.content} for m in req.history]

    def event_generator():
        try:
            chunks = AIService.stream_chat_response(
                prompt=req.message,
                context=context,
                stats=stats,
                deep_profile=deep_profile,
                chat_history=history_dicts,
                perspective_mode=effective_perspective,
                player_name=player_name,
                current_fen=current_fen,
                engine_eval=engine_eval,
                fallback_response=fallback_response,
            )
            for chunk in _render_evidence_stream(chunks, sources):
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


# =============================================================================
# AI CHAT SESSIONS CRUD (SUPABASE CROSS-DEVICE PERSISTENCE)
# =============================================================================

@router.get("/sessions", response_model=BaseResponse[List[ChatSessionResponse]])
async def list_chat_sessions(x_user_id: Optional[str] = Header(None)):
    """
    List AI chat sessions for the authenticated user, ordered by pinned DESC, updated_at DESC.
    Returns empty list for guest users.
    """
    if not x_user_id:
        return BaseResponse(success=True, data=[])

    sessions = DBService.get_chat_sessions(x_user_id)
    return BaseResponse(success=True, data=sessions)


@router.get("/sessions/{session_id}", response_model=BaseResponse[ChatSessionResponse])
async def get_chat_session(session_id: str, x_user_id: Optional[str] = Header(None)):
    """
    Get a single chat session by ID.
    """
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Yêu cầu đăng nhập để truy cập lịch sử chat")

    session = DBService.get_chat_session(session_id, x_user_id)
    if not session:
        raise HTTPException(status_code=404, detail="Không tìm thấy cuộc trò chuyện")

    return BaseResponse(success=True, data=session)


@router.post("/sessions", response_model=BaseResponse[ChatSessionResponse])
async def create_chat_session(req: ChatSessionCreateRequest, x_user_id: Optional[str] = Header(None)):
    """
    Create or persist a new AI chat session.
    """
    if not x_user_id:
        # Guest fallback: Return transient session representation
        guest_session = req.model_dump()
        guest_session["id"] = guest_session.get("id") or f"guest_{uuid.uuid4().hex}"
        guest_session["user_id"] = "guest"
        return BaseResponse(success=True, data=guest_session)

    saved = DBService.upsert_chat_session(req.model_dump(), x_user_id)
    if not saved:
        fallback_session = req.model_dump()
        fallback_session["id"] = fallback_session.get("id") or str(uuid.uuid4())
        fallback_session["user_id"] = x_user_id
        return BaseResponse(success=True, data=fallback_session)

    return BaseResponse(success=True, data=saved)


@router.patch("/sessions/{session_id}", response_model=BaseResponse[Optional[ChatSessionResponse]])
async def update_chat_session(
    session_id: str,
    req: ChatSessionUpdateRequest,
    x_user_id: Optional[str] = Header(None)
):
    """
    Update a chat session (rename title, pin/unpin, add messages, update player_ids).
    """
    if not x_user_id:
        return BaseResponse(success=True, data=None)

    updated = DBService.update_chat_session(session_id, req.model_dump(exclude_unset=True), x_user_id)
    return BaseResponse(success=True, data=updated)


@router.delete("/sessions/{session_id}", response_model=BaseResponse[Dict[str, bool]])
async def delete_chat_session(session_id: str, x_user_id: Optional[str] = Header(None)):
    """
    Delete a chat session.
    """
    if not x_user_id:
        return BaseResponse(success=True, data={"deleted": True})

    deleted = DBService.delete_chat_session(session_id, x_user_id)
    return BaseResponse(success=True, data={"deleted": deleted})

