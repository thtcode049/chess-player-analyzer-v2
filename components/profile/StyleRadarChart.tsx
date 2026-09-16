"use client";

import React from "react";
import { ShieldAlert, Award } from "lucide-react";

interface StyleRadarChartProps {
  metrics?: Record<string, number>;
  archetype?: string;
}

export default function StyleRadarChart({
  metrics = {},
  archetype = "Universal Master",
}: StyleRadarChartProps) {
  // Define 8 standard style dimensions
  const dimensions = [
    { key: "volatility", label: "Biến động (Volatility)" },
    { key: "sacrifice", label: "Thí quân (Sacrifice)" },
    { key: "simplification", label: "Đổi quân (Simplification)" },
    { key: "resilience", label: "Kiên cường (Resilience)" },
    { key: "tactical_sharpness", label: "Chiến thuật (Tactics)" },
    { key: "solid_defense", label: "Phòng thủ (Defense)" },
    { key: "endgame_affinity", label: "Cờ tàn (Endgame)" },
    { key: "pawn_structure", label: "Thế trận (Structure)" },
  ];

  // SVG Radar Polygon calculations
  const size = 320;
  const center = size / 2;
  const radius = center - 45;
  const totalAxes = dimensions.length;

  const getCoordinates = (index: number, valueRatio: number) => {
    const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
    const x = center + radius * valueRatio * Math.cos(angle);
    const y = center + radius * valueRatio * Math.sin(angle);
    return { x, y };
  };

  // Generate data polygon points
  const points = dimensions.map((d, i) => {
    const rawVal = metrics[d.key] ?? 50;
    const ratio = Math.max(0.1, Math.min(1.0, rawVal / 100));
    const { x, y } = getCoordinates(i, ratio);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col items-center">
      {/* Archetype Header */}
      <div className="w-full flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Hình mẫu Thi đấu
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {archetype}
            </h3>
          </div>
        </div>
      </div>

      {/* SVG Radar Chart */}
      <div className="relative py-4">
        <svg width={size} height={size} className="overflow-visible">
          {/* Background concentric reference polygons (25%, 50%, 75%, 100%) */}
          {[0.25, 0.5, 0.75, 1.0].map((level, lIdx) => {
            const levelPoints = dimensions
              .map((_, i) => {
                const { x, y } = getCoordinates(i, level);
                return `${x},${y}`;
              })
              .join(" ");
            return (
              <polygon
                key={lIdx}
                points={levelPoints}
                fill="none"
                stroke="currentColor"
                strokeWidth={lIdx === 3 ? "1.5" : "1"}
                strokeDasharray={lIdx === 3 ? "none" : "2,2"}
                className="text-slate-200 dark:text-slate-800"
              />
            );
          })}

          {/* Radial axis lines */}
          {dimensions.map((d, i) => {
            const { x, y } = getCoordinates(i, 1.0);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800"
              />
            );
          })}

          {/* Data Filled Polygon */}
          <polygon
            points={points}
            className="fill-emerald-500/25 stroke-emerald-500 stroke-2"
          />

          {/* Data Points */}
          {dimensions.map((d, i) => {
            const rawVal = metrics[d.key] ?? 50;
            const ratio = Math.max(0.1, Math.min(1.0, rawVal / 100));
            const { x, y } = getCoordinates(i, ratio);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="4"
                className="fill-emerald-500 stroke-white dark:stroke-slate-900 stroke-2"
              />
            );
          })}

          {/* Axis Labels */}
          {dimensions.map((d, i) => {
            const { x, y } = getCoordinates(i, 1.18);
            return (
              <text
                key={i}
                x={x}
                y={y}
                fontSize="10"
                fontWeight="600"
                textAnchor="middle"
                alignmentBaseline="middle"
                className="fill-slate-500 dark:fill-slate-400 select-none font-sans"
              >
                {d.label.split(" ")[0]}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Numerical Indicators Grid */}
      <div className="w-full grid grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
        {dimensions.slice(0, 4).map((d, i) => (
          <div key={i} className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-2">
            <span className="block text-[10px] text-slate-400 font-medium">
              {d.label.split(" ")[0]}
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {(metrics[d.key] ?? 50).toFixed(0)}/100
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
