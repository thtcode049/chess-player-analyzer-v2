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
INSERT INTO public.profiles (id, email, display_name, lichess_username, chesscom_username)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'grandmaster@example.com',
    'Grandmaster Tester',
    'Hikaru',
    'Hikaru'
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
INSERT INTO public.datasets (id, player_id, source_type, source_identifier, games_count, pgn_storage_path)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'lichess',
    'Hikaru',
    1,
    'pgn-vault/00000000-0000-0000-0000-000000000001/22222222-2222-2222-2222-222222222222.pgn'
)
ON CONFLICT (id) DO NOTHING;

-- 5. Mock Game
INSERT INTO public.games (
    id, dataset_id, external_id, site_url, played_at,
    white_player, black_player, white_elo, black_elo, result,
    eco, opening_name, time_control, ply_count, moves_san, has_embedded_eval
)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    'hikaru_game_001',
    'https://lichess.org/analysis',
    now() - INTERVAL '2 days',
    'Hikaru Nakamura', 'Magnus Carlsen', 2875, 2882, '1-0',
    'B90', 'Sicilian Defense: Najdorf Variation', '180+2', 40,
    '1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be3 e5 7.Nb3 Be6 8.f3 Be7 9.Qd2 O-O 10.O-O-O Nbd7 11.g4 b5 12.g5 b4 13.Ne2 Ne8 14.f4 a5 15.f5 a4 16.Nbd4 exd4 17.Nxd4 b3 18.Kb1 bxc2+ 19.Nxc2 Bb3 20.axb3 axb3',
    true
)
ON CONFLICT (id) DO NOTHING;

-- 6. Mock Analysis Run
INSERT INTO public.analysis_runs (
    id, player_id, run_label, scope_filter, games_analyzed_count,
    engine_status, engine_coverage_pct, engine_games_count, engine_name, engine_depth,
    overall_win_rate, overall_score, white_score, black_score,
    overall_acpl, acpl_opening, acpl_middlegame, acpl_endgame, dominant_archetype,
    repertoire_summary, pawn_structures_summary, style_radar_metrics, opening_tree_snapshot
)
VALUES (
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'All Lichess Blitz Games',
    '{"source": "lichess", "color": "all"}'::jsonb,
    1,
    'embedded_eval',
    100.00,
    1,
    'Stockfish 16 (Lichess Server)',
    18,
    100.00, 100.00, 100.00, 0.00,
    18.4, 12.1, 19.5, 22.0, 'Universal',
    '{"most_played": [{"name": "Sicilian Defense", "eco": "B90", "games_count": 1, "score_pct": 100.0}]}'::jsonb,
    '{"structures": [{"name": "Open Sicilian", "games_count": 1, "score_pct": 100.0, "delta_vs_baseline": 0.0}]}'::jsonb,
    '{"volatility": 75.0, "sacrifice": 60.0, "simplification": 40.0, "resilience": 88.0, "tactical_sharpness": 82.0}'::jsonb,
    '{"san": "root", "games_count": 1, "continuations": [{"san": "e4", "games_count": 1, "usage_pct": 100.0, "win_pct": 100.0}]}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 7. Mock Game Analysis
INSERT INTO public.game_analyses (
    id, run_id, game_id, analyzed_by, engine_depth, acpl, accuracy_pct,
    blunder_count, mistake_count, inaccuracy_count
)
VALUES (
    '55555555-5555-5555-5555-555555555555',
    '44444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333333',
    'embedded',
    18,
    18.4,
    94.5,
    0, 1, 2
)
ON CONFLICT (id) DO NOTHING;

-- 8. Mock Critical Position
INSERT INTO public.game_critical_positions (
    id, game_analysis_id, game_id, ply, fen, eval_before, eval_after, cpl,
    event_type, played_move, best_move, phase
)
VALUES (
    '66666666-6666-6666-6666-666666666666',
    '55555555-5555-5555-5555-555555555555',
    '33333333-3333-3333-3333-333333333333',
    17,
    'r2q1rk1/4bppp/p2p1n2/1p2pP2/3nP3/1PN1B3/1PPQB1PP/2KR3R w - - 1 15',
    0.85, 0.20, 65.0,
    'INACCURACY',
    'f5', 'Kb1', 'middlegame'
)
ON CONFLICT (id) DO NOTHING;

-- 9. Mock AI Coaching Log
INSERT INTO public.ai_coaching_logs (
    id, run_id, perspective_mode, strategic_briefing, suggested_questions, messages
)
VALUES (
    '77777777-7777-7777-7777-777777777777',
    '44444444-4444-4444-4444-444444444444',
    'self',
    '### Strategic Executive Briefing: Hikaru Nakamura\n\n- **Dominant Archetype**: Universal Tactician\n- **Opening Repertoire**: High mastery in Sicilian Najdorf with White.\n- **Recommendation**: Focus on consolidating queenside pawn tension in the middlegame.',
    '["Làm thế nào để cải thiện tỷ lệ thắng khi đối đầu với Sicilian?", "Điểm yếu lớn nhất ở tàn cuộc là gì?"]'::jsonb,
    '[{"role": "assistant", "content": "Xin chào Đại kiện tướng! Tôi đã sẵn sàng tham mưu chiến lược ván đấu cho bạn."}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
