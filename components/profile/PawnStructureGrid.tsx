"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Layers, X, Play, ExternalLink, Lightbulb, ShieldAlert, Compass } from "lucide-react";
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
      <div className="p-8 text-center bg-card rounded-xl border border-border/60 text-muted-foreground text-sm">
        Chưa phát hiện cấu trúc Tốt đặc trưng nào trong tập ván đấu này.
      </div>
    );
  }

  // Danh sách chuẩn hóa của 10 cấu trúc chính thức (chỉ render các cấu trúc hợp lệ)
  const ALLOWED_GROUP_B = ["carlsbad", "maroczy_bind", "maroczy bind", "hedgehog", "stonewall"];
  const ALLOWED_GROUP_A = [
    "iqp",
    "isolated queen's pawn",
    "hanging_pawns",
    "hanging pawns",
    "open",
    "open center",
    "semi-open",
    "semi-open center",
    "closed",
    "closed center",
    "symmetrical",
    "symmetrical center",
  ];

  const isValidGroupB = (s: PawnStructureItem) => {
    const k = (s.structure_key || "").toLowerCase();
    const n = (s.name || "").toLowerCase();
    return ALLOWED_GROUP_B.some((allowed) => k.includes(allowed) || n.includes(allowed));
  };

  const isValidGroupA = (s: PawnStructureItem) => {
    const k = (s.structure_key || "").toLowerCase();
    const n = (s.name || "").toLowerCase();
    return ALLOWED_GROUP_A.some((allowed) => k.includes(allowed) || n.includes(allowed));
  };

  const groupB = structures.filter(isValidGroupB);
  const groupA = structures.filter((s) => !isValidGroupB(s) && isValidGroupA(s));

  const renderStructureCard = (item: PawnStructureItem, idx: number) => {
    const delta = item.delta_vs_baseline ?? 0;
    const deltaStr = delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`;
    const deltaColor =
      delta > 5
        ? "text-emerald-500 font-bold"
        : delta < -5
        ? "text-rose-500 font-bold"
        : "text-muted-foreground";

    const hasGames = item.games && item.games.length > 0;
    const isGroupB = item.group === "B" || ["Carlsbad", "Maroczy_Bind", "Hedgehog", "Stonewall"].includes(item.structure_key || "");

    return (
      <div
        key={idx}
        className="bg-card border border-border/60 rounded-xl p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
      >
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-lg border text-xs shrink-0 ${
                  isGroupB
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : "bg-primary/10 text-primary border-primary/20"
                }`}
              >
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-foreground leading-tight">
                  {item.name}
                </h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    Hình thành ~nước {item.typical_formation_move ?? 12}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">•</span>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {isGroupB ? "Nhóm B: Chiến lược" : "Nhóm A: Trung tâm"}
                  </span>
                </div>
              </div>
            </div>

            <span
              className="px-2 py-0.5 rounded-md text-[10px] font-bold border"
              style={{
                backgroundColor: `${item.assessment_color ?? "#94A3B8"}15`,
                color: item.assessment_color ?? "#94A3B8",
                borderColor: `${item.assessment_color ?? "#94A3B8"}30`,
              }}
            >
              {item.assessment_badge || "Bình thường"}
            </span>
          </div>

          {/* Strategic Plan Preview (if available) */}
          {item.strategic_plan?.ideas && item.strategic_plan.ideas.length > 0 && (
            <div className="bg-secondary/40 border border-border/40 rounded-lg p-2.5 my-2.5 text-[11px] space-y-1">
              <div className="flex items-start gap-1.5 text-foreground font-medium">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span className="line-clamp-2 leading-relaxed">
                  <b>Kế hoạch:</b> {item.strategic_plan.ideas[0]}
                </span>
              </div>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-border/40 my-2 text-center text-xs">
            <div>
              <span className="block text-[10px] text-muted-foreground">Số ván</span>
              <span className="font-bold text-foreground">{item.games_count}</span>
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

        {/* Bayesian Adjusted Score & Actions */}
        <div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">Độ tin cậy Bayes:</span>
            <div className="text-right">
              <span className="text-sm font-extrabold text-foreground">
                {(item.adjusted_score_pct ?? item.score_pct).toFixed(1)}%
              </span>{" "}
              <span className={`text-xs ${deltaColor}`}>({deltaStr})</span>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between gap-2 text-xs">
            {hasGames ? (
              <button
                onClick={() => {
                  setActiveModalStructure(item);
                  setModalFilter("all");
                }}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1 cursor-pointer"
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
                Khám phá trên Bàn cờ →
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {/* KHU VỰC B: CẤU TRÚC CHIẾN LƯỢC KINH ĐIỂN */}
        {groupB.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs border border-amber-500/20">
                  Khu vực B
                </span>
                <h3 className="font-bold text-sm text-foreground">
                  Cấu trúc Chiến lược Kinh điển ({groupB.length})
                </h3>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Carlsbad, Maroczy Bind, Hedgehog, Stonewall
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupB.map((item, idx) => renderStructureCard(item, idx))}
            </div>
          </div>
        )}

        {/* KHU VỰC A: CẤU TRÚC NỀN TẢNG VÀ TRẠNG THÁI TRUNG TÂM */}
        {groupA.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold text-xs border border-primary/20">
                  Khu vực A
                </span>
                <h3 className="font-bold text-sm text-foreground">
                  Cấu trúc Nền tảng & Trạng thái Trung tâm ({groupA.length})
                </h3>
              </div>
              <span className="text-[11px] text-muted-foreground">
                IQP, Cặp tốt treo, Mở, Nửa mở, Đóng, Đối xứng
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupA.map((item, idx) => renderStructureCard(item, idx))}
            </div>
          </div>
        )}
      </div>

      {/* Modal: View Games & Detailed Strategic Plan */}
      {activeModalStructure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-card border border-border/80 rounded-xl max-w-3xl w-full p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">
                    {activeModalStructure.group === "B" ? "Nhóm B: Cấu trúc Chiến lược" : "Nhóm A: Cấu trúc Trung tâm"}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold border"
                    style={{
                      backgroundColor: `${activeModalStructure.assessment_color ?? "#94A3B8"}15`,
                      color: activeModalStructure.assessment_color ?? "#94A3B8",
                      borderColor: `${activeModalStructure.assessment_color ?? "#94A3B8"}30`,
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
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Strategic Plan Details (Ideas & Counter-Ideas) */}
            {activeModalStructure.strategic_plan && (
              <div className="bg-secondary/30 border border-border/40 rounded-lg p-3 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-primary">
                  <Compass className="w-4 h-4" />
                  <span>Kế hoạch & Phương án Chiến lược Tham khảo</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5" /> Kế hoạch chủ động:
                    </span>
                    <ul className="list-disc list-inside text-muted-foreground text-[11px] space-y-0.5">
                      {activeModalStructure.strategic_plan.ideas.map((idea, i) => (
                        <li key={i}>{idea}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> Phương án đối ứng:
                    </span>
                    <ul className="list-disc list-inside text-muted-foreground text-[11px] space-y-0.5">
                      {activeModalStructure.strategic_plan.counter_ideas.map((cidea, i) => (
                        <li key={i}>{cidea}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Filter Pills & Analyze CTA */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 p-1 bg-secondary/60 rounded-lg">
                <button
                  onClick={() => setModalFilter("all")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    modalFilter === "all" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Tất cả ({activeModalStructure.games?.length || 0})
                </button>
                <button
                  onClick={() => setModalFilter("wins")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    modalFilter === "wins" ? "bg-emerald-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Thắng ({activeModalStructure.wins})
                </button>
                <button
                  onClick={() => setModalFilter("draws")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    modalFilter === "draws" ? "bg-amber-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Hòa ({activeModalStructure.draws})
                </button>
                <button
                  onClick={() => setModalFilter("losses")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    modalFilter === "losses" ? "bg-rose-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Thua ({activeModalStructure.losses})
                </button>
              </div>

              {playerId && (
                <Link
                  href={`/analyze?playerId=${playerId}&structure=${encodeURIComponent(activeModalStructure.name)}`}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition flex items-center gap-1.5 shadow-2xs"
                >
                  <Play className="w-3 h-3" />
                  Mở Structure Explorer trên Bàn cờ →
                </Link>
              )}
            </div>

            {/* Games List Table */}
            <div className="flex-1 overflow-y-auto border border-border/40 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground font-semibold sticky top-0 backdrop-blur-xs">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Trắng vs Đen</th>
                    <th className="px-3 py-2">Khai cuộc / Kết quả</th>
                    <th className="px-3 py-2 text-center">Nước hình thành</th>
                    <th className="px-3 py-2 text-right">Thao tác</th>
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
                          <td colSpan={5} className="py-6 text-center text-muted-foreground">
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
                          <td className="px-3 py-2.5 font-mono text-muted-foreground">
                            {g.game_index !== undefined ? g.game_index + 1 : gIdx + 1}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5 font-semibold text-foreground">
                              <span className="w-2 h-2 rounded-full bg-white border border-slate-300 dark:border-slate-500 shrink-0" />
                              <span>{g.white}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                              <span className="w-2 h-2 rounded-full bg-slate-900 border border-slate-700 shrink-0" />
                              <span>{g.black}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="text-muted-foreground truncate max-w-[200px]">
                              {g.opening || "Khai cuộc"}
                            </div>
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mt-0.5 ${resColor}`}>
                              {resText}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-secondary text-foreground">
                              Move {g.formation_move || "?"}
                            </span>
                            {g.evidence && (
                              <div className="text-[10px] text-muted-foreground truncate max-w-[150px] mt-0.5 mx-auto">
                                {g.evidence}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Link
                              href={
                                g.id
                                  ? `/analyze?gameId=${g.id}&playerId=${playerId || ""}`
                                  : `/analyze?playerId=${playerId || ""}&structure=${encodeURIComponent(activeModalStructure.name)}&gameIdx=${g.game_index ?? gIdx}`
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary hover:bg-primary hover:text-primary-foreground font-medium text-[11px] text-foreground transition"
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
                className="px-3.5 py-1.5 rounded-lg border border-border/60 text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
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
