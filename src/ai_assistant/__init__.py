"""
AI Assistant Package
--------------------
Gói công cụ trợ lý AI trò chuyện và phân tích đối thủ thông minh.
"""

from src.ai_assistant.context_builder import build_opponent_ai_context, build_player_ai_context
from src.ai_assistant.gemini_client import (
    call_gemini_api,
    stream_gemini_response,
    AVAILABLE_MODELS,
    GEMINI_MODELS
)
from src.ai_assistant.local_expert import generate_local_expert_response
from src.ai_assistant.config import get_server_gemini_api_key
from src.ai_assistant.briefing import generate_initial_strategic_briefing, get_followup_prompts

__all__ = [
    "build_opponent_ai_context",
    "build_player_ai_context",
    "call_gemini_api",
    "stream_gemini_response",
    "generate_local_expert_response",
    "get_server_gemini_api_key",
    "generate_initial_strategic_briefing",
    "get_followup_prompts",
    "AVAILABLE_MODELS",
    "GEMINI_MODELS"
]
