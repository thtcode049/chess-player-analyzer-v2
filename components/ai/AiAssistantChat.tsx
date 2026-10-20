"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Brain,
  Send,
  User,
  Bot,
  Copy,
  Check,
  RotateCcw,
  Zap,
  Play,
  Layers,
  PanelLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiClient } from "@/lib/api/client";
import { isFenString, isChessMoveCandidate } from "@/lib/chess/notation";

export interface Message {
  role: "user" | "assistant";
  content: string;
  fen?: string;
}

interface AiAssistantChatProps {
  runId?: string;
  playerId?: string;
  playerName?: string;
  gamesCount?: number;
  currentFen?: string;
  currentEval?: any;
  isBoardOpen?: boolean;
  onToggleBoard?: () => void;
  onOpenBoard?: (fen?: string) => void;
  onApplyFen?: (fen: string) => void;
  onApplyMove?: (san: string, contextFen?: string) => void;
  messages?: Message[];
  setMessages?: React.Dispatch<React.SetStateAction<Message[]>>;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  pendingPrompt?: string | null;
  onClearPendingPrompt?: () => void;
  onNewChat?: () => void;
  suggestedQuestions?: string[];
  heightClass?: string;
}

/**
 * Rich Markdown Renderer with interactive Chess Move & FEN click triggers
 */
