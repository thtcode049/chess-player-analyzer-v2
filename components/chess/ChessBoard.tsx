"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { 
  RotateCw, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight 
} from "lucide-react";
import { useStockfish } from "@/lib/stockfish/useStockfish";
import { EngineEvaluation } from "@/lib/stockfish/engineWorker";

interface ChessBoardProps {
  initialFen?: string;
  moves?: string[]; // Array of SAN moves
  currentPly?: number; // Controlled ply from parent
  orientation?: "white" | "black";
  onPositionChange?: (fen: string, ply: number) => void;
  onMovesChange?: (moves: string[], currentPly: number, fen: string) => void;
  onEvaluationChange?: (evaluation: EngineEvaluation | null, isThinking: boolean) => void;
  isEngineEnabled?: boolean;
  multiPv?: number;
  height?: number;
}

export default function ChessBoard({
  initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  moves = [],
  currentPly: externalPly,
  orientation = "white",
  onPositionChange,
  onMovesChange,
  onEvaluationChange,
  isEngineEnabled = true,
  height = 480,
}: ChessBoardProps) {
  const [game, setGame] = useState(new Chess(initialFen));
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(orientation);
  const [currentPly, setCurrentPly] = useState(0);
  const [historyFens, setHistoryFens] = useState<string[]>([initialFen]);
  const lastProcessedMoves = useRef<string>("");
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return Math.min(height, Math.max(220, window.innerWidth - 80));
    }
    return height;
  });

  // Click-to-move and legal move highlighting state
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});

  // Reset selection when ply or FEN changes
  useEffect(() => {
    setMoveFrom(null);
    setOptionSquares({});
  }, [currentPly, initialFen]);

  useEffect(() => {
    const updateSize = () => {
      if (boardContainerRef.current) {
        const measured = boardContainerRef.current.clientWidth;
        if (measured > 0) {
          setBoardWidth(Math.min(height, measured));
        }
      } else if (typeof window !== "undefined") {
        setBoardWidth(Math.min(height, Math.max(220, window.innerWidth - 80)));
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [height]);

  // Stockfish WASM client hook
  const { evaluation, isThinking, evaluateFen, stop } = useStockfish();

  // Forward evaluation updates to parent for MoveHistory display
  useEffect(() => {
    if (onEvaluationChange) {
      onEvaluationChange(isEngineEnabled ? evaluation : null, isEngineEnabled ? isThinking : false);
    }
  }, [evaluation, isThinking, isEngineEnabled, onEvaluationChange]);

  // Navigate to specific ply cleanly (called once per navigation)
  const jumpToPly = useCallback(
    (targetPly: number) => {
      if (targetPly < 0 || targetPly >= historyFens.length) return;
      const targetFen = historyFens[targetPly];
      const updatedGame = new Chess(targetFen);
      setGame(updatedGame);
      setCurrentPly(targetPly);

      if (isEngineEnabled) {
        evaluateFen(targetFen, 14);
      }
      if (onPositionChange) {
        onPositionChange(targetFen, targetPly);
      }
    },
    [historyFens, isEngineEnabled, evaluateFen, onPositionChange]
  );

  // Stop or restart evaluation ONLY when isEngineEnabled toggles
  useEffect(() => {
    if (!isEngineEnabled) {
      stop();
    } else {
      const activeFen = historyFens[currentPly] || game.fen();
      evaluateFen(activeFen, 14);
    }
  }, [isEngineEnabled]);

  // Reset or initialize if external moves or initialFen prop changes
  useEffect(() => {
    const movesKey = `${initialFen}__${moves.join(" ")}`;
    if (movesKey === lastProcessedMoves.current) {
      return;
    }
    lastProcessedMoves.current = movesKey;

    const newGame = new Chess();
    const fens = [newGame.fen()];

    if (moves && moves.length > 0) {
      for (const m of moves) {
        try {
          newGame.move(m);
          fens.push(newGame.fen());
        } catch {
          break;
        }
      }
    } else if (initialFen && initialFen !== "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") {
      try {
        newGame.load(initialFen);
        fens[0] = newGame.fen();
      } catch {}
    }

    setHistoryFens(fens);

    // Determine starting ply: prioritize externalPly if valid, otherwise end of game
    const targetPly =
      typeof externalPly === "number" && externalPly >= 0 && externalPly < fens.length
        ? externalPly
        : fens.length - 1;

    const targetFen = fens[targetPly];
    setGame(new Chess(targetFen));
    setCurrentPly(targetPly);

    if (isEngineEnabled) {
      evaluateFen(targetFen, 14);
    }
    if (onPositionChange) {
      onPositionChange(targetFen, targetPly);
    }
  }, [moves, initialFen]);

  // Synchronize with externalPly changes (e.g. from MoveHistory click or parent)
  useEffect(() => {
    if (
      typeof externalPly === "number" &&
      externalPly !== currentPly &&
      externalPly >= 0 &&
      externalPly < historyFens.length
    ) {
      jumpToPly(externalPly);
    }
  }, [externalPly, currentPly, historyFens.length, jumpToPly]);

  const handleFirst = useCallback(() => jumpToPly(0), [jumpToPly]);
  const handlePrev = useCallback(() => jumpToPly(Math.max(0, currentPly - 1)), [jumpToPly, currentPly]);
  const handleNext = useCallback(
    () => jumpToPly(Math.min(historyFens.length - 1, currentPly + 1)),
    [jumpToPly, currentPly, historyFens.length]
  );
  const handleLast = useCallback(() => jumpToPly(historyFens.length - 1), [jumpToPly, historyFens.length]);
  const handleFlip = useCallback(() => setBoardOrientation((prev) => (prev === "white" ? "black" : "white")), []);

  // Keyboard navigation (< and > / Left and Right arrows / Home and End / F to flip)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "<" || e.key === ",") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight" || e.key === ">" || e.key === ".") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Home" || (e.key === "ArrowDown" && e.ctrlKey)) {
        e.preventDefault();
        handleFirst();
      } else if (e.key === "End" || (e.key === "ArrowUp" && e.ctrlKey)) {
        e.preventDefault();
        handleLast();
      } else if (e.key === "f" || e.key === "F") {
        handleFlip();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext, handleFirst, handleLast, handleFlip]);

  // Make move on the board
  const makeAMove = useCallback(
    (move: { from: string; to: string; promotion?: string }) => {
      try {
        const gameCopy = new Chess(game.fen());
        const result = gameCopy.move(move);
        if (result) {
          const newFen = gameCopy.fen();
          setGame(gameCopy);
          const nextPly = currentPly + 1;
          const newFens = historyFens.slice(0, currentPly + 1);
          newFens.push(newFen);
          setHistoryFens(newFens);
          setCurrentPly(nextPly);

          // Track in lastProcessedMoves so the moves useEffect won't duplicate
          const updatedMoves = [...moves.slice(0, currentPly), result.san];
          lastProcessedMoves.current = `${initialFen}__${updatedMoves.join(" ")}`;

          if (isEngineEnabled) {
            evaluateFen(newFen, 14);
          }

          // Update move list and notify parent
          if (onMovesChange) {
            onMovesChange(updatedMoves, nextPly, newFen);
          }
          if (onPositionChange) {
            onPositionChange(newFen, nextPly);
          }
          return true;
        }
      } catch {
        return false;
      }
      return false;
    },
    [game, currentPly, historyFens, moves, initialFen, isEngineEnabled, evaluateFen, onPositionChange, onMovesChange]
  );

  // Calculate legal move visual styles (dots for moves, rings for captures)
  const getMoveOptions = useCallback(
    (square: string) => {
      try {
        const moves = game.moves({
          square: square as Square,
          verbose: true,
        });

        if (moves.length === 0) {
          return {};
        }

        const options: Record<string, React.CSSProperties> = {};

        // Highlight selected square (soft amber glow)
        options[square] = {
          background: "rgba(250, 204, 21, 0.4)",
          boxShadow: "inset 0 0 0 2px rgba(234, 179, 8, 0.8)",
          borderRadius: "6px",
        };

        moves.forEach((move) => {
          const isCapture = Boolean(game.get(move.to as Square)) || move.captured;
          options[move.to] = {
            background: isCapture
              ? "radial-gradient(circle, transparent 52%, rgba(239, 68, 68, 0.45) 54%, rgba(239, 68, 68, 0.7) 70%, transparent 72%)"
              : "radial-gradient(circle, rgba(16, 185, 129, 0.75) 24%, transparent 25%)",
            boxShadow: isCapture ? "inset 0 0 0 3px rgba(239, 68, 68, 0.65)" : undefined,
            borderRadius: isCapture ? "8px" : "50%",
            cursor: "pointer",
          };
        });

        return options;
      } catch {
        return {};
      }
    },
    [game]
  );

  // Click-to-move square click handler
  const onSquareClick = useCallback(
    (square: string) => {
      // 1. If no piece was selected yet
      if (!moveFrom) {
        const piece = game.get(square as Square);
        // Only select pieces belonging to the current side to move
        if (piece && piece.color === game.turn()) {
          setMoveFrom(square);
          setOptionSquares(getMoveOptions(square));
        }
        return;
      }

      // 2. If clicking the exact same square -> Deselect
      if (square === moveFrom) {
        setMoveFrom(null);
        setOptionSquares({});
        return;
      }

      // 3. If clicking another friendly piece -> Switch selection
      const piece = game.get(square as Square);
      if (piece && piece.color === game.turn()) {
        setMoveFrom(square);
        setOptionSquares(getMoveOptions(square));
        return;
      }

      // 4. Try making a move to the clicked square
      const validMoves = game.moves({
        square: moveFrom as Square,
        verbose: true,
      });
      const isLegal = validMoves.some((m) => m.to === square);

      if (isLegal) {
        makeAMove({
          from: moveFrom,
          to: square,
          promotion: "q",
        });
      }

      // Always clear selection highlights after move attempt
      setMoveFrom(null);
      setOptionSquares({});
    },
    [moveFrom, game, getMoveOptions, makeAMove]
  );

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    setMoveFrom(null);
    setOptionSquares({});
    const move = makeAMove({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q",
    });
    return !!move;
  };

  // Calculate Eval Bar percentage (from White's perspective)
  const scoreCp = isEngineEnabled && evaluation ? evaluation.score : 0;
  const isMate = isEngineEnabled && evaluation ? evaluation.isMate : false;
  let whiteWinningPct = 50;
  if (isEngineEnabled && evaluation) {
    if (isMate) {
      whiteWinningPct = scoreCp > 0 ? 100 : 0;
    } else {
      // Normal sigmoid-like conversion: cp 0 = 50%, cp +300 = ~85%, cp -300 = ~15%
      whiteWinningPct = Math.min(98, Math.max(2, 50 + (scoreCp / 1000) * 50));
    }
  }

  return (
    <div className="flex flex-col items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm w-full max-w-[540px]">
      {/* Top Status Bar: Perspective only (Flip button removed as requested) */}
      <div className="w-full flex items-center justify-between pb-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
            <span
              className={`w-2.5 h-2.5 rounded-full border shadow-2xs ${
                boardOrientation === "white"
                  ? "bg-white border-slate-300 dark:border-slate-500"
                  : "bg-slate-900 border-slate-700"
              }`}
            />
            <span>Góc nhìn: {boardOrientation === "white" ? "Trắng" : "Đen"}</span>
          </span>
        </div>
      </div>

      {/* Board with Left Evaluation Bar */}
      <div className="flex items-stretch gap-2.5 w-full">
        {/* Eval Bar */}
        <div className="w-4 bg-slate-800 rounded-full overflow-hidden flex flex-col-reverse shadow-inner my-1">
          <div
            className="w-full bg-white transition-all duration-300 rounded-full"
            style={{ height: `${whiteWinningPct}%` }}
          />
        </div>

        {/* The Chessboard */}
        <div ref={boardContainerRef} className="flex-1 overflow-hidden rounded-xl shadow-md border-2 border-slate-800/10 dark:border-slate-700/50 flex justify-center">
          <Chessboard
            position={game.fen()}
            onPieceDrop={onDrop}
            onPieceDragBegin={() => {
              setMoveFrom(null);
              setOptionSquares({});
            }}
            onSquareClick={onSquareClick}
            customSquareStyles={optionSquares}
            boardOrientation={boardOrientation}
            boardWidth={boardWidth}
            customBoardStyle={{
              borderRadius: "0.75rem",
            }}
            customDarkSquareStyle={{ backgroundColor: "#779952" }}
            customLightSquareStyle={{ backgroundColor: "#edeed1" }}
          />
        </div>
      </div>

      {/* Navigation Controls Bar */}
      <div className="w-full flex items-center justify-center gap-2 pt-4">
        <button
          onClick={handleFirst}
          disabled={currentPly === 0}
          className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-slate-100 dark:disabled:hover:bg-slate-800/80 disabled:hover:text-slate-700 border border-slate-200/60 dark:border-slate-700/60 transition-all shadow-xs"
          title="Nước đầu tiên (Home)"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          onClick={handlePrev}
          disabled={currentPly === 0}
          className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-slate-100 dark:disabled:hover:bg-slate-800/80 disabled:hover:text-slate-700 border border-slate-200/60 dark:border-slate-700/60 transition-all shadow-xs"
          title="Lùi 1 nước (←)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={handleNext}
          disabled={currentPly >= historyFens.length - 1}
          className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-slate-100 dark:disabled:hover:bg-slate-800/80 disabled:hover:text-slate-700 border border-slate-200/60 dark:border-slate-700/60 transition-all shadow-xs"
          title="Tiến 1 nước (→)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={handleLast}
          disabled={currentPly >= historyFens.length - 1}
          className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white disabled:opacity-30 disabled:hover:bg-slate-100 dark:disabled:hover:bg-slate-800/80 disabled:hover:text-slate-700 border border-slate-200/60 dark:border-slate-700/60 transition-all shadow-xs"
          title="Nước cuối cùng (End)"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
        <button
          onClick={handleFlip}
          className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white border border-slate-200/60 dark:border-slate-700/60 transition-all shadow-xs"
          title="Xoay bàn cờ (F)"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
