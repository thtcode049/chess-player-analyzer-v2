"""
Player Profile & Opening Repertoire Module
------------------------------------------
Chức năng: Phân tích danh mục khai cuộc (Opening Repertoire) và sinh các nhận định
tự động (Rule-Based Insights) hỗ trợ người chơi nhận diện phong cách của đối thủ.
"""

from typing import List, Dict, Any, Optional
from src.ui_components import get_icon_svg
from src.utils import determine_game_outcome


from src.analysis.confidence import (
    calculate_adjusted_score,
    calculate_delta,
    assess_performance,
    get_sample_confidence,
    format_assessment_label,
    enrich_performance_item,
    rank_strongest_items,
    rank_weakest_items,
    DEFAULT_PRIOR_STRENGTH
)


def get_opening_label(game: Dict[str, Any]) -> str:
    """Trích xuất nhãn khai cuộc từ PGN header."""
    opening = game.get("opening", "").strip()
    eco = game.get("eco", "").strip()
    moves = game.get("moves", [])

    if opening and eco:
        return f"{eco} - {opening}"
    if eco:
        return f"ECO {eco}"
    if opening:
        return opening
    if len(moves) >= 2:
        return f"1.{moves[0]} {moves[1]}"
    if len(moves) == 1:
        return f"1.{moves[0]}"
    return "Unknown Opening"


# Alias for internal/backward compatibility
_get_opening_label = get_opening_label


def analyze_opening_repertoire(
    filtered_games: List[Dict[str, Any]],
    min_sample: int = 2,
    baseline_score: Optional[float] = None,
    prior_strength: float = 3.0,
    lang: str = "vi"
) -> Dict[str, Any]:
    """
    Phân tích Repertoire khai cuộc của đối thủ có tích hợp Bayesian Shrinkage & Statistical Confidence.
    Bổ sung adjusted_score_pct, delta_vs_baseline, assessment và Opening Accuracy vào từng opening.
    """
    openings_map: Dict[str, Dict[str, Any]] = {}
    white_map: Dict[str, Dict[str, Any]] = {}
    black_map: Dict[str, Dict[str, Any]] = {}

    total_games = len(filtered_games)
    total_wins = 0
    total_draws = 0
    total_losses = 0

    for game in filtered_games:
        opening_name = game.get("opening", "Unknown Opening").strip()
        if not opening_name:
            opening_name = "Unknown Opening"

        player_color = game.get("player_color", "white")
        result = game.get("result", "*")

        is_win, is_draw, is_loss = determine_game_outcome(player_color, result)
        if is_win:
            total_wins += 1
        elif is_draw:
            total_draws += 1
        elif is_loss:
            total_losses += 1

        def _update_stats(target_dict: dict, op_name: str, g_item: dict):
            if op_name not in target_dict:
                target_dict[op_name] = {"games": 0, "wins": 0, "draws": 0, "losses": 0, "games_list": []}
            target_dict[op_name]["games"] += 1
            target_dict[op_name]["games_list"].append(g_item)
            if is_win:
                target_dict[op_name]["wins"] += 1
            elif is_draw:
                target_dict[op_name]["draws"] += 1
            elif is_loss:
                target_dict[op_name]["losses"] += 1

        _update_stats(openings_map, opening_name, game)
        if player_color == "white":
            _update_stats(white_map, opening_name, game)
        else:
            _update_stats(black_map, opening_name, game)

    # Tính Overall Player Baseline Score (mặc định 50% nếu chưa có dữ liệu)
    if baseline_score is None:
        effective_baseline = round(((total_wins + 0.5 * total_draws) / total_games) * 100, 1) if total_games > 0 else 50.0
    else:
        effective_baseline = round(float(baseline_score), 1)

    def _finalize_list(target_dict: dict, denominator: int) -> List[Dict[str, Any]]:
        result_list = []
        for name, data in target_dict.items():
            g_count = data["games"]
            w = data["wins"]
            d = data["draws"]
            l = data["losses"]
            g_list = data.get("games_list", [])

            usage_pct = round((g_count / denominator) * 100, 1) if denominator > 0 else 0.0
            score_pct = round(((w + 0.5 * d) / g_count) * 100, 1) if g_count > 0 else 0.0
            win_pct = round((w / g_count) * 100, 1) if g_count > 0 else 0.0
            draw_pct = round((d / g_count) * 100, 1) if g_count > 0 else 0.0
            loss_pct = round((l / g_count) * 100, 1) if g_count > 0 else 0.0

            item = {
                "name": name,
                "games_count": g_count,
                "usage_pct": usage_pct,
                "score_pct": score_pct,
                "win_pct": win_pct,
                "draw_pct": draw_pct,
                "loss_pct": loss_pct,
                "wins": w,
                "draws": d,
                "losses": l,
            }
            # Bổ sung Bayesian Shrinkage & Statistical Assessment cho Score
            enriched_item = enrich_performance_item(item, effective_baseline, prior_strength=prior_strength, lang=lang)
            result_list.append(enriched_item)

        return result_list

    all_openings = _finalize_list(openings_map, total_games)
    white_repertoire = _finalize_list(white_map, sum(1 for g in filtered_games if g.get("player_color") == "white"))
    black_repertoire = _finalize_list(black_map, sum(1 for g in filtered_games if g.get("player_color") == "black"))

    most_played = sorted(all_openings, key=lambda x: x["games_count"], reverse=True)
    eligible = [op for op in all_openings if op["games_count"] >= min_sample]

    # Xếp hạng Strongest / Weakest có tính đến Bayesian Shrinkage & Statistical Confidence
    best_scoring = rank_strongest_items(eligible)
    worst_scoring = rank_weakest_items(eligible)

    return {
        "all_openings": most_played,
        "most_played": most_played[:5],
        "best_scoring": best_scoring[:5],
        "worst_scoring": worst_scoring[:5],
        "white_repertoire": sorted(white_repertoire, key=lambda x: x["games_count"], reverse=True),
        "black_repertoire": sorted(black_repertoire, key=lambda x: x["games_count"], reverse=True),
        "overall_baseline": effective_baseline
    }


