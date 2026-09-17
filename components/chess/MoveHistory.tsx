"use client";

import React, { useEffect, useRef } from "react";

interface MoveHistoryProps {
  moves: string[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
}

export default function MoveHistory({
  moves = [],
  currentPly = 0,
  onSelectPly,
}: MoveHistoryProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

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

  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Biên bản Nước đi ({moves.length} plies)
        </span>
        {currentPly > 0 && (
          <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            Nước {currentPly} / {moves.length}
          </span>
        )}
      </div>

      {/* Move list */}
      <div className="flex-1 overflow-y-auto max-h-[360px] p-2 space-y-1 text-sm font-mono scroll-smooth">
        {movePairs.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
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
