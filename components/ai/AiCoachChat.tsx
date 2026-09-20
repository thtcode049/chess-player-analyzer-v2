"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Brain,
  Send,
  User,
  Bot,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  RotateCcw,
  Zap
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiClient } from "@/lib/api/client";

interface AiCoachChatProps {
  runId?: string;
  initialBriefing?: string;
  suggestedQuestions?: string[];
}

/**
 * Reusable Rich Markdown Renderer for AI tactical chess responses & briefings
 */
function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-base font-black text-slate-900 dark:text-white mt-3 mb-2 flex items-center gap-1.5 border-b border-slate-200/80 dark:border-slate-800 pb-1">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-black text-slate-900 dark:text-white mt-3 mb-1.5 flex items-center gap-1.5">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-2.5 mb-1.5 pb-1 border-b border-slate-200/60 dark:border-slate-800 flex items-center gap-1.5">
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mt-2.5 mb-1">
            {children}
          </h4>
        ),
        p: ({ children }) => (
          <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200 mb-2 last:mb-0">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="space-y-1.5 my-2 pl-4 list-disc marker:text-emerald-500 text-sm">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="space-y-2 my-2 pl-4 list-decimal marker:text-emerald-600 dark:marker:text-emerald-400 font-semibold text-sm">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
            {children}
          </li>
        ),
        strong: ({ children }) => (
          <strong className="font-bold text-slate-950 dark:text-white">
            {children}
          </strong>
        ),
        code: ({ children }) => (
          <code className="px-1.5 py-0.5 mx-0.5 rounded-md font-mono text-xs bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200/60 dark:border-emerald-800/60">
            {children}
          </code>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-3 border-emerald-500 pl-3 py-1.5 my-2 bg-emerald-50/50 dark:bg-emerald-950/20 text-slate-700 dark:text-slate-300 italic text-xs rounded-r-xl">
            {children}
          </blockquote>
        ),
        hr: () => (
          <hr className="my-3 border-t border-slate-200/80 dark:border-slate-800" />
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2 rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-left border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="bg-slate-100 dark:bg-slate-800/80 px-3 py-2 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/60 text-slate-700 dark:text-slate-300">
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

/**
 * Animated Grandmaster Thinking Indicator with pulsing status
 */
function ThinkingState() {
  const [stepIndex, setStepIndex] = useState(0);
  const steps = [
    "Đại kiện tướng AI đang truy xuất dữ liệu ván đấu...",
    "Đang phân tích cây khai cuộc & kiểm định Bayesian...",
    "Đang đo lường độ chính xác từng giai đoạn & cấu trúc Tốt...",
    "Đang tổng hợp khuyến nghị chiến thuật sắc bén...",
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % steps.length);
    }, 2200);
    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 shadow-xs animate-fade-in">
      <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs">
        <Brain className="w-4 h-4 animate-pulse" />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 tracking-tight">
            Đại kiện tướng AI đang suy nghĩ
          </span>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
          </div>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium transition-all duration-300">
          {steps[stepIndex]}
        </p>
      </div>
    </div>
  );
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
      content:
        "Xin chào! Tôi là Trợ lí AI Đại kiện tướng. Hãy xem bản tham mưu chiến lược bên dưới hoặc đặt câu hỏi bất kỳ về khai cuộc, thế trận và đối thủ!",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingBriefing, setIsLoadingBriefing] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
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

  const handleCopyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleResetChat = () => {
    setMessages([
      {
        role: "assistant",
        content:
          "Xin chào! Tôi là Trợ lí AI Đại kiện tướng. Hãy xem bản tham mưu chiến lược bên dưới hoặc đặt câu hỏi bất kỳ về khai cuộc, thế trận và đối thủ!",
      },
    ]);
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              Trợ Lí Đại Kiện Tướng AI
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40">
                <Zap className="w-3 h-3 text-emerald-600" />
                Gemini 3.8 Flash
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Tham mưu chiến lược, vá lỗ hổng Repertoire & lập giáo án rèn luyện
            </p>
          </div>
        </div>

        {/* Perspective Mode & Reset Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl">
            <button
              onClick={() => {
                setPerspectiveMode("self");
                loadBriefing("self");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                perspectiveMode === "self"
                  ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
                  ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              🎯 Đối thủ sắp gặp
            </button>
          </div>

          <button
            onClick={handleResetChat}
            title="Làm mới đoạn hội thoại"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition shadow-2xs"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Proactive Strategic Briefing Hero Card */}
      <div className="bg-gradient-to-br from-emerald-50/80 via-white to-slate-50/80 dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900/90 border border-emerald-200/80 dark:border-emerald-800/40 rounded-3xl p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-emerald-100 dark:border-slate-800">
          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            Bản Tham Mưu Chiến Lược Mở Đầu (Executive Strategic Briefing)
          </span>
          {isLoadingBriefing && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Đang cập nhật...</span>
            </div>
          )}
        </div>

        <div className="text-sm leading-relaxed text-slate-800 dark:text-slate-200 font-sans">
          {briefing ? (
            <MarkdownRenderer content={briefing} />
          ) : (
            <div className="py-6 flex items-center justify-center gap-2 text-slate-400 text-xs">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
              <span>Đang trích xuất dữ liệu phân tích và xây dựng hồ sơ...</span>
            </div>
          )}
        </div>
      </div>

      {/* 1-Click Suggested Questions Pills */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Gợi ý đào sâu nhanh:
          </span>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                disabled={isStreaming}
                className="text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500 dark:hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 px-3.5 py-2 rounded-xl shadow-2xs transition text-left disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages Log */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex flex-col h-[520px]">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.map((msg, idx) => {
            const isBot = msg.role === "assistant";
            const isLatestBot = isBot && idx === messages.length - 1;
            const isThinking = isLatestBot && isStreaming && !msg.content;

            return (
              <div
                key={idx}
                className={`flex gap-3 text-sm group ${
                  isBot ? "items-start" : "items-start flex-row-reverse"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${
                    isBot
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                      : "bg-slate-800 dark:bg-slate-700 text-white"
                  }`}
                >
                  {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                {/* Message Bubble Container */}
                <div className="flex flex-col gap-1 max-w-[85%] sm:max-w-[78%]">
                  {/* Thinking Animation */}
                  {isThinking ? (
                    <ThinkingState />
                  ) : (
                    <div
                      className={`relative rounded-2xl px-4 py-3 leading-relaxed shadow-2xs ${
                        isBot
                          ? "bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-750 rounded-tl-xs"
                          : "bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-tr-xs"
                      }`}
                    >
                      {isBot ? (
                        <MarkdownRenderer content={msg.content} />
                      ) : (
                        <span className="whitespace-pre-wrap font-medium">{msg.content}</span>
                      )}

                      {/* Copy Message Action for Bot */}
                      {isBot && msg.content && !isStreaming && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleCopyMessage(msg.content, idx)}
                            title="Sao chép nội dung"
                            className="p-1.5 rounded-lg bg-white/90 dark:bg-slate-700/90 text-slate-500 hover:text-emerald-600 shadow-2xs border border-slate-200/60 dark:border-slate-600 transition"
                          >
                            {copiedIdx === idx ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
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
          className="pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2.5"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Hỏi AI Coach về khai cuộc, điểm yếu tàn cuộc, hoặc kế hoạch thi đấu..."
            disabled={isStreaming}
            className="flex-1 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:text-white placeholder:text-slate-400 transition"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isStreaming}
            className="px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white rounded-2xl shadow-xs transition flex items-center gap-1.5 font-bold text-sm shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Gửi</span>
          </button>
        </form>
      </div>
    </div>
  );
}
