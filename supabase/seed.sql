-- ==============================================================================
-- CHESS PLAYER ANALYZER V2: LOCAL SEED DATA
-- Purpose: Sample records for development, testing, and schema verification.
-- ==============================================================================

-- 1. Create a mock user in auth.users if not exists
INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'grandmaster@example.com',
    '{"full_name": "Grandmaster Tester"}'::jsonb,
    now(),
    now()
)
ON CONFLICT (id) DO NOTHING;

-- 2. Mock Profile
INSERT INTO public.profiles (id, email, display_name)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'grandmaster@example.com',
    'Grandmaster Tester'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Mock Player
INSERT INTO public.players (id, user_id, canonical_name, title, notes)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000001',
    'Hikaru Nakamura',
    'GM',
    'Elite Grandmaster, world blitz champion and speed chess specialist.'
)
ON CONFLICT (id) DO NOTHING;

-- 4. Mock Dataset
INSERT INTO public.datasets (id, player_id, source_type, source_identifier, games_count)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'lichess',
    'Hikaru',
    1
)
ON CONFLICT (id) DO NOTHING;

-- 5. Mock Game
INSERT INTO public.games (
    id, dataset_id, external_id, site_url, played_at,
    white_player, black_player, white_elo, black_elo, result,
    eco, opening_name, time_control, ply_count, moves_san
)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    'hikaru_game_001',
    'https://lichess.org/analysis',
    now() - INTERVAL '2 days',
    'Hikaru Nakamura', 'Magnus Carlsen', 2875, 2882, '1-0',
    'B90', 'Sicilian Defense: Najdorf Variation', '180+2', 40,
    '1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be3 e5 7.Nb3 Be6 8.f3 Be7 9.Qd2 O-O 10.O-O-O Nbd7 11.g4 b5 12.g5 b4 13.Ne2 Ne8 14.f4 a5 15.f5 a4 16.Nbd4 exd4 17.Nxd4 b3 18.Kb1 bxc2+ 19.Nxc2 Bb3 20.axb3 axb3'
)
ON CONFLICT (id) DO NOTHING;

-- 6. Mock Analysis Run
INSERT INTO public.analysis_runs (
    id, player_id, run_label, scope_filter, games_analyzed_count,
    overall_win_rate, overall_score, white_score, black_score,
    repertoire_summary, pawn_structures_summary, opening_tree_snapshot
)
VALUES (
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'All Lichess Blitz Games',
    '{"source": "lichess", "color": "all"}'::jsonb,
    1,
    100.00, 100.00, 100.00, 0.00,
    '{"most_played": [{"name": "Sicilian Defense", "eco": "B90", "games_count": 1, "score_pct": 100.0}]}'::jsonb,
    '{"structures": [{"name": "Open Sicilian", "games_count": 1, "score_pct": 100.0, "delta_vs_baseline": 0.0}]}'::jsonb,
    '{"san": "root", "games_count": 1, "continuations": [{"san": "e4", "games_count": 1, "usage_pct": 100.0, "win_pct": 100.0}]}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
