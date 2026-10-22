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
  Sparkles,
  Layers,
  ArrowRight
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
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
    activePlayer,
    activePlayerGames,
    multiProfiles,
    setMultiProfileRole,
    selectSingleProfile,
    openMatchupBoard,
    openSandboxBoard,
    activeTab,
    setActiveTab,
    isHubOpen,
    openHub,
    closeHub,
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

    // Check user auth state
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [pathname]);

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
    await supabase.auth.signOut();
    setUser(null);
    setMobileMenuOpen(false);
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
    return "Chọn hồ sơ kỳ thủ";
  }, [activeMode, activePlayer, activePlayerGames, multiProfiles]);

  // Filtered players inside dropdown
  const filteredDropdownPlayers = useMemo(() => {
    if (!switcherSearch.trim()) return players;
    const q = switcherSearch.toLowerCase().trim();
    return players.filter((p) => p.canonical_name?.toLowerCase().includes(q));
  }, [players, switcherSearch]);

  // Tab click handler
  const handleNavTab = (tab: "profile" | "board" | "ai") => {
    setActiveTab(tab);
    closeHub();
    setMobileMenuOpen(false);

    // Synchronize shallow route without unmounting
    const targetPath = tab === "profile" ? "/dashboard" : tab === "board" ? "/analyze" : "/ai-coach";
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, "", targetPath);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md transition-colors shadow-2xs">
      <div className="w-full max-w-[1720px] mx-auto flex h-16 items-center justify-between px-3 sm:px-6 lg:px-8 2xl:px-10 gap-2 sm:gap-4">
        {/* Left: Brand Logo & Profile Hub trigger */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              openHub();
              if (window.location.pathname !== "/dashboard") {
                window.history.pushState(null, "", "/dashboard");
              }
            }}
            className="flex items-center transition hover:opacity-90 cursor-pointer"
            title="Quay lại Thư viện Hồ sơ Kỳ thủ"
          >
            <ChessLookLogo size="md" />
          </button>
        </div>

        {/* Center: Profile Switcher Dropdown + Core Workspace Tabs */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-center max-w-3xl">
          {/* Active Profile Switcher Dropdown Button */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl text-xs font-bold transition-all border shadow-xs ${
                activeMode === "multi"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20"
                  : activeMode === "sandbox"
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-200"
                  : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-300/80 dark:border-emerald-700/60 hover:border-emerald-500"
              }`}
              title="Nhấp để đổi nhanh kỳ thủ hoặc bật chế độ ghép Trắng/Đen"
            >
              <div className="flex items-center gap-1.5 truncate max-w-[140px] sm:max-w-[210px] md:max-w-[250px]">
                {activeMode === "multi" ? (
                  <Swords className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
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
              <div className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mt-2 w-[340px] sm:w-[380px] rounded-3xl bg-card border border-border/80 shadow-2xl p-3 space-y-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
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
                                      ? "bg-white text-slate-900 border-white ring-2 ring-emerald-500 shadow-2xs"
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
                                      ? "bg-slate-900 text-white border-slate-700 ring-2 ring-emerald-500 shadow-2xs"
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
                        disabled={multiProfiles.length === 0}
                        onClick={() => {
                          openMatchupBoard();
                          setProfileDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold shadow-xs transition ${
                          multiProfiles.length > 0
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                            : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                        }`}
                      >
                        <Swords className="w-3.5 h-3.5" />
                        <span>
                          {multiProfiles.length > 0
                            ? `Áp Dụng Tổ Hợp Đa Hồ Sơ (${multiProfiles.length})`
                            : "Chọn ít nhất 1 kỳ thủ"}
                        </span>
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
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-muted hover:text-foreground transition cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-sky-500" />
                    <span>Chế độ Bàn cờ Tự do (Master DB / Sandbox)</span>
                  </button>

                  <Link
                    href="/import"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-muted hover:text-foreground transition cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-teal-500" />
                    <span>+ Tạo / Nạp hồ sơ mới</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Workspace Segmented Navigation Pills */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
            {/* Tab 0: Thư viện (Quản lý tất cả hồ sơ) */}
            <button
              type="button"
              onClick={() => {
                openHub();
                if (window.location.pathname !== "/dashboard") {
                  window.history.pushState(null, "", "/dashboard");
                }
              }}
              className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isHubOpen
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
              className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "profile" && !isHubOpen
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
              className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "board" && !isHubOpen
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
              className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "ai" && !isHubOpen
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs ring-1 ring-slate-200/50 dark:ring-slate-600/50"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/40"
              }`}
            >
              <Brain className="h-3.5 w-3.5" />
              <span>Trợ lí AI</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                AI
              </span>
            </button>
          </nav>
        </div>

        {/* Right Controls: Theme + User + Nạp Ván */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
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
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/90 py-1.5 px-2.5 sm:px-3 rounded-2xl text-xs font-semibold text-foreground shadow-xs">
                    <UserAvatar url={avatarUrl} name={displayName} />
                    <span className="max-w-[100px] sm:max-w-[140px] truncate hidden sm:inline-block font-semibold">
                      {displayName}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="hidden sm:inline-flex p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                    title="Đăng xuất"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              );
            })()
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng Nhập</span>
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Đăng Ký</span>
              </Link>
            </div>
          )}

          {/* Primary CTA + Nạp Ván */}
          <Link
            href="/import"
            className="hidden lg:inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs transition"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            <span>+ Nạp Ván</span>
          </Link>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition focus:outline-none"
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
            <button
              type="button"
              onClick={() => {
                openHub();
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                isHubOpen
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <FolderOpen className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>📁 Thư viện hồ sơ</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleNavTab("profile")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeTab === "profile" && !isHubOpen
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>📊 Hồ sơ & Ván đấu</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleNavTab("board")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeTab === "board" && !isHubOpen
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Swords className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>♟️ Bàn cờ Phân tích</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleNavTab("ai")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeTab === "ai" && !isHubOpen
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Brain className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>🤖 Trợ lí AI</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                AI
              </span>
            </button>

            <Link
              href="/import"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            >
              <UploadCloud className="w-4 h-4 text-teal-500 shrink-0" />
              <span>+ Nạp Ván Đấu</span>
            </Link>

            <Link
              href="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            >
              <Settings className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Cài đặt</span>
            </Link>
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-500/10 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Thoát</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Đăng Nhập</span>
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-xs hover:bg-emerald-500 transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Đăng Ký</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
