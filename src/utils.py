"""
Utils Module
Chức năng: Chứa các hàm hỗ trợ chung (xử lý chuỗi, định dạng số liệu, đọc ghi file).
"""

from typing import Any, Literal, Tuple
import unicodedata


PlayerColor = Literal["white", "black"]
PLAYER_COLOR_HEADER = "_chesslook_player_color"


def exact_player_name(name: str | None) -> str:
    return unicodedata.normalize("NFC", (name or "").strip())


def determine_player_color(player_name: str, white: str, black: str) -> PlayerColor | None:
    name = exact_player_name(player_name)
    if not name:
        return None
    white_matches = exact_player_name(white) == name
    black_matches = exact_player_name(black) == name
    if white_matches == black_matches:
        return None
    return "white" if white_matches else "black"


def resolve_game_player_color(game: dict[str, Any], player_name: str = "") -> PlayerColor | None:
    color = game.get("player_color")
    if color in ("white", "black"):
        return color
    headers = game.get("raw_headers") or {}
    color = headers.get(PLAYER_COLOR_HEADER)
    if color in ("white", "black"):
        return color
    return determine_player_color(
        player_name,
        game.get("white_player") or game.get("white", ""),
        game.get("black_player") or game.get("black", ""),
    )


def format_percentage(value: float) -> str:
    """Định dạng tỷ lệ phần trăm."""
    return f"{value:.1f}%"


def determine_game_outcome(player_color: str, result: str) -> Tuple[bool, bool, bool]:
    """
    Xác định kết quả ván đấu (is_win, is_draw, is_loss) từ góc nhìn của player_color.
    Chuẩn hóa kết quả loại bỏ khoảng trắng và hỗ trợ các định dạng PGN khác nhau.

    Returns:
        Tuple[bool, bool, bool]: (is_win, is_draw, is_loss)
    """
    res = str(result).strip().replace(" ", "")
    color = str(player_color).strip().lower()

    if res in ["1/2-1/2", "1/2", "0.5-0.5", "½-½", "1/2:1/2"]:
        return False, True, False

    if color == "white":
        if res == "1-0":
            return True, False, False
        elif res == "0-1":
            return False, False, True
    elif color == "black":
        if res == "0-1":
            return True, False, False
        elif res == "1-0":
            return False, False, True

    return False, False, False


def normalize_fen(fen: str) -> str:
    """
    Chuẩn hóa FEN thành EPD key (4 trường đầu: pieces, turn, castling, en-passant)
    để hỗ trợ tra cứu thế cờ bất kể số nước đi hay halfmove clock (Transposition-safe).
    """
    parts = fen.strip().split()
    if len(parts) >= 4:
        return " ".join(parts[:4])
    return fen.strip()

