"""
Import Route Handlers (PGN Upload, Lichess, Chess.com)
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Header
from typing import Optional, List
from datetime import datetime
import uuid
import logging
import json
import urllib.request
import urllib.parse
import urllib.error

from api.schemas.common import BaseResponse
from api.schemas.imports import (
    LichessImportRequest,
    ChesscomImportRequest,
    ImportSummaryResponse,
    LichessOAuthTokenRequest,
    LichessVerifyTokenRequest,
    LichessAuthResponse
)
from api.services.import_service import ImportService
from api.services.db_service import DBService, determine_player_color, normalize_name_words, get_game_fingerprint
from api.routes.players import PLAYERS_STORE, GAMES_STORE, get_guest_session


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/import", tags=["Imports"])


def _get_user_id_from_header(x_user_id: Optional[str] = Header(None)) -> Optional[str]:
    """Extract user_id passed from frontend via X-User-Id header."""
    return x_user_id


@router.post("/pgn-file", response_model=BaseResponse[ImportSummaryResponse])
async def import_pgn_file(
    file: UploadFile = File(...),
    player_id: Optional[str] = Form(None),
    player_name: Optional[str] = Form(None),
    alias_names: Optional[str] = Form(None),
    max_games: Optional[int] = Form(1000),
    user_id: Optional[str] = Form(None),
    x_user_id: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None),
):
    """
    Parses an uploaded .pgn file, saves player/dataset/games to Supabase if logged in,
    and always maintains fast in-memory session.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty PGN file uploaded")

        raw_games, primary_player, total_found = ImportService.parse_pgn_bytes(content, max_games=max_games)

        if not raw_games:
            raise HTTPException(status_code=400, detail="No valid games found in PGN file")

        dataset_id = str(uuid.uuid4())
        final_player_name = player_name or primary_player or file.filename or "Unknown Player"

        effective_user_id = user_id or x_user_id
        actual_player_id = player_id

        # 1. Resolve or reuse existing player
        existing_player = None
        if actual_player_id:
            if effective_user_id:
                try:
                    existing_player = DBService.get_player(actual_player_id, effective_user_id)
                except Exception as e:
                    logger.warning(f"[Import PGN] Could not fetch player {actual_player_id}: {e}")
            if not existing_player:
                session = get_guest_session(x_guest_session_id)
                existing_player = session.get("players", {}).get(actual_player_id)
            if not existing_player:
                existing_player = PLAYERS_STORE.get(actual_player_id)

            if existing_player:
                final_player_name = existing_player.get("canonical_name") or final_player_name
        else:
            p_lower = final_player_name.strip().lower()
            if effective_user_id:
                try:
                    player_rec = DBService.upsert_player(
                        user_id=effective_user_id,
                        canonical_name=final_player_name,
                    )
                    actual_player_id = player_rec["id"]
                except Exception as db_err:
                    logger.warning(f"[Import PGN] DB player lookup error: {db_err}")

            if not actual_player_id:
                for pid, p in PLAYERS_STORE.items():
                    if p.get("canonical_name", "").strip().lower() == p_lower:
                        actual_player_id = pid
                        break

            if not actual_player_id:
                actual_player_id = str(uuid.uuid4())

        # Clean up any duplicate keys in PLAYERS_STORE for this player name
        p_lower = final_player_name.strip().lower()
        for pid in list(PLAYERS_STORE.keys()):
            if pid != actual_player_id and PLAYERS_STORE[pid].get("canonical_name", "").strip().lower() == p_lower:
                del PLAYERS_STORE[pid]
                if pid in GAMES_STORE:
                    del GAMES_STORE[pid]

        # Prepare aliases list for fuzzy/variant matching
        alias_list = [final_player_name.lower().strip()]
        if alias_names:
            try:
                parsed_aliases = json.loads(alias_names)
                if isinstance(parsed_aliases, list):
                    alias_list.extend([str(a).lower().strip() for a in parsed_aliases if a])
            except Exception:
                alias_list.extend([a.lower().strip() for a in alias_names.split(",") if a.strip()])
        alias_set = set(alias_list)
        p_words = normalize_name_words(final_player_name)

        def matches_target_player(player_str: str) -> bool:
            if not player_str:
                return False
            low = player_str.strip().lower()
            if any(a in low or low in a for a in alias_set):
                return True
            w_words = normalize_name_words(player_str)
            if p_words and len(w_words & p_words) >= max(2, int(len(p_words) * 0.6)):
                return True
            return False

        # Prepare player games with correct player_color, merging all name variants
        if player_name or alias_names:
            matched_games = [
                g for g in raw_games
                if matches_target_player(g.get("white", "")) or matches_target_player(g.get("black", ""))
            ]
            player_games = matched_games if matched_games else raw_games
        else:
            player_games = raw_games

        for g in player_games:
            w_match = matches_target_player(g.get("white", ""))
            b_match = matches_target_player(g.get("black", ""))
            if w_match and not b_match:
                g["player_color"] = "white"
            elif b_match and not w_match:
                g["player_color"] = "black"
            else:
                g["player_color"] = determine_player_color(final_player_name, g.get("white", ""), g.get("black", ""))

        # --- Deduplication Against Existing Player Games ---
        existing_games: List[Dict[str, Any]] = []
        if effective_user_id and actual_player_id:
            try:
                existing_games = DBService.get_player_games(actual_player_id, limit=None)
            except Exception as e:
                logger.warning(f"[Import PGN] Could not fetch existing games from DB for dedup: {e}")

        if not existing_games and actual_player_id in GAMES_STORE:
            existing_games = GAMES_STORE[actual_player_id]
        if not existing_games:
            session = get_guest_session(x_guest_session_id)
            existing_games = session.get("games", {}).get(actual_player_id, [])

        existing_fps = {get_game_fingerprint(g) for g in existing_games}
        new_unique_games = []
        seen_in_batch = set()

        for g in player_games:
            fp = get_game_fingerprint(g)
            if fp in existing_fps or fp in seen_in_batch:
                continue
            seen_in_batch.add(fp)
            new_unique_games.append(g)

        skipped_count = len(player_games) - len(new_unique_games)
        logger.info(f"[Import PGN] Dedup: Total={len(player_games)}, New={len(new_unique_games)}, Skipped={skipped_count}")

        # Combine all unique games
        all_combined_games = existing_games + new_unique_games
        db_games = []

        # --- Persist new unique games to Supabase if user is logged in ---
        if effective_user_id:
            try:
                if new_unique_games:
                    dataset_rec = DBService.create_dataset(
                        player_id=actual_player_id,
                        source_type="pgn_upload",
                        source_identifier=file.filename or "upload.pgn",
                        games_count=len(new_unique_games),
                    )
                    dataset_id = dataset_rec["id"]

                    # Normalize with correct dataset_id from DB
                    db_games = [ImportService.normalize_game_for_db(g, dataset_id=dataset_id) for g in new_unique_games]
                    inserted = DBService.bulk_insert_games(db_games, dataset_id=dataset_id)
                    logger.info(f"[Import PGN] Saved {inserted}/{len(new_unique_games)} new unique games to Supabase (skipped {skipped_count} duplicates)")

                # Update total games count for player
                DBService.update_player(actual_player_id, {"total_games": len(all_combined_games)})
            except Exception as db_err:
                logger.error(f"[Import PGN] DB save error: {db_err}")
        else:
            logger.info(f"[Import PGN] Guest mode — {len(new_unique_games)} new games cached in session (skipped {skipped_count} duplicates)")
            session = get_guest_session(x_guest_session_id)
            session["players"][actual_player_id] = {
                "id": actual_player_id,
                "user_id": "guest",
                "canonical_name": final_player_name,
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
                "total_games": len(all_combined_games)
            }
            session["games"][actual_player_id] = all_combined_games
            db_games = [ImportService.normalize_game_for_db(g, dataset_id=dataset_id) for g in new_unique_games]

        # --- In-Memory Session & Analysis Pre-computation (Fast interactive session) ---
        PLAYERS_STORE[actual_player_id] = {
            "id": actual_player_id,
            "user_id": effective_user_id or "guest",
            "canonical_name": final_player_name,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "total_games": len(all_combined_games)
        }
        GAMES_STORE[actual_player_id] = all_combined_games

        run_id = str(uuid.uuid4())
        try:
            from api.routes.analyses import RUN_SNAPSHOTS_CACHE
            from api.services.analysis_service import AnalysisService
            from src.opening_tree import build_opening_tree

            run_res = AnalysisService.run_complete_analysis(
                games=all_combined_games,
                player_name=final_player_name,
                color_filter="all",
                run_label=f"Hồ sơ {final_player_name}"
            )
            _, fm_all = build_opening_tree(all_combined_games, color="all")
            _, fm_w = build_opening_tree(all_combined_games, color="white")
            _, fm_b = build_opening_tree(all_combined_games, color="black")
            run_res["fen_map_all"] = fm_all
            run_res["fen_map_white"] = fm_w
            run_res["fen_map_black"] = fm_b
            run_res["player_name"] = final_player_name
            run_res["player_id"] = actual_player_id
            run_res["run_id"] = run_id

            RUN_SNAPSHOTS_CACHE[run_id] = run_res
            RUN_SNAPSHOTS_CACHE[actual_player_id] = run_res

            # Persist analysis run to Supabase ONLY if logged in
            if effective_user_id:
                try:
                    DBService.save_analysis_run(actual_player_id, run_res, run_id=run_id)
                    logger.info(f"[Import PGN] Persisted analysis run {run_id} to Supabase")
                except Exception as save_err:
                    logger.warning(f"[Import PGN] Could not persist analysis run: {save_err}")
            else:
                session = get_guest_session(x_guest_session_id)
                session["runs"][run_id] = run_res
                session["runs"][actual_player_id] = run_res

            logger.info(f"[Import PGN] Auto-analyzed {len(all_combined_games)} games for {final_player_name}, run_id={run_id}")
        except Exception as an_err:
            logger.warning(f"[Import PGN] Auto-analysis error: {an_err}")

        summary = ImportSummaryResponse(
            dataset_id=dataset_id,
            player_id=actual_player_id,
            run_id=run_id,
            total_found=total_found,
            imported_count=len(new_unique_games),
            skipped_count=skipped_count,
            primary_player=final_player_name,
            source_type="pgn_upload",
            sample_games=db_games[:5] if db_games else [ImportService.normalize_game_for_db(g, dataset_id="existing") for g in all_combined_games[:5]]
        )
        msg = (
            f"Đã nạp {len(new_unique_games)} ván mới thành công! (Tự động loại bỏ {skipped_count} ván trùng lặp)"
            if skipped_count > 0 else
            f"Đã nạp thành công toàn bộ {len(new_unique_games)} ván đấu"
        )
        return BaseResponse(success=True, message=msg, data=summary)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Import] Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process PGN: {str(e)})")


