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
    md: {
      img: "w-8 h-8 sm:w-9 sm:h-9",
      text: "text-base sm:text-lg",
      sub: "hidden sm:inline text-[10px]",
    },
    lg: { img: "w-12 h-12", text: "text-2xl", sub: "text-xs" }
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Brand Image Mark */}
      <div className="relative flex items-center justify-center shrink-0">
        <img
          src="/logo.png"
          alt="ChessLook"
          className={`${currentSize.img} object-contain`}
        />
      </div>

      {/* Typography */}
      {withText && (
        <div className="flex flex-col">
          <div className="flex items-center tracking-tight leading-none">
            <span className={`font-black ${currentSize.text} text-slate-900`}>
              Chess<span className="text-emerald-600">Look</span>
            </span>
          </div>
          <span className={`${currentSize.sub} font-semibold text-muted-foreground tracking-wider uppercase mt-0.5`}>
            Phân tích &amp; Cố vấn Cờ vua
          </span>
        </div>
      )}
    </div>
  );
}
