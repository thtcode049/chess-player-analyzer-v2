"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  BarChart3, 
  Users, 
  Brain, 
  UploadCloud, 
  LayoutDashboard, 
  Sun, 
  Moon, 
  Swords 
} from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { User, LogOut, LogIn, UserPlus, Settings } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

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

    // Check user auth state
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
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
    { href: "/players", label: "Kỳ thủ & Hồ sơ", icon: Users },
    { href: "/analyze", label: "Bàn cờ Phân tích", icon: Swords },
    { href: "/ai-coach", label: "Trợ lí AI", icon: Brain },
    { href: "/import", label: "Nạp ván đấu", icon: UploadCloud },
    { href: "/settings", label: "Cài đặt", icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
            <span className="text-xl">♟</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">
                Chess Analyzer
              </span>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                V2
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
              AI Strategic Coaching & Player Analytics
            </p>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 font-semibold"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-border/40">
              <div className="flex items-center gap-2 bg-card border border-border/60 py-1.5 px-3 rounded-xl text-xs font-semibold text-foreground">
                <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
                  {user.email ? user.email[0].toUpperCase() : "U"}
                </div>
                <span className="max-w-[100px] truncate hidden sm:inline-block">
                  {user.user_metadata?.display_name || user.email?.split("@")[0]}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 pl-2 border-l border-border/40">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-foreground hover:bg-card border border-transparent hover:border-border/60 transition"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Đăng Nhập</span>
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Đăng Ký</span>
              </Link>
            </div>
          )}

          <Link
            href="/import"
            className="hidden lg:inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <UploadCloud className="h-3.5 h-3.5" />
            <span>Nạp Ván</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