@router.post("/lichess", response_model=BaseResponse[ImportSummaryResponse])
async def import_lichess(
    req: LichessImportRequest,
    x_user_id: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None)
):
    """
    Fetches games from Lichess Explorer API for a specific username.
    Saves to Supabase DB if user is logged in, and always keeps in-memory session.
    """
    try:
        raw_games, err = ImportService.fetch_lichess(
            username=req.username,
            max_games=req.max_games,
            perf_types=req.perf_types,
            rated=req.rated_only,
            token=req.token,
            since=req.since,
            until=req.until
        )
        if err:
            raise HTTPException(status_code=400, detail=err)

        effective_user_id = req.user_id or x_user_id
        target_player_id = req.player_id
        u_name = req.username.strip()
        u_lower = u_name.lower()
        player_display_name = u_name
        dataset_id = str(uuid.uuid4())

        # 1. Resolve or reuse existing player
        existing_player = None
        if target_player_id:
            if effective_user_id:
                try:
                    existing_player = DBService.get_player(target_player_id, effective_user_id)
                except Exception as e:
                    logger.warning(f"[Import Lichess] Could not fetch player {target_player_id}: {e}")
            if not existing_player:
                session = get_guest_session(x_guest_session_id)
                existing_player = session.get("players", {}).get(target_player_id)
            if not existing_player:
                existing_player = PLAYERS_STORE.get(target_player_id)

            if existing_player:
                player_display_name = existing_player.get("canonical_name") or u_name
        else:
            if effective_user_id:
                try:
                    player_rec = DBService.upsert_player(
                        user_id=effective_user_id,
                        canonical_name=u_name,
                    )
                    target_player_id = player_rec["id"]
                except Exception as db_err:
                    logger.warning(f"[Import Lichess] DB player lookup error: {db_err}")

            if not target_player_id:
                for pid, p in PLAYERS_STORE.items():
                    if p.get("canonical_name", "").strip().lower() == u_lower:
                        target_player_id = pid
                        break

            if not target_player_id:
                target_player_id = str(uuid.uuid4())

        # Clean up any duplicate keys in PLAYERS_STORE for this player name
        for pid in list(PLAYERS_STORE.keys()):
            if pid != target_player_id and PLAYERS_STORE[pid].get("canonical_name", "").strip().lower() == u_lower:
                del PLAYERS_STORE[pid]
                if pid in GAMES_STORE:
                    del GAMES_STORE[pid]

        # Tag player color using Lichess username
        for g in raw_games:
            if u_lower in g.get("white", "").lower():
                g["player_color"] = "white"
            elif u_lower in g.get("black", "").lower():
                g["player_color"] = "black"
            else:
                g["player_color"] = "white"

        # --- Deduplication Against Existing Player Games ---
        existing_games: List[Dict[str, Any]] = []
        if effective_user_id and target_player_id:
            try:
                existing_games = DBService.get_player_games(target_player_id, limit=None)
            except Exception as e:
                logger.warning(f"[Import Lichess] Could not fetch existing games from DB for dedup: {e}")

        if not existing_games and target_player_id in GAMES_STORE:
            existing_games = GAMES_STORE[target_player_id]
        if not existing_games:
            session = get_guest_session(x_guest_session_id)
            existing_games = session.get("games", {}).get(target_player_id, [])

        existing_fps = {get_game_fingerprint(g) for g in existing_games}
        new_unique_games = []
        seen_in_batch = set()

        for g in raw_games:
            fp = get_game_fingerprint(g)
            if fp in existing_fps or fp in seen_in_batch:
                continue
            seen_in_batch.add(fp)
            new_unique_games.append(g)

        skipped_count = len(raw_games) - len(new_unique_games)
        logger.info(f"[Import Lichess] Dedup: Total={len(raw_games)}, New={len(new_unique_games)}, Skipped={skipped_count}")

        all_combined_games = existing_games + new_unique_games
        db_games = []

        # --- Persist new unique games to Supabase if logged in ---
        if effective_user_id:
            try:
                if new_unique_games:
                    dataset_rec = DBService.create_dataset(
                        player_id=target_player_id,
                        source_type="lichess",
                        source_identifier=u_name,
                        games_count=len(new_unique_games),
                    )
                    dataset_id = dataset_rec["id"]

                    db_games = [ImportService.normalize_game_for_db(g, dataset_id=dataset_id) for g in new_unique_games]
                    inserted = DBService.bulk_insert_games(db_games, dataset_id=dataset_id)
                    logger.info(f"[Import Lichess] Saved {inserted}/{len(new_unique_games)} new games to Supabase (skipped {skipped_count} duplicates)")

                DBService.update_player(target_player_id, {"total_games": len(all_combined_games)})
            except Exception as db_err:
                logger.error(f"[Import Lichess] DB save error: {db_err}")
        else:
            logger.info(f"[Import Lichess] Guest mode — {len(new_unique_games)} new games cached (skipped {skipped_count} duplicates)")
            session = get_guest_session(x_guest_session_id)
            session["players"][target_player_id] = {
                "id": target_player_id,
                "user_id": "guest",
                "canonical_name": player_display_name,
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
                "total_games": len(all_combined_games)
            }
            session["games"][target_player_id] = all_combined_games
            db_games = [ImportService.normalize_game_for_db(g, dataset_id=dataset_id) for g in new_unique_games]

        PLAYERS_STORE[target_player_id] = {
            "id": target_player_id,
            "user_id": effective_user_id or "guest",
            "canonical_name": player_display_name,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "total_games": len(all_combined_games)
        }
        GAMES_STORE[target_player_id] = all_combined_games

        run_id = str(uuid.uuid4())
        try:
            from api.routes.analyses import RUN_SNAPSHOTS_CACHE
            from api.services.analysis_service import AnalysisService
            from src.opening_tree import build_opening_tree

            run_res = AnalysisService.run_complete_analysis(
                games=all_combined_games,
                player_name=player_display_name,
                color_filter="all",
                run_label=f"Hồ sơ {player_display_name}"
            )
            _, fm_all = build_opening_tree(all_combined_games, color="all")
            _, fm_w = build_opening_tree(all_combined_games, color="white")
            _, fm_b = build_opening_tree(all_combined_games, color="black")
            run_res["fen_map_all"] = fm_all
            run_res["fen_map_white"] = fm_w
            run_res["fen_map_black"] = fm_b
            run_res["player_name"] = player_display_name
            run_res["player_id"] = target_player_id
            run_res["run_id"] = run_id

            RUN_SNAPSHOTS_CACHE[run_id] = run_res
            RUN_SNAPSHOTS_CACHE[target_player_id] = run_res

            # Persist analysis run to Supabase ONLY if logged in
            if effective_user_id:
                try:
                    DBService.save_analysis_run(target_player_id, run_res, run_id=run_id)
                    logger.info(f"[Import Lichess] Persisted analysis run {run_id} to Supabase")
                except Exception as save_err:
                    logger.warning(f"[Import Lichess] Could not persist analysis run: {save_err}")
            else:
                session = get_guest_session(x_guest_session_id)
                session["runs"][run_id] = run_res
                session["runs"][target_player_id] = run_res
        except Exception as an_err:
            logger.warning(f"[Import Lichess] Auto-analysis error: {an_err}")

        summary = ImportSummaryResponse(
            dataset_id=dataset_id,
            player_id=target_player_id,
            run_id=run_id,
            total_found=len(raw_games),
            imported_count=len(new_unique_games),
            skipped_count=skipped_count,
            primary_player=player_display_name,
            source_type="lichess",
            sample_games=db_games[:5] if db_games else [ImportService.normalize_game_for_db(g, dataset_id="existing") for g in all_combined_games[:5]]
        )
        msg = (
            f"Đã nạp {len(new_unique_games)} ván mới thành công từ Lichess! (Tự động loại bỏ {skipped_count} ván trùng lặp)"
            if skipped_count > 0 else
            f"Đã nạp thành công toàn bộ {len(new_unique_games)} ván từ Lichess"
        )
        return BaseResponse(success=True, message=msg, data=summary)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lichess sync error: {str(e)}")


