"""
Game Dynamics & Advantage Conversion Module
-------------------------------------------
Chức năng: Phân tích động lực ván đấu từ góc nhìn đối thủ (Opponent POV):
1. Throw Rate (Tỷ lệ quăng lợi thế): Tỷ lệ không thắng khi đã đạt lợi thế lớn (Eval >= +2.0).
2. Resilience Rate (Khả năng lật kèo): Tỷ lệ hòa/thắng khi bị dẫn sâu (Eval <= -2.0).
3. Volatility Index (Độ biến động thế cờ): Đo lường độ lệch chuẩn và mức độ bùng nổ biến thế cờ.
"""

from typing import List, Dict, Any, Optional
import statistics

from src.analysis.confidence import format_confidence_label


def analyze_game_dynamics(
    filtered_games: List[Dict[str, Any]],
    move_evaluations: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Thống kê Động lực ván đấu (Throw Rate, Resilience Rate, Volatility).
    Mỗi ván đấu được đếm 1 LẦN DUY NHẤT.
    """
    if not move_evaluations:
        return {
            "available": False,
            "throw_rate": 0.0,
            "throw_games": 0,
            "eligible_advantage_games": 0,
            "resilience_rate": 0.0,
            "resilient_games": 0,
            "eligible_deficit_games": 0,
            "volatility": 0.0,
            "volatility_label": "N/A",
            "confidence": format_confidence_label(0)
        }

    # Phân nhóm move evaluations theo từng ván đấu (game_index)
    games_map: Dict[int, List[Dict[str, Any]]] = {}
    for ev in move_evaluations:
        g_idx = ev.get("game_index", 0)
        if g_idx not in games_map:
            games_map[g_idx] = []
        games_map[g_idx].append(ev)

    eligible_advantage = 0
    throw_count = 0

    eligible_deficit = 0
    resilient_count = 0

    all_deltas = []

    for g_idx, ev_list in games_map.items():
        if g_idx >= len(filtered_games):
            continue
        game = filtered_games[g_idx]
        player_color = game.get("player_color", "white").lower()
        result = game.get("result", "*")

        is_win = (player_color == "white" and result == "1-0") or (player_color == "black" and result == "0-1")
        is_loss = (player_color == "white" and result == "0-1") or (player_color == "black" and result == "1-0")
        is_draw = (result == "1/2-1/2")

        max_opp_eval = max([ev.get("eval_after", 0.0) for ev in ev_list], default=0.0)
        min_opp_eval = min([ev.get("eval_after", 0.0) for ev in ev_list], default=0.0)

        # Thu thập các thay đổi điểm số delta để tính độ biến động (Volatility)
        for ev in ev_list:
            all_deltas.append(abs(ev.get("delta_eval", 0.0)))

        # 1. Throw Rate: Đạt lợi thế lớn (>= +2.0 Pawns) nhưng KHÔNG THẮNG
        if max_opp_eval >= 2.0:
            eligible_advantage += 1
            if not is_win:
                throw_count += 1

        # 2. Resilience: Bị dẫn sâu (<= -2.0 Pawns) nhưng KHÔNG THUA (Hòa hoặc Thắng)
        if min_opp_eval <= -2.0:
            eligible_deficit += 1
            if is_win or is_draw:
                resilient_count += 1

    throw_rate = round((throw_count / eligible_advantage) * 100, 1) if eligible_advantage > 0 else 0.0
    resilience_rate = round((resilient_count / eligible_deficit) * 100, 1) if eligible_deficit > 0 else 0.0

    # 3. Volatility (Độ lệch chuẩn điểm số thế cờ)
    volatility = round(statistics.stdev(all_deltas), 2) if len(all_deltas) > 1 else 0.0

    if volatility >= 1.5:
        vol_label = "Cao (Nhiều biến động)"
    elif volatility >= 0.8:
        vol_label = "Trung bình"
    else:
        vol_label = "Thấp (Ổn định)"

    conf = format_confidence_label(len(games_map))

    return {
        "available": True,
        "throw_rate": throw_rate,
        "throw_games": throw_count,
        "eligible_advantage_games": eligible_advantage,
        "resilience_rate": resilience_rate,
        "resilient_games": resilient_count,
        "eligible_deficit_games": eligible_deficit,
        "volatility": volatility,
        "volatility_label": vol_label,
        "confidence": conf
    }
