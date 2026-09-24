/**
 * Client-Side Stockfish Engine Controller
 * Manages UCI communication with Stockfish in a browser Web Worker.
 * Zero server CPU cost, zero server timeout.
 * Supports Multi-PV lines analysis (1 to 5 variations) like Lichess.
 */

export interface EngineEvaluationLine {
  multipv: number; // 1, 2, 3, 4, 5
  depth: number;
  score: number; // Centipawns (from White perspective)
  isMate: boolean;
  mateIn?: number;
  pv: string[]; // Sequence of UCI moves
}

export interface EngineEvaluation {
  depth: number;
  score: number; // In centipawns (positive = white advantage)
  isMate: boolean;
  mateIn?: number;
  bestMove?: string;
  pv?: string[];
  nodes?: number;
  fen?: string; // Evaluated FEN
  lines?: EngineEvaluationLine[]; // Multi-PV lines (e.g. 1 to 5 lines)
}

export type EvaluationCallback = (evalData: EngineEvaluation) => void;

export class StockfishEngineController {
  private worker: Worker | null = null;
  private isReady = false;
  private currentMultiPv = 3;
  private currentLines = new Map<number, EngineEvaluationLine>();

  public get ready(): boolean {
    return this.isReady;
  }
  private currentFen = "";
  private onEvaluation: EvaluationCallback | null = null;
  private currentEvaluation: EngineEvaluation = {
    depth: 0,
    score: 0,
    isMate: false,
    lines: [],
  };

  constructor(onEvaluation?: EvaluationCallback) {
    if (onEvaluation) {
      this.onEvaluation = onEvaluation;
    }
  }

  public init(): boolean {
    if (typeof window === "undefined") return false;

    try {
      this.worker = new Worker("/stockfish/stockfish.js");
      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = (err) => {
        console.warn("Stockfish Web Worker runtime error:", err);
      };

      // Send initial UCI initialization commands
      this.sendCommand("uci");
      this.sendCommand("isready");
      this.sendCommand(`setoption name MultiPV value ${this.currentMultiPv}`);
      this.isReady = true;
      return true;
    } catch (err) {
      console.warn("Stockfish Web Worker initialization error:", err);
      this.isReady = false;
      return false;
    }
  }

  public setMultiPv(count: number) {
    const val = Math.max(1, Math.min(5, count));
    this.currentMultiPv = val;
    this.sendCommand(`setoption name MultiPV value ${val}`);
  }

  public evaluatePosition(fen: string, depth = 25, multiPv = 3, onEval?: EvaluationCallback) {
    if (!this.worker) {
      this.init();
    }
    if (onEval) {
      this.onEvaluation = onEval;
    }

    this.currentFen = fen;
    this.currentLines.clear();
    this.currentMultiPv = Math.max(1, Math.min(5, multiPv));

    // Reset current evaluation depth for new position
    this.currentEvaluation = {
      depth: 0,
      score: this.currentEvaluation.score,
      isMate: false,
      fen,
      lines: [],
    };

    this.sendCommand("stop");
    this.sendCommand(`setoption name MultiPV value ${this.currentMultiPv}`);
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
      if (parsedEval) {
        const lineEntry: EngineEvaluationLine = {
          multipv: parsedEval.multipv,
          depth: parsedEval.depth,
          score: parsedEval.score,
          isMate: parsedEval.isMate,
          mateIn: parsedEval.mateIn,
          pv: parsedEval.pv,
        };

        this.currentLines.set(parsedEval.multipv, lineEntry);
        const sortedLines = Array.from(this.currentLines.values())
          .filter((l) => l.multipv <= this.currentMultiPv)
          .sort((a, b) => a.multipv - b.multipv);

        if (parsedEval.multipv === 1) {
          this.currentEvaluation = {
            ...this.currentEvaluation,
            depth: parsedEval.depth,
            score: parsedEval.score,
            isMate: parsedEval.isMate,
            mateIn: parsedEval.mateIn,
            pv: parsedEval.pv,
            nodes: parsedEval.nodes,
            bestMove: parsedEval.bestMove,
            fen: this.currentFen,
            lines: sortedLines,
          };
        } else {
          this.currentEvaluation = {
            ...this.currentEvaluation,
            lines: sortedLines,
            fen: this.currentFen,
          };
        }

        if (this.onEvaluation) {
          this.onEvaluation({ ...this.currentEvaluation });
        }
      }
    } else if (line.startsWith("bestmove")) {
      const parts = line.split(" ");
      const bestMove = parts[1];
      if (bestMove && bestMove !== "(none)") {
        this.currentEvaluation = {
          ...this.currentEvaluation,
          bestMove,
        };
        if (this.onEvaluation) {
          this.onEvaluation({ ...this.currentEvaluation });
        }
      }
    }
  }

  private parseUciInfoLine(line: string): {
    multipv: number;
    depth: number;
    score: number;
    isMate: boolean;
    mateIn?: number;
    pv: string[];
    nodes?: number;
    bestMove?: string;
  } | null {
    const depthMatch = line.match(/depth\s+(\d+)/);
    const depth = depthMatch ? parseInt(depthMatch[1], 10) : 0;

    const multiPvMatch = line.match(/multipv\s+(\d+)/);
    const multipv = multiPvMatch ? parseInt(multiPvMatch[1], 10) : 1;

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
    } else {
      return null;
    }

    // Convert from side-to-move perspective to White's perspective
    // Stockfish UCI returns cp relative to the side whose turn it is
    const isBlackToMove = this.currentFen.split(" ")[1] === "b";
    if (isBlackToMove) {
      score = -score;
      if (mateIn !== undefined) {
        mateIn = -mateIn;
      }
    }

    const pvMatch = line.match(/pv\s+(.+)$/);
    const pv = pvMatch ? pvMatch[1].trim().split(/\s+/) : [];

    const nodesMatch = line.match(/nodes\s+(\d+)/);
    const nodes = nodesMatch ? parseInt(nodesMatch[1], 10) : undefined;

    return {
      multipv,
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
