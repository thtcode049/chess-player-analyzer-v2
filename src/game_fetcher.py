"""
Online Player Games Fetcher (Lichess & Chess.com)
--------------------------------------------------
Chức năng: Tải lịch sử ván đấu trực tiếp từ tài khoản Lichess hoặc Chess.com API
tương tự như openingtree.com.
"""

import urllib.request
import urllib.parse
import json
from typing import Tuple, Optional, List, Dict, Any


def _normalize_lichess_perf_types(perf_types: Optional[List[str]]) -> Optional[str]:
    """Map selection strings to Lichess perfType API parameters."""
    if not perf_types:
        return None
    
    mapping = {
        "bullet": "bullet",
        "blitz": "blitz",
        "rapid": "rapid",
        "classical": "classical",
        "daily": "correspondence",
        "correspondence": "correspondence",
        "daily / correspondence": "correspondence",
        "ultrabullet": "ultraBullet",
    }
    
    selected = set()
    for pt in perf_types:
        key = str(pt).strip().lower()
        if key in mapping:
            selected.add(mapping[key])
        else:
            selected.add(key)
            
    return ",".join(sorted(selected)) if selected else None


def _normalize_chesscom_time_classes(perf_types: Optional[List[str]]) -> Optional[set]:
    """Map selection strings to Chess.com time_class values."""
    if not perf_types:
        return None
    
    target_set = set()
    for pt in perf_types:
        key = str(pt).strip().lower()
        if key in ("bullet", "ultrabullet"):
            target_set.add("bullet")
        elif key == "blitz":
            target_set.add("blitz")
        elif key == "rapid":
            target_set.add("rapid")
        elif key == "classical":
            target_set.add("rapid")
            target_set.add("classical")
        elif key in ("daily", "correspondence", "daily / correspondence"):
            target_set.add("daily")
        else:
            target_set.add(key)
            
    return target_set if target_set else None


def fetch_lichess_games(
    username: str,
    max_games: int = 100,
    perf_types: Optional[List[str]] = None,
    rated: Optional[bool] = None,
    token: Optional[str] = None
) -> Tuple[Optional[bytes], Optional[str]]:
    """
    Tải PGN ván đấu từ Lichess API với đầy đủ thông tin (Opening, Evals, Clocks, Accuracy).
    Endpoint: https://lichess.org/api/games/user/{username}
    """
    clean_user = username.strip()
    if not clean_user:
        return None, "Tên tài khoản Lichess không được để trống."

    url = f"https://lichess.org/api/games/user/{urllib.parse.quote(clean_user)}?max={max_games}&opening=true&evals=true&clocks=true&accuracy=true"
    perf_param = _normalize_lichess_perf_types(perf_types)
    if perf_param:
        url += f"&perfType={urllib.parse.quote(perf_param)}"
    if rated is not None:
        url += f"&rated={'true' if rated else 'false'}"
    
    headers = {
        "Accept": "application/x-chess-pgn",
        "User-Agent": "ChessOpponentAnalyzer/1.0"
    }
    if token and token.strip():
        headers["Authorization"] = f"Bearer {token.strip()}"

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 200:
                raw_bytes = resp.read()
                if not raw_bytes or len(raw_bytes.strip()) == 0:
                    return None, f"Không tìm thấy ván đấu nào cho tài khoản Lichess '{clean_user}'."
                return raw_bytes, None
            else:
                return None, f"Lichess API trả về mã lỗi HTTP {resp.status}."
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None, f"Tài khoản Lichess '{clean_user}' không tồn tại."
        return None, f"Lỗi Lichess API (HTTP {e.code}): {e.reason}"
    except Exception as e:
        return None, f"Không thể kết nối tới Lichess: {e}"


def fetch_chesscom_games(
    username: str,
    max_games: int = 100,
    perf_types: Optional[List[str]] = None,
    rated: Optional[bool] = None
) -> Tuple[Optional[bytes], Optional[str]]:
    """
    Tải PGN ván đấu từ Chess.com API.
    1. Lấy danh sách Monthly Archives: https://api.chess.com/pub/player/{username}/games/archives
    2. Duyệt tuần tự từ tháng gần nhất trở về trước để thu thập đủ số ván đấu yêu cầu.
    """
    clean_user = username.strip().lower()
    if not clean_user:
        return None, "Tên tài khoản Chess.com không được để trống."

    archives_url = f"https://api.chess.com/pub/player/{urllib.parse.quote(clean_user)}/games/archives"
    headers = {
        "User-Agent": "ChessOpponentAnalyzer/1.0 (contact: admin@example.com)"
    }

    allowed_time_classes = _normalize_chesscom_time_classes(perf_types)

    try:
        req = urllib.request.Request(archives_url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status != 200:
                return None, f"Chess.com API trả về mã lỗi HTTP {resp.status}."
            data = json.loads(resp.read().decode('utf-8'))
            archives = data.get("archives", [])

        if not archives:
            return None, f"Không tìm thấy ván đấu lưu trữ nào cho tài khoản Chess.com '{clean_user}'."

        # Duyệt từ tháng gần nhất trở về trước để thu thập đủ max_games
        pgn_list = []
        games_collected = 0

        for archive_url in reversed(archives):
            if games_collected >= max_games:
                break
            
            archive_req = urllib.request.Request(archive_url, headers=headers)
            with urllib.request.urlopen(archive_req, timeout=10) as a_resp:
                if a_resp.status == 200:
                    month_data = json.loads(a_resp.read().decode('utf-8'))
                    month_games = month_data.get("games", [])
                    for g in reversed(month_games):
                        if "pgn" in g:
                            if allowed_time_classes is not None:
                                time_class = g.get("time_class", "").lower()
                                if time_class not in allowed_time_classes:
                                    continue
                            if rated is not None:
                                is_game_rated = g.get("rated", True)
                                if is_game_rated != rated:
                                    continue
                            raw_pgn = g["pgn"]
                            game_url = g.get("url", "").strip()
                            if game_url and "[Link " not in raw_pgn:
                                raw_pgn = f'[Link "{game_url}"]\n' + raw_pgn
                            pgn_list.append(raw_pgn)
                            games_collected += 1
                            if games_collected >= max_games:
                                break

        if not pgn_list:
            return None, f"Không tìm thấy dữ liệu PGN hợp lệ cho '{clean_user}' trên Chess.com."

        combined_pgn = "\n\n".join(pgn_list).encode('utf-8')
        return combined_pgn, None

    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None, f"Tài khoản Chess.com '{clean_user}' không tồn tại."
        return None, f"Lỗi Chess.com API (HTTP {e.code}): {e.reason}"
    except Exception as e:
        return None, f"Không thể kết nối tới Chess.com: {e}"
