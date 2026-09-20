"use client";

import React, { useState, useEffect } from "react";
import { 
  Settings, 
  User, 
  Save, 
  CheckCircle2,
  Globe,
  SlidersHorizontal
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const supabase = createClient();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [lichessUser, setLichessUser] = useState("");
  const [chesscomUser, setChesscomUser] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [engineDepth, setEngineDepth] = useState(12);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setEmail(data.user.email || "");
        setDisplayName(data.user.user_metadata?.display_name || "");
      }
    });

    const savedDepth = localStorage.getItem("setting_engine_depth");
    if (savedDepth) setEngineDepth(parseInt(savedDepth, 10));

    const savedLichess = localStorage.getItem("setting_lichess_user");
    if (savedLichess) setLichessUser(savedLichess);

    const savedChesscom = localStorage.getItem("setting_chesscom_user");
    if (savedChesscom) setChesscomUser(savedChesscom);
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("setting_engine_depth", engineDepth.toString());
    localStorage.setItem("setting_lichess_user", lichessUser);
    localStorage.setItem("setting_chesscom_user", chesscomUser);
    if (geminiKey) {
      localStorage.setItem("setting_gemini_key", geminiKey);
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="border-b border-border/40 pb-6">
        <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" />
          Cấu Hình Tài Khoản & Tùy Chọn
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quản lý tài khoản nền tảng cờ vua, độ sâu engine Stockfish và cấu hình API cá nhân.
        </p>
      </div>

      {saved && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-500 text-sm flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>Đã lưu toàn bộ cài đặt thành công!</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-8">
        {/* Section 1: User Profile */}
        <div className="bg-card border border-border/60 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border/40">
            <User className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">Hồ Sơ Người Dùng</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Tên Hiển Thị
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Đại kiện tướng"
                className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Email Đăng Ký
              </label>
              <input
                type="email"
                disabled
                value={email || "guest@chess-analyzer.local"}
                className="w-full bg-muted/40 border border-border/60 rounded-xl px-4 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Chess Platforms */}
        <div className="bg-card border border-border/60 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border/40">
            <Globe className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">Tài Khoản Nền Tảng Cờ Vua</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Lichess Username
              </label>
              <input
                type="text"
                value={lichessUser}
                onChange={(e) => setLichessUser(e.target.value)}
                placeholder="VD: thtcode, magnuscarlsen"
                className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Chess.com Username
              </label>
              <input
                type="text"
                value={chesscomUser}
                onChange={(e) => setChesscomUser(e.target.value)}
                placeholder="VD: hikaru, magnuscarlsen"
                className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Engine Preferences */}
        <div className="bg-card border border-border/60 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border/40">
            <SlidersHorizontal className="w-5 h-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">Tùy Chọn Động Cơ Stockfish WASM</h3>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Độ Sâu Phân Tích Mặc Định (Depth): <span className="text-primary font-bold">{engineDepth}</span>
                </label>
                <span className="text-[11px] text-muted-foreground">Khuyến nghị: 12 - 14 ply</span>
              </div>
              <input
                type="range"
                min={8}
                max={18}
                step={2}
                value={engineDepth}
                onChange={(e) => setEngineDepth(parseInt(e.target.value, 10))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Google Gemini API Key Cá Nhân (Tùy Chọn)
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy... (Nếu không nhập sẽ dùng Chuyên Gia Cục Bộ miễn phí)"
                className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Khóa API của bạn chỉ lưu trong trình duyệt cục bộ, không gửi về bất kỳ máy chủ nào.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2 text-sm shadow-md shadow-primary/20"
          >
            <Save className="w-4 h-4" />
            Lưu Tùy Chọn Cài Đặt
          </button>
        </div>
      </form>
    </div>
  );
}
