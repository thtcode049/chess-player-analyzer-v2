/**
 * Stockfish WASM Web Worker Pool
 * Manages 2-6 concurrent Stockfish Web Workers in the browser.
 * Distributes unique FENs dynamically using a FIFO work-stealing queue.
 * Zero server CPU, zero server timeout.
 */

export interface FenEvaluation {
  fen: string;
  depth: number;
  scoreCp: number; // Always White POV in centipawns (+ advantage for white, - for black)
  isMate: boolean;
  mateIn?: number;
  bestMoveSan?: string;
  bestMoveUci?: string;
}

export type PoolProgressCallback = (completed: number, total: number, workerCount: number) => void;

export interface DeviceWorkerProfile {
  eco: number;          // Tiết kiệm pin, máy mát, quạt êm
  optimal: number;      // Cân bằng, khuyến nghị tốt nhất
  safeMax: number;      // Tối đa an toàn cho phần cứng
  cores: number;        // Số luồng CPU phát hiện được
  ramGb: number;        // RAM ước tính (GB)
  isMobile: boolean;    // Thiết bị di động hay máy tính
}

/**
 * Tự động phát hiện cấu hình phần cứng và đề xuất số lượng Web Worker an toàn nhất.
 * Đảm bảo:
 * - Luôn chừa luồng cho UI / OS không bị giật lag
 * - Tránh hiện tượng bóp xung nhịp do nhiệt (Thermal Throttling) trên laptop
 * - Ngăn tràn RAM trên các thiết bị cấu hình thấp
 */
export function detectOptimalWorkers(): DeviceWorkerProfile {
  if (typeof window === "undefined") {
    return { eco: 1, optimal: 2, safeMax: 2, cores: 2, ramGb: 4, isMobile: false };
  }

  const cores = navigator.hardwareConcurrency || 4;
  const ramGb = (navigator as any).deviceMemory || 8;
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && window.innerWidth < 768);

  // 1. Thiết bị di động (tản nhiệt thụ động, pin giới hạn)
  if (isMobile) {
    const max = Math.max(1, Math.min(2, Math.floor(cores / 2)));
    return { eco: 1, optimal: max, safeMax: max, cores, ramGb, isMobile: true };
  }

  // 2. Phân tầng theo số luồng CPU trên Desktop / Laptop
  let eco: number;
  let optimal: number;
  let safeMax: number;

  if (cores <= 2) {
    eco = 1;
    optimal = 1;
    safeMax = 1;
  } else if (cores <= 4) {
    eco = 1;
    optimal = 2;
    safeMax = 2;
  } else if (cores <= 8) {
    eco = Math.max(2, cores - 4);
    optimal = Math.max(2, cores - 3);
    safeMax = Math.max(2, cores - 2);
  } else if (cores <= 14) {
    // Laptop hiện đại lai P-core & E-core (như Intel Gen 12/13/14 dòng U/P)
    eco = 4;
    optimal = 6;
    safeMax = 8;
  } else {
    // Máy bàn / Workstation mạnh (>= 16 luồng)
    eco = 6;
    optimal = 8;
    safeMax = Math.min(14, cores - 4);
  }

  // 3. Ràng buộc theo dung lượng RAM (tránh crash Out of Memory)
  if (ramGb <= 2) {
    safeMax = Math.min(safeMax, 2);
    optimal = Math.min(optimal, 1);
    eco = 1;
  } else if (ramGb <= 4) {
    safeMax = Math.min(safeMax, 4);
    optimal = Math.min(optimal, 3);
    eco = Math.min(eco, 2);
  }

  return { eco, optimal, safeMax, cores, ramGb, isMobile: false };
}

interface WorkerSlot {
  id: number;
  worker: Worker;
  isReady: boolean;
  isBusy: boolean;
  currentFen: string;
  lastParsedEval: FenEvaluation | null;
  currentResolve: ((res: FenEvaluation) => void) | null;
  currentReject: ((err: any) => void) | null;
  timeoutId: any;
}

interface QueueItem {
  fen: string;
  depth: number;
  resolve: (res: FenEvaluation) => void;
  reject: (err: any) => void;
}

export class StockfishWorkerPool {
  private workers: WorkerSlot[] = [];
  private queue: QueueItem[] = [];
  private totalBatchSize = 0;
  private completedInBatch = 0;
  private onProgress: PoolProgressCallback | null = null;
  private isTerminated = false;
  private numWorkers: number;

  constructor(requestedWorkers?: number) {
    if (typeof window !== "undefined") {
      const profile = detectOptimalWorkers();
      this.numWorkers = requestedWorkers || profile.optimal;
    } else {
      this.numWorkers = 2;
    }
  }

