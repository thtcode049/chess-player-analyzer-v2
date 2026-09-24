"use client";

import React, { useState } from "react";
import { Cpu, Zap, Loader2, CheckCircle2, Play, RefreshCw, BarChart2, ShieldCheck } from "lucide-react";
import { Game, AnalysisRun } from "@/lib/api/types";
import { apiClient } from "@/lib/api/client";
import { analyzeAllGamesWithWasm, AnalyzerProgress, FullAnalysisResult } from "@/lib/stockfish/fullGameAnalyzer";

interface WasmAnalysisCardProps {
  playerId: string;
  playerName: string;
  games: Game[];
  currentRun: AnalysisRun | null;
  onAnalysisComplete: (updatedRun: AnalysisRun) => void;
}

export default function WasmAnalysisCard({
  playerId,
  playerName,
  games,
  currentRun,
  onAnalysisComplete,
}: WasmAnalysisCardProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<AnalyzerProgress | null>(null);
  const [stats, setStats] = useState<{
    elapsedSeconds: number;
    totalMoves: number;
    cacheHits: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasFullAnalysis =
    currentRun?.engine_coverage_pct === 100 &&
    currentRun?.overall_acpl !== null &&
    currentRun?.overall_acpl !== undefined;

  const handleStartAnalysis = async () => {
    if (games.length === 0) {
      alert("Chưa có ván đấu nào để phân tích!");
      return;
    }

    setIsRunning(true);
    setErrorMsg(null);
    setProgress({
      stage: "extracting",
      completedFens: 0,
      totalFens: 0,
      uniqueFensCount: 0,
      percent: 0,
      workerCount: 0,
    });

    try {
      const result: FullAnalysisResult = await analyzeAllGamesWithWasm(
        games,
        playerName,
        {
          depth: 6,
          onProgress: (prog) => {
            setProgress(prog);
          },
        }
      );

      setStats({
        elapsedSeconds: result.elapsedSeconds,
        totalMoves: result.totalMovesAnalyzed,
        cacheHits: result.cacheHitCount,
      });

      // Prepare sync payload with player_id & run_id
      const syncData = {
        ...result.syncPayload,
        player_id: playerId,
        run_id: currentRun?.id || playerId,
      };

      // Sync with backend API & Supabase
      const updatedRun = await apiClient.syncEvaluations(syncData);

      // Optimistic instant local update callback
      onAnalysisComplete(updatedRun);
    } catch (err: any) {
      console.error("[WasmAnalysisCard] Error during WASM analysis:", err);
      setErrorMsg(err.message || "Lỗi khi chạy phân tích Stockfish WASM");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card/90 to-primary/5 p-6 shadow-md transition-all">
      {/* Background ambient glow */}
      <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
              <Cpu className="w-3.5 h-3.5" />
              Stockfish 18 WASM • Multi-Worker Engine
            </span>

            {hasFullAnalysis && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                100% Nước Đi Đã Phân Tích
              </span>
            )}
          </div>

          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            {hasFullAnalysis
              ? "Hồ Sơ Đã Có Đánh Giá Toàn Diện Bằng Engine"
              : "Phân Tích Toàn Bộ 100% Nước Đi Bằng Stockfish Trình Duyệt"}
          </h3>

          <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
            {hasFullAnalysis
              ? `Tất cả ${games.length} ván đấu (${currentRun?.games_analyzed_count} ván) đã được đánh giá trọn vẹn từng nước đi bằng cụm Stockfish WASM. ACPL trung bình: ${currentRun?.overall_acpl?.toFixed(1) || "?"} cp.`
              : `Khử trùng lặp thế cờ (FEN Deduplication) và phân bổ song song qua 4-6 Web Workers trên máy của bạn. 0s chờ máy chủ, không giới hạn timeout, phân tích từ nước 1 đến nước cuối.`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleStartAnalysis}
            disabled={isRunning || games.length === 0}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all ${
              hasFullAnalysis
                ? "border border-border/80 bg-background/80 hover:bg-card text-foreground"
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20 hover:scale-[1.02]"
            } disabled:opacity-50 disabled:pointer-events-none`}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-current" />
                <span>Đang phân tích ({progress?.percent || 0}%)...</span>
              </>
            ) : hasFullAnalysis ? (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Phân Tích Lại Bằng WASM</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current" />
                <span>Kích Hoạt Phân Tích 100% Ván</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Progress Bar Section */}
      {isRunning && progress && (
        <div className="mt-5 pt-4 border-t border-border/40 space-y-2.5 animate-fade-in">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              {progress.stage === "extracting" && "Đang trích xuất toàn bộ chuỗi thế cờ FEN..."}
              {progress.stage === "evaluating" &&
                `Đang tính toán Stockfish: ${progress.completedFens} / ${progress.totalFens} thế cờ (${progress.workerCount} Workers)...`}
              {progress.stage === "aggregating" && "Đang tổng hợp ma trận ACPL và phân loại nước đi..."}
              {progress.stage === "completed" && "Hoàn tất phân tích 100%!"}
            </span>

            <span className="font-bold text-primary tabular-nums">
              {progress.percent}%
              {progress.estimatedRemainingSec !== undefined && progress.estimatedRemainingSec > 0 && (
                <span className="text-muted-foreground font-normal ml-2">
                  (Còn ~{progress.estimatedRemainingSec}s)
                </span>
              )}
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-secondary/80 overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-primary via-emerald-500 to-sky-500 transition-all duration-300 rounded-full"
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span>
              Tổng số thế cờ độc nhất: <b>{progress.uniqueFensCount} FENs</b>
            </span>
            <span>
              Công nghệ: <b>WebAssembly SIMD (Đa luồng Client)</b>
            </span>
          </div>
        </div>
      )}

      {/* Completion summary badge */}
      {stats && !isRunning && (
        <div className="mt-4 pt-3 border-t border-border/40 flex flex-wrap items-center justify-between text-xs text-muted-foreground">
          <span className="text-emerald-500 font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            Đã phân tích trọn vẹn {stats.totalMoves} nước đi trong {stats.elapsedSeconds}s!
          </span>
          {stats.cacheHits > 0 && (
            <span>
              Tiết kiệm nhờ FEN Cache: <b>{stats.cacheHits} thế cờ</b>
            </span>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
