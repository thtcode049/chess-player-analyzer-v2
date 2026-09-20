import React from "react";

interface ChessLookLogoProps {
  className?: string;
  withText?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * ChessLook Official Brand Logo Component
 * Incorporates the official ChessLook emblem (Queen within magnifying glass with growth analytics).
 */
export default function ChessLookLogo({
  className = "",
  withText = true,
  size = "md"
}: ChessLookLogoProps) {
  const sizeMap = {
    sm: { img: "w-7 h-7", text: "text-base", sub: "text-[9px]" },
    md: { img: "w-9 h-9", text: "text-lg", sub: "text-[10px]" },
    lg: { img: "w-12 h-12", text: "text-2xl", sub: "text-xs" }
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex items-center gap-2.5 select-none group ${className}`}>
      {/* Brand Image Mark */}
      <div className="relative flex items-center justify-center shrink-0">
        <img
          src="/logo.png"
          alt="ChessLook"
          className={`${currentSize.img} object-contain filter drop-shadow-sm transition-transform duration-300 group-hover:scale-105`}
        />
      </div>

      {/* Typography */}
      {withText && (
        <div className="flex flex-col">
          <div className="flex items-center tracking-tight leading-none">
            <span className={`font-black ${currentSize.text} text-slate-900 dark:text-white`}>
              Chess<span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500">Look</span>
            </span>
          </div>
          <span className={`${currentSize.sub} font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase mt-0.5`}>
            Phân tích &amp; Cố vấn Cờ vua
          </span>
        </div>
      )}
    </div>
  );
}
