/**
 * Domain Types & API Contracts for Chess Player Analyzer V2
 * Mirrors Pydantic schemas from api/schemas/ and Supabase PostgreSQL DDL
 */

export interface Profile {
  id: string;
  email?: string;
  display_name?: string;
  lichess_username?: string;
  chesscom_username?: string;
  avatar_url?: string;
  created_at: string;
}

export interface Player {
  id: string;
  user_id: string;
  canonical_name: string;
  fide_id?: number | null;
  title?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  total_games?: number;
  datasets?: Dataset[];
}

export interface Dataset {
  id: string;
  player_id: string;
  source_type: 'lichess' | 'chesscom' | 'pgn_upload';
  source_identifier: string;
  games_count: number;
  pgn_storage_path?: string | null;
  imported_at: string;
}

export interface CriticalPosition {
  id?: string;
  game_id?: string;
  ply: number;
  fen: string;
  eval_before?: number | null;
  eval_after?: number | null;
  cpl?: number | null;
  event_type: 'BLUNDER' | 'MISTAKE' | 'INACCURACY' | 'SWING';
  played_move: string;
  best_move?: string | null;
  phase: 'opening' | 'middlegame' | 'endgame';
}

export interface Game {
  id: string;
  dataset_id: string;
  external_id?: string | null;
  site_url?: string | null;
  played_at?: string | null;
  white_player: string;
  black_player: string;
  white_elo?: number | null;
  black_elo?: number | null;
  result: string;
  eco?: string | null;
  opening_name?: string | null;
  time_control?: string | null;
  ply_count?: number;
  moves_san: string;
  has_embedded_eval: boolean;
  raw_headers?: Record<string, any>;
  critical_positions?: CriticalPosition[];
}

export type EngineStatus = 'statistical_only' | 'embedded_eval' | 'sampled_wasm' | 'full_engine' | 'stockfish_parallel' | 'hybrid_stockfish' | 'stockfish_wasm';

export interface OpeningContinuation {
  san: string;
  games_count: number;
  usage_pct: number;
  win_pct: number;
  draw_pct: number;
  loss_pct: number;
  score_pct: number;
  single_game_info?: {
    white?: string;
    white_elo?: number;
    black?: string;
    black_elo?: number;
    result?: string;
    site?: string;
    link?: string;
    event?: string;
    date?: string;
    round?: string;
    moves?: string[];
    opening?: string;
    player_color?: string;
  };
}

export interface OpeningTreeNode {
  fen: string;
  games_count: number;
  in_pgn?: boolean;
  total_games?: number;
  score_pct?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  continuations: OpeningContinuation[];
}

export interface AnalysisRun {
  id: string;
  player_id: string;
  run_label: string;
  scope_filter: Record<string, any>;
  games_analyzed_count: number;
  
  // Engine metadata
  engine_status: EngineStatus;
  engine_coverage_pct: number;
  engine_games_count: number;
  engine_name?: string | null;
  engine_depth?: number | null;
  
  // Metrics
  overall_win_rate?: number | null;
  overall_score?: number | null;
  white_score?: number | null;
  black_score?: number | null;
  
  // Phase ACPL
  overall_acpl?: number | null;
  acpl_opening?: number | null;
  acpl_middlegame?: number | null;
  acpl_endgame?: number | null;
  dominant_archetype?: string | null;
  
  // Snapshots
  repertoire_summary?: Record<string, any> | null;
  pawn_structures_summary?: Record<string, any> | null;
  style_radar_metrics?: Record<string, any> | null;
  opening_tree_snapshot?: OpeningTreeNode | null;
  
  status: 'completed' | 'processing' | 'failed';
  created_at?: string;
}

export interface StrategicBriefing {
  run_id: string;
  perspective_mode: 'self' | 'opponent';
  strategic_briefing: string;
  suggested_questions: string[];
}

export interface ImportSummary {
  dataset_id?: string;
  player_id: string;
  run_id?: string;
  total_found: number;
  imported_count: number;
  skipped_count: number;
  primary_player: string;
  source_type: string;
  sample_games?: Game[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PawnStructureGame {
  id?: string;
  game_index: number;
  formation_move: number;
  white: string;
  black: string;
  result: string;
  opening?: string;
  date?: string;
  site?: string;
  player_color?: string;
  is_win: boolean;
  is_draw: boolean;
  is_loss: boolean;
  game_accuracy?: number;
}

export interface PawnStructureItem {
  name: string;
  structure_key?: string;
  typical_formation_move?: number;
  games_count: number;
  wins: number;
  draws: number;
  losses: number;
  score_pct: number;
  adjusted_score_pct?: number;
  delta_vs_baseline?: number;
  assessment_badge?: string;
  assessment_color?: string;
  games?: PawnStructureGame[];
}

export interface AnalysisRunSyncRequest {
  player_id: string;
  run_id?: string;
  engine_status?: EngineStatus;
  engine_name?: string;
  engine_depth?: number;
  engine_coverage_pct?: number;
  engine_games_count?: number;
  overall_acpl?: number | null;
  acpl_opening?: number | null;
  acpl_middlegame?: number | null;
  acpl_endgame?: number | null;
  dominant_archetype?: string | null;
  style_radar_metrics?: Record<string, any> | null;
  critical_positions?: CriticalPosition[];
}


