"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Brain,
  RotateCcw,
  Layers,
  RotateCw,
  MessageSquare,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  PanelLeft,
  PanelLeftClose,
  TrendingUp,
  User,
  Database,
  Copy,
  Check,
  Eye,
  EyeOff,
  Search,
  X,
  Edit2,
  Bot,
  Send,
  Swords,
  Pin,
  PinOff,
  Sparkles,
  Clock,
  Calendar,
} from "lucide-react";
import { Chess } from "chess.js";
import Link from "next/link";
import ChessBoard from "@/components/chess/ChessBoard";
import AiAssistantChat from "@/components/ai/AiAssistantChat";
import { apiClient } from "@/lib/api/client";
import { Player, Game } from "@/lib/api/types";
import { EngineEvaluation } from "@/lib/stockfish/engineWorker";
import { isFenString, normalizeFen, isPawnSkeletonFen } from "@/lib/chess/notation";
import { useProfileWorkspaceStore } from "@/lib/stores/profileWorkspaceStore";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const STORAGE_KEY = "chess_ai_conversations_v4";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  fen?: string;
}

export interface ChatSession {
  id: string;
  user_id?: string;
  playerIds: string[];
  title: string;
  perspectiveMode?: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  isDraft?: boolean;
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "Vừa xong";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(timestamp).toLocaleDateString("vi-VN", { month: "numeric", day: "numeric" });
}

