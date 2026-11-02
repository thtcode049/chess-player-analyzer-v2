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
      if (evalData.isCloud || evalData.depth >= 20) {
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

    // Check if evaluation for this exact FEN is already cached (instant 0ms)
    const cached = engineRef.current.getCachedEvaluation(fen);
    if (cached) {
      setEvaluation(cached);
      if (cached.isCloud || cached.depth >= depth) {
        setIsThinking(false);
        return;
      }
    }

    setIsThinking(true);

    // Start evaluation directly to target depth.
    // Stockfish's iterative deepening produces early depths (1, 2, 4...) within milliseconds,
    // so score updates immediately without restarting or jumping.
    engineRef.current.evaluatePosition(fen, depth, (evalData) => {
      setEvaluation(evalData);
      if (evalData.isCloud || evalData.depth >= depth) {
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
