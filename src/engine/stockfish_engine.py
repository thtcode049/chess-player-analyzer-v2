"""
Stockfish Engine Wrapper Module
--------------------------------
Chức năng: Lớp bọc (Wrapper) an toàn cho Stockfish UCI Engine qua python-chess.
- Tự động phát hiện và khởi tạo engine.
- Chuẩn hóa điểm số theo góc nhìn đối thủ (Opponent POV).
- Xử lý điểm chiếu hết (Mate Score) an toàn.
- Quản lý tài nguyên và giải phóng subprocess cleanly.
"""

from typing import Dict, Any, Optional
import chess
import chess.engine

from src.engine.engine_config import (
    ENGINE_DEPTH,
    ENGINE_TIMEOUT_SEC,
    find_stockfish_executable,
)


def normalize_score(score_obj: Any, max_cp: int = 1000) -> Dict[str, Any]:
    """
    Chuyển đổi chess.engine.Score từ White POV thành giá trị centipawn (cp) an toàn và cờ mate.
    """
    is_mate_flag = score_obj.is_mate()

    if is_mate_flag:
        mate_obj = score_obj.relative if hasattr(score_obj, "relative") and hasattr(score_obj.relative, "mate") else score_obj
        mate_in = mate_obj.mate()
        if mate_in is None:
            mate_in = 1
        cp_val = max_cp if mate_in > 0 else -max_cp
        return {"cp": float(cp_val), "is_mate": True, "mate_in": mate_in}
    else:
        score_eval_obj = score_obj.relative if hasattr(score_obj, "relative") and hasattr(score_obj.relative, "score") else score_obj
        cp_val = score_eval_obj.score(mate_score=max_cp)
        return {"cp": float(cp_val) if cp_val is not None else 0.0, "is_mate": False, "mate_in": None}


class StockfishEngine:
    """Stockfish Engine Wrapper sử dụng python-chess SimpleEngine API."""

    def __init__(self, path: Optional[str] = None, depth: int = ENGINE_DEPTH):
        self.depth = depth
        self._user_explicit_path = (path is not None)
        self.path = path or find_stockfish_executable()
        self._engine: Optional[chess.engine.SimpleEngine] = None
        self._is_ready = False
        self._init_engine()

    def _init_engine(self):
        if not self.path:
            self._is_ready = False
            return
        try:
            self._engine = chess.engine.SimpleEngine.popen_uci(self.path)
            self._is_ready = True
        except Exception:
            self._engine = None
            self._is_ready = False

    def is_available(self) -> bool:
        """Kiểm tra Stockfish engine có sẵn sàng hoạt động hay không."""
        if not self._is_ready or self._engine is None:
            if not self._user_explicit_path:
                new_path = find_stockfish_executable()
                if new_path:
                    self.path = new_path
                    self._init_engine()
        return self._is_ready and self._engine is not None

    def evaluate_position(
        self,
        fen: str,
        depth: Optional[int] = None,
        opponent_color: str = "white"
    ) -> Dict[str, Any]:
        """
        Đánh giá thế cờ từ vị trí FEN.

        Returns:
            Dict chứa điểm White POV, Opponent POV, best move, và mate info.
        """
        if not self.is_available() or not self._engine:
            return {
                "available": False,
                "fen": fen,
                "white_eval": 0.0,
                "opponent_eval": 0.0,
                "best_move_san": "",
                "best_move_uci": "",
                "is_mate": False,
                "mate_in": None,
            }

        eval_depth = depth or self.depth
        try:
            board = chess.Board(fen)
            info = self._engine.analyse(
                board,
                chess.engine.Limit(depth=eval_depth, time=ENGINE_TIMEOUT_SEC)
            )

            raw_score = info.get("score")
            if raw_score is None:
                return {"available": False, "fen": fen, "opponent_eval": 0.0}

            white_pov_score = raw_score.white()
            norm = normalize_score(white_pov_score)

            white_cp = norm["cp"]
            opponent_cp = white_cp if opponent_color.lower() == "white" else -white_cp

            pv = info.get("pv", [])
            best_move_san = board.san(pv[0]) if pv else ""
            best_move_uci = pv[0].uci() if pv else ""

            return {
                "available": True,
                "fen": fen,
                "white_eval": white_cp / 100.0,
                "opponent_eval": opponent_cp / 100.0,
                "white_cp": white_cp,
                "opponent_cp": opponent_cp,
                "best_move_san": best_move_san,
                "best_move_uci": best_move_uci,
                "is_mate": norm["is_mate"],
                "mate_in": norm["mate_in"],
            }
        except Exception:
            return {"available": False, "fen": fen, "opponent_eval": 0.0}

    def analyze_move(
        self,
        fen_before: str,
        move_san: str,
        depth: Optional[int] = None,
        opponent_color: str = "white"
    ) -> Dict[str, Any]:
        """
        Đánh giá 1 nước đi cụ thể của đối thủ:
        Tính điểm trước nước đi, điểm sau nước đi, Centipawn Loss (CPL), và Delta Eval từ Opponent POV.
        """
        eval_before = self.evaluate_position(fen_before, depth=depth, opponent_color=opponent_color)
        if not eval_before.get("available"):
            return {"available": False}

        try:
            board = chess.Board(fen_before)
            move_obj = board.parse_san(move_san)
            board.push(move_obj)
            fen_after = board.fen()
        except Exception:
            return {"available": False}

        eval_after = self.evaluate_position(fen_after, depth=depth, opponent_color=opponent_color)
        if not eval_after.get("available"):
            return {"available": False}

        opp_eval_before = eval_before["opponent_eval"]
        opp_eval_after = eval_after["opponent_eval"]
        opp_delta = opp_eval_after - opp_eval_before

        opp_cp_before = eval_before["opponent_cp"]
        opp_cp_after = eval_after["opponent_cp"]
        cpl = max(0.0, opp_cp_before - opp_cp_after)

        return {
            "available": True,
            "fen_before": fen_before,
            "fen_after": fen_after,
            "move_san": move_san,
            "eval_before": opp_eval_before,
            "eval_after": opp_eval_after,
            "delta_eval": opp_delta,
            "cpl": cpl,
            "best_move_san": eval_before.get("best_move_san", ""),
        }

    def close(self):
        """Đóng subprocess engine an toàn."""
        if self._engine:
            try:
                self._engine.quit()
            except Exception:
                pass
            self._engine = None
            self._is_ready = False