def generate_player_insights(
    filtered_games: List[Dict[str, Any]],
    stats: Dict[str, Any],
    repertoire_data: Dict[str, Any],
    tree_data: Dict[str, Any],
    lang: str = "vi"
) -> List[Dict[str, str]]:
    """
    Sinh danh sách các Insight (Rule-based) tự động đa ngôn ngữ.
    """
    insights = []
    total_games = len(filtered_games)

    if total_games == 0:
        return [{"type": "info", "icon": "💡", "title": "No Data", "text": "No game data available for analysis."}]

    # 1. Preferred First Move as White
    white_games = [g for g in filtered_games if g.get("player_color") == "white"]
    if white_games:
        first_moves_w = {}
        for g in white_games:
            m = g.get("moves", [])
            if m:
                first_moves_w[m[0]] = first_moves_w.get(m[0], 0) + 1
        if first_moves_w:
            top_w_move = max(first_moves_w.items(), key=lambda x: x[1])
            pct_w = round((top_w_move[1] / len(white_games)) * 100, 1)
            insights.append({
                "type": "opening",
                "icon": "♟️",
                "title": "Khai cuộc Trắng yêu thích",
                "text": f"Đối thủ chọn chơi nước đi 1.{top_w_move[0]} trong {pct_w}% số ván cầm Trắng."
            })

    # 2. Preferred Response to 1.e4 as Black
    black_games = [g for g in filtered_games if g.get("player_color") == "black"]
    if black_games:
        e4_responses = {}
        for g in black_games:
            m = g.get("moves", [])
            if len(m) >= 2 and m[0] == "e4":
                e4_responses[m[1]] = e4_responses.get(m[1], 0) + 1
        if e4_responses:
            top_e4_resp = max(e4_responses.items(), key=lambda x: x[1])
            pct_resp = round((top_e4_resp[1] / sum(e4_responses.values())) * 100, 1)
            insights.append({
                "type": "opening",
                "icon": "♟️",
                "title": "Đáp trả 1.e4 ưa chuộng",
                "text": f"Khi đối phương đi 1.e4, kỳ thủ này thường đáp trả bằng 1...{top_e4_resp[0]} ({pct_resp}% số ván)."
            })

    # 3. Color Performance Bias
    w_score = stats.get("white_score_percentage", 0.0)
    b_score = stats.get("black_score_percentage", 0.0)
    if stats.get("white_games", 0) >= 1 and stats.get("black_games", 0) >= 1:
        if w_score - b_score >= 10.0:
            insights.append({
                "type": "stat",
                "icon": "📊",
                "title": "Chênh lệch hiệu suất màu quân",
                "text": f"Đối thủ thi đấu vượt trội khi cầm Trắng ({w_score}%) so với khi cầm Đen ({b_score}%)."
            })
        elif b_score - w_score >= 10.0:
            insights.append({
                "type": "stat",
                "icon": "📊",
                "title": "Chênh lệch hiệu suất màu quân",
                "text": f"Đối thủ thi đấu vượt trội khi cầm Đen ({b_score}%) so với khi cầm Trắng ({w_score}%)."
            })

    # 4. Favorite Opening System
    most_played = repertoire_data.get("most_played", [])
    if most_played:
        fav = most_played[0]
        insights.append({
            "type": "repertoire",
            "icon": "🌿",
            "title": "Khai cuộc chơi nhiều nhất",
            "text": f"Hệ thống khai cuộc '{fav['name']}' xuất hiện nhiều nhất với {fav['games_count']} ván (Điểm số: {fav['score_pct']}%)."
        })

    # 5. Best Scoring Weapon
    best_scoring = repertoire_data.get("best_scoring", [])
    if best_scoring:
        best = best_scoring[0]
        if best["games_count"] >= 1:
            insights.append({
                "type": "repertoire",
                "icon": "⚔️",
                "title": "Vũ khí đạt điểm số cao nhất",
                "text": f"Khai cuộc '{best['name']}' đem lại hiệu suất cao nhất: {best['score_pct']}% trong {best['games_count']} ván."
            })

    return insights


