"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Brain,
  Send,
  User,
  Bot,
  Copy,
  Check,
  RotateCcw,
  Layers,
  PanelLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiClient } from "@/lib/api/client";
import { isFenString, normalizeFen, sanitizeAndBoldChessText, convertUciToSan } from "@/lib/chess/notation";

export interface Message {
  role: "user" | "assistant";
  content: string;
  fen?: string;
}

interface AiAssistantChatProps {
  runId?: string;
  playerId?: string;
  playerIds?: string[];
  playerName?: string;
  gamesCount?: number;
  currentFen?: string;
  currentEval?: any;
  selectedGame?: any;
  activeMoves?: string[];
  currentPly?: number;
  isBoardOpen?: boolean;
  onToggleBoard?: () => void;
  onOpenBoard?: (fen?: string) => void;
  onApplyFen?: (fen: string) => void;
  messages?: Message[];
  setMessages?: React.Dispatch<React.SetStateAction<Message[]>>;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  pendingPrompt?: string | null;
  onClearPendingPrompt?: () => void;
  onNewChat?: () => void;
  onStreamComplete?: () => void;
  suggestedQuestions?: string[];
  heightClass?: string;
}

/**
 * Rich Markdown Renderer with interactive FEN click triggers
 */
const MarkdownRenderer = React.memo(function MarkdownRenderer({
  content,
  currentFen,
  onApplyFen,
}: {
  content: string;
  currentFen?: string;
  onApplyFen?: (fen: string) => void;
}) {
  // Clean internal tags, raw coordinates, and auto-bold chess notations, squares and pieces
  const cleanContent = useMemo(() => {
    return sanitizeAndBoldChessText(content, currentFen);
  }, [content, currentFen]);

  const components = useMemo(
    () => ({
      h1: ({ children }: any) => (
        <h1 className="text-base font-bold text-slate-900 mt-3 mb-2 flex items-center gap-1.5 border-b border-slate-200 pb-1">
          {children}
        </h1>
      ),
      h2: ({ children }: any) => (
        <h2 className="text-sm font-bold text-slate-900 mt-3 mb-1.5 flex items-center gap-1.5">
          {children}
        </h2>
      ),
      h3: ({ children }: any) => (
        <h3 className="text-sm font-semibold text-slate-900 mt-2.5 mb-1.5 pb-1 border-b border-slate-200 flex items-center gap-1.5">
          {children}
        </h3>
      ),
      h4: ({ children }: any) => (
        <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mt-2.5 mb-1">
          {children}
        </h4>
      ),
      p: ({ children }: any) => (
        <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200 mb-2 last:mb-0">
          {children}
        </p>
      ),
      ul: ({ children }: any) => (
        <ul className="space-y-1.5 my-2 pl-4 list-disc marker:text-emerald-500 text-sm">
          {children}
        </ul>
      ),
      ol: ({ children }: any) => (
        <ol className="space-y-2 my-2 pl-4 list-decimal marker:text-emerald-600 font-semibold text-sm">
          {children}
        </ol>
      ),
      li: ({ children }: any) => (
        <li className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
          {children}
        </li>
      ),
      strong: ({ children }: any) => (
        <strong className="font-semibold text-slate-900 dark:text-slate-100">
          {children}
        </strong>
      ),
      code: ({ children }: any) => {
        const strVal = String(children).trim();
        if (isFenString(strVal) && onApplyFen) {
          return (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onApplyFen(normalizeFen(strVal));
              }}
              title="Bấm để hiển thị thế cờ này lên bàn cờ"
              className="inline-flex items-center gap-1 px-2 py-0.5 mx-1 rounded-md font-mono text-xs bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
            >
              <Layers className="w-3 h-3 text-emerald-600" />
              <span>[Xem thế cờ trên Bàn cờ]</span>
            </button>
          );
        }

        // Clean inline text without borders, background box or rounded corners.
        // Uses the same natural sans-serif font family, matching text-sm size, and gentle semibold weight.
        // Also strips any accidental asterisks inside code blocks as a bulletproof safeguard.
        const cleanText = typeof children === "string" ? children.replace(/\*\*/g, "") : children;
        return (
          <span className="font-sans font-semibold text-slate-900 dark:text-slate-100">
            {cleanText}
          </span>
        );
      },
      blockquote: ({ children }: any) => (
        <blockquote className="border-l border-emerald-500 pl-3 py-1.5 my-2 bg-emerald-50/40 text-slate-800 italic text-xs rounded-r">
          {children}
        </blockquote>
      ),
      hr: () => (
        <hr className="my-3 border-t border-border/80" />
      ),
      table: ({ children }: any) => (
        <div className="overflow-x-auto my-2 rounded border border-border">
          <table className="w-full text-xs text-left border-collapse">{children}</table>
        </div>
      ),
      th: ({ children }: any) => (
        <th className="bg-muted px-3 py-2 font-bold border-b border-border text-foreground">
          {children}
        </th>
      ),
      td: ({ children }: any) => (
        <td className="px-3 py-2 border-b border-border/60 text-foreground">
          {children}
        </td>
      ),
    }),
    [onApplyFen]
  );

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {cleanContent}
    </ReactMarkdown>
  );
});

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
    <div className="flex items-center gap-3.5 p-3 rounded-md bg-muted/50 border border-border/60 animate-fade-in">
      <div className="relative flex items-center justify-center w-8 h-8 rounded-md bg-emerald-600 text-white shrink-0">
        <Brain className="w-4 h-4 animate-pulse" />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-800 tracking-tight">
            Trợ lí AI đang suy nghĩ
          </span>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground font-medium transition-all duration-300">
          {steps[stepIndex]}
        </p>
      </div>
    </div>
  );
}

