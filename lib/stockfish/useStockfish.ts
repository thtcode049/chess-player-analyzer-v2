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
      if (evalData.bestMove && evalData.depth >= 10) {
        setIsThinking(false);
      }
    });

    engine.init();
    engineRef.current = engine;

    return () => {
      engine.terminate();
    };
  }, []);

  const evaluateFen = useCallback((fen: string, depth = 12) => {
    if (!engineRef.current) return;
    setIsThinking(true);
    engineRef.current.evaluatePosition(fen, depth, (evalData) => {
      setEvaluation(evalData);
      if (evalData.depth >= depth) {
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
