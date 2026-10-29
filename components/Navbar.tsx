"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  User,
  Brain,
  UploadCloud,
  Sun,
  Moon,
  Swords,
  Settings,
  LogOut,
  LogIn,
  UserPlus,
  Menu,
  X,
  ChevronDown,
  Search,
  Check,
  FolderOpen,
  Layers,
  ArrowRight,
  Loader2
} from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api/client";
import ChessLookLogo from "@/components/ChessLookLogo";
import { useProfileWorkspaceStore, ColorRole } from "@/lib/stores/profileWorkspaceStore";

function UserAvatar({ url, name }: { url?: string | null; name: string }) {
  const [hasError, setHasError] = useState(false);

  if (url && !hasError) {
    return (
      <img
        src={url}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className="w-6 h-6 rounded-full object-cover ring-1 ring-emerald-500/40 shrink-0 shadow-xs"
      />
    );
  }

  return (
    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold shrink-0">
      {name ? name.trim()[0].toUpperCase() : "U"}
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [switcherSearch, setSwitcherSearch] = useState("");
  const [switcherMode, setSwitcherMode] = useState<"single" | "multi">("single");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    players,
    activeMode,
    activePlayerId,
    activePlayer,
    activePlayerGames,
    multiProfiles,
    setMultiProfileRole,
    selectSingleProfile,
    openMatchupBoard,
    isMatchupLoading,
    openSandboxBoard,
    activeTab,
    setActiveTab,
    isHubOpen,
    openHub,
    closeHub,
    refreshPlayersList,
  } = useProfileWorkspaceStore();

  useEffect(() => {
    // Check initial theme
    if (typeof window !== "undefined") {
      const isDarkMode =
        localStorage.getItem("theme") === "dark" ||
        (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);
      setIsDark(isDarkMode);
      if (isDarkMode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }

    setMobileMenuOpen(false);

    const checkAndClaimGuest = async (userId: string) => {
      if (typeof window === "undefined") return;
      const guestId = sessionStorage.getItem("chess_guest_session_id");
      if (guestId) {
        try {
          const res = await apiClient.claimGuestData(guestId);
          if (res && res.claimed > 0) {
            sessionStorage.removeItem("chess_guest_session_id");
            sessionStorage.removeItem("chess_guest_created_at");
            await refreshPlayersList();
          }
        } catch (e) {
          console.warn("Could not claim guest session data:", e);
        }
      }
    };

    // Check user auth state
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null);
      if (data.user?.id) {
        checkAndClaimGuest(data.user.id);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user?.id) {
        checkAndClaimGuest(session.user.id);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [pathname, refreshPlayersList]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    if (profileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [profileDropdownOpen]);

  // Keep switcherMode in sync with activeMode
  useEffect(() => {
    if (activeMode === "multi") {
      setSwitcherMode("multi");
    } else if (activeMode === "single") {
      setSwitcherMode("single");
    }
  }, [activeMode]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    setUser(null);
    setMobileMenuOpen(false);

    // Dọn dẹp triệt để localStorage và sessionStorage để tránh rò rỉ dữ liệu sang trạng thái khách
    try {
      localStorage.removeItem("lichess_token");
      localStorage.removeItem("lichess_username");
      localStorage.removeItem("setting_lichess_user");
      localStorage.removeItem("setting_chesscom_user");
      sessionStorage.removeItem("lichess_token");
      sessionStorage.removeItem("lichess_username");
      sessionStorage.removeItem("chess_guest_session_id");
    } catch {}

    window.location.href = "/login";
  };

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const isSingleProfileLoading = Boolean(activeMode === "single" && activePlayerId && !activePlayer);

  // Compute Active Profile Switcher Label
  const profileLabel = useMemo(() => {
    if (activeMode === "multi") {
      const whiteCount = multiProfiles.filter((m) => m.role === "white" || m.role === "both").length;
      const blackCount = multiProfiles.filter((m) => m.role === "black" || m.role === "both").length;
      return `Đa hồ sơ: ${whiteCount}⚪ vs ${blackCount}⚫`;
    }
    if (activeMode === "sandbox") {
      return "Bàn cờ Tự do (Master DB)";
    }
    if (activePlayer) {
      const gCount = activePlayerGames.length || activePlayer.total_games || 0;
      return `${activePlayer.canonical_name} (${gCount} ván)`;
    }
    if (activePlayerId) {
      return "Đang tải hồ sơ...";
    }
    return "Chọn hồ sơ kỳ thủ";
  }, [activeMode, activePlayer, activePlayerId, activePlayerGames, multiProfiles]);

  // Filtered players inside dropdown
  const filteredDropdownPlayers = useMemo(() => {
    if (!switcherSearch.trim()) return players;
    const q = switcherSearch.toLowerCase().trim();
    return players.filter((p) => p.canonical_name?.toLowerCase().includes(q));
  }, [players, switcherSearch]);

  // Check if current active route is within the unified workspace
  const isWorkspacePath = useCallback((p: string | null | undefined): boolean => {
    if (!p) return false;
    return (
      p === "/dashboard" ||
      p === "/analyze" ||
      p === "/ai-coach" ||
      p === "/players" ||
      p.startsWith("/players/")
    );
  }, []);

  const isWorkspace = useMemo(() => {
    const current = typeof window !== "undefined" ? window.location.pathname : pathname;
    return isWorkspacePath(pathname) && isWorkspacePath(current);
  }, [pathname, isWorkspacePath]);

  const handleExternalNav = useCallback((href: string) => {
    setMobileMenuOpen(false);
    setProfileDropdownOpen(false);
    window.location.href = href;
  }, []);

  // Hub click handler (Thư viện)
  const handleOpenHub = () => {
    openHub();
    setMobileMenuOpen(false);
    if (!isWorkspace) {
      window.location.href = "/players";
    } else if (typeof window !== "undefined" && window.location.pathname !== "/players" && window.location.pathname !== "/dashboard") {
      window.history.pushState(null, "", "/dashboard");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  // Tab click handler (Preserve active player context across tabs)
  const handleNavTab = (tab: "profile" | "board" | "ai") => {
    setMobileMenuOpen(false);

    setActiveTab(tab);
    closeHub();

    const querySuffix =
      activeMode === "single" && activePlayerId
        ? `?playerId=${encodeURIComponent(activePlayerId)}`
        : "";

    const basePath = tab === "profile" ? "/dashboard" : tab === "board" ? "/analyze" : "/ai-coach";
    const targetPath = `${basePath}${querySuffix}`;

    if (!isWorkspace) {
      window.location.href = targetPath;
    } else if (typeof window !== "undefined") {
      const currentFull = window.location.pathname + window.location.search;
      if (currentFull !== targetPath) {
        window.history.pushState(null, "", targetPath);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md transition-colors shadow-2xs">
      <div className="w-full max-w-[1720px] mx-auto flex h-16 items-center justify-between px-3 sm:px-6 lg:px-8 2xl:px-10 gap-2 sm:gap-4">
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-3">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleExternalNav("/");
            }}
            className="flex items-center transition hover:opacity-90 cursor-pointer"
            title="Trang chủ ChessLook"
          >
            <ChessLookLogo size="md" />
          </a>
        </div>

        {/* Center: Profile Switcher Dropdown + Core Workspace Tabs */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-center max-w-3xl">
          {/* Active Profile Switcher Dropdown Button */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs font-bold transition-all border shadow-2xs ${
                activeMode === "multi"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20"
                  : activeMode === "sandbox"
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                  : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-300/80 dark:border-emerald-700/60 hover:border-emerald-500"
              }`}
              title="Nhấp để đổi nhanh kỳ thủ hoặc bật chế độ ghép Trắng/Đen"
            >
              <div className="flex items-center gap-1.5 truncate max-w-[140px] sm:max-w-[210px] md:max-w-[250px]">
                {activeMode === "multi" ? (
                  <Swords className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : isSingleProfileLoading ? (
                  <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin shrink-0" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                )}
                <span className="truncate">{profileLabel}</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0 ${
                  profileDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Profile Switcher Dropdown Content */}
            {profileDropdownOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mt-2 w-[calc(100vw-24px)] max-w-[360px] sm:max-w-[380px] rounded-xl bg-card border border-border/80 shadow-xl p-3 space-y-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                {/* Switcher Mode Tabs */}
                <div className="grid grid-cols-2 p-1 bg-muted/70 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setSwitcherMode("single")}
                    className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      switcherMode === "single"
                        ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Đơn hồ sơ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSwitcherMode("multi")}
                    className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      switcherMode === "multi"
                        ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span>Chế độ Đa hồ sơ</span>
                    {multiProfiles.length > 0 && (
                      <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] flex items-center justify-center font-bold">
                        {multiProfiles.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Search Bar inside Dropdown */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={switcherSearch}
                    onChange={(e) => setSwitcherSearch(e.target.value)}
                    placeholder="Tìm nhanh kỳ thủ..."
                    className="w-full bg-background border border-border/70 rounded-xl pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    autoFocus
                  />
                </div>

                {/* Mode Content */}
                {switcherMode === "single" ? (
                  /* Single Profile Switcher (1-click, NO role circles) */
                  <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-0.5">
                      Chuyển Nhanh Kỳ Thủ (1 Click)
                    </div>
                    {filteredDropdownPlayers.length === 0 ? (
                      <div className="text-center py-4 text-xs text-muted-foreground">
                        Không tìm thấy kỳ thủ phù hợp
                      </div>
                    ) : (
                      filteredDropdownPlayers.map((p) => {
                        const isSelected = activeMode === "single" && activePlayer?.id === p.id;

                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              selectSingleProfile(p.id, activeTab);
                              setProfileDropdownOpen(false);
                              const basePath = activeTab === "board" ? "/analyze" : activeTab === "ai" ? "/ai-coach" : "/dashboard";
                              const targetPath = `${basePath}?playerId=${encodeURIComponent(p.id)}`;
                              if (!isWorkspace) {
                                window.location.href = targetPath;
                              } else if (typeof window !== "undefined") {
                                const currentFull = window.location.pathname + window.location.search;
                                if (currentFull !== targetPath) {
                                  window.history.pushState(null, "", targetPath);
                                  window.dispatchEvent(new PopStateEvent("popstate"));
                                }
                              }
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-xl transition text-left cursor-pointer ${
                              isSelected
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30"
                                : "hover:bg-muted text-foreground border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate min-w-0">
                              <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-black shrink-0">
                                {p.canonical_name ? p.canonical_name[0].toUpperCase() : "P"}
                              </span>
                              <span className="truncate text-xs">{p.canonical_name}</span>
                              {p.title && (
                                <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                                  {p.title}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              {p.total_games ? (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {p.total_games} ván
                                </span>
                              ) : null}
                              {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : (
                  /* Multi-profile Matchup Setup */
                  <div className="space-y-2">
                    <div className="px-2 py-0.5">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Ghép Đấu Đa Hồ Sơ (Matchup)
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Gán màu quân cho từng kỳ thủ để phân tích đối đầu:
                      </div>
                    </div>

                    <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                      {filteredDropdownPlayers.length === 0 ? (
                        <div className="text-center py-4 text-xs text-muted-foreground">
                          Không tìm thấy kỳ thủ phù hợp
                        </div>
                      ) : (
                        filteredDropdownPlayers.map((p) => {
                          const multiItem = multiProfiles.find((m) => m.player.id === p.id);
                          const currentRole = multiItem?.role;

                          return (
                            <div
                              key={p.id}
                              className={`flex items-center justify-between p-2 rounded-xl transition ${
                                currentRole
                                  ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30 font-bold"
                                  : "hover:bg-muted text-foreground border border-transparent"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate min-w-0 mr-2">
                                <span className="w-5 h-5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-black shrink-0">
                                  {p.canonical_name ? p.canonical_name[0].toUpperCase() : "P"}
                                </span>
                                <span className="truncate text-xs">{p.canonical_name}</span>
                                {p.title && (
                                  <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                                    {p.title}
                                  </span>
                                )}
                              </div>

                              {/* Role assignment buttons */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMultiProfileRole(p, currentRole === "white" ? null : "white");
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition border cursor-pointer ${
                                    currentRole === "white"
                                      ? "bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-100 ring-2 ring-emerald-500 shadow-2xs"
                                      : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/60"
                                  }`}
                                  title="Gán Cầm Trắng (⚪)"
                                >
                                  ⚪
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMultiProfileRole(p, currentRole === "black" ? null : "black");
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition border cursor-pointer ${
                                    currentRole === "black"
                                      ? "bg-slate-900 text-white border-slate-700 dark:bg-slate-950 dark:text-white dark:border-slate-600 ring-2 ring-emerald-500 shadow-2xs"
                                      : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/60"
                                  }`}
                                  title="Gán Cầm Đen (⚫)"
                                >
                                  ⚫
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMultiProfileRole(p, currentRole === "both" ? null : "both");
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition border cursor-pointer ${
                                    currentRole === "both"
                                      ? "bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-400 shadow-2xs"
                                      : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/60"
                                  }`}
                                  title="Gán Cả Hai Bên (⚪⚫)"
                                >
                                  ⚪⚫
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Matchup Apply button */}
                    <div className="pt-2 border-t border-border/60">
                      <button
                        type="button"
                        disabled={multiProfiles.length === 0 || isMatchupLoading}
                        onClick={async () => {
                          await openMatchupBoard();
                          setProfileDropdownOpen(false);
                          if (!isWorkspace) {
                            window.location.href = "/analyze";
                          }
                        }}
                        className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold shadow-xs transition ${
                          multiProfiles.length > 0 && !isMatchupLoading
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                            : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                        }`}
                      >
                        {isMatchupLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                            <span>Đang nạp tổ hợp & mở bàn cờ...</span>
                          </>
                        ) : (
                          <>
                            <Swords className="w-3.5 h-3.5" />
                            <span>
                              {multiProfiles.length > 0
                                ? `Áp Dụng Tổ Hợp Đa Hồ Sơ (${multiProfiles.length})`
                                : "Chọn ít nhất 1 kỳ thủ"}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Footer Actions inside Dropdown */}
                <div className="pt-2 border-t border-border/60 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      openSandboxBoard();
                      setProfileDropdownOpen(false);
                      if (!isWorkspace) {
                        window.location.href = "/analyze";
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-muted hover:text-foreground transition cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-sky-500" />
                    <span>Chế độ Bàn cờ Tự do (Master DB / Sandbox)</span>
                  </button>

                  <a
                    href="/import"
                    onClick={(e) => {
                      e.preventDefault();
                      handleExternalNav("/import");
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-muted hover:text-foreground transition cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-teal-500" />
                    <span>+ Tạo / Nạp hồ sơ mới</span>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Desktop & iPad Workspace Segmented Navigation Pills */}
          <nav className="hidden md:flex items-center gap-0.5 sm:gap-1 bg-slate-100/90 dark:bg-slate-800/80 p-0.5 sm:p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
            {/* Tab 0: Thư viện (Quản lý tất cả hồ sơ) */}
            <button
              type="button"
              onClick={handleOpenHub}
              className={`relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                isWorkspace && isHubOpen
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs ring-1 ring-slate-200/50 dark:ring-slate-600/50"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/40"
              }`}
              title="Quản lý và xem tất cả hồ sơ kỳ thủ (Thư viện)"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>Thư viện</span>
            </button>

            {/* Tab 1: Hồ sơ & Ván đấu */}
            <button
              type="button"
              onClick={() => handleNavTab("profile")}
              className={`relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                isWorkspace && activeTab === "profile" && !isHubOpen
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs ring-1 ring-slate-200/50 dark:ring-slate-600/50"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/40"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Hồ sơ & Ván đấu</span>
            </button>

            {/* Tab 2: Bàn cờ Phân tích */}
            <button
              type="button"
              onClick={() => handleNavTab("board")}
              className={`relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                isWorkspace && activeTab === "board" && !isHubOpen
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs ring-1 ring-slate-200/50 dark:ring-slate-600/50"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/40"
              }`}
            >
              <Swords className="h-3.5 w-3.5" />
              <span>Bàn cờ & Khai cuộc</span>
            </button>

            {/* Tab 3: Trợ lí AI */}
            <button
              type="button"
              onClick={() => handleNavTab("ai")}
              className={`relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                isWorkspace && activeTab === "ai" && !isHubOpen
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs ring-1 ring-slate-200/50 dark:ring-slate-600/50"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/40"
              }`}
            >
              <Brain className="h-3.5 w-3.5" />
              <span>Trợ lí AI</span>
              <span className="px-1.5 py-0.2 rounded-md text-[9px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                AI
              </span>
            </button>
          </nav>
        </div>

        {/* Right Controls: Theme + User + Nạp Ván */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="h-4.5 w-4.5 text-amber-400" /> : <Moon className="h-4.5 w-4.5 text-slate-600" />}
          </button>

          {user ? (
            (() => {
              const displayName =
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                user.user_metadata?.display_name ||
                user.email?.split("@")[0] ||
                "Kỳ thủ";
              const avatarUrl =
                user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

              return (
                <div className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/90 py-1.5 px-2.5 sm:px-3 rounded-lg text-xs font-semibold text-foreground shadow-2xs">
                    <UserAvatar url={avatarUrl} name={displayName} />
                    <span className="max-w-[100px] sm:max-w-[140px] truncate hidden sm:inline-block font-semibold">
                      {displayName}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="hidden sm:inline-flex p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                    title="Đăng xuất"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              );
            })()
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
              <a
                href="/login"
                onClick={(e) => {
                  e.preventDefault();
                  handleExternalNav("/login");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng Nhập</span>
              </a>
              <a
                href="/register"
                onClick={(e) => {
                  e.preventDefault();
                  handleExternalNav("/register");
                }}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Đăng Ký</span>
              </a>
            </div>
          )}

          {/* Primary CTA + Nạp Ván */}
          <a
            href="/import"
            onClick={(e) => {
              e.preventDefault();
              handleExternalNav("/import");
            }}
            className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer ${
              pathname === "/import"
                ? "bg-emerald-700 dark:bg-emerald-600 text-white ring-2 ring-emerald-400/50"
                : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
            }`}
          >
            <UploadCloud className="h-3.5 w-3.5" />
            <span>+ Nạp Ván</span>
          </a>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition focus:outline-none"
            aria-label="Mở menu điều hướng"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 py-4 space-y-3 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-1">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                handleExternalNav("/");
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                pathname === "/"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <ChessLookLogo size="sm" />
                <span>Trang chủ</span>
              </div>
            </a>

            <button
              type="button"
              onClick={handleOpenHub}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold transition ${
                isWorkspace && isHubOpen
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <FolderOpen className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Thư viện hồ sơ</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleNavTab("profile")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold transition ${
                isWorkspace && activeTab === "profile" && !isHubOpen
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Hồ sơ & Ván đấu</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleNavTab("board")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold transition ${
                isWorkspace && activeTab === "board" && !isHubOpen
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Swords className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Bàn cờ Phân tích</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleNavTab("ai")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold transition ${
                isWorkspace && activeTab === "ai" && !isHubOpen
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Brain className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Trợ lí AI</span>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                AI
              </span>
            </button>

            <a
              href="/import"
              onClick={(e) => {
                e.preventDefault();
                handleExternalNav("/import");
              }}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-teal-500 shrink-0" />
              <span>+ Nạp Ván Đấu</span>
            </a>

            <a
              href="/settings"
              onClick={(e) => {
                e.preventDefault();
                handleExternalNav("/settings");
              }}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Cài đặt</span>
            </a>
          </div>

          {/* User section on Mobile Drawer */}
          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
            {user ? (
              <div className="flex items-center justify-between px-2 py-1">
                <div className="flex items-center gap-2.5">
                  <UserAvatar
                    url={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                    name={user.user_metadata?.full_name || user.email || "Kỳ thủ"}
                  />
                  <div className="text-xs">
                    <div className="font-bold text-foreground truncate max-w-[180px]">
                      {user.user_metadata?.full_name || user.email?.split("@")[0] || "Kỳ thủ"}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                      {user.email}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-500/10 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Thoát</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href="/login"
                  onClick={(e) => {
                    e.preventDefault();
                    handleExternalNav("/login");
                  }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Đăng Nhập</span>
                </a>
                <a
                  href="/register"
                  onClick={(e) => {
                    e.preventDefault();
                    handleExternalNav("/register");
                  }}
                  className="flex items-center justify-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold shadow-xs hover:bg-emerald-500 transition cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Đăng Ký</span>
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
