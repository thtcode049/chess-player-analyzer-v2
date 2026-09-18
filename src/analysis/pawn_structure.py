"""
Pawn Structure Detection & Performance Analysis Module
------------------------------------------------------
Chức năng: Nhận diện cấu trúc Tốt (Pawn Structure) bằng luật giải định hình cờ (Deterministic Rules) qua python-chess.
Phân tích hiệu suất của đối thủ khi thi đấu trong từng dạng cấu trúc Tốt.
"""

from typing import List, Dict, Any, Optional
import chess

from src.analysis.confidence import format_confidence_label


def detect_pawn_structure(board: chess.Board) -> Dict[str, Any]:
    """
    Phân tích vị trí các Tốt trên bàn cờ và trả về cấu trúc Tốt được nhận diện.
    """
    pawn_map = {
        "white": [sq for sq in chess.SQUARES if board.piece_at(sq) == chess.Piece(chess.PAWN, chess.WHITE)],
        "black": [sq for sq in chess.SQUARES if board.piece_at(sq) == chess.Piece(chess.PAWN, chess.BLACK)]
    }

    white_files = {chess.square_file(sq) for sq in pawn_map["white"]}
    black_files = {chess.square_file(sq) for sq in pawn_map["black"]}

    w_central = [sq for sq in pawn_map["white"] if chess.square_file(sq) in [3, 4]]  # d, e files (0-indexed: c=2, d=3, e=4)
    b_central = [sq for sq in pawn_map["black"] if chess.square_file(sq) in [3, 4]]

    # 1. IQP (Isolated Queen's Pawn - Tốt d cô lập)
    # Tốt d4 của Trắng cô lập (không có Tốt c và e)
    for sq in pawn_map["white"]:
        if chess.square_file(sq) == 3:  # d-file
            if 2 not in white_files and 4 not in white_files:
                return {"structure": "IQP", "name": "Isolated Queen's Pawn (IQP)", "side": "white", "square": chess.square_name(sq)}

    # Tốt d5 của Đen cô lập (không có Tốt c và e)
    for sq in pawn_map["black"]:
        if chess.square_file(sq) == 3:  # d-file
            if 2 not in black_files and 4 not in black_files:
                return {"structure": "IQP", "name": "Isolated Queen's Pawn (IQP)", "side": "black", "square": chess.square_name(sq)}

    # 2. Open Center (Trung tâm Mở) - Không còn Tốt d và e trên bàn cờ
    if not w_central and not b_central:
        return {"structure": "Open", "name": "Open Center", "side": "both", "square": ""}

    # 3. Semi-Open Center (Trung tâm Nửa mở) - Chỉ còn 1 cột d hoặc e có Tốt
    d_pawns = [sq for sq in pawn_map["white"] + pawn_map["black"] if chess.square_file(sq) == 3]
    e_pawns = [sq for sq in pawn_map["white"] + pawn_map["black"] if chess.square_file(sq) == 4]
    if (not d_pawns and e_pawns) or (d_pawns and not e_pawns):
        return {"structure": "Semi-Open", "name": "Semi-Open Center", "side": "both", "square": ""}

    # 4. Carlsbad-like Structure (Cấu trúc Carlsbad)
    # Trắng tốt d4, c4 | Đen tốt d5, c6, e6
    w_d4 = chess.D4 in pawn_map["white"]
    w_c4 = chess.C4 in pawn_map["white"]
    b_d5 = chess.D5 in pawn_map["black"]
    b_c6 = chess.C6 in pawn_map["black"]
    b_e6 = chess.E6 in pawn_map["black"]
    if w_d4 and w_c4 and b_d5 and (b_c6 or b_e6):
        return {"structure": "Carlsbad", "name": "Carlsbad-like", "side": "white", "square": "d4/c4"}

    # 5. Benoni-like Structure (Cấu trúc Benoni)
    w_d5 = chess.D5 in pawn_map["white"]
    b_c5 = chess.C5 in pawn_map["black"]
    if w_d5 and b_c5:
        return {"structure": "Benoni", "name": "Benoni-like", "side": "white", "square": "d5"}

    # 6. Symmetrical Center (Cấu trúc Trung tâm Đối xứng)
    w_ranks = sorted([chess.square_rank(sq) for sq in w_central])
    b_ranks = sorted([7 - chess.square_rank(sq) for sq in b_central])
    if len(w_central) == len(b_central) and len(w_central) > 0 and w_ranks == b_ranks:
        return {"structure": "Symmetrical", "name": "Symmetrical Center", "side": "both", "square": ""}

    # 7. Closed Center (Trung tâm Khóa) - Tốt d và e bị khóa đối đầu
    is_closed = False
    if (chess.E4 in pawn_map["white"] and chess.E5 in pawn_map["black"]) or \
       (chess.D4 in pawn_map["white"] and chess.D5 in pawn_map["black"]):
        is_closed = True

    if is_closed:
        return {"structure": "Closed", "name": "Closed Center", "side": "both", "square": ""}

    return {"structure": "Standard", "name": "Standard Structure", "side": "both", "square": ""}


from src.analysis.confidence import (
    enrich_performance_item,
    rank_weakest_items,
    ASSESSMENT_CONFIRMED_WEAKNESS,
    ASSESSMENT_POTENTIAL_WEAKNESS,
    DEFAULT_PRIOR_STRENGTH
)


