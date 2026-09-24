"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { 
  Brain, 
  ArrowRight, 
  Sparkles, 
  BookOpen,
  Target,
  Upload,
  Activity,
  CheckCircle2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LandingPage() {
  const [user, setUser] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user || null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const displayName = 
    user?.user_metadata?.full_name || 
    user?.user_metadata?.name || 
    user?.user_metadata?.display_name || 
    user?.email?.split("@")[0] || 
    "Kỳ thủ";

  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-16 text-center animate-fade-in">
      {/* Glow Effect Background */}
      <div className="relative max-w-5xl mx-auto flex flex-col items-center">
        <div className="absolute top-1/3 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Official Brand Logo Mark */}
        <div className="mb-5 flex items-center justify-center">
          <div className="p-3.5 rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-emerald-500/10 backdrop-blur-md transition-transform duration-300 hover:scale-105">
            <img src="/logo.png" alt="ChessLook Logo" className="w-16 h-16 sm:w-20 sm:h-20 object-contain filter drop-shadow-md" />
          </div>
        </div>

        {/* Brand Pill Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-6 backdrop-blur-sm">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
          <span>ChessLook • Nền Tảng Phân Tích & Cố Vấn Cờ Vua Thông Minh</span>
        </div>

        {/* Main Hero Title */}
        <h1 className="text-4xl sm:text-6xl font-black text-slate-900 dark:text-white tracking-tight max-w-4xl leading-[1.15]">
          Làm Chủ Bàn Cờ Với{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300">
            Trí Tuệ Phân Tích Chuyên Sâu
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
          Chuyển hóa dữ liệu ván đấu thô từ Lichess và Chess.com thành cây khai cuộc trực quan, 
          radar 8 chiều phong cách, phân tích cấu trúc Tốt và bản tham mưu chiến thuật cá nhân hóa cùng AI.
        </p>

        {/* Dual Primary CTA Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-emerald-600/25 transition-all duration-200 text-base group"
          >
            <span>{isMounted && user ? "Vào Bảng Điều Khiển" : "Khám Phá Bảng Điều Khiển"}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/import"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 font-bold px-7 py-3.5 rounded-xl transition-all duration-200 text-base shadow-sm"
          >
            <Upload className="w-4 h-4 text-emerald-500" />
            <span>Nhập Ván Đấu Của Bạn</span>
          </Link>
        </div>

        {/* Helper Links */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 min-h-[22px]">
          {isMounted && user ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Chào mừng trở lại, <strong className="font-semibold text-slate-700 dark:text-slate-200">{displayName}</strong>!
              </span>
              <span>•</span>
              <Link href="/players" className="text-slate-600 dark:text-slate-300 font-medium hover:underline">
                Xem Thư Viện Kỳ Thủ
              </Link>
            </>
          ) : isMounted ? (
            <>
              <span>Đã có tài khoản?</span>
              <Link href="/login" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
                Đăng nhập ngay
              </Link>
              <span>•</span>
              <Link href="/players" className="text-slate-600 dark:text-slate-300 font-medium hover:underline">
                Xem Thư Viện Kỳ Thủ
              </Link>
            </>
          ) : (
            <Link href="/players" className="text-slate-600 dark:text-slate-300 font-medium hover:underline">
              Xem Thư Viện Kỳ Thủ
            </Link>
          )}
        </div>

        {/* Feature Highlights Banner */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Tích hợp Stockfish 17 thế hệ mới</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Nhận diện chống chuyển vị nước đi</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Trợ lý AI Cố vấn chiến lược 24/7</span>
          </div>
        </div>
      </div>

      {/* 4 Player-Centric Pillars Grid */}
      <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full text-left max-w-7xl">
        {/* Pillar 1: Openings */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 p-6 rounded-2xl shadow-sm hover:border-emerald-500/40 hover:shadow-md transition-all duration-300 group">
          <div className="p-3 w-fit rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
            Bóc Tách Lỗ Hổng Khai Cuộc
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Phân tích toàn diện mọi biến thể bạn từng thi đấu. Theo dõi tỷ lệ Thắng/Hòa/Thua và phát hiện ngay những nhánh cờ khiến bạn hay rơi vào thế bị động.
          </p>
        </div>

        {/* Pillar 2: Blunders & ACPL */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 p-6 rounded-2xl shadow-sm hover:border-sky-500/40 hover:shadow-md transition-all duration-300 group">
          <div className="p-3 w-fit rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 mb-4 group-hover:scale-110 transition-transform">
            <Target className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
            Đo Lường Điểm Mù & ACPL
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Tính toán chi tiết sai số trung bình (ACPL) qua từng giai đoạn Khai cuộc, Trung cuộc và Tàn cuộc để xác định chính xác thời điểm bạn đánh mất lợi thế.
          </p>
        </div>

        {/* Pillar 3: Style Radar & Pawn Structures */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 p-6 rounded-2xl shadow-sm hover:border-purple-500/40 hover:shadow-md transition-all duration-300 group">
          <div className="p-3 w-fit rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 mb-4 group-hover:scale-110 transition-transform">
            <Activity className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
            Radar Phong Cách 8 Chiều
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Khắc họa chân dung phong cách: độ chủ động, sắc bén chiến thuật, kỹ năng tàn cuộc và hiệu suất thi đấu trên các cấu trúc Tốt điển hình.
          </p>
        </div>

        {/* Pillar 4: AI Coach */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 p-6 rounded-2xl shadow-sm hover:border-amber-500/40 hover:shadow-md transition-all duration-300 group">
          <div className="p-3 w-fit rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-4 group-hover:scale-110 transition-transform">
            <Brain className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
            Cố Vấn Chiến Lược AI
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Nhận bản báo cáo phân tích chiến thuật tự động, chuẩn bị phương án đối đầu với bất kỳ đối thủ nào và đàm thoại chiến thuật trực tiếp cùng AI.
          </p>
        </div>
      </div>

      {/* Bottom Call to Action Card */}
      <div className="mt-20 w-full max-w-5xl bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-slate-900/60 border border-emerald-500/20 rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden shadow-xl">
        <div className="relative z-10 space-y-4">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Sẵn Sàng Làm Chủ Bàn Cờ & Bứt Phá Trình Độ?
          </h2>
          <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
            Nhập các ván đấu gần đây của bạn từ Lichess hoặc Chess.com để nhận hồ sơ phân tích toàn diện chỉ trong vài giây.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/import"
              className="inline-flex items-center gap-2 px-7 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition text-sm"
            >
              <Upload className="w-4 h-4" />
              <span>Bắt Đầu Nhập Ván Đấu</span>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold rounded-xl border border-slate-700 transition text-sm"
            >
              <span>{isMounted && user ? "Vào Bảng Điều Khiển" : "Xem Demo Bảng Điều Khiển"}</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
