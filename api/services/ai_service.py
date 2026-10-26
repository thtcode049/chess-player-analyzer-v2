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
        perspective_mode: str = "self"
    ) -> Tuple[str, List[str]]:
        """
        Generates proactive executive strategic briefing and 1-click follow-up prompts.
        Returns: (briefing_markdown, suggested_questions)
        """
        briefing_text = generate_initial_strategic_briefing(
            deep_profile=deep_profile,
            stats=stats,
            selected_player=player_name,
            mode=perspective_mode
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
        games: Optional[List[Dict[str, Any]]] = None
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
            games=games
        )

    @staticmethod
    def stream_chat_response(
        prompt: str,
        context: str,
        stats: Optional[Dict[str, Any]] = None,
        deep_profile: Optional[Dict[str, Any]] = None,
        chat_history: Optional[List[Dict[str, str]]] = None,
        perspective_mode: str = "self",
        player_name: str = "Kỳ thủ"
    ) -> Generator[str, None, None]:
        """
        Streams response chunks from Gemini API with fallback to Local Expert.
        """
        history_formatted = []
        if chat_history:
            for msg in chat_history:
                history_formatted.append({
                    "role": "user" if msg.get("role") == "user" else "model",
                    "content": msg.get("content", "")
                })

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
                mode=perspective_mode
            ):
                if chunk:
                    yielded_any = True
                    yield chunk
            
            if not yielded_any:
                offline_res = (
                    "> ⚠️ **Thông báo hệ thống:** Không nhận được phản hồi từ Google Gemini AI.\n"
                    "> Hệ thống tạm thời chuyển sang **Chế độ Chuyên gia Cục bộ Dự phòng (Offline Fallback)** dựa trên số liệu phân tích của kỳ thủ:\n\n---\n\n"
                    + generate_local_expert_response(
                        prompt=prompt,
                        deep_profile=deep_profile or {},
                        stats=stats or {},
                        selected_player=player_name,
                        mode=perspective_mode
                    )
                )
                yield offline_res
        except Exception as e:
            offline_res = (
                f"> ⚠️ **Thông báo hệ thống:** Gặp sự cố kết nối tới dịch vụ AI ({type(e).__name__}: {str(e)[:80]}).\n"
                "> Hệ thống tạm thời chuyển sang **Chế độ Chuyên gia Cục bộ Dự phòng (Offline Fallback)** dựa trên số liệu phân tích của kỳ thủ:\n\n---\n\n"
                + generate_local_expert_response(
                    prompt=prompt,
                    deep_profile=deep_profile or {},
                    stats=stats or {},
                    selected_player=player_name,
                    mode=perspective_mode
                )
            )
            yield offline_res

