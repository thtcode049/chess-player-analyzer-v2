"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, Mail, Lock, User, ArrowRight, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successEmail, setSuccessEmail] = useState("");
  const [immediateLogin, setImmediateLogin] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      // 1. Kiểm tra tính hợp lệ sâu của Email (DNS MX Records, format, quy tắc Gmail, disposable email)
      const valRes = await fetch("/api/validate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const valData = await valRes.json().catch(() => ({}));
      if (!valRes.ok || valData.valid === false) {
        throw new Error(valData.message || "Địa chỉ email không hợp lệ hoặc không có máy chủ nhận thư.");
      }

      // 2. Gọi Supabase Auth SignUp
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { display_name: displayName.trim() },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      setSuccessEmail(cleanEmail);

      if (data.session) {
        // Trường hợp Supabase tắt Confirm Email: đăng nhập và chuyển hướng ngay
        setImmediateLogin(true);
        setSuccess(true);
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 1200);
      } else {
        // Trường hợp Supabase bật Confirm Email: bắt buộc kiểm tra email để kích hoạt
        setImmediateLogin(false);
        setSuccess(true);
      }
    } catch (err: any) {
      console.error("[Register] Error:", err);
      setError(err.message || "Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.");
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
        ? `${window.location.origin}/auth/callback` 
        : "/auth/callback";

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) throw error;
    } catch (err: any) {
      console.error("[Google SignUp] Error:", err);
      setError(err.message || "Không thể kết nối đến máy chủ xác thực Google. Vui lòng thử lại sau.");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md bg-card border border-border/80 rounded-3xl p-8 shadow-2xl space-y-6 relative overflow-hidden backdrop-blur-xl">
        <div className="absolute -left-16 -top-16 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-1">
            <UserPlus className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Tạo Tài Khoản Mới
          </h1>
          <p className="text-xs text-muted-foreground">
            Bắt đầu phân tích kỳ thủ chuyên sâu hoàn toàn miễn phí.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-xs leading-relaxed flex items-start gap-2.5 animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          immediateLogin ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-500 text-xs flex items-center gap-3 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>Đăng ký thành công! Đang chuyển hướng đến bảng điều khiển...</span>
            </div>
          ) : (
            <div className="p-5 bg-sky-500/10 border border-sky-500/30 rounded-2xl space-y-3 animate-fade-in">
              <div className="flex items-center gap-2.5 text-sky-500 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span>Yêu cầu đăng ký đã được ghi nhận!</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Hệ thống đã gửi liên kết xác thực đến địa chỉ:{" "}
                <strong className="text-foreground">{successEmail}</strong>.
              </p>
              <div className="p-3 bg-background/80 rounded-xl border border-border/60 text-[11px] text-muted-foreground leading-relaxed">
                ⚠️ <strong className="text-foreground">Lưu ý quan trọng:</strong> Bạn bắt buộc phải mở hộp thư email (kiểm tra cả mục <strong>Thư rác / Spam</strong>) và nhấp vào liên kết xác nhận thì tài khoản mới được kích hoạt để đăng nhập.
              </div>
              <Link
                href="/login"
                className="w-full py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 text-xs shadow-md shadow-primary/20"
              >
                <span>Đi đến trang Đăng nhập</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )
        ) : (
          <>
            {/* Google Sign-in Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
              className="w-full py-2.5 px-4 bg-background border border-border/80 hover:bg-muted/50 text-foreground font-semibold rounded-xl transition-all flex items-center justify-center gap-3 text-xs shadow-sm hover:shadow"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
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
              <span>Đăng ký nhanh với Google</span>
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/40" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-card px-3 text-muted-foreground font-semibold">Hoặc đăng ký bằng email</span>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleRegister} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Họ &amp; Tên / Biệt Danh
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full bg-background border border-border/60 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Địa Chỉ Email Chính Thức
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="grandmaster@gmail.com"
                    className="w-full bg-background border border-border/60 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Vui lòng dùng email có thực để nhận liên kết xác thực kích hoạt tài khoản.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Mật Khẩu (Tối thiểu 6 ký tự)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-background border border-border/60 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full py-3 px-6 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-primary/20 text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang kiểm tra &amp; khởi tạo tài khoản...
                  </>
                ) : (
                  <>
                    Đăng Ký Tài Khoản
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pt-2">
          Đã có tài khoản?{" "}
          <Link href="/login" className="text-primary font-bold hover:underline">
            Đăng nhập ngay
          </Link>
        </p>
      </div>
    </div>
  );
}
