"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail, ArrowRight, Loader2, User } from "lucide-react";
import { enterGuestMode, exitGuestMode } from "@/lib/auth/guest";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const oauthError = searchParams?.get("error");
    if (oauthError) {
      setError("Đăng nhập Google thất bại hoặc bạn đã hủy thao tác. Vui lòng thử lại.");
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      // Check and claim any guest session data into newly authenticated account
      try {
        const guestId = sessionStorage.getItem("chess_guest_session_id");
        if (guestId) {
          const { apiClient } = await import("@/lib/api/client");
          await apiClient.claimGuestData(guestId);
        }
      } catch (e) {
        console.warn("Could not claim guest session on login:", e);
      } finally {
        exitGuestMode();
      }

      window.location.href = "/dashboard";
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.toLowerCase().includes("email not confirmed")) {
        setError("Tài khoản này chưa được kích hoạt qua email. Vui lòng kiểm tra hộp thư (bao gồm cả mục Thư rác/Spam) và nhấp vào liên kết xác nhận từ hệ thống.");
      } else if (msg.toLowerCase().includes("invalid login credentials")) {
        setError("Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.");
      } else {
        setError(msg || "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const redirectUrl = typeof window !== "undefined" 
        ? `${window.location.origin}/auth/callback?next=/dashboard` 
        : "/auth/callback?next=/dashboard";

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) throw error;
    } catch (err: any) {
      console.error("[Google Login] Error:", err);
      setError(err.message || "Không thể kết nối đến máy chủ xác thực Google. Vui lòng thử lại sau.");
      setGoogleLoading(false);
    }
  };

  const handleDemoLogin = () => {
    // Generate clean guest session, sync cookies and storage, and enter dashboard
    enterGuestMode();
    router.push("/dashboard");
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 animate-fade-in">
      <div className="w-[calc(100vw_-_2rem)] max-w-md bg-card rounded-surface p-6 sm:p-7 shadow-md space-y-5 relative">
        {/* Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 mb-1">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            Đăng Nhập Tài Khoản
          </h1>
          <p className="text-xs text-muted-foreground">
            Truy cập hệ thống phân tích đại kiện tướng và kho dữ liệu ván đấu.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-xs leading-relaxed animate-fade-in">
            {error}
          </div>
        )}

        {/* Google Sign-in Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
          className="w-full py-2 px-3 bg-background border border-border/80 hover:bg-muted/50 text-foreground font-medium rounded transition-colors flex items-center justify-center gap-2.5 text-xs"
        >
          {googleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>Đăng nhập với Google</span>
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/40" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-card px-2 text-muted-foreground font-medium">Hoặc tiếp tục với email</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-3.5 text-sm">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Địa Chỉ Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="grandmaster@chess.com"
                className="w-full bg-background border border-border/60 rounded pl-9 pr-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Mật Khẩu
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-background border border-border/60 rounded pl-9 pr-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-xs sm:text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang xác thực...
              </>
            ) : (
              <>
                Đăng Nhập
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/40" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-card px-2 text-muted-foreground font-medium">Khám phá nhanh</span>
          </div>
        </div>

        {/* Demo Fast Access Button */}
        <button
          type="button"
          onClick={handleDemoLogin}
          className="w-full py-2 px-3 bg-secondary text-secondary-foreground hover:bg-muted font-medium rounded transition-colors flex items-center justify-center gap-2 text-xs border border-border/50"
        >
          <User className="w-3.5 h-3.5 text-emerald-700" />
          Vào Trực Tiếp (Chế Độ Khách / Guest)
        </button>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pt-1">
          Chưa có tài khoản?{" "}
          <Link href="/register" className="text-emerald-700 font-semibold hover:underline">
            Đăng ký miễn phí
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[75vh] flex items-center justify-center p-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
