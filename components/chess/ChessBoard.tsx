"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useStockfish } from "@/lib/stockfish/useStockfish";
import { EngineEvaluation } from "@/lib/stockfish/engineWorker";
import { normalizeFen } from "@/lib/chess/notation";

function tryCreateChess(fen?: string): Chess {
  if (!fen) return new Chess();
  try {
    return new Chess(normalizeFen(fen));
  } catch {
    return new Chess();
  }
}

function checkPlayable(fen: string): boolean {
  if (!fen) return false;
  try {
    new Chess(normalizeFen(fen));
    return true;
  } catch {
    return false;
  }
}

export const BOARD_PLAYERS_BAR_HEIGHT = 68;

export interface BoardPlayersInfo {
  whiteName: string;
  whiteElo?: number | null;
  blackName: string;
  blackElo?: number | null;
  result?: string | null;
}

function getSideScoreLabel(result: string | null | undefined, side: "white" | "black"): string | null {
  if (!result) return null;
  const r = result.trim();
  if (r === "1-0") return side === "white" ? "1" : "0";
  if (r === "0-1") return side === "black" ? "1" : "0";
  if (r === "1/2-1/2" || r === "½-½") return "½";
  return null;
}

function BoardPlayerStrip({
  side,
  name,
  elo,
  scoreLabel,
  boardWidth,
  offsetLeft,
  position,
}: {
  side: "white" | "black";
  name: string;
  elo?: number | null;
  scoreLabel: string | null;
  boardWidth: number;
  offsetLeft: number;
  position: "top" | "bottom";
}) {
  const validElo = elo && Number(elo) > 0 ? Math.round(Number(elo)) : null;
  const isWinner = scoreLabel === "1";

  return (
    <div
      style={{
        width: `${boardWidth + offsetLeft}px`,
        paddingLeft: `${offsetLeft}px`,
      }}
      className={`h-7 flex items-center justify-between gap-2 select-none shrink-0 ${
        position === "top" ? "mb-1.5" : "mt-1.5"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Piece-color avatar badge (Chess.com style) */}
        <div
          className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border shadow-2xs ${
            side === "white"
              ? "bg-slate-100 dark:bg-slate-200 border-slate-300 dark:border-slate-400"
              : "bg-slate-200/90 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
          }`}
          title={side === "white" ? "Quân Trắng" : "Quân Đen"}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
            <path
              d="M12 3.5a3.2 3.2 0 0 0-2.1 5.62c-.83.52-1.35 1.38-1.35 2.33h.95c-.38 2.15-1.45 3.92-2.75 5.05-.47.41-.75.99-.75 1.62V19.5c0 .55.45 1 1 1h10c.55 0 1-.45 1-1v-1.38c0-.63-.28-1.21-.75-1.62-1.3-1.13-2.37-2.9-2.75-5.05h.95c0-.95-.52-1.81-1.35-2.33A3.2 3.2 0 0 0 12 3.5Z"
              fill={side === "white" ? "#ffffff" : "#1e293b"}
              stroke={side === "white" ? "#334155" : "#0f172a"}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="flex items-baseline gap-1.5 min-w-0">
          <span
            className="font-bold text-[13px] sm:text-sm text-slate-900 dark:text-slate-100 truncate"
            title={name}
          >
            {name}
          </span>
          {validElo !== null && (
            <span className="text-xs sm:text-[13px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
              ({validElo})
            </span>
          )}
        </div>
      </div>

      {scoreLabel !== null && (
        <span
          className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold shrink-0 ${
            isWinner
              ? side === "white"
                ? "bg-white text-slate-900 border border-slate-300 shadow-2xs"
                : "bg-slate-900 text-white border border-slate-700 dark:border-slate-600 shadow-2xs"
              : "bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/60 dark:border-slate-700"
          }`}
        >
          {scoreLabel}
        </span>
      )}
    </div>
  );
}

interface ChessBoardProps {
  initialFen?: string;
  moves?: string[]; // Array of SAN moves
  currentPly?: number; // Controlled ply from parent
  orientation?: "white" | "black";
  onOrientationChange?: (orientation: "white" | "black") => void;
  playersInfo?: BoardPlayersInfo | null;
  onPositionChange?: (fen: string, ply: number) => void;
  onMovesChange?: (moves: string[], currentPly: number, fen: string) => void;
  onMakeMove?: (san: string, newFen: string) => void;
  onEvaluationChange?: (evaluation: EngineEvaluation | null, isThinking: boolean) => void;
  isEngineEnabled?: boolean;
  multiPv?: number;
  height?: number;
  onBoardWidthChange?: (width: number) => void;
  fitParentHeight?: boolean;
}

export default function ChessBoard({
  initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  moves = [],
  currentPly: externalPly,
  orientation = "white",
  onOrientationChange,
  playersInfo = null,
  onPositionChange,
  onMovesChange,
  onMakeMove,
  onEvaluationChange,
  isEngineEnabled = true,
  height = 680,
  onBoardWidthChange,
  fitParentHeight = false,
}: ChessBoardProps) {
  const [game, setGame] = useState(() => tryCreateChess(initialFen));
  const [currentPositionFen, setCurrentPositionFen] = useState<string>(
    () => normalizeFen(initialFen) || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  );
  const isPlayable = useMemo(() => checkPlayable(currentPositionFen), [currentPositionFen]);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(orientation);
  const [currentPly, setCurrentPly] = useState(0);
  const [historyFens, setHistoryFens] = useState<string[]>([normalizeFen(initialFen)]);
  const lastProcessedMoves = useRef<string>("");
  const rootRef = useRef<HTMLDivElement>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const hasPlayersBar = Boolean(playersInfo);
  const [boardWidth, setBoardWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const extraBars = playersInfo ? BOARD_PLAYERS_BAR_HEIGHT : 0;
      const estCol = Math.min(window.innerWidth - 80, 720);
      const estHeight = window.innerHeight - 140 - extraBars;
      return Math.min(height, Math.max(280, estCol - 24), Math.max(280, estHeight));
    }
    return height;
  });

  useEffect(() => {
    setBoardOrientation(orientation);
  }, [orientation]);

  // Click-to-move and legal move highlighting state
  const [moveFrom, setMoveFrom] = useState<string | null>(null);
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});

  // Right-click interactive highlights & arrows (Lichess/Chess.com style)
  const [rightClickedSquares, setRightClickedSquares] = useState<Record<string, React.CSSProperties>>({});
  const [customArrows, setCustomArrows] = useState<Array<[Square, Square, string?]>>([]);

  // Reset selection and annotations when ply or FEN changes
  useEffect(() => {
    setMoveFrom(null);
    setOptionSquares({});
    setRightClickedSquares({});
    setCustomArrows([]);
  }, [currentPly, initialFen]);

  useEffect(() => {
    let lastWidth = 0;
    let lastHeight = 0;
    let lastReported = 0;

    const updateSize = () => {
      if (!rootRef.current) return;
      const parent = rootRef.current.parentElement || rootRef.current;
      const parentWidth = parent.clientWidth || rootRef.current.clientWidth || 0;
      const parentHeight = parent.clientHeight || 0;

      if (parentWidth <= 0) return;

      // 14px eval bar + 10px gap = 24px
      const availableWidth = Math.max(220, parentWidth - 24);
      const extraBars = hasPlayersBar ? BOARD_PLAYERS_BAR_HEIGHT : 0;

      let optimal: number;
      if (fitParentHeight) {
        // Only fit parent height if explicitly requested (e.g. in bounded flex containers like ai-coach)
        const availableHeight = parentHeight > 80 ? Math.max(200, parentHeight - 8 - extraBars) : height;
        optimal = Math.floor(Math.min(height, availableWidth, availableHeight));
      } else {
        // In standard pages (analyze, games), board size matches column width, capped by height and viewport
        const viewportMax =
          typeof window !== "undefined" ? Math.max(320, window.innerHeight - 170 - extraBars) : height;
        optimal = Math.floor(Math.min(height, availableWidth, viewportMax));
      }

      const newSize = Math.max(220, optimal);

      if (Math.abs(lastReported - newSize) >= 2) {
        lastReported = newSize;
        onBoardWidthChange?.(newSize);
      }

      setBoardWidth((prev) => (Math.abs(prev - newSize) >= 2 ? newSize : prev));
    };

    updateSize();

    const handleWindowResize = () => updateSize();
    window.addEventListener("resize", handleWindowResize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      const target = rootRef.current?.parentElement || rootRef.current;
      if (target) {
        observer = new ResizeObserver((entries) => {
          if (!entries || entries.length === 0) return;
          const cr = entries[0].contentRect;
          // Only trigger if width changed (or height changed in fitParentHeight mode) to prevent recursive loop
          if (
            Math.abs(cr.width - lastWidth) >= 4 ||
            (fitParentHeight && Math.abs(cr.height - lastHeight) >= 4)
          ) {
            lastWidth = cr.width;
            lastHeight = cr.height;
            updateSize();
          }
        });
        observer.observe(target);
      }
    }

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [height, fitParentHeight, hasPlayersBar, onBoardWidthChange]);

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
      const playable = checkPlayable(targetFen);
      if (playable) {
        try {
          setGame(new Chess(targetFen));
        } catch {}
      }
      setCurrentPositionFen(targetFen);
      setCurrentPly(targetPly);

      if (isEngineEnabled && playable) {
        evaluateFen(targetFen, 14);
      } else if (!playable) {
        stop();
      }
      if (onPositionChange) {
        onPositionChange(targetFen, targetPly);
      }
    },
    [historyFens, isEngineEnabled, evaluateFen, stop, onPositionChange]
  );

  // Stop or restart evaluation ONLY when isEngineEnabled toggles
  useEffect(() => {
    if (!isEngineEnabled || !isPlayable) {
      stop();
    } else {
      const activeFen = historyFens[currentPly] || currentPositionFen;
      if (checkPlayable(activeFen)) {
        evaluateFen(activeFen, 14);
      }
    }
  }, [isEngineEnabled, isPlayable]);

  // Reset or initialize if external moves or initialFen prop changes
  useEffect(() => {
    const cleanInitial = normalizeFen(initialFen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    const movesKey = `${cleanInitial}__${moves.join(" ")}`;
    if (movesKey === lastProcessedMoves.current) {
      return;
    }
    lastProcessedMoves.current = movesKey;

    const playable = checkPlayable(cleanInitial);
    if (!playable) {
      // Non-playable board (e.g. bare pawn skeleton without kings)
      setHistoryFens([cleanInitial]);
      setCurrentPositionFen(cleanInitial);
      setCurrentPly(0);
      stop();
      if (onPositionChange) {
        onPositionChange(cleanInitial, 0);
      }
      return;
    }

    const newGame = new Chess();
    if (cleanInitial && cleanInitial !== "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") {
      try {
        newGame.load(cleanInitial);
      } catch {}
    }
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
    }

    setHistoryFens(fens);

    // Determine starting ply: prioritize externalPly if valid, otherwise end of game
    const targetPly =
      typeof externalPly === "number" && externalPly >= 0 && externalPly < fens.length
        ? externalPly
        : fens.length - 1;

    const targetFen = fens[targetPly];
    try {
      setGame(new Chess(targetFen));
    } catch {}
    setCurrentPositionFen(targetFen);
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
  const handleFlip = useCallback(() => {
    setBoardOrientation((prev) => {
      const next = prev === "white" ? "black" : "white";
      onOrientationChange?.(next);
      return next;
    });
  }, [onOrientationChange]);

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
      if (!isPlayable) return false;
      try {
        const gameCopy = new Chess(currentPositionFen);
        const result = gameCopy.move(move);
        if (result) {
          const newFen = gameCopy.fen();
          setGame(gameCopy);
          setCurrentPositionFen(newFen);
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
          if (onMakeMove) {
            onMakeMove(result.san, newFen);
          } else {
            if (onMovesChange) {
              onMovesChange(updatedMoves, nextPly, newFen);
            }
            if (onPositionChange) {
              onPositionChange(newFen, nextPly);
            }
          }
          return true;
        }
      } catch {
        return false;
      }
      return false;
    },
    [isPlayable, currentPositionFen, currentPly, historyFens, moves, initialFen, isEngineEnabled, evaluateFen, onPositionChange, onMovesChange, onMakeMove]
  );

  // Calculate legal move visual styles (dots for moves, rings for captures)
  const getMoveOptions = useCallback(
    (square: string) => {
      if (!isPlayable) return {};
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
    [game, isPlayable]
  );

  // Handle right-click on square to toggle highlight (red-orange)
  const onSquareRightClick = useCallback((square: Square) => {
    setRightClickedSquares((prev) => {
      const next = { ...prev };
      if (next[square]) {
        delete next[square];
      } else {
        next[square] = {
          backgroundColor: "rgba(235, 97, 80, 0.65)",
        };
      }
      return next;
    });
  }, []);

  // Handle right-click arrow changes (drawing or clearing arrows)
  const handleArrowsChange = useCallback((arrows: Array<[Square, Square, string?]>) => {
    setCustomArrows(arrows);
  }, []);

  // Combine right-click highlights and move option highlights
  const mergedSquareStyles = useMemo(() => {
    return {
      ...rightClickedSquares,
      ...optionSquares,
    };
  }, [rightClickedSquares, optionSquares]);

  // Click-to-move square click handler
  const onSquareClick = useCallback(
    (square: string) => {
      // Clear right-click marks on any left-click interaction
      setRightClickedSquares({});
      setCustomArrows([]);

      if (!isPlayable) return;

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
    [isPlayable, moveFrom, game, getMoveOptions, makeAMove]
  );

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    setMoveFrom(null);
    setOptionSquares({});
    setRightClickedSquares({});
    setCustomArrows([]);
    if (!isPlayable) return false;
    const move = makeAMove({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q",
    });
    return !!move;
  };

  // Calculate Eval Bar percentage (from White's perspective)
  const scoreCp = isEngineEnabled && isPlayable && evaluation ? evaluation.score : 0;
  const isMate = isEngineEnabled && isPlayable && evaluation ? evaluation.isMate : false;
  let whiteWinningPct = 50;
  if (isEngineEnabled && isPlayable && evaluation) {
    if (isMate) {
      whiteWinningPct = scoreCp > 0 ? 100 : 0;
    } else {
      // Normal sigmoid-like conversion: cp 0 = 50%, cp +300 = ~85%, cp -300 = ~15%
      whiteWinningPct = Math.min(98, Math.max(2, 50 + (scoreCp / 1000) * 50));
    }
  }

  const topSide: "white" | "black" = boardOrientation === "white" ? "black" : "white";
  const bottomSide: "white" | "black" = boardOrientation === "white" ? "white" : "black";
  const evalBarOffset = isPlayable ? 24 : 0;

  return (
    <div ref={rootRef} className="flex flex-col items-center justify-center w-full h-full py-1">
      {playersInfo ? (
        <BoardPlayerStrip
          position="top"
          side={topSide}
          name={topSide === "white" ? playersInfo.whiteName : playersInfo.blackName}
          elo={topSide === "white" ? playersInfo.whiteElo : playersInfo.blackElo}
          scoreLabel={getSideScoreLabel(playersInfo.result, topSide)}
          boardWidth={boardWidth}
          offsetLeft={evalBarOffset}
        />
      ) : null}

      {/* Board with Left Evaluation Bar */}
      <div
        className="flex items-stretch gap-2.5 justify-center"
        style={{ height: `${boardWidth}px` }}
      >
        {/* Eval Bar (Only displayed for playable positions) */}
        {isPlayable ? (
          <div
            className={`w-3.5 bg-slate-900 rounded-md overflow-hidden flex ${
              boardOrientation === "white" ? "flex-col-reverse" : "flex-col"
            } shrink-0 border border-slate-500/80 dark:border-slate-500/80 shadow-xs ring-1 ring-black/10 dark:ring-white/10`}
          >
            <div
              className={`w-full bg-white transition-all duration-300 ${
                boardOrientation === "white" ? "border-t" : "border-b"
              } border-slate-400/80 dark:border-slate-600`}
              style={{ height: `${whiteWinningPct}%` }}
            />
          </div>
        ) : null}

        {/* The Chessboard */}
        <div
          ref={boardContainerRef}
          style={{ width: `${boardWidth}px`, height: `${boardWidth}px` }}
          onContextMenu={(e) => e.preventDefault()}
          onMouseDown={(e) => {
            // Left click on board clears right-click highlights and arrows
            if (e.button === 0) {
              setRightClickedSquares({});
              setCustomArrows([]);
            }
          }}
          className="overflow-hidden rounded-md border border-slate-300 dark:border-slate-700 shadow-xs flex justify-center shrink-0 select-none bg-[#edeed1]"
        >
          <Chessboard
            key={`cb-${boardWidth}-${boardOrientation}`}
            position={currentPositionFen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"}
            onPieceDrop={onDrop}
            onPieceDragBegin={() => {
              setMoveFrom(null);
              setOptionSquares({});
              setRightClickedSquares({});
              setCustomArrows([]);
            }}
            onSquareClick={onSquareClick}
            onSquareRightClick={onSquareRightClick}
            customSquareStyles={mergedSquareStyles}
            areArrowsAllowed={true}
            customArrows={customArrows}
            onArrowsChange={handleArrowsChange}
            customArrowColor="rgb(235, 97, 80)"
            boardOrientation={boardOrientation}
            boardWidth={boardWidth || 360}
            customBoardStyle={{
              borderRadius: "3px",
            }}
            customDarkSquareStyle={{ backgroundColor: "#779952" }}
            customLightSquareStyle={{ backgroundColor: "#edeed1" }}
          />
        </div>
      </div>

      {playersInfo ? (
        <BoardPlayerStrip
          position="bottom"
          side={bottomSide}
          name={bottomSide === "white" ? playersInfo.whiteName : playersInfo.blackName}
          elo={bottomSide === "white" ? playersInfo.whiteElo : playersInfo.blackElo}
          scoreLabel={getSideScoreLabel(playersInfo.result, bottomSide)}
          boardWidth={boardWidth}
          offsetLeft={evalBarOffset}
        />
      ) : null}
    </div>
  );
}
