"use client";

import React from "react";
import { OpeningContinuation } from "@/lib/api/types";
import { Play, GitBranch, Eye, ExternalLink } from "lucide-react";

interface OpeningTreeTableProps {
  continuations: OpeningContinuation[];
  totalGames?: number;
  onSelectMove: (san: string) => void;
  onLoadGame?: (gameInfo: any) => void;
}

export default function OpeningTreeTable({
  continuations = [],
  totalGames = 0,
  onSelectMove,
  onLoadGame,
}: OpeningTreeTableProps) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-emerald-500" />
          <span>Các Biến Thể Khai Cuộc Tiếp Theo</span>
        </h3>
        <span className="text-xs text-slate-500 font-medium">
          {totalGames > 0 ? `${totalGames} ván • ` : ""}{continuations.length} biến khả dụng
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/30 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-4 py-2.5">Nước đi</th>
              <th className="px-3 py-2.5">Số ván</th>
              <th className="px-3 py-2.5">Tần suất</th>
              <th className="px-4 py-2.5 min-w-[140px]">Tỷ lệ Kết quả (W / D / L)</th>
              <th className="px-3 py-2.5 text-right">Điểm số</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {continuations.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-400">
                  Không có nước đi tiếp theo trong cơ sở dữ liệu ván đấu.
                </td>
              </tr>
            ) : (
              continuations.map((c, idx) => {
                const sg = c.single_game_info;
                const isSingle = c.games_count === 1 && sg;

                return (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition group"
                  >
                    {/* Move SAN */}
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSelectMove(c.san)}
                          className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-emerald-500 group-hover:text-white transition"
                          title={`Đi tiếp ${c.san}`}
                        >
                          <Play className="w-3 h-3 fill-current" />
                        </button>
                        <span 
                          onClick={() => onSelectMove(c.san)}
                          className="cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400"
                        >
                          {c.san}
                        </span>
                      </div>
                    </td>

                    {/* Games Count */}
                    <td className="px-3 py-3 font-semibold text-slate-600 dark:text-slate-300">
                      {c.games_count}
                    </td>

                    {/* Frequency */}
                    <td className="px-3 py-3 text-slate-500">
                      {c.usage_pct.toFixed(1)}%
                    </td>

                    {/* Result or Single Game Info */}
                    <td className="px-4 py-3">
                      {isSingle ? (
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => onLoadGame && onLoadGame(sg)}
                            className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium truncate max-w-[220px]"
                            title="Nạp toàn bộ ván đấu này lên bàn cờ"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate">
                              {sg.white} {sg.result} {sg.black}
                            </span>
                          </button>
                          {sg.link && (
                            <a
                              href={sg.link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-emerald-500 p-0.5 rounded transition flex-shrink-0"
                              title="Mở ván đấu gốc"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="wdl-bar">
                            <div
                              className="wdl-bar-win"
                              style={{ width: `${c.win_pct}%` }}
                              title={`Thắng: ${c.win_pct.toFixed(1)}%`}
                            />
                            <div
                              className="wdl-bar-draw"
                              style={{ width: `${c.draw_pct}%` }}
                              title={`Hòa: ${c.draw_pct.toFixed(1)}%`}
                            />
                            <div
                              className="wdl-bar-loss"
                              style={{ width: `${c.loss_pct}%` }}
                              title={`Thua: ${c.loss_pct.toFixed(1)}%`}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                            <span className="text-emerald-600 dark:text-emerald-400">{c.win_pct.toFixed(0)}%</span>
                            <span>{c.draw_pct.toFixed(0)}%</span>
                            <span className="text-rose-600 dark:text-rose-400">{c.loss_pct.toFixed(0)}%</span>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Score */}
                    <td className="px-3 py-3 text-right font-bold text-slate-900 dark:text-white">
                      <span
                        className={`inline-block px-2 py-0.5 rounded ${
                          c.score_pct >= 60
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : c.score_pct <= 40
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {c.score_pct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

