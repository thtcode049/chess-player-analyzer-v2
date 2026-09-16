"""
PGN Parser Module
-----------------
Chức năng: Đọc và parse các ván đấu cờ vua từ nguồn PGN (Stream/File/String).
Trích xuất thông tin người chơi, kết quả, hệ thống khai cuộc (ECO/Opening), và danh sách nước đi (SAN).
Tự động suy luận tên khai cuộc từ các nước đi nếu file PGN không có tag [Opening].
"""

import io
from pathlib import Path
from typing import List, Dict, Any, Union, Tuple, Optional
import chess.pgn

# Bảng tra cứu suy luận Khai cuộc (Opening Heuristic Lookup) dựa trên các nước đi đầu tiên
OPENING_LOOKUP: List[Tuple[Tuple[str, ...], str, str]] = [
    (("e4", "c5"), "B20", "Sicilian Defense"),
    (("e4", "e5", "Nf3", "Nc6", "Bb5"), "C60", "Ruy Lopez"),
    (("e4", "e5", "Nf3", "Nc6", "Bc4"), "C50", "Italian Game"),
    (("e4", "e5", "Nf3", "Nc6", "d4"), "C44", "Scotch Game"),
    (("e4", "e5", "Nf3", "Nc6"), "C40", "King's Pawn Game (Four Knights)"),
    (("e4", "e5", "Nf3", "Nf6"), "C42", "Petrov's Defense"),
    (("e4", "e5", "Nf3"), "C40", "King's Knight Opening"),
    (("e4", "e5", "f4"), "C23", "King's Gambit"),
    (("e4", "e5", "Nc3"), "C25", "Vienna Game"),
    (("e4", "e5"), "C20", "King's Pawn Game"),
    (("e4", "e6", "d4", "d5"), "C00", "French Defense"),
    (("e4", "e6"), "C00", "French Defense"),
    (("e4", "c6", "d4", "d5"), "B10", "Caro-Kann Defense"),
    (("e4", "c6"), "B10", "Caro-Kann Defense"),
    (("e4", "d5"), "B01", "Scandinavian Defense"),
    (("e4", "g6"), "B06", "Modern Defense"),
    (("e4", "Nf6"), "B02", "Alekhine's Defense"),
    (("e4", "d6"), "B07", "Pirc Defense"),
    (("d4", "Nf6", "c4", "e6", "Nf3"), "E10", "Queen's Indian Defense"),
    (("d4", "Nf6", "c4", "e6", "Nc3"), "E20", "Nimzo-Indian Defense"),
    (("d4", "Nf6", "c4", "g6"), "E60", "King's Indian Defense"),
    (("d4", "Nf6", "c4", "c5"), "A56", "Benoni Defense"),
    (("d4", "Nf6", "c4"), "A45", "Indian Defense"),
    (("d4", "Nf6", "Bg5"), "A45", "Trompowsky Attack"),
    (("d4", "Nf6", "Bf4"), "A45", "London System"),
    (("d4", "Nf6"), "A45", "Indian Defense"),
    (("d4", "d5", "c4", "e6"), "D30", "Queen's Gambit Declined"),
    (("d4", "d5", "c4", "c6"), "D10", "Slav Defense"),
    (("d4", "d5", "c4", "dxc4"), "D20", "Queen's Gambit Accepted"),
    (("d4", "d5", "c4"), "D06", "Queen's Gambit"),
    (("d4", "d5", "Bf4"), "D00", "London System"),
    (("d4", "d5", "Nf3"), "D02", "Queen's Pawn Game"),
    (("d4", "d5"), "D00", "Queen's Pawn Game"),
    (("d4", "f5"), "A80", "Dutch Defense"),
    (("c4", "e5"), "A20", "English Opening (Reversed Sicilian)"),
    (("c4", "c5"), "A30", "English Opening (Symmetrical)"),
    (("c4", "Nf6"), "A15", "English Opening"),
    (("c4",), "A10", "English Opening"),
    (("Nf3", "d5"), "A06", "Reti Opening"),
    (("Nf3", "Nf6"), "A04", "Zukertort Opening"),
    (("Nf3",), "A04", "Zukertort Opening"),
    (("g3",), "A00", "Hungarian Opening"),
    (("b3",), "A00", "Nimzo-Larsen Attack"),
    (("f4",), "A02", "Bird's Opening"),
    (("b4",), "A00", "Sokolsky (Polish) Opening"),
]


def infer_opening_from_moves(moves: List[str]) -> Tuple[str, str]:
    """
    Suy luận mã ECO và tên Khai cuộc dựa trên các nước đi SAN đầu tiên nếu PGN thiếu tag [Opening].
    """
    if not moves:
        return ("", "Unknown Opening")
    moves_tuple = tuple(moves)
    for prefix, eco, name in OPENING_LOOKUP:
        if moves_tuple[: len(prefix)] == prefix:
            return (eco, name)

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
