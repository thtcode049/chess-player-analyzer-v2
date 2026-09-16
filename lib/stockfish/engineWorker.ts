/**
 * Client-Side Stockfish Engine Controller
 * Manages UCI communication with Stockfish in a browser Web Worker.
 * Zero server CPU cost, zero server timeout.
 */

export interface EngineEvaluation {
  depth: number;
  score: number; // In centipawns (positive = white advantage)
  isMate: boolean;
  mateIn?: number;
  bestMove?: string;
  pv?: string[];
  nodes?: number;
}

export type EvaluationCallback = (evalData: EngineEvaluation) => void;

export class StockfishEngineController {
  private worker: Worker | null = null;
  private isReady = false;
  private currentFen = "";
  private onEvaluation: EvaluationCallback | null = null;

  constructor(onEvaluation?: EvaluationCallback) {
    if (onEvaluation) {
      this.onEvaluation = onEvaluation;
    }
  }

  public init(): boolean {
    if (typeof window === "undefined") return false;

    try {
      // Use local Stockfish WASM worker or CDN fallback
      try {
        this.worker = new Worker("/stockfish/stockfish.js");
      } catch {
        this.worker = new Worker("https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js");
      }
      this.worker.onmessage = this.handleMessage.bind(this);

      // Send initial UCI initialization commands
      this.sendCommand("uci");
      this.sendCommand("isready");
      this.sendCommand("setoption name MultiPV value 1");
      this.isReady = true;
      return true;
    } catch (err) {
      console.warn("Stockfish Web Worker initialization error (client offline or blocked):", err);
      this.isReady = false;
      return false;
    }
  }

  public evaluatePosition(fen: string, depth = 12, onEval?: EvaluationCallback) {
    if (!this.worker) {
      this.init();
    }
    if (onEval) {
      this.onEvaluation = onEval;
    }

    this.currentFen = fen;
    this.sendCommand("stop");
    this.sendCommand("ucinewgame");
    this.sendCommand(`position fen ${fen}`);
    this.sendCommand(`go depth ${depth}`);
  }

  public stop() {
    this.sendCommand("stop");
  }

  public terminate() {
    if (this.worker) {
      this.sendCommand("quit");
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }

  private sendCommand(cmd: string) {
    if (this.worker) {
      this.worker.postMessage(cmd);
    }
  }

  private handleMessage(event: MessageEvent) {
    const line: string = typeof event.data === "string" ? event.data : "";
    if (!line) return;

    // Parse UCI info score cp ... pv ...
    if (line.startsWith("info") && line.includes("score")) {
      const parsedEval = this.parseUciInfoLine(line);
      if (parsedEval && this.onEvaluation) {
        this.onEvaluation(parsedEval);
      }
    } else if (line.startsWith("bestmove")) {
      const parts = line.split(" ");
      const bestMove = parts[1];
      if (bestMove && this.onEvaluation) {
        // Emit final best move
        this.onEvaluation({
          depth: 12,
          score: 0,
          isMate: false,
          bestMove,
        });
      }
    }
  }

  private parseUciInfoLine(line: string): EngineEvaluation | null {
    const depthMatch = line.match(/depth\s+(\d+)/);
    const depth = depthMatch ? parseInt(depthMatch[1], 10) : 0;

    let score = 0;
    let isMate = false;
    let mateIn: number | undefined;

    const cpMatch = line.match(/score\s+cp\s+(-?\d+)/);
    const mateMatch = line.match(/score\s+mate\s+(-?\d+)/);

    if (mateMatch) {
      isMate = true;
      mateIn = parseInt(mateMatch[1], 10);
      score = mateIn > 0 ? 10000 : -10000;
    } else if (cpMatch) {
      score = parseInt(cpMatch[1], 10);
      // Normalized to pawns or centipawns
    }

    const pvMatch = line.match(/pv\s+(.+)$/);
    const pv = pvMatch ? pvMatch[1].trim().split(" ") : [];

    const nodesMatch = line.match(/nodes\s+(\d+)/);
    const nodes = nodesMatch ? parseInt(nodesMatch[1], 10) : undefined;

    return {
      depth,
      score,
      isMate,
      mateIn,
      pv,
      nodes,
      bestMove: pv.length > 0 ? pv[0] : undefined,
    };
  }
}
