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

class ChatSessionResponse(BaseModel):
    id: str
    user_id: str
    player_ids: List[str] = []
    title: str
    perspective_mode: str = "self"
    pinned: bool = False
    messages: List[Dict[str, Any]] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class ChatSessionCreateRequest(BaseModel):
    id: Optional[str] = None
    player_ids: List[str] = []
    title: Optional[str] = "Cuộc trò chuyện mới"
    perspective_mode: Optional[str] = "self"
    pinned: Optional[bool] = False
    messages: List[Dict[str, Any]] = []

class ChatSessionUpdateRequest(BaseModel):
    player_ids: Optional[List[str]] = None
    title: Optional[str] = None
    perspective_mode: Optional[str] = None
    pinned: Optional[bool] = None
    messages: Optional[List[Dict[str, Any]]] = None
