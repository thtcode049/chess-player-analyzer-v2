"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { StockfishEngineController, EngineEvaluation } from "./engineWorker";

export function useStockfish() {
  const engineRef = useRef<StockfishEngineController | null>(null);
  const [evaluation, setEvaluation] = useState<EngineEvaluation | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const deepTimerRef = useRef<any>(null);

  useEffect(() => {
    const engine = new StockfishEngineController((evalData) => {
      setEvaluation(evalData);
      if (evalData.isCloud || evalData.depth >= 20) {
        setIsThinking(false);
      }
    });

    engine.init();
    engineRef.current = engine;

    return () => {
      if (deepTimerRef.current) {
        clearTimeout(deepTimerRef.current);
        deepTimerRef.current = null;
      }
      engine.terminate();
    };
  }, []);

  const evaluateFen = useCallback((fen: string, depth = 20) => {
    if (!engineRef.current) return;

    if (deepTimerRef.current) {
      clearTimeout(deepTimerRef.current);
      deepTimerRef.current = null;
    }

    // Check if evaluation for this exact FEN is already cached
    const cached = engineRef.current.getCachedEvaluation(fen);
    if (cached) {
      setEvaluation(cached);
      if (cached.isCloud || cached.depth >= depth) {
        setIsThinking(false);
        return;
      }
    } else {
      // Clear evaluation immediately so previous move's score does not linger
      setEvaluation(null);
    }

    setIsThinking(true);

    // Stage 1: Quick responsive evaluation (depth 14) for instantaneous feedback
    const quickDepth = Math.min(14, depth);
    engineRef.current.evaluatePosition(fen, quickDepth, (evalData) => {
      setEvaluation(evalData);
      if (evalData.isCloud || evalData.depth >= depth) {
        setIsThinking(false);
      }
    });

    // Stage 2: Progressive deepening to depth 20 after 600ms idle pause
    if (depth > 14) {
      deepTimerRef.current = setTimeout(() => {
        if (!engineRef.current) return;
        const current = engineRef.current.getCachedEvaluation(fen);
        if (current && (current.isCloud || current.depth >= depth)) {
          return;
        }
        engineRef.current.evaluatePosition(fen, depth, (evalData) => {
          setEvaluation(evalData);
          if (evalData.isCloud || evalData.depth >= depth) {
            setIsThinking(false);
          }
        });
      }, 600);
    }
  }, []);

  const stop = useCallback(() => {
    if (deepTimerRef.current) {
      clearTimeout(deepTimerRef.current);
      deepTimerRef.current = null;
    }
    if (engineRef.current) {
      engineRef.current.stop();
      setIsThinking(false);
    }
  }, []);

  return {
    evaluation,
    isThinking,
    evaluateFen,
    stop,
  };
}