def generate_deep_opponent_profile(
    filtered_games: List[Dict[str, Any]],
    stats: Dict[str, Any],
    move_evaluations: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Tạo cấu trúc dữ liệu Hồ sơ Phân tích Sâu của Đối thủ (Deep Opponent Profile).
    Tích hợp tất cả các module phân tích chuyên sâu: Repertoire, Structures, Phases, Dynamics, Simplification, Habits, và Critical Positions.
    """
    from src.analysis.pawn_structure import analyze_structural_performance
    from src.analysis.phase_analysis import analyze_phase_performance
    from src.analysis.game_dynamics import analyze_game_dynamics
    from src.analysis.simplification import analyze_simplification_performance
    from src.analysis.style_metrics import extract_all_style_metrics
    from src.analysis.style_classifier import classify_player_style
    from src.analysis.critical_positions import find_critical_positions

    baseline = stats.get("score_percentage", 50.0) if stats else 50.0
    repertoire_data = analyze_opening_repertoire(filtered_games, baseline_score=baseline)
    structures_data = analyze_structural_performance(filtered_games, move_evaluations=move_evaluations, baseline_score=baseline)
    phases_data = analyze_phase_performance(filtered_games, move_evaluations=move_evaluations)
    dynamics_data = analyze_game_dynamics(filtered_games, move_evaluations=move_evaluations)
    simplification_data = analyze_simplification_performance(filtered_games, move_evaluations=move_evaluations)
    
    analyzed_indices = set(e["game_index"] for e in (move_evaluations or []) if "game_index" in e)
    analyzed_games_count = len(analyzed_indices)
    total_games_count = len(filtered_games)

    style_raw_metrics = extract_all_style_metrics(
        filtered_games,
        stats,
        move_evaluations=move_evaluations,
        phases_data=phases_data
    )
    style_profile = classify_player_style(
        style_raw_metrics,
        sample_size=total_games_count,
        analyzed_games_count=analyzed_games_count,
        total_games_count=total_games_count
    )
    
    critical_positions = find_critical_positions(move_evaluations, max_positions=5)
    rule_insights = generate_player_insights(filtered_games, stats, repertoire_data, {})

    # ACPL tổng thể từ các nước đi có Stockfish evaluation của player
    all_cpls = [e["cpl"] for e in (move_evaluations or []) if "cpl" in e]
    overall_acpl = round(sum(all_cpls) / len(all_cpls), 1) if all_cpls else None
    overall_analyzed_moves = len(all_cpls)

    return {
        "repertoire": repertoire_data,
        "structures": structures_data,
        "phases": phases_data,
        "dynamics": dynamics_data,
        "simplification": simplification_data,
        "style_profile": style_profile,
        "critical_positions": critical_positions,
        "rule_insights": rule_insights,
        "has_engine_data": bool(move_evaluations),
        "overall_acpl": overall_acpl,
        "overall_analyzed_moves": overall_analyzed_moves
    }


# Alias chuẩn hóa theo định hướng phân tích kỳ thủ (Chess Player Analyzer)
generate_deep_player_profile = generate_deep_opponent_profile



