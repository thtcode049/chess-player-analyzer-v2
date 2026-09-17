"""
Import Pydantic Schemas for PGN, Lichess, and Chess.com
"""
from typing import Optional, List
from pydantic import BaseModel, Field

class LichessImportRequest(BaseModel):
    player_id: Optional[str] = None
    username: str
    max_games: int = 50
    perf_types: Optional[List[str]] = ["blitz", "rapid", "bullet"]
    rated_only: Optional[bool] = None

class ChesscomImportRequest(BaseModel):
    player_id: Optional[str] = None
    username: str
    max_games: int = 50
    perf_types: Optional[List[str]] = ["blitz", "rapid", "bullet"]
    rated_only: Optional[bool] = None

class ImportSummaryResponse(BaseModel):
    dataset_id: Optional[str] = None
    player_id: str
    run_id: Optional[str] = None
    total_found: int
    imported_count: int
    skipped_count: int = 0
    primary_player: str
    source_type: str
    sample_games: Optional[List[dict]] = []

