"""
Critical Positions Identification & Training Integration Module
----------------------------------------------------------------
Chức năng: Trích xuất và xếp hạng các Thế cờ then chốt (Critical Positions) nơi đối thủ mắc sai lầm lớn (Eval Swing / High CPL).
Cung cấp dữ liệu FEN để nạp thẳng lên Bàn cờ phân tích (Analyze Board) cho người dùng luyện tập.
"""

from typing import List, Dict, Any, Optional


def find_critical_positions(
    move_evaluations: Optional[List[Dict[str, Any]]] = None,
    max_positions: int = 5
) -> List[Dict[str, Any]]:
    """
    Trích xuất danh sách các thế cờ then chốt nơi đối thủ bị sụt giảm điểm số lớn nhất.
    """
    if not move_evaluations:
        return []

    # Lọc các nước đi có CPL >= 80 centipawns hoặc delta_eval sụt giảm mạnh
    candidates = []
    for ev in move_evaluations:
        cpl = ev.get("cpl", 0.0)
        delta = ev.get("delta_eval", 0.0)
        fen_before = ev.get("fen_before", "")
        fen_after = ev.get("fen_after", "")

        if fen_before and (cpl >= 60.0 or delta <= -0.6):
            candidates.append({
                "fen_before": fen_before,
                "fen_after": fen_after,
                "move_number": ev.get("move_number", 1),
                "san": ev.get("move_san", ""),
                "eval_before": ev.get("eval_before", 0.0),
                "eval_after": ev.get("eval_after", 0.0),
                "delta_eval": delta,
                "cpl": round(cpl, 1),
                "best_move_san": ev.get("best_move_san", ""),
                "game_opening": ev.get("game_opening", "Unknown"),
                "site": ev.get("site", "")
            })

    # Sắp xếp theo CPL giảm dần (lỗi nặng nhất xếp đầu)
    candidates.sort(key=lambda x: x["cpl"], reverse=True)

    # Loại bỏ các FEN trùng lặp
    seen_fens = set()
    unique_positions = []
    for c in candidates:
        fen = c["fen_before"]
        if fen not in seen_fens:
            seen_fens.add(fen)
            unique_positions.append(c)
            if len(unique_positions) >= max_positions:
                break

    return unique_positions
