"use client";

import React, { useMemo } from "react";

export interface StyleRadarMetrics {
  tactical?: number; // Tấn công & Chiến thuật
  volatility?: number; // Độ biến động
  resilience?: number; // Khả năng lội ngược dòng
  simplification?: number; // Đơn giản hóa & Chuyển tàn cuộc
  opening_prep?: number; // Chiều sâu chuẩn bị khai cuộc
  middlegame?: number; // Xử lý trung cuộc
  endgame?: number; // Chuẩn xác tàn cuộc
  solidness?: number; // Độ an toàn & Kiểm soát ACPL
  [key: string]: number | undefined;
}

interface StyleRadarChartProps {
  metrics?: StyleRadarMetrics | null;
  playerName?: string;
  size?: number;
}

const AXES = [
  { key: "tactical", label: "Tấn Công", angle: 0 },
  { key: "volatility", label: "Biến Động", angle: 45 },
  { key: "resilience", label: "Lội Ngược Dòng", angle: 90 },
  { key: "simplification", label: "Đơn Giản Hóa", angle: 135 },
  { key: "endgame", label: "Tàn Cuộc", angle: 180 },
  { key: "solidness", label: "An Toàn", angle: 225 },
  { key: "middlegame", label: "Trung Cuộc", angle: 270 },
  { key: "opening_prep", label: "Khai Cuộc", angle: 315 },
];

export default function StyleRadarChart({
  metrics,
  playerName = "Kỳ thủ",
  size = 320,
}: StyleRadarChartProps) {
  const center = size / 2;
  const radius = (size - 80) / 2;

  // Normalized values 0..100
  const normalizedValues = useMemo(() => {
    const m = metrics || {};
    return {
      tactical: Math.max(15, Math.min(100, m.tactical ?? m.aggression ?? 65)),
      volatility: Math.max(15, Math.min(100, m.volatility ?? m.volatility_score ?? 55)),
      resilience: Math.max(15, Math.min(100, m.resilience ?? m.resilience_rate ?? 60)),
      simplification: Math.max(15, Math.min(100, m.simplification ?? m.simplification_rate ?? 50)),
      endgame: Math.max(15, Math.min(100, m.endgame ?? 58)),
      solidness: Math.max(15, Math.min(100, m.solidness ?? 62)),
      middlegame: Math.max(15, Math.min(100, m.middlegame ?? 70)),
      opening_prep: Math.max(15, Math.min(100, m.opening_prep ?? 75)),
    };
  }, [metrics]);

  // Compute SVG polygon points
  const polygonPoints = useMemo(() => {
    return AXES.map((axis) => {
      const val = (normalizedValues as any)[axis.key] || 50;
      const r = (val / 100) * radius;
      const rad = ((axis.angle - 90) * Math.PI) / 180;
      const x = center + r * Math.cos(rad);
      const y = center + r * Math.sin(rad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }, [normalizedValues, center, radius]);

  // Grid levels (25%, 50%, 75%, 100%)
  const levels = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-card border border-border/70 rounded-3xl shadow-xs">
      <div className="w-full flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Biểu Đồ Phong Cách 8 Trục (Style Radar)
          </h4>
        </div>
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          Normalized
        </span>
      </div>

      <svg width={size} height={size} className="overflow-visible select-none">
        {/* Background Radial Webs */}
        {levels.map((lvl, idx) => {
          const r = radius * lvl;
          const points = AXES.map((axis) => {
            const rad = ((axis.angle - 90) * Math.PI) / 180;
            const x = center + r * Math.cos(rad);
            const y = center + r * Math.sin(rad);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(" ");

          return (
            <polygon
              key={idx}
              points={points}
              fill={idx === levels.length - 1 ? "rgba(16, 185, 129, 0.02)" : "none"}
              stroke="currentColor"
              strokeDasharray={idx < levels.length - 1 ? "3 3" : undefined}
              className="text-border/60"
              strokeWidth={idx === levels.length - 1 ? 1.5 : 1}
            />
          );
        })}

        {/* Axis Lines */}
        {AXES.map((axis, idx) => {
          const rad = ((axis.angle - 90) * Math.PI) / 180;
          const x2 = center + radius * Math.cos(rad);
          const y2 = center + radius * Math.sin(rad);
          return (
            <line
              key={idx}
              x1={center}
              y1={center}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              className="text-border/60"
              strokeWidth={1}
            />
          );
        })}

        {/* Radar Value Polygon with Gradient Fill */}
        <defs>
          <linearGradient id="radarEmeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        <polygon
          points={polygonPoints}
          fill="url(#radarEmeraldGrad)"
          stroke="#10b981"
          strokeWidth={2.5}
          className="transition-all duration-700 ease-out drop-shadow-sm"
        />

        {/* Data Points on Vertices */}
        {AXES.map((axis, idx) => {
          const val = (normalizedValues as any)[axis.key] || 50;
          const r = (val / 100) * radius;
          const rad = ((axis.angle - 90) * Math.PI) / 180;
          const x = center + r * Math.cos(rad);
          const y = center + r * Math.sin(rad);

          return (
            <g key={idx} className="transition-all duration-700">
              <circle
                cx={x}
                cy={y}
                r={4}
                className="fill-emerald-500 stroke-background stroke-2 shadow-xs"
              />
            </g>
          );
        })}

        {/* Axis Labels */}
        {AXES.map((axis, idx) => {
          const labelDist = radius + 22;
          const rad = ((axis.angle - 90) * Math.PI) / 180;
          const lx = center + labelDist * Math.cos(rad);
          const ly = center + labelDist * Math.sin(rad);
          const val = (normalizedValues as any)[axis.key] || 50;

          return (
            <text
              key={idx}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              className="text-[10px] font-bold fill-muted-foreground transition-colors hover:fill-foreground"
            >
              {axis.label} ({val})
            </text>
          );
        })}
      </svg>
    </div>
  );
}
