"""
Analysis Service Layer
----------------------
Executes the mathematical and strategic chess analysis pipeline:
- Statistics & Win/Draw/Loss rates (White & Black)
- Opening Tree with EPD Transposition Safe hashing
- Empirical Bayesian Shrinkage (K=6.0) for strengths & weaknesses
- Pawn Structure classification & performance delta
- Opponent profile & rule-based insights
Directly reuses: src.statistics, src.opening_tree, src.player_profile, src.analysis.*
"""
from typing import List, Dict, Any, Optional

from src.statistics import calculate_game_stats
from src.opening_tree import build_opening_tree, get_position_details
from src.player_profile import analyze_opening_repertoire, generate_deep_opponent_profile


class AnalysisService:
    @staticmethod
    def run_complete_analysis(
        games: List[Dict[str, Any]],
        player_name: str,
        color_filter: str = "all",
        run_label: str = "Complete Analytical Snapshot",
        max_stockfish_games: int = 0
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
                "stats_raw": {},
                "deep_profile_raw": {},
                "fen_map": {}
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

        # 4. Generate Deep Profile (Pawn Structures & Rule Insights)
        deep_profile = generate_deep_opponent_profile(
            filtered_games,
            stats
        )

        # 5. Package Root Opening Tree Snapshot (Top 4 Plies)
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
            "fen_map": fen_map
        }

    @staticmethod
    def query_tree_position(fen_map: Dict[str, Any], current_fen: str) -> Dict[str, Any]:
        """
        Queries next moves / continuations for any given FEN position.
        """
        return get_position_details(fen_map, current_fen)
