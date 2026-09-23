"""
Import Route Handlers (PGN Upload, Lichess, Chess.com)
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Header
from typing import Optional, List
from datetime import datetime
import uuid
import logging

from api.schemas.common import BaseResponse
from api.schemas.imports import LichessImportRequest, ChesscomImportRequest, ImportSummaryResponse
from api.services.import_service import ImportService
from api.services.db_service import DBService, determine_player_color
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
    max_games: Optional[int] = Form(200),
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
        db_games = [ImportService.normalize_game_for_db(g, dataset_id=dataset_id) for g in raw_games]
        final_player_name = primary_player or file.filename or "Unknown Player"

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

        # Prepare player games with correct player_color
        player_games = [
            g for g in raw_games
            if determine_player_color(final_player_name, g.get("white", ""), g.get("black", "")) in ("white", "black")
            and (final_player_name.lower().strip() in g.get("white", "").lower() or final_player_name.lower().strip() in g.get("black", "").lower() or len(raw_games) < 500)
        ]
        if not player_games:
            player_games = raw_games

        for g in player_games:
            g["player_color"] = determine_player_color(final_player_name, g.get("white", ""), g.get("black", ""))

        # --- Persist to Supabase if user is logged in ---
        if effective_user_id:
            try:
                dataset_rec = DBService.create_dataset(
                    player_id=actual_player_id,
                    source_type="pgn_upload",
                    source_identifier=file.filename or "upload.pgn",
                    games_count=len(db_games),
                )
                dataset_id = dataset_rec["id"]

                # Re-normalize with correct dataset_id from DB
                db_games = [ImportService.normalize_game_for_db(g, dataset_id=dataset_id) for g in raw_games]
                inserted = DBService.bulk_insert_games(db_games, dataset_id=dataset_id)
                logger.info(f"[Import PGN] Saved {inserted}/{len(db_games)} games to Supabase for user={effective_user_id}")
            except Exception as db_err:
                logger.error(f"[Import PGN] DB save error: {db_err}")
        else:
            logger.info("[Import PGN] Guest mode (no user_id) — games cached in session memory only")
            session = get_guest_session(x_guest_session_id)
            session["players"][actual_player_id] = {
                "id": actual_player_id,
                "user_id": "guest",
                "canonical_name": final_player_name,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            curr_guest_games = session.get("games", {}).get(actual_player_id, [])
            session["games"][actual_player_id] = curr_guest_games + player_games

        # --- In-Memory Session & Analysis Pre-computation (Fast interactive session) ---
        PLAYERS_STORE[actual_player_id] = {
            "id": actual_player_id,
            "user_id": effective_user_id or "guest",
            "canonical_name": final_player_name,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }

        curr_store_games = GAMES_STORE.get(actual_player_id, [])
        all_combined_games = curr_store_games + player_games
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
            imported_count=len(db_games),
            primary_player=final_player_name,
            source_type="pgn_upload",
            sample_games=db_games[:5]
        )
        return BaseResponse(success=True, message=f"Successfully imported {len(db_games)} games", data=summary)
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
            rated=req.rated_only
        )
        if err:
            raise HTTPException(status_code=400, detail=err)

        effective_user_id = req.user_id or x_user_id
        target_player_id = req.player_id
        u_name = req.username.strip()
        u_lower = u_name.lower()
        player_display_name = u_name

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

        dataset_id = str(uuid.uuid4())
        db_games = [ImportService.normalize_game_for_db(g, dataset_id=dataset_id) for g in raw_games]

        # --- Persist to Supabase if logged in ---
        if effective_user_id:
            try:
                dataset_rec = DBService.create_dataset(
                    player_id=target_player_id,
                    source_type="lichess",
                    source_identifier=u_name,
                    games_count=len(db_games),
                )
                dataset_id = dataset_rec["id"]

                db_games = [ImportService.normalize_game_for_db(g, dataset_id=dataset_id) for g in raw_games]
                inserted = DBService.bulk_insert_games(db_games, dataset_id=dataset_id)
                logger.info(f"[Import Lichess] Saved {inserted}/{len(db_games)} games to Supabase for user={effective_user_id}")
            except Exception as db_err:
                logger.error(f"[Import Lichess] DB save error: {db_err}")
        else:
            logger.info("[Import Lichess] Guest mode (no user_id) — cached in session memory only")
            session = get_guest_session(x_guest_session_id)
            session["players"][target_player_id] = {
                "id": target_player_id,
                "user_id": "guest",
                "canonical_name": player_display_name,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            curr_guest_games = session.get("games", {}).get(target_player_id, [])
            session["games"][target_player_id] = curr_guest_games + raw_games

        PLAYERS_STORE[target_player_id] = {
            "id": target_player_id,
            "user_id": effective_user_id or "guest",
            "canonical_name": player_display_name,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }

        # Tag player color using Lichess username
        for g in raw_games:
            if u_lower in g.get("white", "").lower():
                g["player_color"] = "white"
            elif u_lower in g.get("black", "").lower():
                g["player_color"] = "black"
            else:
                g["player_color"] = "white"

        curr_store_games = GAMES_STORE.get(target_player_id, [])
        all_combined_games = curr_store_games + raw_games
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
            imported_count=len(db_games),
            primary_player=player_display_name,
            source_type="lichess",
            sample_games=db_games[:5]
        )
        return BaseResponse(success=True, message=f"Fetched {len(db_games)} games from Lichess into {player_display_name}", data=summary)
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
            rated=req.rated_only
        )
        if err:
            raise HTTPException(status_code=400, detail=err)

        effective_user_id = req.user_id or x_user_id
        target_player_id = req.player_id
        u_name = req.username.strip()
        u_lower = u_name.lower()
        player_display_name = u_name

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

        dataset_id = str(uuid.uuid4())
        db_games = [ImportService.normalize_game_for_db(g, dataset_id=dataset_id) for g in raw_games]

        # --- Persist to Supabase if logged in ---
        if effective_user_id:
            try:
                dataset_rec = DBService.create_dataset(
                    player_id=target_player_id,
                    source_type="chesscom",
                    source_identifier=u_name,
                    games_count=len(db_games),
                )
                dataset_id = dataset_rec["id"]

                db_games = [ImportService.normalize_game_for_db(g, dataset_id=dataset_id) for g in raw_games]
                inserted = DBService.bulk_insert_games(db_games, dataset_id=dataset_id)
                logger.info(f"[Import Chess.com] Saved {inserted}/{len(db_games)} games to Supabase for user={effective_user_id}")
            except Exception as db_err:
                logger.error(f"[Import Chess.com] DB save error: {db_err}")
        else:
            logger.info("[Import Chess.com] Guest mode (no user_id) — cached in session memory only")
            session = get_guest_session(x_guest_session_id)
            session["players"][target_player_id] = {
                "id": target_player_id,
                "user_id": "guest",
                "canonical_name": player_display_name,
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
            curr_guest_games = session.get("games", {}).get(target_player_id, [])
            session["games"][target_player_id] = curr_guest_games + raw_games

        PLAYERS_STORE[target_player_id] = {
            "id": target_player_id,
            "user_id": effective_user_id or "guest",
            "canonical_name": player_display_name,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }

        # Tag player color using Chess.com username
        for g in raw_games:
            if u_lower in g.get("white", "").lower():
                g["player_color"] = "white"
            elif u_lower in g.get("black", "").lower():
                g["player_color"] = "black"
            else:
                g["player_color"] = "white"

        curr_store_games = GAMES_STORE.get(target_player_id, [])
        all_combined_games = curr_store_games + raw_games
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
            imported_count=len(db_games),
            primary_player=player_display_name,
            source_type="chesscom",
            sample_games=db_games[:5]
        )
        return BaseResponse(success=True, message=f"Fetched {len(db_games)} games from Chess.com into {player_display_name}", data=summary)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chess.com sync error: {str(e)}")
