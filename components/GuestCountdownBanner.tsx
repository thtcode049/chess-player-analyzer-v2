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
import { isGuestModeActive } from "@/lib/auth/guest";

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

  // Check if current route is home or auth-related
  const isExcludedPage = useMemo(() => {
    return (
      pathname === "/" ||
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

  const hasActiveGuest = useMemo(() => {
    return mounted && isGuestModeActive();
  }, [mounted, pathname]);

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

  // Save guest creation timestamp whenever entering guest mode and not recorded yet
  useEffect(() => {
    if (typeof window !== "undefined" && !user && !isExcludedPage && isGuestModeActive()) {
      if (!sessionStorage.getItem("chess_guest_created_at")) {
        sessionStorage.setItem("chess_guest_created_at", new Date().toISOString());
      }
    }
  }, [user, isExcludedPage]);

  // Don't render if SSR, logged in, on excluded page, or not in guest mode
  if (!mounted || user || isExcludedPage || !hasActiveGuest) {
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
      className={`w-full border-b transition-colors relative z-40 ${
        isExpired
          ? "bg-rose-50 border-rose-200 text-rose-900"
          : isUrgent
          ? "bg-rose-50 border-rose-200 text-rose-900"
          : "bg-amber-50 border-amber-200 text-amber-900"
      }`}
    >
      <div className="max-w-[1720px] mx-auto px-3 sm:px-6 lg:px-8 2xl:px-10 py-1.5 sm:py-2 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 text-xs">
        {/* Left Side: Badge + Description */}
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start text-center sm:text-left">
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
              isUrgent
                ? "bg-rose-100 text-rose-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {isUrgent ? (
              <AlertTriangle className="w-3 h-3 animate-pulse" />
            ) : (
              <Clock className="w-3 h-3" />
            )}
            Phiên Khách 24H
          </span>

          <span className="font-medium text-foreground">
            {isExpired ? (
              <span className="text-rose-700 font-semibold">
                Dữ liệu lưu tạm 24h đã hết hạn và đang được dọn dẹp.
              </span>
            ) : guestPlayers.length === 0 ? (
              <span>
                Bạn đang ở chế độ khách. Dữ liệu tải lên sẽ tự động xóa sau:
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
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono tabular-nums font-bold text-xs ${
                isUrgent
                  ? "bg-rose-100 text-rose-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              <span>{formattedTime}</span>
            </div>
          )}
        </div>

        {/* Right Side: CTA Action Buttons + Collapse */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Đăng ký lưu vĩnh viễn</span>
          </Link>

          <Link
            href="/login"
            className="text-xs text-muted-foreground hover:text-foreground font-medium underline underline-offset-4 hidden md:inline transition-colors"
          >
            Đã có tài khoản? Đăng nhập
          </Link>

          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition cursor-pointer"
            title="Thu gọn thông báo"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
