"""
Analysis Service Layer
----------------------
Executes the mathematical and strategic chess analysis pipeline:
- Statistics & Win/Draw/Loss rates (White & Black)
- Opening Tree with EPD Transposition Safe hashing
- Pawn Structure classification and observed results
- Opponent profile & rule-based insights
Directly reuses: src.statistics, src.opening_tree, src.player_profile, src.analysis.*
"""
from typing import List, Dict, Any

from src.statistics import calculate_game_stats, calculate_rate, calculate_score_percentage
from src.opening_tree import build_opening_tree, get_position_details
from src.player_profile import generate_deep_opponent_profile
from src.utils import resolve_game_player_color

GROUP_FIELDS = {
    "name", "games_count", "wins", "draws", "losses", "score_pct",
    "win_pct", "draw_pct", "loss_pct", "usage_pct", "game_indices",
}
STRUCTURE_FIELDS = GROUP_FIELDS | {
    "structure_key", "chapter", "group", "group_title", "group_order",
    "strategic_plan", "avg_acpl", "typical_formation_move", "games",
}


def _observed_groups(items: Any, fields: set[str]) -> List[Dict[str, Any]]:
    groups = []
    for item in items or []:
        if not isinstance(item, dict) or not item.get("name"):
            continue
        group = {key: value for key, value in item.items() if key in fields}
        if group.get("score_pct") is None and item.get("raw_score_pct") is not None:
            group["score_pct"] = item["raw_score_pct"]
        groups.append(group)
    return groups


def observed_profile(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    """Project persisted or cached analysis onto the current descriptive fields."""
    repertoire = snapshot.get("repertoire_summary") or {}
    structures = snapshot.get("pawn_structures_summary") or {}
    return {
        "repertoire": {
            key: _observed_groups(repertoire[key], GROUP_FIELDS)
            for key in ("all_openings", "most_played", "white_repertoire", "black_repertoire")
            if key in repertoire
        },
        "structures": {"structures": _observed_groups(structures.get("structures"), STRUCTURE_FIELDS)},
    }


def observed_snapshot_stats(snapshot: Dict[str, Any], repertoire: Dict[str, Any]) -> Dict[str, Any]:
    metadata = (snapshot.get("repertoire_summary") or {}).get("_snapshot") or {}
    stored = snapshot.get("stats_raw") or metadata.get("stats")
    if stored:
        return stored

    total = snapshot.get("games_analyzed_count")
    stats = {"total_games": total}
    for source, target in (
        ("overall_win_rate", "win_rate"), ("overall_score", "score_percentage"),
        ("white_score", "white_score_percentage"), ("black_score", "black_score_percentage"),
    ):
        value = snapshot.get(source)
        if value is not None:
            stats[target] = float(value)

    # Legacy snapshots may already contain exact counts in disjoint repertoire groups.
    for group, prefix in (("all_openings", ""), ("white_repertoire", "white_"), ("black_repertoire", "black_")):
        if group not in repertoire:
            continue
        items = repertoire[group]
        if any(not isinstance(item.get("games_count"), int) for item in items):
            continue
        count = sum(item["games_count"] for item in items)
        if not prefix and count != total:
            continue
        if prefix:
            stats[f"{prefix}games"] = count
        outcomes = ("wins", "draws", "losses")
        if any(not isinstance(item.get(key), int) for item in items for key in outcomes):
            continue
        counts = {key: sum(item[key] for item in items) for key in outcomes}
        if sum(counts.values()) != count:
            continue
        stats.update({f"{prefix}{key}": value for key, value in counts.items()})
        if count:
            stats[f"{prefix}score_percentage"] = calculate_score_percentage(counts["wins"], counts["draws"], count)
            if not prefix:
                for outcome, rate in zip(outcomes, ("win_rate", "draw_rate", "loss_rate")):
                    stats[rate] = calculate_rate(counts[outcome], count)
    return stats


class AnalysisService:
    @staticmethod
    def run_complete_analysis(
        games: List[Dict[str, Any]],
        player_name: str,
        color_filter: str = "all",
        run_label: str = "Complete Analytical Snapshot"
    ) -> Dict[str, Any]:
        """
        Executes full deterministic analysis pipeline across game collection.
        Returns a dictionary formatted to directly populate public.analysis_runs.
        """
        color_filter = str(color_filter or "all").lower()
        if color_filter not in ("white", "black"):
            color_filter = "all"

        filtered_games = []
        for game in games:
            color = resolve_game_player_color(game, player_name)
            if color is not None and color_filter in ("all", color):
                filtered_games.append({**game, "player_color": color})

        total_games = len(filtered_games)

        # 2. Statistics Calculation (Win/Draw/Loss & Score)
        stats = calculate_game_stats(filtered_games)

        # 3. Opening Tree Construction (EPD Transposition-Safe)
        _, fen_map = build_opening_tree(filtered_games, color=color_filter)

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
            "scope_filter": {"color": color_filter},
            "games": filtered_games,
            "snapshot_version": 2,
            "games_analyzed_count": total_games,
            
            # Observed results
            "overall_win_rate": stats["win_rate"] if total_games else None,
            "overall_score": stats["score_percentage"] if total_games else None,
            "white_score": stats["white_score_percentage"] if stats["white_games"] else None,
            "black_score": stats["black_score_percentage"] if stats["black_games"] else None,
            
            # Snapshots
            "repertoire_summary": deep_profile["repertoire"],
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
