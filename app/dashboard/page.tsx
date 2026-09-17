"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Users, 
  Swords, 
  Brain, 
  UploadCloud, 
  Trophy, 
  TrendingUp, 
  Layers, 
  ArrowUpRight 
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Player, AnalysisRun } from "@/lib/api/types";
import { getEngineBadge } from "@/lib/utils";

export default function DashboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [recentRuns, setRecentRuns] = useState<AnalysisRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
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
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-700 p-8 text-white shadow-lg">
        <div className="relative z-10 max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
            CHESS PLAYER ANALYTICS V2
          </span>
          <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight">
            Chào mừng trở lại! Sẵn sàng phân tích thế cờ?
          </h1>
          <p className="mt-2 text-sm text-emerald-100 leading-relaxed">
            Hệ thống đã sẵn sàng hỗ trợ nạp dữ liệu từ Lichess/Chess.com, bóc tách Repertoire khai cuộc, 
            và đồng hành cùng Trợ lí AI Đại kiện tướng để hoàn thiện chiến lược thi đấu.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/import"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-emerald-800 shadow-sm hover:bg-emerald-50 transition"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Nạp Ván Đấu Mới</span>
            </Link>
            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/40 border border-emerald-400/50 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500/60 transition"
            >
              <Swords className="w-4 h-4" />
              <span>Mở Bàn Cờ Tương Tác</span>
            </Link>
          </div>
        </div>
        <div className="absolute -right-8 -bottom-10 opacity-15 select-none text-[220px] leading-none pointer-events-none font-serif">
          ♟
        </div>
      </div>

      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Players */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Kỳ thủ quản lý</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {players.length}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Tài khoản theo dõi</span>
        </div>

        {/* Total Games Analyzed */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Tổng ván phân tích</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {recentRuns.reduce((acc, r) => acc + r.games_analyzed_count, 0)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Ván cờ lưu trữ trong CSDL</span>
        </div>

        {/* Win Rate */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Hiệu suất trung bình</span>
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {recentRuns.length > 0 ? `${recentRuns[0].overall_score?.toFixed(1)}%` : "N/A"}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Điểm số giành được</span>
        </div>

        {/* AI Readiness */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Trợ lí AI Coach</span>
            <Brain className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-sm font-extrabold text-purple-600 dark:text-purple-400 mt-1">
            Sẵn sàng tham mưu
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">Gemini 2.5 Flash kết nối</span>
        </div>
      </div>

      {/* Recent Analysis Runs Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Báo Cáo Phân Tích Gần Đây (Analysis Runs)
            </h3>
            <p className="text-xs text-slate-500">
              Snapshot kết quả phân tích lưu trữ bền vững trong Supabase
            </p>
          </div>
          <Link
            href="/analyze"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 inline-flex items-center gap-1"
          >
            <span>Tạo lượt phân tích mới</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/30 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3">Nhãn Báo Cáo</th>
                <th className="px-4 py-3">Số Ván</th>
                <th className="px-4 py-3">Tỷ lệ Thắng</th>
                <th className="px-4 py-3">Điểm Số</th>
                <th className="px-4 py-3">Trạng thái Động cơ (Engine)</th>
                <th className="px-4 py-3">Hình mẫu</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {recentRuns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    <p className="text-sm font-medium">Chưa có báo cáo phân tích nào trong hệ thống.</p>
                    <p className="text-xs mt-1 text-slate-500">Hãy nạp tệp PGN hoặc đồng bộ Lichess để bắt đầu bóc tách chiến lược.</p>
                    <Link
                      href="/import"
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition shadow-sm"
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
                    <tr key={run.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                      <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                        {run.run_label}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-600 dark:text-slate-300">
                        {run.games_analyzed_count} ván
                      </td>
                      <td className="px-4 py-3.5 text-emerald-600 font-bold">
                        {run.overall_win_rate?.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200">
                        {run.overall_score?.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badge.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                        {run.dominant_archetype || "N/A"}
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-2 whitespace-nowrap">
                        <Link
                          href={`/analyze?playerId=${run.player_id}&runId=${run.id}`}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1.5 rounded-lg transition"
                        >
                          Bàn cờ
                        </Link>
                        <Link
                          href={`/players/${run.player_id}`}
                          className="text-xs font-bold text-sky-600 hover:text-sky-500 bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1.5 rounded-lg transition"
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
