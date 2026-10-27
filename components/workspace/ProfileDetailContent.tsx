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
  FolderOpen,
  UploadCloud,
  Swords,
  Users,
  Loader2,
  AlertCircle,
  RotateCcw
} from "lucide-react";
import { Player, Game, AnalysisRun } from "@/lib/api/types";
import { apiClient } from "@/lib/api/client";
import { useProfileWorkspaceStore } from "@/lib/stores/profileWorkspaceStore";
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
    exploreOpening,
    refreshProfileData,
    refreshPlayersList,
    setActiveTab,
    openHub,
    multiProfiles,
    selectedSubProfileId,
    setSelectedSubProfileId,
    activeMode,
    loadProfileData,
    retryLoadProfile,
    loadingProfileId,
    cachedProfiles,
    failedProfileIds,
    loadingPlayers,
    activePlayerId,
    players,
  } = useProfileWorkspaceStore();

  const player = activePlayer;
  const games = activePlayerGames;
  const analysisRun = activePlayerRun;

  const effectivePlayerId = targetPlayerId || activePlayerId;
  const profileError = effectivePlayerId ? failedProfileIds[effectivePlayerId] : null;

  // Auto-trigger profile loading if not yet cached and not in error state
  useEffect(() => {
    const idToLoad = player?.id || effectivePlayerId;
    if (
      idToLoad &&
      !cachedProfiles[idToLoad] &&
      !failedProfileIds[idToLoad] &&
      loadingProfileId !== idToLoad
    ) {
      loadProfileData(idToLoad);
    }
  }, [player?.id, effectivePlayerId, cachedProfiles, failedProfileIds, loadingProfileId, loadProfileData]);

  // Determine if this profile's data is actively loading
  const isProfileLoading = Boolean(
    !profileError && (
      (player && loadingProfileId === player.id) ||
      (player && !cachedProfiles[player.id]) ||
      (!player && effectivePlayerId && loadingProfileId === effectivePlayerId) ||
      (!player && effectivePlayerId && !cachedProfiles[effectivePlayerId] && !failedProfileIds[effectivePlayerId]) ||
      (!player && loadingPlayers && !effectivePlayerId)
    )
  );

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

  // Detailed Game Statistics for Visual Charts
  const profileChartsData = useMemo(() => {
    const pName = (player?.canonical_name || "").toLowerCase();
    let totalWins = 0;
    let totalDraws = 0;
    let totalLosses = 0;

    let whiteGames = 0;
    let whiteWins = 0;
    let whiteDraws = 0;
    let whiteLosses = 0;

    let blackGames = 0;
    let blackWins = 0;
    let blackDraws = 0;
    let blackLosses = 0;

    const openingMap = new Map<string, { name: string; eco: string; count: number; wins: number; draws: number; losses: number }>();

    for (const g of safeGames) {
      const isWhite = (g.white_player || "").toLowerCase().includes(pName);
      const isBlack = (g.black_player || "").toLowerCase().includes(pName);
      const res = g.result;

      let isWin = false;
      let isDraw = false;
      let isLoss = false;

      if (isWhite) {
        whiteGames++;
        if (res === "1-0") { isWin = true; whiteWins++; }
        else if (res === "1/2-1/2") { isDraw = true; whiteDraws++; }
        else if (res === "0-1") { isLoss = true; whiteLosses++; }
      } else if (isBlack) {
        blackGames++;
        if (res === "0-1") { isWin = true; blackWins++; }
        else if (res === "1/2-1/2") { isDraw = true; blackDraws++; }
        else if (res === "1-0") { isLoss = true; blackLosses++; }
      } else {
        if (res === "1-0") isWin = true;
        else if (res === "1/2-1/2") isDraw = true;
        else if (res === "0-1") isLoss = true;
      }

      if (isWin) totalWins++;
      else if (isDraw) totalDraws++;
      else if (isLoss) totalLosses++;

      const opName = g.opening_name || (g.eco ? `Khai cuộc ${g.eco}` : "Chưa rõ");
      const eco = g.eco || "---";
      const key = `${eco}-${opName}`;
      const existing = openingMap.get(key) || { name: opName, eco, count: 0, wins: 0, draws: 0, losses: 0 };
      existing.count++;
      if (isWin) existing.wins++;
      else if (isDraw) existing.draws++;
      else if (isLoss) existing.losses++;
      openingMap.set(key, existing);
    }

    const total = safeGames.length || 1;
    const winPct = (totalWins / total) * 100;
    const drawPct = (totalDraws / total) * 100;
    const lossPct = (totalLosses / total) * 100;
    const overallScore = totalWins + totalDraws * 0.5;
    const overallScorePct = (overallScore / total) * 100;

    const wTotal = whiteGames || 1;
    const whiteScore = whiteWins + whiteDraws * 0.5;
    const whiteScorePct = (whiteScore / wTotal) * 100;
    const whiteWinPct = (whiteWins / wTotal) * 100;
    const whiteDrawPct = (whiteDraws / wTotal) * 100;
    const whiteLossPct = (whiteLosses / wTotal) * 100;

    const bTotal = blackGames || 1;
    const blackScore = blackWins + blackDraws * 0.5;
    const blackScorePct = (blackScore / bTotal) * 100;
    const blackWinPct = (blackWins / bTotal) * 100;
    const blackDrawPct = (blackDraws / bTotal) * 100;
    const blackLossPct = (blackLosses / bTotal) * 100;

    const topOpenings = Array.from(openingMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      totalGames: safeGames.length,
      totalWins,
      totalDraws,
      totalLosses,
      winPct,
      drawPct,
      lossPct,
      overallScorePct,
      whiteGames,
      whiteWins,
      whiteDraws,
      whiteLosses,
      whiteScorePct,
      whiteWinPct,
      whiteDrawPct,
      whiteLossPct,
      blackGames,
      blackWins,
      blackDraws,
      blackLosses,
      blackScorePct,
      blackWinPct,
      blackDrawPct,
      blackLossPct,
      topOpenings,
    };
  }, [safeGames, player?.canonical_name]);

  if (isProfileLoading) {
    const candidatePlayer = player || (effectivePlayerId ? players.find((p) => p.id === effectivePlayerId) : null);
    const displayName = candidatePlayer?.canonical_name || "kỳ thủ";
    const initialChar = displayName ? displayName[0].toUpperCase() : "P";

    return (
      <div className="w-full space-y-6 sm:space-y-8 animate-fade-in pb-12">
        {/* Skeleton Top Player Card */}
        <div className="relative overflow-hidden rounded-xl bg-card border border-border/70 p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xl shrink-0 shadow-xs">
                {initialChar}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <h1 className="text-xl sm:text-2xl font-black text-foreground">
                    {displayName}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-600 dark:text-emerald-400" />
                    Đang nạp dữ liệu ván đấu...
                  </span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>Hệ thống đang đồng bộ biên bản PGN, tính toán thống kê và hệ thống khai cuộc.</span>
                </p>
              </div>
            </div>

            {/* Stats Placeholders with skeleton animation */}
            <div className="flex items-center gap-4 sm:gap-6 border-t md:border-t-0 md:border-l border-border/70 pt-3 md:pt-0 md:pl-6 shrink-0">
              <div className="text-center">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Tổng số ván
                </div>
                <div className="h-6 w-14 bg-muted/70 rounded-md animate-pulse mx-auto" />
              </div>
              <div className="text-center">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Tỷ lệ thắng
                </div>
                <div className="h-6 w-16 bg-muted/70 rounded-md animate-pulse mx-auto" />
              </div>
              <div className="text-center">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Điểm chung
                </div>
                <div className="h-6 w-14 bg-muted/70 rounded-md animate-pulse mx-auto" />
              </div>
            </div>
          </div>
        </div>

        {/* Skeleton Tabs Strip */}
        <div className="flex items-center gap-2 border-b border-border/60 pb-2 overflow-x-auto">
          <div className="h-8 w-44 bg-muted/60 rounded-lg animate-pulse shrink-0" />
          <div className="h-8 w-40 bg-muted/40 rounded-lg animate-pulse shrink-0" />
          <div className="h-8 w-36 bg-muted/40 rounded-lg animate-pulse shrink-0" />
          <div className="h-8 w-36 bg-muted/40 rounded-lg animate-pulse shrink-0" />
        </div>

        {/* Skeleton Overview Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
          {/* Card 1: Tỷ lệ kết quả Skeleton */}
          <div className="p-5 sm:p-6 rounded-xl bg-card border border-border/70 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="h-5 w-48 bg-muted/70 rounded-md animate-pulse" />
              <div className="h-5 w-20 bg-muted/50 rounded-md animate-pulse" />
            </div>
            <div className="h-4 w-64 bg-muted/40 rounded-md animate-pulse" />
            <div className="h-6 bg-muted/50 rounded-lg animate-pulse mt-2" />
            <div className="grid grid-cols-3 gap-3 pt-3">
              <div className="h-16 bg-muted/30 rounded-xl animate-pulse" />
              <div className="h-16 bg-muted/30 rounded-xl animate-pulse" />
              <div className="h-16 bg-muted/30 rounded-xl animate-pulse" />
            </div>
          </div>

          {/* Card 2: Hiệu suất Trắng vs Đen Skeleton */}
          <div className="p-5 sm:p-6 rounded-xl bg-card border border-border/70 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="h-5 w-56 bg-muted/70 rounded-md animate-pulse" />
              <div className="h-5 w-16 bg-muted/50 rounded-md animate-pulse" />
            </div>
            <div className="h-4 w-40 bg-muted/40 rounded-md animate-pulse" />
            <div className="space-y-3 pt-2">
              <div className="h-10 bg-muted/30 rounded-xl animate-pulse" />
              <div className="h-10 bg-muted/30 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>

        {/* Central Friendly Loading Note */}
        <div className="flex flex-col items-center justify-center py-6 gap-2 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
          <p className="text-xs font-medium">Đang nạp và phân tích dữ liệu ván đấu, biểu đồ sẽ xuất hiện ngay...</p>
        </div>
      </div>
    );
  }

  // Error Card if loading profile failed
  if (profileError && effectivePlayerId && !cachedProfiles[effectivePlayerId]) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[55vh] py-16 px-4 text-center animate-fade-in">
        <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 mb-4 shadow-2xs">
          <AlertCircle className="w-12 h-12" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
          Không tìm thấy hồ sơ kỳ thủ
        </h2>
        <p className="text-sm text-muted-foreground max-w-lg mb-6 leading-relaxed">
          {profileError || "Hồ sơ kỳ thủ này không tồn tại hoặc phiên dùng thử đã kết thúc. Bạn có thể thử tải lại hoặc nạp lại ván đấu từ Lichess."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => retryLoadProfile(effectivePlayerId)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Thử tải lại</span>
          </button>
          <Link
            href="/import"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs font-bold transition shadow-2xs"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Nạp lại ván đấu</span>
          </Link>
          <button
            type="button"
            onClick={openHub}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border/80 text-muted-foreground hover:text-foreground text-xs font-bold transition shadow-2xs cursor-pointer"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Thư viện kỳ thủ</span>
          </button>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[55vh] py-16 px-4 text-center animate-fade-in">
        <div className="p-4 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mb-4 shadow-2xs">
          <BarChart2 className="w-12 h-12" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
          Chưa có hồ sơ kỳ thủ phân tích
        </h2>
        <p className="text-sm text-muted-foreground max-w-lg mb-6 leading-relaxed">
          Bạn đang ở chế độ Bàn cờ tự do (Master DB) hoặc chưa chọn hồ sơ kỳ thủ nào. Hãy chọn một kỳ thủ từ thư viện hoặc nạp ván đấu mới để xem thống kê chuyên sâu, repertoire khai cuộc và cấu trúc tốt.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={openHub}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Mở Thư viện kỳ thủ</span>
          </button>
          <Link
            href="/import"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground hover:bg-muted text-xs font-semibold border border-border/80 transition"
          >
            <UploadCloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Nạp ván đấu mới</span>
          </Link>
          <button
            type="button"
            onClick={() => setActiveTab("board")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition cursor-pointer"
          >
            <Swords className="w-4 h-4 text-sky-500" />
            <span>Sang Bàn cờ tự do</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 sm:space-y-8 animate-fade-in pb-12">
      {/* Toast Notice */}
      {notice && (
        <div
          className={`fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-md transition-all animate-slide-in ${
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
        <div className="flex items-center gap-2 p-2 rounded-xl bg-muted/50 border border-border/70 overflow-x-auto">
          <span className="text-xs font-bold text-muted-foreground px-2 shrink-0">
            Xem hồ sơ trong nhóm:
          </span>
          {multiProfiles.map((item) => {
            const isSelected = item.player.id === player?.id;
            const roleBadge = item.role === "white" ? "⚪ Trắng" : item.role === "black" ? "⚫ Đen" : "⚪⚫ Cả hai";

            return (
              <button
                key={item.player.id}
                type="button"
                onClick={() => {
                  setSelectedSubProfileId(item.player.id);
                  loadProfileData(item.player.id);
                }}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 border cursor-pointer ${
                  isSelected
                    ? "bg-background text-emerald-600 dark:text-emerald-400 border-emerald-500 shadow-2xs"
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
      <div className="relative overflow-hidden rounded-xl bg-card border border-border/70 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
          {/* Avatar & Player Info */}
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-xl sm:text-2xl shadow-sm shrink-0">
              {player.canonical_name ? player.canonical_name[0].toUpperCase() : "P"}
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-black text-foreground truncate">
                  {player.canonical_name}
                </h1>
                {player.title && (
                  <span className="px-1.5 py-0.2 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black shrink-0">
                    {player.title}
                  </span>
                )}
                {player.fide_id && (
                  <span className="text-xs text-muted-foreground font-mono font-semibold shrink-0">
                    FIDE: {player.fide_id}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xl line-clamp-2 sm:line-clamp-none">
                {player.notes || "Hồ sơ phân tích dữ liệu ván đấu và phong cách thi đấu chuyên sâu."}
              </p>
            </div>
          </div>

          {/* Quick Stats Pill Counters */}
          <div className="grid grid-cols-3 sm:flex items-center gap-2 sm:gap-6 border-t md:border-t-0 md:border-l border-border/40 pt-3 md:pt-0 md:pl-6 text-center sm:text-left">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block truncate">
                Tổng số ván
              </span>
              <span className="text-base sm:text-2xl font-extrabold text-foreground">
                {games.length}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block truncate">
                Tỷ lệ thắng
              </span>
              <span className="text-base sm:text-2xl font-extrabold text-emerald-500">
                {analysisRun?.overall_win_rate ? `${analysisRun.overall_win_rate.toFixed(1)}%` : "0.0%"}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block truncate">
                Điểm chung
              </span>
              <span className="text-base sm:text-2xl font-extrabold text-primary">
                {analysisRun?.overall_score ? `${analysisRun.overall_score.toFixed(1)}%` : "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Top Action Buttons (Edit, Delete, Refresh Analysis) */}
        <div className="mt-4 pt-3.5 border-t border-border/50 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 hover:bg-muted text-xs font-semibold text-foreground transition"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Sửa Thông Tin</span>
            </button>
            <button
              type="button"
              onClick={handleOpenDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-semibold transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa Hồ Sơ</span>
            </button>
          </div>

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
          <span>Tổng Quan & Biểu Đồ Thống Kê</span>
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
          <span>Đánh Giá Khai Cuộc</span>
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

      {/* Sub-Tab 1: Visual Charts & Analytics */}
      {profileSubTab === "overview" && (
        <div className="space-y-6">
          {/* Row 1: Overall Donut Chart + White vs Black Comparative Column Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chart 1: Donut Chart - Tỷ Lệ Kết Quả Toàn Diện (7 cols) */}
            <div className="lg:col-span-7 bg-card border border-border/70 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/50">
                <div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-emerald-500" />
                    Biểu Đồ Tròn Tỷ Lệ Kết Quả Toàn Diện ({profileChartsData.totalGames} ván)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Phân bố kết quả Thắng - Hòa - Thua của {player.canonical_name}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs self-start sm:self-auto border border-emerald-500/20">
                  Hiệu suất: {profileChartsData.overallScorePct.toFixed(1)}%
                </span>
              </div>

              {/* Donut Chart + 3 Metric Cards Side by Side */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                {/* Donut SVG Chart */}
                <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
                    {/* Background Ring */}
                    <circle
                      cx="70"
                      cy="70"
                      r="52"
                      className="text-muted/40 stroke-current"
                      strokeWidth="15"
                      fill="transparent"
                    />
                    {/* Win Segment (Emerald) */}
                    {profileChartsData.winPct > 0 && (
                      <circle
                        cx="70"
                        cy="70"
                        r="52"
                        className="text-emerald-500 stroke-current transition-all duration-700 ease-out"
                        strokeWidth="15"
                        strokeDasharray={`${(profileChartsData.winPct / 100) * 326.72} 326.72`}
                        strokeDashoffset="0"
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    )}
                    {/* Draw Segment (Amber) */}
                    {profileChartsData.drawPct > 0 && (
                      <circle
                        cx="70"
                        cy="70"
                        r="52"
                        className="text-amber-500 stroke-current transition-all duration-700 ease-out"
                        strokeWidth="15"
                        strokeDasharray={`${(profileChartsData.drawPct / 100) * 326.72} 326.72`}
                        strokeDashoffset={`-${(profileChartsData.winPct / 100) * 326.72}`}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    )}
                    {/* Loss Segment (Rose) */}
                    {profileChartsData.lossPct > 0 && (
                      <circle
                        cx="70"
                        cy="70"
                        r="52"
                        className="text-rose-500 stroke-current transition-all duration-700 ease-out"
                        strokeWidth="15"
                        strokeDasharray={`${(profileChartsData.lossPct / 100) * 326.72} 326.72`}
                        strokeDashoffset={`-${((profileChartsData.winPct + profileChartsData.drawPct) / 100) * 326.72}`}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    )}
                  </svg>

                  {/* Centered Stats inside Donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
                    <span className="text-xl font-black text-foreground tracking-tight">
                      {profileChartsData.overallScorePct.toFixed(1)}%
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Điểm số
                    </span>
                  </div>
                </div>

                {/* 3 Metric Cards with Color Indicators */}
                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-emerald-500/[0.08] dark:bg-emerald-500/10 border border-emerald-500/25 flex sm:flex-col justify-between items-center sm:items-start transition hover:border-emerald-500/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Thắng</span>
                    </div>
                    <div className="text-right sm:text-left">
                      <span className="text-lg font-black text-foreground block leading-tight">{profileChartsData.totalWins}</span>
                      <span className="text-[11px] font-mono text-muted-foreground font-semibold">({profileChartsData.winPct.toFixed(1)}%)</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/[0.08] dark:bg-amber-500/10 border border-amber-500/25 flex sm:flex-col justify-between items-center sm:items-start transition hover:border-amber-500/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Hòa</span>
                    </div>
                    <div className="text-right sm:text-left">
                      <span className="text-lg font-black text-foreground block leading-tight">{profileChartsData.totalDraws}</span>
                      <span className="text-[11px] font-mono text-muted-foreground font-semibold">({profileChartsData.drawPct.toFixed(1)}%)</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-500/[0.08] dark:bg-rose-500/10 border border-rose-500/25 flex sm:flex-col justify-between items-center sm:items-start transition hover:border-rose-500/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <span className="text-xs font-bold text-rose-700 dark:text-rose-400">Thua</span>
                    </div>
                    <div className="text-right sm:text-left">
                      <span className="text-lg font-black text-foreground block leading-tight">{profileChartsData.totalLosses}</span>
                      <span className="text-[11px] font-mono text-muted-foreground font-semibold">({profileChartsData.lossPct.toFixed(1)}%)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Games & Score Row */}
              <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Tổng số ván đã phân tích: <b className="text-foreground">{profileChartsData.totalGames} ván</b></span>
                <span>Ghi được: <b className="text-foreground">{(profileChartsData.totalWins + profileChartsData.totalDraws * 0.5).toFixed(1)}</b> / {profileChartsData.totalGames} điểm</span>
              </div>
            </div>

            {/* Chart 2: Grouped Column Chart - So Sánh Cầm Trắng vs Cầm Đen (5 cols) */}
            <div className="lg:col-span-5 bg-card border border-border/70 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div className="pb-3 border-b border-border/50 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-emerald-500" />
                    Biểu Đồ Cột: Cầm Trắng vs Cầm Đen
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    So sánh cột từng chỉ số kết quả theo màu quân
                  </p>
                </div>
                {/* Legend */}
                <div className="flex items-center gap-2.5 text-[11px] font-bold shrink-0">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                    ⚪ Trắng
                  </span>
                  <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
                    <span className="w-2.5 h-2.5 rounded-xs bg-sky-500 inline-block" />
                    ⚫ Đen
                  </span>
                </div>
              </div>

              {/* Grouped Vertical Columns Chart */}
              <div className="pt-2 pb-1">
                <div className="h-44 w-full flex items-end justify-between gap-2 sm:gap-4 px-2 sm:px-4 border-b border-border/60 pb-1">
                  {[
                    {
                      label: "Tỷ lệ Thắng",
                      wVal: profileChartsData.whiteWinPct,
                      bVal: profileChartsData.blackWinPct,
                    },
                    {
                      label: "Tỷ lệ Hòa",
                      wVal: profileChartsData.whiteDrawPct,
                      bVal: profileChartsData.blackDrawPct,
                    },
                    {
                      label: "Tỷ lệ Thua",
                      wVal: profileChartsData.whiteLossPct,
                      bVal: profileChartsData.blackLossPct,
                    },
                    {
                      label: "Điểm số",
                      wVal: profileChartsData.whiteScorePct,
                      bVal: profileChartsData.blackScorePct,
                      highlight: true,
                    },
                  ].map((col, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      {/* Bars Pair Container */}
                      <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-32">
                        {/* White Bar */}
                        <div className="flex-1 max-w-[28px] flex flex-col items-center justify-end h-full">
                          <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 mb-0.5 leading-none">
                            {col.wVal.toFixed(0)}%
                          </span>
                          <div
                            style={{ height: `${Math.max(col.wVal, 4)}%` }}
                            className="w-full rounded-t-md bg-emerald-500 hover:bg-emerald-400 transition-all duration-500 shadow-2xs"
                            title={`Cầm Trắng - ${col.label}: ${col.wVal.toFixed(1)}%`}
                          />
                        </div>

                        {/* Black Bar */}
                        <div className="flex-1 max-w-[28px] flex flex-col items-center justify-end h-full">
                          <span className="text-[10px] font-mono font-bold text-sky-600 dark:text-sky-400 mb-0.5 leading-none">
                            {col.bVal.toFixed(0)}%
                          </span>
                          <div
                            style={{ height: `${Math.max(col.bVal, 4)}%` }}
                            className="w-full rounded-t-md bg-sky-500 hover:bg-sky-400 transition-all duration-500 shadow-2xs"
                            title={`Cầm Đen - ${col.label}: ${col.bVal.toFixed(1)}%`}
                          />
                        </div>
                      </div>

                      {/* X-axis Label */}
                      <span className={`text-[11px] font-bold text-center truncate max-w-full ${col.highlight ? "text-foreground font-black" : "text-muted-foreground"}`}>
                        {col.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Games count row + Advantage Delta badge */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>⚪ Cầm Trắng: <b className="text-foreground">{profileChartsData.whiteGames} ván</b> ({profileChartsData.whiteScorePct.toFixed(1)}% điểm)</span>
                  <span>⚫ Cầm Đen: <b className="text-foreground">{profileChartsData.blackGames} ván</b> ({profileChartsData.blackScorePct.toFixed(1)}% điểm)</span>
                </div>

                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Chênh lệch lợi thế màu quân:</span>
                  <span className="font-bold">
                    {profileChartsData.whiteScorePct >= profileChartsData.blackScorePct ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        ⚪ Ưu thế Trắng (+{(profileChartsData.whiteScorePct - profileChartsData.blackScorePct).toFixed(1)}%)
                      </span>
                    ) : (
                      <span className="text-sky-600 dark:text-sky-400">
                        ⚫ Ưu thế Đen (+{(profileChartsData.blackScorePct - profileChartsData.whiteScorePct).toFixed(1)}%)
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Top Openings Bar Chart + Pawn Structures Distribution Bar Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 3: Top Openings Breakdown (Horizontal Bar Chart) */}
            <div className="bg-card border border-border/70 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/50">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-500" />
                  Khai Cuộc Sử Dụng Nhiều Nhất (Biểu đồ Cột)
                </h3>
                <button
                  type="button"
                  onClick={() => setProfileSubTab("openings")}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Xem chi tiết khai cuộc →
                </button>
              </div>

              {profileChartsData.topOpenings.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Chưa có dữ liệu khai cuộc.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {profileChartsData.topOpenings.map((op, idx) => {
                    const score = ((op.wins + op.draws * 0.5) / (op.count || 1)) * 100;
                    const wPct = (op.wins / (op.count || 1)) * 100;
                    const dPct = (op.draws / (op.count || 1)) * 100;
                    const lPct = (op.losses / (op.count || 1)) * 100;
                    const freq = (op.count / (profileChartsData.totalGames || 1)) * 100;
                    const maxCount = profileChartsData.topOpenings[0]?.count || 1;
                    const barWidth = Math.max((op.count / maxCount) * 100, 15);

                    return (
                      <div key={`${op.eco}-${idx}`} className="space-y-1.5 p-2 rounded-lg hover:bg-muted/40 transition">
                        <div className="flex justify-between items-center text-xs gap-2">
                          <div className="flex items-center gap-2 truncate min-w-0">
                            <span className="w-5 h-5 rounded-md bg-secondary text-foreground font-black text-[10px] flex items-center justify-center shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="font-mono font-bold text-[11px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 shrink-0">
                              {op.eco}
                            </span>
                            <span className="font-semibold text-foreground truncate" title={op.name}>
                              {op.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[11px] text-muted-foreground font-semibold">
                              {op.count} ván ({freq.toFixed(0)}%)
                            </span>
                            <span className={`text-[11px] font-bold font-mono px-1.5 py-0.2 rounded ${score >= 50 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
                              {score.toFixed(0)}% điểm
                            </span>
                          </div>
                        </div>

                        {/* Relative Frequency Bar Container */}
                        <div className="w-full bg-muted/60 h-3 rounded-full overflow-hidden p-0.5">
                          <div style={{ width: `${barWidth}%` }} className="h-full rounded-full overflow-hidden flex transition-all duration-500">
                            <div style={{ width: `${wPct}%` }} className="h-full bg-emerald-500" title={`Thắng: ${op.wins} (${wPct.toFixed(0)}%)`} />
                            <div style={{ width: `${dPct}%` }} className="h-full bg-amber-500" title={`Hòa: ${op.draws} (${dPct.toFixed(0)}%)`} />
                            <div style={{ width: `${lPct}%` }} className="h-full bg-rose-500" title={`Thua: ${op.losses} (${lPct.toFixed(0)}%)`} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chart 4: Pawn Structures Distribution (Bar Chart) */}
            <div className="bg-card border border-border/70 rounded-xl p-5 sm:p-6 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-border/50">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-500" />
                    Phân Bổ Cấu Trúc Tốt Nhận Diện (Biểu đồ Cột)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setProfileSubTab("structures")}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Xem sơ đồ cấu trúc →
                  </button>
                </div>

                {analysisRun?.pawn_structures_summary?.structures && analysisRun.pawn_structures_summary.structures.length > 0 ? (
                  <div className="space-y-3 mt-3">
                    {(() => {
                      const structs = analysisRun.pawn_structures_summary.structures.slice(0, 5);
                      const maxStCount = Math.max(...structs.map((st: any) => st.games?.length || st.games_count || 1), 1);

                      return structs.map((st: any, idx: number) => {
                        const count = st.games?.length || st.games_count || 0;
                        const score = st.adjusted_score_pct ?? st.score_pct ?? 50;
                        const barWidth = Math.max((count / maxStCount) * 100, 15);
                        const color = st.assessment_color ?? "#10B981";

                        return (
                          <div key={st.structure_key || idx} className="p-2.5 rounded-lg border border-border/50 bg-background/50 space-y-1.5 hover:bg-muted/30 transition">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 truncate min-w-0">
                                <span className="font-bold text-xs text-foreground truncate">
                                  {st.name}
                                </span>
                                <span
                                  className="px-1.5 py-0.2 rounded text-[10px] font-semibold border shrink-0"
                                  style={{
                                    backgroundColor: `${color}15`,
                                    color: color,
                                    borderColor: `${color}30`
                                  }}
                                >
                                  {st.assessment_badge || "Cấu trúc"}
                                </span>
                              </div>

                              <div className="text-right shrink-0 flex items-center gap-2">
                                <span className="text-[11px] text-muted-foreground font-semibold">
                                  {count} ván
                                </span>
                                <span className="font-mono font-bold text-xs text-foreground bg-muted px-1.5 py-0.2 rounded">
                                  {score.toFixed(1)}% điểm
                                </span>
                              </div>
                            </div>

                            {/* Frequency Bar */}
                            <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
                              <div
                                style={{
                                  width: `${barWidth}%`,
                                  backgroundColor: color,
                                }}
                                className="h-full rounded-full transition-all duration-500"
                                title={`${st.name}: ${count} ván (${score.toFixed(1)}% điểm)`}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    Cấu trúc tốt được nhận diện tự động từ các ván đấu khi phân tích khai cuộc.
                  </div>
                )}
              </div>

              {/* Navigation button to analyze board */}
              <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Muốn tương tác trực tiếp trên bàn cờ?
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab("board")}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <Sword className="w-3.5 h-3.5" />
                  <span>Mở Bàn Cờ & Cây Khai Cuộc</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Openings */}
      {profileSubTab === "openings" && (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Play className="w-5 h-5 text-emerald-500" />
                  Đánh Giá Hiệu Suất Khai Cuộc
                </h3>
                <p className="text-xs text-muted-foreground">
                  Phân tích hiệu suất thực tế và mức độ ổn định so với điểm cơ sở.
                </p>
              </div>
              <span className="text-xs px-3 py-1.5 rounded-xl bg-muted font-mono font-semibold text-foreground">
                Điểm cơ sở: {analysisRun?.repertoire_summary?.overall_baseline?.toFixed(1) || 50}%
              </span>
            </div>

            {analysisRun?.repertoire_summary?.all_openings && analysisRun.repertoire_summary.all_openings.length > 0 ? (
              <div className="bg-card border border-border/70 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 text-muted-foreground font-bold uppercase tracking-wider border-b border-border/70">
                      <tr>
                        <th className="px-4 py-3">Hệ thống Khai cuộc</th>
                        <th className="px-3 py-3">Số ván</th>
                        <th className="px-4 py-3 min-w-[140px]">Tỷ lệ Kết quả (Thắng/Hòa/Thua)</th>
                        <th className="px-3 py-3 text-right">Điểm thực</th>
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
                                onClick={() => exploreOpening(op.name, player?.id || targetPlayerId)}
                                className="px-2.5 py-1 rounded-lg bg-muted hover:bg-emerald-600 hover:text-white font-semibold text-[11px] transition text-foreground cursor-pointer"
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
              <div className="p-8 text-center bg-card border border-border/70 rounded-xl text-muted-foreground text-xs">
                Chưa có dữ liệu hệ thống khai cuộc cho kỳ thủ này.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Pawn Structures */}
      {profileSubTab === "structures" && (
        <div className="space-y-6">
          <div className="p-4 sm:p-5 rounded-xl bg-card border border-border/70 shadow-xs space-y-1">
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
          <div className="p-4 sm:p-5 rounded-xl bg-card border border-border/70 shadow-xs space-y-4">
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
          <div className="bg-card border border-border/70 rounded-xl overflow-hidden shadow-xs">
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
                          onClick={() => setDetailModalGame(g)}
                          className="cursor-pointer hover:bg-emerald-500/[0.04] dark:hover:bg-emerald-500/[0.08] transition group"
                          title="Nhấp để xem chi tiết ván cờ"
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
                              {/* Direct Platform Link (Lichess / Chess.com) */}
                              {pInfo.url ? (
                                <a
                                  href={pInfo.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition border shadow-2xs cursor-pointer ${
                                    pInfo.platform === "lichess"
                                      ? "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700"
                                      : pInfo.platform === "chesscom"
                                      ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                      : "bg-secondary text-secondary-foreground hover:bg-muted border-border"
                                  }`}
                                  title={`Xem ván đấu trên ${pInfo.label}`}
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>{pInfo.label}</span>
                                </a>
                              ) : (
                                <span className="text-[10px] text-muted-foreground px-2 py-0.5 bg-muted/40 rounded border border-border/40 font-medium">
                                  Ngoại tuyến
                                </span>
                              )}

                              {/* Detail info button */}
                              <button
                                type="button"
                                onClick={() => setDetailModalGame(g)}
                                className="p-1.5 rounded-lg border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                                title="Xem chi tiết ván cờ"
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
            className="w-full max-w-2xl bg-card border border-border rounded-xl p-5 sm:p-6 shadow-2xl space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
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
            <div className="p-3.5 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-between gap-4 text-xs">
              <div className="space-y-0.5">
                <div className="font-bold text-sm text-foreground">⚪ {detailModalGame.white_player}</div>
                {detailModalGame.white_elo && (
                  <div className="text-[11px] text-muted-foreground">Elo: {detailModalGame.white_elo}</div>
                )}
              </div>
              <div className="font-mono font-black text-sm px-3 py-1 rounded-lg bg-background border border-border shadow-2xs">
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
              <div className="p-3 rounded-lg bg-muted/30 border border-border font-mono text-[11px] max-h-36 overflow-y-auto leading-relaxed select-all">
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-muted/50 hover:bg-muted"
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
                  className="px-4 py-2 rounded-lg border border-border text-xs font-semibold"
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
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/25 flex items-center gap-1.5"
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
            className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-2xl space-y-4 animate-scale-in"
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
                  className="w-full bg-background border border-border/70 rounded-lg p-2.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Danh Hiệu</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-background border border-border/70 rounded-lg p-2.5"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">FIDE ID</label>
                  <input
                    type="number"
                    value={editFideId}
                    onChange={(e) => setEditFideId(e.target.value)}
                    className="w-full bg-background border border-border/70 rounded-lg p-2.5"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Ghi Chú</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-background border border-border/70 rounded-lg p-2.5 resize-none"
                  rows={2}
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalAction("none")}
                  className="px-4 py-2 border rounded-lg hover:bg-muted transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-lg font-bold shadow-xs hover:bg-emerald-500 transition"
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
            className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-2xl space-y-4 animate-scale-in"
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
                className="px-4 py-2 border rounded-lg hover:bg-muted transition"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 text-white rounded-lg font-bold shadow-xs hover:bg-rose-500 transition"
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
