# CHESS PLAYER ANALYZER V2: DATABASE & STORAGE DESIGN

## 1. Overview & Free Tier Strategy
The database is built on **Supabase PostgreSQL 15** with Row Level Security (RLS) enabled across all tables.

### Storage Optimization Principles (500MB Limit Safety)
- **Raw PGN Blobs**: Never stored directly in PostgreSQL columns. Uploaded multi-megabyte PGN files are saved in the Supabase Storage Bucket `pgn-vault` (`pgn_storage_path`).
- **Games Table**: Stores only normalized headers, SAN moves text (`moves_san`), and lightweight metadata (`has_embedded_eval`).
- **Analytical Snapshots**: Repertoire trees, pawn structures, and style radar vectors are persisted as compressed `JSONB` structures inside `analysis_runs`, avoiding millions of granular relational rows while enabling sub-50ms snapshot retrieval.

---

## 2. Entity-Relationship Model (ERD)

```
[auth.users] (Supabase Auth)
     | (1:1)
     v
 [profiles]
     | (1:N)
     v
  [players] <---------------------------------------------+
     | (1:N)                                              |
     v                                                    |
 [datasets]                                               |
     | (1:N)                                              |
     v                                                    | (1:N)
  [games] <--------------+                                |
     | (1:N)             |                                v
     |          [game_analyses] (Unique: run_id, game_id) <-- [analysis_runs]
     v                   ^                                       | (1:N)
[game_critical_positions]|                                       v
                         +------------------------------ [ai_coaching_logs]
```

---

## 3. Detailed Table Schema

### 1. `profiles`
User profile extension tied directly to `auth.users`.
- `id` (UUID, Primary Key, references `auth.users.id` ON DELETE CASCADE)
- `email` (TEXT)
- `display_name` (TEXT)
- `lichess_username` (TEXT)
- `chesscom_username` (TEXT)
- `avatar_url` (TEXT)
- `created_at` (TIMESTAMPTZ, default `now()`)

### 2. `players`
Canonical player entities owned by a user.
- `id` (UUID, Primary Key)
- `user_id` (UUID, references `auth.users.id` ON DELETE CASCADE)
- `canonical_name` (TEXT, NOT NULL)
- `fide_id` (INTEGER)
- `title` (VARCHAR(10)) - e.g. GM, IM, FM
- `notes` (TEXT)
- `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ)

### 3. `datasets`
Batches of imported games.
- `id` (UUID, Primary Key)
- `player_id` (UUID, references `players.id` ON DELETE CASCADE)
- `source_type` (VARCHAR(30)) - `pgn_upload`, `lichess`, `chesscom`
- `source_identifier` (TEXT) - e.g. filename or platform username
- `games_count` (INTEGER, default 0)
- `pgn_storage_path` (TEXT) - Path inside `pgn-vault` bucket
- `imported_at` (TIMESTAMPTZ, default `now()`)

### 4. `games`
Individual game records parsed from datasets.
- `id` (UUID, Primary Key)
- `dataset_id` (UUID, references `datasets.id` ON DELETE CASCADE)
- `external_id` (TEXT) - Lichess or Chess.com game ID
- `site_url` (TEXT)
- `played_at` (TIMESTAMPTZ)
- `white_player` (TEXT, NOT NULL), `black_player` (TEXT, NOT NULL)
- `white_elo` (INTEGER), `black_elo` (INTEGER)
- `result` (VARCHAR(10), NOT NULL) - `1-0`, `0-1`, `1/2-1/2`
- `eco` (VARCHAR(10)), `opening_name` (TEXT)
- `time_control` (VARCHAR(50))
- `ply_count` (INTEGER)
- `moves_san` (TEXT, NOT NULL)
- `has_embedded_eval` (BOOLEAN, default FALSE)
- `raw_headers` (JSONB)

### 5. `analysis_runs`
Analytical runs recording engine coverage, Bayesian scores, and snapshots.
- `id` (UUID, Primary Key)
- `player_id` (UUID, references `players.id` ON DELETE CASCADE)
- `run_label` (TEXT)
- `scope_filter` (JSONB)
- `games_analyzed_count` (INTEGER)
- `engine_status` (VARCHAR(30)) - `statistical_only`, `embedded_eval`, `sampled_wasm`, `full_engine`
- `engine_coverage_pct` (NUMERIC(5,2))
- `engine_games_count` (INTEGER)
- `engine_name` (VARCHAR(50)), `engine_depth` (INTEGER)
- `overall_win_rate` (NUMERIC(5,2)), `overall_score` (NUMERIC(5,2))
- `white_score` (NUMERIC(5,2)), `black_score` (NUMERIC(5,2))
- `overall_acpl` (NUMERIC(6,2)), `acpl_opening` (NUMERIC(6,2)), `acpl_middlegame` (NUMERIC(6,2)), `acpl_endgame` (NUMERIC(6,2))
- `dominant_archetype` (TEXT)
- `repertoire_summary` (JSONB)
- `pawn_structures_summary` (JSONB)
- `style_radar_metrics` (JSONB)
- `opening_tree_snapshot` (JSONB)
- `status` (VARCHAR(20)) - `processing`, `completed`, `failed`
- `created_at` (TIMESTAMPTZ)

### 6. `game_analyses`
Link table between `analysis_runs` and `games`.
- `id` (UUID, Primary Key)
- `run_id` (UUID, references `analysis_runs.id` ON DELETE CASCADE)
- `game_id` (UUID, references `games.id` ON DELETE CASCADE)
- `player_acpl` (NUMERIC(6,2))
- `opponent_acpl` (NUMERIC(6,2))
- `blunder_count` (INTEGER), `mistake_count` (INTEGER), `inaccuracy_count` (INTEGER)
- `engine_status` (VARCHAR(30))
- **Constraint**: `UNIQUE(run_id, game_id)`

### 7. `game_critical_positions`
Tactical swings, blunders, and pivotal positions.
- `id` (UUID, Primary Key)
- `game_id` (UUID, references `games.id` ON DELETE CASCADE)
- `ply` (INTEGER, NOT NULL)
- `fen` (TEXT, NOT NULL)
- `eval_before` (NUMERIC(7,2)), `eval_after` (NUMERIC(7,2)), `cpl` (NUMERIC(7,2))
- `event_type` (VARCHAR(20)) - `BLUNDER`, `MISTAKE`, `INACCURACY`, `SWING`
- `played_move` (VARCHAR(10)), `best_move` (VARCHAR(10))
- `phase` (VARCHAR(20)) - `opening`, `middlegame`, `endgame`

### 8. `ai_coaching_logs`
Audit log of strategic briefings and AI coaching interactions.
- `id` (UUID, Primary Key)
- `run_id` (UUID, references `analysis_runs.id` ON DELETE CASCADE)
- `user_id` (UUID, references `auth.users.id` ON DELETE CASCADE)
- `perspective_mode` (VARCHAR(20)) - `self`, `opponent`
- `prompt_context` (TEXT), `response_text` (TEXT)
- `created_at` (TIMESTAMPTZ)

---

## 4. Row Level Security (RLS) Matrix
All tables have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`.
- **Profiles**: `auth.uid() = id`
- **Players**: `auth.uid() = user_id`
- **Datasets**: Exists through `players.user_id = auth.uid()`
- **Games**: Exists through `datasets -> players.user_id = auth.uid()`
- **Analysis Runs**: Exists through `players.user_id = auth.uid()`
- **Game Analyses**: Exists through `analysis_runs -> players.user_id = auth.uid()`
- **AI Coaching Logs**: `auth.uid() = user_id`
