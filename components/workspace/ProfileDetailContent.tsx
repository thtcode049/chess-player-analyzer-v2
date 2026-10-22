"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Trophy,
  BarChart2,
  Layers,
  Sword,
  Play,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
  CheckCircle2,
  Search,
  ChevronLeft,
  ChevronRight,
  Info,
  Copy,
  Calendar,
  Globe,
  Hash,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { Player, Game, AnalysisRun } from "@/lib/api/types";
import { apiClient } from "@/lib/api/client";
import { useProfileWorkspaceStore } from "@/lib/stores/profileWorkspaceStore";
import StyleRadarChart from "@/components/profile/StyleRadarChart";
import OpeningTreeTable from "@/components/analysis/OpeningTreeTable";
import PawnStructureGrid from "@/components/profile/PawnStructureGrid";

function getPlatformInfo(g: Game): { url: string | null; platform: "lichess" | "chesscom" | "other" | null; label: string } {
  const headers = (g.raw_headers as Record<string, any>) || {};
  const link = headers.Link || headers.link || "";
  const site = headers.Site || headers.site || "";
  const siteUrl = g.site_url || "";
  const extId = g.external_id || "";

  const candidates = [siteUrl, link, site, extId];
  for (const cand of candidates) {
    if (typeof cand === "string") {
      const trimmed = cand.trim();
      const lower = trimmed.toLowerCase();
      if (lower.includes("lichess.org")) {
        const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
        return { url, platform: "lichess", label: "Lichess" };
      }
      if (lower.includes("chess.com")) {
        const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
        return { url, platform: "chesscom", label: "Chess.com" };
      }
    }
  }

  if (typeof site === "string" && site.toLowerCase().includes("lichess") && extId) {
    const cleanId = extId.replace(/^https?:\/\/[^/]+\//, "");
    return { url: `https://lichess.org/${cleanId}`, platform: "lichess", label: "Lichess" };
  }
  if (typeof site === "string" && site.toLowerCase().includes("chess.com") && extId) {
    const cleanId = extId.replace(/^https?:\/\/[^/]+\//, "");
    return { url: `https://www.chess.com/game/live/${cleanId}`, platform: "chesscom", label: "Chess.com" };
  }

  for (const cand of [siteUrl, link, site]) {
    if (typeof cand === "string") {
      const trimmed = cand.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return { url: trimmed, platform: "other", label: "Xem trận đấu" };
      }
    }
  }

  return { url: null, platform: null, label: "Ngoại tuyến" };
}

function formatGameDate(g: Game): string {
  const headers = (g.raw_headers as Record<string, any>) || {};
  const rawDate = g.played_at || headers.Date || headers.UTCDate || headers.EventDate || "";
  if (!rawDate || typeof rawDate !== "string") return "---";

  const cleaned = rawDate.trim();
  if (cleaned.startsWith("?") || cleaned === "") return "---";

  if (cleaned.includes("T")) {
    const dPart = cleaned.split("T")[0];
    const parts = dPart.split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }

  const parts = cleaned.split(/[-./]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }

  return cleaned;
}

export default function ProfileDetailContent({
  targetPlayerId,
}: {
  targetPlayerId?: string;
}) {
  const {
    activePlayer,
    activePlayerGames,
    activePlayerRun,
    analyzeGame,
    refreshProfileData,
    refreshPlayersList,
    setActiveTab,
    multiProfiles,
    selectedSubProfileId,
    setSelectedSubProfileId,
    activeMode,
  } = useProfileWorkspaceStore();

  const player = activePlayer;
  const games = activePlayerGames;
  const analysisRun = activePlayerRun;

  // Sub-tabs inside profile detail: "overview" | "openings" | "structures" | "games"
  const [profileSubTab, setProfileSubTab] = useState<"overview" | "openings" | "structures" | "games">("overview");

  // Filter & Search states for games list (preserved across keep-alive tab switches)
  const [gameColorFilter, setGameColorFilter] = useState<string>("all");
  const [gameResultFilter, setGameResultFilter] = useState<string>("all");
  const [gameSearchQuery, setGameSearchQuery] = useState<string>("");
  const [gamePage, setGamePage] = useState<number>(1);
  const [gamesPerPage, setGamesPerPage] = useState<number>(50);

  // Detail Modal Game
  const [detailModalGame, setDetailModalGame] = useState<Game | null>(null);
  const [copiedPgn, setCopiedPgn] = useState(false);

  // Edit / Delete Modals
  const [modalAction, setModalAction] = useState<"none" | "edit" | "delete">("none");
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editFideId, setEditFideId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Running manual re-analysis
  const [runningAnalysis, setRunningAnalysis] = useState(false);

  // Toast notice
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const showToast = (message: string, type: "success" | "error" = "success") => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 4000);
  };

  const handleOpenEdit = () => {
    if (!player) return;
    setEditName(player.canonical_name);
    setEditTitle(player.title || "");
    setEditFideId(player.fide_id ? String(player.fide_id) : "");
    setEditNotes(player.notes || "");
    setModalAction("edit");
  };

  const handleUpdatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player || !editName.trim()) return;
    setUpdating(true);
    try {
      await apiClient.updatePlayer(player.id, {
        canonical_name: editName.trim(),
        title: editTitle.trim() || undefined,
        fide_id: editFideId.trim() ? parseInt(editFideId.trim(), 10) : undefined,
        notes: editNotes.trim() || undefined,
      });
      await refreshProfileData(player.id);
      await refreshPlayersList();
      setModalAction("none");
      showToast(`Đã cập nhật thông tin kỳ thủ thành công`);
    } catch (err: any) {
      showToast(err.message || "Lỗi cập nhật", "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleOpenDelete = () => {
    if (!player) return;
    setModalAction("delete");
  };

  const handleConfirmDelete = async () => {
    if (!player) return;
    setDeleting(true);
    try {
      await apiClient.deletePlayer(player.id);
      await refreshPlayersList();
      setModalAction("none");
      showToast("Đã xóa hồ sơ thành công");
    } catch (err: any) {
      showToast(err.message || "Lỗi xóa hồ sơ", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleTriggerAnalysis = async () => {
    if (!player) return;
    setRunningAnalysis(true);
    try {
      await apiClient.createAnalysisRun({
        player_id: player.id,
        run_label: `Phân tích ngày ${new Date().toLocaleDateString("vi-VN")}`,
      });
      await refreshProfileData(player.id);
      showToast("Đã cập nhật phân tích chuyên sâu thành công");
    } catch (err: any) {
      showToast(err.message || "Lỗi chạy phân tích", "error");
    } finally {
      setRunningAnalysis(false);
    }
  };

  // Filter games
  const safeGames = Array.isArray(games) ? games : [];
  const filteredGames = useMemo(() => {
    return safeGames.filter((g) => {
      if (!g) return false;
      const pName = (player?.canonical_name || "").toLowerCase();
      const wPlayer = (g.white_player || "").toLowerCase();
      const bPlayer = (g.black_player || "").toLowerCase();
      const isPlayerWhite = pName ? wPlayer.includes(pName) : false;
      const isPlayerBlack = pName ? bPlayer.includes(pName) : false;

      // Color Filter
      if (gameColorFilter === "white" && !isPlayerWhite) return false;
      if (gameColorFilter === "black" && !isPlayerBlack) return false;

      // Result Filter
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

      // Search Filter
      if (gameSearchQuery.trim()) {
        const q = gameSearchQuery.trim().toLowerCase();
        const matchWhite = wPlayer.includes(q);
        const matchBlack = bPlayer.includes(q);
        const matchEco = (g.eco || "").toLowerCase().includes(q);
        const matchOpening = (g.opening_name || "").toLowerCase().includes(q);
        const matchResult = (g.result || "").toLowerCase().includes(q);
        const matchDate = (g.played_at || (g.raw_headers as any)?.Date || "").toLowerCase().includes(q);

        if (!matchWhite && !matchBlack && !matchEco && !matchOpening && !matchResult && !matchDate) {
          return false;
        }
      }

      return true;
    });
  }, [safeGames, player?.canonical_name, gameColorFilter, gameResultFilter, gameSearchQuery]);

  const totalFiltered = filteredGames.length;
  const totalPages = gamesPerPage === -1 ? 1 : Math.max(1, Math.ceil(totalFiltered / gamesPerPage));
  const currentPage = Math.min(Math.max(1, gamePage), totalPages);
  const paginatedGames =
    gamesPerPage === -1
      ? filteredGames
      : filteredGames.slice((currentPage - 1) * gamesPerPage, currentPage * gamesPerPage);

  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
        <p className="text-sm text-muted-foreground">Chưa chọn hồ sơ kỳ thủ nào để hiển thị.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 sm:space-y-8 animate-fade-in pb-12">
      {/* Toast Notice */}
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

      {/* Multi-Profile Switcher Sub-Bar (If in multi mode) */}
      {activeMode === "multi" && multiProfiles.length > 1 && (
        <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-muted/50 border border-border/70 overflow-x-auto">
          <span className="text-xs font-bold text-muted-foreground px-2 shrink-0">
            Xem hồ sơ trong nhóm:
          </span>
          {multiProfiles.map((item) => {
            const isSelected = item.player.id === player.id;
            const roleBadge = item.role === "white" ? "⚪ Trắng" : item.role === "black" ? "⚫ Đen" : "⚪⚫ Cả hai";

            return (
              <button
                key={item.player.id}
                type="button"
                onClick={() => setSelectedSubProfileId(item.player.id)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 border ${
                  isSelected
                    ? "bg-background text-emerald-600 dark:text-emerald-400 border-emerald-500 shadow-xs"
                    : "bg-card text-muted-foreground hover:text-foreground border-border/60"
                }`}
              >
                <span>{item.player.canonical_name}</span>
                <span className="text-[10px] font-mono opacity-80">({roleBadge})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Player Header Banner Card */}
      <div className="relative overflow-hidden rounded-3xl bg-card border border-border/70 p-6 sm:p-7 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Avatar & Player Info */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-2xl sm:text-3xl shadow-md shrink-0">
              {player.canonical_name ? player.canonical_name[0].toUpperCase() : "P"}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-foreground">
                  {player.canonical_name}
                </h1>
                {player.title && (
                  <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black">
                    {player.title}
                  </span>
                )}
                {player.fide_id && (
                  <span className="text-xs text-muted-foreground font-mono font-semibold">
                    FIDE: {player.fide_id}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                {player.notes || "Hồ sơ phân tích dữ liệu ván đấu và phong cách thi đấu chuyên sâu."}
              </p>
            </div>
          </div>

          {/* Quick Stats Pill Counters */}
          <div className="grid grid-cols-3 sm:flex items-center gap-3 sm:gap-6 border-t md:border-t-0 md:border-l border-border/40 pt-4 md:pt-0 md:pl-6 text-center sm:text-left">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block truncate">
                Tổng số ván
              </span>
              <span className="text-lg sm:text-2xl font-extrabold text-foreground">
                {games.length}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block truncate">
                Tỷ lệ thắng
              </span>
              <span className="text-lg sm:text-2xl font-extrabold text-emerald-500">
                {analysisRun?.overall_win_rate ? `${analysisRun.overall_win_rate.toFixed(1)}%` : "0.0%"}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block truncate">
                Điểm số chung
              </span>
              <span className="text-lg sm:text-2xl font-extrabold text-primary">
                {analysisRun?.overall_score ? `${analysisRun.overall_score.toFixed(1)}%` : "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Top Action Buttons (Edit, Delete, Refresh Analysis) */}
        <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/70 hover:bg-muted text-xs font-semibold text-foreground transition"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Sửa Thông Tin</span>
            </button>
            <button
              type="button"
              onClick={handleOpenDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-semibold transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa Hồ Sơ</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleTriggerAnalysis}
            disabled={runningAnalysis}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
          >
            {runningAnalysis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>{runningAnalysis ? "Đang phân tích..." : "Chạy Phân Tích Mới"}</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-border/60 overflow-x-auto gap-1 sm:gap-2 pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setProfileSubTab("overview")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap shrink-0 ${
            profileSubTab === "overview"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Tổng Quan & 8 Trục Phong Cách</span>
        </button>

        <button
          type="button"
          onClick={() => setProfileSubTab("openings")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap shrink-0 ${
            profileSubTab === "openings"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Play className="w-4 h-4" />
          <span>Đánh Giá Khai Cuộc (Bayesian)</span>
        </button>

        <button
          type="button"
          onClick={() => setProfileSubTab("structures")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap shrink-0 ${
            profileSubTab === "structures"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Cấu Trúc Tốt Điển Hình</span>
        </button>

        <button
          type="button"
          onClick={() => setProfileSubTab("games")}
          className={`flex items-center gap-2 py-2.5 px-3.5 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap shrink-0 ${
            profileSubTab === "games"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sword className="w-4 h-4" />
          <span>Danh Sách Ván Đấu ({games.length})</span>
        </button>
      </div>

      {/* Sub-Tab 1: Overview & Style Radar */}
      {profileSubTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 8-Axis Style Radar Chart */}
            <StyleRadarChart
              metrics={analysisRun?.style_radar_metrics}
              playerName={player.canonical_name}
              size={340}
            />

            {/* Performance By Color & Archetype */}
            <div className="flex flex-col justify-between space-y-6">
              {/* Score by Color */}
              <div className="bg-card border border-border/70 rounded-3xl p-6 shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  Hiệu Suất Theo Màu Quân (Scores)
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-muted-foreground">⚪ Cầm Trắng (White Score)</span>
                      <span className="text-foreground">{analysisRun?.white_score?.toFixed(1) || 50}%</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-500"
                        style={{ width: `${analysisRun?.white_score || 50}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-muted-foreground">⚫ Cầm Đen (Black Score)</span>
                      <span className="text-foreground">{analysisRun?.black_score?.toFixed(1) || 50}%</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full transition-all duration-500"
                        style={{ width: `${analysisRun?.black_score || 50}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Archetype & Quick Repertoire Summary */}
              <div className="bg-card border border-border/70 rounded-3xl p-6 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  Đặc Trưng Phong Cách Kỳ Thủ
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Kiểu hình chủ đạo (Archetype):</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {analysisRun?.dominant_archetype || "Tactical Attacker"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/40">
                    <span className="text-muted-foreground">Hệ thống khai cuộc nhận diện:</span>
                    <span className="font-bold text-foreground">
                      {analysisRun?.repertoire_summary?.all_openings?.length || 0} hệ thống
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Cấu trúc Tốt điển hình:</span>
                    <span className="font-bold text-foreground">
                      {analysisRun?.pawn_structures_summary?.structures?.length || 0} cấu trúc
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Starting Repertoire Table */}
          {analysisRun?.opening_tree_snapshot && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                  Khai Cuộc Trọng Tâm Từ Thế Khởi Đầu (Starting Position)
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab("board")}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Mở Bàn cờ Phân tích đầy đủ →
                </button>
              </div>
              <OpeningTreeTable
                continuations={analysisRun.opening_tree_snapshot.continuations}
                totalGames={analysisRun.games_analyzed_count}
                currentFen={analysisRun.opening_tree_snapshot.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"}
                onSelectMove={() => setActiveTab("board")}
                playerName={player.canonical_name}
              />
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 2: Openings (Bayesian Adjusted) */}
      {profileSubTab === "openings" && (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Play className="w-5 h-5 text-emerald-500" />
                  Đánh Giá Hiệu Suất Khai Cuộc (Bayesian Adjusted)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Phân tích độ tin cậy thống kê và hiệu suất thực tế so với điểm cơ sở.
                </p>
              </div>
              <span className="text-xs px-3 py-1.5 rounded-xl bg-muted font-mono font-semibold text-foreground">
                Điểm cơ sở: {analysisRun?.repertoire_summary?.overall_baseline?.toFixed(1) || 50}%
              </span>
            </div>

            {analysisRun?.repertoire_summary?.all_openings && analysisRun.repertoire_summary.all_openings.length > 0 ? (
              <div className="bg-card border border-border/70 rounded-3xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 text-muted-foreground font-bold uppercase tracking-wider border-b border-border/70">
                      <tr>
                        <th className="px-4 py-3">Hệ thống Khai cuộc</th>
                        <th className="px-3 py-3">Số ván</th>
                        <th className="px-4 py-3 min-w-[140px]">Tỷ lệ Kết quả (Thắng/Hòa/Thua)</th>
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
                          <tr key={idx} className="hover:bg-muted/30 transition">
                            <td className="px-4 py-3 font-semibold text-foreground">{op.name}</td>
                            <td className="px-3 py-3 font-mono font-bold text-muted-foreground">
                              {op.games_count}
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800">
                                  <div
                                    className="bg-emerald-500 h-full"
                                    style={{ width: `${op.win_pct || 0}%` }}
                                    title={`Thắng: ${op.win_pct?.toFixed(1)}%`}
                                  />
                                  <div
                                    className="bg-slate-400 h-full"
                                    style={{ width: `${op.draw_pct || 0}%` }}
                                    title={`Hòa: ${op.draw_pct?.toFixed(1)}%`}
                                  />
                                  <div
                                    className="bg-rose-500 h-full"
                                    style={{ width: `${op.loss_pct || 0}%` }}
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
                            <td className="px-3 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {op.adjusted_score_pct?.toFixed(1)}%
                            </td>
                            <td
                              className={`px-3 py-3 text-right font-mono font-bold ${
                                isPositive ? "text-emerald-500" : delta < 0 ? "text-rose-500" : "text-muted-foreground"
                              }`}
                            >
                              {isPositive ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className="inline-block px-2 py-0.5 rounded text-[11px] font-bold"
                                style={{
                                  backgroundColor: `${badgeColor}20`,
                                  color: badgeColor,
                                  border: `1px solid ${badgeColor}40`,
                                }}
                              >
                                {op.assessment_badge || op.assessment_label || op.assessment || "Trung bình"}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => setActiveTab("board")}
                                className="px-2.5 py-1 rounded-lg bg-muted hover:bg-emerald-600 hover:text-white font-semibold text-[11px] transition text-foreground"
                              >
                                Phân tích
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-card border border-border/70 rounded-3xl text-muted-foreground text-xs">
                Chưa có dữ liệu hệ thống khai cuộc cho kỳ thủ này.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Pawn Structures */}
      {profileSubTab === "structures" && (
        <div className="space-y-6">
          <div className="p-5 rounded-3xl bg-card border border-border/70 shadow-xs space-y-1">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-500" />
              Hiệu Suất Trên Cấu Trúc Tốt Điển Hình (Pawn Formations)
            </h3>
            <p className="text-xs text-muted-foreground">
              Phân loại thế trận Tốt kinh điển (IQP, Carlsbad, Tốt treo, Pháp, Nhím, Trung tâm mở) và
              đo lường độ chênh lệch điểm số thực tế.
            </p>
          </div>

          <PawnStructureGrid
            structures={analysisRun?.pawn_structures_summary?.structures || []}
            playerId={player.id}
          />
        </div>
      )}

      {/* Sub-Tab 4: Games List (with direct Phân tích ván cờ jump) */}
      {profileSubTab === "games" && (
        <div className="space-y-4">
          {/* Search Bar & Quick Filters */}
          <div className="p-4 sm:p-5 rounded-3xl bg-card border border-border/70 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={gameSearchQuery}
                  onChange={(e) => {
                    setGameSearchQuery(e.target.value);
                    setGamePage(1);
                  }}
                  placeholder="Tìm theo đối thủ, mã ECO, tên khai cuộc, ngày..."
                  className="w-full bg-background border border-border/70 rounded-xl pl-10 pr-9 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
                {gameSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setGameSearchQuery("");
                      setGamePage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-md hover:bg-muted"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Items Per Page */}
              <div className="flex items-center gap-2 self-end md:self-auto text-xs text-muted-foreground">
                <span>Hiển thị:</span>
                <select
                  value={gamesPerPage}
                  onChange={(e) => {
                    setGamesPerPage(Number(e.target.value));
                    setGamePage(1);
                  }}
                  className="bg-background border border-border/70 rounded-xl px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
                >
                  <option value={25}>25 ván/trang</option>
                  <option value={50}>50 ván/trang</option>
                  <option value={100}>100 ván/trang</option>
                  <option value={-1}>Tất cả ({games.length})</option>
                </select>
              </div>
            </div>

            {/* Quick Filter Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-muted-foreground mr-1">Màu quân:</span>
                <button
                  type="button"
                  onClick={() => {
                    setGameColorFilter("all");
                    setGamePage(1);
                  }}
                  className={`px-3 py-1 rounded-lg font-semibold transition ${
                    gameColorFilter === "all"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground"
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
                  className={`px-3 py-1 rounded-lg font-semibold transition ${
                    gameColorFilter === "white"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground"
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
                  className={`px-3 py-1 rounded-lg font-semibold transition ${
                    gameColorFilter === "black"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ⚫ Cầm Đen
                </button>

                <div className="h-4 w-[1px] bg-border/60 mx-1 hidden sm:block" />

                <span className="font-bold text-muted-foreground mr-1">Kết quả:</span>
                <button
                  type="button"
                  onClick={() => {
                    setGameResultFilter("all");
                    setGamePage(1);
                  }}
                  className={`px-3 py-1 rounded-lg font-semibold transition ${
                    gameResultFilter === "all"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground"
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
                  className={`px-3 py-1 rounded-lg font-semibold transition ${
                    gameResultFilter === "win"
                      ? "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground"
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
                  className={`px-3 py-1 rounded-lg font-semibold transition ${
                    gameResultFilter === "draw"
                      ? "bg-amber-500/20 text-amber-600 border border-amber-500/30"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground"
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
                  className={`px-3 py-1 rounded-lg font-semibold transition ${
                    gameResultFilter === "loss"
                      ? "bg-rose-500/20 text-rose-600 border border-rose-500/30"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Thua
                </button>
              </div>
            </div>
          </div>

          {/* Games Table */}
          <div className="bg-card border border-border/70 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground font-bold uppercase tracking-wider border-b border-border/70">
                  <tr>
                    <th className="px-4 py-3">⚪ Quân Trắng</th>
                    <th className="px-4 py-3">⚫ Quân Đen</th>
                    <th className="px-3 py-3">Kết quả</th>
                    <th className="px-3 py-3">Khai cuộc & ECO</th>
                    <th className="px-3 py-3">Thời gian</th>
                    <th className="px-4 py-3 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {paginatedGames.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        Không tìm thấy ván đấu nào khớp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    paginatedGames.map((g, idx) => {
                      const pName = (player?.canonical_name || "").toLowerCase();
                      const isWhite = (g.white_player || "").toLowerCase().includes(pName);
                      const isBlack = (g.black_player || "").toLowerCase().includes(pName);
                      const dateDisplay = formatGameDate(g);
                      const pInfo = getPlatformInfo(g);

                      return (
                        <tr
                          key={g.id || `game-${idx}`}
                          onClick={() => analyzeGame(g)}
                          className="cursor-pointer hover:bg-emerald-500/[0.04] dark:hover:bg-emerald-500/[0.08] transition group"
                          title="Nhấp để mở bàn cờ phân tích ngay lập tức"
                        >
                          <td className="px-4 py-3 font-medium text-foreground">
                            <span className={isWhite ? "font-bold text-emerald-600 dark:text-emerald-400" : ""}>
                              {g.white_player}
                            </span>
                            {g.white_elo && <span className="text-[10px] text-muted-foreground ml-1">({g.white_elo})</span>}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            <span className={isBlack ? "font-bold text-emerald-600 dark:text-emerald-400" : ""}>
                              {g.black_player}
                            </span>
                            {g.black_elo && <span className="text-[10px] text-muted-foreground ml-1">({g.black_elo})</span>}
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
                            <span className="truncate max-w-[150px] inline-block align-bottom font-medium">
                              {g.opening_name || ""}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground text-[11px] font-mono">
                            {dateDisplay}
                          </td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Direct Phân tích Button */}
                              <button
                                type="button"
                                onClick={() => analyzeGame(g)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition shadow-2xs flex items-center gap-1"
                                title="Mở bàn cờ phân tích"
                              >
                                <Sword className="w-3 h-3" />
                                <span>Phân tích</span>
                              </button>

                              {/* Detail info button */}
                              <button
                                type="button"
                                onClick={() => setDetailModalGame(g)}
                                className="p-1 rounded-lg border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted"
                                title="Chi tiết ván cờ"
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
              <div className="px-4 py-3 bg-muted/20 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-muted-foreground">
                  Hiển thị ván <b>{(currentPage - 1) * gamesPerPage + 1}</b> -{" "}
                  <b>{Math.min(currentPage * gamesPerPage, totalFiltered)}</b> trong tổng số{" "}
                  <b>{totalFiltered}</b> ván
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setGamePage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-border disabled:opacity-30 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-mono font-bold">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setGamePage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-border disabled:opacity-30 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game Detail Modal */}
      {detailModalGame && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setDetailModalGame(null)}
        >
          <div
            className="w-full max-w-2xl bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Chi Tiết Ván Đấu</h3>
                  <p className="text-xs text-muted-foreground">
                    {detailModalGame.eco && <span className="font-mono font-bold text-primary mr-1">[{detailModalGame.eco}]</span>}
                    {detailModalGame.opening_name || "Khai cuộc không xác định"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailModalGame(null)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Players vs Result */}
            <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-between gap-4 text-xs">
              <div className="space-y-0.5">
                <div className="font-bold text-sm text-foreground">⚪ {detailModalGame.white_player}</div>
                {detailModalGame.white_elo && (
                  <div className="text-[11px] text-muted-foreground">Elo: {detailModalGame.white_elo}</div>
                )}
              </div>
              <div className="font-mono font-black text-sm px-3 py-1 rounded-xl bg-background border border-border shadow-2xs">
                {detailModalGame.result}
              </div>
              <div className="space-y-0.5 text-right">
                <div className="font-bold text-sm text-foreground">⚫ {detailModalGame.black_player}</div>
                {detailModalGame.black_elo && (
                  <div className="text-[11px] text-muted-foreground">Elo: {detailModalGame.black_elo}</div>
                )}
              </div>
            </div>

            {/* SAN Moves */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-bold text-foreground">Danh Sách Nước Đi (SAN):</span>
                <button
                  type="button"
                  onClick={() => {
                    if (detailModalGame.moves_san) {
                      navigator.clipboard.writeText(detailModalGame.moves_san);
                      setCopiedPgn(true);
                      setTimeout(() => setCopiedPgn(false), 2000);
                    }
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold"
                >
                  {copiedPgn ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPgn ? "Đã chép!" : "Sao chép"}</span>
                </button>
              </div>
              <div className="p-3 rounded-2xl bg-muted/30 border border-border font-mono text-[11px] max-h-36 overflow-y-auto leading-relaxed select-all">
                {detailModalGame.moves_san || "Không có nước đi"}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-3">
              <div>
                {(() => {
                  const pInfo = getPlatformInfo(detailModalGame);
                  if (!pInfo.url) return null;
                  return (
                    <a
                      href={pInfo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border bg-muted/50 hover:bg-muted"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Xem trên {pInfo.label}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  );
                })()}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailModalGame(null)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const g = detailModalGame;
                    setDetailModalGame(null);
                    analyzeGame(g);
                  }}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/25 flex items-center gap-1.5"
                >
                  <Sword className="w-3.5 h-3.5" />
                  <span>Mở Bàn Cờ Phân Tích</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Player Modal */}
      {modalAction === "edit" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setModalAction("none")}
        >
          <div
            className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <h3 className="font-bold text-base text-foreground">Sửa Thông Tin Kỳ Thủ</h3>
              <button onClick={() => setModalAction("none")}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdatePlayer} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1">Tên Chính Thức *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-background border border-border/70 rounded-xl p-2.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Danh Hiệu</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-background border border-border/70 rounded-xl p-2.5"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">FIDE ID</label>
                  <input
                    type="number"
                    value={editFideId}
                    onChange={(e) => setEditFideId(e.target.value)}
                    className="w-full bg-background border border-border/70 rounded-xl p-2.5"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Ghi Chú</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-background border border-border/70 rounded-xl p-2.5 resize-none"
                  rows={2}
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAction("none")}
                  className="px-4 py-2 border rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-bold"
                >
                  {updating ? "Đang lưu..." : "Cập Nhật"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Player Modal */}
      {modalAction === "delete" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setModalAction("none")}
        >
          <div
            className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-base text-foreground">Xác Nhận Xóa Hồ Sơ</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Bạn có chắc chắn muốn xóa hồ sơ <b>{player.canonical_name}</b> cùng toàn bộ ván đấu không?
            </p>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalAction("none")}
                className="px-4 py-2 border rounded-xl"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 text-white rounded-xl font-bold"
              >
                {deleting ? "Đang xóa..." : "Xóa Vĩnh Viễn"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
