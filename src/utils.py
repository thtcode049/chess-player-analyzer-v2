"""
Utils Module
Chức năng: Chứa các hàm hỗ trợ chung (xử lý chuỗi, định dạng số liệu, đọc ghi file).
"""

from typing import Any, Dict, List, Literal, Tuple
import re
import unicodedata


PlayerColor = Literal["white", "black"]
PLAYER_COLOR_HEADER = "_chesslook_player_color"

_CORRUPTED_CHAR_RE = re.compile(r"[?\ufffd]")
_PUNCT_SEP_RE = re.compile(r"[,._/|+*\\-]+")
_VIQR_MARK_RE = re.compile(r"\\?[~`'^]")


def exact_player_name(name: str | None) -> str:
    return unicodedata.normalize("NFC", (name or "").strip())


def _normalize_token_ascii(token: str) -> str:
    s = unicodedata.normalize("NFD", token.replace("đ", "d").replace("Đ", "d"))
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return s.lower()


def _tokenize_name_ascii(name: str) -> List[str]:
    nfc = _VIQR_MARK_RE.sub("", exact_player_name(name))
    cleaned = _PUNCT_SEP_RE.sub(" ", nfc)
    return [_normalize_token_ascii(tok) for tok in cleaned.split() if tok]


def _has_name_artifacts(name: str) -> bool:
    return bool(_CORRUPTED_CHAR_RE.search(name) or _VIQR_MARK_RE.search(name))


def _token_matches(tok_a: str, tok_b: str) -> bool:
    if tok_a == tok_b:
        return True
    a_corrupt = "?" in tok_a or "\ufffd" in tok_a
    b_corrupt = "?" in tok_b or "\ufffd" in tok_b
    if not a_corrupt and not b_corrupt:
        return False
    for corrupt_tok, target_tok in ((tok_a, tok_b), (tok_b, tok_a)):
        if "?" not in corrupt_tok and "\ufffd" not in corrupt_tok:
            continue
        stripped = _CORRUPTED_CHAR_RE.sub("", corrupt_tok)
        target_clean = _CORRUPTED_CHAR_RE.sub("", target_tok)
        if len(stripped) >= 2 and stripped == target_clean:
            return True
        if len(corrupt_tok) == len(target_tok) and len(stripped) >= 2:
            if all(
                ca == cb or ca in ("?", "\ufffd") or cb in ("?", "\ufffd")
                for ca, cb in zip(corrupt_tok, target_tok)
            ):
                return True
    return False


def _tokens_match(tokens_a: List[str], tokens_b: List[str]) -> bool:
    if not tokens_a or len(tokens_a) != len(tokens_b):
        return False
    return all(_token_matches(ta, tb) for ta, tb in zip(tokens_a, tokens_b))


def _variant_display_priority(name: str, count: int) -> Tuple[int, int, int, int, int, str]:
    """Rank variant quality: uncorrupted first, no trailing punct, mixed case, highest count."""
    has_broken = 1 if _has_name_artifacts(name) else 0
    trailing_punct = 1 if name.endswith((",", ";", ".")) else 0
    is_mono_case = 1 if (any(c.isalpha() for c in name) and (name.isupper() or name.islower())) else 0
    has_non_ascii = 1 if any(ord(c) > 127 for c in name) else 0
    return (
        has_broken,
        trailing_punct,
        is_mono_case,
        -count,
        -has_non_ascii,
        name.casefold(),
    )


def cluster_pgn_player_variants(counts: Dict[str, List[int]]) -> List[Dict[str, Any]]:
    """
    Gom cụm các biến thể tên cùng một kỳ thủ trong bước PGN preview
    (ví dụ 'Bui, Vinh' / 'Bui Vinh,' / 'BUI, Vinh' hay 'Vu, Bui Thi Thanh Van' / 'Vu, Bùi Th? Thanh Vân'),
    trong khi vẫn giữ tách biệt các tên sạch khác nhau ('Nguyễn An' vs 'Nguyễn Anh').
    """
    entries = [
        {
            "raw": raw,
            "white": w,
            "black": b,
            "total": w + b,
            "tokens": _tokenize_name_ascii(raw),
            "broken": _has_name_artifacts(raw),
        }
        for raw, (w, b) in counts.items()
        if w + b > 0
    ]
    entries.sort(key=lambda e: (1 if e["broken"] else 0, -e["total"], e["raw"].casefold()))

    clusters: List[Dict[str, Any]] = []
    exact_key_map: Dict[Tuple[str, ...], Dict[str, Any]] = {}

    for entry in entries:
        tokens = entry["tokens"]
        tok_tuple = tuple(tokens)
        has_wild = any("?" in t or "\ufffd" in t for t in tokens)
        target_cluster = exact_key_map.get(tok_tuple) if not has_wild else None

        if target_cluster is None:
            for cluster in clusters:
                if _tokens_match(tokens, cluster["anchor_tokens"]):
                    target_cluster = cluster
                    break

        if target_cluster is None:
            target_cluster = {
                "anchor_tokens": tokens,
                "variants": [],
                "white": 0,
                "black": 0,
            }
            clusters.append(target_cluster)
            if tok_tuple and not has_wild:
                exact_key_map[tok_tuple] = target_cluster

        target_cluster["variants"].append((entry["raw"], entry["total"]))
        target_cluster["white"] += entry["white"]
        target_cluster["black"] += entry["black"]

    result: List[Dict[str, Any]] = []
    for cluster in clusters:
        variants_sorted = sorted(
            cluster["variants"],
            key=lambda item: _variant_display_priority(item[0], item[1]),
        )
        canonical = variants_sorted[0][0]
        aliases = [v[0] for v in variants_sorted]
        white = cluster["white"]
        black = cluster["black"]
        result.append({
            "name": canonical,
            "aliases": aliases,
            "gameCount": white + black,
            "whiteCount": white,
            "blackCount": black,
        })

    result.sort(key=lambda p: (-p["gameCount"], p["name"].casefold()))
    return result


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

