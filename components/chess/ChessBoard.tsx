"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
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
  onBoardWidthChange?: (width: number) => void;
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
  height = 680,
  onBoardWidthChange,
}: ChessBoardProps) {
  const [game, setGame] = useState(new Chess(initialFen));
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(orientation);
  const [currentPly, setCurrentPly] = useState(0);
  const [historyFens, setHistoryFens] = useState<string[]>([initialFen]);
  const lastProcessedMoves = useRef<string>("");
  const rootRef = useRef<HTMLDivElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const estCol = Math.min(window.innerWidth - 80, 680);
      const estHeight = window.innerHeight - 92;
      return Math.min(height, Math.max(240, estCol - 24), Math.max(240, estHeight));
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
    const updateSize = (measuredWidth?: number) => {
      const containerWidth = measuredWidth ?? rootRef.current?.clientWidth ?? 0;
      if (containerWidth > 0) {
        // 14px eval bar + 8px gap + 2px buffer = 24px
        const availableWidth = Math.max(200, containerWidth - 24);
        // Max vertical space in viewport without scrolling:
        // innerHeight - Navbar (64) - top spacing (12) - bottom buffer (16) = ~92px
        const availableHeight = typeof window !== "undefined"
          ? Math.max(240, window.innerHeight - 92)
          : height;
        const optimal = Math.floor(Math.min(height, availableWidth, availableHeight));
        const newSize = Math.max(240, optimal);

        setBoardWidth(newSize);
        onBoardWidthChange?.(newSize);
      } else if (typeof window !== "undefined") {
        const fallbackAvailable = Math.max(200, Math.min(window.innerWidth - 80, 680) - 24);
        const fallbackHeight = Math.max(240, window.innerHeight - 92);
        const newSize = Math.floor(Math.min(height, fallbackAvailable, fallbackHeight));
        setBoardWidth(newSize);
        onBoardWidthChange?.(newSize);
      }
    };

    updateSize();

    const handleWindowResize = () => updateSize();
    window.addEventListener("resize", handleWindowResize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && rootRef.current) {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            updateSize(entry.contentRect.width);
          }
        }
      });
      observer.observe(rootRef.current);
    }

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [height, onBoardWidthChange]);

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
      } catch { }
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

        // Highlight selected square (soft yellow-green tint matching the board)
        options[square] = {
          background: "rgba(245, 246, 130, 0.45)",
          boxShadow: "inset 0 0 0 2px rgba(215, 218, 90, 0.7)",
          borderRadius: "4px",
        };

        moves.forEach((move) => {
          const isCapture = Boolean(game.get(move.to as Square)) || move.captured;
          options[move.to] = {
            background: isCapture
              ? "radial-gradient(circle, transparent 56%, rgba(0, 0, 0, 0.22) 57%, rgba(0, 0, 0, 0.22) 70%, transparent 71%)"
              : "radial-gradient(circle, rgba(0, 0, 0, 0.22) 19%, transparent 20%)",
            borderRadius: "50%",
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
    <div ref={rootRef} className="flex flex-col items-center w-full">
      {/* Board with Left Evaluation Bar */}
      <div
        className="flex items-stretch gap-2 justify-center"
        style={{ height: `${boardWidth}px` }}
      >
        {/* Eval Bar */}
        <div className="w-3.5 bg-slate-900 rounded-[3px] overflow-hidden flex flex-col-reverse shrink-0 border border-slate-500 dark:border-slate-500 shadow-xs ring-1 ring-black/10 dark:ring-white/10">
          <div
            className="w-full bg-white transition-all duration-300 border-t border-slate-400/80 dark:border-slate-600"
            style={{ height: `${whiteWinningPct}%` }}
          />
        </div>

        {/* The Chessboard */}
        <div
          ref={boardContainerRef}
          style={{ width: `${boardWidth}px`, height: `${boardWidth}px` }}
          className="overflow-hidden rounded-[3px] flex justify-center shrink-0"
        >
          <Chessboard
            key={`board-${boardWidth}`}
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
              borderRadius: "3px",
            }}
            customDarkSquareStyle={{ backgroundColor: "#779952" }}
            customLightSquareStyle={{ backgroundColor: "#edeed1" }}
          />
        </div>
      </div>
    </div>
  );
}
