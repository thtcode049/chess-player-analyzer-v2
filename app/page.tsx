"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { 
  Brain, 
  ArrowRight, 
  BarChart3, 
  BookOpen,
  Target,
  Upload,
  Layers,
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
    <div className="flex flex-col items-center justify-center py-6 sm:py-16 text-center animate-fade-in px-2 sm:px-4">
      {/* Official Brand Logo Mark */}
      <div className="relative max-w-5xl mx-auto flex flex-col items-center">
        <div className="mb-4 sm:mb-5 flex items-center justify-center">
          <div className="p-3 sm:p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 shadow-md backdrop-blur-md transition-transform duration-300 hover:scale-105">
            <img src="/logo.png" alt="ChessLook Logo" className="w-14 h-14 sm:w-20 sm:h-20 object-contain filter drop-shadow-md" />
          </div>
        </div>

        {/* Brand Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-4 sm:mb-6 backdrop-blur-sm max-w-full text-center">
          <BarChart3 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="truncate">ChessLook • Nền Tảng Phân Tích Dữ Liệu Ván Đấu & Hỗ Trợ Kỳ Thủ</span>
        </div>

        {/* Main Hero Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight max-w-4xl leading-[1.2] sm:leading-[1.15] px-2 sm:px-0">
          Làm Chủ Bàn Cờ Với{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300">
            Trí Tuệ Phân Tích Chuyên Sâu
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-4 sm:mt-6 text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed px-3 sm:px-0">
          Chuyển hóa dữ liệu ván đấu thô từ Lichess và Chess.com thành cây khai cuộc trực quan, 
          phân tích cấu trúc Tốt, đánh giá động cơ Stockfish 19 và tương tác trực quan cùng Trợ lí AI.
        </p>

        {/* Dual Primary CTA Buttons */}
        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto px-4 sm:px-0">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl shadow-lg shadow-emerald-600/25 transition-all duration-200 text-sm sm:text-base group active:scale-95"
          >
            <span>{isMounted && user ? "Vào Bảng Điều Khiển" : "Khám Phá Bảng Điều Khiển"}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/import"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 font-bold px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl transition-all duration-200 text-sm sm:text-base shadow-sm active:scale-95"
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
            <span>Tích hợp Stockfish 19 thế hệ mới</span>
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
      <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full text-left max-w-[1720px]">
        {/* Pillar 1: Openings */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 p-6 rounded-xl shadow-sm hover:border-emerald-500/40 hover:shadow-md transition-all duration-300 group">
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

        {/* Pillar 2: Engine & Masters Database */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 p-6 rounded-xl shadow-sm hover:border-sky-500/40 hover:shadow-md transition-all duration-300 group">
          <div className="p-3 w-fit rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 mb-4 group-hover:scale-110 transition-transform">
            <Target className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
            Động Cơ Stockfish 19 & Masters DB
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Đánh giá thế cờ trực tiếp thời gian thực với Stockfish 19 Web Worker và đối chiếu các nước đi đỉnh cao từ cơ sở dữ liệu Đại kiện tướng Lichess Masters.
          </p>
        </div>

        {/* Pillar 3: Pawn Structures Performance */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 p-6 rounded-xl shadow-sm hover:border-emerald-500/40 hover:shadow-md transition-all duration-300 group">
          <div className="p-3 w-fit rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
            Phân Tích Cấu Trúc Tốt
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Nhận diện thế trận Tốt kinh điển (IQP, Carlsbad, Tốt treo, Cấu trúc Pháp, Nhím) và đánh giá độ chênh lệch hiệu suất điểm số thực tế.
          </p>
        </div>

        {/* Pillar 4: AI Assistant */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 p-6 rounded-xl shadow-sm hover:border-teal-500/40 hover:shadow-md transition-all duration-300 group">
          <div className="p-3 w-fit rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 mb-4 group-hover:scale-110 transition-transform">
            <Brain className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
            Trợ Lí AI Phân Tích
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Tương tác trực tiếp trên bàn cờ, đọc hiểu biên bản PGN và giải thích ý tưởng đằng sau các nước cờ bằng ngôn ngữ cờ vua tự nhiên.
          </p>
        </div>
      </div>

      {/* Bottom Call to Action Card */}
      <div className="mt-20 w-full max-w-5xl bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-slate-900/60 border border-emerald-500/20 rounded-xl p-8 sm:p-12 text-center relative overflow-hidden shadow-xl">
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
