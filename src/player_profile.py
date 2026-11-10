"""
Player Profile & Opening Repertoire Module
------------------------------------------
Chức năng: Phân tích danh mục khai cuộc (Opening Repertoire) và sinh các nhận định
tự động (Rule-Based Insights) hỗ trợ người chơi nhận diện phong cách của đối thủ.
"""

from typing import List, Dict, Any, Optional
from src.statistics import calculate_rate, calculate_score_percentage
from src.utils import determine_game_outcome


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
) -> Dict[str, Any]:
    """Summarize observed results by opening and by player color."""
    openings_map: Dict[str, Dict[str, Any]] = {}
    white_map: Dict[str, Dict[str, Any]] = {}
    black_map: Dict[str, Dict[str, Any]] = {}

    total_games = len(filtered_games)
    for game_index, game in enumerate(filtered_games):
        raw_op = game.get("opening") or game.get("opening_name") or "Unknown Opening"
        opening_name = str(raw_op).strip()
        if not opening_name:
            opening_name = "Unknown Opening"

        player_color = game.get("player_color", "white")
        result = game.get("result", "")

        is_win, is_draw, is_loss = determine_game_outcome(player_color, result)

        def _update_stats(target_dict: dict, op_name: str):
            if op_name not in target_dict:
                target_dict[op_name] = {"games": 0, "wins": 0, "draws": 0, "losses": 0, "game_indices": []}
            target_dict[op_name]["games"] += 1
            target_dict[op_name]["game_indices"].append(game_index)
            if is_win:
                target_dict[op_name]["wins"] += 1
            elif is_draw:
                target_dict[op_name]["draws"] += 1
            elif is_loss:
                target_dict[op_name]["losses"] += 1

        _update_stats(openings_map, opening_name)
        if player_color == "white":
            _update_stats(white_map, opening_name)
        else:
            _update_stats(black_map, opening_name)

    def _finalize_list(target_dict: dict, denominator: int) -> List[Dict[str, Any]]:
        result_list = []
        for name, data in target_dict.items():
            g_count = data["games"]
            w = data["wins"]
            d = data["draws"]
            l = data["losses"]

            usage_pct = round((g_count / denominator) * 100, 1) if denominator > 0 else 0.0
            score_pct = calculate_score_percentage(w, d, g_count)
            win_pct = calculate_rate(w, g_count)
            draw_pct = calculate_rate(d, g_count)
            loss_pct = calculate_rate(l, g_count)

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
                "game_indices": data["game_indices"],
            }
            result_list.append(item)

        return result_list

    all_openings = _finalize_list(openings_map, total_games)
    white_repertoire = _finalize_list(white_map, sum(1 for g in filtered_games if g.get("player_color") == "white"))
    black_repertoire = _finalize_list(black_map, sum(1 for g in filtered_games if g.get("player_color") == "black"))

    most_played = sorted(all_openings, key=lambda x: x["games_count"], reverse=True)
    return {
        "all_openings": most_played,
        "most_played": most_played[:5],
        "white_repertoire": sorted(white_repertoire, key=lambda x: x["games_count"], reverse=True),
        "black_repertoire": sorted(black_repertoire, key=lambda x: x["games_count"], reverse=True),
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

    # Describe observed scores only when both colors are represented.
    if stats.get("white_games") and stats.get("black_games"):
        insights.append({
            "type": "stat",
            "icon": "📊",
            "title": "Kết quả theo màu quân",
            "text": (
                f"Trắng đạt {stats['white_score_percentage']}% điểm qua {stats['white_games']} ván. "
                f"Đen đạt {stats['black_score_percentage']}% điểm qua {stats['black_games']} ván."
            ),
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

    repertoire_data = analyze_opening_repertoire(filtered_games)
    structures_data = analyze_structural_performance(filtered_games, move_evaluations=move_evaluations)
    rule_insights = generate_player_insights(filtered_games, stats, repertoire_data, {})

    return {
        "repertoire": repertoire_data,
        "structures": structures_data,
        "rule_insights": rule_insights,
    }


# Alias chuẩn hóa theo định hướng phân tích kỳ thủ (Chess Player Analyzer)
generate_deep_player_profile = generate_deep_opponent_profile



