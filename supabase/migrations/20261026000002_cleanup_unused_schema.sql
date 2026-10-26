-- ==============================================================================
-- CHESS PLAYER ANALYZER V2: CLEANUP UNUSED DATABASE SCHEMA
-- Migration: 20261026000002_cleanup_unused_schema.sql
-- Purpose: Remove obsolete tables, unused columns, and orphan policies
-- ==============================================================================

-- 1. DROP UNUSED TABLES (with CASCADE for constraints, indexes & policies)
DROP TABLE IF EXISTS public.game_critical_positions CASCADE;
DROP TABLE IF EXISTS public.game_analyses CASCADE;
DROP TABLE IF EXISTS public.ai_coaching_logs CASCADE;

-- 2. DROP UNUSED COLUMNS FROM public.profiles
ALTER TABLE public.profiles
    DROP COLUMN IF EXISTS lichess_username,
    DROP COLUMN IF EXISTS chesscom_username,
    DROP COLUMN IF EXISTS avatar_url;

-- 3. DROP UNUSED COLUMNS FROM public.datasets
ALTER TABLE public.datasets
    DROP COLUMN IF EXISTS pgn_storage_path;

-- 4. DROP UNUSED COLUMNS FROM public.games
ALTER TABLE public.games
    DROP COLUMN IF EXISTS has_embedded_eval;

-- 5. DROP UNUSED COLUMNS FROM public.analysis_runs
ALTER TABLE public.analysis_runs
    DROP COLUMN IF EXISTS dominant_archetype,
    DROP COLUMN IF EXISTS style_radar_metrics,
    DROP COLUMN IF EXISTS engine_status,
    DROP COLUMN IF EXISTS engine_coverage_pct,
    DROP COLUMN IF EXISTS engine_games_count,
    DROP COLUMN IF EXISTS engine_name,
    DROP COLUMN IF EXISTS engine_depth,
    DROP COLUMN IF EXISTS overall_acpl,
    DROP COLUMN IF EXISTS acpl_opening,
    DROP COLUMN IF EXISTS acpl_middlegame,
    DROP COLUMN IF EXISTS acpl_endgame;

-- 6. DROP STORAGE POLICIES & REMOVE BUCKET REFERENCE
DROP POLICY IF EXISTS "Users can access own PGN storage objects" ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'pgn-vault';

-- 7. CLEAN UP ORPHANED INDEXES IF NOT ALREADY DROPPED BY CASCADE
DROP INDEX IF EXISTS public.idx_game_analyses_run_id;
DROP INDEX IF EXISTS public.idx_game_analyses_game_id;
DROP INDEX IF EXISTS public.idx_critical_positions_game_id;
DROP INDEX IF EXISTS public.idx_critical_positions_analysis_id;
DROP INDEX IF EXISTS public.idx_ai_coaching_run_id;
