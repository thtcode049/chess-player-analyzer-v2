"""
Game and Critical Position Pydantic Schemas
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class CriticalPositionResponse(BaseModel):
    id: Optional[str] = None
    game_id: Optional[str] = None
    ply: int
    fen: str
    eval_before: Optional[float] = None
    eval_after: Optional[float] = None
    cpl: Optional[float] = None
    event_type: str  # 'BLUNDER', 'MISTAKE', 'INACCURACY', 'SWING'
    played_move: str
    best_move: Optional[str] = None
    phase: str       # 'opening', 'middlegame', 'endgame'

class GameResponse(BaseModel):
    id: str
    dataset_id: str
    external_id: Optional[str] = None
    site_url: Optional[str] = None
    played_at: Optional[datetime] = None
    white_player: str
    black_player: str
    white_elo: Optional[int] = None
    black_elo: Optional[int] = None
    result: str
    eco: Optional[str] = None
    opening_name: Optional[str] = None
    time_control: Optional[str] = None
    ply_count: Optional[int] = None
    moves_san: str
    has_embedded_eval: bool = False
    raw_headers: Optional[Dict[str, Any]] = {}
    created_at: Optional[datetime] = None

class GameDetailResponse(GameResponse):
    critical_positions: List[CriticalPositionResponse] = []
