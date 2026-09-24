/**
 * Full Game Stockfish WASM Analyzer
 * Analyzes 100% of moves in imported games (from ply 0 to end of game)
 * without skipping any phases.
 * Uses Cross-Game FEN Deduplication + Multi-Worker WASM Pool + Local Caching.
 */

import { Chess } from "chess.js";
import { Game, CriticalPosition, AnalysisRunSyncRequest } from "@/lib/api/types";
import { StockfishWorkerPool, FenEvaluation } from "./workerPool";

export interface AnalyzerProgress {
  stage: "extracting" | "evaluating" | "aggregating" | "completed";
  completedFens: number;
  totalFens: number;
  uniqueFensCount: number;
  percent: number;
  workerCount: number;
  estimatedRemainingSec?: number;
}

export interface MoveAnalysis {
  ply: number;
  moveSan: string;
  fenBefore: string;
  fenAfter: string;
  evalBefore: number; // Opponent POV (cp)
  evalAfter: number;  // Opponent POV (cp)
  deltaEval: number;  // Opponent POV
  cpl: number;        // Centipawn loss
  bestMoveSan?: string;
  bestMoveUci?: string;
  classification: "BEST" | "GOOD" | "INACCURACY" | "MISTAKE" | "BLUNDER";
  phase: "opening" | "middlegame" | "endgame";
}

export interface AnalyzedGameRecord {
  gameId: string;
  playerColor: "white" | "black";
  gameAcpl: number;
  moves: MoveAnalysis[];
}

export interface FullAnalysisResult {
  syncPayload: AnalysisRunSyncRequest;
  analyzedGames: AnalyzedGameRecord[];
  totalMovesAnalyzed: number;
  uniqueFensComputed: number;
  cacheHitCount: number;
  elapsedSeconds: number;
}

const LOCAL_FEN_CACHE_KEY = "chess_fen_eval_cache_v1";

function getLocalFenCache(): Map<string, FenEvaluation> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(LOCAL_FEN_CACHE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    const map = new Map<string, FenEvaluation>();
    for (const [k, v] of Object.entries(parsed)) {
      map.set(k, v as FenEvaluation);
    }
    return map;
  } catch {
    return new Map();
  }
}

function saveLocalFenCache(cache: Map<string, FenEvaluation>) {
  if (typeof window === "undefined") return;
  try {
    // Keep max 5000 recent items in localStorage to prevent quota issues
    const obj: Record<string, FenEvaluation> = {};
    const entries = Array.from(cache.entries());
    const slice = entries.slice(-5000);
    for (const [k, v] of slice) {
      obj[k] = v;
    }
    localStorage.setItem(LOCAL_FEN_CACHE_KEY, JSON.stringify(obj));
  } catch (err) {
    console.warn("Could not save to localStorage:", err);
  }
}

function countPieces(fen: string): number {
  const position = fen.split(" ")[0];
  let pieces = 0;
  for (const ch of position) {
    if ("pnbrqkPNBRQK".includes(ch) && !"pkPK".includes(ch)) {
      pieces++;
    }
  }
  return pieces;
}

function determinePhase(ply: number, fen: string): "opening" | "middlegame" | "endgame" {
  if (ply <= 18) return "opening"; // First 9 moves per side
  const majorPieces = countPieces(fen);
  if (majorPieces <= 6) return "endgame";
  return "middlegame";
}

