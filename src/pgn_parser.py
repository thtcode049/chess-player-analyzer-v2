"""
PGN Parser Module
-----------------
Chức năng: Đọc và parse các ván đấu cờ vua từ nguồn PGN (Stream/File/String).
Trích xuất thông tin người chơi, kết quả, hệ thống khai cuộc (ECO/Opening), và danh sách nước đi (SAN).
Tự động suy luận tên khai cuộc từ các nước đi nếu file PGN không có tag [Opening].
"""

import io
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Union, Tuple, Optional
import chess.pgn

logger = logging.getLogger(__name__)

# Cấu trúc Trie và bộ chỉ mục tra cứu từ lichess-org/chess-openings (3,865 biến thể ECO quốc tế)
_LICHESS_OPENINGS_TRIE: Optional[Dict[str, Any]] = None
_LICHESS_OPENINGS_BY_NAME: Optional[Dict[str, Dict[str, Any]]] = None
_LICHESS_OPENINGS_BY_EPD: Optional[Dict[str, Dict[str, Any]]] = None


def _get_lichess_openings_path() -> Path:
    p1 = Path(__file__).resolve().parent.parent / "data" / "lichess_openings.json"
    if p1.exists():
        return p1
    p2 = Path("data/lichess_openings.json")
    if p2.exists():
        return p2
    return p1


def load_lichess_openings() -> None:
    """
    Tải bộ dữ liệu khai cuộc chuẩn từ lichess-org/chess-openings (3,865 biến thể ECO A00-E99).
    Xây dựng cây Trie tiền tố nước đi và từ điển tra cứu theo tên/EPD cho độ phức tạp O(k).
    """
    global _LICHESS_OPENINGS_TRIE, _LICHESS_OPENINGS_BY_NAME, _LICHESS_OPENINGS_BY_EPD
    if _LICHESS_OPENINGS_TRIE is not None:
        return

    trie: Dict[str, Any] = {}
    by_name: Dict[str, Dict[str, Any]] = {}
    by_epd: Dict[str, Dict[str, Any]] = {}

    path = _get_lichess_openings_path()
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                openings_data = json.load(f)
            for entry in openings_data:
                # Thêm vào Trie nước đi
                node = trie
                for m in entry.get("moves", []):
                    if m not in node:
                        node[m] = {}
                    node = node[m]
                node["__opening__"] = entry

                # Thêm vào bảng tra cứu tên chuẩn hóa (ưu tiên chuỗi nước đi ngắn nhất làm hình cờ chuẩn)
                name = entry.get("name", "").strip()
                if name:
                    name_key = name.lower()
                    if name_key not in by_name or len(entry.get("moves", [])) < len(by_name[name_key].get("moves", [])):
                        by_name[name_key] = entry

                # Thêm vào bảng tra cứu EPD
                epd = entry.get("epd", "").strip()
                if epd and epd not in by_epd:
                    by_epd[epd] = entry
        except Exception as e:
            logger.warning(f"Could not load lichess_openings.json from {path}: {e}")

    _LICHESS_OPENINGS_TRIE = trie
    _LICHESS_OPENINGS_BY_NAME = by_name
    _LICHESS_OPENINGS_BY_EPD = by_epd


def find_opening_by_moves(moves: List[str]) -> Optional[Dict[str, Any]]:
    """
    Tra cứu khai cuộc từ chuỗi nước đi SAN (Longest Matching Prefix) dựa trên 3,865 biến của Lichess.
    Trả về Dict gồm: {eco, name, pgn, moves, fen, epd} hoặc None nếu không khớp.
    """
    if not moves:
        return None
    if _LICHESS_OPENINGS_TRIE is None:
        load_lichess_openings()

    node = _LICHESS_OPENINGS_TRIE or {}
    best_match = None
    for m in moves:
        if m in node:
            node = node[m]
            if "__opening__" in node:
                best_match = node["__opening__"]
        else:
            break
    return best_match


def find_opening_by_name(name: str) -> Optional[Dict[str, Any]]:
    """
    Tra cứu thông tin khai cuộc chuẩn (moves, FEN, ECO, PGN) theo tên từ Lichess Openings.
    Hỗ trợ khớp chính xác hoặc khớp mở rộng (substring).
    """
    if not name:
        return None
    if _LICHESS_OPENINGS_BY_NAME is None:
        load_lichess_openings()

    by_name = _LICHESS_OPENINGS_BY_NAME or {}
    clean_name = name.strip().lower()
    if clean_name in by_name:
        return by_name[clean_name]

    # Partial / substring match (ưu tiên biến thể ngắn gọn nhất nếu trùng nhiều)
    matches = [entry for k, entry in by_name.items() if clean_name in k or k in clean_name]
    if matches:
        return min(matches, key=lambda x: len(x.get("moves", [])))
    return None


