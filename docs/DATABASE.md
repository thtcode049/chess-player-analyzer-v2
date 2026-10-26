# CHESS PLAYER ANALYZER V2: DATABASE & STORAGE DESIGN

## 1. Overview & Free Tier Strategy
The database is built on **Supabase PostgreSQL 15** with Row Level Security (RLS) enabled across all tables.

### Storage Optimization Principles (500MB Limit Safety)
- **Direct Memory Processing**: Uploaded multi-megabyte PGN files are parsed and processed in memory via `ImportService.parse_pgn_bytes`, avoiding unnecessary file storage overhead.
- **Games Table**: Stores normalized headers, SAN moves text (`moves_san`), opening details, and time controls.
- **Analytical Snapshots**: Repertoire trees, pawn structures, and Bayesian win/score metrics are persisted as compressed `JSONB` structures inside `analysis_runs`, avoiding millions of granular relational rows while enabling sub-50ms snapshot retrieval.

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
   [games]                                                |
                                                          v
                                                   [analysis_runs]
```

---

## 3. Detailed Table Schema

### 1. `profiles`
User profile extension tied directly to `auth.users`.
- `id` (UUID, Primary Key, references `auth.users.id` ON DELETE CASCADE)
- `email` (TEXT)
- `display_name` (TEXT)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

### 2. `players`
Canonical player entities owned by a user.
- `id` (UUID, Primary Key)
- `user_id` (UUID, references `auth.users.id` ON DELETE CASCADE)
- `canonical_name` (TEXT, NOT NULL)
- `fide_id` (INTEGER)
- `title` (TEXT) - e.g. GM, IM, FM
- `notes` (TEXT)
- `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ)

### 3. `datasets`
Batches of imported games.
- `id` (UUID, Primary Key)
- `player_id` (UUID, references `players.id` ON DELETE CASCADE)
- `source_type` (TEXT) - `pgn_upload`, `lichess`, `chesscom`
- `source_identifier` (TEXT) - e.g. filename or platform username
- `games_count` (INTEGER, default 0)
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
- `result` (TEXT, NOT NULL) - `1-0`, `0-1`, `1/2-1/2`
- `eco` (TEXT), `opening_name` (TEXT)
- `time_control` (TEXT)
- `ply_count` (INTEGER)
- `moves_san` (TEXT, NOT NULL)
- `raw_headers` (JSONB)
- `created_at` (TIMESTAMPTZ, default `now()`)

### 5. `analysis_runs`
Analytical runs recording opening tree snapshots, Bayesian scores, and pawn structures.
- `id` (UUID, Primary Key)
- `player_id` (UUID, references `players.id` ON DELETE CASCADE)
- `run_label` (TEXT)
- `scope_filter` (JSONB)
- `games_analyzed_count` (INTEGER)
- `overall_win_rate` (NUMERIC(5,2)), `overall_score` (NUMERIC(5,2))
- `white_score` (NUMERIC(5,2)), `black_score` (NUMERIC(5,2))
- `repertoire_summary` (JSONB)
- `pawn_structures_summary` (JSONB)
- `opening_tree_snapshot` (JSONB)
- `created_at` (TIMESTAMPTZ)

---

## 4. Row Level Security (RLS) Matrix
All tables have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`.
- **Profiles**: `auth.uid() = id`
- **Players**: `auth.uid() = user_id`
- **Datasets**: Exists through `players.user_id = auth.uid()`
- **Games**: Exists through `datasets -> players.user_id = auth.uid()`
- **Analysis Runs**: Exists through `players.user_id = auth.uid()`
