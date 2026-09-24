"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { StockfishEngineController, EngineEvaluation } from "./engineWorker";

export function useStockfish(defaultMultiPv = 3) {
  const engineRef = useRef<StockfishEngineController | null>(null);
  const [evaluation, setEvaluation] = useState<EngineEvaluation | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [multiPv, setMultiPvState] = useState(defaultMultiPv);

  useEffect(() => {
    const engine = new StockfishEngineController((evalData) => {
      setEvaluation({ ...evalData });
      if (evalData.depth >= 25 || evalData.bestMove) {
        setIsThinking(false);
      }
    });

    engine.init();
    engine.setMultiPv(multiPv);
    engineRef.current = engine;

    return () => {
      engine.terminate();
    };
  }, []);

  const setMultiPv = useCallback((count: number) => {
    const val = Math.max(1, Math.min(5, count));
    setMultiPvState(val);
    if (engineRef.current) {
      engineRef.current.setMultiPv(val);
    }
  }, []);

  const evaluateFen = useCallback(
    (fen: string, depth = 25, linesCount?: number) => {
      if (!engineRef.current) return;
      setIsThinking(true);
      const targetLines = linesCount !== undefined ? linesCount : multiPv;
      engineRef.current.evaluatePosition(fen, depth, targetLines, (evalData) => {
        setEvaluation({ ...evalData });
        if (evalData.depth >= depth || evalData.bestMove) {
          setIsThinking(false);
        }
      });
    },
    [multiPv]
  );

  const stop = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stop();
      setIsThinking(false);
    }
  }, []);

  return {
    evaluation,
    isThinking,
    multiPv,
    setMultiPv,
    evaluateFen,
    stop,
  };
}
