"use client";

import React, { useEffect, useState } from "react";
import { OpeningContinuation, LichessMasterMove } from "@/lib/api/types";
import { apiClient } from "@/lib/api/client";
import {
  initiateLichessOAuth,
  getLichessAuth,
  disconnectLichessAuth,
} from "@/lib/auth/lichess";
import {
  Play,
  GitBranch,
  Eye,
  ExternalLink,
  Globe,
  Check,
  Zap,
  ShieldCheck,
  LogOut,
  Loader2,
  User,
  BookOpen,
} from "lucide-react";

interface OpeningTreeTableProps {
  continuations: OpeningContinuation[];
  totalGames?: number;
  onSelectMove: (san: string) => void;
  onLoadGame?: (gameInfo: any) => void;
  currentFen?: string;
  playerName?: string;
}

function formatCompactNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return num.toLocaleString();
}

function formatFullNumber(num: number): string {
  return num.toLocaleString();
}

interface MastersCacheEntry {
  moves: LichessMasterMove[];
  totalGames: number;
}

// In-memory frontend cache for instantaneous Master DB rendering across repeated moves
const CLIENT_MASTERS_CACHE = new Map<string, MastersCacheEntry>();

export default function OpeningTreeTable({
  continuations = [],
  totalGames = 0,
  onSelectMove,
  onLoadGame,
  currentFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  playerName,
}: OpeningTreeTableProps) {
  const [activeTab, setActiveTab] = useState<"player" | "master">("player");
  const [masterMoves, setMasterMoves] = useState<LichessMasterMove[]>([]);
  const [masterTotal, setMasterTotal] = useState<number>(0);
  const [masterLoading, setMasterLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authUsername, setAuthUsername] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Sync authorization status with localStorage
  const refreshAuthStatus = () => {
    const auth = getLichessAuth();
    setIsAuthorized(auth.isAuthorized);
    setAuthUsername(auth.username);
    return auth;
  };

  useEffect(() => {
    refreshAuthStatus();

    // Listen to changes from other tabs or pages (e.g. after /import finishes auth)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "lichess_token" || e.key === "lichess_username") {
        refreshAuthStatus();
        CLIENT_MASTERS_CACHE.clear();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Fetch Lichess Masters Data for current position
  useEffect(() => {
    if (!currentFen) return;
    const cleanFen = currentFen.trim();
    const auth = refreshAuthStatus();

    // If unauthenticated, do not make live calls to avoid 401s
    if (!auth.isAuthorized) {
      setMasterMoves([]);
      setMasterTotal(0);
      return;
    }

    if (CLIENT_MASTERS_CACHE.has(cleanFen)) {
      const cached = CLIENT_MASTERS_CACHE.get(cleanFen)!;
      setMasterMoves(cached.moves);
      setMasterTotal(cached.totalGames);
      return;
    }

    setMasterLoading(true);
    apiClient
      .getLichessMasters(cleanFen, auth.token)
      .then((res) => {
        if (res && res.moves) {
          const moves = res.moves || [];
          const total = res.total_games || 0;
          CLIENT_MASTERS_CACHE.set(cleanFen, { moves, totalGames: total });
          setMasterMoves(moves);
          setMasterTotal(total);
          if (res.authenticated) {
            setIsAuthorized(true);
          }
        } else {
          setMasterMoves([]);
          setMasterTotal(0);
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch Lichess Master DB:", err);
        setMasterMoves([]);
      })
      .finally(() => {
        setMasterLoading(false);
      });
  }, [currentFen]);

  // Trigger 1-Click Lichess OAuth PKCE
  const handle1ClickAuthorize = async () => {
    try {
      setIsAuthorizing(true);
      setAuthError(null);
      await initiateLichessOAuth(window.location.href);
    } catch (err: any) {
      setIsAuthorizing(false);
      setAuthError("Lỗi khởi tạo ủy quyền Lichess: " + (err.message || String(err)));
    }
  };

  // Disconnect Lichess account
  const handleDisconnect = () => {
    disconnectLichessAuth();
    setIsAuthorized(false);
    setAuthUsername("");
    setMasterMoves([]);
    setMasterTotal(0);
    CLIENT_MASTERS_CACHE.clear();
    setShowAuthModal(false);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm w-full">
      {/* Table Header Controls & Tab Selector */}
      <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Tab Toggle: Cây kì thủ vs Cây Master DB */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800/90 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("player")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "player"
                ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[130px] sm:max-w-[190px]">
              {playerName || "Kì thủ"}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold transition ${
                activeTab === "player"
                  ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300"
                  : "bg-slate-300/60 dark:bg-slate-700/60 text-slate-500"
              }`}
            >
              {continuations.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("master")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "master"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span>Master Database</span>
            {isAuthorized && masterTotal > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold transition ${
                  activeTab === "master"
                    ? "bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300"
                    : "bg-slate-300/60 dark:bg-slate-700/60 text-slate-500"
                }`}
              >
                {formatCompactNumber(masterTotal)}
              </span>
            )}
          </button>
        </div>

        {/* Master DB Status & Auth Badge */}
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setShowAuthModal(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
              isAuthorized
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60"
            }`}
            title={
              isAuthorized
                ? `Đã kết nối Lichess (@${authUsername || "Account"}). Bấm để quản lý kết nối.`
                : "Bấm để Ủy quyền Lichess 1-Click (mở Master Database)"
            }
          >
            <Globe className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="font-semibold hidden sm:inline">Master DB:</span>
            {isAuthorized ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                <Check className="w-3 h-3 text-emerald-500" />
                {authUsername ? `@${authUsername}` : (masterTotal > 0 ? `${formatCompactNumber(masterTotal)} ván` : "Đã kết nối")}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-bold">
                <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                Ủy quyền Lichess
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Lichess Authorization Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Kết Nối Lichess Master Database
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            {isAuthorized ? (
              /* If Already Authorized */
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-emerald-900 dark:text-emerald-200">
                      Đã kết nối thành công!
                    </p>
                    <p className="text-emerald-700 dark:text-emerald-400 mt-0.5">
                      Tài khoản Lichess: <b>@{authUsername || "Liên kết cá nhân"}</b>
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Cơ sở dữ liệu Kiện tướng Lichess Masters hiện đã được kích hoạt trực tiếp trên cây khai cuộc của bạn.
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Ngắt kết nối</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(false)}
                    className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition cursor-pointer"
                  >
                    Xong
                  </button>
                </div>
              </div>
            ) : (
              /* If Not Yet Authorized */
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
                  <p className="leading-relaxed">
                    Chỉ cần bấm <b>Ủy quyền Lichess</b> 1 lần duy nhất. Hệ thống sẽ lưu lại và kích hoạt dữ liệu Kiện tướng cho tất cả các trang.
                  </p>
                </div>

                {/* Primary 1-Click OAuth Button */}
                <button
                  type="button"
                  onClick={handle1ClickAuthorize}
                  disabled={isAuthorizing}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-60 cursor-pointer"
                >
                  {isAuthorizing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang mở trang Lichess...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                      <span>Ủy quyền Lichess (1-Click)</span>
                    </>
                  )}
                </button>

                {authError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 font-medium">
                    <span>{authError}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 1: CÂY CỦA KÌ THỦ (PLAYER OPENING TREE) */}
      {/* ============================================================ */}
      {activeTab === "player" && (
        <div className="w-full overflow-hidden">
          <table className="w-full text-left text-xs table-fixed">
            <thead className="bg-slate-50/90 dark:bg-slate-800/40 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 text-[10px] sm:text-[11px]">
              <tr>
                <th className="px-3 py-2.5 w-[20%]">Nước đi</th>
                <th className="px-2.5 py-2.5 w-[15%]">Số ván</th>
                <th className="px-2 py-2.5 w-[15%]">Tần suất</th>
                <th className="px-3 py-2.5 w-[35%]">Tỷ lệ W/D/L</th>
                <th className="px-3 py-2.5 text-right w-[15%]">Điểm số</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {continuations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400 text-xs">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <GitBranch className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                      <span>Không có nước đi tiếp theo nào của kì thủ trong cơ sở dữ liệu.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                continuations.map((c, idx) => {
                  const sg = c.single_game_info;
                  const isSingle = c.games_count === 1 && sg;

                  return (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition group"
                    >
                      {/* Move SAN */}
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onSelectMove(c.san)}
                            className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-emerald-500 group-hover:text-white transition shrink-0 cursor-pointer"
                            title={`Đi tiếp ${c.san}`}
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                          </button>
                          <span
                            onClick={() => onSelectMove(c.san)}
                            className="cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 truncate text-xs sm:text-sm font-black"
                          >
                            {c.san}
                          </span>
                        </div>
                      </td>

                      {/* Games Count */}
                      <td className="px-2.5 py-2.5 font-bold text-slate-700 dark:text-slate-300 text-xs">
                        {c.games_count}
                      </td>

                      {/* Frequency */}
                      <td className="px-2 py-2.5 text-slate-500 dark:text-slate-400 text-xs">
                        {c.usage_pct.toFixed(1)}%
                      </td>

                      {/* Result or Single Game Info */}
                      <td className="px-3 py-2.5">
                        {isSingle ? (
                          <div className="flex items-center justify-between gap-1 overflow-hidden">
                            <button
                              onClick={() => onLoadGame && onLoadGame(sg)}
                              className="inline-flex items-center gap-1 text-[11px] text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium truncate max-w-full cursor-pointer"
                              title="Nạp toàn bộ ván đấu này lên bàn cờ"
                            >
                              <Eye className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {sg.white} {sg.result} {sg.black}
                              </span>
                            </button>
                            {sg.link && (
                              <a
                                href={sg.link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-400 hover:text-emerald-500 p-0.5 rounded transition shrink-0"
                                title="Mở ván đấu gốc"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="wdl-bar h-2">
                              <div
                                className="wdl-bar-win"
                                style={{ width: `${c.win_pct}%` }}
                                title={`Thắng: ${c.win_pct.toFixed(1)}%`}
                              />
                              <div
                                className="wdl-bar-draw"
                                style={{ width: `${c.draw_pct}%` }}
                                title={`Hòa: ${c.draw_pct.toFixed(1)}%`}
                              />
                              <div
                                className="wdl-bar-loss"
                                style={{ width: `${c.loss_pct}%` }}
                                title={`Thua: ${c.loss_pct.toFixed(1)}%`}
                              />
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-400 font-mono leading-none">
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{c.win_pct.toFixed(0)}%</span>
                              <span>{c.draw_pct.toFixed(0)}%</span>
                              <span className="text-rose-600 dark:text-rose-400 font-semibold">{c.loss_pct.toFixed(0)}%</span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Score */}
                      <td className="px-3 py-2.5 text-right font-bold text-slate-900 dark:text-white">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${
                            c.score_pct >= 60
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : c.score_pct <= 40
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {c.score_pct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: CÂY CỦA MASTER DB (LICHESS MASTERS DATABASE) */}
      {/* ============================================================ */}
      {activeTab === "master" && (
        <div className="w-full overflow-hidden">
          {!isAuthorized ? (
            /* Prompt to Authorize */
            <div className="p-8 text-center space-y-3 bg-blue-50/20 dark:bg-blue-950/10">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-sm">
                <Globe className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cơ sở Dữ liệu Kiện tướng Thế giới (Master Database)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Xem toàn bộ các nước đi chuẩn lý thuyết, tỷ lệ thắng/hòa/thua từ hàng triệu ván đấu chính thức của các Đại kiện tướng quốc tế (GM / IM).
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <span>Ủy quyền Lichess để mở khóa Master DB</span>
                </button>
              </div>
            </div>
          ) : masterLoading ? (
            /* Skeleton Loading State */
            <div className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                <span>Đang tải biến thể Kiện tướng từ Lichess...</span>
              </div>
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
                ))}
              </div>
            </div>
          ) : masterMoves.length === 0 ? (
            /* Out of Book / No Master Games */
            <div className="py-12 text-center text-slate-400 text-xs space-y-1.5">
              <BookOpen className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                Thế cờ này không có ván đấu nào trong Cơ sở Dữ liệu Kiện tướng
              </p>
              <p className="text-[11px] text-slate-400">
                (Thế cờ đã đi ra ngoài sách lý thuyết khai cuộc / Out of book)
              </p>
            </div>
          ) : (
            /* Master Moves Table */
            <table className="w-full text-left text-xs table-fixed">
              <thead className="bg-blue-50/60 dark:bg-blue-950/30 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 text-[10px] sm:text-[11px]">
                <tr>
                  <th className="px-3 py-2.5 w-[18%]">Nước đi</th>
                  <th className="px-2.5 py-2.5 w-[16%]">Số ván</th>
                  <th className="px-2 py-2.5 w-[14%]">Tần suất</th>
                  <th className="px-3 py-2.5 w-[30%]">Tỷ lệ W/D/L</th>
                  <th className="px-2 py-2.5 text-right w-[11%]">Điểm số</th>
                  <th className="px-2.5 py-2.5 text-right w-[11%]">Elo TB</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {masterMoves.map((m, idx) => {
                  const usagePct = masterTotal > 0 ? (m.games_count / masterTotal) * 100 : 0;

                  return (
                    <tr
                      key={idx}
                      className="hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition group"
                    >
                      {/* Move SAN */}
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onSelectMove(m.san)}
                            className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition shrink-0 cursor-pointer"
                            title={`Đi tiếp ${m.san}`}
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                          </button>
                          <span
                            onClick={() => onSelectMove(m.san)}
                            className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 truncate text-xs sm:text-sm font-black"
                          >
                            {m.san}
                          </span>
                        </div>
                      </td>

                      {/* Games Count */}
                      <td className="px-2.5 py-2.5 font-bold text-slate-700 dark:text-slate-300 text-xs">
                        <span
                          title={`${formatFullNumber(m.games_count)} ván đấu`}
                          className="cursor-help"
                        >
                          {formatCompactNumber(m.games_count)}
                        </span>
                      </td>

                      {/* Frequency */}
                      <td className="px-2 py-2.5 text-slate-500 dark:text-slate-400 text-xs">
                        {usagePct.toFixed(1)}%
                      </td>

                      {/* W/D/L Visual Bar */}
                      <td className="px-3 py-2.5">
                        <div
                          className="space-y-0.5 cursor-help"
                          title={`Trắng thắng: ${m.win_pct}% (${formatFullNumber(m.white)})\nHòa: ${m.draw_pct}% (${formatFullNumber(m.draws)})\nĐen thắng: ${m.loss_pct}% (${formatFullNumber(m.black)})`}
                        >
                          <div className="wdl-bar h-2">
                            <div
                              className="wdl-bar-win"
                              style={{ width: `${m.win_pct}%` }}
                              title={`Trắng thắng: ${m.win_pct}%`}
                            />
                            <div
                              className="wdl-bar-draw"
                              style={{ width: `${m.draw_pct}%` }}
                              title={`Hòa: ${m.draw_pct}%`}
                            />
                            <div
                              className="wdl-bar-loss"
                              style={{ width: `${m.loss_pct}%` }}
                              title={`Đen thắng: ${m.loss_pct}%`}
                            />
                          </div>
                          <div className="flex justify-between text-[9px] text-slate-400 font-mono leading-none">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{m.win_pct}%</span>
                            <span>{m.draw_pct}%</span>
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">{m.loss_pct}%</span>
                          </div>
                        </div>
                      </td>

                      {/* Score % */}
                      <td className="px-2 py-2.5 text-right font-bold">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${
                            m.score_pct >= 55
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : m.score_pct <= 45
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {m.score_pct.toFixed(1)}%
                        </span>
                      </td>

                      {/* Average Rating */}
                      <td className="px-2.5 py-2.5 text-right text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                        {m.average_rating ? m.average_rating : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
