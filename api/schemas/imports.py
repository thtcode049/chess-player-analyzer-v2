"""
Import Pydantic Schemas for PGN, Lichess, and Chess.com
"""
from typing import Optional, List
from pydantic import BaseModel, Field

class LichessImportRequest(BaseModel):
    player_id: Optional[str] = None
    user_id: Optional[str] = None
    username: str
    max_games: int = Field(default=50, ge=1, le=1000)
    perf_types: Optional[List[str]] = ["blitz", "rapid", "bullet"]
    rated_only: Optional[bool] = None
    since: Optional[int] = None
    until: Optional[int] = None
    token: Optional[str] = None
    force_new_player: Optional[bool] = False

class ChesscomImportRequest(BaseModel):
    player_id: Optional[str] = None
    user_id: Optional[str] = None
    username: str
    max_games: int = Field(default=50, ge=1, le=1000)
    perf_types: Optional[List[str]] = ["blitz", "rapid", "bullet"]
    rated_only: Optional[bool] = None
    since: Optional[int] = None
    until: Optional[int] = None
    force_new_player: Optional[bool] = False

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
class LichessOAuthTokenRequest(BaseModel):
    code: str
    code_verifier: str
    redirect_uri: str
    client_id: Optional[str] = "chess-player-analyzer"

class LichessVerifyTokenRequest(BaseModel):
    token: str

class LichessAuthResponse(BaseModel):
    access_token: Optional[str] = None
    username: Optional[str] = None
    valid: bool = True
    error: Optional[str] = None
