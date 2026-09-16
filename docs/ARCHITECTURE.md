# CHESS PLAYER ANALYZER V2: ARCHITECTURE SPECIFICATION

## 1. Executive Summary & Philosophy
**Chess Player Analyzer V2** is a complete, production-ready overhaul of the legacy Streamlit monolith. It transitions the application into a distributed, serverless-first, modern web platform designed to run permanently within the **100% Free Tier** limits of **Vercel**, **Supabase**, and **Google Gemini AI**.

### Core Tenets
1. **Mathematical Invariance**: 100% of the proprietary chess and statistical algorithms in `src/` (Opening EPD trees, Bayesian shrinkage rating deltas $K=6.0$, pawn structure identification, style radar 8-axis polygon, and phase ACPL) are preserved without distortion.
2. **Zero Server CPU Engine Execution**: Heavy Stockfish evaluation is NEVER executed synchronously on serverless functions to prevent the 10-second timeout. Instead:
   - Evaluated games extract centipawn evaluations directly from PGN comments/tags in `<10ms` (`has_embedded_eval`).
   - Interactive, per-move evaluation runs directly inside the user's browser using **Stockfish WASM via a Web Worker** (`0` server CPU cost).
3. **Database Free Tier Longevity**: Large PGN raw text is stored in Supabase Storage (`pgn-vault`), while PostgreSQL stores compact relational tables and optimized JSONB analytical snapshots, keeping the DB footprint strictly below 50MB (well below the 500MB free quota).

---

## 2. Multi-Tier System Topology

```
+-----------------------------------------------------------------------------------+
|                                CLIENT TIER (Browser)                             |
|                                                                                   |
|  +---------------------------+     +-------------------------+                    |
|  |  Next.js 14 App Router    |     |  Stockfish 10/16 WASM   |                    |
|  |  (React 18 + TailwindCSS) |<--->|  Web Worker             |                    |
|  |  - Interactive Board      |     |  - Centipawn evaluation |                    |
|  |  - Style Radar (8-Axis)   |     |  - Best move / Mate     |                    |
|  |  - Opening Tree Explorer  |     |  - Zero Server Latency  |                    |
|  |  - AI Coach Chat Stream   |     +-------------------------+                    |
|  +---------------------------+                                                    |
+-----------------|---------------------------------|-------------------------------+
                  | HTTP/JSON                       | Supabase Auth & Storage SDK
                  v                                 v
+-----------------------------------+     +-----------------------------------------+
|     SERVERLESS RUNTIME (Vercel)   |     |       SUPABASE CLOUD INFRASTRUCTURE     |
|                                   |     |                                         |
|  FastAPI / Python 3.11 Runtime    |     |  1. PostgreSQL (Relational + JSONB)     |
|  - Mount: /api/*                  |     |     - profiles, players, datasets       |
|  - Stateless & Fast (<150ms boot) |     |     - games, analysis_runs              |
|  - Direct import from src/        |     |     - game_analyses, critical_positions |
|  - Streaming SSE AI Chat          |     |     - ai_coaching_logs                  |
|                                   |     |  2. Supabase Storage (pgn-vault)        |
+-----------------|-----------------+     |  3. Supabase Auth (JWT & RLS)           |
                  |                       +-----------------------------------------+
                  v                                 
+-----------------------------------+
|      EXTERNAL AI & APIs           |
|                                   |
|  1. Google Gemini 1.5 Flash       |
|     - Deep player briefing        |
|     - Grandmaster coaching chat   |
|  2. Local Expert Fallback         |
|     - Deterministic rule engine   |
|  3. Lichess & Chess.com APIs      |
+-----------------------------------+
```

---

## 3. Component Deep Dive

### A. Frontend Layer (Next.js 14 App Router)
- **Framework**: Next.js 14 + React 18 + TypeScript + Tailwind CSS.
- **Routing Structure**:
  - `/`: High-converting landing page highlighting 4 pillars.
  - `/dashboard`: High-level metrics, recent analysis runs, quick import triggers.
  - `/import`: Multi-source importer (Drag-and-drop PGN file, raw PGN text, Lichess API sync, Chess.com public archives).
  - `/players`: Player dossier management, search by canonical name, title filtering, create player modal.
  - `/players/[playerId]`: Deep player profile with 5 interactive tabs:
    1. *Tổng Quan*: W/D/L ratios, White vs Black performance, Phase ACPL breakdown, Engine coverage.
    2. *Khai Cuộc*: Interactive opening continuation tree with Bayesian score deltas.
    3. *Cấu Trúc Tốt & Phong Cách*: 8-axis radar polygon and identified pawn formations.
    4. *Ván Đấu*: Searchable game records with engine tags.
    5. *Trợ Lí AI*: Dedicated coaching dossier primed for this player.
  - `/analyze`: Interactive analysis board combining `ChessBoard`, `MoveHistory`, and live `Stockfish WASM` evaluations.
  - `/ai-coach`: Standalone coaching room supporting perspective toggling (*Self Review* vs *Opponent Preparation*) with Server-Sent Events (SSE).
  - `/login` & `/register`: Supabase Auth forms with guest exploration mode.

### B. Interactive Engine Layer (Stockfish WASM)
- Implemented in `lib/stockfish/engineWorker.ts` and `lib/stockfish/useStockfish.ts`.
- Spawns a dedicated Web Worker running Stockfish compiled to WebAssembly.
- Communicates via the standard Universal Chess Interface (UCI) protocol:
  - `uci`, `isready`, `position fen <FEN>`, `go depth 12`.
  - Non-blocking: Parses `info depth ... score cp ... pv ...` asynchronously and updates React UI without impacting frame rates.

### C. Serverless API Layer (FastAPI Python on Vercel)
- Mount point: `/api/index.py` configured via `vercel.json` rewrites.
- Direct reuse of domain algorithms in `src/`:
  - `src.opening_tree.tree_builder`: Parses PGN moves, constructs EPD trees, computes Bayesian win rates.
  - `src.player_profile.pawn_structures`: Identifies pawn formations from FEN skeletons.
  - `src.player_profile.style_profile`: Evaluates 8-dimension style vectors.
  - `src.accuracy.engine_evaluator`: Computes Centipawn Loss (ACPL) across opening, middlegame, and endgame phases.
  - `src.ai_assistant.briefing`: Formats structured dossiers for LLM prompts.
  - `src.ai_assistant.local_expert`: Offline heuristic coaching rule engine when LLM keys are absent.

---

## 4. Security & Data Isolation
- **Authentication**: JWT-based authentication provided by Supabase Auth.
- **Row Level Security (RLS)**:
  - Every table enforces strict tenancy (`auth.uid() = user_id`).
  - Users can only read and modify their own players, datasets, games, and analysis runs.
- **Data Protection**: API credentials (Supabase Service Role, Gemini API Key) reside exclusively in server-side environment variables and are never leaked to client bundles.
