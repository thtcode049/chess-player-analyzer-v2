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
  Loader2,
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
import { createClient } from "@/lib/supabase/client";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

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

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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

  const draftId = generateUUID();

  return {
    id: draftId,
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
  const [currentUser, setCurrentUser] = useState<any>(null);
  const supabase = createClient();

  // Chat sessions state (single source of truth for all chat sessions)
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);

  // Synchronized refs to avoid stale closures in streaming callbacks
  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

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

  // Move Ribbon refs & state
  const moveRibbonRef = useRef<HTMLDivElement>(null);
  const activeMoveRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll move ribbon to active move smoothly inside horizontal container
  useEffect(() => {
    if (!moveRibbonRef.current) return;
    const container = moveRibbonRef.current;

    // When at move 0 ("Ban đầu"), always scroll directly back to the beginning
    if (currentPly === 0) {
      container.scrollTo({
        left: 0,
        behavior: "smooth",
      });
      return;
    }

    if (activeMoveRef.current) {
      const target = activeMoveRef.current;
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      // Target position relative to visible container viewport
      const relativeLeft = targetRect.left - containerRect.left;
      const delta = relativeLeft - containerRect.width / 2 + targetRect.width / 2;

      container.scrollTo({
        left: Math.max(0, container.scrollLeft + delta),
        behavior: "smooth",
      });
    }
  }, [currentPly, activeMoves]);

  const isEvalForCurrentFen = useMemo(() => {
    if (!currentEval || !currentFen) return false;
    return normalizeFen(currentEval.fen) === normalizeFen(currentFen);
  }, [currentEval, currentFen]);

  const movePairs = useMemo(() => {
    const pairs: { number: number; white?: string; whitePly?: number; black?: string; blackPly?: number }[] = [];
    for (let i = 0; i < activeMoves.length; i += 2) {
      pairs.push({
        number: Math.floor(i / 2) + 1,
        white: activeMoves[i],
        whitePly: i + 1,
        black: activeMoves[i + 1],
        blackPly: i + 2 <= activeMoves.length ? i + 2 : undefined,
      });
    }
    return pairs;
  }, [activeMoves]);

  const isWhiteTurn = (currentFen.split(" ")[1] || "w") === "w";

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

  // 1. Fetch Players list and check auth state on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user || null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });

    apiClient
      .getPlayers()
      .then((data) => {
        setPlayers(data || []);
      })
      .catch(() => {});

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // 2. Load Chat Sessions on mount with strict guest vs authenticated tenancy
  useEffect(() => {
    let isSubscribed = true;

    async function loadSessions() {
      let loaded: ChatSession[] = [];
      let authenticatedUser: any = null;

      try {
        const { data } = await supabase.auth.getUser();
        authenticatedUser = data?.user || null;
        setCurrentUser(authenticatedUser);
      } catch {
        authenticatedUser = null;
      }

      if (authenticatedUser?.id) {
        // Authenticated user: Load from Supabase DB, fallback to user-scoped localStorage
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

        if (loaded.length === 0 && typeof window !== "undefined") {
          try {
            const userKey = `chess_ai_conversations_user_${authenticatedUser.id}`;
            const raw = localStorage.getItem(userKey);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                loaded = parsed.filter((s) => s && s.messages && s.messages.some((m: any) => m.role === "user"));
              }
            }
          } catch (e) {
            console.warn("Failed to parse user local storage sessions:", e);
          }
        }
      } else {
        // Guest mode: WIPE legacy global storage to eliminate data leak
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("chess_ai_conversations_v4");
            const guestId = sessionStorage.getItem("chess_guest_session_id") || "guest";
            const raw = sessionStorage.getItem(`chess_guest_ai_conversations_${guestId}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                loaded = parsed.filter((s) => s && s.messages && s.messages.some((m: any) => m.role === "user"));
              }
            }
          } catch (e) {
            console.warn("Failed to parse guest session storage:", e);
          }
        }
      }

      if (!isSubscribed) return;

      if (loaded.length > 0) {
        setSessions(loaded);
        setActiveSessionId(loaded[0].id);
      } else {
        // No saved sessions: Initialize initial draft session (LAZY CREATION: not persisted!)
        let initialPids: string[] = [];
        const availablePlayerIds = new Set(players.map((p) => p.id));
        if (queryPlayerId && availablePlayerIds.has(queryPlayerId)) {
          initialPids = [queryPlayerId];
        } else if (workspaceStore.activeMode === "single" && workspaceStore.activePlayerId && availablePlayerIds.has(workspaceStore.activePlayerId)) {
          initialPids = [workspaceStore.activePlayerId];
        } else if (workspaceStore.activeMode === "multi" && workspaceStore.multiProfiles.length > 0) {
          initialPids = workspaceStore.multiProfiles
            .map((m) => m.player.id)
            .filter((id) => availablePlayerIds.has(id));
        }
        const initialDraft = createDraftSession(initialPids, players);
        setSessions([initialDraft]);
        setActiveSessionId(initialDraft.id);
      }

      setIsLoaded(true);
    }

    loadSessions();

    return () => {
      isSubscribed = false;
    };
  }, [players, workspaceStore.chatSessionsVersion]);

  // Handle direct navigation to active chat session from FloatingAiChatWidget
  useEffect(() => {
    if (workspaceStore.activeChatSessionId) {
      setActiveSessionId(workspaceStore.activeChatSessionId);
      workspaceStore.setActiveChatSessionId(null);
    }
  }, [workspaceStore.activeChatSessionId]);

  // 3. Save concrete sessions strictly isolated by tenancy
  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return;
    try {
      const concreteToSave = sessions.filter((s) => !s.isDraft && s.messages.some((m) => m.role === "user"));
      if (currentUser?.id) {
        localStorage.setItem(`chess_ai_conversations_user_${currentUser.id}`, JSON.stringify(concreteToSave));
      } else {
        const guestId = sessionStorage.getItem("chess_guest_session_id") || "guest";
        sessionStorage.setItem(`chess_guest_ai_conversations_${guestId}`, JSON.stringify(concreteToSave));
        localStorage.removeItem("chess_ai_conversations_v4");
      }
    } catch (e) {
      console.warn("Failed to save isolated chat backup:", e);
    }
  }, [sessions, isLoaded, currentUser]);

  // Current active session from sessions list
  const activeSession: ChatSession = useMemo(() => {
    const found = sessions.find((s) => s.id === activeSessionId);
    if (found) return found;
    if (sessions.length > 0) return sessions[0];
    return createDraftSession([], players);
  }, [activeSessionId, sessions, players]);

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
  const handleUpdateActiveMessages = useCallback(
    (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      const currentActiveId = activeSessionIdRef.current;

      setSessions((prevSessions) => {
        let targetIdx = prevSessions.findIndex((s) => s.id === currentActiveId);

        // Fallback: If not found by active ID, fallback to top session
        if (targetIdx === -1) {
          if (prevSessions.length > 0) targetIdx = 0;
          else return prevSessions;
        }

        const targetSession = prevSessions[targetIdx];
        const currentMsgs = targetSession.messages;
        const nextMsgs = typeof updater === "function" ? updater(currentMsgs) : updater;

        const firstUser = nextMsgs.find((m) => m.role === "user");
        let title = targetSession.title;
        if (
          firstUser &&
          firstUser.content &&
          (title === "Đoạn chat mới" ||
            title === "Trò chuyện tự do cùng AI" ||
            title.startsWith("Phân tích:") ||
            title.startsWith("So sánh:"))
        ) {
          title = firstUser.content.slice(0, 36) + (firstUser.content.length > 36 ? "..." : "");
        }

        const isFirstPrompt = Boolean(targetSession.isDraft && firstUser);
        const updatedSession: ChatSession = {
          ...targetSession,
          title,
          updatedAt: Date.now(),
          messages: nextMsgs,
          isDraft: isFirstPrompt ? false : targetSession.isDraft,
        };

        const nextList = [...prevSessions];
        nextList[targetIdx] = updatedSession;

        // If this is the first prompt in a draft session, persist to Supabase
        if (isFirstPrompt) {
          apiClient
            .createAiChatSession({
              id: updatedSession.id,
              player_ids: updatedSession.playerIds,
              title: updatedSession.title,
              pinned: updatedSession.pinned,
              messages: nextMsgs,
            })
            .catch((err) => {
              console.warn("Failed to persist new session to Supabase:", err);
            });
        }

        return nextList;
      });
    },
    []
  );

  // Handler: Persist session to Supabase once streaming completes (avoids 100+ PUT spam)
  const handlePersistActiveSession = useCallback(() => {
    const currentActiveId = activeSessionIdRef.current;
    const session = sessionsRef.current.find((s) => s.id === currentActiveId);
    if (!session || session.isDraft) return;

    apiClient
      .updateAiChatSession(session.id, {
        title: session.title,
        player_ids: session.playerIds,
        messages: session.messages,
      })
      .catch((err) => {
        console.warn("Failed to persist session to Supabase:", err);
      });
  }, []);

  // Handler: Create a new chat session (enters in-memory draft state - LAZY CREATION)
  const handleCreateNewChat = (specificPlayerIds?: string[]) => {
    const targetPids = specificPlayerIds !== undefined ? specificPlayerIds : activeSession.playerIds;

    // Check if the current session is an un-messaged draft: simply switch its player
    const current = sessionsRef.current.find((s) => s.id === activeSessionIdRef.current);
    if (current && !current.messages.some((m) => m.role === "user")) {
      const updatedDraft = createDraftSession(targetPids, players);
      activeSessionIdRef.current = updatedDraft.id;
      setSessions((prev) => [
        updatedDraft,
        ...prev.filter((s) => s.id !== current.id && s.messages.some((m) => m.role === "user")),
      ]);
      setActiveSessionId(updatedDraft.id);
      return;
    }

    const newDraft = createDraftSession(targetPids, players);
    activeSessionIdRef.current = newDraft.id;
    // Put newDraft at the top of sessions, cleaning up any empty drafts without user messages
    setSessions((prev) => [
      newDraft,
      ...prev.filter((s) => s.messages && s.messages.some((m) => m.role === "user")),
    ]);
    setActiveSessionId(newDraft.id);
  };

  // Synchronize when active player changes in workspaceStore (e.g. from Navbar profile switcher)
  useEffect(() => {
    if (!isLoaded) return;
    const navPid = workspaceStore.activePlayerId;
    if (!navPid || workspaceStore.activeMode !== "single") return;

    // Check if the current active session already belongs to this player
    const current = sessions.find((s) => s.id === activeSessionIdRef.current);
    if (current && current.playerIds.length === 1 && current.playerIds[0] === navPid) {
      return;
    }

    // If current session is a fresh draft (no user messages yet), safely switch its player
    if (current && !current.messages.some((m) => m.role === "user")) {
      const updatedDraft = createDraftSession([navPid], players);
      activeSessionIdRef.current = updatedDraft.id;
      setSessions((prev) => [
        updatedDraft,
        ...prev.filter((s) => s.id !== current.id && s.messages.some((m) => m.role === "user")),
      ]);
      setActiveSessionId(updatedDraft.id);
      return;
    }

    // Current session is an existing conversation (e.g. nganbanghe):
    // DO NOT MUTATE THE EXISTING CONVERSATION!
    // Instead, look for an existing session with this player, or create a new draft for the selected player
    const existingSessionForPlayer = sessions.find(
      (s) => s.playerIds.length === 1 && s.playerIds[0] === navPid
    );

    if (existingSessionForPlayer) {
      setActiveSessionId(existingSessionForPlayer.id);
    } else {
      handleCreateNewChat([navPid]);
    }
  }, [workspaceStore.activePlayerId, workspaceStore.activeMode, isLoaded]);

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
          setActiveSessionId(fresh.id);
          return [fresh];
        }
      }
      return remaining;
    });
  };

  // Handler: Switch to analyzing another player (safe against mutating historical chats)
  const handleAddPlayerToContext = (playerId: string) => {
    setIsAddingPlayerOpen(false);
    const hasUserMsg = activeSession.messages.some((m) => m.role === "user");
    if (hasUserMsg) {
      handleCreateNewChat([playerId]);
      return;
    }

    // If current session is an un-messaged draft, update it in sessions
    const updatedDraft = createDraftSession([playerId], players);
    activeSessionIdRef.current = updatedDraft.id;
    setSessions((prev) => [
      updatedDraft,
      ...prev.filter((s) => s.id !== activeSession.id && s.messages.some((m) => m.role === "user")),
    ]);
    setActiveSessionId(updatedDraft.id);
  };

  // Handler: Add player to multi-profile comparison
  const handleAddPlayerForCompare = (playerId: string) => {
    setIsAddingPlayerOpen(false);
    if (activeSession.playerIds.includes(playerId)) return;
    const nextPids = [...activeSession.playerIds, playerId];

    if (activeSession.isDraft || !activeSession.messages.some((m) => m.role === "user")) {
      const updatedDraft = createDraftSession(nextPids, players);
      setSessions((prev) => prev.map((s) => (s.id === activeSession.id ? updatedDraft : s)));
    } else {
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSession.id ? { ...s, playerIds: nextPids } : s))
      );
      apiClient.updateAiChatSession(activeSession.id, { player_ids: nextPids }).catch(() => {});
    }
  };

  const handleRemovePlayerFromContext = (playerId: string) => {
    const nextPids = activeSession.playerIds.filter((id) => id !== playerId);

    if (activeSession.isDraft || !activeSession.messages.some((m) => m.role === "user")) {
      const updatedDraft = createDraftSession(nextPids, players);
      setSessions((prev) => prev.map((s) => (s.id === activeSession.id ? updatedDraft : s)));
    } else if (activeSession.playerIds.length > 1) {
      // Only allow removing if there are at least 2 players in compare mode
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
      if (s.isDraft || !s.messages.some((m) => m.role === "user")) continue;
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

  const savedSessionsCount = useMemo(() => {
    return sessions.filter((s) => !s.isDraft && s.messages.some((m) => m.role === "user")).length;
  }, [sessions]);

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
        className={`group relative flex flex-col px-2.5 py-2 rounded-md text-xs cursor-pointer transition select-none ${
          isActive
            ? "bg-emerald-50 text-emerald-950 font-bold border border-emerald-300"
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
                  className="p-1 rounded-md hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition"
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
                  <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 font-bold truncate text-[9px]">
                    {sessionPlayerNames[0]}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 rounded bg-teal-50 text-teal-800 font-bold truncate text-[9px]">
                    {sessionPlayerNames[0]} + {sessionPlayerNames.length - 1}
                  </span>
                )}
              </div>
              <span className="font-mono tabular-nums">{formatRelativeTime(session.updatedAt)}</span>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-[calc(100dvh-7.5rem)] md:h-[calc(100dvh-6.5rem)] flex flex-col overflow-hidden select-none">
      {/* Main Workspace: Sidebar + (Board) + Chat */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-2 sm:gap-2.5 overflow-hidden relative">
        {/* Left: Chat History Sidebar (Chronological & Professional Grouping) */}
        {isSidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden animate-fade-in"
              onClick={() => setIsSidebarOpen(false)}
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-[280px] sm:w-[320px] md:static md:z-auto md:w-[280px] lg:w-[310px] shrink-0 h-full flex flex-col bg-card border-r md:border border-border/70 md:rounded-md overflow-hidden shadow-xl md:shadow-none">
              {/* TOP 1/3: PROFILE / PROJECT SELECTOR */}
              <div className="p-3 border-b border-border/60 bg-muted/20 shrink-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <User className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Hồ sơ phân tích</span>
                  </div>
                  {playerGames.length > 0 && (
                    <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      {playerGames.length} ván
                    </span>
                  )}
                </div>

                {/* Active Profiles Pills */}
                <div className="space-y-1.5">
                  {activeSession.playerIds.length === 0 ? (
                    <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      <Bot className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Trợ lí AI Tự do</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {activeSession.playerIds.map((pid) => {
                        const p = players.find((pl) => pl.id === pid);
                        const name = p?.canonical_name || "Kỳ thủ";
                        const canRemove = activeSession.isDraft || activeSession.playerIds.length > 1;
                        return (
                          <div
                            key={pid}
                            className="flex items-center gap-1 bg-emerald-600 text-white rounded pl-2 pr-1.5 py-0.5 text-xs font-semibold"
                          >
                            <span className="truncate max-w-[140px]">{name}</span>
                            {canRemove && (
                              <button
                                type="button"
                                onClick={() => handleRemovePlayerFromContext(pid)}
                                title={`Bỏ ${name} khỏi cuộc trò chuyện`}
                                className="p-0.5 hover:bg-white/20 rounded transition cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Switch / Add / Compare Player Dropdown Button */}
                  <div className="relative z-40" ref={addPlayerRef}>
                    <button
                      type="button"
                      onClick={() => setIsAddingPlayerOpen((prev) => !prev)}
                      className="w-full py-1.5 px-2.5 rounded border border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition flex items-center justify-between cursor-pointer"
                      title="Chọn hoặc đổi hồ sơ kỳ thủ phân tích"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {activeSession.playerIds.length === 0
                            ? "Chọn hồ sơ..."
                            : activeSession.playerIds.length === 1
                            ? "+ So sánh với..."
                            : "+ Thêm kỳ thủ"}
                        </span>
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    </button>

                    {isAddingPlayerOpen && (
                      <div className="absolute left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-card border border-border/80 rounded-md shadow-xl z-50 py-1.5 animate-in fade-in-50 zoom-in-95">
                        <div className="px-3 py-1 text-[11px] font-bold text-muted-foreground uppercase border-b border-border/40 mb-1 sticky top-0 bg-card">
                          Chọn kỳ thủ phân tích
                        </div>
                        {activeSession.playerIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingPlayerOpen(false);
                              const hasUserMsg = activeSession.messages.some((m) => m.role === "user");
                              if (hasUserMsg) {
                                handleCreateNewChat([]);
                              } else {
                                const updatedDraft = createDraftSession([], players);
                                setSessions((prev) => [
                                  updatedDraft,
                                  ...prev.filter((s) => s.id !== activeSession.id && s.messages.some((m) => m.role === "user")),
                                ]);
                                setActiveSessionId(updatedDraft.id);
                              }
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-muted font-medium flex items-center gap-2 cursor-pointer"
                          >
                            <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>Chuyển về Trò chuyện tự do</span>
                          </button>
                        )}
                        {players
                          .filter((p) => !activeSession.playerIds.includes(p.id))
                          .map((p) => (
                            <div
                              key={p.id}
                              className="px-2.5 py-1 hover:bg-muted/80 rounded flex items-center justify-between gap-1 transition"
                            >
                              <button
                                type="button"
                                onClick={() => handleAddPlayerToContext(p.id)}
                                className="flex-1 min-w-0 text-left py-1 text-xs text-foreground font-semibold flex items-center gap-1.5 truncate cursor-pointer hover:text-emerald-600"
                                title={`Phân tích kỳ thủ ${p.canonical_name}`}
                              >
                                <span className="truncate">{p.canonical_name}</span>
                                {p.title && (
                                  <span className="text-[10px] px-1 py-0.2 rounded bg-amber-50 text-amber-800 font-bold shrink-0">
                                    {p.title}
                                  </span>
                                )}
                              </button>
                              {activeSession.playerIds.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleAddPlayerForCompare(p.id)}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold transition shrink-0 cursor-pointer"
                                  title={`Thêm ${p.canonical_name} vào so sánh đối đầu`}
                                >
                                  + So sánh
                                </button>
                              )}
                            </div>
                          ))}
                        {players.filter((p) => !activeSession.playerIds.includes(p.id)).length === 0 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground text-center italic">
                            Đã chọn tất cả kỳ thủ
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* BOTTOM 2/3: CONVERSATION HISTORY */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* Sidebar Top: Title & New Chat */}
                <div className="p-3 border-b border-border/60 flex items-center justify-between gap-2 shrink-0 bg-card">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Lịch sử trò chuyện
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCreateNewChat()}
                      className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
                      title="Tạo đoạn chat mới (Lazy: chỉ lưu khi gửi tin nhắn đầu tiên)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Mới</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSidebarOpen(false)}
                      className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                      title="Thu gọn danh sách lịch sử"
                    >
                      <PanelLeftClose className="w-4 h-4" />
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
                      className="w-full bg-muted/60 focus:bg-background border border-border/60 rounded pl-8 pr-7 py-1 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
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
                    <div className="px-2 py-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
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
                {savedSessionsCount === 0 && !searchQuery && (
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
            </div>
          </aside>
          </>
        )}

        {/* Center/Left: Interactive Chessboard Area (Toggleable) */}
        {isBoardOpen && (
          <div className="w-full max-w-full h-[360px] sm:h-[420px] md:h-full md:w-[380px] lg:w-[440px] xl:w-[480px] shrink-0 flex flex-col items-center bg-card border border-border/70 rounded-md p-2 sm:p-2.5 overflow-hidden">
            {/* Board Top Status Bar: Stockfish Eval & Horizontal Move Ribbon */}
            <div className="w-full h-9 flex items-center gap-2 pb-1.5 mb-1.5 border-b border-border/60 shrink-0 overflow-hidden">
              {/* Left: Eval Badge (Strict Fixed Width: 70px, zero layout shift) */}
              <div className="w-[70px] h-6 shrink-0 flex items-center justify-center select-none">
                {isSkeleton ? (
                  <span className="w-full h-full inline-flex items-center justify-center gap-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    <Layers className="w-3 h-3 shrink-0" />
                    <span>Hình thái</span>
                  </span>
                ) : isEvalForCurrentFen && currentEval ? (
                  <span
                    className={`w-full h-full inline-flex items-center justify-center gap-1 rounded-md text-[11px] font-mono tabular-nums font-bold border transition-colors ${
                      currentEval.isMate
                        ? (currentEval.mateIn ?? currentEval.score) > 0
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                        : (currentEval.score || 0) > 0
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : (currentEval.score || 0) < 0
                        ? "bg-rose-50 text-rose-800 border-rose-200"
                        : "bg-slate-50 text-slate-700 border-slate-200"
                    }`}
                    title={
                      currentEval.isMate
                        ? `Chiếu bí sau ${currentEval.mateIn ?? currentEval.score} nước`
                        : `Đánh giá: ${(currentEval.score / 100).toFixed(2)}`
                    }
                  >
                    <TrendingUp className="w-3 h-3 shrink-0 opacity-70" />
                    <span className="truncate">
                      {currentEval.isMate
                        ? `#M${currentEval.mateIn ?? currentEval.score}`
                        : `${currentEval.score > 0 ? "+" : ""}${(currentEval.score / 100).toFixed(2)}`}
                    </span>
                  </span>
                ) : (
                  <span
                    className="w-full h-full inline-flex items-center justify-center gap-1 rounded-md text-[11px] font-mono font-medium bg-slate-50 text-slate-400 border border-slate-200"
                    title="Đang tính điểm..."
                  >
                    <Loader2 className="w-3 h-3 animate-spin shrink-0 text-slate-400" />
                    <span>...</span>
                  </span>
                )}
              </div>

              {/* Middle: Horizontal Interactive Move Ribbon (Full width remaining) */}
              <div
                ref={moveRibbonRef}
                onWheel={(e) => {
                  if (e.deltaY !== 0 && moveRibbonRef.current) {
                    moveRibbonRef.current.scrollLeft += e.deltaY;
                  }
                }}
                className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth py-0.5"
              >
                {movePairs.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground/80 italic truncate px-1">
                    {isSkeleton ? "Hình thái Tốt" : "Bàn cờ ban đầu (Chưa có nước đi)"}
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setCurrentPly(0)}
                      ref={currentPly === 0 ? activeMoveRef : null}
                      title="Về thế cờ ban đầu (Nước 0)"
                      className={`shrink-0 px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                        currentPly === 0
                          ? "bg-emerald-600 text-white font-bold shadow-xs"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      Ban đầu
                    </button>
                    {movePairs.map((p) => (
                      <div key={p.number} className="shrink-0 flex items-center text-xs font-mono">
                        <span className="text-[10px] text-muted-foreground/70 font-semibold mr-1 select-none">
                          {p.number}.
                        </span>
                        {p.white && (
                          <button
                            type="button"
                            onClick={() => setCurrentPly(p.whitePly!)}
                            ref={currentPly === p.whitePly ? activeMoveRef : null}
                            title={`Chuyển tới nước ${p.number} (Trắng đi ${p.white})`}
                            className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                              currentPly === p.whitePly
                                ? "bg-emerald-600 text-white font-bold shadow-xs"
                                : "text-foreground/90 hover:bg-muted"
                            }`}
                          >
                            {p.white}
                          </button>
                        )}
                        {p.black && (
                          <button
                            type="button"
                            onClick={() => setCurrentPly(p.blackPly!)}
                            ref={currentPly === p.blackPly ? activeMoveRef : null}
                            title={`Chuyển tới nước ${p.number}... ${p.black} (Đen)`}
                            className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ml-0.5 ${
                              currentPly === p.blackPly
                                ? "bg-emerald-600 text-white font-bold shadow-xs"
                                : "text-foreground/90 hover:bg-muted"
                            }`}
                          >
                            {p.black}
                          </button>
                        )}
                      </div>
                    ))}
                  </>
                )}
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

            {/* Move Navigation Control Bar (Clean, Borderless) */}
            <div className="w-full flex items-center justify-between px-1 py-1 mt-1 shrink-0 text-xs select-none">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPly(0)}
                  disabled={currentPly === 0 || isSkeleton}
                  title="Nước đầu tiên (Phím Home)"
                  className="h-8 w-8 sm:h-8.5 sm:w-8.5 rounded flex items-center justify-center border-0 bg-transparent hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPly(Math.max(0, currentPly - 1))}
                  disabled={currentPly === 0 || isSkeleton}
                  title="Lùi 1 nước (Phím mũi tên Trái / <)"
                  className="h-8 w-9 sm:h-8.5 sm:w-10 rounded flex items-center justify-center border-0 bg-transparent hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <span
                  title={
                    currentPly === 0
                      ? "Ban đầu"
                      : `Nước ${Math.ceil(currentPly / 2)}/${Math.ceil(activeMoves.length / 2)}`
                  }
                  className="font-mono text-[11px] font-semibold px-2 py-1 text-slate-600 min-w-[65px] text-center"
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
                  className="h-8 w-9 sm:h-8.5 sm:w-10 rounded-lg flex items-center justify-center border-0 bg-transparent hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer active:scale-95"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPly(activeMoves.length)}
                  disabled={currentPly >= activeMoves.length || isSkeleton}
                  title="Nước cuối cùng (Phím End)"
                  className="h-8 w-8 sm:h-8.5 sm:w-8.5 rounded-lg flex items-center justify-center border-0 bg-transparent hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer active:scale-95"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setBoardOrientation((prev) => (prev === "white" ? "black" : "white"))}
                  title={`Xoay bàn cờ (Đang xem: ${boardOrientation === "white" ? "Trắng" : "Đen"})`}
                  className="h-8 px-2 sm:px-2.5 rounded-lg flex items-center gap-1 border-0 bg-transparent hover:bg-slate-100 text-slate-700 text-[11px] font-medium transition cursor-pointer active:scale-95"
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
                  className="h-8 px-2 sm:px-2.5 rounded-lg flex items-center gap-1 border-0 bg-transparent hover:bg-rose-100 hover:text-rose-700 text-slate-700 disabled:opacity-30 disabled:pointer-events-none text-[11px] font-medium transition cursor-pointer active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Xóa bàn</span>
                </button>

                {/* Dot indicating turn (White or Black) at bottom-right corner below the board */}
                <div
                  className="flex items-center pl-1.5 sm:pl-2 border-l border-border/70 ml-0.5 shrink-0"
                  title={`Đến lượt: ${isWhiteTurn ? "Trắng" : "Đen"} đi quân`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full border border-slate-400/80 shadow-xs transition-colors shrink-0 ${
                      isWhiteTurn ? "bg-white ring-1 ring-slate-200" : "bg-slate-900 ring-1 ring-slate-800"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Bottom Controls: Game Loader & Ask AI about board */}
            <div className="w-full mt-2 pt-2 border-t border-border/60 flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-1.5 w-full">
                <div className="flex-1 min-w-0">
                  <select
                    value={selectedGameId}
                    onChange={(e) => handleSelectGame(e.target.value)}
                    className="w-full bg-background border border-border/70 rounded px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-none cursor-pointer truncate"
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
                  className="p-1.5 sm:p-2 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer shrink-0"
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
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer truncate"
                  >
                    <span className="truncate">Phân tích cả ván 📋</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleAskAboutBoard}
                  title="Gửi thế cờ này cho Trợ lí AI phân tích"
                  className={`${selectedGame ? "flex-1 min-w-0" : "w-full"} px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer truncate`}
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
              onStreamComplete={handlePersistActiveSession}
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
