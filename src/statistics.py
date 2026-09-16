"""
Statistics Module
-----------------
Chức năng: Tính toán số liệu thống kê thắng/thua/hòa, score percentage,
và tỷ lệ hiệu suất thi đấu theo tổng thể cũng như theo màu quân (White/Black).
"""

from typing import List, Dict, Any


from src.utils import determine_game_outcome


def calculate_score_percentage(wins: int, draws: int, total: int) -> float:
    """
    Tính phần trăm điểm số theo công thức chuẩn cờ vua:
    Score % = (Wins + 0.5 * Draws) / Total Games * 100
    """
    if total <= 0:
        return 0.0
    return round(((wins + 0.5 * draws) / total) * 100, 2)


def calculate_rate(count: int, total: int) -> float:
    """Tính tỷ lệ phần trăm (Rate %) của một chỉ số."""
    if total <= 0:
        return 0.0
    return round((count / total) * 100, 2)


def calculate_game_stats(filtered_games: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Tính toán toàn bộ số liệu thống kê cho kỳ thủ dựa trên danh sách ván đấu đã lọc.

    Args:
        filtered_games: Danh sách các ván đấu của kỳ thủ (mỗi ván có trường 'player_color' và 'result').

    Returns:
        Dict chứa tất cả các chỉ số thống kê tổng thể và theo màu quân.
    """
    total_games = len(filtered_games)
    
    if total_games == 0:
        return {
            "total_games": 0,
            "wins": 0,
            "draws": 0,
            "losses": 0,
            "win_rate": 0.0,
            "draw_rate": 0.0,
            "loss_rate": 0.0,
            "score_percentage": 0.0,
            "white_games": 0,
            "white_wins": 0,
            "white_draws": 0,
            "white_losses": 0,
            "white_score_percentage": 0.0,
            "black_games": 0,
            "black_wins": 0,
            "black_draws": 0,
            "black_losses": 0,
            "black_score_percentage": 0.0,
        }

    wins = 0
    draws = 0
    losses = 0

    white_games = 0
    white_wins = 0
    white_draws = 0
    white_losses = 0

    black_games = 0
    black_wins = 0
    black_draws = 0
    black_losses = 0

    for g in filtered_games:
        color = g.get("player_color", "white")
        result = g.get("result", "*")

        is_win, is_draw, is_loss = determine_game_outcome(color, result)

        if is_win:
            wins += 1
        elif is_draw:
            draws += 1
        elif is_loss:
            losses += 1

        # Thống kê theo từng màu quân
        if color == "white":
            white_games += 1
            if is_win:
                white_wins += 1
            elif is_draw:
                white_draws += 1
            elif is_loss:
                white_losses += 1
        elif color == "black":
            black_games += 1
            if is_win:
                black_wins += 1
            elif is_draw:
                black_draws += 1
            elif is_loss:
                black_losses += 1

    return {
        "total_games": total_games,
        "wins": wins,
        "draws": draws,
        "losses": losses,
        "win_rate": calculate_rate(wins, total_games),
        "draw_rate": calculate_rate(draws, total_games),
        "loss_rate": calculate_rate(losses, total_games),
        "score_percentage": calculate_score_percentage(wins, draws, total_games),

        "white_games": white_games,
        "white_wins": white_wins,
        "white_draws": white_draws,
        "white_losses": white_losses,
        "white_score_percentage": calculate_score_percentage(white_wins, white_draws, white_games),

        "black_games": black_games,
        "black_wins": black_wins,
        "black_draws": black_draws,
        "black_losses": black_losses,
        "black_score_percentage": calculate_score_percentage(black_wins, black_draws, black_games),
    }
