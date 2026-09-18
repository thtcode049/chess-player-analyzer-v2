"""
Database Service Layer
----------------------
Thin wrapper around supabase-py for CRUD on Supabase PostgreSQL.
Uses SERVICE_ROLE key (bypass RLS) for server-side inserts from FastAPI.
"""
import os
import logging
from typing import List, Dict, Any, Optional
from supabase import create_client, Client

logger = logging.getLogger(__name__)

def get_supabase() -> Client:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise RuntimeError("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars")
    return create_client(url, key)


def normalize_name_words(text: str) -> set:
    import unicodedata
    import re
    text = unicodedata.normalize("NFD", text or "")
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = text.replace("đ", "d").replace("Đ", "d")
    text = re.sub(r"[^a-zA-Z0-9\s]", " ", text).lower()
    return set(w for w in text.split() if len(w) >= 2)


def determine_player_color(player_name: str, white: str, black: str) -> str:
    p_lower = (player_name or "").strip().lower()
    w_lower = (white or "").strip().lower()
    b_lower = (black or "").strip().lower()
    if p_lower and p_lower in w_lower:
        return "white"
    if p_lower and p_lower in b_lower:
        return "black"
    p_words = normalize_name_words(player_name)
    if not p_words:
        return "white"
    w_words = normalize_name_words(white)
    b_words = normalize_name_words(black)
    w_match = len(w_words & p_words)
    b_match = len(b_words & p_words)
    if w_match > b_match and w_match >= 1:
        return "white"
    if b_match > w_match and b_match >= 1:
        return "black"
    return "white"


