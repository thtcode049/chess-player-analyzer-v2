"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Users, 
  Brain, 
  UploadCloud, 
  LayoutDashboard, 
  Sun, 
  Moon, 
  Swords,
  Settings,
  LogOut,
  LogIn,
  UserPlus,
  Menu,
  X
} from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import ChessLookLogo from "@/components/ChessLookLogo";

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
  const [isDark, setIsDark] = useState(false);
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Check initial theme
    if (typeof window !== "undefined") {
      const isDarkMode = localStorage.getItem("theme") === "dark" || 
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

  const navLinks = [
    { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
    { href: "/players", label: "Hồ sơ kỳ thủ", icon: Users },
    { href: "/analyze", label: "Bàn cờ Phân tích", icon: Swords },
    { href: "/ai-coach", label: "Trợ lí AI", icon: Brain, badge: "AI" },
    { href: "/import", label: "Nạp ván đấu", icon: UploadCloud },
    { href: "/settings", label: "Cài đặt", icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-3 sm:px-6 lg:px-8">
        {/* ChessLook Brand Logo */}
        <Link href="/dashboard" className="flex items-center">
          <ChessLookLogo size="md" />
        </Link>

        {/* Desktop Segmented Navigation Pills */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/60 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700/50">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/40"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{link.label}</span>
                {link.badge && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Controls */}
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
                user.user_metadata?.avatar_url || 
                user.user_metadata?.picture || 
                null;

              return (
                <div className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/90 py-1.5 px-2.5 sm:px-3 rounded-2xl text-xs font-semibold text-foreground shadow-xs">
                    <UserAvatar url={avatarUrl} name={displayName} />
                    <span className="max-w-[100px] sm:max-w-[150px] truncate hidden sm:inline-block font-semibold">
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

          <Link
            href="/import"
            className="hidden lg:inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs transition"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            <span>Nạp Ván</span>
          </Link>

          {/* Mobile Hamburger Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition focus:outline-none"
            aria-label="Mở menu điều hướng"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 py-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 shadow-xl">
          <div className="space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                    isActive
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{link.label}</span>
                  </div>
                  {link.badge && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* User Section in Mobile Drawer */}
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
