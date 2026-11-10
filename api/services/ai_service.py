"""
AI Service Layer
----------------
Manages LLM Ground Truth Context generation, Proactive Strategic Briefing,
Google Gemini streaming, and Local Expert offline fallback.
Directly reuses: src.ai_assistant.*
"""
from typing import Dict, Any, List, Generator, Tuple, Optional

from src.ai_assistant.context_builder import build_player_ai_context
from src.ai_assistant.briefing import generate_initial_strategic_briefing, get_followup_prompts
from src.ai_assistant.gemini_client import stream_gemini_response
from src.ai_assistant.local_expert import generate_local_expert_response

class AIService:
    @staticmethod
    def generate_briefing(
        player_name: str,
        stats: Dict[str, Any],
        deep_profile: Dict[str, Any],
        perspective_mode: str = "self",
        games: Optional[List[Dict[str, Any]]] = None,
    ) -> Tuple[str, List[str]]:
        """
        Generates proactive executive strategic briefing and 1-click follow-up prompts.
        Returns: (briefing_markdown, suggested_questions)
        """
        briefing_text = generate_initial_strategic_briefing(
            deep_profile=deep_profile,
            stats=stats,
            selected_player=player_name,
            mode=perspective_mode,
            games=games,
        )
        questions = get_followup_prompts(
            mode=perspective_mode
        )
        return briefing_text, questions

    @staticmethod
    def build_prompt_context(
        player_name: str,
        stats: Dict[str, Any],
        deep_profile: Dict[str, Any],
        current_fen: Optional[str] = None,
        engine_eval: Optional[Dict[str, Any]] = None,
        selected_game: Optional[Dict[str, Any]] = None,
        is_board_open: bool = True,
        games: Optional[List[Dict[str, Any]]] = None,
        question: str = "",
        sources: Optional[Dict[str, str]] = None,
        source_prefix: str = "",
    ) -> str:
        """
        Creates structured Ground Truth text to prevent LLM hallucinations,
        including player stats, selected game, full PGN games, and current interactive board state.
        """
        return build_player_ai_context(
            deep_profile=deep_profile,
            stats=stats,
            selected_player=player_name,
            current_fen=current_fen,
            engine_eval=engine_eval,
            selected_game=selected_game,
            is_board_open=is_board_open,
            games=games,
            question=question,
            sources=sources,
            source_prefix=source_prefix,
        )

    @staticmethod
    def stream_chat_response(
        prompt: str,
        context: str,
        stats: Optional[Dict[str, Any]] = None,
        deep_profile: Optional[Dict[str, Any]] = None,
        chat_history: Optional[List[Dict[str, str]]] = None,
        perspective_mode: str = "self",
        player_name: str = "Kỳ thủ",
        current_fen: Optional[str] = None,
        engine_eval: Optional[Dict[str, Any]] = None,
        fallback_response: Optional[str] = None,
    ) -> Generator[str, None, None]:
        """
        Streams response chunks from Gemini API with fallback to Local Expert.
        Includes deterministic fact-checking and tag sanitation.
        """
        # 1. Check deterministic response for pawn structures / pawn skeletons
        try:
            from src.ai_assistant.intent_router import IntentRouter
            direct_pawn_ans = None if fallback_response else IntentRouter.try_answer_pawn_structure(
                prompt=prompt,
                deep_profile=deep_profile,
                selected_player=player_name,
                mode=perspective_mode,
            )
            if direct_pawn_ans:
                words = direct_pawn_ans.split(" ")
                for i in range(0, len(words), 4):
                    yield " ".join(words[i:i+4]) + " "
                return
        except Exception:
            pass

        # 2. Check deterministic response for pure geometric / factual chess queries
        if current_fen:
            try:
                from src.ai_assistant.position_facts import PositionFacts
                from src.ai_assistant.intent_router import IntentRouter
                facts = PositionFacts(current_fen, engine_eval=engine_eval)
                direct_ans = IntentRouter.try_answer_deterministic(prompt, facts)
                if direct_ans:
                    words = direct_ans.split(" ")
                    for i in range(0, len(words), 4):
                        yield " ".join(words[i:i+4]) + " "
                    return
            except Exception as e:
                pass

        history_formatted = []
        if chat_history:
            for msg in chat_history:
                history_formatted.append({
                    "role": "user" if msg.get("role") == "user" else "model",
                    "content": msg.get("content", "")
                })

        from src.ai_assistant.verifier import clean_chess_tags
        import chess
        current_board = None
        if current_fen:
            try:
                current_board = chess.Board(current_fen)
            except Exception:
                pass

        try:
            # Yield chunks from Gemini streaming client
            yielded_any = False
            for chunk in stream_gemini_response(
                prompt=prompt,
                context=context,
                chat_history=history_formatted,
                deep_profile=deep_profile,
                stats=stats,
                selected_player=player_name,
                mode=perspective_mode,
                fallback_response=fallback_response,
            ):
                if chunk:
                    yielded_any = True
                    yield chunk
            
            if not yielded_any:
                offline_res = (
                    "> ⚠️ **Thông báo hệ thống:** Không nhận được phản hồi từ Google Gemini AI.\n"
                    "> Hệ thống tạm thời chuyển sang **Chế độ Chuyên gia Cục bộ Dự phòng (Offline Fallback)** dựa trên số liệu phân tích của kỳ thủ:\n\n---\n\n"
                    + (fallback_response or generate_local_expert_response(
                        prompt=prompt,
                        deep_profile=deep_profile or {},
                        stats=stats or {},
                        selected_player=player_name,
                        mode=perspective_mode
                    ))
                )
                yield offline_res
        except Exception as e:
            offline_res = (
                f"> ⚠️ **Thông báo hệ thống:** Gặp sự cố kết nối tới dịch vụ AI ({type(e).__name__}: {str(e)[:80]}).\n"
                "> Hệ thống tạm thời chuyển sang **Chế độ Chuyên gia Cục bộ Dự phòng (Offline Fallback)** dựa trên số liệu phân tích của kỳ thủ:\n\n---\n\n"
                + (fallback_response or generate_local_expert_response(
                    prompt=prompt,
                    deep_profile=deep_profile or {},
                    stats=stats or {},
                    selected_player=player_name,
                    mode=perspective_mode
                ))
            )
            yield offline_res

