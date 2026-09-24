"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Chess } from "chess.js";
import { EngineEvaluation } from "@/lib/stockfish/engineWorker";
import { sanToFigurine } from "@/lib/stockfish/pvFormatter";
import { Check, Settings, Loader2 } from "lucide-react";

interface MoveHistoryProps {
  moves: string[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
  currentFen?: string;
  evaluation?: EngineEvaluation | null;
  isThinking?: boolean;
  isEngineEnabled?: boolean;
  onToggleEngine?: () => void;
  multiPv?: number;
  onMultiPvChange?: (count: number) => void;
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
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);

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

  // Format Main Eval Score (e.g. +0.1, -1.4, #3)
  const scoreCp = evaluation?.score ?? 0;
  const isMate = evaluation?.isMate ?? false;
  let evalText = "—";
  let evalColor = "text-slate-900 dark:text-slate-100";

  if (isEngineOn && evaluation) {
    if (isMate) {
      const mateIn = evaluation.mateIn ?? 0;
      evalText = mateIn > 0 ? `#${mateIn}` : `#${mateIn}`;
      evalColor =
        mateIn > 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-600 dark:text-rose-400";
    } else {
      const pawns = scoreCp / 100;
      if (pawns === 0) {
        evalText = "0.0";
      } else {
        evalText = pawns > 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
      }

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
      {/* Top Engine & Eval Header */}
      <div className="px-3.5 py-2.5 bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800">
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

            {/* Engine Sub-info (SF 19 1MB NNUE + Depth) */}
            <div className="flex flex-col text-[11px] leading-tight">
              <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                <span>SF 19 1MB</span>
                <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                  NNUE
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1 py-0.2 rounded font-mono">
                  + Độ sâu {isEngineOn ? evaluation?.depth || 14 : 0}
                </span>
                {evaluation?.isCloud ? (
                  <span className="text-[9px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-1.5 py-0.2 rounded tracking-wide">
                    CLOUD
                  </span>
                ) : (
                  <span className="text-[9px] font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-1 py-0.2 rounded">
                    WASM
                  </span>
                )}
                {isThinking && (
                  <span title="Đang tính toán...">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Action: Settings */}
          <div className="flex items-center gap-1.5">
            {/* Settings Gear Popover */}
            <div className="relative">
              <button
                onClick={() => setShowSettingsPopover((prev) => !prev)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition cursor-pointer"
                title="Thông tin Engine"
              >
                <Settings className="w-4 h-4" />
              </button>
              {showSettingsPopover && (
                <div className="absolute right-0 top-8 z-20 w-64 rounded-xl bg-slate-900 text-slate-100 p-3 text-[11px] shadow-xl border border-slate-700 space-y-2">
                  <div className="font-bold text-emerald-400">Stockfish 19 NNUE & Cloud Eval</div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Độ sâu đám mây (Cloud):</span>
                    <span className="font-bold text-emerald-400">Độ sâu 40 - 75+</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Động cơ WASM cục bộ:</span>
                    <span className="font-bold text-white">Stockfish 19 NNUE (1MB)</span>
                  </div>
                  <div className="text-slate-400 text-[10px] pt-1.5 border-t border-slate-800 leading-relaxed">
                    Tích hợp kiến trúc Lichess: Tự động truy vấn Cloud Evaluation cho các nước khai cuộc đạt độ sâu tuyệt đối, kết hợp Stockfish 19 chạy trên Web Worker trình duyệt với rào chắn chống trôi lệnh.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Move list (Balanced 3-column layout matching Lichess) */}
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

            const whiteFigurine = sanToFigurine(pair.white);
            const blackFigurine = pair.black ? sanToFigurine(pair.black) : "";

            return (
              <div
                key={idx}
                className="grid grid-cols-[36px_1fr_1fr] items-center gap-1.5 rounded-lg text-xs"
              >
                {/* Gutter: Move Number */}
                <span className="text-center font-semibold text-slate-400 bg-slate-100/70 dark:bg-slate-800/70 rounded py-1 select-none text-[11px]">
                  {pair.number}
                </span>

                {/* White Move (With score pill when active, matching Lichess) */}
                <button
                  ref={isWhiteActive ? activeRef : undefined}
                  onClick={() => onSelectPly(whitePly)}
                  className={`px-2.5 py-1.5 rounded text-left transition flex items-center justify-between cursor-pointer ${
                    isWhiteActive
                      ? "bg-sky-600 text-white font-bold shadow-xs"
                      : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium"
                  }`}
                >
                  <span className="font-semibold text-xs">{whiteFigurine}</span>
                  {isWhiteActive && isEngineOn && evalText !== "—" && (
                    <span className="text-[10px] font-mono opacity-90 pl-1 font-bold">
                      {evalText}
                    </span>
                  )}
                </button>

                {/* Black Move (With score pill when active, matching Lichess) */}
                {pair.black ? (
                  <button
                    ref={isBlackActive ? activeRef : undefined}
                    onClick={() => onSelectPly(blackPly)}
                    className={`px-2.5 py-1.5 rounded text-left transition flex items-center justify-between cursor-pointer ${
                      isBlackActive
                        ? "bg-sky-600 text-white font-bold shadow-xs"
                        : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium"
                    }`}
                  >
                    <span className="font-semibold text-xs">{blackFigurine}</span>
                    {isBlackActive && isEngineOn && evalText !== "—" && (
                      <span className="text-[10px] font-mono opacity-90 pl-1 font-bold">
                        {evalText}
                      </span>
                    )}
                  </button>
                ) : (
                  <span />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
