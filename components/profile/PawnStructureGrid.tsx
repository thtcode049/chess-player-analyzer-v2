"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Layers, X, Play, ExternalLink, Lightbulb, ShieldAlert, Compass } from "lucide-react";
import { PawnStructureItem } from "@/lib/api/types";
import PawnStructureInfoBadge from "@/components/chess/PawnStructureInfoBadge";
import { useProfileWorkspaceStore } from "@/lib/stores/profileWorkspaceStore";

interface PawnStructureGridProps {
  structures?: PawnStructureItem[];
  playerId?: string;
}

interface GroupMeta {
  key: string;
  title: string;
  order: number;
}

const CANONICAL_GROUPS: Record<string, GroupMeta> = {
  family_1: {
    key: "family_1",
    title: "Family One – d4 & ...d5",
    order: 1,
  },
  family_2: {
    key: "family_2",
    title: "Family Two – Open Sicilian",
    order: 2,
  },
  family_3: {
    key: "family_3",
    title: "Family Three – Benoni",
    order: 3,
  },
  family_4: {
    key: "family_4",
    title: "Family Four – King's Indian",
    order: 4,
  },
  family_5: {
    key: "family_5",
    title: "Family Five – French",
    order: 5,
  },
  miscellaneous: {
    key: "miscellaneous",
    title: "Miscellaneous – Various Structures",
    order: 6,
  },
};