def infer_opening_from_moves(moves: List[str]) -> Tuple[str, str]:
    """
    Suy luận mã ECO và tên Khai cuộc dựa trên chuẩn quốc tế lichess-org/chess-openings.
    Thay thế hoàn toàn bảng tra cứu tĩnh sơ sài cũ.
    """
    if not moves:
        return ("", "Unknown Opening")

    match = find_opening_by_moves(moves)
    if match:
        return (match.get("eco", ""), match.get("name", "Unknown Opening"))

    if len(moves) >= 2:
        return ("", f"1.{moves[0]} {moves[1]}")
    if len(moves) == 1:
        return ("", f"1.{moves[0]}")
    return ("", "Unknown Opening")


import re

EVAL_REGEX = re.compile(r'\[%eval\s+([#+-]?\d+(?:\.\d+)?)\]', re.IGNORECASE)


def _extract_node_eval(node) -> Optional[Dict[str, Any]]:
    """Trích xuất điểm đánh giá Stockfish [%eval ...] từ PGN comment hoặc node.eval()."""
    # 1. Thử hàm tích hợp của python-chess
    try:
        ev = node.eval()
        if ev is not None:
            w_score = ev.white()
            if w_score.is_mate():
                m = w_score.mate()
                mate_val = 10.0 if (m is not None and m > 0) else -10.0
                mate_cp = 1000 if (m is not None and m > 0) else -1000
                return {
                    "eval_white": mate_val,
                    "cp": mate_cp,
                    "is_mate": True,
                    "mate": m
                }
            cp = w_score.score()
            if cp is not None:
                clamped_cp = max(-1000, min(1000, cp))
                return {
                    "eval_white": round(clamped_cp / 100.0, 2),
                    "cp": clamped_cp,
                    "is_mate": False,
                    "mate": None
                }
    except Exception:
        pass

    # 2. Fallback regex bóc tách từ chuỗi comment
    comment = getattr(node, "comment", "")
    if comment:
        match = EVAL_REGEX.search(comment)
        if match:
            val_str = match.group(1)
            if val_str.startswith("#"):
                try:
                    m = int(val_str[1:])
                    mate_val = 10.0 if m > 0 else -10.0
                    mate_cp = 1000 if m > 0 else -1000
                    return {
                        "eval_white": mate_val,
                        "cp": mate_cp,
                        "is_mate": True,
                        "mate": m
                    }
                except ValueError:
                    pass
            else:
                try:
                    ev_float = float(val_str)
                    clamped_ev = max(-10.0, min(10.0, ev_float))
                    return {
                        "eval_white": round(clamped_ev, 2),
                        "cp": int(round(clamped_ev * 100)),
                        "is_mate": False,
                        "mate": None
                    }
                except ValueError:
                    pass
    return None


def parse_single_game(game: chess.pgn.Game) -> Dict[str, Any]:
    """
    Trích xuất các trường thông tin cơ bản từ một ván đấu chess.pgn.Game.
    Bao gồm cả trích xuất điểm đánh giá Stockfish có sẵn (Lichess/ChessBase evals).
    """
    headers = game.headers
    board = game.board()
    moves = []
    evals = []
    has_evals = False

    for node in game.mainline():
        san_move = board.san(node.move)
        moves.append(san_move)

        node_eval = _extract_node_eval(node)
        if node_eval is not None:
            has_evals = True
            evals.append(node_eval)
        else:
            evals.append(None)

        board.push(node.move)

    raw_eco = headers.get("ECO", "").strip()
    raw_op = headers.get("Opening", "").strip()

    # Tự động suy luận tên khai cuộc nếu tag PGN thô bị rỗng hoặc Unknown
    if not raw_op or raw_op.lower() in ["unknown opening", "unknown", ""]:
        inferred_eco, inferred_op = infer_opening_from_moves(moves)
        opening = inferred_op
        eco = raw_eco if raw_eco else inferred_eco
    else:
        opening = raw_op
        eco = raw_eco

    raw_event = headers.get("Event", "Unknown Event").strip()
    raw_site = headers.get("Site", "Unknown Site").strip()
    raw_date = headers.get("Date", "????.??.??").strip()
    raw_round = headers.get("Round", "?").strip()
    raw_link = headers.get("Link", "").strip()
    raw_url = headers.get("URL", "").strip()
    raw_time = headers.get("Time", "").strip() or headers.get("UTCTime", "").strip()
    raw_time_control = headers.get("TimeControl", "").strip()

    game_url = ""
    if raw_link.startswith("http://") or raw_link.startswith("https://"):
        game_url = raw_link
    elif raw_url.startswith("http://") or raw_url.startswith("https://"):
        game_url = raw_url
    elif raw_site.startswith("http://") or raw_site.startswith("https://"):
        game_url = raw_site

    return {
        "event": raw_event,
        "site": raw_site,
        "date": raw_date,
        "round": raw_round,
        "link": game_url,
        "time": raw_time,
        "time_control": raw_time_control,
        "white": headers.get("White", "Unknown White").strip(),
        "black": headers.get("Black", "Unknown Black").strip(),
        "result": headers.get("Result", "*"),
        "white_elo": _parse_elo(headers.get("WhiteElo", "0")),
        "black_elo": _parse_elo(headers.get("BlackElo", "0")),
        "eco": eco,
        "opening": opening,
        "moves": moves,
        "evals": evals,
        "has_evals": has_evals,
        "ply_count": len(moves),
    }


