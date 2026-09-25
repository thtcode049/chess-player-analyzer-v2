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
  Check,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
  CheckCircle2,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter
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

  // Active on-page action: "none" | "edit" | "delete"
  const [activeAction, setActiveAction] = useState<"none" | "edit" | "delete">("none");
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editFideId, setEditFideId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Toast notice state
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setNotice({ message, type });
    setTimeout(() => {
      setNotice(null);
    }, 4000);
  };

  // Handle Escape key and body scroll locking when modal dialog is open
  useEffect(() => {
    if (activeAction !== "none") {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          handleCloseAction();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = originalStyle;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [activeAction]);

  const handleOpenEdit = () => {
    if (!player) return;
    setEditName(player.canonical_name);
    setEditTitle(player.title || "");
    setEditFideId(player.fide_id ? String(player.fide_id) : "");
    setEditNotes(player.notes || "");
    setActiveAction("edit");
  };

  const handleOpenDelete = () => {
    if (!player) return;
    setActiveAction("delete");
  };

  const handleCloseAction = () => {
    setActiveAction("none");
  };

  const handleUpdatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player || !editName.trim()) return;

    setUpdating(true);
    try {
      const updated = await apiClient.updatePlayer(playerId, {
        canonical_name: editName.trim(),
        title: editTitle.trim() || undefined,
        fide_id: editFideId.trim() ? parseInt(editFideId.trim(), 10) : undefined,
        notes: editNotes.trim() || undefined
      });
      setPlayer(prev => (prev ? { ...prev, ...updated } : updated));
      setActiveAction("none");
      showToast(`Đã cập nhật hồ sơ kỳ thủ "${updated.canonical_name}" thành công`);
    } catch (err: any) {
      showToast(err.message || "Lỗi khi cập nhật hồ sơ kỳ thủ", "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await apiClient.deletePlayer(playerId);
      showToast("Đã xóa hồ sơ kỳ thủ thành công");
      setActiveAction("none");
      setTimeout(() => {
        router.push("/players");
      }, 500);
    } catch (err: any) {
      showToast(err.message || "Lỗi khi xóa hồ sơ kỳ thủ", "error");
      setDeleting(false);
    }
  };

  // Filter & Search states for games tab (không giới hạn số lượng ván đấu)
  const [gameColorFilter, setGameColorFilter] = useState<string>("all");
  const [gameResultFilter, setGameResultFilter] = useState<string>("all");
  const [gameSearchQuery, setGameSearchQuery] = useState<string>("");
  const [gamePage, setGamePage] = useState<number>(1);
  const [gamesPerPage, setGamesPerPage] = useState<number>(50);

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

        // Load ALL games safely without hardcoded 500 limit (unlimited)
        const gRes = await apiClient.getPlayerGames(playerId, { allGames: true, pageSize: 10000 }).catch(() => null);
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
  const filteredGames = safeGames.filter((g) => {
    if (!g) return false;
    const pName = (player?.canonical_name || "").toLowerCase();
    const wPlayer = (g.white_player || "").toLowerCase();
    const bPlayer = (g.black_player || "").toLowerCase();
    const isPlayerWhite = pName ? wPlayer.includes(pName) : false;
    const isPlayerBlack = pName ? bPlayer.includes(pName) : false;

    // Filter theo màu quân
    if (gameColorFilter === "white" && !isPlayerWhite) return false;
    if (gameColorFilter === "black" && !isPlayerBlack) return false;

    // Filter theo kết quả (Thắng, Thua, Hòa)
    if (gameResultFilter === "win") {
      if (isPlayerWhite && g.result !== "1-0") return false;
      if (isPlayerBlack && g.result !== "0-1") return false;
      if (!isPlayerWhite && !isPlayerBlack && g.result !== "1-0") return false;
    } else if (gameResultFilter === "loss") {
      if (isPlayerWhite && g.result !== "0-1") return false;
      if (isPlayerBlack && g.result !== "1-0") return false;
      if (!isPlayerWhite && !isPlayerBlack && g.result !== "0-1") return false;
    } else if (gameResultFilter === "draw") {
      if (g.result !== "1/2-1/2") return false;
    }

    // Filter theo từ khóa tìm kiếm (search query)
    if (gameSearchQuery.trim()) {
      const q = gameSearchQuery.trim().toLowerCase();
      const matchWhite = wPlayer.includes(q);
      const matchBlack = bPlayer.includes(q);
      const matchEco = (g.eco || "").toLowerCase().includes(q);
      const matchOpening = (g.opening_name || "").toLowerCase().includes(q);
      const matchResult = (g.result || "").toLowerCase().includes(q);
      const matchDate = (g.played_at || (g.raw_headers as any)?.Date || "").toLowerCase().includes(q);
      const matchEvent = ((g.raw_headers as any)?.Event || "").toLowerCase().includes(q);
      const matchTimeControl = (g.time_control || "").toLowerCase().includes(q);

      if (!matchWhite && !matchBlack && !matchEco && !matchOpening && !matchResult && !matchDate && !matchEvent && !matchTimeControl) {
        return false;
      }
    }

    return true;
  });

  const totalFiltered = filteredGames.length;
  const totalPages = gamesPerPage === -1 ? 1 : Math.max(1, Math.ceil(totalFiltered / gamesPerPage));
  const currentPage = Math.min(Math.max(1, gamePage), totalPages);
  const paginatedGames = gamesPerPage === -1 
    ? filteredGames 
    : filteredGames.slice((currentPage - 1) * gamesPerPage, currentPage * gamesPerPage);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Đang tải hồ sơ kỳ thủ & dữ liệu ván đấu...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-12 relative">
      {/* Toast Notification */}
      {notice && (
        <div
          className={`fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md transition-all animate-slide-in ${
            notice.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-300"
          }`}
        >
          {notice.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
          )}
          <span className="text-xs font-semibold">{notice.message}</span>
          <button
            onClick={() => setNotice(null)}
            className="ml-2 text-muted-foreground hover:text-foreground p-0.5 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/players"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại Hồ sơ Kỳ thủ
        </Link>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleOpenEdit}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-border/60 hover:bg-card hover:text-primary text-foreground text-xs font-semibold rounded-xl transition-all shadow-xs"
            title="Chỉnh sửa thông tin hồ sơ kỳ thủ"
          >
            <Pencil className="w-3.5 h-3.5" />
            Sửa Hồ Sơ
          </button>
          <button
            onClick={handleOpenDelete}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-semibold rounded-xl transition-all shadow-xs"
            title="Xóa hồ sơ kỳ thủ"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Xóa Hồ Sơ
          </button>
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
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleOpenEdit}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Chỉnh sửa thông tin kỳ thủ"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleOpenDelete}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                    title="Xóa hồ sơ kỳ thủ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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
                    {analysisRun?.engine_name || (analysisRun?.engine_status === "stockfish_parallel" ? "Stockfish 19 Parallel" : analysisRun?.engine_status?.toUpperCase() || "STOCKFISH")}
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

      {/* Tab 4: Games Library (Không giới hạn số lượng ván đấu & Hỗ trợ Tìm kiếm) */}
      {activeTab === "games" && (
        <div className="space-y-5">
          {/* Header & Search Bar & Filters */}
          <div className="bg-card border border-border/60 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={gameSearchQuery}
                  onChange={(e) => {
                    setGameSearchQuery(e.target.value);
                    setGamePage(1);
                  }}
                  placeholder="Tìm kiếm theo đối thủ, mã ECO (VD: B90), tên khai cuộc (VD: Sicilian), ngày, giải đấu..."
                  className="w-full bg-background border border-border/70 rounded-xl pl-10 pr-9 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
                {gameSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setGameSearchQuery("");
                      setGamePage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md hover:bg-muted transition"
                    title="Xóa từ khóa tìm kiếm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Items Per Page Select */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                <span className="text-xs text-muted-foreground">Hiển thị:</span>
                <select
                  value={gamesPerPage}
                  onChange={(e) => {
                    setGamesPerPage(Number(e.target.value));
                    setGamePage(1);
                  }}
                  className="bg-background border border-border/70 rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value={25}>25 ván/trang</option>
                  <option value={50}>50 ván/trang</option>
                  <option value={100}>100 ván/trang</option>
                  <option value={200}>200 ván/trang</option>
                  <option value={-1}>Tất cả ({games.length})</option>
                </select>
              </div>
            </div>

            {/* Quick Filter Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground mr-1">Màu quân:</span>
                <button
                  type="button"
                  onClick={() => {
                    setGameColorFilter("all");
                    setGamePage(1);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    gameColorFilter === "all"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  Tất cả ({games.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGameColorFilter("white");
                    setGamePage(1);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    gameColorFilter === "white"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  ⚪ Cầm Trắng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGameColorFilter("black");
                    setGamePage(1);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    gameColorFilter === "black"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  ⚫ Cầm Đen
                </button>

                <div className="h-4 w-[1px] bg-border/60 mx-1 hidden sm:block" />

                <span className="text-xs font-semibold text-muted-foreground mr-1">Kết quả:</span>
                <button
                  type="button"
                  onClick={() => {
                    setGameResultFilter("all");
                    setGamePage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    gameResultFilter === "all"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/50 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGameResultFilter("win");
                    setGamePage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    gameResultFilter === "win"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  Thắng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGameResultFilter("draw");
                    setGamePage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    gameResultFilter === "draw"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  Hòa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGameResultFilter("loss");
                    setGamePage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    gameResultFilter === "loss"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400"
                  }`}
                >
                  Thua
                </button>
              </div>

              {/* Status counter */}
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span>Khớp: <b className="text-foreground">{totalFiltered}</b> / {games.length} ván</span>
                {(gameSearchQuery || gameColorFilter !== "all" || gameResultFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setGameSearchQuery("");
                      setGameColorFilter("all");
                      setGameResultFilter("all");
                      setGamePage(1);
                    }}
                    className="text-primary hover:underline text-[11px] ml-1 font-medium"
                  >
                    (Đặt lại)
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Games Table Card */}
          <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground font-bold uppercase tracking-wider border-b border-border/60">
                  <tr>
                    <th className="px-4 py-3.5">Trắng</th>
                    <th className="px-4 py-3.5">Đen</th>
                    <th className="px-3 py-3.5">Kết quả</th>
                    <th className="px-3 py-3.5">ECO / Khai cuộc</th>
                    <th className="px-3 py-3.5">Ngày / Sự kiện</th>
                    <th className="px-3 py-3.5">Engine Đánh giá</th>
                    <th className="px-4 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {paginatedGames.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-14 text-muted-foreground">
                        <div className="space-y-1.5">
                          <p className="font-semibold text-foreground text-sm">Không tìm thấy ván đấu nào</p>
                          <p className="text-xs text-muted-foreground">
                            {gameSearchQuery
                              ? `Không có kết quả nào khớp với "${gameSearchQuery}". Hãy thử từ khóa khác hoặc đặt lại bộ lọc.`
                              : "Kỳ thủ này chưa có ván đấu nào theo bộ lọc đã chọn."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedGames.map((g, idx) => {
                      const pName = (player?.canonical_name || "").toLowerCase();
                      const isWhite = (g.white_player || "").toLowerCase().includes(pName);
                      const isBlack = (g.black_player || "").toLowerCase().includes(pName);
                      const dateStr = g.played_at || (g.raw_headers as any)?.Date || "";
                      const eventStr = (g.raw_headers as any)?.Event || "";

                      return (
                        <tr key={g.id || `game-${idx}`} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">
                            <span className={isWhite ? "font-bold text-primary" : "text-foreground"}>
                              {g.white_player}
                            </span>
                            {g.white_elo ? (
                              <span className="text-[11px] text-muted-foreground ml-1.5 font-mono">
                                ({g.white_elo})
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            <span className={isBlack ? "font-bold text-primary" : "text-foreground"}>
                              {g.black_player}
                            </span>
                            {g.black_elo ? (
                              <span className="text-[11px] text-muted-foreground ml-1.5 font-mono">
                                ({g.black_elo})
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 font-mono font-bold">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] ${
                                g.result === "1-0"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : g.result === "0-1"
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              }`}
                            >
                              {g.result}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">
                            <span className="font-mono font-bold text-foreground mr-1.5">{g.eco || "---"}</span>
                            <span className="truncate max-w-[150px] inline-block align-bottom font-medium" title={g.opening_name || ""}>
                              {g.opening_name || ""}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground text-[11px]">
                            <div className="font-mono">{dateStr ? dateStr.replace(/\./g, "/") : "---"}</div>
                            {eventStr && eventStr !== "?" && (
                              <div className="truncate max-w-[120px] text-[10px] text-muted-foreground/80" title={eventStr}>
                                {eventStr}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {g.has_embedded_eval ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <Check className="w-3 h-3" />
                                <span>Đã nạp sẵn</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">
                                On-demand
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/analyze?gameId=${g.id}&playerId=${playerId}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-all shadow-2xs"
                            >
                              Phân Tích
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && gamesPerPage !== -1 && (
              <div className="px-4 py-3.5 bg-muted/20 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-muted-foreground">
                  Hiển thị ván <b className="text-foreground">{(currentPage - 1) * gamesPerPage + 1}</b> -{" "}
                  <b className="text-foreground">{Math.min(currentPage * gamesPerPage, totalFiltered)}</b> trong tổng số{" "}
                  <b className="text-foreground">{totalFiltered}</b> ván phù hợp
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setGamePage((prev) => Math.max(1, prev - 1))}
                    className="p-1.5 rounded-lg border border-border/60 hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition text-muted-foreground hover:text-foreground"
                    title="Trang trước"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let p = i + 1;
                      if (totalPages > 5) {
                        if (currentPage > 3 && currentPage < totalPages - 1) {
                          p = currentPage - 2 + i;
                        } else if (currentPage >= totalPages - 1) {
                          p = totalPages - 4 + i;
                        }
                      }
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setGamePage(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${
                            currentPage === p
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "hover:bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setGamePage((prev) => Math.min(totalPages, prev + 1))}
                    className="p-1.5 rounded-lg border border-border/60 hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition text-muted-foreground hover:text-foreground"
                    title="Trang sau"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
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
      {/* Modal Hộp thoại nổi Sửa / Xóa Hồ Sơ (Floating Modal Dialog + Dimmed/Blurred Backdrop) */}
      {activeAction !== "none" && player && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
          onClick={handleCloseAction}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-card border border-border/80 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-scale-in relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Hộp Chỉnh Sửa Hồ Sơ */}
            {activeAction === "edit" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-border/40 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                      <Pencil className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-lg text-foreground">
                        Chỉnh Sửa Hồ Sơ Kỳ Thủ
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {player.canonical_name}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseAction}
                    className="text-muted-foreground hover:text-foreground p-1.5 rounded-xl hover:bg-secondary transition"
                    title="Đóng hộp thoại"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleUpdatePlayer} className="space-y-4 text-sm">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Tên Chính Thức (Canonical Name) *
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="VD: Carlsen, Magnus hoặc Hikaru Nakamura"
                      className="w-full bg-background border border-border/60 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        Danh Hiệu (Title)
                      </label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="GM, IM, FM, CM..."
                        className="w-full bg-background border border-border/60 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                        FIDE ID (Tùy chọn)
                      </label>
                      <input
                        type="number"
                        value={editFideId}
                        onChange={(e) => setEditFideId(e.target.value)}
                        placeholder="VD: 1503014"
                        className="w-full bg-background border border-border/60 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Ghi Chú Đặc Điểm Kỳ Thủ
                    </label>
                    <textarea
                      rows={3}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Đặc điểm phong cách, khai cuộc ưa chuộng, điểm mạnh/yếu cần theo dõi..."
                      className="w-full bg-background border border-border/60 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="pt-3 border-t border-border/40 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleCloseAction}
                      className="px-4 py-2 rounded-xl border border-border/60 text-muted-foreground hover:text-foreground text-xs font-medium transition hover:bg-secondary"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={updating || !editName.trim()}
                      className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-primary/20 transition-all"
                    >
                      {updating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Lưu Thay Đổi
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Hộp Xác Nhận Xóa Hồ Sơ */}
            {activeAction === "delete" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-border/40 pb-4">
                  <div className="flex items-center gap-3 text-rose-500">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                      <Trash2 className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-lg text-foreground">
                        Xác Nhận Xóa Hồ Sơ Kỳ Thủ
                      </h3>
                      <p className="text-xs text-rose-500/80 font-medium">Thao tác này sẽ xóa vĩnh viễn dữ liệu</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseAction}
                    className="text-muted-foreground hover:text-foreground p-1.5 rounded-xl hover:bg-secondary transition"
                    title="Đóng hộp thoại"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
                  <p>
                    Bạn có chắc chắn muốn xóa hồ sơ của kỳ thủ{" "}
                    <strong className="text-foreground font-bold text-sm">
                      {player.canonical_name}
                    </strong>
                    ?
                  </p>
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Cảnh báo quan trọng:
                    </p>
                    <p className="text-[11px] leading-normal">
                      Toàn bộ ván đấu, tập dữ liệu nhập vào (PGN / Lichess / Chess.com) và kết quả phân tích chiến lược liên quan đến kỳ thủ này sẽ bị xóa hoàn toàn khỏi hệ thống và không thể khôi phục.
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/40 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleCloseAction}
                    className="px-4 py-2 rounded-xl border border-border/60 text-muted-foreground hover:text-foreground text-xs font-medium transition hover:bg-secondary"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleConfirmDelete}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-rose-600/20 transition-all"
                  >
                    {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Xóa Vĩnh Viễn
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
