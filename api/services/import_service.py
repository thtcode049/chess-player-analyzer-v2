"""
Import Service Layer
--------------------
Handles PGN parsing, online game fetching (Lichess/Chess.com),
game normalization, and extraction of game records.
Directly reuses: src.pgn_parser, src.game_fetcher
"""
from typing import List, Dict, Any, Tuple, Optional
import io
import chess.pgn
from datetime import datetime

from src.pgn_parser import parse_pgn, detect_primary_player, extract_players, filter_games_by_player
from src.game_fetcher import fetch_lichess_games, fetch_chesscom_games
from src.engine.evaluator import get_comprehensive_move_evaluations

class ImportService:
    @staticmethod
    def parse_pgn_bytes(pgn_bytes: bytes, max_games: Optional[int] = None) -> Tuple[List[Dict[str, Any]], str, int]:
        """
        Parses raw PGN bytes into normalized game dictionaries.
        Returns: (games_list, detected_primary_player, total_parsed)
        """
        if not pgn_bytes:
            return [], "", 0
        
        raw_games = parse_pgn(pgn_bytes)
        if max_games and max_games > 0:
            raw_games = raw_games[:max_games]
            
        primary = detect_primary_player(raw_games) or ""
        return raw_games, primary, len(raw_games)

    @staticmethod
    def fetch_lichess(
        username: str,
        max_games: int = 50,
        perf_types: Optional[List[str]] = None,
        rated: Optional[bool] = None,
        token: Optional[str] = None,
        since: Optional[int] = None,
        until: Optional[int] = None
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """
        Fetches games from Lichess Explorer API.
        Returns: (games_list, error_message)
        """
        pgn_bytes, err = fetch_lichess_games(
            username=username,
            max_games=max_games,
            perf_types=perf_types or ["blitz", "rapid", "bullet"],
            rated=rated,
            token=token,
            since=since,
            until=until
        )
        if err or not pgn_bytes:
            return [], err or "No games found from Lichess"
            
        raw_games = parse_pgn(pgn_bytes)
        if max_games and len(raw_games) > max_games:
            raw_games = raw_games[:max_games]
        return raw_games, None

    @staticmethod
    def fetch_chesscom(
        username: str,
        max_games: int = 50,
        perf_types: Optional[List[str]] = None,
        rated: Optional[bool] = None,
        since: Optional[int] = None,
        until: Optional[int] = None
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """
        Fetches games from Chess.com Public API.
        Returns: (games_list, error_message)
        """
        pgn_bytes, err = fetch_chesscom_games(
            username=username,
            max_games=max_games,
            perf_types=perf_types or ["blitz", "rapid", "bullet"],
            rated=rated,
            since=since,
            until=until
        )
        if err or not pgn_bytes:
            return [], err or "No games found from Chess.com"
            
        raw_games = parse_pgn(pgn_bytes)
        if max_games and len(raw_games) > max_games:
            raw_games = raw_games[:max_games]
        return raw_games, None

    @staticmethod
    def normalize_game_for_db(raw_game: Dict[str, Any], dataset_id: str) -> Dict[str, Any]:
        """
        Converts a parsed game dict from src.pgn_parser into the exact DB schema format for public.games.
        """
        headers = raw_game.get("headers", {})
        moves_list = raw_game.get("moves", [])
        
        # Build moves_san string e.g. "1.e4 c5 2.Nf3 d6..."
        moves_san_parts = []
        for i, move in enumerate(moves_list):
            if i % 2 == 0:
                moves_san_parts.append(f"{(i // 2) + 1}.{move}")
            else:
                moves_san_parts.append(f"{move}")
        moves_san_str = " ".join(moves_san_parts) if moves_san_parts else " ".join(moves_list)

        # Check for embedded [%eval] in moves or raw headers
        has_embedded_eval = bool(raw_game.get("evaluations") or "[%eval" in str(raw_game.get("raw_pgn", "")))

        # Parse date & time safely
        headers = raw_game.get("headers", {})
        date_str = str(raw_game.get("date") or headers.get("Date") or headers.get("UTCDate") or "").strip()
        time_str = str(raw_game.get("time") or headers.get("Time") or headers.get("UTCTime") or "").strip()
        played_at = None
        if date_str and date_str not in ["????.??.??", "?", "????-??-??"]:
            clean_date = date_str.replace("?", "01").replace(".", "-")
            if time_str and time_str not in ["?", "??:??:??"]:
                try:
                    played_at = datetime.fromisoformat(f"{clean_date}T{time_str}")
                except Exception:
                    pass
            if not played_at:
                try:
                    played_at = datetime.fromisoformat(clean_date)
                except Exception:
                    played_at = None

        # Enrich raw_headers
        if date_str and "Date" not in headers:
            headers["Date"] = date_str
        if raw_game.get("event") and "Event" not in headers:
            headers["Event"] = raw_game["event"]
        if raw_game.get("site") and "Site" not in headers:
            headers["Site"] = raw_game["site"]
        link_cand = raw_game.get("link") or headers.get("Link")
        if link_cand and "Link" not in headers:
            headers["Link"] = link_cand
        if raw_game.get("round") and "Round" not in headers:
            headers["Round"] = raw_game["round"]
        tc = raw_game.get("time_control") or headers.get("TimeControl")
        if tc and "TimeControl" not in headers:
            headers["TimeControl"] = tc

        site_url = link_cand or (raw_game.get("site", "") if str(raw_game.get("site", "")).startswith("http") else None)

        return {
            "dataset_id": dataset_id,
            "external_id": raw_game.get("site", "") or raw_game.get("link", ""),
            "site_url": site_url,
            "played_at": played_at,
            "white_player": raw_game.get("white", "White"),
            "black_player": raw_game.get("black", "Black"),
            "white_elo": int(raw_game.get("white_elo")) if raw_game.get("white_elo") and str(raw_game.get("white_elo")).isdigit() else None,
            "black_elo": int(raw_game.get("black_elo")) if raw_game.get("black_elo") and str(raw_game.get("black_elo")).isdigit() else None,
            "result": raw_game.get("result", "*"),
            "eco": raw_game.get("eco", "A00"),
            "opening_name": raw_game.get("opening", "Unknown Opening"),
            "time_control": headers.get("TimeControl", ""),
            "ply_count": len(moves_list),
            "moves_san": moves_san_str,
            "raw_headers": headers,
            "has_embedded_eval": has_embedded_eval
        }
