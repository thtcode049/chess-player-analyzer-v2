"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placeBelow: boolean;
    width: number;
  } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const description = getPawnStructureDescription(structureName);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(300, window.innerWidth - 24);

    // Horizontal centering clamped to viewport boundaries
    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - popoverWidth - 12));

    // Vertical placement: place below if enough space or if button is high up in viewport
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeBelow = spaceBelow >= 200 || rect.top < 220;
    const top = placeBelow ? rect.bottom + 8 : rect.top - 8;

    setCoords({ top, left, placeBelow, width: popoverWidth });
  }, []);

  // Update position on open, window scroll, resize
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Close on click outside or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const sizeClasses = size === "md" ? "w-5 h-5" : "w-4 h-4";
  const iconSizeClasses = size === "md" ? "w-3.5 h-3.5" : "w-3 h-3";

  return (
    <div className={`relative inline-flex items-center shrink-0 ${className}`}>
      <button
        ref={buttonRef}
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

      {/* Floating Popover Card rendered via React Portal to escape overflow-hidden */}
      {isOpen &&
        mounted &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              transform: coords.placeBelow ? "none" : "translateY(-100%)",
              zIndex: 9999,
            }}
            className="p-3 bg-white border border-slate-200 rounded-surface shadow-2xl text-left animate-in fade-in zoom-in-95 pointer-events-auto"
          >
            <div className="flex items-center justify-between gap-1.5 border-b border-slate-100 pb-1.5 mb-1.5">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs min-w-0">
                <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{structureName || "Cấu trúc Tốt"}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition cursor-pointer shrink-0"
                aria-label="Đóng"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
              {description}
            </p>
          </div>,
          document.body
        )}
    </div>
  );
}
