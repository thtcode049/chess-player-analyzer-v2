"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Layers, X, Play, ExternalLink } from "lucide-react";
import { PawnStructureItem } from "@/lib/api/types";

interface PawnStructureGridProps {
  structures?: PawnStructureItem[];
  playerId?: string;
}

export default function PawnStructureGrid({
  structures = [],
  playerId,
}: PawnStructureGridProps) {
  const [activeModalStructure, setActiveModalStructure] = useState<PawnStructureItem | null>(null);
  const [modalFilter, setModalFilter] = useState<"all" | "wins" | "draws" | "losses">("all");

  if (!structures || structures.length === 0) {
    return (
      <div className="p-8 text-center bg-card rounded-3xl border border-border/60 text-muted-foreground text-sm">
        Chưa phát hiện cấu trúc Tốt đặc trưng nào trong tập ván đấu này.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {structures.map((item, idx) => {
          const delta = item.delta_vs_baseline ?? 0;
          const deltaStr = delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`;
          const deltaColor =
            delta > 5
              ? "text-emerald-500 font-bold"
              : delta < -5
              ? "text-rose-500 font-bold"
              : "text-muted-foreground";

          const hasGames = item.games && item.games.length > 0;

          return (
            <div
              key={idx}
              className="bg-card border border-border/60 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground leading-tight">
                        {item.name}
                      </h4>
                      <span className="text-[11px] text-muted-foreground">
                        Hình thành quanh nước {item.typical_formation_move ?? 12}
                      </span>
                    </div>
                  </div>

                  <span
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{
                      backgroundColor: `${item.assessment_color ?? "#94A3B8"}15`,
                      color: item.assessment_color ?? "#94A3B8",
                    }}
                  >
                    {item.assessment_badge || "Bình thường"}
                  </span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 py-3 border-y border-border/40 my-3 text-center text-xs">
                  <div>
                    <span className="block text-[10px] text-muted-foreground">Số ván</span>
                    <span className="font-bold text-foreground">
                      {item.games_count}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground">W / D / L</span>
                    <span className="font-mono text-[11px]">
                      <span className="text-emerald-500 font-bold">{item.wins}</span>-
                      <span className="text-muted-foreground">{item.draws}</span>-
                      <span className="text-rose-500 font-bold">{item.losses}</span>
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground">Điểm thô</span>
                    <span className="font-bold text-foreground">
                      {item.score_pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Bayesian Adjusted Score */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">Độ tin cậy Bayes:</span>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-foreground">
                    {(item.adjusted_score_pct ?? item.score_pct).toFixed(1)}%
                  </span>{" "}
                  <span className={`text-xs ${deltaColor}`}>({deltaStr})</span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2 text-xs">
                {hasGames ? (
                  <button
                    onClick={() => {
                      setActiveModalStructure(item);
                      setModalFilter("all");
                    }}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1"
                  >
                    Danh sách ({item.games?.length})
                  </button>
                ) : (
                  <span className="text-[11px] text-muted-foreground">{item.games_count} ván</span>
                )}

                {playerId && (
                  <Link
                    href={`/analyze?playerId=${playerId}&structure=${encodeURIComponent(item.name)}`}
                    className="text-[11px] font-bold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Xem ván đấu cấu trúc này →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: View Games with this structure */}
      {activeModalStructure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-card border border-border/80 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">Cấu trúc Tốt</span>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{
                      backgroundColor: `${activeModalStructure.assessment_color ?? "#94A3B8"}15`,
                      color: activeModalStructure.assessment_color ?? "#94A3B8",
                    }}
                  >
                    {activeModalStructure.assessment_badge || "Bình thường"}
                  </span>
                </div>
                <h3 className="text-lg font-black text-foreground mt-0.5">
                  {activeModalStructure.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tổng cộng <b>{activeModalStructure.games?.length || activeModalStructure.games_count}</b> ván đấu thực tế • Hình thành quanh nước {activeModalStructure.typical_formation_move || 12}
                </p>
              </div>

              <button
                onClick={() => setActiveModalStructure(null)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Pills & Analyze CTA */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 p-1 bg-secondary/60 rounded-xl">
                <button
                  onClick={() => setModalFilter("all")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    modalFilter === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Tất cả ({activeModalStructure.games?.length || 0})
                </button>
                <button
                  onClick={() => setModalFilter("wins")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    modalFilter === "wins" ? "bg-emerald-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Thắng ({activeModalStructure.wins})
                </button>
                <button
                  onClick={() => setModalFilter("draws")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    modalFilter === "draws" ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Hòa ({activeModalStructure.draws})
                </button>
                <button
                  onClick={() => setModalFilter("losses")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    modalFilter === "losses" ? "bg-rose-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Thua ({activeModalStructure.losses})
                </button>
              </div>

              {playerId && (
                <Link
                  href={`/analyze?playerId=${playerId}&structure=${encodeURIComponent(activeModalStructure.name)}`}
                  className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition flex items-center gap-1.5 shadow-sm shadow-primary/20"
                >
                  <Play className="w-3 h-3" />
                  Mở Structure Explorer trên Bàn cờ →
                </Link>
              )}
            </div>

            {/* Games List Table */}
            <div className="flex-1 overflow-y-auto border border-border/40 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground font-semibold sticky top-0 backdrop-blur-sm">
                  <tr>
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">Trắng vs Đen</th>
                    <th className="px-3 py-2.5">Khai cuộc / Kết quả</th>
                    <th className="px-3 py-2.5 text-center">Nước hình thành</th>
                    <th className="px-3 py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {(() => {
                    const games = (activeModalStructure.games || []).filter((g) => {
                      if (modalFilter === "wins") return g.is_win;
                      if (modalFilter === "draws") return g.is_draw;
                      if (modalFilter === "losses") return g.is_loss;
                      return true;
                    });

                    if (games.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground">
                            Không có ván đấu nào phù hợp với bộ lọc.
                          </td>
                        </tr>
                      );
                    }

                    return games.map((g, gIdx) => {
                      let resColor = "bg-muted text-muted-foreground";
                      let resText = g.result;
                      if (g.is_win) {
                        resColor = "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
                        resText = `${g.result} (Thắng)`;
                      } else if (g.is_draw) {
                        resColor = "bg-amber-500/10 text-amber-500 border border-amber-500/20";
                        resText = `${g.result} (Hòa)`;
                      } else if (g.is_loss) {
                        resColor = "bg-rose-500/10 text-rose-500 border border-rose-500/20";
                        resText = `${g.result} (Thua)`;
                      }

                      return (
                        <tr key={gIdx} className="hover:bg-secondary/30 transition">
                          <td className="px-3 py-3 font-mono text-muted-foreground">
                            {g.game_index !== undefined ? g.game_index + 1 : gIdx + 1}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5 font-semibold text-foreground">
                              <span className="w-2 h-2 rounded-full bg-white border border-slate-300 dark:border-slate-500 shrink-0" />
                              <span>{g.white}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                              <span className="w-2 h-2 rounded-full bg-slate-900 border border-slate-700 shrink-0" />
                              <span>{g.black}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="text-muted-foreground truncate max-w-[200px]">
                              {g.opening || "Khai cuộc"}
                            </div>
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-0.5 ${resColor}`}>
                              {resText}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-secondary text-foreground">
                              Move {g.formation_move || "?"}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <Link
                              href={
                                g.id
                                  ? `/analyze?gameId=${g.id}&playerId=${playerId || ""}`
                                  : `/analyze?playerId=${playerId || ""}&structure=${encodeURIComponent(activeModalStructure.name)}&gameIdx=${g.game_index ?? gIdx}`
                              }
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground font-medium text-[11px] text-foreground transition"
                            >
                              Phân tích
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setActiveModalStructure(null)}
                className="px-4 py-2 rounded-xl border border-border/60 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

