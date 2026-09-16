"use client";

import React, { useState, useEffect, useRef } from "react";
import { Brain, Send, User, Bot, Sparkles, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api/client";

interface AiCoachChatProps {
  runId?: string;
  initialBriefing?: string;
  suggestedQuestions?: string[];
}

export default function AiCoachChat({
  runId = "default_run",
  initialBriefing = "",
  suggestedQuestions = [],
}: AiCoachChatProps) {
  const [perspectiveMode, setPerspectiveMode] = useState<"self" | "opponent">("self");
  const [briefing, setBriefing] = useState(initialBriefing);
  const [suggestions, setSuggestions] = useState<string[]>(suggestedQuestions);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    {
      role: "assistant",
      content: "Xin chào! Tôi là Trợ lí AI Đại kiện tướng. Hãy xem bản tham mưu chiến lược bên dưới hoặc đặt câu hỏi bất kỳ về khai cuộc, thế trận và đối thủ!",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingBriefing, setIsLoadingBriefing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-fetch briefing if not provided
  useEffect(() => {
    if (!initialBriefing && runId) {
      loadBriefing(perspectiveMode);
    }
  }, [runId, perspectiveMode]);

  const loadBriefing = async (mode: "self" | "opponent") => {
    setIsLoadingBriefing(true);
    try {
      const res = await apiClient.getAiBriefing(runId, mode);
      setBriefing(res.strategic_briefing);
      setSuggestions(res.suggested_questions);
    } catch {
      setBriefing("Chưa có đủ dữ liệu để tạo bản tóm tắt chiến lược.");
    } finally {
      setIsLoadingBriefing(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isStreaming) return;

    const newMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(newMessages);
    setInputMessage("");
    setIsStreaming(true);

    // Append empty assistant message for streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    await apiClient.chatAiStream(
      {
        run_id: runId,
        message: text,
        perspective_mode: perspectiveMode,
        history: newMessages,
      },
      {
        onChunk: (chunk) => {
          setMessages((prev) => {
            const lastIdx = prev.length - 1;
            const updated = [...prev];
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: updated[lastIdx].content + chunk,
            };
            return updated;
          });
        },
        onDone: () => setIsStreaming(false),
        onError: (err) => {
          setIsStreaming(false);
          setMessages((prev) => {
            const lastIdx = prev.length - 1;
            const updated = [...prev];
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: updated[lastIdx].content + `\n\n*(Lỗi: ${err.message})*`,
            };
            return updated;
          });
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Perspective Mode Switcher & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Trợ Lí Đại Kiện Tướng AI
            </h3>
            <p className="text-xs text-slate-500">
              Tham mưu chiến lược, vá lỗ hổng Repertoire & lập giáo án rèn luyện
            </p>
          </div>
        </div>

        {/* Perspective Mode Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => {
              setPerspectiveMode("self");
              loadBriefing("self");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              perspectiveMode === "self"
                ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            👤 Bản thân / Học viên
          </button>
          <button
            onClick={() => {
              setPerspectiveMode("opponent");
              loadBriefing("opponent");
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              perspectiveMode === "opponent"
                ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            🎯 Đối thủ sắp gặp
          </button>
        </div>
      </div>

      {/* Proactive Strategic Briefing Hero Card */}
      <div className="bg-gradient-to-br from-emerald-50/70 via-white to-slate-50 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 border border-emerald-200/60 dark:border-emerald-800/40 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-emerald-100 dark:border-slate-800">
          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Bản Tham Mưu Chiến Lược Mở Đầu (Executive Briefing)
          </span>
          {isLoadingBriefing && (
            <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
          )}
        </div>

        <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans">
          {briefing || "Đang tải dữ liệu tham mưu..."}
        </div>
      </div>

      {/* 1-Click Suggested Questions Pills */}
      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Gợi ý đào sâu nhanh:
          </span>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                className="text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500 dark:hover:border-emerald-500 hover:text-emerald-600 px-3 py-1.5 rounded-xl shadow-2xs transition text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages Log */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col h-[400px]">
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-2">
          {messages.map((msg, idx) => {
            const isBot = msg.role === "assistant";
            return (
              <div
                key={idx}
                className={`flex gap-3 text-sm ${
                  isBot ? "items-start" : "items-start flex-row-reverse"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isBot
                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400"
                      : "bg-slate-800 text-white"
                  }`}
                >
                  {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                <div
                  className={`rounded-2xl px-4 py-2.5 max-w-[80%] whitespace-pre-wrap leading-relaxed ${
                    isBot
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-sm"
                      : "bg-emerald-600 text-white rounded-tr-sm"
                  }`}
                >
                  {msg.content || (isStreaming && idx === messages.length - 1 ? "..." : "")}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Hỏi AI Coach về khai cuộc, điểm yếu tàn cuộc, hoặc kế hoạch thi đấu..."
            disabled={isStreaming}
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:text-white"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isStreaming}
            className="p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl shadow-sm transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