@router.post("/chesscom", response_model=BaseResponse[ImportSummaryResponse])
async def import_chesscom(
    req: ChesscomImportRequest,
    x_user_id: Optional[str] = Header(None),
    x_guest_session_id: Optional[str] = Header(None)
):
    """
    Fetches games from Chess.com Public API for a specific username.
    Saves to Supabase DB if user is logged in, and always keeps in-memory session.
    """
    try:
        raw_games, err = ImportService.fetch_chesscom(
            username=req.username,
            max_games=req.max_games,
            perf_types=req.perf_types,
            rated=req.rated_only,
            since=req.since,
            until=req.until
        )
        if err:
            raise HTTPException(status_code=400, detail=err)

        effective_user_id = req.user_id or x_user_id
        target_player_id = req.player_id
        u_name = req.username.strip()
        u_lower = u_name.lower()
        player_display_name = u_name
        dataset_id = str(uuid.uuid4())

        # 1. Resolve or reuse existing player
        existing_player = None
        if target_player_id:
            if effective_user_id:
                try:
                    existing_player = DBService.get_player(target_player_id, effective_user_id)
                except Exception as e:
                    logger.warning(f"[Import Chess.com] Could not fetch player {target_player_id}: {e}")
            if not existing_player:
                session = get_guest_session(x_guest_session_id)
                existing_player = session.get("players", {}).get(target_player_id)
            if not existing_player:
                existing_player = PLAYERS_STORE.get(target_player_id)

            if existing_player:
                player_display_name = existing_player.get("canonical_name") or u_name
        else:
            if effective_user_id:
                try:
                    player_rec = DBService.upsert_player(
                        user_id=effective_user_id,
                        canonical_name=u_name,
                    )
                    target_player_id = player_rec["id"]
                except Exception as db_err:
                    logger.warning(f"[Import Chess.com] DB player lookup error: {db_err}")

            if not target_player_id:
                for pid, p in PLAYERS_STORE.items():
                    if p.get("canonical_name", "").strip().lower() == u_lower:
                        target_player_id = pid
                        break

            if not target_player_id:
                target_player_id = str(uuid.uuid4())

        # Clean up any duplicate keys in PLAYERS_STORE for this player name
        for pid in list(PLAYERS_STORE.keys()):
            if pid != target_player_id and PLAYERS_STORE[pid].get("canonical_name", "").strip().lower() == u_lower:
                del PLAYERS_STORE[pid]
                if pid in GAMES_STORE:
                    del GAMES_STORE[pid]

        # Tag player color using Chess.com username
        for g in raw_games:
            if u_lower in g.get("white", "").lower():
                g["player_color"] = "white"
            elif u_lower in g.get("black", "").lower():
                g["player_color"] = "black"
            else:
                g["player_color"] = "white"

        # --- Deduplication Against Existing Player Games ---
        existing_games: List[Dict[str, Any]] = []
        if effective_user_id and target_player_id:
            try:
                existing_games = DBService.get_player_games(target_player_id, limit=None)
            except Exception as e:
                logger.warning(f"[Import Chess.com] Could not fetch existing games from DB for dedup: {e}")

        if not existing_games and target_player_id in GAMES_STORE:
            existing_games = GAMES_STORE[target_player_id]
        if not existing_games:
            session = get_guest_session(x_guest_session_id)
            existing_games = session.get("games", {}).get(target_player_id, [])

        existing_fps = {get_game_fingerprint(g) for g in existing_games}
        new_unique_games = []
        seen_in_batch = set()

        for g in raw_games:
            fp = get_game_fingerprint(g)
            if fp in existing_fps or fp in seen_in_batch:
                continue
            seen_in_batch.add(fp)
            new_unique_games.append(g)

        skipped_count = len(raw_games) - len(new_unique_games)
        logger.info(f"[Import Chess.com] Dedup: Total={len(raw_games)}, New={len(new_unique_games)}, Skipped={skipped_count}")

        all_combined_games = existing_games + new_unique_games
        db_games = []

        # --- Persist new unique games to Supabase if logged in ---
        if effective_user_id:
            try:
                if new_unique_games:
                    dataset_rec = DBService.create_dataset(
                        player_id=target_player_id,
                        source_type="chesscom",
                        source_identifier=u_name,
                        games_count=len(new_unique_games),
                    )
                    dataset_id = dataset_rec["id"]

                    db_games = [ImportService.normalize_game_for_db(g, dataset_id=dataset_id) for g in new_unique_games]
                    inserted = DBService.bulk_insert_games(db_games, dataset_id=dataset_id)
                    logger.info(f"[Import Chess.com] Saved {inserted}/{len(new_unique_games)} new games to Supabase (skipped {skipped_count} duplicates)")

                DBService.update_player(target_player_id, {"total_games": len(all_combined_games)})
            except Exception as db_err:
                logger.error(f"[Import Chess.com] DB save error: {db_err}")
        else:
            logger.info(f"[Import Chess.com] Guest mode — {len(new_unique_games)} new games cached (skipped {skipped_count} duplicates)")
            session = get_guest_session(x_guest_session_id)
            session["players"][target_player_id] = {
                "id": target_player_id,
                "user_id": "guest",
                "canonical_name": player_display_name,
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
                "total_games": len(all_combined_games)
            }
            session["games"][target_player_id] = all_combined_games
            db_games = [ImportService.normalize_game_for_db(g, dataset_id=dataset_id) for g in new_unique_games]

        PLAYERS_STORE[target_player_id] = {
            "id": target_player_id,
            "user_id": effective_user_id or "guest",
            "canonical_name": player_display_name,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "total_games": len(all_combined_games)
        }
        GAMES_STORE[target_player_id] = all_combined_games

        run_id = str(uuid.uuid4())
        try:
            from api.routes.analyses import RUN_SNAPSHOTS_CACHE
            from api.services.analysis_service import AnalysisService
            from src.opening_tree import build_opening_tree

            run_res = AnalysisService.run_complete_analysis(
                games=all_combined_games,
                player_name=player_display_name,
                color_filter="all",
                run_label=f"Chess.com: {player_display_name}"
            )
            _, fm_all = build_opening_tree(all_combined_games, color="all")
            _, fm_w = build_opening_tree(all_combined_games, color="white")
            _, fm_b = build_opening_tree(all_combined_games, color="black")
            run_res["fen_map_all"] = fm_all
            run_res["fen_map_white"] = fm_w
            run_res["fen_map_black"] = fm_b
            run_res["player_name"] = player_display_name
            run_res["player_id"] = target_player_id
            run_res["run_id"] = run_id

            RUN_SNAPSHOTS_CACHE[run_id] = run_res
            RUN_SNAPSHOTS_CACHE[target_player_id] = run_res

            # Persist analysis run to Supabase ONLY if logged in
            if effective_user_id:
                try:
                    DBService.save_analysis_run(target_player_id, run_res, run_id=run_id)
                    logger.info(f"[Import Chess.com] Persisted analysis run {run_id} to Supabase")
                except Exception as save_err:
                    logger.warning(f"[Import Chess.com] Could not persist analysis run: {save_err}")
            else:
                session = get_guest_session(x_guest_session_id)
                session["runs"][run_id] = run_res
                session["runs"][target_player_id] = run_res
        except Exception as an_err:
            logger.warning(f"[Import Chess.com] Auto-analysis error: {an_err}")

        summary = ImportSummaryResponse(
            dataset_id=dataset_id,
            player_id=target_player_id,
            run_id=run_id,
            total_found=len(raw_games),
            imported_count=len(new_unique_games),
            skipped_count=skipped_count,
            primary_player=player_display_name,
            source_type="chesscom",
            sample_games=db_games[:5] if db_games else [ImportService.normalize_game_for_db(g, dataset_id="existing") for g in all_combined_games[:5]]
        )
        msg = (
            f"Đã nạp {len(new_unique_games)} ván mới thành công từ Chess.com! (Tự động loại bỏ {skipped_count} ván trùng lặp)"
            if skipped_count > 0 else
            f"Đã nạp thành công toàn bộ {len(new_unique_games)} ván từ Chess.com"
        )
        return BaseResponse(success=True, message=msg, data=summary)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chess.com sync error: {str(e)}")


