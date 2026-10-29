/**
 * Domain Types & API Contracts for Chess Player Analyzer V2
 * Mirrors Pydantic schemas from api/schemas/ and Supabase PostgreSQL DDL
 */

export interface Profile {
  id: string;
  email?: string;
  display_name?: string;
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
  is_guest?: boolean;
  expires_at?: string | null;
}

export interface Dataset {
  id: string;
  player_id: string;
  source_type: 'lichess' | 'chesscom' | 'pgn_upload';
  source_identifier: string;
  games_count: number;
  imported_at: string;
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
  raw_headers?: Record<string, any>;
}

export interface OpeningContinuation {
  san: string;
  games_count: number;
  usage_pct: number;
  win_pct: number;
  draw_pct: number;
  loss_pct: number;
  score_pct: number;
  single_game_info?: {
    id?: string;
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
    moves_san?: string;
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
  
  // Metrics
  overall_win_rate?: number | null;
  overall_score?: number | null;
  white_score?: number | null;
  black_score?: number | null;
  
  // Snapshots
  repertoire_summary?: Record<string, any> | null;
  pawn_structures_summary?: Record<string, any> | null;
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
  formation_ply?: number;
  formation_fen?: string;
  evidence?: string;
  white: string;
  white_elo?: number | null;
  black: string;
  black_elo?: number | null;
  result: string;
  opening?: string;
  date?: string;
  site?: string;
  link?: string;
  player_color?: string;
  is_win: boolean;
  is_draw: boolean;
  is_loss: boolean;
  game_accuracy?: number;
}

export interface PawnStructureItem {
  name: string;
  structure_key?: string;
  group?: "A" | "B" | string;
  group_title?: string;
  strategic_plan?: {
    ideas: string[];
    counter_ideas: string[];
  };
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

export interface OpeningRepertoireItem {
  name: string;
  games_count: number;
  wins?: number;
  draws?: number;
  losses?: number;
  score_pct?: number;
  adjusted_score_pct?: number;
  delta_vs_baseline?: number;
  assessment_badge?: string;
  assessment_color?: string;
  win_pct?: number;
  draw_pct?: number;
  loss_pct?: number;
}

export interface LichessMasterMove {
  san: string;
  uci: string;
  games_count: number;
  white: number;
  draws: number;
  black: number;
  win_pct: number;
  draw_pct: number;
  loss_pct: number;
  score_pct: number;
  average_rating?: number;
}

export interface LichessMasterTopGame {
  id: string;
  white: {
    name: string;
    rating?: number;
  };
  black: {
    name: string;
    rating?: number;
  };
  year?: number;
  month?: string;
  winner?: "white" | "black" | null;
  result: string;
  uci?: string;
}

export interface LichessGameDetail {
  id: string;
  white: string;
  white_elo?: number;
  black: string;
  black_elo?: number;
  result: string;
  moves: string[];
  moves_san: string;
  event?: string;
  date?: string;
  year?: number | string;
  site?: string;
  eco?: string;
  opening?: string;
}

export interface LichessMastersResponse {
  authenticated: boolean;
  total_games: number;
  moves: LichessMasterMove[];
  top_games?: LichessMasterTopGame[];
  opening?: {
    eco?: string;
    name?: string;
  } | null;
  is_book?: boolean;
  is_rate_limited?: boolean;
  message?: string;
}

export interface AIChatMessage {
  role: "user" | "assistant";
  content: string;
  fen?: string;
}

export interface AIChatSession {
  id: string;
  user_id?: string;
  player_ids: string[];
  title: string;
  perspective_mode?: string;
  pinned: boolean;
  messages: AIChatMessage[];
  created_at?: string;
  updated_at?: string;
}
