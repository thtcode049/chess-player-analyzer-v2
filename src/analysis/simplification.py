"""
Simplification & Material Exchange Performance Analysis Module
--------------------------------------------------------------
Chức năng: Phân tích ảnh hưởng của việc Đổi Hậu / Đơn giản hóa lực lượng tới hiệu suất thi đấu của đối thủ.
So sánh kết quả và độ chính xác (ACPL) trước và sau khi đổi Hậu (Queens On vs Queens Off).
"""

from typing import List, Dict, Any, Optional
import chess

from src.analysis.confidence import format_confidence_label


def analyze_simplification_performance(
    filtered_games: List[Dict[str, Any]],
    move_evaluations: Optional[List[Dict[str, Any]]] = None,
    lang: str = "vi"
) -> Dict[str, Any]:
    """
    Phân tích so sánh hiệu suất khi Có Hậu (Queens On) và Đổi Hậu (Queens Off).
    """
    queens_on_stats = {"games": 0, "wins": 0, "draws": 0, "losses": 0, "cpls": []}
    queens_off_stats = {"games": 0, "wins": 0, "draws": 0, "losses": 0, "cpls": []}

    for g_idx, game in enumerate(filtered_games):
        moves = game.get("moves", [])
        player_color = game.get("player_color", "white").lower()
        result = game.get("result", "*")

        is_win = (player_color == "white" and result == "1-0") or (player_color == "black" and result == "0-1")
        is_draw = (result == "1/2-1/2")
        is_loss = (player_color == "white" and result == "0-1") or (player_color == "black" and result == "1-0")

        board = chess.Board()
        queen_traded_ply = None

        for ply, san in enumerate(moves):
            try:
                move_obj = board.parse_san(san)
                board.push(move_obj)
            except Exception:
                break

            # Kiểm tra xem cả 2 bên đã mất Hậu chưa
            w_queens = len(board.pieces(chess.QUEEN, chess.WHITE))
            b_queens = len(board.pieces(chess.QUEEN, chess.BLACK))
            if w_queens == 0 and b_queens == 0 and queen_traded_ply is None:
                queen_traded_ply = ply

        # Phân loại ván đấu
        if queen_traded_ply is not None:
            queens_off_stats["games"] += 1
            if is_win:
                queens_off_stats["wins"] += 1
            elif is_draw:
                queens_off_stats["draws"] += 1
            elif is_loss:
                queens_off_stats["losses"] += 1
        else:
            queens_on_stats["games"] += 1
            if is_win:
                queens_on_stats["wins"] += 1
            elif is_draw:
                queens_on_stats["draws"] += 1
            elif is_loss:
                queens_on_stats["losses"] += 1

    # Thêm dữ liệu CPL nếu có
    if move_evaluations:
        for ev in move_evaluations:
            fen = ev.get("fen_before", "")
            cpl = ev.get("cpl", 0.0)
            if fen:
                b = chess.Board(fen)
                w_q = len(b.pieces(chess.QUEEN, chess.WHITE))
                b_q = len(b.pieces(chess.QUEEN, chess.BLACK))
                if w_q == 0 and b_q == 0:
                    queens_off_stats["cpls"].append(cpl)
                else:
                    queens_on_stats["cpls"].append(cpl)

    def compute_summary(st):
        g = st["games"]
        w, d, l = st["wins"], st["draws"], st["losses"]
        score = round(((w + 0.5 * d) / g) * 100, 1) if g > 0 else 0.0
        cpls = st["cpls"]
        acpl = round(sum(cpls) / len(cpls), 1) if cpls else 0.0
        return {"games_count": g, "wins": w, "draws": d, "losses": l, "score_pct": score, "avg_acpl": acpl}

    on_res = compute_summary(queens_on_stats)
    off_res = compute_summary(queens_off_stats)

    # Đưa ra nhận xét xu hướng
    recommendation = ""
    if off_res["games_count"] >= 3 and on_res["games_count"] >= 3:
        if off_res["score_pct"] < on_res["score_pct"] - 10.0:
            recommendation = "Đối thủ thi đấu kém hơn rõ rệt sau khi Đổi Hậu. Nên chủ động đổi Hậu để đưa về cờ tàn."
        elif on_res["score_pct"] < off_res["score_pct"] - 10.0:
            recommendation = "Đối thủ thi đấu rất tốt khi đã Đổi Hậu. Nên giữ Hậu trên bàn cờ để duy trì áp lực tấn công."

    conf = format_confidence_label(len(filtered_games))

    return {
        "queens_on": on_res,
        "queens_off": off_res,
        "queen_trade_count": off_res["games_count"],
        "queen_trade_winrate": off_res["score_pct"],
        "queen_trade_score": off_res["score_pct"],
        "queens_on_count": on_res["games_count"],
        "queens_on_score": on_res["score_pct"],
        "recommendation": recommendation,
        "confidence": conf
    }
