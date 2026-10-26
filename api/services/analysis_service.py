"""
Analysis Service Layer
----------------------
Executes the mathematical and strategic chess analysis pipeline:
- Statistics & Win/Draw/Loss rates (White & Black)
- Opening Tree with EPD Transposition Safe hashing
- Empirical Bayesian Shrinkage (K=6.0) for strengths & weaknesses
- Pawn Structure classification & performance delta
- Playing style radar metrics (8-axis) & archetype classifier
- Embedded Stockfish ACPL Phase Analysis (zero server load)
- Critical turning positions extraction
Directly reuses: src.statistics, src.opening_tree, src.player_profile, src.analysis.*
"""
from typing import List, Dict, Any, Optional, Tuple

from src.statistics import calculate_game_stats
from src.opening_tree import build_opening_tree, get_position_details
from src.player_profile import analyze_opening_repertoire, generate_deep_opponent_profile
from src.analysis.confidence import assess_performance, calculate_adjusted_score
from src.analysis.pawn_structure import analyze_structural_performance
from src.analysis.critical_positions import find_critical_positions
from src.engine.evaluator import get_comprehensive_move_evaluations

class AnalysisService:
    @staticmethod
    def run_complete_analysis(
        games: List[Dict[str, Any]],
        player_name: str,
        color_filter: str = "all",
        run_label: str = "Complete Analytical Snapshot",
        max_stockfish_games: int = 0  # Default 0: Fast instant extraction (embedded only). Client WASM handles full batch.
    ) -> Dict[str, Any]:
        """
        Executes full deterministic analysis pipeline across game collection.
        Returns a dictionary formatted to directly populate public.analysis_runs.
        """
        if not games:
            return {
                "run_label": run_label,
                "games_analyzed_count": 0,
                "overall_win_rate": 0.0,
                "overall_score": 0.0,
                "white_score": 0.0,
                "black_score": 0.0,
                "repertoire_summary": {},
                "pawn_structures_summary": {},
                "opening_tree_snapshot": {},
                "critical_positions": []
            }

        # 1. Filter games by color if requested
        if color_filter.lower() in ["white", "black"]:
            filtered_games = [g for g in games if str(g.get("player_color", "")).lower() == color_filter.lower()]
            if not filtered_games:
                filtered_games = games
        else:
            filtered_games = games

        total_games = len(filtered_games)

        # 2. Statistics Calculation (Win/Draw/Loss & Score)
        stats = calculate_game_stats(filtered_games)

        # 3. Opening Tree Construction (EPD Transposition-Safe)
        tree_root, fen_map = build_opening_tree(filtered_games, color=color_filter)
        repertoire_data = analyze_opening_repertoire(filtered_games)

        # 4. Hybrid Evaluation: Embedded (Lichess [%eval]) + Optional Stockfish
        target_sf_games = max_stockfish_games if max_stockfish_games is not None else 0
        comp_res = get_comprehensive_move_evaluations(
            filtered_games,
            depth=6,
            max_stockfish_games=target_sf_games
        )
        move_evals = comp_res.get("move_evaluations", []) if comp_res.get("available") else None

        analyzed_games_count = comp_res.get("analyzed_games", 0)
        source = comp_res.get("source", "none")
        has_embedded = source in ("embedded_pgn", "hybrid_stockfish")
        has_stockfish = source in ("parallel_stockfish", "hybrid_stockfish")

        # Determine Engine Status & Coverage
        if analyzed_games_count > 0:
            coverage_pct = round((analyzed_games_count / max(1, total_games)) * 100.0, 2)
            if source in ("parallel_stockfish", "hybrid_stockfish"):
                engine_status = "stockfish_parallel"
                engine_name = "Stockfish 19 Parallel"
                engine_depth = 6
            else:  # embedded_pgn
                engine_status = "embedded_eval"
                engine_name = "Embedded Server Eval (Lichess/Chess.com)"
                engine_depth = 20
        else:
            coverage_pct = 0.0
            analyzed_games_count = 0
            engine_status = "statistical_only"
            engine_name = None
            engine_depth = None

        # 5. Generate Deep Profile (Pawn Structures, Phase ACPL, Style Metrics)
        deep_profile = generate_deep_opponent_profile(
            filtered_games,
            stats,
            move_evaluations=move_evals
        )

        phases_data = deep_profile.get("phases", {}).get("phases", {})
        # Trích xuất ACPL (centipawn) từng giai đoạn — dùng avg_acpl, KHÔNG dùng accuracy%
        opening_acpl = phases_data.get("opening", {}).get("avg_acpl")
        middlegame_acpl = phases_data.get("middlegame", {}).get("avg_acpl")
        endgame_acpl = phases_data.get("endgame", {}).get("avg_acpl")
        # Chuyển 0.0 (fallback không có dữ liệu) thành None để frontend hiển thị "N/A"
        opening_acpl = opening_acpl if opening_acpl else None
        middlegame_acpl = middlegame_acpl if middlegame_acpl else None
        endgame_acpl = endgame_acpl if endgame_acpl else None

        dominant_archetype = None

        # 6. Extract Critical Positions (Blunders & Eval Swings)
        critical_positions = find_critical_positions(move_evals, max_positions=15) if move_evals else []

        # 7. Package Root Opening Tree Snapshot (Top 4 Plies)
        root_fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
        root_details = get_position_details(fen_map, root_fen)

        return {
            "run_label": run_label,
            "games_analyzed_count": total_games,
            
            # Basic & Bayesian metrics
            "overall_win_rate": float(stats.get("win_rate", 0.0)),
            "overall_score": float(stats.get("score_percentage", 0.0)),
            "white_score": float(stats.get("white_score_percentage", 0.0)),
            "black_score": float(stats.get("black_score_percentage", 0.0)),
            
            # Snapshots
            "repertoire_summary": repertoire_data,
            "pawn_structures_summary": deep_profile.get("structures", {}),
            "opening_tree_snapshot": root_details,
            
            # Additional rich state
            "stats_raw": stats,
            "deep_profile_raw": deep_profile,
            "critical_positions": critical_positions,
            "fen_map": fen_map
        }

    @staticmethod
    def query_tree_position(fen_map: Dict[str, Any], current_fen: str) -> Dict[str, Any]:
        """
        Queries next moves / continuations for any given FEN position.
        """
        return get_position_details(fen_map, current_fen)
