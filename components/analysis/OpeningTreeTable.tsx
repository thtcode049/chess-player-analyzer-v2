"use client";

import React, { useEffect, useState } from "react";
import { Chess } from "chess.js";
import {
  OpeningContinuation,
  LichessMasterMove,
  LichessMasterTopGame,
  LichessGameDetail,
} from "@/lib/api/types";
import { apiClient } from "@/lib/api/client";
import {
  initiateLichessOAuth,
  getLichessAuth,
  disconnectLichessAuth,
} from "@/lib/auth/lichess";
import {
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
  Trophy,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { FigurineMove } from "@/components/chess/FigurineMove";

interface OpeningTreeTableProps {
  continuations: OpeningContinuation[];
  totalGames?: number;
  onSelectMove: (san: string) => void;
  onLoadGame?: (gameInfo: any) => void;
  currentFen?: string;
  playerName?: string;
  embedded?: boolean;
  players?: { id: string; canonical_name: string; total_games?: number }[];
  selectedPlayerId?: string;
  onSelectPlayer?: (playerId: string) => void;
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
  topGames: LichessMasterTopGame[];
  totalGames: number;
  opening?: { eco?: string; name?: string } | null;
}

// Extract 4-part EPD key from FEN (transposition-safe, ignoring move count)
function getEpdKey(fen: string): string {
  const parts = fen.trim().split(/\s+/);
  return parts.length >= 4 ? parts.slice(0, 4).join(" ") : fen.trim();
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
  embedded = false,
  players = [],
  selectedPlayerId,
  onSelectPlayer,
}: OpeningTreeTableProps) {
  const [activeTab, setActiveTab] = useState<"player" | "master">("player");
  const [masterMoves, setMasterMoves] = useState<LichessMasterMove[]>([]);
  const [masterTopGames, setMasterTopGames] = useState<LichessMasterTopGame[]>([]);
  const [masterTotal, setMasterTotal] = useState<number>(0);
  const [masterOpening, setMasterOpening] = useState<{ eco?: string; name?: string } | null>(null);
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterError, setMasterError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authUsername, setAuthUsername] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Top Master Game Loading state
  const [loadingGameId, setLoadingGameId] = useState<string | null>(null);

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
  const fetchMasterData = (fen: string, force = false) => {
    if (!fen) return;
    const cleanFen = fen.trim();
    const cacheKey = getEpdKey(cleanFen);
    const auth = refreshAuthStatus();

    if (!auth.isAuthorized) {
      setMasterMoves([]);
      setMasterTopGames([]);
      setMasterTotal(0);
      setMasterOpening(null);
      setMasterError(null);
      return;
    }

    // Check cache (only accept cache entries that have actual moves / games)
    if (!force && CLIENT_MASTERS_CACHE.has(cacheKey)) {
      const cached = CLIENT_MASTERS_CACHE.get(cacheKey)!;
      if (cached.moves.length > 0 || cached.totalGames > 0) {
        setMasterMoves(cached.moves);
        setMasterTopGames(cached.topGames || []);
        setMasterTotal(cached.totalGames);
        setMasterOpening(cached.opening || null);
        setMasterError(null);
        return;
      } else {
        CLIENT_MASTERS_CACHE.delete(cacheKey);
      }
    }

    setMasterLoading(true);
    setMasterError(null);

    apiClient
      .getLichessMasters(cleanFen, auth.token)
      .then((res) => {
        if (res && res.authenticated) {
          setIsAuthorized(true);
        }

        if (res && res.is_rate_limited) {
          setMasterError(
            res.message ||
              "Đang chạm giới hạn tần suất truy vấn Lichess (1 req/giây). Vui lòng chờ vài giây rồi bấm Thử lại."
          );
          return;
        }

        if (
          res &&
          ((res.moves && res.moves.length > 0) ||
            (res.top_games && res.top_games.length > 0) ||
            res.total_games > 0)
        ) {
          const moves = res.moves || [];
          const topGames = res.top_games || [];
          const total = res.total_games || 0;
          const opening = res.opening || null;
          CLIENT_MASTERS_CACHE.set(cacheKey, {
            moves,
            topGames,
            totalGames: total,
            opening,
          });
          setMasterMoves(moves);
          setMasterTopGames(topGames);
          setMasterTotal(total);
          setMasterOpening(opening);
          setMasterError(null);
        } else {
          // Out of book or empty response
          setMasterMoves([]);
          setMasterTopGames([]);
          setMasterTotal(0);
          setMasterOpening(null);
          if (res?.message) {
            setMasterError(res.message);
          } else {
            setMasterError(null);
          }
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch Lichess Master DB:", err);
        setMasterError(
          "Không thể kết nối đến Lichess Master Explorer. Vui lòng kiểm tra lại mạng."
        );
      })
      .finally(() => {
        setMasterLoading(false);
      });
  };

  useEffect(() => {
    fetchMasterData(currentFen);
  }, [currentFen]);

  // Handle clicking on a Master Game row (directly loads game onto the board)
  const handleLoadMasterGame = async (gameId: string) => {
    if (!gameId) return;
    try {
      setLoadingGameId(gameId);
      const fullGame = await apiClient.getLichessGame(gameId);
      if (onLoadGame && fullGame.moves && fullGame.moves.length > 0) {
        onLoadGame({
          id: fullGame.id,
          white: fullGame.white,
          white_elo: fullGame.white_elo,
          black: fullGame.black,
          black_elo: fullGame.black_elo,
          result: fullGame.result,
          moves: fullGame.moves,
          moves_san: fullGame.moves_san,
          eco: fullGame.eco,
          opening: fullGame.opening,
          event: fullGame.event,
          link: fullGame.site,
        });
      }
    } catch (err: any) {
      console.warn("Failed to load master game:", err);
    } finally {
      setLoadingGameId(null);
    }
  };

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
    setMasterTopGames([]);
    setMasterTotal(0);
    setMasterOpening(null);
    CLIENT_MASTERS_CACHE.clear();
    setShowAuthModal(false);
  };

  return (
    <div
      className={`w-full flex flex-col h-full overflow-hidden ${
        embedded
          ? "bg-transparent border-0 shadow-none rounded-none"
          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm"
      }`}
    >
      {/* Table Header Controls & Tab Selector */}
      <div className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-2 shrink-0">
        {/* Tab Toggle: Cây kì thủ vs Cây Master DB */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 dark:bg-slate-800/90 rounded-xl">
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "player"
                ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveTab("player")}
              className="flex items-center gap-1 cursor-pointer py-1"
              title="Xem cây khai cuộc của kỳ thủ"
            >
              <User className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
            </button>

            {players && players.length > 0 ? (
              <div className="relative flex items-center">
                <select
                  value={selectedPlayerId}
                  onChange={(e) => {
                    setActiveTab("player");
                    onSelectPlayer?.(e.target.value);
                  }}
                  className="bg-transparent font-bold text-xs text-inherit focus:outline-none cursor-pointer pr-3.5 appearance-none max-w-[110px] sm:max-w-[150px] truncate"
                  title="Chọn hồ sơ kỳ thủ"
                >
                  {players.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
                    >
                      {p.canonical_name} ({p.total_games || 0} ván)
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 absolute right-0 pointer-events-none opacity-60" />
              </div>
            ) : (
              <span
                onClick={() => setActiveTab("player")}
                className="cursor-pointer truncate max-w-[110px] sm:max-w-[160px] py-1"
              >
                {playerName || "Kì thủ"}
              </span>
            )}

            <button
              type="button"
              onClick={() => setActiveTab("player")}
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold transition cursor-pointer ml-0.5 ${
                activeTab === "player"
                  ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300"
                  : "bg-slate-300/60 dark:bg-slate-700/60 text-slate-500"
              }`}
              title={`${continuations.length} nước đi tiếp theo`}
            >
              {continuations.length}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab("master")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "master"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span>Master Database</span>
            {isAuthorized && masterTotal > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold transition ${
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
        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setShowAuthModal(true)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
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
                Ủy quyền
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
        <div className="flex-1 min-h-0 overflow-y-auto w-full">
          <table className="w-full text-left text-xs table-fixed">
            <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 text-[10px] sm:text-[11px]">
              <tr>
                <th className="px-3 py-2 w-[20%]">Nước đi</th>
                <th className="px-2.5 py-2 w-[15%]">Số ván</th>
                <th className="px-2 py-2 w-[15%]">Tần suất</th>
                <th className="px-3 py-2 w-[35%]">Tỷ lệ W/D/L</th>
                <th className="px-3 py-2 text-right w-[15%]">Điểm số</th>
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
                      onClick={() => onSelectMove(c.san)}
                      className="hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition cursor-pointer select-none group"
                    >
                      {/* Move SAN */}
                      <td className="px-3 py-1.5 font-normal text-slate-900 dark:text-white">
                        <span className="truncate text-[15px] font-normal group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                          <FigurineMove san={c.san} />
                        </span>
                      </td>

                      {/* Games Count */}
                      <td className="px-2.5 py-1.5 font-bold text-slate-700 dark:text-slate-300 text-xs">
                        {c.games_count}
                      </td>

                      {/* Frequency */}
                      <td className="px-2 py-1.5 text-slate-500 dark:text-slate-400 text-xs">
                        {c.usage_pct.toFixed(1)}%
                      </td>

                      {/* Result or Single Game Info */}
                      <td className="px-3 py-2.5">
                        {isSingle ? (
                          <div
                            className="flex items-center justify-between gap-1 overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
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
        <div className="flex-1 min-h-0 overflow-y-auto w-full flex flex-col">
          {!isAuthorized ? (
            /* Prompt to Authorize */
            <div className="p-8 text-center space-y-3 bg-blue-50/20 dark:bg-blue-950/10 my-auto">
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
          ) : masterLoading && masterMoves.length === 0 && masterTopGames.length === 0 ? (
            /* Skeleton Loading State only on initial fetch */
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
          ) : masterError ? (
            /* Rate limit or API error card with retry button */
            <div className="py-10 px-6 text-center space-y-3 my-auto">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {masterError}
                </p>
                <p className="text-[11px] text-slate-400">
                  Lichess giới hạn tần suất 1 yêu cầu/giây. Bạn có thể bấm nút bên dưới để thử lại.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fetchMasterData(currentFen, true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử lại ngay</span>
              </button>
            </div>
          ) : masterMoves.length === 0 && masterTopGames.length === 0 ? (
            /* Out of Book / No Master Games */
            <div className="py-12 text-center text-slate-400 text-xs space-y-1.5 my-auto">
              <BookOpen className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="font-semibold text-slate-600 dark:text-slate-300">
                Thế cờ này không có ván đấu nào trong Cơ sở Dữ liệu Kiện tướng
              </p>
              <p className="text-[11px] text-slate-400">
                (Thế cờ đã đi ra ngoài sách lý thuyết khai cuộc / Out of book)
              </p>
            </div>
          ) : (
            <div className="space-y-0 relative flex-1 flex flex-col">
              {/* Subtle top progress bar when updating in background */}
              {masterLoading && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-400 to-blue-500 animate-pulse z-30 pointer-events-none" />
              )}

              {/* Lichess Opening Name Banner (like Lichess) */}
              {masterOpening && (masterOpening.name || masterOpening.eco) && (
                <div className="px-3 py-1 bg-emerald-500/10 dark:bg-emerald-950/40 border-b border-emerald-500/20 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 shrink-0 sticky top-0 z-20 backdrop-blur-xs">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">
                    {masterOpening.eco ? `${masterOpening.eco}: ` : ""}{masterOpening.name}
                  </span>
                </div>
              )}

              {/* Master Moves Table */}
              {masterMoves.length > 0 && (
                <table className="w-full text-left text-xs table-fixed">
                  <thead className={`bg-blue-50/95 dark:bg-slate-900/95 backdrop-blur-xs text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 text-[10px] sm:text-[11px] sticky z-10 ${masterOpening && (masterOpening.name || masterOpening.eco) ? "top-[27px]" : "top-0"}`}>
                    <tr>
                      <th className="px-3 py-2 w-[18%]">Nước đi</th>
                      <th className="px-2.5 py-2 w-[16%]">Số ván</th>
                      <th className="px-2 py-2 w-[14%]">Tần suất</th>
                      <th className="px-3 py-2 w-[30%]">Tỷ lệ W/D/L</th>
                      <th className="px-2 py-2 text-right w-[11%]">Điểm số</th>
                      <th className="px-2.5 py-2 text-right w-[11%]">Elo TB</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {masterMoves.map((m, idx) => {
                      const usagePct = masterTotal > 0 ? (m.games_count / masterTotal) * 100 : 0;

                      return (
                        <tr
                          key={idx}
                          onClick={() => onSelectMove(m.san)}
                          className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition cursor-pointer select-none group"
                        >
                          {/* Move SAN */}
                          <td className="px-3 py-1.5 font-normal text-slate-900 dark:text-white">
                            <span className="truncate text-[15px] font-normal group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                              <FigurineMove san={m.san} />
                            </span>
                          </td>

                          {/* Games Count */}
                          <td className="px-2.5 py-1.5 font-bold text-slate-700 dark:text-slate-300 text-xs">
                            <span
                              title={`${formatFullNumber(m.games_count)} ván đấu`}
                              className="cursor-help"
                            >
                              {formatCompactNumber(m.games_count)}
                            </span>
                          </td>

                          {/* Frequency */}
                          <td className="px-2 py-1.5 text-slate-500 dark:text-slate-400 text-xs">
                            {usagePct.toFixed(1)}%
                          </td>

                          {/* W/D/L Visual Bar */}
                          <td className="px-3 py-2">
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
                          <td className="px-2 py-2 text-right font-bold">
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
                          <td className="px-2.5 py-2 text-right text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                            {m.average_rating ? m.average_rating : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Summary Row (Σ like Lichess) */}
              {masterMoves.length > 0 && masterTotal > 0 && (
                <div className="px-3.5 py-1.5 bg-slate-100/70 dark:bg-slate-800/60 border-t border-b border-slate-200/70 dark:border-slate-800 text-xs flex items-center justify-between font-mono font-bold text-slate-600 dark:text-slate-300 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-slate-400">Σ</span>
                    <span className="text-[11px]">100% {formatCompactNumber(masterTotal)} ván</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-normal">
                    {masterMoves.length} biến thể
                  </div>
                </div>
              )}

              {/* SECTION: CÁC VÁN ĐẤU HÀNG ĐẦU (TOP MASTER GAMES LIKE LICHESS) */}
              <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 shrink-0">
                <div className="sticky top-0 z-10 px-3.5 py-1.5 border-b border-slate-200/80 dark:border-slate-800 bg-emerald-50/90 dark:bg-emerald-950/80 backdrop-blur-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Các ván đấu hàng đầu
                    </span>
                    {masterTopGames.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        {masterTopGames.length}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
                    Bấm vào ván để nạp lên bàn cờ
                  </span>
                </div>

                {masterTopGames.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    Không có ván đấu tiêu biểu nào được ghi nhận cho thế cờ này.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {masterTopGames.map((g, idx) => {
                      const isLoadingThis = loadingGameId === g.id;
                      const resBadgeClass =
                        g.result === "1-0"
                          ? "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                          : g.result === "0-1"
                          ? "bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-100"
                          : "bg-slate-300/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

                      return (
                        <div
                          key={g.id || idx}
                          onClick={() => handleLoadMasterGame(g.id)}
                          className="flex items-center justify-between px-3.5 py-2 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition cursor-pointer select-none group"
                          title="Bấm để nạp ván đấu này lên bàn cờ"
                        >
                          {/* Players & Ratings (2 Lines like Lichess) */}
                          <div className="flex flex-col gap-0.5 min-w-0 pr-3">
                            <div className="flex items-center gap-1.5 text-xs text-slate-900 dark:text-white truncate">
                              <span className="font-mono text-slate-500 dark:text-slate-400 font-bold text-[11px] w-9 shrink-0">
                                {g.white.rating || "—"}
                              </span>
                              <span className="truncate font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                                {g.white.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-900 dark:text-white truncate">
                              <span className="font-mono text-slate-500 dark:text-slate-400 font-bold text-[11px] w-9 shrink-0">
                                {g.black.rating || "—"}
                              </span>
                              <span className="truncate font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                                {g.black.name}
                              </span>
                            </div>
                          </div>

                          {/* Result, Date & Actions */}
                          <div className="flex items-center gap-3 shrink-0">
                            {/* Result Badge */}
                            <span
                              className={`px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold ${resBadgeClass}`}
                            >
                              {g.result}
                            </span>

                            {/* Date */}
                            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 w-16 text-right hidden sm:inline">
                              {g.month || g.year || "—"}
                            </span>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5 min-w-6 justify-end">
                              {isLoadingThis ? (
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                              ) : (
                                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition hidden sm:inline">
                                  Nạp ván →
                                </span>
                              )}
                              {g.id && (
                                <a
                                  href={`https://lichess.org/${g.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-100/50 dark:hover:bg-blue-900/40 transition shrink-0"
                                  title="Mở ván đấu gốc trên Lichess"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}


    </div>
  );
}
