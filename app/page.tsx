"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  Brain, 
  ArrowRight, 
  BarChart3, 
  BookOpen, 
  Target, 
  Upload, 
  Layers, 
  CheckCircle2,
  LogIn,
  User,
  Clock,
  Sparkles
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { enterGuestMode, isGuestModeActive } from "@/lib/auth/guest";

export default function LandingPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setIsGuest(isGuestModeActive());
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

  const handleEnterGuest = () => {
    enterGuestMode();
    setIsGuest(true);
    router.push("/dashboard");
  };

  const displayName = 
    user?.user_metadata?.full_name || 
    user?.user_metadata?.name || 
    user?.user_metadata?.display_name || 
    user?.email?.split("@")[0] || 
    "Kỳ thủ";

  return (
    <div className="flex flex-col items-center justify-center py-6 sm:py-14 text-center animate-fade-in px-2 sm:px-4">
      {/* Official Brand Logo Mark */}
      <div className="relative w-full max-w-5xl mx-auto flex flex-col items-center">
        <div className="mb-4 sm:mb-5 flex items-center justify-center">
          <img src="/logo.png" alt="ChessLook Logo" className="w-16 h-16 sm:w-20 sm:h-20 object-contain" />
        </div>

        {/* Brand Pill Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 mb-4 sm:mb-6 max-w-full text-center">
          <BarChart3 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="truncate">ChessLook • Nền tảng Phân tích Dữ liệu Ván đấu & Hỗ trợ Kỳ thủ</span>
        </div>

        {/* Main Hero Title */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight max-w-4xl leading-[1.2] sm:leading-[1.15] px-2 sm:px-0">
          Làm Chủ Bàn Cờ Với Trí Tuệ Phân Tích Chuyên Sâu
        </h1>

        {/* Subtitle */}
        <p className="mt-4 sm:mt-5 text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed px-3 sm:px-0">
          Chuyển hóa dữ liệu ván đấu thô từ Lichess và Chess.com thành cây khai cuộc trực quan, 
          phân tích cấu trúc Tốt, đánh giá động cơ Stockfish 19 và tương tác trực quan cùng Trợ lí AI.
        </p>

        {/* Dual Primary Actions: Đăng nhập vs Chế độ khách (khi chưa đăng nhập) */}
        <div className="mt-6 sm:mt-7 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto px-4 sm:px-0">
          {isMounted && user ? (
            <>
              <Link
                href="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-2.5 rounded text-sm transition-colors group shadow-xs"
              >
                <span>Vào Bảng Điều Khiển</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/import"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-card border border-border text-foreground hover:bg-muted font-semibold px-6 py-2.5 rounded text-sm transition-colors shadow-xs"
              >
                <Upload className="w-4 h-4 text-emerald-500" />
                <span>Nhập Ván Đấu Của Bạn</span>
              </Link>
            </>
          ) : isMounted && isGuest ? (
            <>
              <Link
                href="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-2.5 rounded text-sm transition-colors group shadow-xs"
              >
                <span>Tiếp Tục Bảng Điều Khiển</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-card border border-border text-foreground hover:bg-muted font-semibold px-6 py-2.5 rounded text-sm transition-colors shadow-xs"
              >
                <LogIn className="w-4 h-4 text-emerald-600" />
                <span>Đăng Nhập Tài Khoản</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-2.5 rounded text-sm transition-colors group shadow-xs"
              >
                <LogIn className="w-4 h-4" />
                <span>Đăng Nhập Tài Khoản</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <button
                type="button"
                onClick={handleEnterGuest}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-card border border-border text-foreground hover:bg-muted font-semibold px-6 py-2.5 rounded text-sm transition-colors shadow-xs cursor-pointer"
              >
                <User className="w-4 h-4 text-emerald-600" />
                <span>Vào Chế Độ Khách</span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 ml-0.5">24H</span>
              </button>
            </>
          )}
        </div>

        {/* Helper Links & Account Status */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 text-xs text-muted-foreground min-h-[22px]">
          {isMounted && user ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Chào mừng trở lại, <strong className="font-semibold text-foreground">{displayName}</strong>!
              </span>
              <span>•</span>
              <Link href="/players" className="text-muted-foreground hover:text-foreground font-medium hover:underline">
                Xem Thư Viện Kỳ Thủ
              </Link>
            </>
          ) : isMounted && isGuest ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                <Clock className="w-3 h-3 text-amber-600" />
                Đang trong phiên khách (Dữ liệu tạm 24h)
              </span>
              <span>•</span>
              <Link href="/register" className="text-emerald-700 font-semibold hover:underline">
                Đăng ký tài khoản để lưu vĩnh viễn
              </Link>
            </>
          ) : (
            <>
              <span>Chưa có tài khoản?</span>
              <Link href="/register" className="text-emerald-700 font-semibold hover:underline">
                Đăng ký miễn phí
              </Link>
              <span>•</span>
              <span className="text-muted-foreground">Không cần thẻ tín dụng, trải nghiệm tức thì</span>
            </>
          )}
        </div>

        {/* Feature Highlights Banner */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-5 text-xs font-medium text-muted-foreground">
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
      <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 w-full text-left max-w-[1720px]">
        {/* Pillar 1: Openings */}
        <div className="bg-card border border-border p-5 rounded-surface hover:border-emerald-500/40 transition-colors">
          <div className="p-2.5 w-fit rounded bg-muted text-emerald-700 mb-3">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-foreground mb-1.5">
            Bóc Tách Lỗ Hổng Khai Cuộc
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Phân tích toàn diện mọi biến thể bạn từng thi đấu. Theo dõi tỷ lệ Thắng/Hòa/Thua và phát hiện ngay những nhánh cờ khiến bạn hay rơi vào thế bị động.
          </p>
        </div>

        {/* Pillar 2: Engine & Masters Database */}
        <div className="bg-card border border-border p-5 rounded-surface hover:border-emerald-500/40 transition-colors">
          <div className="p-2.5 w-fit rounded bg-muted text-sky-700 mb-3">
            <Target className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-foreground mb-1.5">
            Động Cơ Stockfish 19 & Masters DB
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Đánh giá thế cờ trực tiếp thời gian thực với Stockfish 19 Web Worker và đối chiếu các nước đi đỉnh cao từ cơ sở dữ liệu Đại kiện tướng Lichess Masters.
          </p>
        </div>

        {/* Pillar 3: Pawn Structures Performance */}
        <div className="bg-card border border-border p-5 rounded-surface hover:border-emerald-500/40 transition-colors">
          <div className="p-2.5 w-fit rounded bg-muted text-emerald-700 mb-3">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-foreground mb-1.5">
            Phân Tích Cấu Trúc Tốt
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Nhận diện thế trận Tốt kinh điển (IQP, Carlsbad, Tốt treo, Cấu trúc Pháp, Nhím) và đánh giá độ chênh lệch hiệu suất điểm số thực tế.
          </p>
        </div>

        {/* Pillar 4: AI Assistant */}
        <div className="bg-card border border-border p-5 rounded-surface hover:border-emerald-500/40 transition-colors">
          <div className="p-2.5 w-fit rounded bg-muted text-teal-700 mb-3">
            <Brain className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-foreground mb-1.5">
            Trợ Lí AI Phân Tích
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Tương tác trực tiếp trên bàn cờ, đọc hiểu biên bản PGN và giải thích ý tưởng đằng sau các nước cờ bằng ngôn ngữ cờ vua tự nhiên.
          </p>
        </div>
      </div>

      {/* Bottom Call to Action Card */}
      <div className="mt-16 w-full max-w-4xl bg-card border border-border rounded-lg p-6 sm:p-10 text-center relative">
        <div className="relative z-10 space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            Sẵn Sàng Làm Chủ Bàn Cờ & Bứt Phá Trình Độ?
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Nhập các ván đấu gần đây của bạn từ Lichess hoặc Chess.com để nhận hồ sơ phân tích toàn diện chỉ trong vài giây.
          </p>
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            {isMounted && user ? (
              <>
                <Link
                  href="/import"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-xs sm:text-sm transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span>Bắt Đầu Nhập Ván Đấu</span>
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground font-semibold rounded border border-border transition-colors text-xs sm:text-sm"
                >
                  <span>Vào Bảng Điều Khiển</span>
                </Link>
              </>
            ) : isMounted && isGuest ? (
              <>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-xs sm:text-sm transition-colors"
                >
                  <span>Tiếp Tục Bảng Điều Khiển</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground font-semibold rounded border border-border transition-colors text-xs sm:text-sm"
                >
                  <LogIn className="w-4 h-4 text-emerald-600" />
                  <span>Đăng Nhập Tài Khoản</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-xs sm:text-sm transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Đăng Nhập Ngay</span>
                </Link>
                <button
                  type="button"
                  onClick={handleEnterGuest}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground font-semibold rounded border border-border transition-colors text-xs sm:text-sm cursor-pointer"
                >
                  <User className="w-4 h-4 text-emerald-700" />
                  <span>Vào Chế Độ Khách (24h)</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
