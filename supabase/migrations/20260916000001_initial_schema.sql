-- ==============================================================================
-- CHESS PLAYER ANALYZER V2: CLEAN INITIAL DATABASE SCHEMA
-- Database: Supabase PostgreSQL
-- Features: 5 Core Tables (profiles, players, datasets, games, analysis_runs),
--           Cascading Foreign Keys, Performance Indexes, Strict RLS & Auth Trigger.
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
    moves_san TEXT NOT NULL,            -- Clean standard SAN move sequence
    raw_headers JSONB DEFAULT '{}'::jsonb NOT NULL, -- Preserved original PGN tags
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
    scope_filter JSONB DEFAULT '{}'::jsonb NOT NULL,
    games_analyzed_count INT NOT NULL,
    
    -- Core Mathematical & Bayesian Metrics
    overall_win_rate NUMERIC(5, 2),
    overall_score NUMERIC(5, 2),
    white_score NUMERIC(5, 2),
    black_score NUMERIC(5, 2),
    
    -- Compact High-Density JSONB Snapshots
    repertoire_summary JSONB,           -- Most played, best, and worst openings with Bayes score
    pawn_structures_summary JSONB,      -- Carlsbad, Isolani, Hedgehog performance
    opening_tree_snapshot JSONB,        -- Root continuations tree for interactive drill-down
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.analysis_runs IS 'Persistent analytical snapshots generated by Python service layer';

-- ==============================================================================
-- PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id);
CREATE INDEX IF NOT EXISTS idx_datasets_player_id ON public.datasets(player_id);
CREATE INDEX IF NOT EXISTS idx_games_dataset_id ON public.games(dataset_id);
CREATE INDEX IF NOT EXISTS idx_games_eco ON public.games(eco);
CREATE INDEX IF NOT EXISTS idx_games_played_at ON public.games(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_player_id ON public.analysis_runs(player_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
