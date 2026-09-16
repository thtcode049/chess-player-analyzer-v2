"""
Playing Style Metrics Module (Factual & Explainable Metrics)
------------------------------------------------------------
Chức năng: Đo lường trực tiếp các hành vi và đặc trưng cờ vua thực nghiệm từ dữ liệu ván đấu PGN,
python-chess board state và Stockfish evaluations.

Nguyên tắc:
1. Deterministic & Explainable: Mọi metric đều tính toán dựa trên số liệu cụ thể.
2. Factual & Reliable: Loại bỏ các chỉ số suy đoán/phức tạp không đáng tin.
3. Cache-friendly: Tái sử dụng dữ liệu move evaluations có sẵn mà không gọi lại Stockfish.
"""

from typing import List, Dict, Any, Optional
import statistics
import chess

from src.analysis.pawn_structure import detect_pawn_structure
from src.analysis.phase_analysis import classify_phase


PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9
}


def clamp_normalize(val: float, min_val: float, max_val: float) -> float:
    """Chuẩn hóa một giá trị thực về thang điểm 0 - 100 (có kẹp biên)."""
    if max_val <= min_val:
        return 50.0
    normalized = ((val - min_val) / (max_val - min_val)) * 100.0
    return round(max(0.0, min(100.0, normalized)), 1)


def get_side_material(board: chess.Board, color: chess.Color) -> int:
    """Tính tổng điểm vật chất của một bên (không tính Vua)."""
    return sum(len(board.pieces(pt, color)) * val for pt, val in PIECE_VALUES.items())



def compute_volatility_score(move_evaluations: Optional[List[Dict[str, Any]]] = None) -> float:
    """
    METRIC 2: EVALUATION VOLATILITY (0-100)
    Đo lường độ biến động điểm số thế cờ từ Stockfish evaluation (abs(delta_eval)).
    """
    if not move_evaluations:
        return 50.0

    all_deltas = [abs(ev.get("delta_eval", 0.0)) for ev in move_evaluations if "delta_eval" in ev]
    if len(all_deltas) < 2:
        return 50.0

    try:
        stdev_val = statistics.stdev(all_deltas)
        return clamp_normalize(stdev_val, min_val=0.3, max_val=2.2)
    except Exception:
        return 50.0


