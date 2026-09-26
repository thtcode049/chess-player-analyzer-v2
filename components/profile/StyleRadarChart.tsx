"use client";

import React from "react";
import { Award } from "lucide-react";

interface Dimension {
  key: string;
  label: string;
  fallbackKey?: string;
}

interface StyleRadarChartProps {
  metrics?: Record<string, number | boolean>;
  archetype?: string;
}

export default function StyleRadarChart({
  metrics = {},
  archetype,
}: StyleRadarChartProps) {
  // 7 trục thực nghiệm — double-key fallback để tương thích cả raw keys (backend)
  // lẫn mapped keys (analysis_service đã ánh xạ sẵn)
  const dimensions: Dimension[] = [
    { key: "volatility",           label: "Biến động",  fallbackKey: "volatility_score" },
    { key: "sacrifice",            label: "Thí quân",   fallbackKey: "sacrifice_rate" },
    { key: "simplification",       label: "Đổi quân",   fallbackKey: "simplification_rate" },
    { key: "resilience",           label: "Kiên cường", fallbackKey: "resilience_rate" },
    { key: "open_preference",      label: "Cờ mở",      fallbackKey: "open_preference" },
    { key: "closed_preference",    label: "Cờ kín",     fallbackKey: "closed_preference" },
    { key: "semi_open_preference", label: "Nửa mở",     fallbackKey: "semi_open_preference" },
  ];

  const getValue = (d: Dimension): number => {
    const primary = metrics[d.key];
    if (primary !== undefined && primary !== null && typeof primary === "number") return primary;
    if (d.fallbackKey) {
      const fb = metrics[d.fallbackKey];
      if (fb !== undefined && fb !== null && typeof fb === "number") return fb;
    }
    return 50;
  };

  const size = 320;
  const center = size / 2;
  const radius = center - 45;
  const totalAxes = dimensions.length;

  const getCoordinates = (index: number, valueRatio: number) => {
    const angle = (Math.PI * 2 / totalAxes) * index - Math.PI / 2;
    return {
      x: center + radius * valueRatio * Math.cos(angle),
      y: center + radius * valueRatio * Math.sin(angle),
    };
  };

  const points = dimensions
    .map((d, i) => {
      const ratio = Math.max(0.05, Math.min(1.0, getValue(d) / 100));
      const { x, y } = getCoordinates(i, ratio);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col items-center">
      <div className="w-full flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              {archetype && archetype !== "Universal Master" ? "Hình mẫu Thi đấu" : "Đặc tính Phong cách"}
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {archetype && archetype !== "Universal Master" ? archetype : "Phân Bố Chiến Lược"}
            </h3>
          </div>
        </div>
      </div>

      <div className="relative py-4">
        <svg width={size} height={size} className="overflow-visible">
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

          {dimensions.map((_, i) => {
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

          <polygon
            points={points}
            className="fill-emerald-500/25 stroke-emerald-500 stroke-2"
          />

          {dimensions.map((d, i) => {
            const ratio = Math.max(0.05, Math.min(1.0, getValue(d) / 100));
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

          {dimensions.map((d, i) => {
            const { x, y } = getCoordinates(i, 1.2);
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
                {d.label}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="w-full grid grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
        {dimensions.slice(0, 4).map((d, i) => (
          <div key={i} className="bg-slate-50 dark:bg-slate-800/40 rounded-lg p-2">
            <span className="block text-[10px] text-slate-400 font-medium mb-0.5">
              {d.label}
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {getValue(d).toFixed(0)}
              <span className="text-[9px] text-slate-400 font-normal">/100</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
