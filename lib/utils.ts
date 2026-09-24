import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPercent(val?: number | null, decimals = 1): string {
  if (val === undefined || val === null || isNaN(val)) return "N/A";
  return `${val.toFixed(decimals)}%`;
}

export function formatACPL(val?: number | null): string {
  if (val === undefined || val === null || isNaN(val)) return "N/A";
  return `${val.toFixed(1)} cp`;
}

/**
 * Chuyển đổi ACPL (Average Centipawn Loss) sang Tỷ lệ Chính xác (%)
 * Công thức chuẩn FIDE/Lichess: Accuracy % = 100 * exp(-0.005 * ACPL)
 */
export function acplToAccuracy(acpl?: number | null): number | null {
  if (acpl === undefined || acpl === null || isNaN(acpl)) return null;
  if (acpl <= 0) return 100.0;
  const acc = 100.0 * Math.exp(-0.005 * acpl);
  return Math.round(Math.max(0, Math.min(100, acc)) * 10) / 10;
}

export function formatAccuracy(acpl?: number | null, decimals = 1): string {
  const acc = acplToAccuracy(acpl);
  if (acc === null) return "N/A";
  return `${acc.toFixed(decimals)}%`;
}

export function getEngineBadge(status: string) {
  switch (status) {
    case "embedded_eval":
      return {
        label: "Dữ liệu Động cơ Gốc",
        shortLabel: "Embedded Eval",
        color: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-500",
      };
    case "sampled_wasm":
      return {
        label: "Hồ sơ Ước tính Mẫu",
        shortLabel: "Sampled WASM",
        color: "bg-amber-50 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
      };
    case "full_engine":
      return {
        label: "Phân tích Động cơ Toàn diện",
        shortLabel: "Full Engine",
        color: "bg-purple-50 text-purple-700 border-purple-200",
        dot: "bg-purple-500",
      };
    default:
      return {
        label: "Chỉ số Thống kê",
        shortLabel: "Statistical Only",
        color: "bg-slate-50 text-slate-700 border-slate-200",
        dot: "bg-slate-400",
      };
  }
}
