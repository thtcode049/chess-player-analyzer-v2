"use client";

import React, { useState, useEffect } from "react";
import { ChessboardDnDProvider } from "react-chessboard";

interface SafeChessboardDnDProviderProps {
  children: React.ReactNode;
}

/**
 * Safe wrapper around react-chessboard's ChessboardDnDProvider.
 * Prevents SSR `ReferenceError: window is not defined` while sharing
 * a single HTML5Backend singleton across multiple boards (e.g. AnalyzeView & AiCoachView).
 */
export default function SafeChessboardDnDProvider({ children }: SafeChessboardDnDProviderProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <>{children}</>;
  }

  return <ChessboardDnDProvider>{children}</ChessboardDnDProvider>;
}
