"""
Engine Evaluator Module
-----------------------
Chức năng:
1. Trích xuất tức thì 0 giây các đánh giá có sẵn (Lichess/PGN [%eval ...]) trên 100% ván đấu.
2. Phân tích đa luồng song song (Multi-worker Parallel Engine qua concurrent.futures) cho PGN thô.
3. Tính toán ACPL (Average Centipawn Loss), Delta Eval, CPL, và phân loại nước đi (Blunder/Mistake/Inaccuracy).
"""

import os
import time
from typing import List, Dict, Any, Optional, Tuple
import concurrent.futures
import chess

from src.engine.stockfish_engine import StockfishEngine


def analyze_game_moves(
    game: Dict[str, Any],
    engine: StockfishEngine,
    depth: int = 10
) -> List[Dict[str, Any]]:
    """
    Phân tích từng nước đi của KỲ THỦ ĐỐI THỦ trong một ván đấu bằng Stockfish.
    """
    if not engine.is_available():
        return []

    moves = game.get("moves", [])
    player_color = game.get("player_color", "white").lower()
    if not moves:
        return []

    results = []
    board = chess.Board()

    for ply, san_move in enumerate(moves):
        fen_before = board.fen()
        try:
            move_obj = board.parse_san(san_move)
        except Exception:
            break

        move_color = "white" if ply % 2 == 0 else "black"
        is_opponent_move = (move_color == player_color)

        if is_opponent_move:
            analysis = engine.analyze_move(
                fen_before=fen_before,
                move_san=san_move,
                depth=depth,
                opponent_color=player_color
            )
            if analysis.get("available"):
                move_num = (ply // 2) + 1
                analysis["ply"] = ply
                analysis["move_number"] = move_num
                # Clamp CPL to realistic 500cp max per move
                if "cpl" in analysis and analysis["cpl"] is not None:
                    analysis["cpl"] = round(min(500.0, max(0.0, float(analysis["cpl"]))), 1)
                results.append(analysis)

        board.push(move_obj)

    return results


def extract_evaluations_from_single_game_evals(
    game: Dict[str, Any],
    game_idx: int = 0
) -> List[Dict[str, Any]]:
    """
    Trích xuất đánh giá từng nước đi của đối thủ từ dữ liệu [%eval ...] có sẵn trong PGN.
    Tốc độ tức thì (0 giây), không cần chạy Stockfish.
    """
    moves = game.get("moves", [])
    evals = game.get("evals", [])
    player_color = game.get("player_color", "white").lower()

    if not moves or not evals:
        return []

    results = []
    board = chess.Board()
    prev_white_cp = 20  # Ước lượng khởi đầu cân bằng (+0.2 cho Trắng)

    for ply, san_move in enumerate(moves):
        fen_before = board.fen()
        try:
            move_obj = board.parse_san(san_move)
        except Exception:
            break

        curr_eval = evals[ply] if ply < len(evals) else None
        curr_white_cp = curr_eval["cp"] if (curr_eval and "cp" in curr_eval and curr_eval["cp"] is not None) else prev_white_cp

        move_color = "white" if ply % 2 == 0 else "black"
        is_opponent_move = (move_color == player_color)

        board.push(move_obj)
        fen_after = board.fen()

        if is_opponent_move and curr_eval is not None:
            # Quy đổi điểm sang góc nhìn đối thủ (Opponent POV)
            if player_color == "white":
                opp_cp_before = prev_white_cp
                opp_cp_after = curr_white_cp
            else:
                opp_cp_before = -prev_white_cp
                opp_cp_after = -curr_white_cp

            # Giới hạn centipawn trong biên an toàn [-1000, 1000] (+/- 10.0 pawns)
            opp_cp_before = max(-1000, min(1000, opp_cp_before))
            opp_cp_after = max(-1000, min(1000, opp_cp_after))

            opp_eval_before = round(opp_cp_before / 100.0, 2)
            opp_eval_after = round(opp_cp_after / 100.0, 2)
            opp_delta = round(opp_eval_after - opp_eval_before, 2)

            # Chuẩn hóa CPL: Giới hạn tổn thất mỗi nước tối đa 500 cp (tránh phá hủy ACPL trong thế cờ đã thua)
            raw_loss = float(opp_cp_before - opp_cp_after)
            cpl = round(max(0.0, min(500.0, raw_loss)), 1)

            results.append({
                "available": True,
                "fen_before": fen_before,
                "fen_after": fen_after,
                "move_san": san_move,
                "eval_before": opp_eval_before,
                "eval_after": opp_eval_after,
                "delta_eval": opp_delta,
                "cpl": cpl,
                "best_move_san": "",
                "ply": ply,
                "move_number": (ply // 2) + 1,
                "game_index": game_idx,
                "game_opening": game.get("opening", "Unknown"),
                "site": game.get("site", "")
            })

        prev_white_cp = curr_white_cp

    return results


def extract_all_embedded_evaluations(games: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Trích xuất toàn bộ dữ liệu đánh giá có sẵn từ 100% các ván đấu chứa tag [%eval].
    """
    all_evaluations = []
    game_summaries = []
    analyzed_count = 0

    for idx, g in enumerate(games or []):
        if g.get("has_evals") and g.get("evals"):
            evals = extract_evaluations_from_single_game_evals(g, game_idx=idx)
            if evals:
                cpls = [e["cpl"] for e in evals if "cpl" in e]
                game_acpl = round(sum(cpls) / len(cpls), 1) if cpls else None

                g["game_acpl"] = game_acpl
                g["analyzed_moves"] = len(evals)

                game_summaries.append({
                    "game_index": idx,
                    "opening": g.get("opening", "Unknown"),
                    "result": g.get("result", "*"),
                    "player_color": g.get("player_color", "white"),
                    "moves_analyzed": len(evals),
                    "game_acpl": game_acpl,
                    "avg_cpl": game_acpl if game_acpl is not None else 0.0,
                    "site": g.get("site", "")
                })

                all_evaluations.extend(evals)
                analyzed_count += 1
            else:
                g.setdefault("game_acpl", None)
                g.setdefault("analyzed_moves", 0)
        else:
            g.setdefault("game_acpl", None)
            g.setdefault("analyzed_moves", 0)

    if not all_evaluations:
        return {
            "available": False,
            "source": "embedded_pgn",
            "analyzed_games": 0,
            "total_moves_analyzed": 0,
            "overall_acpl": None,
            "move_evaluations": [],
            "game_summaries": []
        }

    all_cpls = [e["cpl"] for e in all_evaluations if "cpl" in e]
    overall_acpl = round(sum(all_cpls) / len(all_cpls), 1) if all_cpls else None

    return {
        "available": True,
        "source": "embedded_pgn",
        "analyzed_games": analyzed_count,
        "total_moves_analyzed": len(all_evaluations),
        "overall_acpl": overall_acpl,
        "move_evaluations": all_evaluations,
        "game_summaries": game_summaries
    }


def _worker_analyze_game_subset(
    indexed_games: List[Tuple[int, Dict[str, Any]]],
    depth: int = 6,
    result_queue: Optional[Any] = None
) -> List[Tuple[int, Dict[str, Any], List[Dict[str, Any]]]]:
    """
    Hàm worker chạy độc lập trên từng luồng/tiến trình riêng biệt với 1 instance Stockfish duy nhất cho cả cụm ván đấu.
    """
    engine = StockfishEngine(depth=depth)
    if not engine.is_available():
        fallback = []
        for idx, g in indexed_games:
            item = (idx, g, [{
                "game_index": idx,
                "game_opening": g.get("opening", "Unknown"),
                "site": g.get("site", ""),
                "is_empty": True,
                "available": False,
                "ply": 0,
                "cpl": None
            }])
            fallback.append(item)
            if result_queue is not None:
                try:
                    result_queue.put(item)
                except Exception:
                    pass
        return fallback

    results = []
    try:
        for idx, g in indexed_games:
            evals = analyze_game_moves(g, engine, depth=depth)
            if not evals:
                evals = [{
                    "game_index": idx,
                    "game_opening": g.get("opening", "Unknown"),
                    "site": g.get("site", ""),
                    "is_empty": True,
                    "available": False,
                    "ply": 0,
                    "cpl": None
                }]
            else:
                for e in evals:
                    e["game_index"] = idx
                    e["game_opening"] = g.get("opening", "Unknown")
                    e["site"] = g.get("site", "")
            item = (idx, g, evals)
            results.append(item)
            if result_queue is not None:
                try:
                    result_queue.put(item)
                except Exception:
                    pass
    finally:
        engine.close()

    return results


def parallel_batch_analyze_games(
    games: List[Dict[str, Any]],
    max_workers: Optional[int] = None,
    depth: int = 6,
    max_games: Optional[int] = 20,
    progress_callback: Optional[Any] = None,
    existing_evaluations: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Phân tích Batch song song đa luồng theo cụm (Chunk-based Multi-threading qua concurrent.futures).
    Mỗi worker mở đúng 1 Stockfish instance để phân tích cả cụm, và gửi tiến trình từng ván về Main Thread theo thời gian thực.
    """
    import queue

    limit = max_games if max_games is not None else len(games or [])
    all_target_games = (games or [])[:limit]

    # Nhận diện các ván đã được phân tích trước đó để bỏ qua
    analyzed_indices = set(e["game_index"] for e in (existing_evaluations or []) if "game_index" in e)
    selected_games = [(idx, g) for idx, g in enumerate(all_target_games) if idx not in analyzed_indices]

    new_evaluations: List[Dict[str, Any]] = []
    
    if selected_games:
        cpu_cores = os.cpu_count() or 4
        num_workers = max_workers or min(max(1, cpu_cores - 1), 8, len(selected_games))

        # Chia nhỏ danh sách ván đấu cần phân tích thành các chunk cho từng worker
        chunks: List[List[Tuple[int, Dict[str, Any]]]] = [[] for _ in range(num_workers)]
        for i, item in enumerate(selected_games):
            chunks[i % num_workers].append(item)
        chunks = [c for c in chunks if c]

        result_q: queue.Queue = queue.Queue()
        completed_games = 0
        total_games_to_analyze = len(selected_games)

        if progress_callback:
            try:
                progress_callback(0, total_games_to_analyze)
            except Exception:
                pass

        all_worker_results = []

        # Chạy song song qua ThreadPoolExecutor (mỗi thread mở 1 Stockfish duy nhất phân tích hết cả chunk)
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(chunks)) as executor:
            futures = [executor.submit(_worker_analyze_game_subset, chunk, depth, result_q) for chunk in chunks]
            
            while completed_games < total_games_to_analyze:
                try:
                    item = result_q.get(timeout=0.02)
                    all_worker_results.append(item)
                    completed_games += 1
                    if progress_callback:
                        try:
                            progress_callback(completed_games, total_games_to_analyze)
                            time.sleep(0.005)
                        except Exception:
                            pass
                except queue.Empty:
                    if all(f.done() for f in futures) and result_q.empty():
                        break

            while not result_q.empty():
                try:
                    all_worker_results.append(result_q.get_nowait())
                except queue.Empty:
                    break

        # Sắp xếp lại theo đúng thứ tự game_index ban đầu
        all_worker_results.sort(key=lambda x: x[0])

        for idx, g, evals in all_worker_results:
            if evals:
                cpls = [e["cpl"] for e in evals if e.get("cpl") is not None]
                game_acpl = round(sum(cpls) / len(cpls), 1) if cpls else None
                g["game_acpl"] = game_acpl
                g["analyzed_moves"] = len([e for e in evals if e.get("available")])
                new_evaluations.extend(evals)
            else:
                g.setdefault("game_acpl", None)
                g.setdefault("analyzed_moves", 0)

    # Kết hợp đánh giá có sẵn và đánh giá mới
    combined_evaluations = list(existing_evaluations or []) + new_evaluations
    combined_evaluations.sort(key=lambda x: (x.get("game_index", 0), x.get("ply", 0)))

    if not combined_evaluations:
        return {
            "available": False,
            "source": "parallel_stockfish",
            "analyzed_games": 0,
            "total_moves_analyzed": 0,
            "overall_acpl": None,
            "move_evaluations": [],
            "game_summaries": []
        }

    # Tái xây dựng game_summaries cho toàn bộ các ván đã phân tích
    evals_by_game: Dict[int, List[Dict[str, Any]]] = {}
    for ev in combined_evaluations:
        g_idx = ev.get("game_index", 0)
        evals_by_game.setdefault(g_idx, []).append(ev)

    game_summaries = []
    for idx, ev_list in sorted(evals_by_game.items()):
        if idx < len(games or []):
            g = games[idx]
            cpls = [e["cpl"] for e in ev_list if e.get("cpl") is not None]
            game_acpl = round(sum(cpls) / len(cpls), 1) if cpls else None
            g["game_acpl"] = game_acpl
            g["analyzed_moves"] = len([e for e in ev_list if e.get("available")])

            game_summaries.append({
                "game_index": idx,
                "opening": g.get("opening", "Unknown"),
                "result": g.get("result", "*"),
                "player_color": g.get("player_color", "white"),
                "moves_analyzed": len([e for e in ev_list if e.get("available")]),
                "game_acpl": game_acpl,
                "avg_cpl": game_acpl if game_acpl is not None else 0.0,
                "site": g.get("site", "")
            })

    all_cpls = [e["cpl"] for e in combined_evaluations if e.get("cpl") is not None]
    overall_acpl = round(sum(all_cpls) / len(all_cpls), 1) if all_cpls else None

    return {
        "available": True,
        "source": "parallel_stockfish",
        "analyzed_games": len(game_summaries),
        "total_moves_analyzed": len(combined_evaluations),
        "overall_acpl": overall_acpl,
        "move_evaluations": combined_evaluations,
        "game_summaries": game_summaries
    }


def get_comprehensive_move_evaluations(
    games: List[Dict[str, Any]],
    engine: Optional[StockfishEngine] = None,
    max_workers: Optional[int] = None,
    depth: int = 6,
    max_stockfish_games: int = 10,
    progress_callback: Optional[Any] = None,
    existing_evaluations: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    API Phân tích Toàn diện thông minh (Hybrid Comprehensive Evaluator):
    1. Ưu tiên trích xuất tức thì (0 giây) từ các ván có sẵn [%eval] (Lichess/PGN evals) trên 100% dữ liệu.
    2. Nếu không có eval sẵn, phân tích nhanh 10 ván mẫu ở Depth 6 bằng cụm Stockfish đa luồng song song.
    """
    if not games:
        return {
            "available": False,
            "source": "none",
            "analyzed_games": 0,
            "total_moves_analyzed": 0,
            "overall_acpl": None,
            "move_evaluations": [],
            "game_summaries": []
        }

    # 1. Thử trích xuất từ dữ liệu có sẵn trên 100% ván đấu
    embedded_res = extract_all_embedded_evaluations(games)
    if embedded_res.get("available") and embedded_res.get("analyzed_games", 0) > 0:
        return embedded_res

    # Nếu max_stockfish_games <= 0 (ví dụ Lichess không yêu cầu phân tích thêm ván mẫu khi thiếu eval):
    if max_stockfish_games <= 0:
        return {
            "available": False,
            "source": "none",
            "analyzed_games": 0,
            "total_moves_analyzed": 0,
            "overall_acpl": None,
            "move_evaluations": [],
            "game_summaries": []
        }

    # 2. Dự phòng: Chạy cụm Stockfish đa luồng song song trên 10 ván mẫu ban đầu
    stockfish_available = (engine and engine.is_available()) or StockfishEngine().is_available()
    if stockfish_available:
        return parallel_batch_analyze_games(
            games,
            max_workers=max_workers,
            depth=depth,
            max_games=max_stockfish_games,
            progress_callback=progress_callback,
            existing_evaluations=existing_evaluations
        )

    return {
        "available": False,
        "source": "none",
        "analyzed_games": 0,
        "total_moves_analyzed": 0,
        "overall_acpl": None,
        "move_evaluations": [],
        "game_summaries": []
    }


def batch_analyze_games(
    games: List[Dict[str, Any]],
    engine: StockfishEngine,
    max_games: int = 10,
    depth: int = 6
) -> Dict[str, Any]:
    """
    Hàm wrapper tương thích ngược (Backward compatible) trỏ về API toàn diện.
    """
    return get_comprehensive_move_evaluations(
        games,
        engine=engine,
        depth=depth,
        max_stockfish_games=max_games
    )

