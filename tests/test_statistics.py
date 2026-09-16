from src.statistics import calculate_game_stats, calculate_score_percentage, calculate_rate


def test_calculate_score_percentage():
    assert calculate_score_percentage(2, 1, 4) == 62.5
    assert calculate_score_percentage(1, 0, 1) == 100.0
    assert calculate_score_percentage(0, 0, 0) == 0.0


def test_calculate_rate():
    assert calculate_rate(1, 2) == 50.0
    assert calculate_rate(0, 5) == 0.0


def test_calculate_game_stats_empty():
    stats = calculate_game_stats([])
    assert stats["total_games"] == 0
    assert stats["score_percentage"] == 0.0
    assert stats["win_rate"] == 0.0


def test_calculate_game_stats_mixed():
    # Giả lập 4 ván đấu:
    # Ván 1: Cầm Trắng, kết quả 1-0 -> Win
    # Ván 2: Cầm Trắng, kết quả 1/2-1/2 -> Draw
    # Ván 3: Cầm Đen, kết quả 0-1 -> Win
    # Ván 4: Cầm Đen, kết quả 1-0 -> Loss
    games = [
        {"player_color": "white", "result": "1-0"},
        {"player_color": "white", "result": "1/2-1/2"},
        {"player_color": "black", "result": "0-1"},
        {"player_color": "black", "result": "1-0"},
    ]

    stats = calculate_game_stats(games)

    assert stats["total_games"] == 4
    assert stats["wins"] == 2
    assert stats["draws"] == 1
    assert stats["losses"] == 1

    # Score = (2 + 0.5 * 1) / 4 * 100 = 62.5%
    assert stats["score_percentage"] == 62.5
    assert stats["win_rate"] == 50.0
    assert stats["draw_rate"] == 25.0
    assert stats["loss_rate"] == 25.0

    # Trắng: 2 ván (1 Win, 1 Draw) -> Score = (1 + 0.5) / 2 * 100 = 75.0%
    assert stats["white_games"] == 2
    assert stats["white_wins"] == 1
    assert stats["white_draws"] == 1
    assert stats["white_score_percentage"] == 75.0

    # Đen: 2 ván (1 Win, 1 Loss) -> Score = (1 + 0) / 2 * 100 = 50.0%
    assert stats["black_games"] == 2
    assert stats["black_wins"] == 1
    assert stats["black_losses"] == 1
    assert stats["black_score_percentage"] == 50.0
