"""
Player and Dataset Pydantic Schemas
"""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

class PlayerBase(BaseModel):
    canonical_name: str = Field(..., description="Canonical name of the chess player")
    fide_id: Optional[int] = Field(None, description="FIDE ID if available")
    title: Optional[str] = Field(None, description="Chess title e.g. GM, IM, FM")
    notes: Optional[str] = Field(None, description="User notes on this player")

class PlayerCreate(PlayerBase):
    pass

class PlayerUpdate(BaseModel):
    canonical_name: Optional[str] = None
    fide_id: Optional[int] = None
    title: Optional[str] = None
    notes: Optional[str] = None

class DatasetResponse(BaseModel):
    id: str
    player_id: str
    source_type: str
    source_identifier: str
    games_count: int
    pgn_storage_path: Optional[str] = None
    imported_at: datetime

class PlayerResponse(PlayerBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    datasets: Optional[List[DatasetResponse]] = []
    total_games: int = 0
