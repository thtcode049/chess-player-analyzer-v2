-- ==============================================================================
-- CHESS PLAYER ANALYZER V2: INITIAL DATABASE SCHEMA MIGRATION
-- Database: Supabase PostgreSQL
-- Features: 8 Core Normalized/Hybrid Tables, Cascading Foreign Keys, 
--           Performance Indexes, Strict Row Level Security (RLS) & Auth Triggers.
-- ==============================================================================

-- 0. ENABLE REQUIRED EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. PROFILES TABLE (Linked 1:1 to auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    lichess_username TEXT,
    chesscom_username TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.profiles IS 'User profiles mirroring Supabase Auth accounts';

-- ==============================================================================
-- 2. PLAYERS TABLE (Central Domain Entity for self, students, opponents)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    canonical_name TEXT NOT NULL,
    fide_id INT,
    title TEXT,                         -- 'GM', 'IM', 'FM', 'CM', 'NM', 'None'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.players IS 'Tracked chess players managed by each user';

-- ==============================================================================
-- 3. DATASETS TABLE (Data sources: Lichess, Chess.com, PGN Uploads)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.datasets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
    source_type TEXT NOT NULL,          -- 'lichess', 'chesscom', 'pgn_upload'
    source_identifier TEXT NOT NULL,   -- Username or uploaded filename
    games_count INT DEFAULT 0 NOT NULL,
    pgn_storage_path TEXT,              -- Vault path: pgn-vault/{user_id}/{dataset_id}.pgn
    imported_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.datasets IS 'Distinct match archives or platform imports for a player';

-- ==============================================================================
-- 4. GAMES TABLE (Individual match records)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.games (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dataset_id UUID REFERENCES public.datasets(id) ON DELETE CASCADE NOT NULL,
    external_id TEXT,                   -- External site game ID if available
    site_url TEXT,                      -- Link to view on Lichess/Chess.com
    played_at TIMESTAMPTZ,
    white_player TEXT NOT NULL,
    black_player TEXT NOT NULL,
    white_elo INT,
    black_elo INT,
    result TEXT NOT NULL,               -- '1-0', '0-1', '1/2-1/2', '*'
    eco TEXT,                           -- International ECO code (e.g., 'B90')
    opening_name TEXT,                  -- Recognized opening name
    time_control TEXT,                  -- '300+0', '180+2', 'Classical'...
    ply_count INT,                      -- Total number of half-moves
    moves_san TEXT NOT NULL,            -- Clean standard SAN move sequence ("1.e4 c5 2.Nf3...")
    raw_headers JSONB DEFAULT '{}'::jsonb NOT NULL, -- Preserved original PGN tags
    has_embedded_eval BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.games IS 'Individual chess game records with clean SAN notation for board playback';

-- ==============================================================================
-- 5. ANALYSIS_RUNS TABLE (Immutable analytical snapshots)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.analysis_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
    run_label TEXT NOT NULL,            -- e.g., 'All Games', 'White Repertoire', 'Last 100'
    scope_filter JSONB DEFAULT '{}'::jsonb NOT NULL, -- e.g., {"color": "white", "last_n": 100}
    games_analyzed_count INT NOT NULL,
    
    -- Engine Metadata & Scientific Reproducibility
    engine_status TEXT DEFAULT 'statistical_only' NOT NULL, -- 'statistical_only', 'embedded_eval', 'sampled_wasm', 'full_engine'
    engine_coverage_pct NUMERIC(5, 2) DEFAULT 0.0 NOT NULL,
    engine_games_count INT DEFAULT 0 NOT NULL,
    engine_name TEXT,
    engine_depth INT,
    
    -- Core Mathematical & Bayesian Metrics
    overall_win_rate NUMERIC(5, 2),
    overall_score NUMERIC(5, 2),
    white_score NUMERIC(5, 2),
    black_score NUMERIC(5, 2),
    
    -- Phase ACPL Metrics (Centipawn Loss)
    overall_acpl NUMERIC(5, 1),
    acpl_opening NUMERIC(5, 1),
    acpl_middlegame NUMERIC(5, 1),
    acpl_endgame NUMERIC(5, 1),
    dominant_archetype TEXT,            -- 'Attacker', 'Positional Master', 'Universal'...
    
    -- Compact High-Density JSONB Snapshots (for Charts & Interactive Trees)
    repertoire_summary JSONB,           -- Most played, best, and worst openings with Bayes score
    pawn_structures_summary JSONB,      -- Carlsbad, Isolani, Hedgehog performance
    style_radar_metrics JSONB,          -- 8-axis normalized playing style radar coordinates
    opening_tree_snapshot JSONB,        -- Root continuations tree for interactive drill-down
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.analysis_runs IS 'Persistent analytical snapshots generated by Python service layer';

-- ==============================================================================
-- 6. GAME_ANALYSES TABLE (Per-game evaluation in an analysis run)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.game_analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    run_id UUID REFERENCES public.analysis_runs(id) ON DELETE CASCADE NOT NULL,
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
    analyzed_by TEXT DEFAULT 'embedded' NOT NULL, -- 'embedded', 'stockfish_wasm', 'backend_engine'
    engine_depth INT,
    acpl NUMERIC(5, 1),
    accuracy_pct NUMERIC(5, 2),
    blunder_count INT DEFAULT 0 NOT NULL,
    mistake_count INT DEFAULT 0 NOT NULL,
    inaccuracy_count INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Crucial constraint: 1 game can only be analyzed once per run
    CONSTRAINT unique_run_game UNIQUE (run_id, game_id)
);

COMMENT ON TABLE public.game_analyses IS 'Per-game evaluation accuracy, ACPL, and error classifications within a run';

-- ==============================================================================
-- 7. GAME_CRITICAL_POSITIONS TABLE (Tactical blunder / swing points)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.game_critical_positions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_analysis_id UUID REFERENCES public.game_analyses(id) ON DELETE CASCADE NOT NULL,
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE NOT NULL, -- Deliberate denormalization
    ply INT NOT NULL,
    fen TEXT NOT NULL,
    eval_before NUMERIC(6, 2),
    eval_after NUMERIC(6, 2),
    cpl NUMERIC(6, 1),
    event_type TEXT NOT NULL,           -- 'BLUNDER', 'MISTAKE', 'INACCURACY', 'SWING'
    played_move TEXT NOT NULL,          -- The move that was made (e.g. 'Qh4?')
    best_move TEXT,                     -- Engine recommended optimal move (e.g. 'Nf3')
    phase TEXT NOT NULL                 -- 'opening', 'middlegame', 'endgame'
);