export default function PawnStructureGrid({
  structures = [],
  playerId,
}: PawnStructureGridProps) {
  const { exploreStructure } = useProfileWorkspaceStore();
  const [activeModalStructure, setActiveModalStructure] = useState<PawnStructureItem | null>(null);
  const [modalFilter, setModalFilter] = useState<"all" | "wins" | "draws" | "losses">("all");

  if (!structures || structures.length === 0) {
    return (
      <div className="p-8 text-center bg-card rounded-surface border border-border/60 text-muted-foreground text-sm">
        Chưa phát hiện cấu trúc Tốt đặc trưng nào trong tập ván đấu này.
      </div>
    );
  }

  // Nhóm cấu trúc động theo các Family chuẩn Flores Rios (kèm tương thích ngược cho dữ liệu cũ A / B)
  const groupedSections: { meta: GroupMeta; items: PawnStructureItem[] }[] = [];
  const buckets: Record<string, PawnStructureItem[]> = {};

  for (const s of structures) {
    const gKey = s.group || "miscellaneous";
    if (!buckets[gKey]) {
      buckets[gKey] = [];
    }
    buckets[gKey].push(s);
  }

  // Thêm 6 nhóm chính theo thứ tự
  for (const [key, meta] of Object.entries(CANONICAL_GROUPS)) {
    if (buckets[key] && buckets[key].length > 0) {
      groupedSections.push({ meta, items: buckets[key] });
    }
  }

  // Tương thích ngược: dữ liệu cũ có group "B" hoặc "A"
  if (buckets["B"] && buckets["B"].length > 0) {
    groupedSections.push({
      meta: {
        key: "legacy_B",
        title: "Cấu trúc Chiến lược (Lịch sử)",
        order: 91,
      },
      items: buckets["B"],
    });
  }
  if (buckets["A"] && buckets["A"].length > 0) {
    groupedSections.push({
      meta: {
        key: "legacy_A",
        title: "Cấu trúc Nền tảng & Trung tâm (Lịch sử)",
        order: 92,
      },
      items: buckets["A"],
    });
  }

  // Các nhóm khác nếu có
  for (const [k, items] of Object.entries(buckets)) {
    if (
      !CANONICAL_GROUPS[k] &&
      k !== "B" &&
      k !== "A" &&
      items.length > 0
    ) {
      groupedSections.push({
        meta: {
          key: k,
          title: items[0].group_title || `Cấu trúc Tốt (${k})`,
          order: 99,
        },
        items,
      });
    }
  }

  groupedSections.sort((a, b) => a.meta.order - b.meta.order);

  const renderGroupTable = (sec: { meta: GroupMeta; items: PawnStructureItem[] }) => {
    return (
      <div key={sec.meta.key} className="space-y-3">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <span>{sec.meta.title}</span>
            <span className="text-xs font-normal text-muted-foreground font-mono">
              ({sec.items.length})
            </span>
          </h3>
        </div>

        <div className="bg-card border border-border/70 rounded-table overflow-hidden w-full max-w-5xl mx-auto">
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground font-bold uppercase tracking-wider border-b border-border/70 text-[11px]">
                <tr>
                  <th className="px-3.5 py-2.5">Cấu trúc Tốt</th>
                  <th className="px-2 py-2.5 w-16 text-center">Số ván</th>
                  <th className="px-3 py-2.5 w-48">Tỉ lệ W/D/L</th>
                  <th className="px-2.5 py-2.5 w-20 text-right">Điểm thực</th>
                  <th className="px-2.5 py-2.5 w-24 text-right">Độ lệch (Δ)</th>
                  <th className="px-3 py-2.5 w-36">Đánh giá Hiệu suất</th>
                  <th className="px-3 py-2.5 w-36 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {sec.items.map((item, idx) => {
                  const count = item.games?.length || item.games_count || (item.wins + item.draws + item.losses) || 0;
                  const total = count || 1;
                  const winPct = (item.wins / total) * 100;
                  const drawPct = (item.draws / total) * 100;
                  const lossPct = (item.losses / total) * 100;
                  const score = item.score_pct ?? ((item.wins + item.draws * 0.5) / total * 100);
                  const delta = item.delta_vs_baseline ?? 0;
                  const isPositive = delta > 0;
                  const deltaStr = isPositive ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`;
                  const badgeColor = item.assessment_color || (isPositive ? "#047857" : delta < 0 ? "#be123c" : "#64748b");
                  const hasGames = item.games && item.games.length > 0;

                  return (
                    <tr
                      key={idx}
                      className="hover:bg-muted/30 transition select-none group"
                    >
                      {/* Cấu trúc Tốt */}
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground text-xs">
                            {item.name}
                          </span>
                          <PawnStructureInfoBadge structureName={item.name} />
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Hình thành ~nước {item.typical_formation_move ?? 12}
                        </div>
                      </td>

                      {/* Số ván */}
                      <td className="px-2 py-2.5 text-center font-mono font-bold text-muted-foreground">
                        {count}
                      </td>

                      {/* Tỉ lệ W/D/L */}
                      <td className="px-3 py-2.5">
                        <div className="space-y-1">
                          <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-slate-200">
                            <div
                              className="bg-emerald-500 h-full"
                              style={{ width: `${winPct}%` }}
                              title={`Thắng: ${item.wins} (${winPct.toFixed(1)}%)`}
                            />
                            <div
                              className="bg-slate-400 h-full"
                              style={{ width: `${drawPct}%` }}
                              title={`Hòa: ${item.draws} (${drawPct.toFixed(1)}%)`}
                            />
                            <div
                              className="bg-rose-500 h-full"
                              style={{ width: `${lossPct}%` }}
                              title={`Thua: ${item.losses} (${lossPct.toFixed(1)}%)`}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                            <span className="text-emerald-700 font-semibold">{winPct.toFixed(0)}%</span>
                            <span>{drawPct.toFixed(0)}%</span>
                            <span className="text-rose-700 font-semibold">{lossPct.toFixed(0)}%</span>
                          </div>
                        </div>
                      </td>

                      {/* Điểm thực */}
                      <td className="px-2.5 py-2.5 text-right font-mono font-bold text-foreground">
                        {score.toFixed(1)}%
                      </td>

                      {/* Độ lệch (Δ) */}
                      <td
                        className={`px-2.5 py-2.5 text-right font-mono font-bold ${
                          isPositive
                            ? "text-emerald-700"
                            : delta < 0
                            ? "text-rose-700"
                            : "text-muted-foreground"
                        }`}
                      >
                        {deltaStr}
                      </td>

                      {/* Đánh giá Hiệu suất */}
                      <td className="px-3 py-2.5">
                        <span
                          className="assessment-tag inline-block whitespace-nowrap border"
                          style={{
                            backgroundColor: `${badgeColor}20`,
                            color: `color-mix(in srgb, ${badgeColor} 45%, #0f172a)`,
                            borderColor: `${badgeColor}55`,
                          }}
                        >
                          {item.assessment_badge || "Bình thường"}
                        </span>
                      </td>

                      {/* Thao tác */}
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {hasGames ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveModalStructure(item);
                                setModalFilter("all");
                              }}
                              className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition cursor-pointer"
                            >
                              Danh sách ({item.games?.length})
                            </button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">{count} ván</span>
                          )}

                          {playerId && (
                            <button
                              type="button"
                              onClick={() => exploreStructure(item, playerId)}
                              className="text-[11px] font-bold text-emerald-700 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                            >
                              Khám phá →
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {groupedSections.map((sec) => renderGroupTable(sec))}
      </div>

      {/* Modal: View Games & Detailed Strategic Plan */}
      {activeModalStructure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-card rounded-surface max-w-3xl w-full p-5 shadow-xl space-y-4 max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">
                    {activeModalStructure.group_title || "Chuẩn Flores Rios"}
                  </span>
                  <span
                    className="assessment-tag border"
                    style={{
                      backgroundColor: `${activeModalStructure.assessment_color ?? "#94A3B8"}18`,
                      color: `color-mix(in srgb, ${activeModalStructure.assessment_color ?? "#64748b"} 45%, #0f172a)`,
                      borderColor: `${activeModalStructure.assessment_color ?? "#94A3B8"}55`,
                    }}
                  >
                    {activeModalStructure.assessment_badge || "Bình thường"}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="text-lg font-bold text-foreground">
                    {activeModalStructure.name}
                  </h3>
                  <PawnStructureInfoBadge structureName={activeModalStructure.name} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tổng cộng <b>{activeModalStructure.games?.length || activeModalStructure.games_count}</b> ván đấu thực tế • Hình thành quanh nước {activeModalStructure.typical_formation_move || 12}
                </p>
                {(() => {
                  const mTotal = activeModalStructure.games?.length || activeModalStructure.games_count || (activeModalStructure.wins + activeModalStructure.draws + activeModalStructure.losses) || 1;
                  const mW = (activeModalStructure.wins / mTotal) * 100;
                  const mD = (activeModalStructure.draws / mTotal) * 100;
                  const mL = (activeModalStructure.losses / mTotal) * 100;

                  return (
                    <div className="flex items-center gap-2 mt-1.5 text-xs">
                      <span className="text-[11px] text-muted-foreground font-medium">Tỉ lệ W/D/L:</span>
                      <div className="w-28 h-2 rounded-full overflow-hidden flex bg-slate-200">
                        <div className="bg-emerald-500 h-full" style={{ width: `${mW}%` }} title={`Thắng: ${activeModalStructure.wins} (${mW.toFixed(1)}%)`} />
                        <div className="bg-slate-400 h-full" style={{ width: `${mD}%` }} title={`Hòa: ${activeModalStructure.draws} (${mD.toFixed(1)}%)`} />
                        <div className="bg-rose-500 h-full" style={{ width: `${mL}%` }} title={`Thua: ${activeModalStructure.losses} (${mL.toFixed(1)}%)`} />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        <b className="text-emerald-700">{mW.toFixed(0)}%</b> / {mD.toFixed(0)}% / <b className="text-rose-700">{mL.toFixed(0)}%</b>
                      </span>
                    </div>
                  );
                })()}
              </div>

              <button
                onClick={() => setActiveModalStructure(null)}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Strategic Plan Section */}
            {activeModalStructure.strategic_plan && (
              <div className="bg-secondary/40 rounded-surface p-3.5 border border-border/40 text-xs space-y-2 shrink-0">
                <div className="flex items-center gap-1.5 font-bold text-primary text-xs">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  Kế hoạch Chiến lược Chuẩn (Flores Rios - Chess Structures):
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                  <div className="space-y-1">
                    <span className="font-semibold text-emerald-800 text-[11px] block">
                      🎯 Kế hoạch bên chủ động / sở hữu (Ideas):
                    </span>
                    <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground text-[11px]">
                      {activeModalStructure.strategic_plan.ideas?.map((idea, i) => (
                        <li key={i}>{idea}</li>
                      )) || <li>Chưa có kế hoạch chi tiết</li>}
                    </ul>
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-rose-800 text-[11px] block">
                      🛡️ Kế hoạch phản công / đối phó (Counter-Ideas):
                    </span>
                    <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground text-[11px]">
                      {activeModalStructure.strategic_plan.counter_ideas?.map((c_idea, i) => (
                        <li key={i}>{c_idea}</li>
                      )) || <li>Chưa có kế hoạch phản công chi tiết</li>}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Games Filter Tabs */}
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-xs font-bold text-foreground">Ván đấu cụ thể ({activeModalStructure.games?.length || 0}):</span>
              <div className="flex items-center gap-1 text-[11px]">
                {(["all", "wins", "draws", "losses"] as const).map((filter) => {
                  const label =
                    filter === "all"
                      ? "Tất cả"
                      : filter === "wins"
                      ? "Thắng"
                      : filter === "draws"
                      ? "Hòa"
                      : "Thua";
                  const count =
                    filter === "all"
                      ? activeModalStructure.games?.length || 0
                      : activeModalStructure.games?.filter((g) =>
                          filter === "wins" ? g.is_win : filter === "draws" ? g.is_draw : g.is_loss
                        ).length || 0;
                  return (
                    <button
                      key={filter}
                      onClick={() => setModalFilter(filter)}
                      className={`px-2 py-0.5 rounded cursor-pointer transition ${
                        modalFilter === filter
                          ? "bg-primary text-primary-foreground font-bold"
                          : "text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Games List (Scrollable) */}
            <div className="overflow-y-auto space-y-2 pr-1 flex-1 min-h-[160px]">
              {activeModalStructure.games
                ?.filter((g) => {
                  if (modalFilter === "wins") return g.is_win;
                  if (modalFilter === "draws") return g.is_draw;
                  if (modalFilter === "losses") return g.is_loss;
                  return true;
                })
                .map((game, gIdx) => {
                  const resultColor = game.is_win
                    ? "text-emerald-800 font-bold"
                    : game.is_loss
                    ? "text-rose-800 font-bold"
                    : "text-muted-foreground font-semibold";
                  const resultBadge = game.is_win ? "Thắng" : game.is_loss ? "Thua" : "Hòa";

                  return (
                    <div
                      key={gIdx}
                      className="p-3 bg-secondary/20 hover:bg-secondary/40 border border-border/40 rounded-surface transition flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">
                            {game.white} vs {game.black}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded border ${resultColor}`}>
                            {resultBadge} ({game.result})
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span>{game.opening}</span>
                          <span>•</span>
                          <span>Hình thành nước {game.formation_move}</span>
                          {game.date && (
                            <>
                              <span>•</span>
                              <span>{game.date}</span>
                            </>
                          )}
                        </div>
                        {game.evidence && (
                          <div className="text-[10px] text-muted-foreground/80 italic mt-0.5">
                            {game.evidence}
                          </div>
                        )}
                      </div>

                      {game.id && (
                        <Link
                          href={`/games/${game.id}`}
                          className="px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/10 rounded transition inline-flex items-center gap-1 shrink-0"
                        >
                          <Play className="w-3 h-3" /> Xem ván
                        </Link>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-border/40 pt-3 flex items-center justify-between">
              {playerId && activeModalStructure && (
                <button
                  type="button"
                  onClick={() => {
                    exploreStructure(activeModalStructure, playerId);
                    setActiveModalStructure(null);
                  }}
                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5" /> Khám phá Cấu trúc trên Bàn cờ
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveModalStructure(null)}
                className="px-4 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground rounded text-xs font-medium transition cursor-pointer ml-auto"
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
