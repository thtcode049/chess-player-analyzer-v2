"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { 
  RotateCw, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Cpu, 
  Zap 
} from "lucide-react";
import { useStockfish } from "@/lib/stockfish/useStockfish";

interface ChessBoardProps {
  initialFen?: string;
  moves?: string[]; // Array of SAN moves
  orientation?: "white" | "black";
  onPositionChange?: (fen: string, ply: number) => void;
  height?: number;
}

export default function ChessBoard({
  initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  moves = [],
  orientation = "white",
  onPositionChange,
  height = 480,
}: ChessBoardProps) {
  const [game, setGame] = useState(new Chess(initialFen));
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(orientation);
  const [currentPly, setCurrentPly] = useState(0);
  const [historyFens, setHistoryFens] = useState<string[]>([initialFen]);
  
  // Stockfish WASM client hook
  const { evaluation, isThinking, evaluateFen } = useStockfish();

  // Reset or initialize if moves prop changes
  useEffect(() => {
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

    setGame(newGame);
    setHistoryFens(fens);
    const lastPly = fens.length - 1;
    setCurrentPly(lastPly);
    evaluateFen(newGame.fen(), 10);
  }, [moves, initialFen, evaluateFen]);

  // Navigate to specific ply
  const jumpToPly = useCallback((targetPly: number) => {
    if (targetPly < 0 || targetPly >= historyFens.length) return;
    const targetFen = historyFens[targetPly];
    const updatedGame = new Chess(targetFen);
    setGame(updatedGame);
    setCurrentPly(targetPly);
    evaluateFen(targetFen, 10);
    if (onPositionChange) {
      onPositionChange(targetFen, targetPly);
    }
  }, [historyFens, evaluateFen, onPositionChange]);

  const handleFirst = () => jumpToPly(0);
  const handlePrev = () => jumpToPly(Math.max(0, currentPly - 1));
  const handleNext = () => jumpToPly(Math.min(historyFens.length - 1, currentPly + 1));
  const handleLast = () => jumpToPly(historyFens.length - 1);
  const handleFlip = () => setBoardOrientation((prev) => (prev === "white" ? "black" : "white"));

  // Make move on the board
  const makeAMove = useCallback(
    (move: { from: string; to: string; promotion?: string }) => {
      try {
        const gameCopy = new Chess(game.fen());
        const result = gameCopy.move(move);
        if (result) {
          const newFen = gameCopy.fen();
          setGame(gameCopy);
          const newFens = historyFens.slice(0, currentPly + 1);
          newFens.push(newFen);
          setHistoryFens(newFens);
          setCurrentPly(newFens.length - 1);
          evaluateFen(newFen, 12);
          if (onPositionChange) {
            onPositionChange(newFen, newFens.length - 1);
          }
          return true;
        }
      } catch {
        return false;
      }
      return false;
    },
    [game, historyFens, currentPly, evaluateFen, onPositionChange]
  );

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    const move = makeAMove({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q",
    });
    return !!move;
  };

  // Calculate Eval Bar percentage (from White's perspective)
  const scoreCp = evaluation?.score ?? 0;
  const isMate = evaluation?.isMate ?? false;
  let whiteWinningPct = 50;
  if (isMate) {
    whiteWinningPct = scoreCp > 0 ? 100 : 0;
  } else {
    // Normal sigmoid-like conversion: cp 0 = 50%, cp +300 = ~85%, cp -300 = ~15%
    whiteWinningPct = Math.min(98, Math.max(2, 50 + (scoreCp / 1000) * 50));
  }

  const evalDisplay = isMate
    ? `#${evaluation?.mateIn ?? ""}`
    : `${(scoreCp / 100).toFixed(1)}`;

  return (
    <div className="flex flex-col items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm w-full max-w-[540px]">
      {/* Top Engine & Status Bar */}
      <div className="w-full flex items-center justify-between pb-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {boardOrientation === "white" ? "⚪ Trắng" : "⚫ Đen"} POV
          </span>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <span>Nước: {currentPly} / {historyFens.length - 1}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
          <Cpu className="w-3.5 h-3.5 text-emerald-500" />
          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
            {evalDisplay}
          </span>
          {isThinking && <Zap className="w-3 h-3 text-amber-500 animate-pulse" />}
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
        <div className="flex-1 overflow-hidden rounded-xl shadow-md border-2 border-slate-800/10 dark:border-slate-700/50">
          <Chessboard
            position={game.fen()}
            onPieceDrop={onDrop}
            boardOrientation={boardOrientation}
            customBoardStyle={{
              borderRadius: "8px",
            }}
            customDarkSquareStyle={{ backgroundColor: "#779952" }}
            customLightSquareStyle={{ backgroundColor: "#edeed1" }}
          />
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="w-full flex items-center justify-center gap-2 pt-4">
        <button
          onClick={handleFirst}
          disabled={currentPly === 0}
          className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition"
          title="Nước đầu tiên"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button
          onClick={handlePrev}
          disabled={currentPly === 0}
          className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition"
          title="Lùi 1 nước"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={handleNext}
          disabled={currentPly >= historyFens.length - 1}
          className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition"
          title="Tiến 1 nước"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={handleLast}
          disabled={currentPly >= historyFens.length - 1}
          className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 transition"
          title="Nước cuối cùng"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
        <button
          onClick={handleFlip}
          className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          title="Xoay bàn cờ"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
