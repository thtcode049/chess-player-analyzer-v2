"""
AI Coach and Briefing Pydantic Schemas
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class BriefingRequest(BaseModel):
    run_id: str
    perspective_mode: str = "self" # 'self' | 'opponent'

class BriefingResponse(BaseModel):
    run_id: str
    perspective_mode: str
    strategic_briefing: str
    suggested_questions: List[str] = []

class ChatMessage(BaseModel):
    role: str # 'user' | 'assistant'
    content: str

class ChatRequest(BaseModel):
    run_id: str
    message: str
    perspective_mode: Optional[str] = "neutral"
    history: List[ChatMessage] = []
    current_fen: Optional[str] = None
    engine_eval: Optional[Dict[str, Any]] = None
    selected_game: Optional[Dict[str, Any]] = None
    is_board_open: Optional[bool] = True
    player_id: Optional[str] = None
    player_ids: Optional[List[str]] = None
