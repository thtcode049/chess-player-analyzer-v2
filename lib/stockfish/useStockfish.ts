"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { StockfishEngineController, EngineEvaluation } from "./engineWorker";

export function useStockfish() {
  const engineRef = useRef<StockfishEngineController | null>(null);
  const [evaluation, setEvaluation] = useState<EngineEvaluation | null>(null);
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    const engine = new StockfishEngineController((evalData) => {
      setEvaluation(evalData);
      if (evalData.isCloud || evalData.depth >= 14) {
        setIsThinking(false);
      }
    });

    engine.init();
    engineRef.current = engine;

    return () => {
      engine.terminate();
    };
  }, []);

  const evaluateFen = useCallback((fen: string, depth = 20) => {
    if (!engineRef.current) return;

    // Check if evaluation for this exact FEN is already cached
    const cached = engineRef.current.getCachedEvaluation(fen);
    if (cached) {
      setEvaluation(cached);
      setIsThinking(false);
      if (cached.isCloud || cached.depth >= depth) {
        return;
      }
    } else {
      // Clear evaluation immediately so previous move's score does not linger
      setEvaluation(null);
      setIsThinking(true);
    }

    engineRef.current.evaluatePosition(fen, depth, (evalData) => {
      setEvaluation(evalData);
      if (evalData.isCloud || evalData.depth >= 14) {
        setIsThinking(false);
      }
    });
  }, []);

  const stop = useCallback(() => {
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