@router.post("/lichess/oauth-token", response_model=BaseResponse[LichessAuthResponse])
async def exchange_lichess_oauth(req: LichessOAuthTokenRequest):
    """
    Exchanges PKCE authorization code for Lichess access token and fetches account details.
    """
    try:
        url = "https://lichess.org/api/token"
        payload = urllib.parse.urlencode({
            "grant_type": "authorization_code",
            "code": req.code,
            "code_verifier": req.code_verifier,
            "redirect_uri": req.redirect_uri,
            "client_id": req.client_id or "chess-player-analyzer"
        }).encode("utf-8")

        post_req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "ChessPlayerAnalyzer (contact: admin@localhost)"
            },
            method="POST"
        )
        with urllib.request.urlopen(post_req, timeout=15) as resp:
            token_data = json.loads(resp.read().decode("utf-8"))

        access_token = token_data.get("access_token")
        if not access_token:
            return BaseResponse(
                success=False,
                message="Không thể nhận access token từ Lichess",
                data=LichessAuthResponse(valid=False, error="No access token returned")
            )

        # Fetch username from /api/account
        username = None
        acc_req = urllib.request.Request(
            "https://lichess.org/api/account",
            headers={
                "Authorization": f"Bearer {access_token}",
                "User-Agent": "ChessPlayerAnalyzer"
            }
        )
        try:
            with urllib.request.urlopen(acc_req, timeout=10) as acc_resp:
                acc_data = json.loads(acc_resp.read().decode("utf-8"))
                username = acc_data.get("username")
        except Exception as e:
            logger.warning(f"Could not retrieve Lichess username: {e}")

        return BaseResponse(
            success=True,
            message="Ủy quyền Lichess thành công!",
            data=LichessAuthResponse(
                access_token=access_token,
                username=username,
                valid=True
            )
        )
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8") if e.fp else str(e)
        logger.error(f"[Lichess OAuth] HTTP Error {e.code}: {err_msg}")
        return BaseResponse(
            success=False,
            message=f"Lỗi xác thực Lichess ({e.code}): {err_msg}",
            data=LichessAuthResponse(valid=False, error=err_msg)
        )
    except Exception as e:
        logger.error(f"[Lichess OAuth] Exception: {e}")
        return BaseResponse(
            success=False,
            message=f"Lỗi kết nối tới Lichess: {str(e)}",
            data=LichessAuthResponse(valid=False, error=str(e))
        )


