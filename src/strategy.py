"""
Opening Response Statistics
---------------------------------------------------
Thống kê phản ứng khai cuộc của kỳ thủ theo nước đi đầu tiên.
"""

from typing import List, Dict, Any
from src.utils import determine_game_outcome


def analyze_opponent_responses(
    filtered_games: List[Dict[str, Any]],
    user_color: str = "white",
    chosen_move: str = "ALL"
) -> Dict[str, Any]:
    """
    Phân tích phản ứng của đối thủ đối với từng nước đi khai cuộc do người chơi chủ động lựa chọn.
    """
    first_move_groups: Dict[str, Dict[str, Any]] = {}

    target_player_color = "black" if user_color == "white" else "white"
    relevant_games = [g for g in filtered_games if g.get("player_color") == target_player_color]

    for game in relevant_games:
        moves = game.get("moves")
        if (moves is None or len(moves) == 0) and game.get("moves_san"):
            import re
            tokens = str(game["moves_san"]).split()
            moves = [re.sub(r"^\d+\.+", "", t).strip() for t in tokens if re.sub(r"^\d+\.+", "", t).strip() not in ["1-0", "0-1", "1/2-1/2"]]
        elif moves is None:
            moves = []

        if not moves:
            continue
        
        first_move = moves[0]
        resp_move = moves[1] if len(moves) >= 2 else "Unknown"
        opening_name = game.get("opening") or game.get("opening_name") or "Unknown Opening"
        result = game.get("result", "")
        is_win, is_draw, is_loss = determine_game_outcome(target_player_color, result)

        if first_move not in first_move_groups:
            first_move_groups[first_move] = {
                "total_games": 0,
                "responses": {}
            }

        group = first_move_groups[first_move]
        group["total_games"] += 1

        if resp_move not in group["responses"]:
            group["responses"][resp_move] = {
                "resp_move": resp_move,
                "opening_name": opening_name,
                "games_count": 0,
                "wins": 0,
                "draws": 0,
                "losses": 0,
            }

        r_stat = group["responses"][resp_move]
        r_stat["games_count"] += 1
        if is_win:
            r_stat["wins"] += 1
        elif is_draw:
            r_stat["draws"] += 1
        elif is_loss:
            r_stat["losses"] += 1

    move_options = sorted(first_move_groups.keys(), key=lambda k: first_move_groups[k]["total_games"], reverse=True)
    
    selected_first_move = chosen_move if (chosen_move and chosen_move in first_move_groups) else (move_options[0] if move_options else "e4")

    active_group = first_move_groups.get(selected_first_move, {"total_games": 0, "responses": {}})
    total_in_group = active_group.get("total_games", 0)

    responses_list = []
    for resp_move, data in active_group.get("responses", {}).items():
        g_count = data["games_count"]
        w, d, l = data["wins"], data["draws"], data["losses"]
        score_pct = round(((w + 0.5 * d) / g_count) * 100, 1) if g_count > 0 else 0.0
        usage_pct = round((g_count / total_in_group) * 100, 1) if total_in_group > 0 else 0.0

        responses_list.append({
            "response_move": resp_move,
            "games_count": g_count,
            "usage_pct": usage_pct,
            "wins": w,
            "draws": d,
            "losses": l,
            "score_pct": score_pct,
            "win_pct": round((w / g_count) * 100, 1) if g_count > 0 else 0.0,
            "draw_pct": round((d / g_count) * 100, 1) if g_count > 0 else 0.0,
            "loss_pct": round((l / g_count) * 100, 1) if g_count > 0 else 0.0,
            "primary_openings": data.get("opening_name", "")
        })

    responses_list.sort(key=lambda x: x["games_count"], reverse=True)

    return {
        "available_first_moves": move_options,
        "selected_first_move": selected_first_move,
        "total_games_in_move": total_in_group,
        "responses": responses_list
    }
