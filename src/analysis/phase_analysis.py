"""
Game Phase Classification & Performance Analysis Module
-------------------------------------------------------
Chức năng: Phân loại giai đoạn ván đấu (Opening, Middlegame, Endgame) và đo lường độ chính xác (ACPL) từng giai đoạn.
"""

import math
from typing import List, Dict, Any, Optional
import chess

from src.analysis.confidence import format_confidence_label


def calculate_phase_accuracy(avg_acpl: Optional[float]) -> Optional[float]:
    """
    Tính tỷ lệ chính xác Accuracy % từng giai đoạn từ Centipawn Loss trung bình (ACPL).
    Công thức: accuracy = 100.0 * exp(-0.005 * avg_acpl)
    """
    if avg_acpl is None:
        return None
    try:
        val = float(avg_acpl)
        if val <= 0.0:
            return 100.0
        acc = 100.0 * math.exp(-0.005 * val)
        return round(max(0.0, min(100.0, acc)), 1)
    except (ValueError, TypeError, OverflowError):
        return None


def count_material_non_pawns(board: chess.Board, color: chess.Color) -> int:
    """Tính tổng điểm lực lượng quân nhẹ và quân nặng của một bên (không tính Tốt và Vua)."""
    return (
        len(board.pieces(chess.QUEEN, color)) * 9 +
        len(board.pieces(chess.ROOK, color)) * 5 +
        len(board.pieces(chess.BISHOP, color)) * 3 +
        len(board.pieces(chess.KNIGHT, color)) * 3
    )


def minor_pieces_developed(board: chess.Board, color: chess.Color) -> bool:
    """
    Kiểm tra xem toàn bộ Mã và Tượng của một bên đã rời khỏi hàng ngang cuối chưa
    sử dụng mặt nạ Bitboard để đạt tốc độ xử lý tối đa.
    """
    back_rank = chess.BB_RANK_1 if color == chess.WHITE else chess.BB_RANK_8
    knights = board.pieces_mask(chess.KNIGHT, color)
    bishops = board.pieces_mask(chess.BISHOP, color)
    return (knights & back_rank) == 0 and (bishops & back_rank) == 0


def classify_phase(board: chess.Board, move_number: int) -> str:
    """
    Phân loại giai đoạn ván đấu theo tiêu chuẩn Lực lượng & Thế cờ động (Bitboard Dynamic Phase Detection):
    1. Endgame: Kích hoạt khi lực lượng mỗi bên <= 13 điểm (ví dụ: Hậu + Mã hoặc Xe + Tượng + Mã),
       hoặc cả 2 bên không còn Hậu và tổng điểm lực lượng <= 22.
    2. Opening: Khi có ít nhất một bên CHƯA phát triển xong quân nhẹ (Mã, Tượng) VÀ move_number <= 15.
    3. Middlegame: Giai đoạn còn lại khi đã phát triển xong quân nhẹ hoặc sau nước 15 mà chưa vào Endgame.
    """
    white_mat = count_material_non_pawns(board, chess.WHITE)
    black_mat = count_material_non_pawns(board, chess.BLACK)

    white_has_queen = len(board.pieces(chess.QUEEN, chess.WHITE)) > 0
    black_has_queen = len(board.pieces(chess.QUEEN, chess.BLACK)) > 0

    # 1. Kiểm tra Tàn cuộc động
    if (white_mat <= 13 and black_mat <= 13) or (not white_has_queen and not black_has_queen and (white_mat + black_mat) <= 22):
        return "endgame"

    # 2. Kiểm tra Khai cuộc động dựa trên phát triển quân nhẹ
    is_developing = not minor_pieces_developed(board, chess.WHITE) or not minor_pieces_developed(board, chess.BLACK)
    if is_developing and move_number <= 15:
        return "opening"

    # 3. Mặc định là Trung cuộc
    return "middlegame"


def analyze_phase_performance(
    filtered_games: List[Dict[str, Any]],
    move_evaluations: Optional[List[Dict[str, Any]]] = None,
    lang: str = "vi"
) -> Dict[str, Any]:
    phases_data = {
        "opening": {"moves_count": 0, "cpls": [], "mistakes": 0, "games": set()},
        "middlegame": {"moves_count": 0, "cpls": [], "mistakes": 0, "games": set()},
        "endgame": {"moves_count": 0, "cpls": [], "mistakes": 0, "games": set()}
    }

    if move_evaluations:
        for ev in move_evaluations:
            fen = ev.get("fen_before", "")
            move_num = ev.get("move_number", 1)
            cpl = ev.get("cpl", 0.0)
            g_idx = ev.get("game_index", 0)

            board = chess.Board(fen) if fen else chess.Board()
            phase = classify_phase(board, move_num)

            phases_data[phase]["moves_count"] += 1
            phases_data[phase]["cpls"].append(cpl)
            phases_data[phase]["games"].add(g_idx)
            if cpl >= 100.0:
                phases_data[phase]["mistakes"] += 1
    else:
        # Fallback: Phân loại giai đoạn và đếm số nước từ danh sách ván đấu
        for g_idx, game in enumerate(filtered_games or []):
            moves = game.get("moves", [])
            if not moves:
                continue
            board = chess.Board()
            for ply, san in enumerate(moves):
                try:
                    move_num = (ply // 2) + 1
                    phase = classify_phase(board, move_num)
                    phases_data[phase]["moves_count"] += 1
                    phases_data[phase]["games"].add(g_idx)
                    move_obj = board.parse_san(san)
                    board.push(move_obj)
                except Exception:
                    break

    summary = {}
    for phase_name in ["opening", "middlegame", "endgame"]:
        data = phases_data[phase_name]
        cpls = data["cpls"]
        avg_acpl = round(sum(cpls) / len(cpls), 1) if cpls else 0.0
        accuracy_pct = calculate_phase_accuracy(avg_acpl) if cpls else None

        sorted_cpls = sorted(cpls)
        n = len(sorted_cpls)
        median_acpl = round(sorted_cpls[n // 2], 1) if n > 0 else 0.0

        sample_games = len(data["games"])
        conf = format_confidence_label(sample_games, lang=lang)

        summary[phase_name] = {
            "phase": phase_name,
            "games_count": sample_games,
            "moves_count": data["moves_count"],
            "analyzed_moves": data["moves_count"],
            "avg_acpl": avg_acpl if cpls else 0.0,
            "avg_cpl": avg_acpl if cpls else 0.0,
            "median_acpl": median_acpl,
            "mistakes_count": data["mistakes"],
            "accuracy": accuracy_pct,
            "accuracy_pct": accuracy_pct,
            "confidence": conf
        }

    valid_phases = [p for p in summary.values() if p["moves_count"] >= 5]
    weakest_phase = max(valid_phases, key=lambda x: x["avg_acpl"]) if valid_phases else summary["middlegame"]
    best_phase = min(valid_phases, key=lambda x: x["avg_acpl"]) if valid_phases else summary["opening"]

    return {
        "phases": summary,
        "weakest_phase": weakest_phase,
        "best_phase": best_phase
    }
