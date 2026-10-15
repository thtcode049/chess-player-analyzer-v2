"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Brain,
  RotateCcw,
  Layers,
  RotateCw,
  Folder,
  FolderOpen,
  MessageSquare,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  PanelLeft,
  PanelLeftClose,
  TrendingUp,
  User,
  Database,
  Copy,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";
import { Chess } from "chess.js";
import ChessBoard from "@/components/chess/ChessBoard";
import AiAssistantChat from "@/components/ai/AiAssistantChat";
import { apiClient } from "@/lib/api/client";
import { Player, Game } from "@/lib/api/types";
import { EngineEvaluation } from "@/lib/stockfish/engineWorker";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const STORAGE_KEY = "chess_ai_conversations_v3";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSession {
  id: string;
  playerId: string;
  playerName: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "Vừa xong";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d`;
  return new Date(timestamp).toLocaleDateString("vi-VN", { month: "numeric", day: "numeric" });
}

function createDefaultSession(playerId: string, playerName: string): ChatSession {
  return {
    id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    playerId: playerId || "default",
    playerName: playerName || "Kỳ thủ",
    title: "Đoạn chat mới",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [
      {
        role: "assistant",
        content: `Xin chào! Tôi là Trợ lí AI phân tích cờ vua. Tôi đã nạp toàn bộ biên bản ván đấu PGN của **${playerName || "Kỳ thủ"}** và kết nối trực tiếp với bàn cờ.\n\nBạn có thể hỏi tôi bất kỳ điều gì về các ván đấu, khai cuộc, phong cách thi đấu, hoặc đi thử một nước cờ trên bàn cờ rồi hỏi tôi nhận xét!`,
      },
    ],
  };
}

export default function AiCoachPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [playerGames, setPlayerGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>("");

  // UI layout toggles
  const [isBoardOpen, setIsBoardOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Board state
  const [currentFen, setCurrentFen] = useState<string>(START_FEN);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [currentPly, setCurrentPly] = useState<number>(0);
  const [activeMoves, setActiveMoves] = useState<string[]>([]);
  const [currentEval, setCurrentEval] = useState<EngineEvaluation | null>(null);
  const [isEngineThinking, setIsEngineThinking] = useState(false);
  const [copiedFen, setCopiedFen] = useState(false);

  // Chat sessions state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Prompt trigger from Board
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  // 1. Fetch Players on mount
  useEffect(() => {
    apiClient
      .getPlayers()
      .then((data) => {
        const list = data || [];
        setPlayers(list);
        if (list.length > 0) {
          setSelectedPlayerId((prev) => prev || list[0].id);
        }
      })
      .catch(() => {
        setSelectedPlayerId("00000000-0000-0000-0000-000000000001");
      });
  }, []);

  // 2. Load Chat Sessions from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: ChatSession[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          setActiveSessionId(parsed[0].id);
          // Set initial expanded folder for the first session's player
          setExpandedFolders({ [parsed[0].playerId]: true });
          return;
        }
      }
    } catch (e) {
      console.warn("Failed to read chat sessions from localStorage:", e);
    }
  }, []);

  // 3. Save Chat Sessions to localStorage
  useEffect(() => {
    if (typeof window === "undefined" || sessions.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.warn("Failed to save chat sessions to localStorage:", e);
    }
  }, [sessions]);

  // Selected player object
  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);
  const currentPlayerName = selectedPlayer?.canonical_name || "Kỳ thủ";

  // 4. Ensure an active session exists whenever selectedPlayerId changes
  useEffect(() => {
    if (!selectedPlayerId) return;

    // Expand the current player folder in sidebar
    setExpandedFolders((prev) => ({ ...prev, [selectedPlayerId]: true }));

    // Find if there is an existing session for this player
    const existingForPlayer = sessions.find((s) => s.playerId === selectedPlayerId);
    if (!activeSessionId || (activeSession && activeSession.playerId !== selectedPlayerId)) {
      if (existingForPlayer) {
        setActiveSessionId(existingForPlayer.id);
      } else {
        const newSession = createDefaultSession(selectedPlayerId, currentPlayerName);
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
      }
    }
  }, [selectedPlayerId, players]);

  // 5. Fetch Player Games when selected player changes
  useEffect(() => {
    if (!selectedPlayerId) return;

    // Reset board to start
    setCurrentFen(START_FEN);
    setActiveMoves([]);
    setCurrentPly(0);
    setSelectedGameId("");

    apiClient
      .getPlayerGames(selectedPlayerId, { page: 1, pageSize: 60, allGames: true })
      .then((res) => {
        const items = res?.items || [];
        setPlayerGames(items);
      })
      .catch((err) => {
        console.warn("Failed to fetch player games:", err);
        setPlayerGames([]);
      });
  }, [selectedPlayerId]);

  // Get active session
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // Handler: Update active session's messages
  const handleUpdateActiveMessages = (
    updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])
  ) => {
    if (!activeSession) return;

    setSessions((prevSessions) => {
      const idx = prevSessions.findIndex((s) => s.id === activeSession.id);
      if (idx === -1) return prevSessions;

      const currentMsgs = prevSessions[idx].messages;
      const nextMsgs = typeof updater === "function" ? updater(currentMsgs) : updater;

      // Auto update title if still default and user asked a question
      let newTitle = prevSessions[idx].title;
      if (newTitle === "Đoạn chat mới") {
        const firstUser = nextMsgs.find((m) => m.role === "user");
        if (firstUser && firstUser.content) {
          newTitle = firstUser.content.slice(0, 36) + (firstUser.content.length > 36 ? "..." : "");
        }
      }

      const updatedSession: ChatSession = {
        ...prevSessions[idx],
        title: newTitle,
        updatedAt: Date.now(),
        messages: nextMsgs,
      };

      const nextList = [...prevSessions];
      nextList[idx] = updatedSession;
      return nextList;
    });
  };

  // Handler: Create a new chat session
  const handleCreateNewChat = (playerIdOverride?: string) => {
    const pId = playerIdOverride || selectedPlayerId || "default";
    const pObj = players.find((p) => p.id === pId);
    const pName = pObj?.canonical_name || currentPlayerName;

    const newSession = createDefaultSession(pId, pName);
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    if (playerIdOverride && playerIdOverride !== selectedPlayerId) {
      setSelectedPlayerId(playerIdOverride);
    }
  };

  // Handler: Delete a chat session
  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        if (filtered.length > 0) {
          setActiveSessionId(filtered[0].id);
        } else {
          const fresh = createDefaultSession(selectedPlayerId, currentPlayerName);
          setActiveSessionId(fresh.id);
          return [fresh];
        }
      }
      return filtered;
    });
  };

  // Handler: Select a game onto the interactive board
  const handleSelectGame = (gameId: string) => {
    setSelectedGameId(gameId);
    if (!gameId) {
      setCurrentFen(START_FEN);
      setActiveMoves([]);
      setCurrentPly(0);
      return;
    }

    const g = playerGames.find((game) => game.id === gameId);
    if (!g) return;

    const rawMoves = g.moves_san || "";
    const moves = rawMoves
      .split(" ")
      .map((m) => m.replace(/^\d+\.+/, "").trim())
      .filter((m) => m && !["1-0", "0-1", "1/2-1/2", "*"].includes(m));

    setActiveMoves(moves);
    setCurrentPly(0);
    setCurrentFen(START_FEN);

    // Auto set board orientation based on player's color
    const pName = selectedPlayer?.canonical_name?.toLowerCase() || "";
    if (g.black_player && g.black_player.toLowerCase().includes(pName)) {
      setBoardOrientation("black");
    } else {
      setBoardOrientation("white");
    }
  };

  // Handler: Apply FEN onto board
  const handleApplyFen = (fen: string) => {
    setIsBoardOpen(true);
    try {
      const chess = new Chess(fen);
      setCurrentFen(chess.fen());
      setActiveMoves([]);
      setCurrentPly(0);
      setSelectedGameId("");
    } catch (e) {
      console.warn("Invalid FEN provided:", fen, e);
    }
  };

  // Handler: Apply move (SAN, move-number, or UCI) cleanly
  const handleApplyMove = (rawMove: string) => {
    setIsBoardOpen(true);
    try {
      const matchWithNumber = rawMove.match(/^(\d+)\s*(?:\.{1,3})\s*(.+)$/);
      const moveNumber = matchWithNumber ? parseInt(matchWithNumber[1], 10) : null;
      const isBlackMove = rawMove.includes("...");
      const cleanSan = (matchWithNumber ? matchWithNumber[2] : rawMove)
        .replace(/^\.+/, "")
        .replace(/[+#?!]/g, "")
        .trim();

      // 1. Check if the move is legal from current position
      const chess = new Chess(currentFen);
      let moveRes: any = null;
      try {
        moveRes = chess.move(cleanSan, { strict: false });
      } catch {
        try {
          moveRes = chess.move(cleanSan);
        } catch {
          // not legal from current position
        }
      }

      if (moveRes) {
        const nextFen = chess.fen();
        setCurrentFen(nextFen);
        if (activeMoves.length > 0 && currentPly < activeMoves.length) {
          const truncated = activeMoves.slice(0, currentPly);
          setActiveMoves([...truncated, moveRes.san]);
          setCurrentPly(truncated.length + 1);
        } else if (activeMoves.length > 0 && currentPly === activeMoves.length) {
          setActiveMoves((prev) => [...prev, moveRes.san]);
          setCurrentPly((prev) => prev + 1);
        }
        return;
      }

      // 2. If move was not legal in currentFen, check if this move is in activeMoves (from loaded game)
      if (activeMoves.length > 0) {
        if (moveNumber) {
          const expectedPly = isBlackMove ? (moveNumber - 1) * 2 + 1 : (moveNumber - 1) * 2;
          if (expectedPly >= 0 && expectedPly < activeMoves.length) {
            const replay = new Chess();
            for (let i = 0; i <= expectedPly; i++) {
              replay.move(activeMoves[i]);
            }
            setCurrentFen(replay.fen());
            setCurrentPly(expectedPly + 1);
            return;
          }
        }

        // Search activeMoves for cleanSan
        const foundIdx = activeMoves.findIndex((m) => m.replace(/[+#?!]/g, "").trim() === cleanSan);
        if (foundIdx !== -1) {
          const replay = new Chess();
          for (let i = 0; i <= foundIdx; i++) {
            replay.move(activeMoves[i]);
          }
          setCurrentFen(replay.fen());
          setCurrentPly(foundIdx + 1);
          return;
        }
      }
    } catch (err) {
      console.warn("Could not apply move:", rawMove, err);
    }
  };

  // Handler: Ask AI about the current board position
  const handleAskAboutBoard = () => {
    const activeColor = currentFen.split(" ")[1] === "w" ? "Trắng" : "Đen";
    let evalText = "";
    if (currentEval) {
      const scoreStr = currentEval.isMate
        ? `Chiếu bí sau ${currentEval.mateIn ?? currentEval.score} nước`
        : `${currentEval.score > 0 ? "+" : ""}${(currentEval.score / 100).toFixed(2)} Tốt`;
      evalText = ` (Stockfish chấm: ${scoreStr}, nước tối ưu: ${currentEval.bestMove || "chưa rõ"})`;
    }
    const prompt = `Phân tích thế cờ hiện tại trên bàn cờ giúp tôi (Lượt đi: ${activeColor}${evalText}). Đánh giá kế hoạch chiến lược và nước đi tiếp theo nên là gì?`;
    setPendingPrompt(prompt);
  };

  // Group conversations by player ID
  const groupedSessions = useMemo(() => {
    const map: Record<string, ChatSession[]> = {};
    for (const s of sessions) {
      if (!map[s.playerId]) {
        map[s.playerId] = [];
      }
      map[s.playerId].push(s);
    }
    return map;
  }, [sessions]);

  const toggleFolder = (pId: string) => {
    setExpandedFolders((prev) => ({ ...prev, [pId]: !prev[pId] }));
  };

  return (
    <div className="w-full h-[calc(100vh-4.25rem)] -mt-3 sm:-mt-6 -mb-24 md:-mb-8 flex flex-col overflow-hidden select-none">
      {/* Sleek Top Compact Toolbar (No large header banner) */}
      <div className="shrink-0 h-12 px-3 bg-card/85 backdrop-blur-md border border-border/70 rounded-2xl flex items-center justify-between gap-2.5 shadow-2xs mb-2">
        {/* Left: Sidebar toggle & Player Selector */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            title={isSidebarOpen ? "Ẩn danh sách lịch sử" : "Hiện danh sách lịch sử"}
            className="p-1.5 rounded-xl border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer shrink-0"
          >
            {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>

          {/* Profile Select dropdown */}
          <div className="flex items-center gap-1.5 bg-background border border-border/70 rounded-xl px-2.5 py-1 shadow-2xs min-w-[200px] max-w-[280px]">
            <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <select
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="w-full bg-transparent border-0 text-xs font-bold text-foreground focus:outline-hidden cursor-pointer truncate"
            >
              {players.map((p) => (
                <option key={p.id} value={p.id} className="bg-card text-foreground">
                  {p.canonical_name} {p.title ? `(${p.title})` : ""}
                </option>
              ))}
              {players.length === 0 && (
                <option value="00000000-0000-0000-0000-000000000001">Kỳ thủ mẫu</option>
              )}
            </select>
          </div>

          {/* PGN Games Count Badge */}
          <div className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold shrink-0">
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>{playerGames.length} ván PGN</span>
          </div>
        </div>

        {/* Right: Board Toggle & Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Interactive Board Toggle Button */}
          <button
            type="button"
            onClick={() => setIsBoardOpen((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs ${
              isBoardOpen
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                : "bg-muted text-muted-foreground hover:text-foreground border border-border/70"
            }`}
          >
            {isBoardOpen ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Bàn cờ:</span>
            <span className="uppercase">{isBoardOpen ? "Bật" : "Tắt"}</span>
          </button>

          {/* If Board is open, show quick flip & reset */}
          {isBoardOpen && (
            <>
              <button
                type="button"
                onClick={() => setBoardOrientation((prev) => (prev === "white" ? "black" : "white"))}
                title="Xoay bàn cờ (Đổi bên Trắng / Đen)"
                className="hidden md:flex px-2.5 py-1.5 rounded-xl border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold items-center gap-1 transition cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Xoay</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentFen(START_FEN);
                  setActiveMoves([]);
                  setCurrentPly(0);
                  setSelectedGameId("");
                }}
                title="Xếp lại thế cờ ban đầu"
                className="hidden md:flex px-2.5 py-1.5 rounded-xl border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold items-center gap-1 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ban đầu</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Workspace: Sidebar + (Board) + Chat */}
      <div className="flex-1 min-h-0 flex gap-2.5 overflow-hidden">
        {/* Left: Chat History Sidebar (Grouped by Player Profile Folders) */}
        {isSidebarOpen && (
          <aside className="w-64 sm:w-72 shrink-0 h-full flex flex-col bg-card border border-border/70 rounded-2xl overflow-hidden shadow-2xs animate-fade-in">
            {/* Sidebar Top: New Chat Button */}
            <div className="p-2.5 border-b border-border/60 flex items-center justify-between gap-2 shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                Lịch sử chat
              </span>
              <button
                type="button"
                onClick={() => handleCreateNewChat()}
                className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Chat mới</span>
              </button>
            </div>

            {/* Sidebar Body: Profile Folders & Conversations List */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
              {players.map((player) => {
                const playerSessions = groupedSessions[player.id] || [];
                const isExpanded = expandedFolders[player.id] ?? (player.id === selectedPlayerId);

                return (
                  <div key={player.id} className="space-y-1">
                    {/* Folder Header */}
                    <div
                      onClick={() => toggleFolder(player.id)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition select-none ${
                        player.id === selectedPlayerId
                          ? "bg-muted/80 text-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate min-w-0">
                        {isExpanded ? (
                          <FolderOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate">{player.canonical_name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateNewChat(player.id);
                          }}
                          title={`Tạo đoạn chat mới cho ${player.canonical_name}`}
                          className="p-1 rounded-md hover:bg-card text-muted-foreground hover:text-emerald-600 transition"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary font-mono text-muted-foreground">
                          {playerSessions.length}
                        </span>
                      </div>
                    </div>

                    {/* Conversation Items under this folder */}
                    {isExpanded && (
                      <div className="pl-3.5 space-y-1 border-l-2 border-border/50 ml-2">
                        {playerSessions.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground/60 italic py-1 px-2">
                            Chưa có hội thoại nào
                          </p>
                        ) : (
                          playerSessions.map((session) => {
                            const isActive = session.id === activeSessionId;
                            return (
                              <div
                                key={session.id}
                                onClick={() => {
                                  setActiveSessionId(session.id);
                                  if (session.playerId !== selectedPlayerId) {
                                    setSelectedPlayerId(session.playerId);
                                  }
                                }}
                                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition select-none ${
                                  isActive
                                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-bold border border-emerald-300/50 shadow-2xs"
                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground font-medium"
                                }`}
                              >
                                <div className="flex items-center gap-1.5 truncate min-w-0 pr-1">
                                  <MessageSquare
                                    className={`w-3 h-3 shrink-0 ${
                                      isActive ? "text-emerald-600" : "text-muted-foreground"
                                    }`}
                                  />
                                  <span className="truncate">{session.title}</span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[10px] text-muted-foreground/80 font-mono">
                                    {formatRelativeTime(session.updatedAt)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteSession(e, session.id)}
                                    title="Xóa đoạn chat này"
                                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-red-100 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600 transition"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {/* Center/Left: Interactive Chessboard Area (Toggleable) */}
        {isBoardOpen && (
          <div className="w-[50%] lg:w-[48%] xl:w-[46%] shrink-0 h-full flex flex-col items-center bg-card border border-border/70 rounded-2xl p-2.5 sm:p-3 shadow-2xs overflow-hidden">
            {/* Board Top Status Bar */}
            <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-border/60 gap-2 shrink-0">
              <div className="flex items-center gap-2 truncate">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  Bàn cờ
                </span>

                {/* Stockfish Evaluation Tag */}
                {currentEval && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      (currentEval.score || 0) >= 0
                        ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300"
                        : "bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300"
                    }`}
                  >
                    <TrendingUp className="w-3 h-3" />
                    {currentEval.isMate
                      ? `#M${currentEval.mateIn ?? currentEval.score}`
                      : `${currentEval.score > 0 ? "+" : ""}${(currentEval.score / 100).toFixed(2)}`}
                  </span>
                )}
              </div>

              {/* Turn indicator */}
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <span
                  className={`w-2.5 h-2.5 rounded-full border border-border ${
                    currentFen.split(" ")[1] === "w" ? "bg-white" : "bg-slate-900"
                  }`}
                />
                <span>Lượt: {currentFen.split(" ")[1] === "w" ? "Trắng" : "Đen"}</span>
              </div>
            </div>

            {/* ChessBoard Component (Fills container) */}
            <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
              <ChessBoard
                initialFen={currentFen}
                moves={activeMoves}
                currentPly={currentPly}
                orientation={boardOrientation}
                onPositionChange={(fen, ply) => {
                  setCurrentFen(fen);
                  setCurrentPly(ply);
                }}
                onEvaluationChange={(evalData, thinking) => {
                  setCurrentEval(evalData);
                  setIsEngineThinking(thinking);
                }}
                height={480}
              />
            </div>

            {/* Bottom Controls: Game Loader & Ask AI about board */}
            <div className="w-full mt-2 pt-2 border-t border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
              {/* Game Selector */}
              <div className="flex-1 min-w-[180px]">
                <select
                  value={selectedGameId}
                  onChange={(e) => handleSelectGame(e.target.value)}
                  className="w-full bg-background border border-border/70 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer truncate"
                >
                  <option value="">-- Xếp ván đấu ({playerGames.length} ván) --</option>
                  {playerGames.map((g, idx) => {
                    const white = g.white_player || "Trắng";
                    const black = g.black_player || "Đen";
                    const res = g.result || "*";
                    const eco = g.eco ? `[${g.eco}]` : "";
                    return (
                      <option key={g.id || idx} value={g.id}>
                        Ván {idx + 1}: {white} vs {black} ({res}) {eco}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Action Buttons: Copy FEN & Ask AI */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(currentFen);
                    setCopiedFen(true);
                    setTimeout(() => setCopiedFen(false), 2000);
                  }}
                  title="Sao chép FEN của thế cờ hiện tại"
                  className="p-2 rounded-xl border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                >
                  {copiedFen ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={handleAskAboutBoard}
                  title="Gửi thế cờ này cho Trợ lí AI phân tích"
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Gửi thế cờ vào chat ↗</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right/Full Area: AI Coach Chat Box */}
        <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
          {activeSession ? (
            <AiAssistantChat
              key={activeSession.id}
              runId={`run-${activeSession.playerId}`}
              playerId={activeSession.playerId}
              playerName={activeSession.playerName}
              gamesCount={playerGames.length}
              currentFen={currentFen}
              currentEval={currentEval}
              isBoardOpen={isBoardOpen}
              onToggleBoard={() => setIsBoardOpen((prev) => !prev)}
              onOpenBoard={(fen) => {
                setIsBoardOpen(true);
                if (fen) handleApplyFen(fen);
              }}
              onApplyFen={handleApplyFen}
              onApplyMove={handleApplyMove}
              messages={activeSession.messages}
              setMessages={(msgs) => handleUpdateActiveMessages(msgs)}
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
              pendingPrompt={pendingPrompt}
              onClearPendingPrompt={() => setPendingPrompt(null)}
              onNewChat={() => handleCreateNewChat(activeSession.playerId)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-card border border-border/60 rounded-2xl">
              <p className="text-sm text-muted-foreground">Đang tải cuộc trò chuyện...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
