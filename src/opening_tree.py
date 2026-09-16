"""
Opening Tree Module
-------------------
Chức năng: Xây dựng cấu trúc cây khai cuộc Node-based Trie Structure từ các ván đấu PGN.
Mỗi nút (TreeNode) biểu diễn một trạng thái cờ (FEN) và danh sách các nhánh con (children).
Hỗ trợ Transposition-Safe Aggregation và bộ lọc theo màu quân (White/Black).
"""

from typing import List, Dict, Any, Tuple, Optional
import chess
from src.utils import determine_game_outcome, normalize_fen


class TreeNode:
    """Nút của Cây Khai Cuộc (Opening Tree Node)."""

    def __init__(self, fen: str, move_san: str = "", move_uci: str = ""):
        self.fen = fen
        self.move_san = move_san
        self.move_uci = move_uci
        self.games_count = 0
        self.wins = 0
        self.draws = 0
        self.losses = 0
        self.children: Dict[str, "TreeNode"] = {}  # Move_SAN -> TreeNode child
        self.games: List[Dict[str, Any]] = []


def build_opening_tree(
    filtered_games: List[Dict[str, Any]],
    color: Optional[str] = None
) -> Tuple[TreeNode, Dict[str, TreeNode]]:
    """
    Xây dựng cây Opening Tree và HashMap FEN từ danh sách các ván đấu của kỳ thủ.
    Hỗ trợ gom nhóm chuyển vị (transposition-safe) và lọc theo màu quân.

    Args:
        filtered_games: Danh sách các ván đấu của kỳ thủ.
        color: Tùy chọn lọc màu quân ("white", "black", hoặc None/"all" cho tất cả).

    Returns:
        Tuple[TreeNode, Dict[str, TreeNode]]: Nút gốc (Starting Position) và fen_map tra cứu O(1).
    """
    # Lọc theo màu quân nếu được chỉ định
    if color and color.lower() in ["white", "black"]:
        target_color = color.lower()
        games_to_process = [g for g in filtered_games if str(g.get("player_color", "")).lower() == target_color]
    else:
        games_to_process = filtered_games

    root_fen = chess.Board().fen()
    root_epd = normalize_fen(root_fen)
    root = TreeNode(root_fen)
    fen_map: Dict[str, TreeNode] = {root_fen: root, root_epd: root}

    for game in games_to_process:
        player_color = game.get("player_color", "white")
        result = game.get("result", "*")
        moves = game.get("moves", [])

        is_win, is_draw, is_loss = determine_game_outcome(player_color, result)

        board = chess.Board()
        current_node = root

        # Cập nhật nút gốc
        current_node.games_count += 1
        current_node.games.append(game)
        if is_win:
            current_node.wins += 1
        elif is_draw:
            current_node.draws += 1
        elif is_loss:
            current_node.losses += 1

        for san_move in moves:
            try:
                move_obj = board.parse_san(san_move)
                uci_move = move_obj.uci()
                board.push(move_obj)
                next_fen = board.fen()
                next_epd = normalize_fen(next_fen)
            except (ValueError, chess.IllegalMoveError, chess.AmbiguousMoveError):
                # Nước đi SAN không hợp lệ
                break

            # 1. Cập nhật nhánh con của current_node (position-level continuation)
            if san_move not in current_node.children:
                child_node = TreeNode(next_fen, move_san=san_move, move_uci=uci_move)
                current_node.children[san_move] = child_node
            else:
                child_node = current_node.children[san_move]

            child_node.games_count += 1
            child_node.games.append(game)
            if is_win:
                child_node.wins += 1
            elif is_draw:
                child_node.draws += 1
            elif is_loss:
                child_node.losses += 1

            # 2. Cập nhật hoặc liên kết nút thế cờ tổng hợp trong fen_map (Transposition-Safe)
            if next_epd not in fen_map:
                # Dùng child_node làm nút đại diện cho thế cờ này
                fen_map[next_epd] = child_node
                fen_map[next_fen] = child_node
                current_node = child_node
            else:
                pos_node = fen_map[next_epd]
                fen_map[next_fen] = pos_node

                # Nếu child_node là nút mới tạo ở một nhánh khác cùng dẫn đến thế cờ next_epd (chuyển vị),
                # đồng bộ hóa games_count, kết quả và continuations giữa các nút cùng FEN
                if pos_node is not child_node:
                    pos_node.games_count += 1
                    pos_node.games.append(game)
                    if is_win:
                        pos_node.wins += 1
                    elif is_draw:
                        pos_node.draws += 1
                    elif is_loss:
                        pos_node.losses += 1

                current_node = pos_node

    return root, fen_map


