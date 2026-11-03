"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Bot,
  MessageSquare,
  X,
  Minus,
  Maximize2,
  Send,
  Plus,
  Loader2,
  Copy,
  Check,
  Sparkles,
  TrendingUp,
  User,
  ChevronRight,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiClient } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";
import { useProfileWorkspaceStore } from "@/lib/stores/profileWorkspaceStore";
import { Game } from "@/lib/api/types";
import { EngineEvaluation } from "@/lib/stockfish/engineWorker";

export interface FloatingAiChatWidgetProps {
  currentFen: string;
  currentPly?: number;
  evaluation?: EngineEvaluation | null;
  gameInfo?: Game | null;
  effectivePlayerId?: string | null;
  playerName?: string;
  moves?: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  fen?: string;
}

const supabase = createClient();

export default function FloatingAiChatWidget({
  currentFen,
  currentPly = 0,
  evaluation,
  gameInfo,
  effectivePlayerId,
  playerName,
  moves = [],
}: FloatingAiChatWidgetProps) {
  const workspaceStore = useProfileWorkspaceStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Active chat session state
  const [sessionId, setSessionId] = useState<string>(() => `mini-session-${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentSessionIdRef = useRef(sessionId);
  currentSessionIdRef.current = sessionId;

  // 1. Check Auth User on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user || null);
    });
  }, []);

  // 2. Default Welcome Message
  const getWelcomeMessage = useCallback(
    (name?: string): ChatMessage => ({
      role: "assistant",
      content: name
        ? `Xin chào! Tôi là Trợ lí AI phân tích cờ vua. Tôi đang theo dõi bàn cờ phân tích của **${name}**.\n\nBạn có thể hỏi tôi bất kỳ điều gì về thế cờ hiện tại, đánh giá ưu thế, đòn phối hợp hoặc phong cách xử lý của kì thủ này!`
        : `Xin chào! Tôi là Trợ lí AI phân tích cờ vua. Tôi đang theo dõi thế cờ trên bàn cờ phân tích.\n\nBạn có thể hỏi tôi bất kỳ điều gì về thế cờ này, đánh giá Stockfish, đòn chiến thuật hoặc kế hoạch tiếp theo!`,
    }),
    []
  );

  // 3. Load or initialize session tagged by effectivePlayerId
  useEffect(() => {
    let isSubscribed = true;

    async function initSession() {
      const pid = effectivePlayerId || "";
      let foundSession: any = null;

      try {
        if (currentUser?.id) {
          // Authenticated: Query DB
          const sessions = await apiClient.getAiChatSessions().catch(() => []);
          if (sessions && sessions.length > 0) {
            foundSession = sessions.find((s) =>
              pid ? s.player_ids?.includes(pid) : s.player_ids?.length === 0
            );
          }
        } else if (typeof window !== "undefined") {
          // Guest: Query SessionStorage
          const guestId = sessionStorage.getItem("chess_guest_session_id") || "guest";
          const raw = sessionStorage.getItem(`chess_guest_ai_conversations_${guestId}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              foundSession = parsed.find((s: any) =>
                pid ? s.playerIds?.includes(pid) : s.playerIds?.length === 0
              );
            }
          }
        }
      } catch (err) {
        console.warn("Failed to find existing tagged session:", err);
      }

      if (!isSubscribed) return;

      if (foundSession && foundSession.messages && foundSession.messages.length > 0) {
        setSessionId(foundSession.id);
        setMessages(
          foundSession.messages.map((m: any) => ({
            role: m.role || "user",
            content: m.content || "",
            fen: m.fen,
          }))
        );
      } else {
        const newId = `session-${Date.now()}`;
        setSessionId(newId);
        setMessages([getWelcomeMessage(playerName)]);
      }
    }

    initSession();

    return () => {
      isSubscribed = false;
    };
  }, [effectivePlayerId, playerName, currentUser, getWelcomeMessage]);

  // 4. Auto scroll to bottom of chat
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isMinimized, isStreaming]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isMinimized]);

  // 5. Persist session helper
  const persistSession = useCallback(
    async (currentMsgs: ChatMessage[], sid: string) => {
      const realMessages = currentMsgs.filter(
        (m, idx) => !(idx === 0 && m.role === "assistant" && !currentMsgs.some((x) => x.role === "user"))
      );
      if (realMessages.length === 0) return;

      const title =
        realMessages.find((m) => m.role === "user")?.content.slice(0, 40) ||
        (playerName ? `Phân tích: ${playerName}` : "Phân tích thế cờ");

      const pids = effectivePlayerId ? [effectivePlayerId] : [];

      if (currentUser?.id) {
        try {
          await apiClient.createAiChatSession({
            id: sid,
            player_ids: pids,
            title,
            messages: realMessages,
          });
        } catch {
          try {
            await apiClient.updateAiChatSession(sid, {
              player_ids: pids,
              title,
              messages: realMessages,
            });
          } catch (e) {
            console.warn("Could not sync session to DB:", e);
          }
        }

        // Also save to user-scoped localStorage backup
        if (typeof window !== "undefined") {
          try {
            const userKey = `chess_ai_conversations_user_${currentUser.id}`;
            const raw = localStorage.getItem(userKey);
            const list = raw ? JSON.parse(raw) : [];
            const existingIdx = list.findIndex((s: any) => s.id === sid);
            const sessionObj = {
              id: sid,
              user_id: currentUser.id,
              playerIds: pids,
              title,
              pinned: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              messages: realMessages,
              isDraft: false,
            };
            if (existingIdx >= 0) {
              list[existingIdx] = sessionObj;
            } else {
              list.unshift(sessionObj);
            }
            localStorage.setItem(userKey, JSON.stringify(list));
          } catch (err) {
            console.warn("Could not save to local storage:", err);
          }
        }
      } else if (typeof window !== "undefined") {
        // Guest mode
        try {
          const guestId = sessionStorage.getItem("chess_guest_session_id") || "guest";
          const key = `chess_guest_ai_conversations_${guestId}`;
          const raw = sessionStorage.getItem(key);
          const list = raw ? JSON.parse(raw) : [];
          const existingIdx = list.findIndex((s: any) => s.id === sid);
          const sessionObj = {
            id: sid,
            playerIds: pids,
            title,
            pinned: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: realMessages,
            isDraft: false,
          };
          if (existingIdx >= 0) {
            list[existingIdx] = sessionObj;
          } else {
            list.unshift(sessionObj);
          }
          sessionStorage.setItem(key, JSON.stringify(list));
        } catch (err) {
          console.warn("Could not save guest session:", err);
        }
      }

      workspaceStore.bumpChatSessionsVersion();
    },
    [currentUser, effectivePlayerId, playerName, workspaceStore]
  );

  // 6. Handle Send Message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isStreaming) return;

    const historyForAi = [...messages];
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: text, fen: currentFen },
      { role: "assistant", content: "", fen: currentFen },
    ];

    setMessages(newMessages);
    setInputMessage("");
    setIsStreaming(true);

    const targetPlayerId = effectivePlayerId || "";
    const activeSid = currentSessionIdRef.current;

    await apiClient.chatAiStream(
      {
        run_id: "general",
        player_id: targetPlayerId,
        player_ids: targetPlayerId ? [targetPlayerId] : undefined,
        message: text,
        perspective_mode: "neutral",
        history: historyForAi,
        current_fen: currentFen,
        is_board_open: true,
        selected_game: gameInfo
          ? {
              id: gameInfo.id,
              white: gameInfo.white_player || "Trắng",
              black: gameInfo.black_player || "Đen",
              white_elo: gameInfo.white_elo || "",
              black_elo: gameInfo.black_elo || "",
              result: gameInfo.result || "*",
              eco: gameInfo.eco || "",
              opening: gameInfo.opening_name || "",
              moves_san: gameInfo.moves_san || moves.join(" "),
              current_ply: currentPly,
              total_ply: moves.length,
            }
          : undefined,
        engine_eval: evaluation
          ? {
              score: evaluation.score,
              scoreType: evaluation.scoreType,
              bestMove: evaluation.bestMove,
              depth: evaluation.depth,
              pv: evaluation.pv,
              pvs: evaluation.pvs,
            }
          : undefined,
      },
      {
        onChunk: (chunk) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              next[next.length - 1] = {
                ...last,
                content: last.content + chunk,
              };
            }
            return next;
          });
        },
        onError: (err) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              next[next.length - 1] = {
                ...last,
                content:
                  last.content +
                  `\n\n*(Lỗi kết nối AI: ${err.message || "Không thể kết nối máy chủ"}. Vui lòng thử lại.)*`,
              };
            }
            return next;
          });
          setIsStreaming(false);
        },
        onDone: () => {
          setIsStreaming(false);
          // Persist session after stream completes
          setMessages((latest) => {
            persistSession(latest, activeSid);
            return latest;
          });
        },
      }
    );
  };

  // 7. Handle New Chat Session
  const handleNewChat = () => {
    const newId = `session-${Date.now()}`;
    setSessionId(newId);
    setMessages([getWelcomeMessage(playerName)]);
    setInputMessage("");
  };

  // 8. Handle Expand to AI Coach (Seamless 100% Context Handoff)
  const handleExpandToAiCoach = async () => {
    await persistSession(messages, sessionId);

    // Handoff session ID and active game to workspaceStore
    workspaceStore.setActiveChatSessionId(sessionId);
    if (gameInfo) {
      workspaceStore.analyzeGame(gameInfo);
    }

    // Switch to AI Coach tab
    workspaceStore.setActiveTab("ai");
    setIsMinimized(true);
  };

  const handleCopyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const currentMoveLabel = useMemo(() => {
    if (currentPly === 0) return "Thế cờ ban đầu";
    const moveNum = Math.floor((currentPly - 1) / 2) + 1;
    const isWhite = (currentPly - 1) % 2 === 0;
    return `Nước ${moveNum} (${isWhite ? "Trắng" : "Đen"})`;
  }, [currentPly]);

  const evalSummary = useMemo(() => {
    if (!evaluation) return null;
    if (evaluation.isMate) {
      const mate = evaluation.mateIn ?? evaluation.score;
      return mate > 0 ? `#M${mate} (Trắng thắng)` : `#M${Math.abs(mate)} (Đen thắng)`;
    }
    const cp = evaluation.score / 100;
    return `${cp > 0 ? "+" : ""}${cp.toFixed(2)}`;
  }, [evaluation]);

  return (
    <>
      {/* 1. Floating Action Button (FAB) */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 animate-fade-in">
          {/* Helpful tooltip badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/95 backdrop-blur-md border border-border/80 shadow-lg text-xs font-semibold text-foreground select-none pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Hỏi đáp AI {playerName ? `• ${playerName}` : ""}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
            }}
            title="Mở Boxchat hỏi đáp thế cờ với Trợ lí AI"
            className="group relative w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center cursor-pointer border border-white/20"
          >
            <Bot className="w-6 h-6 sm:w-7 sm:h-7 transition-transform group-hover:rotate-6" />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
            </span>
          </button>
        </div>
      )}

      {/* 2. Floating Mini Chat Window */}
      {isOpen && (
        <div
          className={`fixed right-4 sm:right-6 bottom-4 sm:bottom-6 z-50 transition-all duration-200 flex flex-col bg-card/95 backdrop-blur-md border border-border/80 rounded-2xl shadow-2xl overflow-hidden ${
            isMinimized
              ? "w-[300px] h-12"
              : "w-[360px] sm:w-[410px] h-[520px] sm:h-[560px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-80px)]"
          }`}
        >
          {/* Header */}
          <div className="h-12 px-3.5 bg-muted/60 border-b border-border/70 flex items-center justify-between shrink-0 select-none">
            {/* Title & Tag */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground truncate">
                    {playerName ? playerName : "Trợ lí AI Thế cờ"}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                </div>
                <p className="text-[10px] text-muted-foreground truncate leading-tight">
                  {currentMoveLabel} {evalSummary ? `• ${evalSummary}` : ""}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
              {/* New chat */}
              {!isMinimized && (
                <button
                  type="button"
                  onClick={handleNewChat}
                  title="Bắt đầu đoạn chat mới với kì thủ này"
                  className="p-1.5 rounded-md hover:bg-background/80 hover:text-foreground transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Expand to full AI Coach */}
              <button
                type="button"
                onClick={handleExpandToAiCoach}
                title="Mở rộng sang trang Trợ lí AI toàn diện (Bảo toàn 100% ngữ cảnh)"
                className="p-1.5 rounded-md hover:bg-emerald-50 hover:text-emerald-700 transition cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>

              {/* Minimize / Restore */}
              <button
                type="button"
                onClick={() => setIsMinimized((prev) => !prev)}
                title={isMinimized ? "Mở rộng lại boxchat" : "Thu nhỏ boxchat"}
                className="p-1.5 rounded-md hover:bg-background/80 hover:text-foreground transition cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Đóng boxchat"
                className="p-1.5 rounded-md hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Body Content (Hidden when minimized) */}
          {!isMinimized && (
            <>
              {/* Quick Action Pills */}
              <div className="px-3 py-2 bg-background/50 border-b border-border/50 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                <button
                  type="button"
                  onClick={() => handleSendMessage(`Đánh giá thế cờ hiện tại ở ${currentMoveLabel}?`)}
                  disabled={isStreaming}
                  className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 transition cursor-pointer disabled:opacity-50"
                >
                  🎯 Đánh giá thế cờ này
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage(`Kế hoạch chiến thuật khả dĩ tiếp theo cho bên đi là gì?`)}
                  disabled={isStreaming}
                  className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium bg-secondary hover:bg-secondary/80 text-foreground border border-border/60 transition cursor-pointer disabled:opacity-50"
                >
                  💡 Kế hoạch tiếp theo
                </button>
                {playerName && (
                  <button
                    type="button"
                    onClick={() =>
                      handleSendMessage(`Kì thủ ${playerName} thường xử lý các tình huống tương tự thế cờ này như thế nào?`)
                    }
                    disabled={isStreaming}
                    className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium bg-secondary hover:bg-secondary/80 text-foreground border border-border/60 transition cursor-pointer disabled:opacity-50"
                  >
                    ♟️ Thói quen kì thủ
                  </button>
                )}
              </div>

              {/* Messages Scroll Area */}
              <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-3.5 space-y-3.5 text-xs">
                {messages.map((m, idx) => {
                  const isUser = m.role === "user";
                  return (
                    <div
                      key={idx}
                      className={`flex gap-2.5 items-start ${isUser ? "flex-row-reverse" : "flex-row"}`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold ${
                          isUser
                            ? "bg-slate-800 text-white"
                            : "bg-emerald-600 text-white shadow-xs"
                        }`}
                      >
                        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                      </div>

                      {/* Content Bubble */}
                      <div
                        className={`relative max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                          isUser
                            ? "bg-emerald-600 text-white rounded-tr-xs"
                            : "bg-muted/70 text-foreground border border-border/60 rounded-tl-xs"
                        }`}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        ) : (
                          <div className="prose prose-xs dark:prose-invert max-w-none break-words text-slate-800 dark:text-slate-200">
                            {m.content ? (
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {m.content.replace(/\[OPEN_BOARD(?::\s*([^\]]+))?\]/gi, "").trim()}
                              </ReactMarkdown>
                            ) : isStreaming && idx === messages.length - 1 ? (
                              <div className="flex items-center gap-1.5 py-1 text-muted-foreground">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                                <span className="text-[11px] italic">Đang phân tích thế cờ...</span>
                              </div>
                            ) : null}
                          </div>
                        )}

                        {/* Copy button for Assistant */}
                        {!isUser && m.content && (
                          <div className="mt-1 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(m.content, idx)}
                              title="Sao chép câu trả lời"
                              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition cursor-pointer p-0.5"
                            >
                              {copiedIdx === idx ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-600">Đã chép</span>
                                </>
                              ) : (
                                <Copy className="w-3 h-3 opacity-60 hover:opacity-100" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Footer */}
              <div className="p-2.5 sm:p-3 bg-muted/40 border-t border-border/70 shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={`Hỏi về ${currentMoveLabel}...`}
                    disabled={isStreaming}
                    className="flex-1 min-w-0 bg-background border border-border/80 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none transition disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim() || isStreaming}
                    title="Gửi câu hỏi"
                    className="h-8.5 w-8.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white flex items-center justify-center shrink-0 shadow-xs transition cursor-pointer"
                  >
                    {isStreaming ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