function createDraftSession(playerIds: string[] = [], playersList: Player[] = []): ChatSession {
  const isGeneral = playerIds.length === 0;
  const isMulti = playerIds.length > 1;
  let initialGreeting = "";
  let title = "Đoạn chat mới";

  if (isGeneral) {
    title = "Trò chuyện tự do cùng AI";
    initialGreeting =
      "Xin chào! Tôi là Trợ lí AI Cờ Vua. Bạn có thể trò chuyện tự do về cờ vua, thảo luận khai cuộc, chiến thuật, hoặc đi các nước cờ trên bàn cờ bên cạnh rồi hỏi tôi nhận xét bất kỳ lúc nào!";
  } else if (isMulti) {
    const names = playerIds.map((id) => playersList.find((p) => p.id === id)?.canonical_name || "Kỳ thủ").join(" & ");
    title = `So sánh: ${names}`;
    initialGreeting = `Xin chào! Tôi là Trợ lí AI Cờ Vua chế độ Đa hồ sơ. Tôi đã sẵn sàng phân tích so sánh, đối chiếu khai cuộc, điểm mạnh/yếu chiến thuật và tư vấn kế hoạch đối đầu giữa **${names}**!`;
  } else {
    const p = playersList.find((pl) => pl.id === playerIds[0]);
    const name = p?.canonical_name || "Kỳ thủ";
    title = `Phân tích: ${name}`;
    initialGreeting = `Xin chào! Tôi là Trợ lí AI phân tích cờ vua. Tôi đã nạp toàn bộ biên bản ván đấu PGN của **${name}** và kết nối trực tiếp với bàn cờ.\n\nBạn có thể hỏi tôi bất kỳ điều gì về các ván đấu, khai cuộc, phong cách thi đấu, hoặc đi thử một nước cờ trên bàn cờ rồi hỏi tôi nhận xét!`;
  }

  return {
    id: `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    playerIds,
    title,
    pinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDraft: true,
    messages: [
      {
        role: "assistant",
        content: initialGreeting,
      },
    ],
  };
}

export default function AiCoachView() {
  const queryPlayerId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("playerId") : null;
  const workspaceStore = useProfileWorkspaceStore();
  const [players, setPlayers] = useState<Player[]>([]);

  // Chat sessions state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [draftSession, setDraftSession] = useState<ChatSession | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);

  // Search and editing state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

  // Board and UI layout toggles
  const [isBoardOpen, setIsBoardOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setIsSidebarOpen(true);
    }
  }, []);

  // Board state
  const [baseFen, setBaseFen] = useState<string>(START_FEN);
  const [currentFen, setCurrentFen] = useState<string>(START_FEN);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [currentPly, setCurrentPly] = useState<number>(0);
  const [activeMoves, setActiveMoves] = useState<string[]>([]);
  const [currentEval, setCurrentEval] = useState<EngineEvaluation | null>(null);
  const [isEngineThinking, setIsEngineThinking] = useState(false);
  const [copiedFen, setCopiedFen] = useState(false);

  // Games for board position loading
  const [playerGames, setPlayerGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>("");

  // Prompt trigger from Board
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  // Dropdown helper for adding player to context
  const [isAddingPlayerOpen, setIsAddingPlayerOpen] = useState(false);
  const addPlayerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addPlayerRef.current && !addPlayerRef.current.contains(event.target as Node)) {
        setIsAddingPlayerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 1. Fetch Players list on mount
  useEffect(() => {
    apiClient
      .getPlayers()
      .then((data) => {
        setPlayers(data || []);
      })
      .catch(() => {});
  }, []);

  // 2. Load Chat Sessions on mount (from Supabase DB first, fallback to localStorage)
  useEffect(() => {
    let isSubscribed = true;

    async function loadSessions() {
      let loaded: ChatSession[] = [];

      try {
        const dbSessions = await apiClient.getAiChatSessions();
        if (isSubscribed && Array.isArray(dbSessions) && dbSessions.length > 0) {
          loaded = dbSessions.map((ds) => ({
            id: ds.id,
            user_id: ds.user_id,
            playerIds: Array.isArray(ds.player_ids) ? ds.player_ids : [],
            title: ds.title || "Cuộc trò chuyện",
            perspectiveMode: ds.perspective_mode,
            pinned: Boolean(ds.pinned),
            createdAt: ds.created_at ? new Date(ds.created_at).getTime() : Date.now(),
            updatedAt: ds.updated_at ? new Date(ds.updated_at).getTime() : Date.now(),
            messages: (ds.messages || []).map((m: any) => ({
              role: m.role || "user",
              content: m.content || "",
              fen: m.fen,
            })),
            isDraft: false,
          }));
        }
      } catch (err) {
        console.warn("Could not load sessions from DB, falling back to local storage:", err);
      }

      // If DB returned nothing or error, check localStorage
      if (loaded.length === 0 && typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              loaded = parsed.filter((s) => s && s.messages && s.messages.some((m: any) => m.role === "user"));
            }
          }
        } catch (e) {
          console.warn("Failed to parse local storage sessions:", e);
        }
      }

      if (!isSubscribed) return;

      if (loaded.length > 0) {
        setSessions(loaded);
        setActiveSessionId(loaded[0].id);
      } else {
        // No saved sessions: Initialize initial draft session (LAZY CREATION: not persisted!)
        let initialPids: string[] = [];
        if (queryPlayerId) {
          initialPids = [queryPlayerId];
        } else if (workspaceStore.activeMode === "single" && workspaceStore.activePlayerId) {
          initialPids = [workspaceStore.activePlayerId];
        } else if (workspaceStore.activeMode === "multi" && workspaceStore.multiProfiles.length > 0) {
          initialPids = workspaceStore.multiProfiles.map((m) => m.player.id);
        }
        const initialDraft = createDraftSession(initialPids, players);
        setDraftSession(initialDraft);
        setActiveSessionId(initialDraft.id);
      }

      setIsLoaded(true);
    }

    loadSessions();

    return () => {
      isSubscribed = false;
    };
  }, []);

  // 3. Save concrete sessions to localStorage as offline/guest backup
  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return;
    try {
      const concreteToSave = sessions.filter((s) => !s.isDraft && s.messages.some((m) => m.role === "user"));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(concreteToSave));
    } catch (e) {
      console.warn("Failed to save local storage backup:", e);
    }
  }, [sessions, isLoaded]);

  // Current active session (either from concrete sessions or the active draft)
  const activeSession: ChatSession = useMemo(() => {
    if (draftSession && draftSession.id === activeSessionId) {
      return draftSession;
    }
    const found = sessions.find((s) => s.id === activeSessionId);
    if (found) return found;
    if (draftSession) return draftSession;
    if (sessions.length > 0) return sessions[0];
    return createDraftSession([], players);
  }, [activeSessionId, sessions, draftSession, players]);

  // Player display names in active session
  const activePlayerNames = useMemo(() => {
    return activeSession.playerIds
      .map((id) => players.find((p) => p.id === id)?.canonical_name)
      .filter(Boolean) as string[];
  }, [activeSession.playerIds, players]);

  const activePlayerDisplayName = useMemo(() => {
    if (activePlayerNames.length === 0) return "Trò chuyện tự do";
    if (activePlayerNames.length === 1) return activePlayerNames[0];
    return `So sánh: ${activePlayerNames.join(" & ")}`;
  }, [activePlayerNames]);

  // 4. Fetch or Synchronize Player Games for Board based on activeSession.playerIds
  useEffect(() => {
    const pids = activeSession.playerIds;
    if (pids.length === 0) {
      setPlayerGames([]);
      setSelectedGameId("");
      return;
    }

    let isCurrent = true;

    Promise.all(
      pids.map((pid) =>
        apiClient.getPlayerGames(pid, { page: 1, pageSize: 50, allGames: true }).catch(() => ({ items: [] }))
      )
    ).then((resList) => {
      if (!isCurrent) return;
      const combined = resList.flatMap((r) => r?.items || []);
      setPlayerGames(combined);
    });

    return () => {
      isCurrent = false;
    };
  }, [activeSession.playerIds]);

  // Handler: Update active session messages & lazy creation on first prompt
  const handleUpdateActiveMessages = async (
    updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])
  ) => {
    const currentMsgs = activeSession.messages;
    const nextMsgs = typeof updater === "function" ? updater(currentMsgs) : updater;

    const firstUser = nextMsgs.find((m) => m.role === "user");

    // Compute title from user's first prompt if default
    let newTitle = activeSession.title;
    if (
      activeSession.isDraft ||
      newTitle === "Đoạn chat mới" ||
      newTitle === "Trò chuyện tự do cùng AI" ||
      newTitle.startsWith("Phân tích:") ||
      newTitle.startsWith("So sánh:")
    ) {
      if (firstUser && firstUser.content) {
        newTitle = firstUser.content.slice(0, 36) + (firstUser.content.length > 36 ? "..." : "");
      }
    }

    if (activeSession.isDraft) {
      // Lazy creation: only persist when user actually sends a question!
      if (!firstUser) {
        setDraftSession((prev) => (prev ? { ...prev, messages: nextMsgs } : null));
        return;
      }

      const realId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const concreteSession: ChatSession = {
        ...activeSession,
        id: realId,
        title: newTitle,
        isDraft: false,
        updatedAt: Date.now(),
        messages: nextMsgs,
      };

      setSessions((prev) => [concreteSession, ...prev]);
      setActiveSessionId(realId);
      setDraftSession(null);

      apiClient
        .createAiChatSession({
          id: realId,
          player_ids: concreteSession.playerIds,
          title: newTitle,
          pinned: concreteSession.pinned,
          messages: nextMsgs,
        })
        .catch((err) => {
          console.warn("Failed to persist session to Supabase:", err);
        });
    } else {
      const updated: ChatSession = {
        ...activeSession,
        title: newTitle,
        updatedAt: Date.now(),
        messages: nextMsgs,
      };

      setSessions((prev) => prev.map((s) => (s.id === activeSession.id ? updated : s)));

      apiClient
        .updateAiChatSession(activeSession.id, {
          title: newTitle,
          player_ids: updated.playerIds,
          messages: nextMsgs,
        })
        .catch((err) => {
          console.warn("Failed to update session on Supabase:", err);
        });
    }
  };

  // Handler: Create a new chat session (enters in-memory draft state - LAZY CREATION)
  const handleCreateNewChat = (specificPlayerIds?: string[]) => {
    // If current session is already an empty draft, just switch or keep it
    if (activeSession.isDraft && !activeSession.messages.some((m) => m.role === "user")) {
      if (specificPlayerIds) {
        setDraftSession(createDraftSession(specificPlayerIds, players));
      }
      return;
    }

    const targetPids = specificPlayerIds !== undefined ? specificPlayerIds : activeSession.playerIds;
    const newDraft = createDraftSession(targetPids, players);
    setDraftSession(newDraft);
    setActiveSessionId(newDraft.id);
  };

  // Handler: Pin / Unpin session
  const handleTogglePin = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === sessionId) {
          const nextPinned = !s.pinned;
          apiClient.updateAiChatSession(s.id, { pinned: nextPinned }).catch(() => {});
          return { ...s, pinned: nextPinned };
        }
        return s;
      })
    );
  };

  // Handler: Save inline rename of a chat session
  const handleSaveRename = (sessionId: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === sessionId) {
            apiClient.updateAiChatSession(s.id, { title: trimmed }).catch(() => {});
            return { ...s, title: trimmed, updatedAt: Date.now() };
          }
          return s;
        })
      );
    }
    setEditingSessionId(null);
    setEditingTitle("");
  };

  // Handler: Delete a chat session
  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    apiClient.deleteAiChatSession(sessionId).catch(() => {});

    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
        } else {
          const fresh = createDraftSession([], players);
          setDraftSession(fresh);
          setActiveSessionId(fresh.id);
        }
      }
      return remaining;
    });
  };

  // Handler: Add or Remove player from active session context
  const handleAddPlayerToContext = (playerId: string) => {
    setIsAddingPlayerOpen(false);
    if (activeSession.playerIds.includes(playerId)) return;
    const nextPids = [...activeSession.playerIds, playerId];

    if (activeSession.isDraft) {
      setDraftSession(createDraftSession(nextPids, players));
    } else {
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSession.id ? { ...s, playerIds: nextPids } : s))
      );
      apiClient.updateAiChatSession(activeSession.id, { player_ids: nextPids }).catch(() => {});
    }
  };

  const handleRemovePlayerFromContext = (playerId: string) => {
    const nextPids = activeSession.playerIds.filter((id) => id !== playerId);

    if (activeSession.isDraft) {
      setDraftSession(createDraftSession(nextPids, players));
    } else {
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSession.id ? { ...s, playerIds: nextPids } : s))
      );
      apiClient.updateAiChatSession(activeSession.id, { player_ids: nextPids }).catch(() => {});
    }
  };

  // Handler: Select game on board
  const handleSelectGame = (gameId: string) => {
    setSelectedGameId(gameId);
    if (!gameId) {
      setBaseFen(START_FEN);
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

    setBaseFen(START_FEN);
    setActiveMoves(moves);
    setCurrentPly(0);
    setCurrentFen(START_FEN);

    // Auto set board orientation if selected player is Black
    const firstPName = activePlayerNames[0]?.toLowerCase() || "";
    if (g.black_player && firstPName && g.black_player.toLowerCase().includes(firstPName)) {
      setBoardOrientation("black");
    } else {
      setBoardOrientation("white");
    }
  };

  // Handler: Apply FEN to board
  const handleApplyFen = useCallback((fen: string) => {
    setIsBoardOpen(true);
    const cleanFen = normalizeFen(fen);
    try {
      const chess = new Chess(cleanFen);
      const validatedFen = chess.fen();
      setBaseFen(validatedFen);
      setCurrentFen(validatedFen);
    } catch {
      if (isFenString(cleanFen)) {
        setBaseFen(cleanFen);
        setCurrentFen(cleanFen);
      } else {
        console.warn("Invalid FEN provided:", fen);
        return;
      }
    }
    setActiveMoves([]);
    setCurrentPly(0);
    setSelectedGameId("");
  }, []);

  const isSkeleton = useMemo(() => isPawnSkeletonFen(currentFen), [currentFen]);
  const selectedGame = useMemo(
    () => playerGames.find((g) => g.id === selectedGameId) || null,
    [playerGames, selectedGameId]
  );

  const handleAskAboutEntireGame = () => {
    if (!selectedGame) return;
    const white = selectedGame.white_player || "Trắng";
    const black = selectedGame.black_player || "Đen";
    const res = selectedGame.result || "*";
    const eco = selectedGame.eco ? `[${selectedGame.eco}] ` : "";
    const op = selectedGame.opening_name ? `- ${selectedGame.opening_name}` : "";
    const prompt = `Phân tích toàn bộ ván cờ này giúp tôi: ${white} vs ${black} (${res}) ${eco}${op}. Hãy đánh giá diễn biến toàn bộ ván đấu từ khai cuộc, các bước ngoặt ở trung cuộc đến kết thúc ván!`;
    setPendingPrompt(prompt);
  };

  const handleAskAboutBoard = () => {
    if (isSkeleton) {
      setPendingPrompt(
        `Hãy phân tích chi tiết hình thái cấu trúc Tốt (Pawn Skeleton) này: điểm mạnh, điểm yếu, các ô tiền đồn quan trọng và kế hoạch chiến lược then chốt cho cả hai bên! FEN: \`${currentFen}\``
      );
      return;
    }
    const activeColor = currentFen.split(" ")[1] === "w" ? "Trắng" : "Đen";
    let evalText = "";
    if (currentEval) {
      const scoreStr = currentEval.isMate
        ? `Chiếu bí sau ${currentEval.mateIn ?? currentEval.score} nước`
        : `${currentEval.score > 0 ? "+" : ""}${(currentEval.score / 100).toFixed(2)} Tốt`;
      evalText = ` (Stockfish chấm: ${scoreStr}, nước tối ưu: ${currentEval.bestMove || "chưa rõ"})`;
    }
    const moveContext = selectedGame
      ? ` ở Nước ${currentPly}/${activeMoves.length} trong ván ${selectedGame.white_player || "Trắng"} vs ${selectedGame.black_player || "Đen"}`
      : "";
    const prompt = `Phân tích thế cờ hiện tại trên bàn cờ giúp tôi (Lượt đi: ${activeColor}${evalText}${moveContext}). Đánh giá kế hoạch chiến lược và nước đi tiếp theo nên là gì?`;
    setPendingPrompt(prompt);
  };

  // Filtered & Chronologically Grouped Sessions
  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      const titleMatch = s.title.toLowerCase().includes(q);
      const playerMatch = s.playerIds.some((id) => {
        const p = players.find((pl) => pl.id === id);
        return p && p.canonical_name.toLowerCase().includes(q);
      });
      const msgMatch = s.messages.some((m) => m.content.toLowerCase().includes(q));
      return titleMatch || playerMatch || msgMatch;
    });
  }, [sessions, searchQuery, players]);

  const chronologicalGroups = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOfLast7Days = startOfToday - 6 * 86400000;

    const pinned: ChatSession[] = [];
    const today: ChatSession[] = [];
    const yesterday: ChatSession[] = [];
    const last7Days: ChatSession[] = [];
    const older: ChatSession[] = [];

    for (const s of filteredSessions) {
      if (s.isDraft) continue;
      if (s.pinned) {
        pinned.push(s);
        continue;
      }
      const t = s.updatedAt || s.createdAt;
      if (t >= startOfToday) {
        today.push(s);
      } else if (t >= startOfYesterday) {
        yesterday.push(s);
      } else if (t >= startOfLast7Days) {
        last7Days.push(s);
      } else {
        older.push(s);
      }
    }

    return { pinned, today, yesterday, last7Days, older };
  }, [filteredSessions]);

  // Render a session item row
  const renderSessionItem = (session: ChatSession) => {
    const isActive = session.id === activeSessionId;
    const isEditing = editingSessionId === session.id;

    // Resolve player names for tags
    const sessionPlayerNames = session.playerIds
      .map((id) => players.find((p) => p.id === id)?.canonical_name)
      .filter(Boolean);

    return (
      <div
        key={session.id}
        onClick={() => {
          if (isEditing) return;
          setActiveSessionId(session.id);
        }}
        className={`group relative flex flex-col px-2.5 py-2 rounded-xl text-xs cursor-pointer transition select-none ${
          isActive
            ? "bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-bold border-l-3 border-l-emerald-600 border border-emerald-500/30 shadow-2xs"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground font-medium border border-transparent"
        }`}
      >
        {isEditing ? (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveRename(session.id);
                if (e.key === "Escape") setEditingSessionId(null);
              }}
              autoFocus
              className="flex-1 bg-background border border-emerald-500 rounded-lg px-2 py-0.5 text-xs text-foreground focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleSaveRename(session.id)}
              className="p-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-500 transition"
              title="Lưu"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setEditingSessionId(null)}
              className="p-1 rounded-md bg-muted text-muted-foreground hover:text-foreground transition"
              title="Hủy"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-1.5 min-w-0">
              <div className="flex items-center gap-1.5 truncate min-w-0">
                {session.pinned ? (
                  <Pin className="w-3 h-3 text-amber-500 shrink-0 fill-amber-500" />
                ) : (
                  <MessageSquare
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? "text-emerald-600" : "text-muted-foreground/70"
                    }`}
                  />
                )}
                <span className="truncate">{session.title}</span>
              </div>

              {/* Action buttons on hover */}
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => handleTogglePin(e, session.id)}
                  title={session.pinned ? "Bỏ ghim" : "Ghim lên đầu"}
                  className="p-1 rounded-md hover:bg-card text-muted-foreground hover:text-amber-500 transition"
                >
                  {session.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingSessionId(session.id);
                    setEditingTitle(session.title);
                  }}
                  title="Đổi tên đoạn chat"
                  className="p-1 rounded-md hover:bg-card text-muted-foreground hover:text-foreground transition"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteSession(e, session.id)}
                  title="Xóa đoạn chat này"
                  className="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600 transition"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Profile Tag & Timestamp */}
            <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground/70">
              <div className="flex items-center gap-1 truncate max-w-[170px]">
                {sessionPlayerNames.length === 0 ? (
                  <span className="px-1.5 py-0.2 rounded bg-muted text-[9px] font-semibold">Tự do</span>
                ) : sessionPlayerNames.length === 1 ? (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold truncate text-[9px]">
                    {sessionPlayerNames[0]}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 rounded bg-teal-500/15 text-teal-800 dark:text-teal-300 font-bold truncate text-[9px]">
                    {sessionPlayerNames[0]} + {sessionPlayerNames.length - 1}
                  </span>
                )}
              </div>
              <span className="font-mono">{formatRelativeTime(session.updatedAt)}</span>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-[calc(100dvh-8rem)] md:h-[calc(100dvh-5.5rem)] -mt-2 sm:-mt-4 mb-0 flex flex-col overflow-hidden select-none">
      {/* Sleek Top Compact Toolbar */}
      <div className="shrink-0 h-12 px-3 bg-card/85 backdrop-blur-md border border-border/70 rounded-xl flex items-center justify-between gap-2.5 shadow-2xs mb-2 relative z-30">
        {/* Left: Sidebar toggle & Multi-Profile Matchup Selector */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            title={isSidebarOpen ? "Ẩn danh sách lịch sử" : "Hiện danh sách lịch sử"}
            className="p-1.5 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer shrink-0"
          >
            {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>

          {/* Profile Matchup Pills Bar */}
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {activeSession.playerIds.length === 0 ? (
              <div className="flex items-center gap-1.5 bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 rounded-lg px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 shrink-0">
                <Bot className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Trợ lí AI Tự do</span>
              </div>
            ) : (
              <>
                <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase text-muted-foreground bg-muted/50 border border-border/60">
                  {activeSession.playerIds.length > 1 ? (
                    <>
                      <Swords className="w-3 h-3 text-emerald-600" />
                      <span>So sánh:</span>
                    </>
                  ) : (
                    <>
                      <User className="w-3 h-3 text-emerald-600" />
                      <span>Hồ sơ:</span>
                    </>
                  )}
                </div>

                {activeSession.playerIds.map((pid) => {
                  const p = players.find((pl) => pl.id === pid);
                  const name = p?.canonical_name || "Kỳ thủ";
                  return (
                    <div
                      key={pid}
                      className="flex items-center gap-1 bg-emerald-600 text-white rounded-lg pl-2 pr-1.5 py-1 text-xs font-bold shadow-2xs animate-fade-in"
                    >
                      <span className="truncate max-w-[120px] sm:max-w-[160px]">{name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePlayerFromContext(pid)}
                        title={`Bỏ ${name} khỏi cuộc trò chuyện`}
                        className="p-0.5 hover:bg-white/20 rounded-md transition cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </>
            )}

            {/* Add / Compare Player Dropdown Button */}
            <div className="relative z-40" ref={addPlayerRef}>
              <button
                type="button"
                onClick={() => setIsAddingPlayerOpen((prev) => !prev)}
                className="px-2 py-1 rounded-lg border border-dashed border-emerald-500/50 hover:border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                title="Chọn thêm hồ sơ kỳ thủ để so sánh đánh giá"
              >
                <Plus className="w-3 h-3" />
                <span>
                  {activeSession.playerIds.length === 0
                    ? "Chọn hồ sơ..."
                    : activeSession.playerIds.length === 1
                    ? "+ So sánh với..."
                    : "+ Thêm kỳ thủ"}
                </span>
              </button>

              {isAddingPlayerOpen && (
                <div className="absolute left-0 mt-1.5 w-64 max-h-80 overflow-y-auto bg-card/95 backdrop-blur-md border border-border/80 rounded-xl shadow-2xl z-50 py-1.5 animate-in fade-in-50 zoom-in-95 ring-1 ring-black/10 dark:ring-white/10">
                  <div className="px-3 py-1 text-[11px] font-bold text-muted-foreground uppercase border-b border-border/40 mb-1 sticky top-0 bg-card/95 backdrop-blur-xs">
                    Chọn kỳ thủ phân tích
                  </div>
                  {activeSession.playerIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingPlayerOpen(false);
                        handleCreateNewChat([]);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-muted font-medium flex items-center gap-2"
                    >
                      <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Chuyển về Trò chuyện tự do</span>
                    </button>
                  )}
                  {players
                    .filter((p) => !activeSession.playerIds.includes(p.id))
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddPlayerToContext(p.id)}
                        className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-emerald-500/10 hover:text-emerald-800 dark:hover:text-emerald-200 font-medium flex items-center justify-between"
                      >
                        <span className="truncate">{p.canonical_name}</span>
                        {p.title && (
                          <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold ml-1">
                            {p.title}
                          </span>
                        )}
                      </button>
                    ))}
                  {players.filter((p) => !activeSession.playerIds.includes(p.id)).length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground text-center italic">
                      Đã chọn tất cả kỳ thủ
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* PGN Games Count Badge */}
            {playerGames.length > 0 && (
              <div className="hidden md:inline-flex items-center gap-1 px-2 py-0.8 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold shrink-0">
                <Database className="w-3 h-3 text-emerald-600" />
                <span>{playerGames.length} ván</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Board Toggle Button */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsBoardOpen((prev) => !prev)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs ${
              isBoardOpen
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                : "bg-muted text-muted-foreground hover:text-foreground border border-border/70"
            }`}
          >
            {isBoardOpen ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Bàn cờ:</span>
            <span className="uppercase">{isBoardOpen ? "Bật" : "Tắt"}</span>
          </button>
        </div>
      </div>

      {/* Main Workspace: Sidebar + (Board) + Chat */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-2 sm:gap-2.5 overflow-hidden relative">
        {/* Left: Chat History Sidebar (Chronological & Professional Grouping) */}
        {isSidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden animate-fade-in"
              onClick={() => setIsSidebarOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-[280px] sm:w-[320px] md:static md:z-auto md:w-[280px] lg:w-[300px] shrink-0 h-full flex flex-col bg-card border-r md:border border-border/70 md:rounded-xl overflow-hidden shadow-2xl md:shadow-2xs">
              {/* Sidebar Top: Title & New Chat */}
              <div className="p-3 border-b border-border/60 flex items-center justify-between gap-2 shrink-0 bg-card/60 backdrop-blur-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-emerald-500/10 dark:bg-emerald-950/60 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Lịch sử trò chuyện
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-950/60 font-mono text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300/40">
                      {sessions.length}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleCreateNewChat()}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-2xs hover:shadow-xs transition cursor-pointer"
                    title="Tạo đoạn chat mới (Lazy: chỉ lưu khi gửi tin nhắn đầu tiên)"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Mới</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                    title="Đóng danh sách lịch sử"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Search Filter Input */}
              <div className="px-2.5 py-2 border-b border-border/40 shrink-0">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm cuộc trò chuyện..."
                    className="w-full bg-muted/60 focus:bg-background border border-border/60 rounded-xl pl-8 pr-7 py-1 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 text-muted-foreground hover:text-foreground p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Sidebar Body: Chronologically Grouped Sessions */}
              <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3">
                {/* 1. PINNED SESSIONS */}
                {chronologicalGroups.pinned.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-2 py-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      <Pin className="w-3 h-3 fill-amber-500" />
                      <span>Đã ghim ({chronologicalGroups.pinned.length})</span>
                    </div>
                    <div className="space-y-1">{chronologicalGroups.pinned.map(renderSessionItem)}</div>
                  </div>
                )}

                {/* 2. TODAY */}
                {chronologicalGroups.today.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-2 py-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Clock className="w-3 h-3 text-emerald-600" />
                      <span>Hôm nay ({chronologicalGroups.today.length})</span>
                    </div>
                    <div className="space-y-1">{chronologicalGroups.today.map(renderSessionItem)}</div>
                  </div>
                )}

                {/* 3. YESTERDAY */}
                {chronologicalGroups.yesterday.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-2 py-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span>Hôm qua ({chronologicalGroups.yesterday.length})</span>
                    </div>
                    <div className="space-y-1">{chronologicalGroups.yesterday.map(renderSessionItem)}</div>
                  </div>
                )}

                {/* 4. PREVIOUS 7 DAYS */}
                {chronologicalGroups.last7Days.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-2 py-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span>7 ngày trước ({chronologicalGroups.last7Days.length})</span>
                    </div>
                    <div className="space-y-1">{chronologicalGroups.last7Days.map(renderSessionItem)}</div>
                  </div>
                )}

                {/* 5. OLDER */}
                {chronologicalGroups.older.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-2 py-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span>Cũ hơn ({chronologicalGroups.older.length})</span>
                    </div>
                    <div className="space-y-1">{chronologicalGroups.older.map(renderSessionItem)}</div>
                  </div>
                )}

                {/* Empty State */}
                {sessions.length === 0 && !searchQuery && (
                  <div className="py-12 px-4 text-center space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                      <Bot className="w-5 h-5" />
                    </div>
                    <p className="font-semibold text-foreground text-xs">Chưa có lịch sử trò chuyện</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Hãy nhập tin nhắn đầu tiên để bắt đầu phân tích chiến thuật cùng AI.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCreateNewChat()}
                      className="inline-block text-xs font-bold text-emerald-600 hover:underline pt-1"
                    >
                      + Bắt đầu chat mới
                    </button>
                  </div>
                )}

                {/* Search Empty State */}
                {searchQuery && filteredSessions.length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground/80 space-y-2">
                    <p>Không tìm thấy cuộc trò chuyện nào phù hợp &quot;{searchQuery}&quot;</p>
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="text-emerald-600 hover:underline font-bold text-xs"
                    >
                      Xóa tìm kiếm
                    </button>
                  </div>
                )}
              </div>
            </aside>
          </>
        )}

        {/* Center/Left: Interactive Chessboard Area (Toggleable) */}
        {isBoardOpen && (
          <div className="w-full max-w-full h-[360px] sm:h-[420px] md:h-full md:w-[380px] lg:w-[440px] xl:w-[480px] shrink-0 flex flex-col items-center bg-card border border-border/70 rounded-xl p-2 sm:p-2.5 shadow-2xs overflow-hidden">
            {/* Board Top Status Bar */}
            <div className="w-full h-9 flex items-center justify-between pb-1.5 mb-1.5 border-b border-border/60 gap-2 shrink-0">
              <div className="flex items-center gap-2 truncate">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  Bàn cờ
                </span>

                <div className="h-5 flex items-center">
                  {isSkeleton ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60">
                      <Layers className="w-3 h-3" />
                      Hình thái Tốt (Skeleton)
                    </span>
                  ) : currentEval ? (
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
                  ) : null}
                </div>
              </div>

              {/* Turn indicator */}
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <span
                  className={`w-2.5 h-2.5 rounded-full border border-border shadow-2xs ${
                    currentFen.split(" ")[1] === "w" ? "bg-white" : "bg-slate-900"
                  }`}
                />
                <span>Lượt: {currentFen.split(" ")[1] === "w" ? "Trắng" : "Đen"}</span>
              </div>
            </div>

            {/* ChessBoard Component */}
            <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden p-0.5">
              <ChessBoard
                initialFen={baseFen}
                moves={activeMoves}
                currentPly={currentPly}
                orientation={boardOrientation}
                onPositionChange={(fen, ply) => {
                  setCurrentFen(fen);
                  setCurrentPly(ply);
                }}
                onMovesChange={(newMoves, ply, fen) => {
                  setActiveMoves(newMoves);
                  setCurrentPly(ply);
                  setCurrentFen(fen);
                }}
                onEvaluationChange={(evalData, thinking) => {
                  setCurrentEval(evalData);
                  setIsEngineThinking(thinking);
                }}
                height={540}
                fitParentHeight={true}
              />
            </div>

            {/* Move Navigation Control Bar */}
            <div className="w-full flex items-center justify-between px-2 py-1.5 mt-1 bg-muted/50 rounded-xl border border-border/60 shrink-0 text-xs select-none">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPly(0)}
                  disabled={currentPly === 0 || isSkeleton}
                  title="Nước đầu tiên (Phím Home)"
                  className="h-8 w-8 sm:h-8.5 sm:w-8.5 rounded-lg flex items-center justify-center bg-card hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none border border-border/60 transition cursor-pointer active:scale-95"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPly(Math.max(0, currentPly - 1))}
                  disabled={currentPly === 0 || isSkeleton}
                  title="Lùi 1 nước (Phím mũi tên Trái / <)"
                  className="h-8 w-9 sm:h-8.5 sm:w-10 rounded-lg flex items-center justify-center bg-card hover:bg-secondary text-foreground disabled:opacity-30 disabled:pointer-events-none border border-border/60 transition cursor-pointer active:scale-95"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <span
                  title={
                    currentPly === 0
                      ? "Ban đầu"
                      : `Nước ${Math.ceil(currentPly / 2)}/${Math.ceil(activeMoves.length / 2)}`
                  }
                  className="font-mono text-[11px] font-bold px-2 py-1 text-foreground bg-card rounded-md border border-border/70 shadow-2xs min-w-[70px] text-center"
                >
                  {isSkeleton
                    ? "Hình thái Tốt"
                    : currentPly === 0
                    ? "Ban đầu"
                    : `Nước ${Math.ceil(currentPly / 2)}/${Math.ceil(activeMoves.length / 2)}`}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPly(Math.min(activeMoves.length, currentPly + 1))}
                  disabled={currentPly >= activeMoves.length || isSkeleton}
                  title="Tiến 1 nước (Phím mũi tên Phải / >)"
                  className="h-8 w-9 sm:h-8.5 sm:w-10 rounded-lg flex items-center justify-center bg-card hover:bg-secondary text-foreground disabled:opacity-30 disabled:pointer-events-none border border-border/60 transition cursor-pointer active:scale-95"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPly(activeMoves.length)}
                  disabled={currentPly >= activeMoves.length || isSkeleton}
                  title="Nước cuối cùng (Phím End)"
                  className="h-8 w-8 sm:h-8.5 sm:w-8.5 rounded-lg flex items-center justify-center bg-card hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none border border-border/60 transition cursor-pointer active:scale-95"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setBoardOrientation((prev) => (prev === "white" ? "black" : "white"))}
                  title={`Xoay bàn cờ (Đang xem: ${boardOrientation === "white" ? "Trắng" : "Đen"})`}
                  className="h-8 px-2 sm:px-2.5 rounded-lg flex items-center gap-1 bg-card hover:bg-secondary text-muted-foreground hover:text-foreground text-[11px] font-semibold border border-border/60 transition cursor-pointer active:scale-95"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Xoay</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBaseFen(START_FEN);
                    setCurrentFen(START_FEN);
                    setActiveMoves([]);
                    setCurrentPly(0);
                    setSelectedGameId("");
                  }}
                  disabled={activeMoves.length === 0 && currentFen === START_FEN}
                  title="Xóa ván cờ, đặt lại bàn cờ ban đầu"
                  className="h-8 px-2 sm:px-2.5 rounded-lg flex items-center gap-1 bg-card hover:bg-destructive/10 hover:text-destructive text-muted-foreground disabled:opacity-30 disabled:pointer-events-none text-[11px] font-semibold border border-border/60 transition cursor-pointer active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Xóa bàn</span>
                </button>
              </div>
            </div>

            {/* Bottom Controls: Game Loader & Ask AI about board */}
            <div className="w-full mt-2 pt-2 border-t border-border/60 flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-1.5 w-full">
                <div className="flex-1 min-w-0">
                  <select
                    value={selectedGameId}
                    onChange={(e) => handleSelectGame(e.target.value)}
                    className="w-full bg-background border border-border/70 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-none cursor-pointer truncate"
                  >
                    <option value="">-- Xếp ván đấu ({playerGames.length} ván PGN) --</option>
                    {playerGames.map((g, idx) => {
                      const white = g.white_player || "Trắng";
                      const black = g.black_player || "Đen";
                      const res = g.result || "*";
                      const eco = g.eco ? `[${g.eco}] ` : "";
                      return (
                        <option key={g.id || idx} value={g.id}>
                          Ván {idx + 1}: {white} vs {black} ({res}) {eco}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(currentFen);
                    setCopiedFen(true);
                    setTimeout(() => setCopiedFen(false), 2000);
                  }}
                  title="Sao chép FEN của thế cờ hiện tại"
                  className="p-1.5 sm:p-2 rounded-xl border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer shrink-0"
                >
                  {copiedFen ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="flex items-center gap-1.5 w-full">
                {selectedGame && (
                  <button
                    type="button"
                    onClick={handleAskAboutEntireGame}
                    title="Yêu cầu AI phân tích toàn bộ diễn biến ván đấu này từ khai cuộc đến tàn cuộc"
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 font-bold text-xs shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer truncate"
                  >
                    <span className="truncate">Phân tích cả ván 📋</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleAskAboutBoard}
                  title="Gửi thế cờ này cho Trợ lí AI phân tích"
                  className={`${selectedGame ? "flex-1 min-w-0" : "w-full"} px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer truncate`}
                >
                  <Send className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {isSkeleton
                      ? "Phân tích cấu trúc Tốt ↗"
                      : selectedGame
                      ? currentPly === 0
                        ? "Thế cờ đầu ↗"
                        : `Thế cờ (Nước ${Math.ceil(currentPly / 2)}) ↗`
                      : "Gửi thế cờ vào chat ↗"}
                  </span>
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
              runId={
                activeSession.playerIds.length === 0
                  ? "general"
                  : activeSession.playerIds.length === 1
                  ? `run-${activeSession.playerIds[0]}`
                  : "multi"
              }
              playerId={activeSession.playerIds.length === 1 ? activeSession.playerIds[0] : ""}
              playerIds={activeSession.playerIds}
              playerName={activePlayerDisplayName}
              gamesCount={playerGames.length}
              currentFen={currentFen}
              currentEval={currentEval}
              selectedGame={selectedGame}
              currentPly={currentPly}
              isBoardOpen={isBoardOpen}
              onToggleBoard={() => setIsBoardOpen((prev) => !prev)}
              onOpenBoard={(fen) => {
                setIsBoardOpen(true);
                if (fen) handleApplyFen(fen);
              }}
              onApplyFen={handleApplyFen}
              messages={activeSession.messages}
              setMessages={(msgs) => handleUpdateActiveMessages(msgs)}
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
              pendingPrompt={pendingPrompt}
              onClearPendingPrompt={() => setPendingPrompt(null)}
              onNewChat={() => handleCreateNewChat()}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-card border border-border/60 rounded-xl">
              <p className="text-sm text-muted-foreground">Đang tải cuộc trò chuyện...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
