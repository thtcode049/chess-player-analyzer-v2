"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Users, 
  Swords, 
  Brain, 
  UploadCloud, 
  Trophy, 
  ArrowUpRight,
  Layers,
  Sparkles
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Player, AnalysisRun } from "@/lib/api/types";

const getEngineBadge = (status?: string) => {
  switch (status) {
    case "completed":
      return { label: "Hoàn tất", color: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500" };
    case "processing":
      return { label: "Đang phân tích", color: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800", dot: "bg-amber-500 animate-pulse" };
    case "failed":
      return { label: "Thất bại", color: "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800", dot: "bg-rose-500" };
    default:
      return { label: "Sẵn sàng", color: "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700", dot: "bg-slate-400" };
  }
};

export default function DashboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [recentRuns, setRecentRuns] = useState<AnalysisRun[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const sb = createClient();
        const { data: authData } = await sb.auth.getUser();
        const currentUser = authData?.user || null;
        setUser(currentUser);
        setIsGuest(!currentUser);

        const fetchedPlayers = await apiClient.getPlayers();
        setPlayers(fetchedPlayers || []);

        if (fetchedPlayers && fetchedPlayers.length > 0) {
          const runs: AnalysisRun[] = [];
          for (const p of fetchedPlayers.slice(0, 10)) {
            try {
              const run = await apiClient.getAnalysisRun(p.id);
              if (run) runs.push(run);
            } catch (err) {
              console.warn("Could not fetch analysis run for player:", p.canonical_name, err);
            }
          }
          setRecentRuns(runs);
        } else {
          setRecentRuns([]);
        }
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      }
    }
    loadData();
  }, []);

  const totalAnalyzedGames = recentRuns.reduce((acc, r) => acc + (r.games_analyzed_count || 0), 0);
  const totalImportedGames = players.reduce((acc, p) => acc + (p.total_games || 0), 0);
  const totalGames = totalAnalyzedGames > 0 ? totalAnalyzedGames : totalImportedGames;

  const validRuns = recentRuns.filter((r) => r.overall_score != null);
  const avgScore = validRuns.length > 0
    ? (validRuns.reduce((acc, r) => acc + (r.overall_score || 0), 0) / validRuns.length).toFixed(1)
    : null;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Rich Emerald Gradient Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#059669] via-[#0d8560] to-[#0a5c44] border border-emerald-300/30 p-8 sm:p-9 text-white shadow-xl shadow-emerald-950/25">
        {/* Ambient Gradient Glows for Rich Lighting Depth */}
        <div className="absolute -top-16 -left-16 w-80 h-80 bg-emerald-300/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 right-1/4 w-80 h-80 bg-teal-200/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl">
          <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-200 drop-shadow-xs">
            CHESS PLAYER ANALYTICS
          </span>
          <h1 className="mt-2 text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight drop-shadow-xs">
            {user 
              ? `Chào mừng trở lại, ${user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.display_name || user.email?.split("@")[0] || "Kỳ thủ"}!` 
              : "Khám Phá Phân Tích & Cố Vấn Cờ Vua Thông Minh"}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-emerald-50/95 leading-relaxed drop-shadow-xs">
            {user
              ? "Hệ thống đã sẵn sàng hỗ trợ nạp dữ liệu từ Lichess/Chess.com, bóc tách Repertoire khai cuộc, và đồng hành cùng Trợ lí AI Đại kiện tướng để hoàn thiện chiến lược thi đấu."
              : "Nền tảng hỗ trợ nạp ván cờ từ tệp PGN hoặc đồng bộ trực tiếp từ Lichess/Chess.com để bóc tách khai cuộc, vẽ radar phong cách và đồng hành cùng Trợ lí AI."}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/import"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-bold text-emerald-900 shadow-lg shadow-black/10 hover:bg-emerald-50 hover:shadow-xl transition-all duration-200 active:scale-95"
            >
              <UploadCloud className="w-4 h-4 text-emerald-700" />
              <span>Nạp Ván Đấu Mới</span>
            </Link>
            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 px-5 py-3 text-xs font-bold text-white shadow-xs backdrop-blur-md transition-all duration-200 active:scale-95"
            >
              <Swords className="w-4 h-4 text-emerald-100" />
              <span>Mở Bàn Cờ Tương Tác</span>
            </Link>
            <Link
              href="/ai-coach"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-950/60 border border-emerald-300/30 px-5 py-3 text-xs font-bold text-white shadow-xs backdrop-blur-md transition-all duration-200 active:scale-95"
            >
              <Brain className="w-4 h-4 text-emerald-200" />
              <span>Trợ Lí AI</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Guest Mode Notice Banner */}
      {isGuest && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-foreground shadow-xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Bạn đang sử dụng ở <b>Chế độ Khách (Guest)</b>. Ván đấu nạp vào sẽ được lưu tạm thời trong phiên trình duyệt này.
            </span>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Link 
              href="/login" 
              className="font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
            >
              Đăng nhập
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link 
              href="/register" 
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-xs"
            >
              Đăng ký miễn phí
            </Link>
          </div>
        </div>
      )}

      {/* 4 KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Total Players */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-3xl shadow-xs transition hover:border-emerald-500/40">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Kỳ thủ theo dõi
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {players.length}
          </div>
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1 block">
            Hồ sơ trong hệ thống
          </span>
        </div>

        {/* Total Games Analyzed */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-3xl shadow-xs transition hover:border-emerald-500/40">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tổng ván đã bóc tách
            </span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {totalGames}
          </div>
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1 block">
            {totalGames > 0 ? "Ván cờ đã chuẩn hóa EPD" : "Chưa có ván đấu nào"}
          </span>
        </div>

        {/* Performance Score */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-3xl shadow-xs transition hover:border-emerald-500/40">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Hiệu suất trung bình
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {avgScore !== null ? `${avgScore}%` : "--"}
          </div>
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1 block">
            {avgScore !== null ? "Tỷ lệ điểm số giành được" : "Chưa có dữ liệu đánh giá"}
          </span>
        </div>

        {/* AI Coaching Status */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-3xl shadow-xs transition hover:border-emerald-500/40">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Trợ lí Cố vấn AI
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Brain className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-black text-purple-600 dark:text-purple-400 flex items-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Sẵn sàng cố vấn
          </div>
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1 block">
            Gemini Flash kết nối thời gian thực
          </span>
        </div>
      </div>

      {/* Recent Analysis Runs Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-xs">
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Hồ Sơ & Báo Cáo Phân Tích Gần Đây
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Kết quả bóc tách chiến thuật và đánh giá hiệu suất của các kỳ thủ
            </p>
          </div>
          <Link
            href="/analyze"
            className="text-xs font-bold text-emerald-600 hover:text-emerald-500 inline-flex items-center gap-1 transition"
          >
            <span>Mở bàn cờ phân tích</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 dark:bg-slate-800/40 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Hồ Sơ Kỳ Thủ</th>
                <th className="px-4 py-3.5">Số Ván Đấu</th>
                <th className="px-4 py-3.5">Tỷ Lệ Thắng</th>
                <th className="px-4 py-3.5">Điểm Số Chung</th>
                <th className="px-4 py-3.5">Động Cơ Đánh Giá</th>
                <th className="px-4 py-3.5">Phong Cách Thi Đấu</th>
                <th className="px-5 py-3.5 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {recentRuns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      Chưa có báo cáo phân tích nào trong hệ thống.
                    </p>
                    <p className="text-xs mt-1 text-slate-400">
                      Hãy nạp tệp PGN hoặc đồng bộ tài khoản Lichess/Chess.com để bắt đầu bóc tách chiến lược.
                    </p>
                    <Link
                      href="/import"
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition shadow-xs"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Nạp ván đấu ngay</span>
                    </Link>
                  </td>
                </tr>
              ) : (
                recentRuns.map((run) => {
                  const badge = getEngineBadge(run.engine_status);
                  return (
                    <tr key={run.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">
                        {run.run_label}
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-600 dark:text-slate-300">
                        {run.games_analyzed_count} ván
                      </td>
                      <td className="px-4 py-4 text-emerald-600 dark:text-emerald-400 font-bold">
                        {run.overall_win_rate ? `${run.overall_win_rate.toFixed(1)}%` : "N/A"}
                      </td>
                      <td className="px-4 py-4 font-bold text-slate-800 dark:text-slate-200">
                        {run.overall_score ? `${run.overall_score.toFixed(1)}%` : "N/A"}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badge.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-600 dark:text-slate-300">
                        {run.dominant_archetype || "Toàn diện (Universal)"}
                      </td>
                      <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                        <Link
                          href={`/analyze?playerId=${run.player_id}&runId=${run.id}`}
                          className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-200/50 dark:border-emerald-800/50 transition"
                        >
                          Bàn cờ
                        </Link>
                        <Link
                          href={`/players/${run.player_id}`}
                          className="text-xs font-bold text-sky-700 dark:text-sky-300 hover:text-sky-800 bg-sky-50 dark:bg-sky-950/60 px-3 py-1.5 rounded-xl border border-sky-200/50 dark:border-sky-800/50 transition"
                        >
                          Hồ sơ
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