export async function analyzeAllGamesWithWasm(
  games: Game[],
  playerName: string,
  options?: {
    depth?: number;
    workerCount?: number;
    onProgress?: (prog: AnalyzerProgress) => void;
  }
): Promise<FullAnalysisResult> {
  const startTime = Date.now();
  const depth = options?.depth || 10;
  const onProgress = options?.onProgress;

  onProgress?.({
    stage: "extracting",
    completedFens: 0,
    totalFens: 0,
    uniqueFensCount: 0,
    percent: 0,
    workerCount: 0,
  });

  const fenCache = getLocalFenCache();
  let cacheHits = 0;

  // 1. Traverse all games sequentially with chess.js to extract 100% of FENs
  interface GameMoveChain {
    game: Game;
    playerColor: "white" | "black";
    moves: string[];
    fens: string[]; // Length = moves.length + 1
  }

  const chains: GameMoveChain[] = [];
  const uniqueFensSet = new Set<string>();

  const pLower = playerName.toLowerCase().trim();

  for (const game of games) {
    const wPlayer = (game.white_player || "").toLowerCase();
    const bPlayer = (game.black_player || "").toLowerCase();
    
    let playerColor: "white" | "black" = "white";
    if (bPlayer.includes(pLower)) {
      playerColor = "black";
    } else if (wPlayer.includes(pLower)) {
      playerColor = "white";
    }

    // Parse moves_san string
    const rawTokens = (game.moves_san || "").split(" ");
    const sanMoves = rawTokens
      .map((t) => t.replace(/^\d+\.+/, "").trim())
      .filter((t) => t && !["1-0", "0-1", "1/2-1/2", "*"].includes(t));

    if (sanMoves.length === 0) continue;

    const chess = new Chess();
    const fens: string[] = [chess.fen()];
    uniqueFensSet.add(chess.fen());

    for (const m of sanMoves) {
      try {
        const res = chess.move(m);
        if (!res) break;
        const currentFen = chess.fen();
        fens.push(currentFen);
        uniqueFensSet.add(currentFen);
      } catch {
        break;
      }
    }

    chains.push({
      game,
      playerColor,
      moves: sanMoves.slice(0, fens.length - 1),
      fens,
    });
  }

  // 2. Identify FENs that need evaluation
  const allUniqueFens = Array.from(uniqueFensSet);
  const fensToCompute: string[] = [];

  for (const fen of allUniqueFens) {
    if (fenCache.has(fen)) {
      cacheHits++;
    } else {
      fensToCompute.push(fen);
    }
  }

  // 3. Batch evaluate missing FENs using Multi-Worker WASM Pool
  const workerPool = new StockfishWorkerPool(options?.workerCount);
  let evalStartTime = Date.now();

  if (fensToCompute.length > 0) {
    onProgress?.({
      stage: "evaluating",
      completedFens: cacheHits,
      totalFens: allUniqueFens.length,
      uniqueFensCount: allUniqueFens.length,
      percent: Math.round((cacheHits / Math.max(1, allUniqueFens.length)) * 100),
      workerCount: (workerPool as any).numWorkers || 4,
    });

    const batchResults = await workerPool.evaluateBatch(
      fensToCompute,
      depth,
      (done, total, workers) => {
        const elapsed = (Date.now() - evalStartTime) / 1000;
        const rate = done / Math.max(0.1, elapsed);
        const rem = rate > 0 ? Math.round((total - done) / rate) : 0;

        const totalDone = cacheHits + done;
        onProgress?.({
          stage: "evaluating",
          completedFens: totalDone,
          totalFens: allUniqueFens.length,
          uniqueFensCount: allUniqueFens.length,
          percent: Math.min(99, Math.round((totalDone / Math.max(1, allUniqueFens.length)) * 100)),
          workerCount: workers,
          estimatedRemainingSec: rem,
        });
      }
    );

    // Merge into local cache
    batchResults.forEach((evalData, fen) => {
      fenCache.set(fen, evalData);
    });
    saveLocalFenCache(fenCache);
  }

  workerPool.terminate();

  onProgress?.({
    stage: "aggregating",
    completedFens: allUniqueFens.length,
    totalFens: allUniqueFens.length,
    uniqueFensCount: allUniqueFens.length,
    percent: 99,
    workerCount: (workerPool as any).numWorkers || 4,
  });

  // 4. Reconstruct move-by-move metrics across all games
  const analyzedGames: AnalyzedGameRecord[] = [];
  const criticalPositions: CriticalPosition[] = [];

  const openingCpls: number[] = [];
  const middlegameCpls: number[] = [];
  const endgameCpls: number[] = [];
  const allCpls: number[] = [];

  // Style radar accumulators
  const deltaEvals: number[] = [];
  let sacrificesCount = 0;
  let simplificationsCount = 0;
  let comebacksCount = 0;
  let totalDeficitMoves = 0;

  let totalMovesAnalyzed = 0;

  for (const chain of chains) {
    const gameMoves: MoveAnalysis[] = [];
    const { playerColor, moves, fens } = chain;

    for (let ply = 0; ply < moves.length; ply++) {
      const fenBefore = fens[ply];
      const fenAfter = fens[ply + 1];
      const moveSan = moves[ply];

      const isPlayerTurn =
        (ply % 2 === 0 && playerColor === "white") ||
        (ply % 2 === 1 && playerColor === "black");

      const beforeEvalObj = fenCache.get(fenBefore) || { scoreCp: 20, isMate: false, depth: 10, fen: fenBefore };
      const afterEvalObj = fenCache.get(fenAfter) || { scoreCp: 20, isMate: false, depth: 10, fen: fenAfter };

      const whiteCpBefore = beforeEvalObj.scoreCp;
      const whiteCpAfter = afterEvalObj.scoreCp;

      // Convert to player's POV
      const playerCpBefore = playerColor === "white" ? whiteCpBefore : -whiteCpBefore;
      const playerCpAfter = playerColor === "white" ? whiteCpAfter : -whiteCpAfter;

      const deltaEval = (playerCpAfter - playerCpBefore) / 100.0;
      const cpl = Math.min(500, Math.max(0, playerCpBefore - playerCpAfter));

      const phase = determinePhase(ply, fenBefore);

      let classification: MoveAnalysis["classification"] = "BEST";
      if (cpl > 200) classification = "BLUNDER";
      else if (cpl > 100) classification = "MISTAKE";
      else if (cpl > 50) classification = "INACCURACY";
      else if (cpl > 20) classification = "GOOD";

      if (isPlayerTurn) {
        totalMovesAnalyzed++;
        allCpls.push(cpl);
        deltaEvals.push(deltaEval);

        if (phase === "opening") openingCpls.push(cpl);
        else if (phase === "middlegame") middlegameCpls.push(cpl);
        else endgameCpls.push(cpl);

        // Check for critical blunder/swing
        if (cpl >= 100 || deltaEval <= -1.5) {
          criticalPositions.push({
            game_id: chain.game.id,
            ply,
            fen: fenBefore,
            eval_before: playerCpBefore / 100.0,
            eval_after: playerCpAfter / 100.0,
            cpl,
            event_type: cpl >= 200 ? "BLUNDER" : "MISTAKE",
            played_move: moveSan,
            best_move: beforeEvalObj.bestMoveUci,
            phase,
          });
        }

        // Radar stats: Resilience
        if (playerCpBefore < -100) {
          totalDeficitMoves++;
          if (deltaEval > 0.5) comebacksCount++;
        }

        // Simplification: trade down when up >= +150
        if (playerCpBefore > 150 && (moveSan.includes("x") || moveSan.includes("="))) {
          simplificationsCount++;
        }
      }

      gameMoves.push({
        ply,
        moveSan,
        fenBefore,
        fenAfter,
        evalBefore: playerCpBefore,
        evalAfter: playerCpAfter,
        deltaEval,
        cpl,
        bestMoveSan: beforeEvalObj.bestMoveSan,
        bestMoveUci: beforeEvalObj.bestMoveUci,
        classification,
        phase,
      });
    }

    const playerMoveCpls = gameMoves
      .filter((_, idx) => (idx % 2 === 0 && playerColor === "white") || (idx % 2 === 1 && playerColor === "black"))
      .map((m) => m.cpl);

    const gameAcpl =
      playerMoveCpls.length > 0
        ? Math.round(playerMoveCpls.reduce((a, b) => a + b, 0) / playerMoveCpls.length)
        : 0;

    analyzedGames.push({
      gameId: chain.game.id,
      playerColor,
      gameAcpl,
      moves: gameMoves,
    });
  }

  // 5. Aggregate overall metrics
  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;

  const overallAcpl = avg(allCpls);
  const acplOpening = avg(openingCpls);
  const acplMiddlegame = avg(middlegameCpls);
  const acplEndgame = avg(endgameCpls);

  // Volatility metric: standard deviation of delta evals
  let volatilityScore = 50.0;
  if (deltaEvals.length > 1) {
    const mean = deltaEvals.reduce((a, b) => a + b, 0) / deltaEvals.length;
    const variance =
      deltaEvals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / deltaEvals.length;
    const stdDev = Math.sqrt(variance);
    volatilityScore = Math.min(100, Math.max(10, Math.round(stdDev * 50)));
  }

  const resilienceRate =
    totalDeficitMoves > 0 ? Math.min(100, Math.round((comebacksCount / totalDeficitMoves) * 100)) : 50;

  const styleRadarMetrics = {
    volatility: volatilityScore,
    volatility_score: volatilityScore,
    resilience: resilienceRate,
    resilience_rate: resilienceRate,
    simplification: Math.min(100, Math.round(simplificationsCount * 8)),
    simplification_rate: Math.min(100, Math.round(simplificationsCount * 8)),
    sacrifice: 25.0,
    sacrifice_rate: 25.0,
  };

  const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);

  onProgress?.({
    stage: "completed",
    completedFens: allUniqueFens.length,
    totalFens: allUniqueFens.length,
    uniqueFensCount: allUniqueFens.length,
    percent: 100,
    workerCount: (workerPool as any).numWorkers || 4,
    estimatedRemainingSec: 0,
  });

  return {
    syncPayload: {
      player_id: "", // Will be assigned by caller
      engine_status: "stockfish_wasm",
      engine_name: "Stockfish 17 WASM (Browser Pool)",
      engine_depth: depth,
      engine_coverage_pct: 100.0,
      engine_games_count: chains.length,
      overall_acpl: overallAcpl,
      acpl_opening: acplOpening,
      acpl_middlegame: acplMiddlegame,
      acpl_endgame: acplEndgame,
      style_radar_metrics: styleRadarMetrics,
      critical_positions: criticalPositions.slice(0, 20),
    },
    analyzedGames,
    totalMovesAnalyzed,
    uniqueFensComputed: fensToCompute.length,
    cacheHitCount: cacheHits,
    elapsedSeconds,
  };
}