def _parse_elo(elo_str: str) -> int:
    """Chuyển đổi chuỗi Elo thành số nguyên an toàn."""
    try:
        val = int(elo_str)
        return val if val > 0 else 0
    except (ValueError, TypeError):
        return 0


def parse_pgn(
    pgn_source: Union[str, Path, io.StringIO, io.BytesIO, io.TextIOBase]
) -> List[Dict[str, Any]]:
    """
    Đọc và parse tất cả các ván đấu từ nguồn PGN (đường dẫn file, string, hoặc file-like stream).
    """
    parsed_games = []

    if isinstance(pgn_source, (str, Path)):
        if isinstance(pgn_source, str) and ("[" in pgn_source or "1." in pgn_source or "\n" in pgn_source):
            try:
                file_path = Path(pgn_source)
                if file_path.exists() and file_path.is_file():
                    with open(file_path, encoding="utf-8", errors="replace") as f:
                        return _read_games_from_stream(f)
            except Exception:
                pass
            text_stream = io.StringIO(pgn_source)
            parsed_games = _read_games_from_stream(text_stream)
        else:
            file_path = Path(pgn_source)
            if not file_path.exists():
                raise FileNotFoundError(f"File PGN không tồn tại: {file_path}")
            with open(file_path, encoding="utf-8", errors="replace") as f:
                parsed_games = _read_games_from_stream(f)
    elif isinstance(pgn_source, bytes):
        text_stream = io.StringIO(pgn_source.decode("utf-8", errors="replace"))
        parsed_games = _read_games_from_stream(text_stream)
    elif isinstance(pgn_source, io.StringIO) or hasattr(pgn_source, "read"):
        if hasattr(pgn_source, "getvalue") and isinstance(pgn_source.getvalue(), bytes):
            text_stream = io.StringIO(pgn_source.getvalue().decode("utf-8", errors="replace"))
            parsed_games = _read_games_from_stream(text_stream)
        elif hasattr(pgn_source, "getvalue") and isinstance(pgn_source.getvalue(), str):
            text_stream = io.StringIO(pgn_source.getvalue())
            parsed_games = _read_games_from_stream(text_stream)
        else:
            parsed_games = _read_games_from_stream(pgn_source)
    else:
        raise ValueError("Nguồn dữ liệu PGN không hợp lệ.")

    return parsed_games


def _read_games_from_stream(stream) -> List[Dict[str, Any]]:
    """Đọc từng game từ stream, tự động loại bỏ các ván bị hủy / ván rỗng (< 2 nước đi) và ván lỗi."""
    games = []
    while True:
        try:
            game = chess.pgn.read_game(stream)
            if game is None:
                break
            parsed_game = parse_single_game(game)
            # Tự động loại bỏ các ván bị hủy / ván rỗng (dưới 2 nước đi)
            if len(parsed_game.get("moves", [])) >= 2:
                games.append(parsed_game)
        except Exception:
            continue
    return games


def extract_players(games: List[Dict[str, Any]]) -> Dict[str, int]:
    """Thống kê tần suất xuất hiện của tất cả các kỳ thủ trong PGN."""
    player_counts: Dict[str, int] = {}
    for g in games:
        w = g.get("white", "").strip()
        b = g.get("black", "").strip()
        if w and w != "Unknown White":
            player_counts[w] = player_counts.get(w, 0) + 1
        if b and b != "Unknown Black":
            player_counts[b] = player_counts.get(b, 0) + 1

    return dict(sorted(player_counts.items(), key=lambda item: item[1], reverse=True))


def detect_primary_player(games: List[Dict[str, Any]]) -> str:
    """Tự động xác định kỳ thủ chính (nhiều ván nhất)."""
    players = extract_players(games)
    if not players:
        return ""
    return next(iter(players.keys()))


def filter_games_by_player(
    games: List[Dict[str, Any]], player_name: str
) -> List[Dict[str, Any]]:
    """Lọc danh sách ván đấu của riêng kỳ thủ được chọn."""
    filtered = []
    player_name_clean = player_name.strip().lower()

    for g in games:
        w_clean = g.get("white", "").strip().lower()
        b_clean = g.get("black", "").strip().lower()

        if player_name_clean in w_clean:
            g_copy = dict(g)
            g_copy["player_color"] = "white"
            g_copy["opponent"] = g.get("black", "Unknown Black")
            filtered.append(g_copy)
        elif player_name_clean in b_clean:
            g_copy = dict(g)
            g_copy["player_color"] = "black"
            g_copy["opponent"] = g.get("white", "Unknown White")
            filtered.append(g_copy)

    return filtered