export default function AiAssistantChat({
  runId = "default_run",
  playerId = "",
  playerIds,
  playerName = "Kỳ thủ",
  gamesCount,
  currentFen,
  currentEval,
  selectedGame,
  activeMoves,
  currentPly,
  isBoardOpen = true,
  onToggleBoard,
  onOpenBoard,
  onApplyFen,
  messages: externalMessages,
  setMessages: externalSetMessages,
  isSidebarOpen,
  onToggleSidebar,
  pendingPrompt,
  onClearPendingPrompt,
  onNewChat,
  onStreamComplete,
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleApplyFen = useCallback(
    (fen: string) => {
      if (!onApplyFen) return;
      const container = scrollContainerRef.current;
      const savedTop = container ? container.scrollTop : null;

      onApplyFen(fen);

      if (savedTop !== null && container) {
        requestAnimationFrame(() => {
          if (container) container.scrollTop = savedTop;
        });
        setTimeout(() => {
          if (container) container.scrollTop = savedTop;
        }, 50);
      }
    },
    [onApplyFen]
  );

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
        onOpenBoard?.(fen ? normalizeFen(fen) : undefined);
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

    // Snapshot existing messages for AI history context before appending new turn
    const historyForAi = [...messages];

    // Atomically append user message AND initial assistant message for streaming
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: text, fen: currentFen },
      { role: "assistant", content: "", fen: currentFen },
    ];
    setMessages(newMessages);
    setInputMessage("");
    setIsStreaming(true);

    const targetPlayerId = (!playerId || playerId === "general") ? "" : playerId;
    const targetRunId = (!runId || runId === "run-general" || runId === "general" || runId === "default_run") ? "general" : runId;

    await apiClient.chatAiStream(
      {
        run_id: targetRunId,
        player_id: targetPlayerId,
        player_ids: playerIds && playerIds.length > 0 ? playerIds : (targetPlayerId ? [targetPlayerId] : undefined),
        message: text,
        perspective_mode: "neutral",
        history: historyForAi,
        current_fen: currentFen,
        is_board_open: isBoardOpen,
        selected_game: (selectedGame || (activeMoves && activeMoves.length > 0)) ? {
          id: selectedGame?.id || "interactive-board-game",
          white: selectedGame?.white_player || selectedGame?.white || (playerName ? `${playerName} (Trắng)` : "Trắng"),
          black: selectedGame?.black_player || selectedGame?.black || "Đen",
          white_elo: selectedGame?.white_elo || (selectedGame?.raw_headers as any)?.WhiteElo || "",
          black_elo: selectedGame?.black_elo || (selectedGame?.raw_headers as any)?.BlackElo || "",
          result: selectedGame?.result || "*",
          eco: selectedGame?.eco || "",
          opening: selectedGame?.opening_name || selectedGame?.opening || "",
          date: selectedGame?.played_at || selectedGame?.date || (selectedGame?.raw_headers as any)?.Date || (selectedGame?.raw_headers as any)?.UTCDate || "",
          event: (selectedGame?.raw_headers as any)?.Event || selectedGame?.event || "",
          site: selectedGame?.site_url || (selectedGame?.raw_headers as any)?.Site || (selectedGame?.raw_headers as any)?.Link || "",
          round: (selectedGame?.raw_headers as any)?.Round || selectedGame?.round || "",
          time_control: selectedGame?.time_control || (selectedGame?.raw_headers as any)?.TimeControl || "",
          moves_san: selectedGame?.moves_san || (Array.isArray(selectedGame?.moves) ? selectedGame.moves.join(" ") : (activeMoves ? activeMoves.join(" ") : "")),
          current_ply: currentPly ?? 0,
          total_ply: (activeMoves && activeMoves.length > 0) ? activeMoves.length : (selectedGame?.moves_san ? selectedGame.moves_san.split(/\s+/).filter(Boolean).length : (Array.isArray(selectedGame?.moves) ? selectedGame.moves.length : 0)),
          raw_headers: selectedGame?.raw_headers || {},
        } : undefined,
        engine_eval: currentEval ? {
          score: currentEval.score,
          scoreType: currentEval.scoreType,
          bestMove: currentEval.bestMove,
          bestMoveSan: currentEval.bestMoveSan || (currentEval.bestMove && currentFen ? convertUciToSan(currentFen, currentEval.bestMove) : undefined),
          depth: currentEval.depth,
          pv: currentEval.pv,
          pvs: currentEval.pvs,
        } : undefined,
      },
      {
        onChunk: (chunk) => {
          setMessages((prev) => {
            if (!prev || prev.length === 0) return prev;
            const lastIdx = prev.length - 1;
            const updated = [...prev];
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: (updated[lastIdx].content || "") + chunk,
            };
            return updated;
          });
        },
        onDone: () => {
          setIsStreaming(false);
          onStreamComplete?.();
        },
        onError: (err) => {
          setIsStreaming(false);
          setMessages((prev) => {
            if (!prev || prev.length === 0) return prev;
            const lastIdx = prev.length - 1;
            const updated = [...prev];
            updated[lastIdx] = {
              ...updated[lastIdx],
              content: (updated[lastIdx].content || "") + `\n\n*(Lỗi kết nối: ${err.message})*`,
            };
            return updated;
          });
          onStreamComplete?.();
        },
      }
    );
  };

  return (
    <div className="flex flex-col w-full h-full min-w-0 bg-card border border-border/60 rounded-md overflow-hidden">
      {/* Top Chat Header Bar */}
      <div className="h-12 shrink-0 px-3.5 border-b border-border/60 flex items-center justify-between gap-2 bg-card">
        <div className="flex items-center gap-2 min-w-0">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              title={isSidebarOpen ? "Đóng danh sách lịch sử" : "Mở danh sách lịch sử"}
              className="p-1.5 rounded border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}

          <div className="p-1.5 rounded bg-emerald-600 text-white shrink-0">
            <Brain className="w-4 h-4" />
          </div>

          <div className="truncate min-w-0">
            <h3 className="font-bold text-foreground text-xs sm:text-sm truncate flex items-center gap-1.5">
              <span>Trợ Lí AI Cờ Vua</span>
              <span className="hidden md:inline-flex text-[11px] font-medium text-muted-foreground truncate">
                • {playerId && playerId !== "general" ? playerName : "Trò chuyện tự do"}
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
              className={`px-2.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                isBoardOpen
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-muted text-muted-foreground hover:text-foreground border-border/70"
              }`}
              title={isBoardOpen ? "Ẩn bàn cờ tương tác" : "Hiện bàn cờ tương tác"}
            >
              {isBoardOpen ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>Bàn cờ:</span>
              <span className="uppercase font-bold">{isBoardOpen ? "Bật" : "Tắt"}</span>
            </button>
          )}

          {/* New Chat Button */}
          {onNewChat && (
            <button
              type="button"
              onClick={onNewChat}
              title="Tạo đoạn chat mới"
              className="p-1.5 rounded border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* When Board is Closed Notice Banner */}
      {!isBoardOpen && (
        <div className="px-4 py-2 bg-muted/40 border-b border-border/60 flex items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>Bàn cờ tương tác đang tắt. AI sẽ trả lời toàn diện qua PGN hoặc tự mở bàn cờ khi cần thiết.</span>
          </div>
          {onToggleBoard && (
            <button
              type="button"
              onClick={onToggleBoard}
              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition cursor-pointer shrink-0"
            >
              Mở bàn cờ
            </button>
          )}
        </div>
      )}

      {/* Chat Messages Stream Log */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-4">
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
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center shrink-0 ${
                  isBot
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-800 text-white"
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
                    className={`relative rounded-md px-4 py-3 leading-relaxed ${
                      isBot
                        ? "bg-slate-50 text-slate-900 border border-border/80"
                        : "bg-emerald-600 text-white"
                    }`}
                  >
                    {isBot ? (
                      <MarkdownRenderer
                        content={msg.content}
                        currentFen={currentFen}
                        onApplyFen={handleApplyFen}
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
                          className="p-1 rounded bg-white/90 text-slate-600 hover:text-emerald-600 border border-border/80 transition"
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
          className="flex-1 bg-background border border-border/70 rounded px-3.5 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
        />
        <button
          type="submit"
          disabled={!inputMessage.trim() || isStreaming}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded transition flex items-center gap-1.5 font-semibold text-xs sm:text-sm shrink-0 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Gửi</span>
        </button>
      </form>
    </div>
  );
}