function MarkdownRenderer({
  content,
  messageFen,
  onApplyFen,
  onApplyMove,
}: {
  content: string;
  messageFen?: string;
  onApplyFen?: (fen: string) => void;
  onApplyMove?: (san: string, contextFen?: string) => void;
}) {
  // Strip [OPEN_BOARD] tags cleanly so they don't appear in markdown
  const cleanContent = content.replace(/\[OPEN_BOARD(?::\s*([^\]]+))?\]/gi, "").trim();

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
        strong: ({ children }) => {
          const strVal = String(children).trim();
          if (isChessMoveCandidate(strVal) && onApplyMove) {
            return (
              <button
                type="button"
                onClick={() => onApplyMove(strVal, messageFen)}
                title={`Bấm để đi nước ${strVal} trên bàn cờ`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md font-mono text-xs bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200 dark:hover:bg-emerald-800/80 transition cursor-pointer shadow-2xs active:scale-95"
              >
                <Play className="w-2.5 h-2.5 fill-current text-emerald-600 dark:text-emerald-400" />
                <span>{strVal}</span>
              </button>
            );
          }
          return (
            <strong className="font-bold text-slate-950 dark:text-white">
              {children}
            </strong>
          );
        },
        code: ({ children }) => {
          const strVal = String(children).trim();
          if (isFenString(strVal) && onApplyFen) {
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

          if (isChessMoveCandidate(strVal) && onApplyMove) {
            return (
              <button
                type="button"
                onClick={() => onApplyMove(strVal, messageFen)}
                title={`Bấm để đi nước ${strVal} trên bàn cờ`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md font-mono text-xs bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300/60 dark:border-emerald-700/60 hover:bg-emerald-200 dark:hover:bg-emerald-800/60 transition cursor-pointer shadow-2xs active:scale-95"
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
        td: ({ children }) => {
          const strVal = String(children).trim();
          if (isChessMoveCandidate(strVal) && onApplyMove) {
            return (
              <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/60 text-slate-700 dark:text-slate-300">
                <button
                  type="button"
                  onClick={() => onApplyMove(strVal, messageFen)}
                  title={`Bấm để đi nước ${strVal} trên bàn cờ`}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono text-xs bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300/60 dark:border-emerald-700/60 hover:bg-emerald-200 dark:hover:bg-emerald-800/60 transition cursor-pointer"
                >
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>{strVal}</span>
                </button>
              </td>
            );
          }
          return (
            <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/60 text-slate-700 dark:text-slate-300">
              {children}
            </td>
          );
        },
      }}
    >
      {cleanContent}
    </ReactMarkdown>
  );
}

/**
 * Animated Thinking Indicator
 */
function ThinkingState() {
  const [stepIndex, setStepIndex] = useState(0);
  const steps = [
    "Trợ lí AI đang rà soát dữ liệu ván đấu PGN...",
    "Đang đánh giá thế cờ FEN và kiểm tra điểm số Stockfish...",
    "Đang phân tích cấu trúc Tốt và đường đi của quân cờ...",
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
      <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs shrink-0">
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

export default function AiAssistantChat({
  runId = "default_run",
  playerId = "",
  playerName = "Kỳ thủ",
  gamesCount,
  currentFen,
  currentEval,
  isBoardOpen = true,
  onToggleBoard,
  onOpenBoard,
  onApplyFen,
  onApplyMove,
  messages: externalMessages,
  setMessages: externalSetMessages,
  isSidebarOpen,
  onToggleSidebar,
  pendingPrompt,
  onClearPendingPrompt,
  onNewChat,
  suggestedQuestions,
  heightClass,
}: AiAssistantChatProps) {
  const [internalMessages, setInternalMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Xin chào! Tôi là Trợ lí AI phân tích cờ vua. Tôi đã nạp toàn bộ biên bản ván đấu PGN của **${playerName || "Kỳ thủ"}** và kết nối trực tiếp với bàn cờ.\n\nBạn có thể hỏi tôi bất kỳ điều gì về các ván đấu, khai cuộc, phong cách thi đấu, hoặc đi thử một nước cờ trên bàn cờ rồi hỏi tôi nhận xét!`,
    },
  ]);

  const messages = externalMessages ?? internalMessages;
  const setMessages = externalSetMessages ?? setInternalMessages;

  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Check if AI requested to open the board via [OPEN_BOARD] or [OPEN_BOARD: <fen>]
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === "assistant" && lastMsg.content) {
      const match = lastMsg.content.match(/\[OPEN_BOARD(?::\s*([^\]]+))?\]/i);
      if (match) {
        const fen = match[1]?.trim();
        onOpenBoard?.(fen);
      }
    }
  }, [messages, onOpenBoard]);

  // Handle external prompt triggers (e.g. "Hỏi AI về thế cờ này")
  useEffect(() => {
    if (pendingPrompt && !isStreaming) {
      handleSendMessage(pendingPrompt);
      onClearPendingPrompt?.();
    }
  }, [pendingPrompt]);

  const handleCopyMessage = (text: string, idx: number) => {
    const clean = text.replace(/\[OPEN_BOARD(?::\s*([^\]]+))?\]/gi, "").trim();
    navigator.clipboard.writeText(clean);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isStreaming) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text, fen: currentFen }];
    setMessages(newMessages);
    setInputMessage("");
    setIsStreaming(true);

    // Append empty assistant message for streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "", fen: currentFen }]);

    await apiClient.chatAiStream(
      {
        run_id: runId,
        player_id: playerId,
        message: text,
        perspective_mode: "neutral",
        history: newMessages,
        current_fen: currentFen,
        is_board_open: isBoardOpen,
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
    <div className="flex flex-col w-full h-full bg-card border border-border/60 rounded-2xl overflow-hidden shadow-xs">
      {/* Top Chat Header Bar */}
      <div className="h-12 shrink-0 px-3.5 border-b border-border/60 flex items-center justify-between gap-2 bg-card/60 backdrop-blur-xs">
        <div className="flex items-center gap-2 min-w-0">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              title={isSidebarOpen ? "Đóng danh sách lịch sử" : "Mở danh sách lịch sử"}
              className="p-1.5 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}

          <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-2xs shrink-0">
            <Brain className="w-4 h-4" />
          </div>

          <div className="truncate min-w-0">
            <h3 className="font-bold text-foreground text-xs sm:text-sm truncate flex items-center gap-1.5">
              <span>Trợ Lí AI Cờ Vua</span>
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.2 text-[10px] font-extrabold uppercase rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40">
                <Zap className="w-2.5 h-2.5 text-emerald-600" />
                Gemini 3.8
              </span>
            </h3>
          </div>
        </div>

        {/* Right header controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Board Toggle Button */}
          {onToggleBoard && (
            <button
              type="button"
              onClick={onToggleBoard}
              title={isBoardOpen ? "Thu gọn bàn cờ để chat toàn màn hình" : "Mở bàn cờ tương tác"}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                isBoardOpen
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300/50"
                  : "bg-muted text-muted-foreground hover:text-foreground border border-border/70"
              }`}
            >
              {isBoardOpen ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">Bàn cờ:</span>
              <span className="font-bold">{isBoardOpen ? "BẬT" : "TẮT"}</span>
            </button>
          )}

          {/* New Chat Button */}
          {onNewChat && (
            <button
              type="button"
              onClick={onNewChat}
              title="Tạo đoạn chat mới"
              className="p-1.5 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* When Board is Closed Notice Banner */}
      {!isBoardOpen && (
        <div className="px-4 py-2 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border-b border-emerald-500/20 flex items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-medium">
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>Bàn cờ tương tác đang tắt. AI sẽ trả lời toàn diện qua PGN hoặc tự mở bàn cờ khi cần thiết.</span>
          </div>
          {onToggleBoard && (
            <button
              type="button"
              onClick={onToggleBoard}
              className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition cursor-pointer shrink-0"
            >
              Mở bàn cờ
            </button>
          )}
        </div>
      )}

      {/* Chat Messages Stream Log */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-4">
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
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                  isBot
                    ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                    : "bg-slate-800 dark:bg-slate-750 text-white"
                }`}
              >
                {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              {/* Message Bubble Container */}
              <div className="flex flex-col gap-1 max-w-[90%] sm:max-w-[85%]">
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
                        messageFen={msg.fen}
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
                          type="button"
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

      {/* Input Bar pinned to bottom */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 border-t border-border/60 bg-card flex items-center gap-2 shrink-0"
      >
        <input
          ref={inputRef}
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder={
            isBoardOpen
              ? "Hỏi về thế cờ trên bàn cờ, khai cuộc, hoặc ván đấu trong PGN..."
              : "Nhập câu hỏi phân tích (AI có thể tự mở bàn cờ để minh họa)..."
          }
          disabled={isStreaming}
          className="flex-1 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 dark:text-white placeholder:text-muted-foreground transition"
        />
        <button
          type="submit"
          disabled={!inputMessage.trim() || isStreaming}
          className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 font-bold text-xs sm:text-sm shrink-0 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Gửi</span>
        </button>
      </form>
    </div>
  );
}
