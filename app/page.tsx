import Link from "next/link";
import { 
  BarChart3, 
  Brain, 
  ShieldCheck, 
  Zap, 
  ArrowRight, 
  Sparkles, 
  Layers, 
  Cpu 
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-6">
        <Sparkles className="w-3.5 h-3.5" />
        <span>Nền tảng Phân tích Dữ liệu Ván đấu & Huấn luyện AI Cờ Vua V2</span>
      </div>

      {/* Main Hero Title */}
      <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight max-w-4xl leading-tight sm:leading-none">
        Khai phá Lỗ hổng Cờ vua bằng{" "}
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500">
          Toán học Bayes & Trí tuệ Nhân tạo
        </span>
      </h1>

      {/* Subtitle */}
      <p className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
        Biến hàng trăm ván PGN thô từ Lichess và Chess.com thành Cây khai cuộc chống chuyển vị, 
        Radar 8 trục phong cách, phân tích cấu trúc Tốt và Bản tham mưu chiến thuật tự động cùng AI Đại kiện tướng.
      </p>

      {/* CTA Buttons */}
      <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
        <Link
          href="/dashboard"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-7 py-3.5 rounded-xl shadow-lg shadow-emerald-600/25 transition text-base"
        >
          <span>Khám phá Bảng Điều Khiển</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/register"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold px-7 py-3.5 rounded-xl transition text-base"
        >
          <span>Đăng Ký Tài Khoản Miễn Phí</span>
        </Link>
      </div>

      <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Đã có tài khoản?{" "}
        <Link href="/login" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
          Đăng nhập ngay
        </Link>
        {" "}hoặc{" "}
        <Link href="/dashboard" className="text-slate-600 dark:text-slate-300 font-medium hover:underline">
          Trải nghiệm thử (Guest)
        </Link>
      </div>

      {/* 4 Key Pillars Feature Grid */}
      <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full text-left">
        {/* Pillar 1 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
          <div className="p-3 w-fit rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
            Co ngót Bayes (Bayesian)
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Triệt tiêu hoàn toàn hiện tượng thiên lệch mẫu nhỏ ($K=6.0$). Phân loại 5 cấp bậc điểm mạnh và điểm yếu thực chất.
          </p>
        </div>

        {/* Pillar 2 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
          <div className="p-3 w-fit rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 mb-4">
            <BarChart3 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
            Cây Khai Cuộc Chống Chuyển Vị
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Mã băm EPD 4 trường nhận diện chính xác 100% các biến đổi thứ tự nước đi. Thống kê tỷ lệ Win/Draw/Loss chi tiết.
          </p>
        </div>

        {/* Pillar 3 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
          <div className="p-3 w-fit rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 mb-4">
            <Cpu className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
            Stockfish WASM Client-Side
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Động cơ Stockfish chạy trực tiếp trong Web Worker trình duyệt người dùng. Đánh giá thế cờ tức thì, 0 đồng chi phí server.
          </p>
        </div>

        {/* Pillar 4 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
          <div className="p-3 w-fit rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 mb-4">
            <Brain className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
            Trợ Lí AI Đại Kiện Tướng
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Chủ động tạo Bản Tóm tắt Chiến lược Mở đầu, gợi ý phương án khai thác đối thủ và đàm thoại chiến thuật cùng Gemini LLM.
          </p>
        </div>
      </div>
    </div>
  );
}