@router.post("/lichess/verify-token", response_model=BaseResponse[LichessAuthResponse])
async def verify_lichess_token(req: LichessVerifyTokenRequest):
    """
    Verifies a Lichess Personal Access Token or OAuth token and retrieves the account username.
    """
    token = req.token.strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token không được để trống")
    try:
        acc_req = urllib.request.Request(
            "https://lichess.org/api/account",
            headers={
                "Authorization": f"Bearer {token}",
                "User-Agent": "ChessPlayerAnalyzer"
            }
        )
        with urllib.request.urlopen(acc_req, timeout=10) as acc_resp:
            acc_data = json.loads(acc_resp.read().decode("utf-8"))
            username = acc_data.get("username")

        return BaseResponse(
            success=True,
            message=f"Token hợp lệ! Tài khoản: {username}",
            data=LichessAuthResponse(
                access_token=token,
                username=username,
                valid=True
            )
        )
    except urllib.error.HTTPError as e:
        return BaseResponse(
            success=False,
            message="Token không hợp lệ hoặc đã hết hạn",
            data=LichessAuthResponse(valid=False, error=f"HTTP {e.code}")
        )
    except Exception as e:
        return BaseResponse(
            success=False,
            message=f"Lỗi kiểm tra token: {str(e)}",
            data=LichessAuthResponse(valid=False, error=str(e))
        )
