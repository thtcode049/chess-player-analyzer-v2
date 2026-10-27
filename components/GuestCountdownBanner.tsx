"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock,
  AlertTriangle,
  Save,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfileWorkspaceStore } from "@/lib/stores/profileWorkspaceStore";

export default function GuestCountdownBanner() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [now, setNow] = useState<number>(Date.now());

  const { players } = useProfileWorkspaceStore();
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user || null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check if current route is auth-related
  const isAuthPage = useMemo(() => {
    return (
      pathname?.startsWith("/login") ||
      pathname?.startsWith("/register") ||
      pathname?.startsWith("/auth")
    );
  }, [pathname]);

  // Guest players
  const guestPlayers = useMemo(() => {
    return players.filter(
      (p) => p.is_guest || p.user_id === "guest" || (p.notes && p.notes.includes("guest:"))
    );
  }, [players]);

  // Calculate target expiration timestamp (24 hours from creation)
  const targetExpiryMs = useMemo(() => {
    if (guestPlayers.length > 0) {
      let earliest = Infinity;
      for (const p of guestPlayers) {
        if (p.expires_at) {
          const exp = new Date(p.expires_at).getTime();
          if (!isNaN(exp) && exp < earliest) earliest = exp;
        } else if (p.created_at) {
          const c = new Date(p.created_at).getTime();
          if (!isNaN(c)) {
            const exp = c + 24 * 60 * 60 * 1000;
            if (exp < earliest) earliest = exp;
          }
        }
      }
      if (earliest !== Infinity) return earliest;
    }

    // Fallback: check sessionStorage created_at
    if (typeof window !== "undefined") {
      const sessionCreated = sessionStorage.getItem("chess_guest_created_at");
      if (sessionCreated) {
        const c = new Date(sessionCreated).getTime();
        if (!isNaN(c)) return c + 24 * 60 * 60 * 1000;
      }
    }

    return null;
  }, [guestPlayers]);

  // Save guest creation timestamp if guest data exists and not recorded yet
  useEffect(() => {
    if (typeof window !== "undefined" && guestPlayers.length > 0) {
      if (!sessionStorage.getItem("chess_guest_created_at")) {
        sessionStorage.setItem("chess_guest_created_at", new Date().toISOString());
      }
    }
  }, [guestPlayers]);

  // Don't render if SSR, logged in, on auth page, or no guest data
  if (!mounted || user || isAuthPage) {
    return null;
  }

  // Only show the banner if the guest has imported or created at least 1 player
  if (guestPlayers.length === 0 && !targetExpiryMs) {
    return null;
  }

  const effectiveExpiry = targetExpiryMs || (now + 24 * 60 * 60 * 1000);
  const remainingMs = Math.max(0, effectiveExpiry - now);

  const hours = Math.floor(remainingMs / 3600000);
  const minutes = Math.floor((remainingMs % 3600000) / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);

  const pad = (n: number) => n.toString().padStart(2, "0");
  const formattedTime = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  const isUrgent = hours < 6 && remainingMs > 0;
  const isExpired = remainingMs <= 0;

  if (isCollapsed) {
    return (
      <div className="fixed bottom-16 right-4 sm:bottom-6 sm:right-6 z-50 animate-fade-in">
        <button
          onClick={() => setIsCollapsed(false)}
          className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg border text-xs font-semibold backdrop-blur-md transition-all ${
            isUrgent
              ? "bg-rose-500/90 hover:bg-rose-600 text-white border-rose-400/50 animate-pulse"
              : "bg-amber-500/90 hover:bg-amber-600 text-slate-900 border-amber-400/50"
          }`}
          title="Mở rộng thông báo phiên khách"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Phiên khách: {formattedTime}</span>
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Thông báo phiên khách"
      className={`w-full border-b transition-colors duration-300 relative z-40 backdrop-blur-md ${
        isExpired
          ? "bg-rose-500/15 border-rose-500/30 text-rose-950 dark:text-rose-200"
          : isUrgent
          ? "bg-gradient-to-r from-rose-500/15 via-orange-500/10 to-rose-500/15 border-rose-500/40 text-rose-950 dark:text-rose-200"
          : "bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/15 border-amber-500/30 text-amber-950 dark:text-amber-100"
      }`}
    >
      <div className="max-w-[1720px] mx-auto px-3 sm:px-6 lg:px-8 2xl:px-10 py-2 sm:py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 text-xs sm:text-sm">
        {/* Left Side: Badge + Description */}
        <div className="flex items-center gap-2.5 flex-wrap justify-center sm:justify-start text-center sm:text-left">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase shadow-xs ${
              isUrgent
                ? "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40"
                : "bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/40"
            }`}
          >
            {isUrgent ? (
              <AlertTriangle className="w-3 h-3 animate-pulse" />
            ) : (
              <Clock className="w-3 h-3" />
            )}
            Phiên Khách 24H
          </span>

          <span className="font-medium text-slate-800 dark:text-slate-200">
            {isExpired ? (
              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                Dữ liệu lưu tạm 24h đã hết hạn và đang được dọn dẹp.
              </span>
            ) : (
              <span>
                Dữ liệu ván đấu và phân tích sẽ tự động xóa sau:
              </span>
            )}
          </span>

          {/* Countdown Clock Pill */}
          {!isExpired && (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-mono font-bold text-xs sm:text-sm shadow-xs ${
                isUrgent
                  ? "bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/50 animate-pulse"
                  : "bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/40"
              }`}
            >
              <span>{formattedTime}</span>
            </div>
          )}
        </div>

        {/* Right Side: CTA Action Buttons + Collapse */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-medium text-xs sm:text-sm shadow-sm transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Đăng ký để lưu vĩnh viễn</span>
          </Link>

          <Link
            href="/login"
            className="text-xs text-muted-foreground hover:text-foreground font-medium underline underline-offset-4 hidden md:inline transition-colors"
          >
            Đã có tài khoản? Đăng nhập
          </Link>

          <button
            onClick={() => setIsCollapsed(true)}
            aria-label="Thu gọn banner"
            className="p-1 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Thu gọn banner"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
