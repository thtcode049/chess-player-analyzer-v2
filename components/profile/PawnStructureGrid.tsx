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
  subtitle: string;
  order: number;
}

const CANONICAL_GROUPS: Record<string, GroupMeta> = {
  family_1: {
    key: "family_1",
    title: "Family One – d4 & ...d5",
    subtitle: "Chương 1–7: Isolani, Hanging Pawns, Caro-Kann, Slav, Carlsbad, Stonewall, Grünfeld Centre",
    order: 1,
  },
  family_2: {
    key: "family_2",
    title: "Family Two – Open Sicilian",
    subtitle: "Chương 8–11: Najdorf Type I, Najdorf Type II, The Hedgehog, The Maroczy",
    order: 2,
  },
  family_3: {
    key: "family_3",
    title: "Family Three – Benoni",
    subtitle: "Chương 12–13: Asymmetric Benoni, Symmetric Benoni",
    order: 3,
  },
  family_4: {
    key: "family_4",
    title: "Family Four – King's Indian",
    subtitle: "Chương 14–18: KID Type I, KID Type II, KID Type III, Open KID, KID Complex",
    order: 4,
  },
  family_5: {
    key: "family_5",
    title: "Family Five – French",
    subtitle: "Chương 19–21: French Type I, French Type II, French Type III",
    order: 5,
  },
  miscellaneous: {
    key: "miscellaneous",
    title: "Miscellaneous – Various Structures",
    subtitle: "Chương 22: 3-3 vs. 4-2, Panov, Dragon, Scheveningen, Benko, Closed Ruy Lopez, Lopez Formation",
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
        subtitle: "Các cấu trúc chiến lược từ bản phân tích trước",
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
        subtitle: "Các cấu trúc trung tâm cơ bản từ bản phân tích trước",
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
          subtitle: "Cấu trúc chiến lược bổ trợ",
          order: 99,
        },
        items,
      });
    }
  }

  groupedSections.sort((a, b) => a.meta.order - b.meta.order);

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

    return (
      <div
        key={idx}
        className="bg-card border border-border/60 rounded-surface p-4 shadow-xs hover:shadow-sm transition-[box-shadow,border-color] flex flex-col justify-between"
      >
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-control text-xs shrink-0 bg-primary/10 text-primary">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-sm text-foreground leading-tight">
                    {item.name}
                  </h4>
                  <PawnStructureInfoBadge structureName={item.name} />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {item.chapter && (
                    <>
                      <span className="text-[10px] font-bold text-primary">
                        {item.chapter}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">•</span>
                    </>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    Hình thành ~nước {item.typical_formation_move ?? 12}
                  </span>
                </div>
              </div>
            </div>

            <span
              className="assessment-tag border"
              style={{
                backgroundColor: `${item.assessment_color ?? "#94A3B8"}18`,
                color: `color-mix(in srgb, ${item.assessment_color ?? "#64748b"} 45%, #0f172a)`,
                borderColor: `${item.assessment_color ?? "#94A3B8"}55`,
              }}
            >
              {item.assessment_badge || "Bình thường"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/40 text-xs">
            <div>
              <span className="text-muted-foreground text-[11px] block">Điểm số đạt</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="font-bold text-foreground text-sm">{item.score_pct}%</span>
                <span className={`text-[10px] ${deltaColor}`}>{deltaStr}</span>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground text-[11px] block">Thành tích</span>
              <div className="font-medium text-foreground text-xs mt-0.5">
                <span className="text-emerald-800">{item.wins}T</span>{" "}
                <span className="text-muted-foreground">{item.draws}H</span>{" "}
                <span className="text-rose-800">{item.losses}B</span>
              </div>
            </div>
          </div>

          {item.strategic_plan && (
            <div className="mt-3 pt-2.5 border-t border-border/40 space-y-1.5">
              <div className="text-[11px] text-foreground font-medium flex items-start gap-1">
                <span className="text-primary font-bold shrink-0">💡 Kế hoạch:</span>
                <span className="line-clamp-2 text-muted-foreground">
                  {item.strategic_plan.ideas?.[0] || "Đang cập nhật..."}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">Độ tin cậy:</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                item.confidence === "high"
                  ? "bg-emerald-50 text-emerald-800"
                  : item.confidence === "medium"
                  ? "bg-amber-50 text-amber-800"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {item.confidence || "N/A"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {hasGames ? (
              <button
                type="button"
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
              <button
                type="button"
                onClick={() => exploreStructure(item, playerId)}
                className="text-[11px] font-bold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                Khám phá trên Bàn cờ →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="space-y-6">
        {groupedSections.map((sec) => (
          <div key={sec.meta.key} className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <h3 className="font-bold text-sm text-foreground">
                {sec.meta.title} ({sec.items.length})
              </h3>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">
                {sec.meta.subtitle}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sec.items.map((item, idx) => renderStructureCard(item, idx))}
            </div>
          </div>
        ))}
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
