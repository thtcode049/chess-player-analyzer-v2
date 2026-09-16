# CHESS PLAYER ANALYZER V2: API SPECIFICATION

## 1. Overview
The backend API is built using **FastAPI** running on the Vercel Python serverless runtime. All routes are prefixed with `/api` and return typed JSON adhering to the `BaseResponse[T]` contract.

```json
{
  "success": true,
  "message": "Human readable status",
  "data": { ... }
}
```

---

## 2. Core Endpoints

### System & Health
#### `GET /api/health`
Verifies serverless worker status and connected AI modules.
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "message": "Chess Player Analyzer V2 API is running",
    "data": {
      "status": "healthy",
      "version": "2.0.0",
      "python_runtime": "3.11.x",
      "gemini_configured": true
    }
  }
  ```

---

### Players
#### `GET /api/players`
Lists all players owned by the authenticated user.
- **Response**: `200 OK` -> `BaseResponse[List[PlayerResponse]]`

#### `POST /api/players`
Creates a new canonical player profile.
- **Request Body**:
  ```json
  {
    "canonical_name": "Carlsen, Magnus",
    "fide_id": 1503014,
    "title": "GM",
    "notes": "World Champion 2013-2023"
  }
  ```
- **Response**: `200 OK` -> `BaseResponse[PlayerResponse]`

#### `GET /api/players/{player_id}`
Retrieves a player's profile by UUID.
- **Response**: `200 OK` -> `BaseResponse[PlayerResponse]`

#### `GET /api/players/{player_id}/games`
Fetches a paginated list of games for a player with optional filters.
- **Query Params**:
  - `page`: integer (default: 1)
  - `page_size`: integer (default: 20)
  - `color`: string (`white`, `black`)
  - `eco`: string (e.g. `B90`)
- **Response**: `200 OK` -> `BaseResponse[List[GameResponse]]`

---

### Games
#### `GET /api/games/{game_id}`
Fetches full details of a specific game, including moves, embedded eval status, and critical positions.
- **Response**: `200 OK` -> `BaseResponse[GameResponse]`

---

### Imports
#### `POST /api/import/pgn-file`
Parses a multipart `.pgn` file, extracts game headers and moves, and stores raw PGN.
- **Request Form Data**:
  - `file`: UploadFile (binary)
  - `player_id`: string (optional)
  - `max_games`: integer (default: 200)
- **Response**: `200 OK` -> `BaseResponse[ImportSummaryResponse]`

#### `POST /api/import/lichess`
Directly pulls games from the Lichess public API.
- **Request Body**:
  ```json
  {
    "username": "thtcode",
    "player_id": "optional-uuid",
    "max_games": 50,
    "perf_types": ["blitz", "rapid"],
    "rated_only": true
  }
  ```
- **Response**: `200 OK` -> `BaseResponse[ImportSummaryResponse]`

#### `POST /api/import/chesscom`
Fetches public archives from Chess.com.
- **Request Body**:
  ```json
  {
    "username": "hikaru",
    "player_id": "optional-uuid",
    "max_games": 50
  }
  ```
- **Response**: `200 OK` -> `BaseResponse[ImportSummaryResponse]`

---

### Analysis
#### `POST /api/analysis/runs`
Executes an analytical run (Opening EPD tree, Bayesian shrinkage $K=6.0$, pawn structure identification, and style radar).
- **Request Body**:
  ```json
  {
    "player_id": "uuid",
    "run_label": "September 2026 Blitz Repertoire",
    "scope_filter": { "min_moves": 10 }
  }
  ```
- **Response**: `200 OK` -> `BaseResponse[AnalysisRunResponse]`

#### `GET /api/analysis/runs/{run_id}`
Retrieves analysis results and stored JSONB snapshots.
- **Response**: `200 OK` -> `BaseResponse[AnalysisRunResponse]`

#### `GET /api/analysis/runs/{run_id}/tree`
Fetches continuations and statistics for a specific board position.
- **Query Params**:
  - `fen`: string (standard FEN position)
- **Response**: `200 OK` -> `BaseResponse[OpeningTreeNodeResponse]`
  ```json
  {
    "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    "games_count": 85,
    "continuations": [
      {
        "san": "c5",
        "games_count": 42,
        "usage_pct": 49.4,
        "win_pct": 45.2,
        "draw_pct": 26.2,
        "loss_pct": 28.6,
        "score_pct": 58.3
      }
    ]
  }
  ```

---

### AI Coaching & Assistant
#### `POST /api/ai/briefing`
Generates a structured strategic briefing for a player.
- **Request Body**:
  ```json
  {
    "run_id": "uuid",
    "perspective_mode": "self"
  }
  ```
- **Response**: `200 OK` -> `BaseResponse[StrategicBriefingResponse]`

#### `POST /api/ai/chat-stream`
Interactive chat stream with Grandmaster AI using Server-Sent Events (SSE).
- **Request Body**:
  ```json
  {
    "run_id": "uuid",
    "message": "Tôi nên đối phó với phòng thủ Sicilian thế nào?",
    "perspective_mode": "opponent",
    "history": [],
    "current_fen": "r1bqkb1r/pp2pppp/2np1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 2 6"
  }
  ```
- **Response**: `text/event-stream`
  ```
  data: {"chunk": "Khi đối đầu "}
  data: {"chunk": "với cấu trúc Sicilian..."}
  data: [DONE]
  ```