class DBService:
    """
    Server-side DB operations using SERVICE_ROLE key (bypasses RLS).
    All mutations come through here so we can unit-test them easily.
    """

    @staticmethod
    def upsert_player(user_id: str, canonical_name: str, title: str = "") -> Dict[str, Any]:
        """
        Insert or return existing player by canonical_name for a given user.
        """
        sb = get_supabase()
        # Check if already exists
        existing = (
            sb.table("players")
            .select("*")
            .eq("user_id", user_id)
            .ilike("canonical_name", canonical_name)
            .limit(1)
            .execute()
        )
        if existing.data:
            return existing.data[0]

        res = (
            sb.table("players")
            .insert({
                "user_id": user_id,
                "canonical_name": canonical_name,
                "title": title or None,
            })
            .execute()
        )
        if not res.data:
            raise RuntimeError(f"Failed to insert player: {canonical_name}")
        return res.data[0]

    @staticmethod
    def create_dataset(player_id: str, source_type: str, source_identifier: str, games_count: int) -> Dict[str, Any]:
        sb = get_supabase()
        res = (
            sb.table("datasets")
            .insert({
                "player_id": player_id,
                "source_type": source_type,
                "source_identifier": source_identifier,
                "games_count": games_count,
            })
            .execute()
        )
        if not res.data:
            raise RuntimeError("Failed to create dataset")
        return res.data[0]

    @staticmethod
    def bulk_insert_games(games: List[Dict[str, Any]], dataset_id: str) -> int:
        """
        Insert a batch of normalized game dicts. Returns count inserted.
        Games must have dataset_id field set.
        """
        if not games:
            return 0

        sb = get_supabase()
        # Set correct dataset_id and remove None for played_at (Supabase rejects None differently)
        records = []
        for g in games:
            rec = dict(g)
            rec["dataset_id"] = dataset_id
            # Convert datetime to ISO string if needed
            if rec.get("played_at") and hasattr(rec["played_at"], "isoformat"):
                rec["played_at"] = rec["played_at"].isoformat()
            elif rec.get("played_at") is None:
                rec.pop("played_at", None)
            # Ensure raw_headers is dict not None
            if rec.get("raw_headers") is None:
                rec["raw_headers"] = {}
            records.append(rec)

        # Insert in batches of 100 to avoid payload limits
        inserted = 0
        batch_size = 100
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            res = sb.table("games").insert(batch).execute()
            inserted += len(res.data) if res.data else 0
        return inserted

    @staticmethod
    def get_players(user_id: str) -> List[Dict[str, Any]]:
        sb = get_supabase()
        res = (
            sb.table("players")
            .select("*, datasets(*)")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []

    @staticmethod
    def get_player(player_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        sb = get_supabase()
        res = (
            sb.table("players")
            .select("*")
            .eq("id", player_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    @staticmethod
    def get_games(dataset_id: str, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        sb = get_supabase()
        res = (
            sb.table("games")
            .select("*")
            .eq("dataset_id", dataset_id)
            .order("played_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return res.data or []

    @staticmethod
    def get_player_games(player_id: str, limit: int = 1000, offset: int = 0) -> List[Dict[str, Any]]:
        """Get all games for a player across all datasets."""
        try:
            sb = get_supabase()
            # Get all dataset_ids for player first
            ds_res = (
                sb.table("datasets")
                .select("id")
                .eq("player_id", player_id)
                .execute()
            )
            dataset_ids = [d["id"] for d in (ds_res.data or [])]
            if not dataset_ids:
                return []

            res = (
                sb.table("games")
                .select("*")
                .in_("dataset_id", dataset_ids)
                .order("played_at", desc=True, nullsfirst=False)
                .range(offset, offset + limit - 1)
                .execute()
            )
            return res.data or []
        except Exception as e:
            logger.warning(f"Failed to fetch games for player {player_id}: {e}")
            return []

    @staticmethod
    def get_all_players() -> List[Dict[str, Any]]:
        """Fetch all players across the database, ordered by creation date."""
        try:
            sb = get_supabase()
            res = (
                sb.table("players")
                .select("*, datasets(*)")
                .order("created_at", desc=True)
                .execute()
            )
            return res.data or []
        except Exception as e:
            logger.warning(f"Failed to fetch all players from DB: {e}")
            return []

    @staticmethod
    def get_game(game_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a single game by ID from DB."""
        try:
            sb = get_supabase()
            res = (
                sb.table("games")
                .select("*")
                .eq("id", game_id)
                .limit(1)
                .execute()
            )
            return res.data[0] if res.data else None
        except Exception as e:
            logger.warning(f"Failed to fetch game {game_id}: {e}")
            return None

    @staticmethod
    def convert_db_games_to_analysis_games(db_games: List[Dict[str, Any]], player_name: str) -> List[Dict[str, Any]]:
        """
        Converts DB games schema into the standard dictionary format required by src.analysis.
        """
        import re
        analysis_games = []

        for g in db_games:
            white = g.get("white_player", "White")
            black = g.get("black_player", "Black")
            color = determine_player_color(player_name, white, black)

            moves_raw = g.get("moves_san", "")
            if isinstance(moves_raw, str):
                tokens = moves_raw.split()
                clean_moves = []
                for t in tokens:
                    clean = re.sub(r"^\d+\.+", "", t).strip()
                    if clean and clean not in ["1-0", "0-1", "1/2-1/2", "*"]:
                        clean_moves.append(clean)
            elif isinstance(moves_raw, list):
                clean_moves = moves_raw
            else:
                clean_moves = []

            analysis_games.append({
                "id": g.get("id"),
                "white": white,
                "black": black,
                "white_elo": g.get("white_elo") or 0,
                "black_elo": g.get("black_elo") or 0,
                "result": g.get("result", "*"),
                "eco": g.get("eco", "A00"),
                "opening": g.get("opening_name", ""),
                "moves": clean_moves,
                "player_color": color,
                "date": str(g.get("played_at", "")),
                "site": g.get("site_url", "") or g.get("external_id", ""),
                "link": g.get("site_url", ""),
                "evaluations": g.get("evaluations", []) if g.get("has_embedded_eval") else []
            })
        return analysis_games

    @staticmethod
    def save_analysis_run(player_id: str, run_res: Dict[str, Any], run_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Persist a complete analytical snapshot into public.analysis_runs.
        """
        sb = get_supabase()
        record = {
            "player_id": player_id,
            "run_label": run_res.get("run_label", "Analytical Snapshot"),
            "scope_filter": run_res.get("scope_filter", {}),
            "games_analyzed_count": int(run_res.get("games_analyzed_count", 0)),
            "engine_status": str(run_res.get("engine_status", "statistical_only")),
            "engine_coverage_pct": float(run_res.get("engine_coverage_pct", 0.0)),
            "engine_games_count": int(run_res.get("engine_games_count", 0)),
            "engine_name": run_res.get("engine_name"),
            "engine_depth": run_res.get("engine_depth"),
            "overall_win_rate": float(run_res.get("overall_win_rate", 0.0)) if run_res.get("overall_win_rate") is not None else None,
            "overall_score": float(run_res.get("overall_score", 0.0)) if run_res.get("overall_score") is not None else None,
            "white_score": float(run_res.get("white_score", 0.0)) if run_res.get("white_score") is not None else None,
            "black_score": float(run_res.get("black_score", 0.0)) if run_res.get("black_score") is not None else None,
            "overall_acpl": float(run_res.get("overall_acpl")) if run_res.get("overall_acpl") is not None else None,
            "acpl_opening": float(run_res.get("acpl_opening")) if run_res.get("acpl_opening") is not None else None,
            "acpl_middlegame": float(run_res.get("acpl_middlegame")) if run_res.get("acpl_middlegame") is not None else None,
            "acpl_endgame": float(run_res.get("acpl_endgame")) if run_res.get("acpl_endgame") is not None else None,
            "dominant_archetype": run_res.get("dominant_archetype", "Universal Master"),
            "repertoire_summary": run_res.get("repertoire_summary", {}),
            "pawn_structures_summary": run_res.get("pawn_structures_summary", {}),
            "style_radar_metrics": run_res.get("style_radar_metrics", {}),
            "opening_tree_snapshot": run_res.get("opening_tree_snapshot", {})
        }
        if run_id:
            record["id"] = run_id

        res = sb.table("analysis_runs").insert(record).execute()
        if not res.data:
            raise RuntimeError(f"Failed to insert analysis run for player: {player_id}")
        return res.data[0]

    @staticmethod
    def get_analysis_run(run_id: str) -> Optional[Dict[str, Any]]:
        """Fetch analysis run by its UUID."""
        try:
            sb = get_supabase()
            res = sb.table("analysis_runs").select("*").eq("id", run_id).limit(1).execute()
            return res.data[0] if res.data else None
        except Exception as e:
            logger.warning(f"Failed to fetch analysis run {run_id}: {e}")
            return None

    @staticmethod
    def get_latest_analysis_run_for_player(player_id: str) -> Optional[Dict[str, Any]]:
        """Fetch latest analysis run for a player."""
        try:
            sb = get_supabase()
            res = (
                sb.table("analysis_runs")
                .select("*")
                .eq("player_id", player_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            return res.data[0] if res.data else None
        except Exception as e:
            logger.warning(f"Failed to fetch analysis run for player {player_id}: {e}")
            return None

