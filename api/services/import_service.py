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
        token: Optional[str] = None
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
            token=token
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
        rated: Optional[bool] = None
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """
        Fetches games from Chess.com Public API.
        Returns: (games_list, error_message)
        """
        pgn_bytes, err = fetch_chesscom_games(
            username=username,
            max_games=max_games,
            perf_types=perf_types or ["blitz", "rapid", "bullet"],
            rated=rated
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

        # Parse date safely
        date_str = raw_game.get("date", "")
        played_at = None
        if date_str and date_str not in ["????.??.??", "?"]:
            try:
                clean_date = date_str.replace("?", "01").replace(".", "-")
                played_at = datetime.fromisoformat(clean_date)
            except Exception:
                played_at = None

        return {
            "dataset_id": dataset_id,
            "external_id": raw_game.get("site", ""),
            "site_url": raw_game.get("link", "") or (raw_game.get("site", "") if str(raw_game.get("site", "")).startswith("http") else None),
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
