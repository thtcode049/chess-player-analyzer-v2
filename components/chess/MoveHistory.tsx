"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Chess } from "chess.js";
import { EngineEvaluation } from "@/lib/stockfish/engineWorker";
import { formatPvToSan } from "@/lib/stockfish/pvFormatter";
import { Check, Settings, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface MoveHistoryProps {
  moves: string[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
  currentFen?: string;
  evaluation?: EngineEvaluation | null;
  isThinking?: boolean;
  isEngineEnabled?: boolean;
  onToggleEngine?: () => void;
}

export default function MoveHistory({
  moves = [],
  currentPly = 0,
  onSelectPly,
  currentFen,
  evaluation = null,
  isThinking = false,
  isEngineEnabled = true,
  onToggleEngine,
}: MoveHistoryProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const [internalEngineEnabled, setInternalEngineEnabled] = useState(true);
  const [isPvExpanded, setIsPvExpanded] = useState(false);
  const [showSettingsTooltip, setShowSettingsTooltip] = useState(false);

  // Controlled or uncontrolled engine toggle
  const isEngineOn = onToggleEngine !== undefined ? isEngineEnabled : internalEngineEnabled;
  const handleToggle = () => {
    if (onToggleEngine) {
      onToggleEngine();
    } else {
      setInternalEngineEnabled((prev) => !prev);
    }
  };

  // Derive active FEN if not provided directly
  const activeFen = useMemo(() => {
    if (currentFen) return currentFen;
    try {
      const g = new Chess();
      for (let i = 0; i < Math.min(moves.length, currentPly); i++) {
        g.move(moves[i]);
      }
      return g.fen();
    } catch {
      return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    }
  }, [currentFen, moves, currentPly]);

  // Format Principal Variation (best line) into SAN with figurines
  const bestLine = useMemo(() => {
    if (!isEngineOn || !evaluation?.pv || evaluation.pv.length === 0) return "";
    return formatPvToSan(evaluation.pv, activeFen, isPvExpanded ? 24 : 10, true);
  }, [isEngineOn, evaluation?.pv, activeFen, isPvExpanded]);

  // Auto-scroll to active move
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentPly]);

  // Group moves into pairs (White, Black)
  const movePairs: Array<{ number: number; white: string; black?: string }> = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  // Format Eval Score (e.g. +0.2, -1.4, #3)
  const scoreCp = evaluation?.score ?? 0;
  const isMate = evaluation?.isMate ?? false;
  let evalText = "—";
  let evalColor = "text-slate-900 dark:text-slate-100";

  if (isEngineOn && evaluation) {
    if (isMate) {
      evalText = `#${evaluation.mateIn ?? ""}`;
      evalColor =
        (evaluation.mateIn ?? 0) > 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-600 dark:text-rose-400";
    } else {
      const pawns = scoreCp / 100;
      evalText = pawns > 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
      if (pawns >= 0.3) {
        evalColor = "text-emerald-600 dark:text-emerald-400";
      } else if (pawns <= -0.3) {
        evalColor = "text-slate-600 dark:text-slate-400";
      } else {
        evalColor = "text-slate-800 dark:text-slate-200";
      }
    }
  }

  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm h-full">
      {/* Top Engine & Eval Header (Matching Lichess / User Reference) */}
      <div className="px-3.5 py-2.5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Engine On/Off Toggle Switch */}
            <button
              type="button"
              onClick={handleToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-hidden ${
                isEngineOn ? "bg-emerald-600 shadow-xs" : "bg-slate-300 dark:bg-slate-700"
              }`}
              title={isEngineOn ? "Tắt tính toán Stockfish" : "Bật tính toán Stockfish"}
            >
              <span
                className={`inline-flex h-4 w-4 transform items-center justify-center rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                  isEngineOn ? "translate-x-6" : "translate-x-1"
                }`}
              >
                {isEngineOn ? (
                  <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                )}
              </span>
            </button>

            {/* Large Bold Evaluation Score */}
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-black font-mono tracking-tight ${evalColor}`}>
                {evalText}
              </span>
            </div>

            {/* Engine Sub-info (SF 17 NNUE + Depth) */}
            <div className="flex flex-col text-[11px] leading-tight">
              <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                <span>SF 17 NNUE</span>
                <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 rounded">
                  WASM
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded font-mono">
                  + Độ sâu {isEngineOn ? evaluation?.depth || 25 : 0}
                </span>
                {isThinking && (
                  <span title="Đang đào sâu tính toán...">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Action: Settings Gear */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsTooltip((prev) => !prev)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition"
              title="Thông tin Stockfish 17"
            >
              <Settings className="w-4 h-4" />
            </button>
            {showSettingsTooltip && (
              <div className="absolute right-0 top-7 z-20 w-48 rounded-xl bg-slate-900 text-slate-100 p-2.5 text-[11px] shadow-xl border border-slate-700">
                <div className="font-bold text-emerald-400">Stockfish 17 NNUE</div>
                <div className="text-slate-300 mt-1">Độ sâu tối đa: 25 plies</div>
                <div className="text-slate-400 text-[10px] mt-1">Phân tích song song trên Web Workers của trình duyệt.</div>
              </div>
            )}
          </div>
        </div>

        {/* Principal Variation / Biến tốt nhất của Stockfish */}
        {isEngineOn && (
          <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800/80">
            <div className="flex items-start justify-between gap-1 text-xs font-mono text-slate-700 dark:text-slate-300">
              <div className="flex-1 leading-relaxed">
                {bestLine ? (
                  <span>{bestLine}</span>
                ) : isThinking ? (
                  <span className="text-slate-400 italic font-sans flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-500 inline" />
                    Đang tính biến tốt nhất...
                  </span>
                ) : (
                  <span className="text-slate-400 italic font-sans">Sẵn sàng phân tích</span>
                )}
              </div>
              {bestLine && (
                <button
                  onClick={() => setIsPvExpanded((prev) => !prev)}
                  className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition shrink-0"
                  title={isPvExpanded ? "Thu gọn" : "Xem thêm nước tiếp theo"}
                >
                  {isPvExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Move list */}
      <div className="flex-1 overflow-y-auto max-h-[380px] p-2 space-y-1 text-sm font-mono scroll-smooth">
        {movePairs.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 font-sans">
            Chưa có nước đi nào
          </div>
        ) : (
          movePairs.map((pair, idx) => {
            const whitePly = idx * 2 + 1;
            const blackPly = idx * 2 + 2;

            const isWhiteActive = currentPly === whitePly;
            const isBlackActive = currentPly === blackPly;

            return (
              <div
                key={idx}
                className="flex items-center rounded-lg px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
              >
                {/* Move Number */}
                <span className="w-10 text-slate-400 font-semibold select-none">
                  {pair.number}.
                </span>

                {/* White Move */}
                <button
                  ref={isWhiteActive ? activeRef : undefined}
                  onClick={() => onSelectPly(whitePly)}
                  className={`flex-1 text-left px-2 py-1 rounded font-medium transition ${
                    isWhiteActive
                      ? "bg-emerald-500 text-white font-bold shadow-sm shadow-emerald-500/30"
                      : "text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400"
                  }`}
                >
                  {pair.white}
                </button>

                {/* Black Move */}
                {pair.black ? (
                  <button
                    ref={isBlackActive ? activeRef : undefined}
                    onClick={() => onSelectPly(blackPly)}
                    className={`flex-1 text-left px-2 py-1 rounded font-medium transition ${
                      isBlackActive
                        ? "bg-emerald-500 text-white font-bold shadow-sm shadow-emerald-500/30"
                        : "text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400"
                    }`}
                  >
                    {pair.black}
                  </button>
                ) : (
                  <span className="flex-1" />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
