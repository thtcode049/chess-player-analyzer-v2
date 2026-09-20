"use client";

import React from "react";
import { AlertTriangle, ChevronRight, ArrowRight } from "lucide-react";
import { CriticalPosition } from "@/lib/api/types";

interface CriticalPositionsListProps {
  positions: CriticalPosition[];
  onSelectPosition?: (fen: string, ply: number) => void;
}

export default function CriticalPositionsList({
  positions = [],
  onSelectPosition,
}: CriticalPositionsListProps) {
  if (!positions || positions.length === 0) {
    return (
      <div className="p-8 text-center bg-card border border-border/40 rounded-2xl text-muted-foreground text-xs">
        Chưa phát hiện sai sót chiến thuật (Blunders/Mistakes) nào trong ván đấu này.
      </div>
    );
  }

  const getEventBadge = (type: string) => {
    switch (type) {
      case "BLUNDER":
        return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-destructive/15 text-destructive border border-destructive/30">BLUNDER ??</span>;
      case "MISTAKE":
        return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/15 text-amber-500 border border-amber-500/30">MISTAKE ?</span>;
      case "INACCURACY":
        return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-sky-500/15 text-sky-500 border border-sky-500/30">INACCURACY ?!</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-500/15 text-purple-500 border border-purple-500/30">SWING</span>;
    }
  };

  return (
    <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-border/40 bg-muted/30 flex items-center justify-between">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span>Điểm Ngoặt Chiến Thuật & Sai Sót ({positions.length})</span>
        </h4>
        <span className="text-[11px] text-muted-foreground font-medium">Bấm để tải thế cờ</span>
      </div>

      <div className="divide-y divide-border/40 max-h-[320px] overflow-y-auto">
        {positions.map((pos, idx) => (
          <div
            key={idx}
            onClick={() => onSelectPosition?.(pos.fen, pos.ply)}
            className="p-3.5 hover:bg-muted/30 transition cursor-pointer flex items-center justify-between gap-3 text-xs group"
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold text-muted-foreground w-8">
                #{pos.ply}
              </span>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {getEventBadge(pos.event_type)}
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {pos.phase}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-destructive font-bold">
                    Đã đi: {pos.played_move}
                  </span>
                  {pos.best_move && (
                    <>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-emerald-500 font-bold">
                        Tốt nhất: {pos.best_move}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {pos.cpl !== undefined && pos.cpl !== null && (
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground block">Tổn thất</span>
                  <span className="font-mono font-black text-destructive text-xs">
                    -{Math.round(pos.cpl)} cp
                  </span>
                </div>
              )}
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