  public async init(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    if (this.workers.length > 0) return true;

    try {
      const initPromises: Promise<void>[] = [];

      for (let i = 0; i < this.numWorkers; i++) {
        const slot = this.createWorkerSlot(i);
        this.workers.push(slot);

        const initP = new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            slot.isReady = true;
            resolve();
          }, 1500);

          const readyHandler = (e: MessageEvent) => {
            const line = typeof e.data === "string" ? e.data : "";
            if (line.includes("readyok") || line.includes("Stockfish")) {
              clearTimeout(timeout);
              slot.isReady = true;
              slot.worker.removeEventListener("message", readyHandler);
              resolve();
            }
          };

          slot.worker.addEventListener("message", readyHandler);
          slot.worker.postMessage("uci");
          slot.worker.postMessage("isready");
        });

        initPromises.push(initP);
      }

      await Promise.all(initPromises);
      return true;
    } catch (err) {
      console.warn("[StockfishWorkerPool] Init failed:", err);
      return false;
    }
  }

  private createWorkerSlot(id: number): WorkerSlot {
    const worker = new Worker("/stockfish/stockfish.js");
    const slot: WorkerSlot = {
      id,
      worker,
      isReady: false,
      isBusy: false,
      currentFen: "",
      lastParsedEval: null,
      currentResolve: null,
      currentReject: null,
      timeoutId: null,
    };

    worker.onmessage = (e: MessageEvent) => {
      this.handleWorkerMessage(slot, e.data);
    };

    worker.onerror = (err) => {
      console.warn(`[StockfishWorkerPool] Worker ${id} error:`, err);
      if (slot.currentReject) {
        slot.currentReject(err);
      }
      this.freeWorkerSlot(slot);
    };

    return slot;
  }

  private handleWorkerMessage(slot: WorkerSlot, data: any) {
    const line: string = typeof data === "string" ? data : "";
    if (!line) return;

    if (line.startsWith("info") && line.includes("score")) {
      const parsed = this.parseUciInfoLine(line, slot.currentFen);
      if (parsed) {
        slot.lastParsedEval = parsed;
      }
    } else if (line.startsWith("bestmove")) {
      const parts = line.split(" ");
      const bestMoveUci = parts[1] && parts[1] !== "(none)" ? parts[1] : undefined;

      const finalEval: FenEvaluation = slot.lastParsedEval || {
        fen: slot.currentFen,
        depth: 10,
        scoreCp: 0,
        isMate: false,
      };

      if (bestMoveUci) {
        finalEval.bestMoveUci = bestMoveUci;
      }

      if (slot.currentResolve) {
        slot.currentResolve(finalEval);
      }

      this.completedInBatch++;
      if (this.onProgress) {
        this.onProgress(this.completedInBatch, this.totalBatchSize, this.workers.length);
      }

      this.freeWorkerSlot(slot);
      this.dispatchNext(slot);
    }
  }

  private parseUciInfoLine(line: string, fen: string): FenEvaluation | null {
    const depthMatch = line.match(/depth\s+(\d+)/);
    const depth = depthMatch ? parseInt(depthMatch[1], 10) : 6;

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

    // Convert side-to-move score to White POV
    const isBlackToMove = fen.split(" ")[1] === "b";
    if (isBlackToMove) {
      score = -score;
      if (mateIn !== undefined) {
        mateIn = -mateIn;
      }
    }

    const pvMatch = line.match(/pv\s+(\S+)/);
    const bestMoveUci = pvMatch ? pvMatch[1] : undefined;

    return {
      fen,
      depth,
      scoreCp: score,
      isMate,
      mateIn,
      bestMoveUci,
    };
  }

  private freeWorkerSlot(slot: WorkerSlot) {
    if (slot.timeoutId) {
      clearTimeout(slot.timeoutId);
      slot.timeoutId = null;
    }
    slot.isBusy = false;
    slot.currentResolve = null;
    slot.currentReject = null;
    slot.lastParsedEval = null;
    slot.currentFen = "";
  }

  private dispatchNext(slot: WorkerSlot) {
    if (this.isTerminated || this.queue.length === 0) return;

    const item = this.queue.shift();
    if (!item) return;

    slot.isBusy = true;
    slot.currentFen = item.fen;
    slot.lastParsedEval = null;
    slot.currentResolve = item.resolve;
    slot.currentReject = item.reject;

    // Safety watchdog: max 8s per FEN
    slot.timeoutId = setTimeout(() => {
      console.warn(`[StockfishWorkerPool] FEN evaluation timed out on worker ${slot.id}: ${item.fen.slice(0, 30)}`);
      if (slot.currentResolve) {
        slot.currentResolve(
          slot.lastParsedEval || {
            fen: slot.currentFen,
            depth: 0,
            scoreCp: 0,
            isMate: false,
          }
        );
      }
      this.freeWorkerSlot(slot);
      this.dispatchNext(slot);
    }, 8000);

    slot.worker.postMessage("stop");
    slot.worker.postMessage(`position fen ${item.fen}`);
    slot.worker.postMessage(`go depth ${item.depth}`);
  }

  /**
   * Evaluate a batch of unique FENs across all available workers.
   * Returns a Map<fen, FenEvaluation>.
   */
  public async evaluateBatch(
    fens: string[],
    depth = 10,
    onProgress?: PoolProgressCallback
  ): Promise<Map<string, FenEvaluation>> {
    if (fens.length === 0) {
      return new Map();
    }

    await this.init();

    this.onProgress = onProgress || null;
    this.totalBatchSize = fens.length;
    this.completedInBatch = 0;

    const results = new Map<string, FenEvaluation>();

    const promises = fens.map((fen) => {
      return new Promise<FenEvaluation>((resolve, reject) => {
        this.queue.push({
          fen,
          depth,
          resolve: (evalData) => {
            results.set(fen, evalData);
            resolve(evalData);
          },
          reject,
        });
      });
    });

    // Start all idle workers
    for (const slot of this.workers) {
      if (!slot.isBusy) {
        this.dispatchNext(slot);
      }
    }

    await Promise.all(promises);
    return results;
  }

  public terminate() {
    this.isTerminated = true;
    this.queue = [];
    for (const slot of this.workers) {
      if (slot.timeoutId) {
        clearTimeout(slot.timeoutId);
      }
      try {
        slot.worker.postMessage("quit");
        slot.worker.terminate();
      } catch {}
    }
    this.workers = [];
  }
}
