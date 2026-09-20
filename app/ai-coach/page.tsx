"use client";

import React, { useState, useEffect } from "react";
import { Brain, Sparkles, BookOpen, Layers, Lightbulb } from "lucide-react";
import AiCoachChat from "@/components/ai/AiCoachChat";
import { apiClient } from "@/lib/api/client";
import { Player } from "@/lib/api/types";

export default function AiCoachPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");

  useEffect(() => {
    apiClient.getPlayers()
      .then((data) => {
        setPlayers(data || []);
        if (data && data.length > 0) {
          setSelectedPlayerId(data[0].id);
        }
      })
      .catch(() => {
        // Fallback default
        setSelectedPlayerId("00000000-0000-0000-0000-000000000001");
      });
  }, []);

  const selectedPlayer = players.find(p => p.id === selectedPlayerId);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Trợ Lý Chiến Lược AI
          </div>
          <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <Brain className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            Cố Vấn Chiến Lược & Huấn Luyện AI
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Tự động tổng hợp dữ liệu thực nghiệm từ các ván đấu, phân tích danh mục khai cuộc, cấu trúc Tốt và đưa ra khuyến nghị chiến thuật cá nhân hóa.
          </p>
        </div>

        {/* Player Selector */}
        <div className="bg-card border border-border/60 rounded-2xl p-3 shadow-sm min-w-[240px]">
          <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
            Chọn Kỳ Thủ Cần Tham Mưu
          </label>
          <select
            value={selectedPlayerId}
            onChange={(e) => setSelectedPlayerId(e.target.value)}
            className="w-full bg-background border border-border/60 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground"
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.canonical_name} {p.title ? `(${p.title})` : ""}
              </option>
            ))}
            {players.length === 0 && (
              <option value="00000000-0000-0000-0000-000000000001">
                Kỳ Thủ Mẫu (Grandmaster Profile)
              </option>
            )}
          </select>
        </div>
      </div>

      {/* 3 Pillar Strategic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-foreground">Khai Thác Cây Khai Cuộc</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            AI tự động trích xuất các biến thể có hiệu suất thắng dưới 45% để cảnh báo điểm mù trong khai cuộc.
          </p>
        </div>

        <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-foreground">Điểm Yếu Cấu Trúc Tốt</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Nhận diện thế trận Tốt cô lập (Isolani), Carlsbad hay Nhím (Hedgehog) mà kỳ thủ xử lý lúng túng nhất.
          </p>
        </div>

        <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
            <Lightbulb className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-foreground">Khuyến Nghị Thực Chiến</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Đưa ra kế hoạch chuẩn bị cụ thể: đẩy nhanh tốc độ cờ mở hoặc chuyển về cờ tàn kỹ thuật dựa trên sai số ACPL.
          </p>
        </div>
      </div>

      {/* Interactive AI Chat & Briefing Container */}
      <div className="bg-card border border-border/60 rounded-3xl p-6 sm:p-8 shadow-sm">
        <AiCoachChat
          key={selectedPlayerId || "default"}
          runId={`run-${selectedPlayerId || "default"}`}
          suggestedQuestions={[
            `Phân tích những điểm yếu nhất trong khai cuộc của ${selectedPlayer?.canonical_name || "kỳ thủ này"}?`,
            `Tôi nên chuẩn bị biến thể nào khi cầm Đen đối đầu với ${selectedPlayer?.canonical_name || "đối thủ này"}?`,
            `Kỳ thủ này có xu hướng sụp đổ ở giai đoạn nào (Khai cuộc, Trung cuộc hay Cờ tàn)?`,
            `Đánh giá khả năng xử lý cấu trúc Tốt Isolani và các biến thể cờ mở?`
          ]}
        />
      </div>
    </div>
  );
}
