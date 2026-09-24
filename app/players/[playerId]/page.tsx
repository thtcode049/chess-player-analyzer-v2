"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Trophy, 
  BarChart2, 
  Layers, 
  Sword, 
  Brain, 
  ShieldCheck, 
  RefreshCw, 
  ArrowLeft, 
  Play, 
  Loader2,
  Sparkles,
  ExternalLink,
  Check
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Player, Game, AnalysisRun } from "@/lib/api/types";
import OpeningTreeTable from "@/components/analysis/OpeningTreeTable";
import StyleRadarChart from "@/components/profile/StyleRadarChart";
import PawnStructureGrid from "@/components/profile/PawnStructureGrid";
import AiCoachChat from "@/components/ai/AiCoachChat";
import WasmAnalysisCard from "@/components/analysis/WasmAnalysisCard";
import { formatAccuracy, acplToAccuracy } from "@/lib/utils";

export default function PlayerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const playerId = params.playerId as string;

  const [activeTab, setActiveTab] = useState<"overview" | "openings" | "structures" | "games" | "ai">("overview");
  const [player, setPlayer] = useState<Player | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [analysisRun, setAnalysisRun] = useState<AnalysisRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState(false);

  // Filter state for games tab
  const [gameColorFilter, setGameColorFilter] = useState<string>("all");

  useEffect(() => {
    if (!playerId) return;

    const loadData = async () => {
      try {
        setLoading(true);
        // Load player info
        const p = await apiClient.getPlayer(playerId).catch(() => null);
        if (p) {
          setPlayer(p);
        } else {
          // Fallback player mock for display if offline or direct navigation
          setPlayer({
            id: playerId,
            user_id: "demo",
            canonical_name: "Kỳ Thủ Thử Nghiệm",
            title: "GM",
            notes: "Hồ sơ phân tích toàn diện phong cách và hệ thống khai cuộc.",
            total_games: 120,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        // Load games safely handling paginated or array response (up to 500 games)
        const gRes = await apiClient.getPlayerGames(playerId, { pageSize: 500 }).catch(() => null);
        const gameItems = Array.isArray(gRes) ? gRes : ((gRes as any)?.items || []);
        setGames(gameItems);

        // Load real analysis run from API
        let run: AnalysisRun | null = null;
        try {
          run = await apiClient.getAnalysisRun(playerId);
        } catch {
          try {
            run = await apiClient.createAnalysisRun({ player_id: playerId });
          } catch (runErr) {
            console.warn("Could not get or create analysis run:", runErr);
          }
        }
        if (run) {
          setAnalysisRun(run);
        }
      } catch (err: any) {
        console.error("Lỗi khi tải thông tin kỳ thủ:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [playerId]);


  const handleTriggerAnalysis = async () => {
    setRunningAnalysis(true);
    try {
      const run = await apiClient.createAnalysisRun({
        player_id: playerId,
        run_label: `Phân tích ngày ${new Date().toLocaleDateString("vi-VN")}`,
      });
      setAnalysisRun(run);
      alert("Đã cập nhật phân tích mới thành công!");
    } catch (err: any) {
      alert("Lỗi chạy phân tích: " + (err.message || "Kiểm tra kết nối"));
    } finally {
      setRunningAnalysis(false);
    }
  };

  const safeGames = Array.isArray(games) ? games : [];
  const filteredGames = safeGames.filter(g => {
    if (!g) return false;
    const pName = (player?.canonical_name || "").toLowerCase();
    const wPlayer = (g.white_player || "").toLowerCase();
    const bPlayer = (g.black_player || "").toLowerCase();
    if (gameColorFilter === "white") return wPlayer.includes(pName);
    if (gameColorFilter === "black") return bPlayer.includes(pName);
    return true;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Đang tải hồ sơ kỳ thủ & dữ liệu ván đấu...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/players"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại Thư viện Kỳ thủ
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={handleTriggerAnalysis}
            disabled={runningAnalysis}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50"
          >
            {runningAnalysis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Chạy Phân Tích Lại
          </button>
          <Link
            href={`/import?playerId=${playerId}&playerName=${encodeURIComponent(player?.canonical_name || '')}`}
            className="px-3.5 py-2 border border-border/60 text-xs font-medium rounded-xl hover:bg-card text-foreground transition-all"
          >
            + Nhập Thêm Ván
          </Link>
        </div>
      </div>

      {/* Player Dossier Banner */}
      <div className="bg-card border border-border/60 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center text-primary font-black text-2xl shadow-inner">
              {player?.canonical_name?.slice(0, 2).toUpperCase() || "KT"}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                  {player?.canonical_name}
                </h1>
                {player?.title && (
                  <span className="px-2.5 py-1 text-xs font-black uppercase rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/30">
                    {player.title}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">
                {player?.notes || "Kỳ thủ đang được theo dõi và phân tích chiến lược tự động."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 border-t md:border-t-0 md:border-l border-border/40 pt-4 md:pt-0 md:pl-6 w-full md:w-auto justify-between md:justify-end">
            <div>
              <span className="text-[11px] uppercase font-bold text-muted-foreground block">Tổng số ván</span>
              <span className="text-xl font-extrabold text-foreground">
                {analysisRun?.games_analyzed_count || games.length || 0}
              </span>
            </div>
            <div>
              <span className="text-[11px] uppercase font-bold text-muted-foreground block">Điểm số chung</span>
              <span className="text-xl font-extrabold text-emerald-500">
                {analysisRun?.overall_score ? `${analysisRun.overall_score.toFixed(1)}%` : "N/A"}
              </span>
            </div>
            <div>
              <span className="text-[11px] uppercase font-bold text-muted-foreground block">Tỷ lệ chính xác</span>
              <span className="text-xl font-extrabold text-sky-500">
                {formatAccuracy(analysisRun?.overall_acpl)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Wasm Multi-Worker Analysis Card */}
      <WasmAnalysisCard
        playerId={playerId}
        playerName={player?.canonical_name || "Player"}
        games={games}
        currentRun={analysisRun}
        onAnalysisComplete={(updatedRun) => {
          setAnalysisRun(updatedRun);
        }}
      />

      {/* Tabs Navigation */}
      <div className="flex border-b border-border/60 overflow-x-auto gap-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Tổng Quan & Chỉ Số
        </button>
        <button
          onClick={() => setActiveTab("openings")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === "openings"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Play className="w-4 h-4" />
          Cây Khai Cuộc
        </button>
        <button
          onClick={() => setActiveTab("structures")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === "structures"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="w-4 h-4" />
          Cấu Trúc Tốt & Radar Phong Cách
        </button>
        <button
          onClick={() => setActiveTab("games")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === "games"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sword className="w-4 h-4" />
          Danh Sách Ván Đấu ({games.length})
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
            activeTab === "ai"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Brain className="w-4 h-4" />
          Trợ Lí AI Tham Mưu
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Score by Color */}
            <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Hiệu Suất Theo Màu Quân
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-muted-foreground">Quân Trắng (White Score)</span>
                    <span className="text-foreground">{analysisRun?.white_score?.toFixed(1) || 50}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${analysisRun?.white_score || 50}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-muted-foreground">Quân Đen (Black Score)</span>
                    <span className="text-foreground">{analysisRun?.black_score?.toFixed(1) || 50}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div 
                      className="h-full bg-sky-500 rounded-full transition-all duration-500"
                      style={{ width: `${analysisRun?.black_score || 50}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Phase Accuracy Breakdown */}
            <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-sky-500" />
                Độ Chính Xác Từng Giai Đoạn (Accuracy %)
              </h3>
              <div className="space-y-3.5 text-xs">
                <div>
                  <div className="flex justify-between py-1 border-b border-border/40 mb-1">
                    <span className="text-muted-foreground">Khai cuộc (Opening Accuracy):</span>
                    <span className="font-bold text-foreground">{formatAccuracy(analysisRun?.acpl_opening)}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-secondary/80 overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${acplToAccuracy(analysisRun?.acpl_opening) || 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between py-1 border-b border-border/40 mb-1">
                    <span className="text-muted-foreground">Trung cuộc (Middlegame Accuracy):</span>
                    <span className="font-bold text-foreground">{formatAccuracy(analysisRun?.acpl_middlegame)}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-secondary/80 overflow-hidden">
                    <div 
                      className="h-full bg-sky-500 rounded-full transition-all duration-500"
                      style={{ width: `${acplToAccuracy(analysisRun?.acpl_middlegame) || 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between py-1 border-b border-border/40 mb-1">
                    <span className="text-muted-foreground">Cờ tàn (Endgame Accuracy):</span>
                    <span className="font-bold text-foreground">{formatAccuracy(analysisRun?.acpl_endgame)}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-secondary/80 overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${acplToAccuracy(analysisRun?.acpl_endgame) || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Engine Status & Coverage */}
            <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Trạng Thái Động Cơ Đánh Giá
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Cơ chế engine:</span>
                  <span className="font-bold text-emerald-500">
                    {analysisRun?.engine_name || (analysisRun?.engine_status === "stockfish_parallel" ? "Stockfish 17 Parallel" : analysisRun?.engine_status?.toUpperCase() || "STOCKFISH")}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Độ phủ engine:</span>
                  <span className="font-bold text-foreground">{analysisRun?.engine_coverage_pct?.toFixed(1) || 0}% ván</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Hình mẫu chủ đạo:</span>
                  <span className="font-bold text-amber-500">{analysisRun?.dominant_archetype || "Universal Master"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Repertoire quick preview */}
          {analysisRun?.opening_tree_snapshot && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-foreground">Khai Cuộc Trọng Tâm</h3>
              <OpeningTreeTable
                continuations={analysisRun.opening_tree_snapshot.continuations}
                totalGames={analysisRun.games_analyzed_count}
                onSelectMove={(san) => router.push(`/analyze?playerId=${playerId}&runId=${analysisRun?.id || ""}&move=${san}`)}
              />
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Openings */}
      {activeTab === "openings" && (
        <div className="space-y-8">
          {/* Bayesian Shrinkage Repertoire Assessment */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Play className="w-5 h-5 text-primary" />
                  Đánh Giá Hiệu Suất Khai Cuộc (Bayesian Adjusted)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Đánh giá khách quan điểm mạnh & điểm yếu thực sự so với mức trung bình cơ sở.
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-lg bg-secondary text-foreground font-semibold">
                Điểm cơ sở: {analysisRun?.repertoire_summary?.overall_baseline?.toFixed(1) || 50}%
              </span>
            </div>

            {/* Repertoire Items Table */}
            {analysisRun?.repertoire_summary?.all_openings && analysisRun.repertoire_summary.all_openings.length > 0 ? (
              <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-400 font-bold uppercase tracking-wider border-b border-border/60">
                      <tr>
                        <th className="px-4 py-3">Hệ thống Khai cuộc</th>
                        <th className="px-3 py-3">Số ván</th>
                        <th className="px-4 py-3 min-w-[140px]">Tỷ lệ Kết quả</th>
                        <th className="px-3 py-3 text-right">Điểm thực</th>
                        <th className="px-3 py-3 text-right">Điểm Bayes</th>
                        <th className="px-3 py-3 text-right">Độ lệch (Δ)</th>
                        <th className="px-4 py-3">Đánh giá Hiệu suất</th>
                        <th className="px-3 py-3 text-center">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {analysisRun.repertoire_summary.all_openings.map((op: any, idx: number) => {
                        const delta = op.delta_vs_baseline || 0;
                        const isPositive = delta > 0;
                        const badgeColor = op.assessment_color || (isPositive ? "#10B981" : "#EF4444");

                        return (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                            <td className="px-4 py-3 font-semibold text-foreground">
                              {op.name}
                            </td>
                            <td className="px-3 py-3 font-mono font-bold text-muted-foreground">
                              {op.games_count}
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                <div className="wdl-bar">
                                  <div
                                    className="wdl-bar-win"
                                    style={{ width: `${op.win_pct}%` }}
                                    title={`Thắng: ${op.win_pct?.toFixed(1)}%`}
                                  />
                                  <div
                                    className="wdl-bar-draw"
                                    style={{ width: `${op.draw_pct}%` }}
                                    title={`Hòa: ${op.draw_pct?.toFixed(1)}%`}
                                  />
                                  <div
                                    className="wdl-bar-loss"
                                    style={{ width: `${op.loss_pct}%` }}
                                    title={`Thua: ${op.loss_pct?.toFixed(1)}%`}
                                  />
                                </div>
                                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                                  <span className="text-emerald-500 font-bold">{op.win_pct?.toFixed(0)}%</span>
                                  <span>{op.draw_pct?.toFixed(0)}%</span>
                                  <span className="text-rose-500 font-bold">{op.loss_pct?.toFixed(0)}%</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right font-mono font-bold text-foreground">
                              {op.raw_score_pct?.toFixed(1) || op.score_pct?.toFixed(1)}%
                            </td>
                            <td className="px-3 py-3 text-right font-mono font-bold text-primary">
                              {op.adjusted_score_pct?.toFixed(1)}%
                            </td>
                            <td className={`px-3 py-3 text-right font-mono font-bold ${isPositive ? "text-emerald-500" : delta < 0 ? "text-rose-500" : "text-muted-foreground"}`}>
                              {isPositive ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="inline-block px-2 py-0.5 rounded text-[11px] font-bold"
                                style={{
                                  backgroundColor: `${badgeColor}20`,
                                  color: badgeColor,
                                  border: `1px solid ${badgeColor}40`
                                }}
                              >
                                {op.assessment_badge || op.assessment_label || op.assessment}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <Link
                                href={`/analyze?playerId=${playerId}&runId=${analysisRun.id}&opening=${encodeURIComponent(op.name)}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground font-semibold text-[11px] transition text-foreground"
                              >
                                <span>Phân tích</span>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center bg-card border border-border/40 rounded-2xl text-muted-foreground text-xs">
                Chưa đủ số ván đấu để phân loại hiệu suất khai cuộc.
              </div>
            )}
          </div>

          {/* Root Opening Tree Continuations */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">Các Nước Đi Khai Cuộc Đầu Tiên (Starting Position)</h3>
              <span className="text-xs text-muted-foreground">Chọn nước đi để nhảy vào Bàn cờ phân tích</span>
            </div>
            {analysisRun?.opening_tree_snapshot ? (
              <OpeningTreeTable
                continuations={analysisRun.opening_tree_snapshot.continuations}
                totalGames={analysisRun.games_analyzed_count}
                onSelectMove={(san) => router.push(`/analyze?playerId=${playerId}&runId=${analysisRun.id}&move=${san}`)}
              />
            ) : (
              <div className="p-8 text-center bg-card border border-border/40 rounded-2xl text-muted-foreground text-sm">
                Chưa có dữ liệu cây khai cuộc cho kỳ thủ này.
              </div>
            )}
          </div>
        </div>
      )}


      {/* Tab 3: Structures & Style */}
      {activeTab === "structures" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Style Radar */}
            <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Biểu Đồ Radar Phong Cách 8 Trục
              </h3>
              <p className="text-xs text-muted-foreground mb-6">
                Xác định thiên hướng tấn công, kiên cường, chiến thuật và xử lý cấu trúc Tốt.
              </p>
              <div className="flex justify-center">
                <StyleRadarChart
                  metrics={analysisRun?.style_radar_metrics as any}
                  archetype={analysisRun?.dominant_archetype || undefined}
                />
              </div>
            </div>

            {/* Pawn Structures Grid */}
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" />
                  Hiệu Suất Trên Cấu Trúc Tốt Điển Hình
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Đánh giá tương quan thắng/hòa/thua so với trung bình cơ sở để tìm điểm mạnh và điểm yếu.
                </p>
              </div>

              <PawnStructureGrid
                structures={analysisRun?.pawn_structures_summary?.structures || []}
                playerId={playerId}
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Games Library */}
      {activeTab === "games" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGameColorFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  gameColorFilter === "all" ? "bg-primary text-primary-foreground" : "bg-card border border-border/60 text-muted-foreground"
                }`}
              >
                Tất cả ({games.length})
              </button>
              <button
                onClick={() => setGameColorFilter("white")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  gameColorFilter === "white" ? "bg-primary text-primary-foreground" : "bg-card border border-border/60 text-muted-foreground"
                }`}
              >
                Cầm Trắng
              </button>
              <button
                onClick={() => setGameColorFilter("black")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  gameColorFilter === "black" ? "bg-primary text-primary-foreground" : "bg-card border border-border/60 text-muted-foreground"
                }`}
              >
                Cầm Đen
              </button>
            </div>
          </div>

          <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-bold uppercase tracking-wider border-b border-border/60">
                <tr>
                  <th className="px-4 py-3">Trắng</th>
                  <th className="px-4 py-3">Đen</th>
                  <th className="px-3 py-3">Kết quả</th>
                  <th className="px-3 py-3">ECO / Khai cuộc</th>
                  <th className="px-3 py-3">Engine Đánh giá</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredGames.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground">
                      Không tìm thấy ván đấu nào phù hợp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredGames.map((g) => (
                    <tr key={g.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {g.white_player} {g.white_elo ? `(${g.white_elo})` : ""}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {g.black_player} {g.black_elo ? `(${g.black_elo})` : ""}
                      </td>
                      <td className="px-3 py-3 font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${
                          g.result === "1-0" ? "bg-emerald-500/10 text-emerald-500" :
                          g.result === "0-1" ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                        }`}>
                          {g.result}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        <span className="font-mono font-bold text-foreground mr-1.5">{g.eco || "---"}</span>
                        <span className="truncate max-w-[140px] inline-block align-bottom">{g.opening_name || ""}</span>
                      </td>
                      <td className="px-3 py-3">
                        {g.has_embedded_eval ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <Check className="w-3 h-3" />
                            <span>Đã nạp sẵn</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground">
                            Phân tích On-demand
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/analyze?gameId=${g.id}&playerId=${playerId}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary text-secondary-foreground text-[11px] font-medium hover:bg-primary hover:text-primary-foreground transition-all"
                        >
                          Phân Tích
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: AI Coach */}
      {activeTab === "ai" && (
        <div className="space-y-4">
          <AiCoachChat
            runId={analysisRun?.id || `run-${playerId}`}
            initialBriefing=""
            suggestedQuestions={[
              `Những khai cuộc sở trường nhất của ${player?.canonical_name}?`,
              `Kỳ thủ này phản ứng thế nào khi gặp biến thể cờ mở nhiều rủi ro?`,
              `Làm thế nào để khai thác điểm yếu cấu trúc Tốt của ${player?.canonical_name}?`,
            ]}
          />
        </div>
      )}
    </div>
  );
}