def compute_open_closed_preference(filtered_games: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    METRIC 3: OPEN / CLOSED PREFERENCE (0-100)
    Thống kê tỷ lệ các cấu trúc ván đấu thuộc Open, Semi-Open, Closed.
    """
    if not filtered_games:
        return {
            "open_preference": 33.3,
            "semi_open_preference": 33.3,
            "closed_preference": 33.4,
            "dominant_structure": "Cờ kín",
            "dominant_structure_pct": 33.4
        }

    open_cnt = 0
    semi_open_cnt = 0
    closed_cnt = 0
    total = len(filtered_games)

    for game in filtered_games:
        moves = game.get("moves", [])
        board = chess.Board()
        detected_struct = "Standard"

        for ply, san in enumerate(moves):
            try:
                board.push_san(san)
            except Exception:
                break
            if 14 <= ply <= 28:
                struct_res = detect_pawn_structure(board)
                st_key = struct_res.get("structure", "Standard")
                if st_key in ["Open", "Semi-Open", "Closed", "Carlsbad", "Benoni", "IQP"]:
                    detected_struct = st_key
                    break

        if detected_struct == "Open":
            open_cnt += 1
        elif detected_struct in ["Closed", "Carlsbad", "Benoni"]:
            closed_cnt += 1
        else:
            semi_open_cnt += 1

    open_pct = round((open_cnt / total) * 100.0, 1)
    semi_pct = round((semi_open_cnt / total) * 100.0, 1)
    closed_pct = round((closed_cnt / total) * 100.0, 1)

    candidates = [
        ("Cờ kín", closed_pct),
        ("Cờ nửa mở", semi_pct),
        ("Cờ mở", open_pct),
    ]
    dom_name, dom_pct = max(candidates, key=lambda x: x[1])

    return {
        "open_preference": open_pct,
        "semi_open_preference": semi_pct,
        "closed_preference": closed_pct,
        "dominant_structure": dom_name,
        "dominant_structure_pct": dom_pct
    }


def compute_resilience_rate(
    filtered_games: List[Dict[str, Any]],
    move_evaluations: Optional[List[Dict[str, Any]]] = None
) -> float:
    """
    METRIC 4: RESILIENCE RATE (0-100)
    Tỷ lệ cứu hòa hoặc thắng khi từng bị dẫn sâu (eval <= -1.5).
    """
    if not move_evaluations or not filtered_games:
        return 50.0

    games_map: Dict[int, List[Dict[str, Any]]] = {}
    for ev in move_evaluations:
        g_idx = ev.get("game_index", 0)
        games_map.setdefault(g_idx, []).append(ev)

    eligible_games = 0
    resilient_games = 0

    for g_idx, ev_list in games_map.items():
        if g_idx >= len(filtered_games):
            continue
        game = filtered_games[g_idx]
        player_color = game.get("player_color", "white").lower()
        result = game.get("result", "*")

        is_win = (player_color == "white" and result == "1-0") or (player_color == "black" and result == "0-1")
        is_draw = (result == "1/2-1/2")

        min_opp_eval = min([ev.get("eval_after", 0.0) for ev in ev_list], default=0.0)

        if min_opp_eval <= -1.5:
            eligible_games += 1
            if is_win or is_draw:
                resilient_games += 1

    if eligible_games == 0:
        return 50.0

    return round((resilient_games / eligible_games) * 100.0, 1)


def compute_sacrifice_rate(
    filtered_games: List[Dict[str, Any]],
    move_evaluations: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    METRIC 5: SACRIFICE RATE (0-100)
    Tự động nhận diện đòn Thí quân (Sacrifice) và phân biệt với Treo quân / Lỗi ngớ ngẩn (Blunder).
    
    Thuật toán:
    1. Đo lường trước nước đi: Tính chênh lệch vật chất net_material_before = Player_mat - Opp_mat.
    2. Đo lường sau chuỗi trao đổi (Quiescence / Exchange Resolution):
       Lần theo chuỗi nước đi tiếp theo trong ván đấu cho tới khi chuỗi bắt quân liên tiếp kết thúc.
       Tính net_material_after = Player_mat - Opp_mat.
    3. delta_material = net_material_after - net_material_before.
    4. delta_eval = eval_after - eval_before (từ góc nhìn kỳ thủ).
    5. Phân loại:
       - Nếu delta_material < 0 và delta_eval <= -1.5 (hoặc cpl >= 150) -> Blunder (Lỗi ngớ ngẩn).
       - Nếu delta_material < 0 và delta_eval >= -0.5 (hoặc cpl <= 50) -> Sacrifice (Thí quân có chủ đích).
    
    Tính tỷ lệ phần trăm số ván có ít nhất 1 nước thí quân hợp lệ.
    """
    if not filtered_games:
        return {
            "sacrifice_rate": 0.0,
            "sacrifice_games_count": 0,
            "total_sacrifices": 0,
            "total_blunders": 0,
            "analyzed_games_count": 0
        }

    # Index move evaluations theo (game_index, ply)
    eval_by_game_ply: Dict[tuple, Dict[str, Any]] = {}
    if move_evaluations:
        for ev in move_evaluations:
            g_idx = ev.get("game_index", 0)
            ply = ev.get("ply", 0)
            eval_by_game_ply[(g_idx, ply)] = ev

    games_with_sacrifice = 0
    total_sacrifices = 0
    total_blunders = 0
    analyzed_games = 0

    for g_idx, game in enumerate(filtered_games):
        moves = game.get("moves", [])
        if not moves:
            continue

        player_color_str = game.get("player_color", "white").lower()
        player_color = chess.WHITE if player_color_str == "white" else chess.BLACK

        has_eval_for_game = any((g_idx, ply) in eval_by_game_ply for ply in range(len(moves)))
        if move_evaluations and not has_eval_for_game:
            continue

        analyzed_games += 1
        game_has_sacrifice = False
        board = chess.Board()

        for ply, san in enumerate(moves):
            is_player_turn = (ply % 2 == 0 and player_color == chess.WHITE) or (ply % 2 == 1 and player_color == chess.BLACK)
            move_num = (ply // 2) + 1
            
            # Tính vật chất trước nước đi của kỳ thủ
            opp_color = not player_color
            mat_player_before = get_side_material(board, player_color)
            mat_opp_before = get_side_material(board, opp_color)
            net_before = mat_player_before - mat_opp_before

            try:
                move_obj = board.parse_san(san)
            except Exception:
                break

            if is_player_turn and ply >= 6:  # Bỏ qua vài nước khai cuộc đầu tiên
                ev_data = eval_by_game_ply.get((g_idx, ply))
                
                # BỘ LỌC 1: Thế cờ cạnh tranh (Competitive Position Filter)
                # Bắt buộc Eval trước nước đi phải nằm trong khoảng [-1.5, +2.5]
                # Tránh bẫy cờ đã thua sâu (<= -1.5) hoặc cờ thắng áp đảo (>= +2.5)
                eval_before = ev_data.get("eval_before", 0.0) if ev_data else 0.0
                is_competitive = (-1.5 <= eval_before <= 2.5)

                if is_competitive:
                    # BỘ LỌC 2: Mô phỏng chuỗi ăn quân và chiếu liên tiếp cho đến khi bàn cờ tĩnh (Quiescent State)
                    sim_board = board.copy()
                    sim_board.push(move_obj)

                    next_ply = ply + 1
                    while next_ply < len(moves) and next_ply <= ply + 6:
                        next_san = moves[next_ply]
                        try:
                            next_mv = sim_board.parse_san(next_san)
                            is_forcing = sim_board.is_capture(next_mv) or "x" in next_san or sim_board.gives_check(next_mv) or "+" in next_san
                            if is_forcing:
                                sim_board.push(next_mv)
                                next_ply += 1
                            else:
                                # Chuỗi đòn ăn quân kết thúc, bàn cờ đạt trạng thái tĩnh
                                break
                        except Exception:
                            break

                    mat_player_after = get_side_material(sim_board, player_color)
                    mat_opp_after = get_side_material(sim_board, opp_color)
                    net_after = mat_player_after - mat_opp_after
                    delta_material = net_after - net_before

                    # BỘ LỌC 3: Phân loại đòn Thí quân thực sự vs Treo quân (Blunder)
                    # - Thí quân nhẹ / Quân nặng: delta_material <= -2 (Tượng/Mã lấy Tốt, Xe lấy Tượng/Mã, Hậu)
                    # - Thí Tốt / Gambit: delta_material == -1 (Chỉ xét trong Khai & Trung cuộc move <= 25 và Eval giữ tốt)
                    is_piece_sacrifice = (delta_material <= -2)
                    is_pawn_gambit = (delta_material == -1 and move_num <= 25 and (ev_data.get("eval_after", 0.0) >= -0.25 if ev_data else True))

                    if is_piece_sacrifice or is_pawn_gambit:
                        if ev_data:
                            delta_eval = ev_data.get("delta_eval", 0.0)
                            cpl = ev_data.get("cpl", 0.0)

                            # 1. Blunder: mất chất và eval giảm sâu (delta_eval <= -1.5 hoặc CPL >= 150)
                            if delta_eval <= -1.5 or cpl >= 150.0:
                                total_blunders += 1
                            # 2. Sacrifice: mất chất nhưng eval duy trì hoặc nước đi chuẩn (CPL <= 35 hoặc delta_eval >= -0.35)
                            elif cpl <= 35.0 or delta_eval >= -0.35:
                                total_sacrifices += 1
                                game_has_sacrifice = True
                        else:
                            result = game.get("result", "*")
                            is_win = (player_color_str == "white" and result == "1-0") or (player_color_str == "black" and result == "0-1")
                            if is_win and is_piece_sacrifice:
                                total_sacrifices += 1
                                game_has_sacrifice = True

            board.push(move_obj)

        if game_has_sacrifice:
            games_with_sacrifice += 1

    total_valid = analyzed_games if analyzed_games > 0 else len(filtered_games)
    sac_rate = (games_with_sacrifice / total_valid) * 100.0 if total_valid > 0 else 0.0

    return {
        "sacrifice_rate": round(sac_rate, 1),
        "sacrifice_games_count": games_with_sacrifice,
        "total_sacrifices": total_sacrifices,
        "total_blunders": total_blunders,
        "analyzed_games_count": total_valid
    }


def compute_simplification_metrics(
    filtered_games: List[Dict[str, Any]],
    move_evaluations: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    METRIC 6: SIMPLIFICATION & ENDGAME TRANSITION (0-100)
    
    Quy tắc xác nhận Simplifier:
    Được xác nhận là Simplifier (is_simplifier = True) KHI VÀ CHỈ KHI:
    1. Thời điểm vào tàn cuộc trung bình <= Nước 30.
    2. VÀ thế cờ ngay khi vào tàn cuộc Eval của Stockfish dao động không quá lớn (từ -1.5 đến +1.5).
    
    Tái sử dụng hàm chuẩn classify_phase để xác định chính xác thời điểm ván cờ chuyển sang Endgame.
    """
    if not filtered_games:
        return {
            "simplification_rate": 0.0,
            "is_simplifier": False,
            "avg_endgame_move": 0.0,
            "balanced_early_endgame_games": 0,
            "total_endgame_games": 0
        }

    # Index move evaluations theo (game_index, move_number)
    eval_by_game_move: Dict[tuple, float] = {}
    if move_evaluations:
        for ev in move_evaluations:
            g_idx = ev.get("game_index", 0)
            m_num = ev.get("move_number", 1)
            eval_by_game_move[(g_idx, m_num)] = ev.get("eval_after", 0.0)

    endgame_entry_moves: List[int] = []
    endgame_entry_evals: List[float] = []
    balanced_early_endgame_cnt = 0

    for g_idx, game in enumerate(filtered_games):
        moves = game.get("moves", [])
        if not moves:
            continue

        board = chess.Board()
        first_endgame_move: Optional[int] = None
        eval_at_entry: float = 0.0

        for ply, san in enumerate(moves):
            try:
                board.push_san(san)
            except Exception:
                break

            move_num = (ply // 2) + 1
            phase = classify_phase(board, move_num)

            if phase == "endgame" and first_endgame_move is None:
                first_endgame_move = move_num
                # Lấy eval tại thời điểm vào tàn cuộc
                eval_at_entry = eval_by_game_move.get((g_idx, move_num), 0.0)
                break

        if first_endgame_move is not None:
            endgame_entry_moves.append(first_endgame_move)
            endgame_entry_evals.append(eval_at_entry)

            # Điều kiện ván đấu: Chuyển tàn <= Nước 30 VÀ Eval cân bằng [-1.5, +1.5]
            if first_endgame_move <= 30 and (-1.5 <= eval_at_entry <= 1.5):
                balanced_early_endgame_cnt += 1

    total_games = len(filtered_games)
    avg_endgame_move = round(sum(endgame_entry_moves) / len(endgame_entry_moves), 1) if endgame_entry_moves else 0.0
    avg_endgame_eval = round(sum(endgame_entry_evals) / len(endgame_entry_evals), 2) if endgame_entry_evals else 0.0

    # Tỷ lệ % số ván chuyển tàn sớm trong thế cân bằng
    simplification_rate = round((balanced_early_endgame_cnt / total_games) * 100.0, 1) if total_games > 0 else 0.0

    # Xác nhận là Simplifier:
    # Kỳ thủ phải có tỷ lệ ván chuyển tàn sớm trong thế cân bằng đáng kể (>= 35.0%)
    # VÀ thời điểm vào tàn cuộc trung bình <= 30
    # VÀ Eval tại thời điểm vào tàn cuộc dao động trong khoảng cân bằng [-1.5, +1.5]
    is_simplifier = bool(
        len(endgame_entry_moves) >= 1 and
        simplification_rate >= 35.0 and
        avg_endgame_move > 0 and
        avg_endgame_move <= 30.0 and
        (-1.5 <= avg_endgame_eval <= 1.5)
    )

    return {
        "simplification_rate": simplification_rate,
        "is_simplifier": is_simplifier,
        "avg_endgame_move": avg_endgame_move,
        "avg_endgame_eval": avg_endgame_eval,
        "balanced_early_endgame_games": balanced_early_endgame_cnt,
        "total_endgame_games": len(endgame_entry_moves)
    }


def extract_all_style_metrics(
    filtered_games: List[Dict[str, Any]],
    stats: Optional[Dict[str, Any]] = None,
    move_evaluations: Optional[List[Dict[str, Any]]] = None,
    phases_data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Tập hợp và trích xuất toàn bộ các chỉ số phong cách đáng tin cậy.
    """
    volatility = compute_volatility_score(move_evaluations)
    pref_info = compute_open_closed_preference(filtered_games)
    resilience = compute_resilience_rate(filtered_games, move_evaluations)
    sacrifice_info = compute_sacrifice_rate(filtered_games, move_evaluations)
    simplification_info = compute_simplification_metrics(filtered_games, move_evaluations)

    return {
        "volatility_score": volatility,
        "sacrifice_rate": sacrifice_info["sacrifice_rate"],
        "sacrifice_games_count": sacrifice_info["sacrifice_games_count"],
        "total_sacrifices": sacrifice_info["total_sacrifices"],
        "total_blunders": sacrifice_info["total_blunders"],
        "simplification_rate": simplification_info["simplification_rate"],
        "is_simplifier": simplification_info["is_simplifier"],
        "avg_endgame_move": simplification_info["avg_endgame_move"],
        "open_preference": pref_info["open_preference"],
        "semi_open_preference": pref_info["semi_open_preference"],
        "closed_preference": pref_info["closed_preference"],
        "dominant_structure": pref_info["dominant_structure"],
        "dominant_structure_pct": pref_info["dominant_structure_pct"],
        "resilience_rate": resilience,
        "has_engine_data": bool(move_evaluations and len(move_evaluations) > 0)
    }