COMMENT ON TABLE public.game_critical_positions IS 'Extracted turning points and high centipawn loss positions for targeted training';

-- ==============================================================================
-- 8. AI_COACHING_LOGS TABLE (Strategic briefings and chat history)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.ai_coaching_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    run_id UUID REFERENCES public.analysis_runs(id) ON DELETE CASCADE NOT NULL,
    perspective_mode TEXT DEFAULT 'self' NOT NULL, -- 'self' (Coaching/Improvement) or 'opponent' (Match Prep)
    strategic_briefing TEXT,
    suggested_questions JSONB DEFAULT '[]'::jsonb NOT NULL,
    messages JSONB DEFAULT '[]'::jsonb NOT NULL,   -- Array of {role: 'user'|'assistant', content: string, timestamp: string}
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.ai_coaching_logs IS 'AI strategic briefings and conversation history tied to a specific analysis run';

-- ==============================================================================
-- PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id);
CREATE INDEX IF NOT EXISTS idx_datasets_player_id ON public.datasets(player_id);
CREATE INDEX IF NOT EXISTS idx_games_dataset_id ON public.games(dataset_id);
CREATE INDEX IF NOT EXISTS idx_games_eco ON public.games(eco);
CREATE INDEX IF NOT EXISTS idx_games_played_at ON public.games(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_player_id ON public.analysis_runs(player_id);
CREATE INDEX IF NOT EXISTS idx_game_analyses_run_id ON public.game_analyses(run_id);
CREATE INDEX IF NOT EXISTS idx_game_analyses_game_id ON public.game_analyses(game_id);
CREATE INDEX IF NOT EXISTS idx_critical_positions_game_id ON public.game_critical_positions(game_id);
CREATE INDEX IF NOT EXISTS idx_critical_positions_analysis_id ON public.game_critical_positions(game_analysis_id);
CREATE INDEX IF NOT EXISTS idx_ai_coaching_run_id ON public.ai_coaching_logs(run_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_critical_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_coaching_logs ENABLE ROW LEVEL SECURITY;

-- 1. Profiles RLS
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- 2. Players RLS
CREATE POLICY "Users can CRUD own players"
    ON public.players FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. Datasets RLS
CREATE POLICY "Users can CRUD datasets of their players"
    ON public.datasets FOR ALL
    USING (player_id IN (SELECT id FROM public.players WHERE user_id = auth.uid()))
    WITH CHECK (player_id IN (SELECT id FROM public.players WHERE user_id = auth.uid()));

-- 4. Games RLS
CREATE POLICY "Users can CRUD games of their datasets"
    ON public.games FOR ALL
    USING (dataset_id IN (
        SELECT d.id FROM public.datasets d
        JOIN public.players p ON d.player_id = p.id
        WHERE p.user_id = auth.uid()
    ))
    WITH CHECK (dataset_id IN (
        SELECT d.id FROM public.datasets d
        JOIN public.players p ON d.player_id = p.id
        WHERE p.user_id = auth.uid()
    ));

-- 5. Analysis Runs RLS
CREATE POLICY "Users can CRUD analysis runs of their players"
    ON public.analysis_runs FOR ALL
    USING (player_id IN (SELECT id FROM public.players WHERE user_id = auth.uid()))
    WITH CHECK (player_id IN (SELECT id FROM public.players WHERE user_id = auth.uid()));

-- 6. Game Analyses RLS
CREATE POLICY "Users can CRUD game analyses of their runs"
    ON public.game_analyses FOR ALL
    USING (run_id IN (
        SELECT r.id FROM public.analysis_runs r
        JOIN public.players p ON r.player_id = p.id
        WHERE p.user_id = auth.uid()
    ))
    WITH CHECK (run_id IN (
        SELECT r.id FROM public.analysis_runs r
        JOIN public.players p ON r.player_id = p.id
        WHERE p.user_id = auth.uid()
    ));

-- 7. Game Critical Positions RLS
CREATE POLICY "Users can CRUD critical positions of their games"
    ON public.game_critical_positions FOR ALL
    USING (game_id IN (
        SELECT g.id FROM public.games g
        JOIN public.datasets d ON g.dataset_id = d.id
        JOIN public.players p ON d.player_id = p.id
        WHERE p.user_id = auth.uid()
    ))
    WITH CHECK (game_id IN (
        SELECT g.id FROM public.games g
        JOIN public.datasets d ON g.dataset_id = d.id
        JOIN public.players p ON d.player_id = p.id
        WHERE p.user_id = auth.uid()
    ));

-- 8. AI Coaching Logs RLS
CREATE POLICY "Users can CRUD AI coaching logs of their runs"
    ON public.ai_coaching_logs FOR ALL
    USING (run_id IN (
        SELECT r.id FROM public.analysis_runs r
        JOIN public.players p ON r.player_id = p.id
        WHERE p.user_id = auth.uid()
    ))
    WITH CHECK (run_id IN (
        SELECT r.id FROM public.analysis_runs r
        JOIN public.players p ON r.player_id = p.id
        WHERE p.user_id = auth.uid()
    ));

-- ==============================================================================
-- AUTOMATIC PROFILE CREATION TRIGGER ON AUTH SIGNUP
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- STORAGE BUCKET CONFIGURATION (PGN Vault)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'pgn-vault',
    'pgn-vault',
    false,
    52428800, -- 50MB max per PGN archive
    ARRAY['application/x-chess-pgn', 'text/plain', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Users can only upload and read files inside their own folder: pgn-vault/{user_id}/*
CREATE POLICY "Users can access own PGN storage objects"
    ON storage.objects FOR ALL
    USING (bucket_id = 'pgn-vault' AND auth.uid()::text = (storage.foldername(name))[1])
    WITH CHECK (bucket_id = 'pgn-vault' AND auth.uid()::text = (storage.foldername(name))[1]);
