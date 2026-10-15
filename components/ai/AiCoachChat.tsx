"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Brain,
  Send,
  User,
  Bot,
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Zap,
  Play,
  Layers,
  HelpCircle
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiClient } from "@/lib/api/client";

interface AiCoachChatProps {
  runId?: string;
  playerId?: string;
  playerName?: string;
  gamesCount?: number;
  currentFen?: string;
  currentEval?: any;
  onApplyFen?: (fen: string) => void;
  onApplyMove?: (san: string) => void;
  suggestedQuestions?: string[];
  heightClass?: string;
}

/**
 * Rich Markdown Renderer with interactive Chess Move & FEN click triggers
 */
function MarkdownRenderer({
  content,
  onApplyFen,
  onApplyMove,
}: {
  content: string;
  onApplyFen?: (fen: string) => void;
  onApplyMove?: (san: string) => void;
}) {
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
        code: ({ children }) => {
          const strVal = String(children).trim();
          // Detect FEN string
          const isFen = strVal.includes("/") && strVal.split("/").length >= 7;
          // Detect short move (e.g. 1.e4, 14.Nxd4, e5, Nf3, O-O)
          const isMove = /^((\d+\.)?\s*[NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](=[NBRQ])?|O-O(-O)?)[+#?!]*$/.test(strVal);

          if (isFen && onApplyFen) {
            return (
              <button
                type="button"
                onClick={() => onApplyFen(strVal)}
                title="Bấm để hiển thị thế cờ này lên bàn cờ"
                className="inline-flex items-center gap-1 px-2 py-0.5 mx-1 rounded-md font-mono text-xs bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300/80 dark:border-emerald-700 hover:scale-105 transition-transform cursor-pointer shadow-2xs"
              >
                <Layers className="w-3 h-3 text-emerald-600" />
                <span>[Xem thế cờ trên Bàn cờ]</span>
              </button>
            );
          }

          if (isMove && onApplyMove) {
            const cleanSan = strVal.replace(/^\d+\.\s*/, "").replace(/[+#?!]/g, "");
            return (
              <button
                type="button"
                onClick={() => onApplyMove(cleanSan)}
                title={`Bấm để đi nước ${strVal} trên bàn cờ`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md font-mono text-xs bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300/60 dark:border-emerald-700/60 hover:bg-emerald-200 dark:hover:bg-emerald-800/60 transition cursor-pointer"
              >
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>{strVal}</span>
              </button>
            );
          }

          return (
            <code className="px-1.5 py-0.5 mx-0.5 rounded-md font-mono text-xs bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200/60 dark:border-emerald-800/60">
              {children}
            </code>
          );
        },
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
 * Animated Thinking Indicator
 */
function ThinkingState() {
  const [stepIndex, setStepIndex] = useState(0);
  const steps = [
    "Trợ lí AI đang rà soát biên bản ván đấu PGN...",
    "Đang phân tích thế cờ FEN và kiểm tra điểm số Stockfish...",
    "Đang đánh giá cấu trúc Tốt và đường đi của quân cờ...",
    "Đang tổng hợp câu trả lời tự nhiên...",
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % steps.length);
    }, 2000);
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
            Trợ lí AI đang suy nghĩ
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
  playerId = "",
  playerName = "Kỳ thủ",
  gamesCount,
  currentFen,
  currentEval,
  onApplyFen,
  onApplyMove,
  suggestedQuestions = [],
  heightClass = "h-[580px]",
}: AiCoachChatProps) {
  const DEFAULT_SUGGESTIONS = [
    "Phân tích thế cờ hiện tại trên bàn cờ giúp tôi",
    `Tóm tắt điểm mạnh & điểm yếu từ các ván đấu của ${playerName}`,
    "Khai cuộc nào kỳ thủ này đạt tỷ lệ thắng cao nhất?",
    "Chỉ cho tôi ván đấu có nước đi sai lầm lớn nhất",
  ];

  const suggestions = suggestedQuestions.length > 0 ? suggestedQuestions : DEFAULT_SUGGESTIONS;

  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    {
      role: "assistant",
      content: `Xin chào! Tôi là Trợ lí AI phân tích cờ vua. Tôi đã nạp toàn bộ biên bản ván đấu PGN của **${playerName}** và kết nối trực tiếp với bàn cờ bên cạnh.\n\nBạn có thể hỏi tôi bất kỳ điều gì về các ván đấu, khai cuộc, phong cách thi đấu, hoặc đi thử một nước cờ trên bàn cờ rồi hỏi tôi nhận xét!`,
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        content: `Xin chào! Tôi là Trợ lí AI phân tích cờ vua. Tôi đã nạp toàn bộ biên bản ván đấu PGN của **${playerName}** và kết nối trực tiếp với bàn cờ bên cạnh.\n\nBạn có thể hỏi tôi bất kỳ điều gì về các ván đấu, khai cuộc, phong cách thi đấu, hoặc đi thử một nước cờ trên bàn cờ rồi hỏi tôi nhận xét!`,
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
        player_id: playerId,
        message: text,
        perspective_mode: "neutral",
        history: newMessages,
        current_fen: currentFen,
        engine_eval: currentEval ? {
          score: currentEval.score,
          scoreType: currentEval.scoreType,
          bestMove: currentEval.bestMove,
          depth: currentEval.depth,
          pv: currentEval.pv,
        } : undefined,
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
              content: updated[lastIdx].content + `\n\n*(Lỗi kết nối: ${err.message})*`,
            };
            return updated;
          });
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs">
            <Brain className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              Trợ Lí AI Cờ Vua
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40">
                <Zap className="w-3 h-3 text-emerald-600" />
                Gemini 3.8 Flash
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              {gamesCount ? `Đã nạp toàn bộ ${gamesCount} ván PGN` : `Đang kết nối với cơ sở dữ liệu ván đấu`} • Đồng bộ với Bàn cờ
            </p>
          </div>
        </div>

        <button
          onClick={handleResetChat}
          title="Làm mới đoạn hội thoại"
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition shadow-2xs"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* 1-Click Suggested Questions Pills */}
      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Gợi ý câu hỏi nhanh:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                disabled={isStreaming}
                className="text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-500 dark:hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 px-3 py-1.5 rounded-xl shadow-2xs transition text-left disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages Log */}
      <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs flex flex-col ${heightClass}`}>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
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
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                    isBot
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                      : "bg-slate-800 dark:bg-slate-700 text-white"
                  }`}
                >
                  {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                {/* Message Bubble Container */}
                <div className="flex flex-col gap-1 max-w-[88%] sm:max-w-[82%]">
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
                        <MarkdownRenderer
                          content={msg.content}
                          onApplyFen={onApplyFen}
                          onApplyMove={onApplyMove}
                        />
                      ) : (
                        <span className="whitespace-pre-wrap font-medium">{msg.content}</span>
                      )}

                      {/* Copy Message Action for Bot */}
                      {isBot && msg.content && !isStreaming && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleCopyMessage(msg.content, idx)}
                            title="Sao chép nội dung"
                            className="p-1 rounded-md bg-white/90 dark:bg-slate-700/90 text-slate-500 hover:text-emerald-600 shadow-2xs border border-slate-200/60 dark:border-slate-600 transition"
                          >
                            {copiedIdx === idx ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
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
          className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Hỏi về thế cờ trên bàn cờ, khai cuộc, hoặc ván đấu trong PGN..."
            disabled={isStreaming}
            className="flex-1 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:text-white placeholder:text-slate-400 transition"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isStreaming}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white rounded-2xl shadow-xs transition flex items-center gap-1.5 font-bold text-xs sm:text-sm shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Gửi</span>
          </button>
        </form>
      </div>
    </div>
  );
}
