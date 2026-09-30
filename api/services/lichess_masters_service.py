"""
Lichess Masters Opening Explorer Service
-----------------------------------------
Fetches official master-level game statistics (2.5M+ OTB FIDE master games) directly from
the Lichess Master Explorer API (https://explorer.lichess.ovh/masters).

Authentication:
- Fully supports Lichess OAuth 2.0 PKCE Bearer tokens and Personal Access Tokens (PAT).
- Once authorized (from Import or Opening Tree), the token is used for live, authentic queries.
- Fast in-memory caching prevents redundant calls for identical FEN positions.
"""
import os
import logging
import urllib.request
import urllib.parse
import urllib.error
import json
from typing import Dict, Any, List, Optional
from src.utils import normalize_fen

logger = logging.getLogger(__name__)

MASTERS_CACHE: Dict[str, Dict[str, Any]] = {}


class LichessMastersService:
    @staticmethod
    def get_masters_continuations(
        fen: str,
        user_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Retrieves official master continuations for a given FEN position directly from Lichess.
        Uses in-memory cache and live Lichess Explorer API queries.
        Requires an authorized Lichess OAuth token or Personal Access Token.
        """
        norm_key = normalize_fen(fen)

        # 1. Check in-memory session cache for this FEN
        if norm_key in MASTERS_CACHE:
            return MASTERS_CACHE[norm_key]

        # 2. Resolve token (passed in header/query or environment)
        token = (
            user_token
            or os.environ.get("LICHESS_API_TOKEN")
            or os.environ.get("LICHESS_TOKEN")
            or ""
        ).strip()

        # Both OAuth access tokens and Personal Access Tokens are valid bearer tokens
        is_valid_token = bool(token and len(token) >= 10)

        if not is_valid_token:
            return {
                "authenticated": False,
                "total_games": 0,
                "moves": [],
                "top_games": [],
                "is_book": False,
                "message": "Chưa kết nối tài khoản Lichess. Vui lòng bấm 'Ủy quyền Lichess' để xem dữ liệu Kiện tướng quốc tế."
            }

        # 3. Query official Lichess Masters Explorer API
        try:
            encoded_fen = urllib.parse.quote(fen)
            url = f"https://explorer.lichess.ovh/masters?fen={encoded_fen}&moves=15&topGames=15"
            req = urllib.request.Request(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "User-Agent": "ChessPlayerAnalyzer/2.0 (contact: admin@localhost)",
                    "Accept": "application/json"
                }
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    raw_data = json.loads(resp.read().decode("utf-8"))
                    w_tot = raw_data.get("white", 0)
                    d_tot = raw_data.get("draws", 0)
                    b_tot = raw_data.get("black", 0)
                    total_g = w_tot + d_tot + b_tot

                    parsed_moves: List[Dict[str, Any]] = []
                    for m in raw_data.get("moves", []):
                        mw = m.get("white", 0)
                        md = m.get("draws", 0)
                        mb = m.get("black", 0)
                        mg = mw + md + mb
                        if mg == 0:
                            continue
                        parsed_moves.append({
                            "san": m.get("san", ""),
                            "uci": m.get("uci", ""),
                            "games_count": mg,
                            "white": mw,
                            "draws": md,
                            "black": mb,
                            "win_pct": round((mw / mg) * 100, 1),
                            "draw_pct": round((md / mg) * 100, 1),
                            "loss_pct": round((mb / mg) * 100, 1),
                            "score_pct": round(((mw + 0.5 * md) / mg) * 100, 1),
                            "average_rating": m.get("averageRating")
                        })

                    # Parse top master games (Các ván đấu hàng đầu)
                    raw_top_games = raw_data.get("topGames", []) or []
                    parsed_top_games: List[Dict[str, Any]] = []
                    for g in raw_top_games:
                        w_obj = g.get("white") or {}
                        b_obj = g.get("black") or {}
                        winner = g.get("winner")
                        res_str = "1-0" if winner == "white" else "0-1" if winner == "black" else "½-½"
                        parsed_top_games.append({
                            "id": str(g.get("id") or ""),
                            "white": {
                                "name": w_obj.get("name") or "Unknown White",
                                "rating": w_obj.get("rating")
                            },
                            "black": {
                                "name": b_obj.get("name") or "Unknown Black",
                                "rating": b_obj.get("rating")
                            },
                            "year": g.get("year"),
                            "month": g.get("month"),
                            "winner": winner,
                            "result": res_str,
                            "uci": g.get("uci")
                        })

                    result = {
                        "authenticated": True,
                        "total_games": total_g,
                        "moves": parsed_moves,
                        "top_games": parsed_top_games,
                        "is_book": False,
                        "message": None
                    }
                    MASTERS_CACHE[norm_key] = result
                    return result
        except urllib.error.HTTPError as e:
            if e.code == 401:
                logger.warning("[Lichess Masters API] Token unauthorized / expired (401)")
                return {
                    "authenticated": False,
                    "total_games": 0,
                    "moves": [],
                    "top_games": [],
                    "is_book": False,
                    "message": "Phiên ủy quyền Lichess đã hết hạn hoặc token không hợp lệ. Vui lòng ủy quyền lại."
                }
            elif e.code == 429:
                logger.warning("[Lichess Masters API] Rate limit reached (429)")
                return {
                    "authenticated": True,
                    "total_games": 0,
                    "moves": [],
                    "top_games": [],
                    "is_book": False,
                    "message": "Đang chạm ngưỡng giới hạn truy vấn Lichess. Vui lòng chờ vài giây."
                }
            else:
                logger.warning(f"[Lichess Masters API] HTTP error {e.code}: {e.reason}")
        except Exception as e:
            logger.warning(f"[Lichess Masters API] Connection failure: {e}")

        return {
            "authenticated": True,
            "total_games": 0,
            "moves": [],
            "top_games": [],
            "is_book": False,
            "message": "Không thể kết nối đến Lichess Master Explorer lúc này."
        }

    @staticmethod
    def get_master_game(game_id: str) -> Dict[str, Any]:
        """
        Fetches full game details and SAN move sequence from Lichess export API.
        """
        clean_id = (game_id or "").strip()
        if not clean_id:
            raise ValueError("Mã ván đấu không hợp lệ.")

        url = f"https://lichess.org/game/export/{clean_id}?moves=true&tags=true&clocks=false&evals=false"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "ChessPlayerAnalyzer/2.0 (contact: admin@localhost)",
                "Accept": "application/json"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    players = data.get("players", {}) or {}
                    w_player = players.get("white", {}) or {}
                    b_player = players.get("black", {}) or {}

                    w_name = (
                        w_player.get("user", {}).get("name")
                        if isinstance(w_player.get("user"), dict)
                        else w_player.get("name") or "Trắng"
                    )
                    b_name = (
                        b_player.get("user", {}).get("name")
                        if isinstance(b_player.get("user"), dict)
                        else b_player.get("name") or "Đen"
                    )
                    w_elo = w_player.get("rating")
                    b_elo = b_player.get("rating")

                    winner = data.get("winner")
                    result = (
                        "1-0"
                        if winner == "white"
                        else "0-1"
                        if winner == "black"
                        else "½-½"
                    )

                    raw_moves = data.get("moves", "")
                    moves_list = [m for m in raw_moves.split() if m]
                    opening_info = data.get("opening", {}) or {}

                    return {
                        "id": data.get("id", clean_id),
                        "white": w_name,
                        "white_elo": w_elo,
                        "black": b_name,
                        "black_elo": b_elo,
                        "result": result,
                        "moves": moves_list,
                        "moves_san": raw_moves,
                        "event": data.get("event") or opening_info.get("name") or "Lichess Master Game",
                        "date": str(data.get("createdAt") or data.get("lastMoveAt") or ""),
                        "site": f"https://lichess.org/{clean_id}",
                        "eco": opening_info.get("eco", ""),
                        "opening": opening_info.get("name", ""),
                    }
                else:
                    raise ValueError(f"Lichess trả về mã lỗi HTTP {resp.status}")
        except Exception as e:
            logger.warning(f"[Lichess Master Game Export] Lỗi khi tải ván đấu {clean_id}: {e}")
            raise ValueError(f"Không thể tải chi tiết ván đấu từ Lichess: {e}")
