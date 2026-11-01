"use client";

import React, { useState, useRef, useEffect } from "react";
import { getPawnStructureDescription } from "@/lib/chess/pawnStructureDescriptions";
import { Info, X } from "lucide-react";

interface PawnStructureInfoBadgeProps {
  structureName?: string | null;
  className?: string;
  size?: "sm" | "md";
}

export default function PawnStructureInfoBadge({
  structureName,
  className = "",
  size = "sm",
}: PawnStructureInfoBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const description = getPawnStructureDescription(structureName);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const sizeClasses = size === "md" ? "w-5 h-5" : "w-4 h-4";
  const iconSizeClasses = size === "md" ? "w-3.5 h-3.5" : "w-3 h-3";

  return (
    <div ref={containerRef} className={`relative inline-flex items-center shrink-0 ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        title={`Ghi chú cấu trúc tốt:\n${description}`}
        aria-label="Xem ghi chú thích cấu trúc tốt"
        className={`${sizeClasses} rounded-full bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-700 font-bold font-mono flex items-center justify-center transition cursor-pointer select-none`}
      >
        <Info className={iconSizeClasses} aria-hidden="true" />
      </button>

      {/* Floating Popover Card on Click */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 bottom-full mb-1.5 left-1/2 -translate-x-1/2 w-64 sm:w-72 p-3 bg-white border border-slate-200 rounded-surface shadow-xl text-left animate-in fade-in zoom-in-95"
        >
          <div className="flex items-center justify-between gap-1.5 border-b border-slate-100 pb-1.5 mb-1.5">
            <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
              <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">{structureName || "Cấu trúc Tốt"}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
            {description}
          </p>
        </div>
      )}
    </div>
  );
}