def get_position_details(
    fen_map: Dict[str, TreeNode], fen: str
) -> Dict[str, Any]:
    """
    Tra cứu chi tiết nút cây theo FEN vị trí bàn cờ.
    Hỗ trợ tra cứu Transposition-Safe qua normalized EPD key.

    Returns:
        Dict chứa thống kê số ván, winrate, và danh sách continuations tiếp theo.
    """
    norm_key = normalize_fen(fen)
    node = fen_map.get(fen) or fen_map.get(norm_key)

    if node is None:
        return {
            "fen": fen,
            "in_pgn": False,
            "total_games": 0,
            "wins": 0,
            "draws": 0,
            "losses": 0,
            "score_pct": 0.0,
            "continuations": [],
        }

    total_at_node = node.games_count

    continuations_list = []
    for san_move, child in node.children.items():
        g_count = child.games_count
        w = child.wins
        d = child.draws
        l = child.losses

        usage_pct = round((g_count / total_at_node) * 100, 1) if total_at_node > 0 else 0.0
        score_pct = round(((w + 0.5 * d) / g_count) * 100, 1) if g_count > 0 else 0.0
        win_pct = round((w / g_count) * 100, 1) if g_count > 0 else 0.0
        draw_pct = round((d / g_count) * 100, 1) if g_count > 0 else 0.0
        loss_pct = round((l / g_count) * 100, 1) if g_count > 0 else 0.0

        single_game_info = None
        if g_count == 1 and child.games:
            g_obj = child.games[0]
            game_link = g_obj.get("link", "")
            if not game_link and str(g_obj.get("site", "")).startswith("http"):
                game_link = g_obj.get("site", "")

            single_game_info = {
                "white": g_obj.get("white", "Unknown White"),
                "white_elo": g_obj.get("white_elo", 0),
                "black": g_obj.get("black", "Unknown Black"),
                "black_elo": g_obj.get("black_elo", 0),
                "result": g_obj.get("result", "*"),
                "site": g_obj.get("site", ""),
                "link": game_link,
                "event": g_obj.get("event", ""),
                "date": g_obj.get("date", ""),
                "round": g_obj.get("round", ""),
                "time": g_obj.get("time", ""),
                "time_control": g_obj.get("time_control", ""),
                "moves": g_obj.get("moves", []),
                "opening": g_obj.get("opening", ""),
                "player_color": g_obj.get("player_color", "white"),
            }

        continuations_list.append({
            "san": san_move,
            "uci": child.move_uci,
            "target_fen": child.fen,
            "games_count": g_count,
            "usage_pct": usage_pct,
            "score_pct": score_pct,
            "win_pct": win_pct,
            "draw_pct": draw_pct,
            "loss_pct": loss_pct,
            "wins": w,
            "draws": d,
            "losses": l,
            "single_game_info": single_game_info,
        })

    # Sắp xếp các nước đi tiếp theo theo tần suất chơi (games_count) giảm dần, sau đó theo điểm số
    continuations_list.sort(key=lambda x: (x["games_count"], x["score_pct"]), reverse=True)

    w_node = node.wins
    d_node = node.draws
    node_score = round(((w_node + 0.5 * d_node) / total_at_node) * 100, 1) if total_at_node > 0 else 0.0

    return {
        "fen": fen,
        "in_pgn": True,
        "total_games": total_at_node,
        "wins": w_node,
        "draws": d_node,
        "losses": node.losses,
        "score_pct": node_score,
        "continuations": continuations_list,
    }

