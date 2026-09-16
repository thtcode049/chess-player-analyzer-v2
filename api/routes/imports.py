"""
Import Route Handlers (PGN Upload, Lichess, Chess.com)
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Optional, List
import uuid

from api.schemas.common import BaseResponse
from api.schemas.imports import LichessImportRequest, ChesscomImportRequest, ImportSummaryResponse
from api.services.import_service import ImportService

router = APIRouter(prefix="/api/import", tags=["Imports"])

@router.post("/pgn-file", response_model=BaseResponse[ImportSummaryResponse])
async def import_pgn_file(
    file: UploadFile = File(...),
    player_id: Optional[str] = Form(None),
    max_games: Optional[int] = Form(200)
):
    """
    Parses an uploaded .pgn file, identifies player, and returns normalized games summary.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty PGN file uploaded")

        raw_games, primary_player, total_found = ImportService.parse_pgn_bytes(content, max_games=max_games)
        
        target_player_id = player_id or str(uuid.uuid4())
        dataset_id = str(uuid.uuid4())

        # Normalize games for DB
        db_games = [ImportService.normalize_game_for_db(g, dataset_id=dataset_id) for g in raw_games]

        summary = ImportSummaryResponse(
            dataset_id=dataset_id,
            player_id=target_player_id,
            total_found=total_found,
            imported_count=len(db_games),
            primary_player=primary_player or "Unknown",
            source_type="pgn_upload",
            sample_games=db_games[:5]
        )
        return BaseResponse(success=True, message=f"Successfully parsed {len(db_games)} games from PGN", data=summary)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process PGN: {str(e)}")

@router.post("/lichess", response_model=BaseResponse[ImportSummaryResponse])
async def import_lichess(req: LichessImportRequest):
    """
    Fetches games from Lichess Explorer API for a specific username.
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

        target_player_id = req.player_id or str(uuid.uuid4())
        dataset_id = str(uuid.uuid4())
        db_games = [ImportService.normalize_game_for_db(g, dataset_id=dataset_id) for g in raw_games]

        summary = ImportSummaryResponse(
            dataset_id=dataset_id,
            player_id=target_player_id,
            total_found=len(raw_games),
            imported_count=len(db_games),
            primary_player=req.username,
            source_type="lichess",
            sample_games=db_games[:5]
        )
        return BaseResponse(success=True, message=f"Fetched {len(db_games)} games from Lichess", data=summary)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lichess sync error: {str(e)}")

@router.post("/chesscom", response_model=BaseResponse[ImportSummaryResponse])
async def import_chesscom(req: ChesscomImportRequest):
    """
    Fetches games from Chess.com Public API for a specific username.
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

        target_player_id = req.player_id or str(uuid.uuid4())
        dataset_id = str(uuid.uuid4())
        db_games = [ImportService.normalize_game_for_db(g, dataset_id=dataset_id) for g in raw_games]

        summary = ImportSummaryResponse(
            dataset_id=dataset_id,
            player_id=target_player_id,
            total_found=len(raw_games),
            imported_count=len(db_games),
            primary_player=req.username,
            source_type="chesscom",
            sample_games=db_games[:5]
        )
        return BaseResponse(success=True, message=f"Fetched {len(db_games)} games from Chess.com", data=summary)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chess.com sync error: {str(e)}")
