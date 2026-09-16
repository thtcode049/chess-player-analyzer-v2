"""
Chess Player Analyzer V2 - FastAPI Serverless Entrypoint
---------------------------------------------------------
Mounted by Vercel Serverless Python Runtime at /api/*
Preserves 100% of mathematical and chess domain logic from src/
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import time

from api.routes.imports import router as imports_router
from api.routes.players import router as players_router
from api.routes.games import router as games_router
from api.routes.analyses import router as analyses_router
from api.routes.ai import router as ai_router

app = FastAPI(
    title="Chess Player Analyzer V2 API",
    description="High-Performance Chess Data Analytics, Transposition-Safe Opening Trees, Empirical Bayesian Shrinkage & AI Coaching.",
    version="2.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json"
)

# Configure Cross-Origin Resource Sharing (CORS) for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Resource-Oriented Routers
app.include_router(imports_router)
app.include_router(players_router)
app.include_router(games_router)
app.include_router(analyses_router)
app.include_router(ai_router)

@app.get("/api")
@app.get("/api/health")
async def health_check():
    """Health check endpoint for Vercel Serverless and monitoring."""
    return {
        "status": "healthy",
        "app": "Chess Player Analyzer V2",
        "version": "2.0.0",
        "timestamp": int(time.time()),
        "endpoints": [
            "/api/import/pgn-file",
            "/api/import/lichess",
            "/api/import/chesscom",
            "/api/players",
            "/api/games",
            "/api/analysis/runs",
            "/api/ai/briefing",
            "/api/ai/chat-stream"
        ]
    }

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler returning structured error response."""
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error_code": "INTERNAL_SERVER_ERROR",
            "message": str(exc)
        }
    )
