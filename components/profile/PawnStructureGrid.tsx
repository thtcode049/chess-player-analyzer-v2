"use client";

import React from "react";
import Link from "next/link";
import { Layers } from "lucide-react";

interface PawnStructureItem {
  name: string;
  structure_key?: string;
  typical_formation_move?: number;
  games_count: number;
  wins: number;
  draws: number;
  losses: number;
  score_pct: number;
  adjusted_score_pct?: number;
  delta_vs_baseline?: number;
  assessment_badge?: string;
  assessment_color?: string;
}

interface PawnStructureGridProps {
  structures?: PawnStructureItem[];
  playerId?: string;
}

export default function PawnStructureGrid({
  structures = [],
  playerId,
}: PawnStructureGridProps) {
  if (!structures || structures.length === 0) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-sm">
        Chưa phát hiện cấu trúc Tốt đặc trưng nào trong tập ván đấu này.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {structures.map((item, idx) => {
        const delta = item.delta_vs_baseline ?? 0;
        const deltaStr = delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`;
        const deltaColor =
          delta > 5
            ? "text-emerald-500 font-bold"
            : delta < -5
            ? "text-rose-500 font-bold"
            : "text-slate-400";

        return (
          <div
            key={idx}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                      {item.name}
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      Hình thành quanh nước {item.typical_formation_move ?? 12}
                    </span>
                  </div>
                </div>

                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor: `${item.assessment_color ?? "#94A3B8"}15`,
                    color: item.assessment_color ?? "#94A3B8",
                  }}
                >
                  {item.assessment_badge || "Bình thường"}
                </span>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 dark:border-slate-800 my-2 text-center text-xs">
                <div>
                  <span className="block text-[10px] text-slate-400">Số ván</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {item.games_count}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400">W / D / L</span>
                  <span className="font-mono text-[11px]">
                    <span className="text-emerald-600 font-bold">{item.wins}</span>-
                    <span className="text-slate-400">{item.draws}</span>-
                    <span className="text-rose-600 font-bold">{item.losses}</span>
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400">Điểm thô</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {item.score_pct.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Bayesian Adjusted Score */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-500">Độ tin cậy Bayes:</span>
              <div className="text-right">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {(item.adjusted_score_pct ?? item.score_pct).toFixed(1)}%
                </span>{" "}
                <span className={`text-xs ${deltaColor}`}>({deltaStr})</span>
              </div>
            </div>

            {playerId && (
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-right">
                <Link
                  href={`/analyze?playerId=${playerId}&structure=${encodeURIComponent(item.name)}`}
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                >
                  Xem ván đấu cấu trúc này →
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
