"""
Analysis Run and Analytical Snapshot Pydantic Schemas
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class AnalysisRunCreate(BaseModel):
    player_id: str
    run_label: Optional[str] = "Full Profile Analysis"
    scope_filter: Optional[Dict[str, Any]] = Field(default_factory=dict)
    # Optional raw games input for immediate on-demand analysis without pre-saving
    raw_pgn_text: Optional[str] = None

class OpeningContinuation(BaseModel):
    san: str
    games_count: int
    usage_pct: float
    win_pct: float
    draw_pct: float
    loss_pct: float
    score_pct: float
    single_game_info: Optional[Dict[str, Any]] = None

class OpeningTreeNodeResponse(BaseModel):
    fen: str
    games_count: int
    in_pgn: Optional[bool] = True
    total_games: Optional[int] = 0
    score_pct: Optional[float] = 0.0
    wins: Optional[int] = 0
    draws: Optional[int] = 0
    losses: Optional[int] = 0
    continuations: List[OpeningContinuation] = []


class AnalysisRunResponse(BaseModel):
    id: str
    player_id: str
    run_label: str
    scope_filter: Dict[str, Any]
    games_analyzed_count: int
    
    # Engine status & coverage
    engine_status: str = "statistical_only" # 'statistical_only', 'embedded_eval', 'sampled_wasm', 'full_engine'
    engine_coverage_pct: float = 0.0
    engine_games_count: int = 0
    engine_name: Optional[str] = None
    engine_depth: Optional[int] = None
    
    # Mathematical & Bayesian metrics
    overall_win_rate: Optional[float] = None
    overall_score: Optional[float] = None
    white_score: Optional[float] = None
    black_score: Optional[float] = None
    
    # Phase ACPL metrics
    overall_acpl: Optional[float] = None
    acpl_opening: Optional[float] = None
    acpl_middlegame: Optional[float] = None
    acpl_endgame: Optional[float] = None
    dominant_archetype: Optional[str] = None
    
    # Snapshots
    repertoire_summary: Optional[Dict[str, Any]] = None
    pawn_structures_summary: Optional[Dict[str, Any]] = None
    style_radar_metrics: Optional[Dict[str, Any]] = None
    opening_tree_snapshot: Optional[Dict[str, Any]] = None
    
    status: str = "completed"
    created_at: Optional[datetime] = None


class AnalysisRunSyncEvaluations(BaseModel):
    player_id: str
    run_id: Optional[str] = None
    engine_status: str = "stockfish_wasm"
    engine_name: str = "Stockfish 17 WASM (Browser Pool)"
    engine_depth: int = 10
    engine_coverage_pct: float = 100.0
    engine_games_count: int
    overall_acpl: Optional[float] = None
    acpl_opening: Optional[float] = None
    acpl_middlegame: Optional[float] = None
    acpl_endgame: Optional[float] = None
    dominant_archetype: Optional[str] = None
    style_radar_metrics: Optional[Dict[str, Any]] = None
    critical_positions: Optional[List[Dict[str, Any]]] = None

