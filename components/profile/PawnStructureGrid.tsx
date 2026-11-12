"use client";

import React from "react";
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
                  <th className="px-2.5 py-2.5 sm:px-3.5">Cấu trúc Tốt</th>
                  <th className="px-2 py-2.5 w-11 sm:w-16 text-center">Số ván</th>
                  <th className="px-3 py-2.5 w-24 sm:w-48">Tỉ lệ W/D/L</th>
                  <th className="px-2.5 py-2.5 w-12 sm:w-20 text-right">Điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {sec.items.map((item, idx) => {
                  const count = item.games_count ?? item.games?.length ?? 0;
                  const total = count || 1;
                  const winPct = ((item.wins ?? 0) / total) * 100;
                  const drawPct = ((item.draws ?? 0) / total) * 100;
                  const lossPct = ((item.losses ?? 0) / total) * 100;
                  const score = item.score_pct;
                  const hasResults = item.wins != null && item.draws != null && item.losses != null;
                  const openStructure = playerId ? () => exploreStructure(item, playerId) : undefined;

                  return (
                    <tr
                      key={idx}
                      onClick={openStructure}
                      className={`hover:bg-muted/30 transition ${openStructure ? "cursor-pointer" : ""}`}
                    >
                      {/* Cấu trúc Tốt */}
                      <td className="px-2.5 py-2.5 sm:px-3.5">
                        <div className="flex items-center gap-1.5">
                          {openStructure ? (
                            <button
                              type="button"
                              aria-label={`Khám phá cấu trúc tốt ${item.name}`}
                              className="cursor-pointer text-left font-semibold text-foreground text-xs rounded-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                            >
                              {item.name}
                            </button>
                          ) : (
                            <span className="font-semibold text-foreground text-xs">{item.name}</span>
                          )}
                          <PawnStructureInfoBadge structureName={item.name} />
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {item.typical_formation_move != null ? `Hình thành khoảng nước ${item.typical_formation_move}` : "Chưa ghi nhận nước hình thành"}
                        </div>
                      </td>

                      {/* Số ván */}
                      <td className="px-2 py-2.5 text-center font-mono font-bold text-muted-foreground">
                        {count}
                      </td>

                      {/* Tỉ lệ W/D/L */}
                      <td className="px-3 py-2.5">
                        {hasResults ? <div className="space-y-1">
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
                        </div> : "—"}
                      </td>

                      {/* Điểm */}
                      <td className="px-2.5 py-2.5 text-right font-mono font-bold text-foreground">
                        {score == null ? "—" : score.toFixed(1) + "%"}
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
    <div className="space-y-6">
      {groupedSections.map((sec) => renderGroupTable(sec))}
    </div>
  );
}
