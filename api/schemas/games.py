"""
Game Pydantic Schemas
"""
from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel

from src.utils import PlayerColor

class GameResponse(BaseModel):
    id: str
    dataset_id: str
    external_id: Optional[str] = None
    site_url: Optional[str] = None
    played_at: Optional[datetime] = None
    white_player: str
    black_player: str
    player_color: PlayerColor | None = None
    white_elo: Optional[int] = None
    black_elo: Optional[int] = None
    result: str
    eco: Optional[str] = None
    opening_name: Optional[str] = None
    time_control: Optional[str] = None
    ply_count: Optional[int] = None
    moves_san: str
    raw_headers: Optional[Dict[str, Any]] = {}
    created_at: Optional[datetime] = None

class GameDetailResponse(GameResponse):
    pass
