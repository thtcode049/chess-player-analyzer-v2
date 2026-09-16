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
    perspective_mode: str = "self"
    history: List[ChatMessage] = []
    current_fen: Optional[str] = None