def analyze_structural_performance(
    filtered_games: List[Dict[str, Any]],
    move_evaluations: Optional[List[Dict[str, Any]]] = None,
    baseline_score: Optional[float] = None,
    prior_strength: float = DEFAULT_PRIOR_STRENGTH,
    lang: str = "vi"
) -> Dict[str, Any]:
    """
    Phân tích hiệu suất thi đấu của đối thủ theo từng dạng Cấu trúc Tốt.
    Mỗi ván đấu được đếm 1 LẦN DUY NHẤT cho mỗi cấu trúc mà ván đó đi qua trong nước 8 -> 15.
    Tích hợp Bayesian Shrinkage & Statistical Confidence Framework.
    """
    struct_stats: Dict[str, Dict[str, Any]] = {}
    total_games = len(filtered_games)
    total_wins = 0
    total_draws = 0

    for g_idx, game in enumerate(filtered_games):
        moves = game.get("moves", [])
        player_color = game.get("player_color", "white")
        result = game.get("result", "*")

        is_win = (player_color == "white" and result == "1-0") or (player_color == "black" and result == "0-1")
        is_draw = (result == "1/2-1/2")
        is_loss = (player_color == "white" and result == "0-1") or (player_color == "black" and result == "1-0")

        if is_win:
            total_wins += 1
        elif is_draw:
            total_draws += 1

        board = chess.Board()
        seen_in_game = set()

        for ply, san in enumerate(moves):
            try:
                move_obj = board.parse_san(san)
                board.push(move_obj)
            except Exception:
                break

            move_number = (ply // 2) + 1

            # Chỉ xét cấu trúc Tốt xuất hiện trong khoảng nước 8 đến nước 15 (ply 14 -> 29)
            if 14 <= ply <= 29:
                struct_res = detect_pawn_structure(board)
                st_name = struct_res["name"]
                if st_name != "Standard Structure" and st_name not in seen_in_game:
                    seen_in_game.add(st_name)

                    if st_name not in struct_stats:
                        struct_stats[st_name] = {
                            "name": st_name,
                            "structure_key": struct_res["structure"],
                            "games_count": 0,
                            "wins": 0,
                            "draws": 0,
                            "losses": 0,
                            "cpls": [],
                            "formation_moves": [],
                            "games": []
                        }

                    stat = struct_stats[st_name]
                    stat["games_count"] += 1
                    stat["formation_moves"].append(move_number)
                    if is_win:
                        stat["wins"] += 1
                    elif is_draw:
                        stat["draws"] += 1
                    elif is_loss:
                        stat["losses"] += 1

                    stat["games"].append({
                        "id": game.get("id"),
                        "game_index": g_idx,
                        "formation_move": move_number,
                        "white": game.get("white", "Unknown"),
                        "black": game.get("black", "Unknown"),
                        "result": result,
                        "opening": game.get("opening", "Unknown Opening"),
                        "date": game.get("date", ""),
                        "site": game.get("site", ""),
                        "player_color": player_color,
                        "is_win": is_win,
                        "is_draw": is_draw,
                        "is_loss": is_loss,
                        "game_accuracy": game.get("game_accuracy")
                    })

    # Tính Overall Player Baseline Score (mặc định 50% nếu chưa có dữ liệu)
    if baseline_score is None:
        effective_baseline = round(((total_wins + 0.5 * total_draws) / total_games) * 100, 1) if total_games > 0 else 50.0
    else:
        effective_baseline = round(float(baseline_score), 1)

    # Kết hợp CPL từ move_evaluations nếu có
    if move_evaluations:
        for ev in move_evaluations:
            fen = ev.get("fen_before", "")
            cpl = ev.get("cpl", 0.0)
            if fen:
                b = chess.Board(fen)
                st_res = detect_pawn_structure(b)
                st_name = st_res["name"]
                if st_name in struct_stats:
                    struct_stats[st_name]["cpls"].append(cpl)

    result_list = []
    for name, data in struct_stats.items():
        g_count = data["games_count"]
        w, d, l = data["wins"], data["draws"], data["losses"]
        score_pct = round(((w + 0.5 * d) / g_count) * 100, 1) if g_count > 0 else 0.0
        cpls = data["cpls"]
        avg_acpl = round(sum(cpls) / len(cpls), 1) if cpls else 0.0
        conf = format_confidence_label(g_count, lang=lang)

        formation_moves = data["formation_moves"]
        typical_move = round(sum(formation_moves) / len(formation_moves)) if formation_moves else 12

        struct_item = {
            "name": name,
            "structure_key": data["structure_key"],
            "games_count": g_count,
            "wins": w,
            "draws": d,
            "losses": l,
            "score_pct": score_pct,
            "avg_acpl": avg_acpl,
            "confidence": conf,
            "typical_formation_move": typical_move,
            "games": data["games"]
        }
        # Bổ sung Bayesian Shrinkage & Assessment
        enriched_struct = enrich_performance_item(struct_item, effective_baseline, prior_strength=prior_strength, lang=lang)
        result_list.append(enriched_struct)

    result_list.sort(key=lambda x: x["games_count"], reverse=True)

    # Xác định Cấu trúc điểm yếu nhất (Target Structure) bằng Bayesian Framework
    # Ưu tiên: CONFIRMED_WEAKNESS -> POTENTIAL_WEAKNESS -> Lowest Adjusted Score
    target_structure = None
    if result_list:
        ranked_weakest = rank_weakest_items(result_list)
        if ranked_weakest:
            candidate = ranked_weakest[0]
            # Chỉ chọn target structure nếu có dấu hiệu yếu thế hơn baseline hoặc điểm yếu được xác nhận
            if candidate.get("assessment") in [ASSESSMENT_CONFIRMED_WEAKNESS, ASSESSMENT_POTENTIAL_WEAKNESS] or candidate.get("delta_vs_baseline", 0.0) <= -5.0:
                target_structure = candidate
            elif candidate.get("games_count", 0) >= 1:
                target_structure = candidate

    return {
        "structures": result_list,
        "target_structure": target_structure,
        "overall_baseline": effective_baseline
    }
