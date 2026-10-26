"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
const STORAGE_KEY = "chess_ai_conversations_v3";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  fen?: string;
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

const GENERAL_CHAT_ID = "general";
const GENERAL_PLAYER_NAME = "Trò chuyện Tự do";
const MULTI_MATCHUP_ID = "multi_matchup";

function hasUserMessages(session: ChatSession): boolean {
  return session.messages.some((m) => m.role === "user");
}

function cleanDuplicateEmptySessions(sessionsList: ChatSession[]): ChatSession[] {
  if (!Array.isArray(sessionsList)) return [];
  const seenEmptyPlayerIds = new Set<string>();
  const result: ChatSession[] = [];

  for (const session of sessionsList) {
    if (hasUserMessages(session)) {
      result.push(session);
    } else {
      const pId = session.playerId || GENERAL_CHAT_ID;
      if (!seenEmptyPlayerIds.has(pId)) {
        seenEmptyPlayerIds.add(pId);
        result.push(session);
      }
    }
  }
  return result;
}

function createDefaultSession(playerId: string = GENERAL_CHAT_ID, playerName: string = GENERAL_PLAYER_NAME): ChatSession {
  const isGeneral = !playerId || playerId === GENERAL_CHAT_ID;
  const isMulti = playerId === MULTI_MATCHUP_ID;
  return {
    id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    playerId: isGeneral ? GENERAL_CHAT_ID : playerId,
    playerName: isGeneral ? GENERAL_PLAYER_NAME : playerName,
    title: isGeneral ? "Trò chuyện tự do cùng AI" : isMulti ? "Phân tích đối đầu Đa hồ sơ" : "Đoạn chat mới",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [
      {
        role: "assistant",
        content: isGeneral
          ? `Xin chào! Tôi là Trợ lí AI Cờ Vua. Bạn có thể trò chuyện tự do về cờ vua, thảo luận khai cuộc, chiến thuật, hoặc đi các nước cờ trên bàn cờ bên cạnh rồi hỏi tôi nhận xét bất kỳ lúc nào!`
          : isMulti
          ? `Xin chào! Tôi là Trợ lí AI Cờ Vua chế độ Đa hồ sơ. Tôi đã sẵn sàng phân tích so sánh, đối chiếu khai cuộc, điểm mạnh/yếu chiến thuật và tư vấn kế hoạch đối đầu giữa các kỳ thủ được chọn!`
          : `Xin chào! Tôi là Trợ lí AI phân tích cờ vua. Tôi đã nạp toàn bộ biên bản ván đấu PGN của **${playerName || "Kỳ thủ"}** và kết nối trực tiếp với bàn cờ.\n\nBạn có thể hỏi tôi bất kỳ điều gì về các ván đấu, khai cuộc, phong cách thi đấu, hoặc đi thử một nước cờ trên bàn cờ rồi hỏi tôi nhận xét!`,
      },
    ],
  };
}

export default function AiCoachView() {
  const queryPlayerId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("playerId") : null;
  const workspaceStore = useProfileWorkspaceStore();
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(() => {
    if (workspaceStore.activeMode === "multi") {
      return MULTI_MATCHUP_ID;
    }
    if (workspaceStore.activeMode === "single" && workspaceStore.activePlayerId) {
      return workspaceStore.activePlayerId;
    }
    return queryPlayerId || GENERAL_CHAT_ID;
  });
  const [selectedMultiPlayerIds, setSelectedMultiPlayerIds] = useState<string[]>(() => {
    if (workspaceStore.activeMode === "multi" && workspaceStore.multiProfiles.length > 0) {
      return workspaceStore.multiProfiles.map((m) => m.player.id);
    }
    return [];
  });
  const [playerGames, setPlayerGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>("");

  // Sync selectedMultiPlayerIds when multiProfiles change
  useEffect(() => {
    if (workspaceStore.activeMode === "multi" && workspaceStore.multiProfiles.length > 0) {
      const pIds = workspaceStore.multiProfiles.map((m) => m.player.id);
      setSelectedMultiPlayerIds((prev) => {
        const valid = prev.filter((id) => pIds.includes(id));
        return valid.length > 0 ? valid : pIds;
      });
      setSelectedPlayerId(MULTI_MATCHUP_ID);
    }
  }, [workspaceStore.activeMode, workspaceStore.multiProfiles]);

  const multiSelectedPlayers = useMemo(() => {
    return workspaceStore.multiProfiles.filter((m) => selectedMultiPlayerIds.includes(m.player.id));
  }, [workspaceStore.multiProfiles, selectedMultiPlayerIds]);

  const multiDisplayName = useMemo(() => {
    const names = multiSelectedPlayers.map((m) => m.player.canonical_name);
    return names.length > 0 ? `Đa hồ sơ (${names.join(" & ")})` : "Đa hồ sơ";
  }, [multiSelectedPlayers]);

  // Sync with workspace store active player if changed in single mode
  useEffect(() => {
    if (workspaceStore.activeMode === "single" && workspaceStore.activePlayerId) {
      if (selectedPlayerId !== workspaceStore.activePlayerId) {
        setSelectedPlayerId(workspaceStore.activePlayerId);
        setSelectedGameId("");
        setBaseFen(START_FEN);
        setCurrentFen(START_FEN);
        setActiveMoves([]);
        setCurrentPly(0);
      }
    }
  }, [workspaceStore.activeMode, workspaceStore.activePlayerId, selectedPlayerId]);

  // UI layout toggles
  const [isBoardOpen, setIsBoardOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setIsSidebarOpen(true);
    }
  }, []);

  // Board state - baseFen is the starting FEN for the activeMoves sequence
  const [baseFen, setBaseFen] = useState<string>(START_FEN);
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
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ [GENERAL_CHAT_ID]: true });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);

  // Session inline rename state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

  // Prompt trigger from Board
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  // 1. Fetch Players on mount
  useEffect(() => {
    apiClient
      .getPlayers()
      .then((data) => {
        const list = data || [];
        setPlayers(list);
        if (queryPlayerId && list.some((p) => p.id === queryPlayerId)) {
          setSelectedPlayerId(queryPlayerId);
        }
      })
      .catch(() => {
        // Keep current selectedPlayerId
      });
  }, [queryPlayerId]);

  // 2. Load Chat Sessions from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    let loadedSessions: ChatSession[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: ChatSession[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedSessions = cleanDuplicateEmptySessions(parsed);
        }
      }
    } catch (e) {
      console.warn("Failed to read chat sessions from localStorage:", e);
    }

    const isSingleMode = workspaceStore.activeMode === "single";
    const isMultiMode = workspaceStore.activeMode === "multi";
    const initialTargetPlayerId = isSingleMode && workspaceStore.activePlayerId
      ? workspaceStore.activePlayerId
      : isMultiMode
      ? MULTI_MATCHUP_ID
      : (queryPlayerId || GENERAL_CHAT_ID);

    let initialSession = loadedSessions.find((s) => (s.playerId || GENERAL_CHAT_ID) === initialTargetPlayerId);

    if (!initialSession) {
      if (loadedSessions.length > 0 && !queryPlayerId && !isSingleMode && !isMultiMode) {
        initialSession = loadedSessions[0];
      } else {
        const pObj = players.find((p) => p.id === initialTargetPlayerId);
        const pName = initialTargetPlayerId === GENERAL_CHAT_ID
          ? GENERAL_PLAYER_NAME
          : initialTargetPlayerId === MULTI_MATCHUP_ID
          ? "Phân tích Đối đầu Đa hồ sơ"
          : (pObj?.canonical_name || "Kỳ thủ");
        initialSession = createDefaultSession(
          initialTargetPlayerId,
          pName
        );
        loadedSessions = [initialSession, ...loadedSessions];
      }
    }

    const finalCleaned = cleanDuplicateEmptySessions(loadedSessions);
    setSessions(finalCleaned);
    setActiveSessionId(initialSession.id);
    setSelectedPlayerId(initialSession.playerId || (isSingleMode && workspaceStore.activePlayerId ? workspaceStore.activePlayerId : isMultiMode ? MULTI_MATCHUP_ID : GENERAL_CHAT_ID));
    setExpandedFolders({ [initialSession.playerId || (isMultiMode ? MULTI_MATCHUP_ID : GENERAL_CHAT_ID)]: true });
    setIsLoaded(true);
  }, [queryPlayerId, workspaceStore.activeMode, workspaceStore.activePlayerId, players]);

  // 3. Save Chat Sessions to localStorage (only after loaded)
  useEffect(() => {
    if (!isLoaded || typeof window === "undefined" || sessions.length === 0) return;
    try {
      const toSave = cleanDuplicateEmptySessions(sessions);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn("Failed to save chat sessions to localStorage:", e);
    }
  }, [sessions, isLoaded]);

  // Selected player object
  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);
  const currentPlayerName =
    selectedPlayer?.canonical_name ||
    (selectedPlayerId === GENERAL_CHAT_ID
      ? GENERAL_PLAYER_NAME
      : selectedPlayerId === MULTI_MATCHUP_ID
      ? "Phân tích Đối đầu Đa hồ sơ"
      : "Kỳ thủ");

  // 4. Ensure an active session exists whenever selectedPlayerId changes
  useEffect(() => {
    if (!isLoaded) return;

    if (workspaceStore.activeMode === "single" && workspaceStore.activePlayerId) {
      if (selectedPlayerId === GENERAL_CHAT_ID || selectedPlayerId !== workspaceStore.activePlayerId) {
        setSelectedPlayerId(workspaceStore.activePlayerId);
        return;
      }
    } else if (workspaceStore.activeMode === "multi") {
      if (selectedPlayerId === GENERAL_CHAT_ID) {
        setSelectedPlayerId(MULTI_MATCHUP_ID);
        return;
      }
    }

    const isMultiMode = workspaceStore.activeMode === "multi";
    const targetPlayerId = selectedPlayerId || (isMultiMode ? MULTI_MATCHUP_ID : GENERAL_CHAT_ID);
    const isGeneral = targetPlayerId === GENERAL_CHAT_ID;
    const isMulti = targetPlayerId === MULTI_MATCHUP_ID;
    const targetPlayerName = isGeneral
      ? GENERAL_PLAYER_NAME
      : isMulti
      ? "Phân tích Đối đầu Đa hồ sơ"
      : (players.find((p) => p.id === targetPlayerId)?.canonical_name || "Kỳ thủ");

    setExpandedFolders((prev) => ({ ...prev, [targetPlayerId]: true }));

    // Check if the current active session already matches targetPlayerId
    const currentActive = sessions.find((s) => s.id === activeSessionId);
    if (
      currentActive &&
      (currentActive.playerId || (isMultiMode ? MULTI_MATCHUP_ID : GENERAL_CHAT_ID)) === targetPlayerId
    ) {
      return;
    }

    // Look for an existing session for this player / matchup
    const existingForPlayer = sessions.find(
      (s) => (s.playerId || (isMultiMode ? MULTI_MATCHUP_ID : GENERAL_CHAT_ID)) === targetPlayerId
    );
    if (existingForPlayer) {
      setActiveSessionId(existingForPlayer.id);
    } else {
      const newSession = createDefaultSession(targetPlayerId, targetPlayerName);
      setSessions((prev) => [newSession, ...cleanDuplicateEmptySessions(prev)]);
      setActiveSessionId(newSession.id);
    }
  }, [selectedPlayerId, isLoaded, players, workspaceStore.activeMode, workspaceStore.activePlayerId, sessions, activeSessionId]);

  // 5. Fetch or Synchronize Player Games when selected player or multi profile changes
  useEffect(() => {
    if (workspaceStore.activeMode === "multi") {
      if (selectedMultiPlayerIds.length === 0) {
        setPlayerGames([]);
        setSelectedGameId("");
        return;
      }
      let isCurrent = true;
      Promise.all(
        selectedMultiPlayerIds.map((pId) =>
          apiClient.getPlayerGames(pId, { page: 1, pageSize: 30, allGames: true }).catch(() => ({ items: [] }))
        )
      ).then((resList) => {
        if (!isCurrent) return;
        const combined = resList.flatMap((r) => r?.items || []);
        setPlayerGames(combined);
      });
      return () => {
        isCurrent = false;
      };
    }

    if (!selectedPlayerId || selectedPlayerId === GENERAL_CHAT_ID || selectedPlayerId === MULTI_MATCHUP_ID) {
      setPlayerGames([]);
      setSelectedGameId("");
      return;
    }

    // Reset board to initial start position
    setBaseFen(START_FEN);
    setCurrentFen(START_FEN);
    setActiveMoves([]);
    setCurrentPly(0);
    setSelectedGameId("");

    // Check if workspaceStore or cache already has the games for this player
    const cachedGames = workspaceStore.cachedProfiles[selectedPlayerId]?.games;
    if (cachedGames && cachedGames.length > 0) {
      setPlayerGames(cachedGames);
      return;
    }

    if (
      workspaceStore.activeMode === "single" &&
      workspaceStore.activePlayerId === selectedPlayerId &&
      workspaceStore.activePlayerGames.length > 0
    ) {
      setPlayerGames(workspaceStore.activePlayerGames);
      return;
    }

    // Immediately clear previous player games to avoid showing old games during fetch
    setPlayerGames([]);

    let isCurrent = true;
    apiClient
      .getPlayerGames(selectedPlayerId, { page: 1, pageSize: 100, allGames: true })
      .then((res) => {
        if (!isCurrent) return;
        const items = res?.items || [];
        setPlayerGames(items);
      })
      .catch((err) => {
        if (!isCurrent) return;
        console.warn("Failed to fetch player games:", err);
        setPlayerGames([]);
      });

    return () => {
      isCurrent = false;
    };
  }, [
    selectedPlayerId,
    workspaceStore.activeMode,
    workspaceStore.activePlayerId,
    workspaceStore.cachedProfiles,
    workspaceStore.activePlayerGames,
    selectedMultiPlayerIds,
  ]);

  // 5b. Keep playerGames in sync whenever workspaceStore loads games in background
  useEffect(() => {
    if (
      workspaceStore.activeMode === "single" &&
      workspaceStore.activePlayerId &&
      workspaceStore.activePlayerId === selectedPlayerId &&
      workspaceStore.activePlayerGames.length > 0 &&
      playerGames.length === 0
    ) {
      setPlayerGames(workspaceStore.activePlayerGames);
    }
  }, [workspaceStore.activeMode, workspaceStore.activePlayerId, workspaceStore.activePlayerGames, selectedPlayerId, playerGames.length]);

  // Get active session with guaranteed fallback
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || createDefaultSession(selectedPlayerId || GENERAL_CHAT_ID, currentPlayerName);

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
      if (newTitle === "Đoạn chat mới" || newTitle === "Trò chuyện tự do cùng AI") {
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
    const isSingleMode = workspaceStore.activeMode === "single";
    const isMultiMode = workspaceStore.activeMode === "multi";
    const defaultPid = isSingleMode
      ? (workspaceStore.activePlayerId || selectedPlayerId)
      : isMultiMode
      ? (selectedPlayerId === GENERAL_CHAT_ID ? MULTI_MATCHUP_ID : (selectedPlayerId || MULTI_MATCHUP_ID))
      : (selectedPlayerId || GENERAL_CHAT_ID);
    const pId = playerIdOverride || defaultPid;
    const isGeneral = pId === GENERAL_CHAT_ID;
    const isMulti = pId === MULTI_MATCHUP_ID;
    const pObj = players.find((p) => p.id === pId);
    const pName = isGeneral
      ? GENERAL_PLAYER_NAME
      : isMulti
      ? "Phân tích Đối đầu Đa hồ sơ"
      : (pObj?.canonical_name || currentPlayerName);

    // If current active session is already empty (no user messages), keep it!
    const currentActive = sessions.find((s) => s.id === activeSessionId);
    if (
      currentActive &&
      (currentActive.playerId || (isMultiMode ? MULTI_MATCHUP_ID : GENERAL_CHAT_ID)) === pId &&
      !hasUserMessages(currentActive)
    ) {
      setExpandedFolders((prev) => ({ ...prev, [pId]: true }));
      return;
    }

    // If an empty session already exists for this player, switch to it!
    const existingEmpty = sessions.find(
      (s) =>
        (s.playerId || (isMultiMode ? MULTI_MATCHUP_ID : GENERAL_CHAT_ID)) === pId &&
        !hasUserMessages(s)
    );
    if (existingEmpty) {
      setActiveSessionId(existingEmpty.id);
      setExpandedFolders((prev) => ({ ...prev, [pId]: true }));
      return;
    }

    const newSession = createDefaultSession(pId, pName);
    setSessions((prev) => [newSession, ...cleanDuplicateEmptySessions(prev)]);
    setActiveSessionId(newSession.id);
    setExpandedFolders((prev) => ({ ...prev, [pId]: true }));
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
          const nextSession = filtered.find((s) => (s.playerId || GENERAL_CHAT_ID) === selectedPlayerId) || filtered[0];
          setActiveSessionId(nextSession.id);
          setSelectedPlayerId(nextSession.playerId || GENERAL_CHAT_ID);
        } else {
          const fresh = createDefaultSession(selectedPlayerId, currentPlayerName);
          setActiveSessionId(fresh.id);
          return [fresh];
        }
      }
      return filtered;
    });
  };

  // Handler: Save inline rename of a chat session
  const handleSaveRename = (sessionId: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: trimmed, updatedAt: Date.now() } : s))
      );
    }
    setEditingSessionId(null);
    setEditingTitle("");
  };

  // Handler: Select a game onto the interactive board
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

    // Auto set board orientation based on player's color
    const pName = selectedPlayer?.canonical_name?.toLowerCase() || "";
    if (g.black_player && g.black_player.toLowerCase().includes(pName)) {
      setBoardOrientation("black");
    } else {
      setBoardOrientation("white");
    }
  };

  // Handler: Apply FEN onto board
  const handleApplyFen = useCallback((fen: string) => {
    setIsBoardOpen(true);
    const cleanFen = normalizeFen(fen);
    try {
      const chess = new Chess(cleanFen);
      const validatedFen = chess.fen();
      setBaseFen(validatedFen);
      setCurrentFen(validatedFen);
    } catch {
      // Non-playable position (e.g. bare pawn structure skeleton without kings)
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

  // Check if current position is a bare pawn skeleton
  const isSkeleton = useMemo(() => isPawnSkeletonFen(currentFen), [currentFen]);

  // Currently selected game object
  const selectedGame = useMemo(
    () => playerGames.find((g) => g.id === selectedGameId) || null,
    [playerGames, selectedGameId]
  );

  // Handler: Ask AI to analyze the entire selected game
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

  // Handler: Ask AI about the current board position
  const handleAskAboutBoard = () => {
    if (isSkeleton) {
      setPendingPrompt(`Hãy phân tích chi tiết hình thái cấu trúc Tốt (Pawn Skeleton) này: điểm mạnh, điểm yếu, các ô tiền đồn quan trọng và kế hoạch chiến lược then chốt cho cả hai bên! FEN: \`${currentFen}\``);
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

  // Filter sessions by search query
  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.playerName.toLowerCase().includes(q) ||
        s.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [sessions, searchQuery]);

  // Group conversations by player ID
  const groupedSessions = useMemo(() => {
    const map: Record<string, ChatSession[]> = {};
    for (const s of filteredSessions) {
      if (!map[s.playerId]) {
        map[s.playerId] = [];
      }
      map[s.playerId].push(s);
    }
    return map;
  }, [filteredSessions]);

  const toggleFolder = (pId: string) => {
    setExpandedFolders((prev) => ({ ...prev, [pId]: !prev[pId] }));
  };

  const renderSessionItem = (session: ChatSession) => {
    const isActive = session.id === activeSessionId;
    const isEditing = editingSessionId === session.id;

    return (
      <div
        key={session.id}
        onClick={() => {
          if (isEditing) return;
          setActiveSessionId(session.id);
          if (session.playerId && session.playerId !== selectedPlayerId) {
            setSelectedPlayerId(session.playerId);
            if (
              workspaceStore.activeMode === "single" &&
              session.playerId !== GENERAL_CHAT_ID &&
              session.playerId !== MULTI_MATCHUP_ID
            ) {
              workspaceStore.selectSingleProfile(session.playerId, "ai");
            }
          }
        }}
        className={`group relative flex flex-col px-2.5 py-2 rounded-xl text-xs cursor-pointer transition select-none ${
          isActive
            ? "bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 font-bold border-l-3 border-l-emerald-600 border border-emerald-500/30 shadow-2xs"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground font-medium border border-transparent"
        }`}
      >
        {isEditing ? (
          <div
            className="flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
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
                <MessageSquare
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isActive ? "text-emerald-600" : "text-muted-foreground/70"
                  }`}
                />
                <span className="truncate">{session.title}</span>
              </div>

              {/* Action buttons on hover */}
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
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

            {/* Subtitle row: Time & Message count */}
            <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground/70 font-mono">
              <span>{formatRelativeTime(session.updatedAt)}</span>
              <span>{session.messages.length} tin</span>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-[calc(100dvh-8rem)] md:h-[calc(100dvh-5.5rem)] -mt-2 sm:-mt-4 mb-0 flex flex-col overflow-hidden select-none">
      {/* Sleek Top Compact Toolbar */}
      <div className="shrink-0 h-12 px-3 bg-card/85 backdrop-blur-md border border-border/70 rounded-xl flex items-center justify-between gap-2.5 shadow-2xs mb-2">
        {/* Left: Sidebar toggle & Player Selector */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            title={isSidebarOpen ? "Ẩn danh sách lịch sử" : "Hiện danh sách lịch sử"}
            className="p-1.5 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer shrink-0"
          >
            {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>

          {/* Active Profile Info Badge / Switcher */}
          {workspaceStore.activeMode === "multi" ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 bg-emerald-500/10 dark:bg-emerald-950/60 border border-emerald-500/30 rounded-lg px-2 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 shrink-0">
                <Swords className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Phân tích đa hồ sơ:</span>
                <span className="sm:hidden">Đa hồ sơ:</span>
              </div>

              {workspaceStore.multiProfiles.map((m) => {
                const isSelected = selectedMultiPlayerIds.includes(m.player.id);
                const roleBadge = m.role === "white" ? "⚪ Trắng" : m.role === "black" ? "⚫ Đen" : "⚪⚫ Hai bên";
                return (
                  <button
                    key={m.player.id}
                    type="button"
                    onClick={() => {
                      setSelectedMultiPlayerIds((prev) => {
                        if (prev.includes(m.player.id)) {
                          if (prev.length <= 1) return prev;
                          return prev.filter((id) => id !== m.player.id);
                        } else {
                          return [...prev, m.player.id];
                        }
                      });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                        : "bg-secondary/70 text-muted-foreground border-border/70 hover:bg-secondary hover:text-foreground"
                    }`}
                    title={isSelected ? "Bấm để bỏ chọn hồ sơ này trong phân tích" : "Bấm để chọn thêm hồ sơ này vào phân tích"}
                  >
                    <span>{m.player.canonical_name}</span>
                    <span className="text-[10px] opacity-80 font-normal">({roleBadge})</span>
                    {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                  </button>
                );
              })}

              {players.filter((p) => !workspaceStore.multiProfiles.some((m) => m.player.id === p.id)).length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const p = players.find((pl) => pl.id === e.target.value);
                    if (p) {
                      workspaceStore.setMultiProfileRole(p, "both");
                      setSelectedMultiPlayerIds((prev) => [...prev, p.id]);
                    }
                  }}
                  className="bg-secondary/60 hover:bg-secondary text-xs text-muted-foreground hover:text-foreground border border-border/70 rounded-lg px-2 py-1 font-medium cursor-pointer"
                  title="Thêm hồ sơ khác vào cuộc trò chuyện"
                >
                  <option value="">+ Thêm hồ sơ...</option>
                  {players
                    .filter((p) => !workspaceStore.multiProfiles.some((m) => m.player.id === p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.canonical_name}
                      </option>
                    ))}
                </select>
              )}
            </div>
          ) : workspaceStore.activeMode === "sandbox" ? (
            <div className="flex items-center gap-1.5 bg-secondary/80 border border-border/70 rounded-lg px-2.5 sm:px-3 py-1 shadow-2xs">
              <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <select
                value={selectedPlayerId || GENERAL_CHAT_ID}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer max-w-[140px] sm:max-w-[200px]"
                title="Bấm thả chọn đổi hồ sơ kỳ thủ phân tích cùng Trợ lí AI"
              >
                <option value={GENERAL_CHAT_ID}>Trợ lí AI Tự do</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    Hồ sơ: {p.canonical_name} ({p.total_games || 0} ván)
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-300/70 dark:border-emerald-700/60 rounded-lg px-2.5 sm:px-3 py-1.5 shadow-2xs">
              <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 truncate max-w-[150px] sm:max-w-[240px]">
                {selectedPlayerId && selectedPlayerId !== GENERAL_CHAT_ID && selectedPlayer
                  ? `Hồ sơ: ${selectedPlayer.canonical_name}`
                  : "Trợ lí AI Cờ Vua"}
              </span>
              {selectedPlayer?.title && (
                <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  {selectedPlayer.title}
                </span>
              )}
            </div>
          )}

          {/* PGN Games Count Badge or Free Mode Badge */}
          {workspaceStore.activeMode === "multi" ? (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold shrink-0">
              <Swords className="w-3.5 h-3.5 text-emerald-600" />
              <span>Đối đầu Đa hồ sơ ({playerGames.length} ván PGN)</span>
            </div>
          ) : selectedPlayerId && selectedPlayerId !== GENERAL_CHAT_ID ? (
            <div className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold shrink-0">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span>{playerGames.length} ván PGN</span>
            </div>
          ) : (
            <div className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold shrink-0">
              <Bot className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cố vấn tự do</span>
            </div>
          )}
        </div>

        {/* Right: Board Toggle & Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Interactive Board Toggle Button */}
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

          {/* Quick flip & reset */}
          {isBoardOpen && (
            <>
              <button
                type="button"
                onClick={() => setBoardOrientation((prev) => (prev === "white" ? "black" : "white"))}
                title="Xoay bàn cờ (Đổi bên Trắng / Đen)"
                className="hidden md:flex px-2.5 py-1.5 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold items-center gap-1 transition cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Xoay</span>
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
                title="Xếp lại thế cờ ban đầu"
                className="hidden md:flex px-2.5 py-1.5 rounded-lg border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold items-center gap-1 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ban đầu</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Workspace: Sidebar + (Board) + Chat */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-2 sm:gap-2.5 overflow-hidden relative">
        {/* Left: Chat History Sidebar (Grouped by Player Profile Folders) */}
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
                      Hội thoại AI
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

            {/* Sidebar Body: Profile Folders & Conversations List */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
              {/* Folder 1: General Free Chat (CHỈ HIỂN THỊ ở chế độ bàn cờ tự do / sandbox) */}
              {workspaceStore.activeMode === "sandbox" && (() => {
                const generalSessions = groupedSessions[GENERAL_CHAT_ID] || [];
                const isExpanded = expandedFolders[GENERAL_CHAT_ID] ?? (selectedPlayerId === GENERAL_CHAT_ID);

                if (searchQuery && generalSessions.length === 0) return null;

                return (
                  <div key={GENERAL_CHAT_ID} className="space-y-1">
                    {/* General Folder Header */}
                    <div
                      onClick={() => toggleFolder(GENERAL_CHAT_ID)}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition select-none border ${
                        selectedPlayerId === GENERAL_CHAT_ID
                          ? "bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 border-emerald-500/30 shadow-2xs"
                          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                          <Bot className="w-3 h-3" />
                        </div>
                        <span className="truncate">{GENERAL_PLAYER_NAME}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateNewChat(GENERAL_CHAT_ID);
                          }}
                          title="Tạo đoạn trò chuyện tự do mới"
                          className="p-1 rounded-md hover:bg-background text-muted-foreground hover:text-emerald-600 transition"
                        >
                          <Plus className="w-3 h-3" />
                        </button>

                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary font-mono text-muted-foreground font-semibold">
                          {generalSessions.length}
                        </span>

                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition" />
                        )}
                      </div>
                    </div>

                    {/* Conversation Items under general folder */}
                    {isExpanded && (
                      <div className="pl-2 space-y-1 ml-2 border-l border-emerald-500/30">
                        {generalSessions.length === 0 ? (
                          <div className="py-2 px-2 text-[11px] text-muted-foreground/60 italic flex items-center justify-between">
                            <span>Chưa có hội thoại</span>
                            <button
                              type="button"
                              onClick={() => handleCreateNewChat(GENERAL_CHAT_ID)}
                              className="text-emerald-600 hover:underline font-bold text-[10px]"
                            >
                              + Bắt đầu chat
                            </button>
                          </div>
                        ) : (
                          generalSessions.map(renderSessionItem)
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Folder 2: Multi-Profile Matchup Folder (CHUYÊN BIỆT cho chế độ Đa hồ sơ) */}
              {workspaceStore.activeMode === "multi" && (() => {
                const multiSessions = groupedSessions[MULTI_MATCHUP_ID] || [];
                const isExpanded = expandedFolders[MULTI_MATCHUP_ID] ?? (selectedPlayerId === MULTI_MATCHUP_ID);

                if (searchQuery && multiSessions.length === 0) return null;

                return (
                  <div key={MULTI_MATCHUP_ID} className="space-y-1">
                    {/* Multi Matchup Folder Header */}
                    <div
                      onClick={() => toggleFolder(MULTI_MATCHUP_ID)}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition select-none border ${
                        selectedPlayerId === MULTI_MATCHUP_ID
                          ? "bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 border-emerald-500/30 shadow-2xs"
                          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                          <Swords className="w-3.5 h-3.5" />
                        </div>
                        <span className="truncate">Phân tích Đối đầu</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateNewChat(MULTI_MATCHUP_ID);
                          }}
                          title="Tạo đoạn trò chuyện đối đầu mới"
                          className="p-1 rounded-md hover:bg-background text-muted-foreground hover:text-emerald-600 transition"
                        >
                          <Plus className="w-3 h-3" />
                        </button>

                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary font-mono text-muted-foreground font-semibold">
                          {multiSessions.length}
                        </span>

                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition" />
                        )}
                      </div>
                    </div>

                    {/* Conversation Items under multi matchup folder */}
                    {isExpanded && (
                      <div className="pl-2 space-y-1 ml-2 border-l border-emerald-500/30">
                        {multiSessions.length === 0 ? (
                          <div className="py-2 px-2 text-[11px] text-muted-foreground/60 italic flex items-center justify-between">
                            <span>Chưa có hội thoại</span>
                            <button
                              type="button"
                              onClick={() => handleCreateNewChat(MULTI_MATCHUP_ID)}
                              className="text-emerald-600 hover:underline font-bold text-[10px]"
                            >
                              + Bắt đầu phân tích
                            </button>
                          </div>
                        ) : (
                          multiSessions.map(renderSessionItem)
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Folder 3: Player Profile Folders: In Sandbox Mode render all players; in Multi Mode render participating players; in Single Mode render only selectedPlayer */}
              {(workspaceStore.activeMode === "sandbox"
                ? players
                : workspaceStore.activeMode === "multi"
                ? workspaceStore.multiProfiles.map((mp) => mp.player).filter(Boolean)
                : selectedPlayer && selectedPlayerId !== GENERAL_CHAT_ID && selectedPlayerId !== MULTI_MATCHUP_ID
                ? [selectedPlayer]
                : []
              ).map((player) => {
                const playerSessions = groupedSessions[player.id] || [];
                const isExpanded = expandedFolders[player.id] ?? (player.id === selectedPlayerId);

                if (workspaceStore.activeMode === "sandbox" && player.id !== selectedPlayerId && playerSessions.length === 0 && !searchQuery) {
                  return null;
                }
                if (searchQuery && playerSessions.length === 0) return null;

                return (
                  <div key={player.id} className="space-y-1">
                    {/* Folder Header */}
                    <div
                      onClick={() => toggleFolder(player.id)}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition select-none border ${
                        selectedPlayerId === player.id
                          ? "bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 border-emerald-500/30 shadow-2xs"
                          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0 text-[10px] font-black uppercase">
                          {player.canonical_name ? player.canonical_name.charAt(0) : "K"}
                        </div>
                        <span className="truncate">{player.canonical_name}</span>
                        {player.title && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-extrabold border border-amber-500/20 shrink-0">
                            {player.title}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateNewChat(player.id);
                          }}
                          title={`Tạo đoạn chat mới cho ${player.canonical_name}`}
                          className="p-1 rounded-md hover:bg-background text-muted-foreground hover:text-emerald-600 transition"
                        >
                          <Plus className="w-3 h-3" />
                        </button>

                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary font-mono text-muted-foreground font-semibold">
                          {playerSessions.length}
                        </span>

                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground transition" />
                        )}
                      </div>
                    </div>

                    {/* Conversation Items under this folder */}
                    {isExpanded && (
                      <div className="pl-2 space-y-1 ml-2 border-l border-border/50">
                        {playerSessions.length === 0 ? (
                          <div className="py-2 px-2 text-[11px] text-muted-foreground/60 italic flex items-center justify-between">
                            <span>Chưa có hội thoại</span>
                            <button
                              type="button"
                              onClick={() => handleCreateNewChat(player.id)}
                              className="text-emerald-600 hover:underline font-bold text-[10px]"
                            >
                              + Bắt đầu chat
                            </button>
                          </div>
                        ) : (
                          playerSessions.map(renderSessionItem)
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Guest hint card if no players exist */}
              {players.length === 0 && !searchQuery && (
                <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-xs text-muted-foreground space-y-1.5 mt-3">
                  <p className="font-semibold text-foreground text-[11px]">Chế độ Khách</p>
                  <p className="text-[11px] leading-relaxed">
                    Bạn có thể trò chuyện tự do với AI hoặc nạp ván đấu PGN để phân tích hồ sơ kỳ thủ cá nhân.
                  </p>
                  <Link
                    href="/import"
                    className="inline-block text-[11px] font-bold text-emerald-600 hover:underline pt-0.5"
                  >
                    Nạp ván đấu ngay →
                  </Link>
                </div>
              )}

              {/* Empty search state */}
              {searchQuery && Object.keys(groupedSessions).length === 0 && (
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
            {/* Board Top Status Bar - Fixed height h-9 to eliminate layout shift */}
            <div className="w-full h-9 flex items-center justify-between pb-1.5 mb-1.5 border-b border-border/60 gap-2 shrink-0">
              <div className="flex items-center gap-2 truncate">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  Bàn cờ
                </span>

                {/* Stockfish Evaluation Tag or Pawn Skeleton Badge */}
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

            {/* ChessBoard Component (Dynamically fits container height and width without clipping) */}
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

            {/* Move Navigation Control Bar (Keypad / Buttons for iPad & Touch) */}
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
                  title={currentPly === 0 ? "Ban đầu" : `Nước ${Math.ceil(currentPly / 2)}/${Math.ceil(activeMoves.length / 2)} (${currentPly % 2 === 1 ? "Trắng" : "Đen"} đi)`}
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
                  title={`Đổi góc nhìn bàn cờ (Đang xem: ${boardOrientation === "white" ? "Trắng" : "Đen"})`}
                  className="h-8 px-2 sm:px-2.5 rounded-lg flex items-center gap-1 bg-card hover:bg-secondary text-muted-foreground hover:text-foreground text-[11px] font-semibold border border-border/60 transition cursor-pointer active:scale-95"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Lật cờ</span>
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
                  title="Đặt lại về bàn cờ ban đầu"
                  className="h-8 px-2 sm:px-2.5 rounded-lg flex items-center gap-1 bg-card hover:bg-destructive/10 hover:text-destructive text-muted-foreground disabled:opacity-30 disabled:pointer-events-none text-[11px] font-semibold border border-border/60 transition cursor-pointer active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Về đầu</span>
                </button>
              </div>
            </div>

            {/* Bottom Controls: Game Loader & Ask AI about board */}
            <div className="w-full mt-2 pt-2 border-t border-border/60 flex flex-col gap-2 shrink-0">
              {/* Row 1: Game Selector & Copy FEN */}
              <div className="flex items-center gap-1.5 w-full">
                <div className="flex-1 min-w-0">
                  <select
                    value={selectedGameId}
                    onChange={(e) => handleSelectGame(e.target.value)}
                    className="w-full bg-background border border-border/70 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-none cursor-pointer truncate"
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

              {/* Row 2: Action Buttons: Phân tích cả ván & Ask AI */}
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
                activeSession.playerId === GENERAL_CHAT_ID
                  ? "general"
                  : activeSession.playerId === MULTI_MATCHUP_ID
                  ? "multi"
                  : `run-${activeSession.playerId}`
              }
              playerId={
                activeSession.playerId === GENERAL_CHAT_ID || activeSession.playerId === MULTI_MATCHUP_ID
                  ? ""
                  : activeSession.playerId
              }
              playerIds={
                workspaceStore.activeMode === "multi"
                  ? selectedMultiPlayerIds
                  : activeSession.playerId && activeSession.playerId !== GENERAL_CHAT_ID
                  ? [activeSession.playerId]
                  : undefined
              }
              playerName={
                workspaceStore.activeMode === "multi"
                  ? multiDisplayName
                  : activeSession.playerId === GENERAL_CHAT_ID
                  ? GENERAL_PLAYER_NAME
                  : activeSession.playerName
              }
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
              onNewChat={() => handleCreateNewChat(activeSession.playerId)}
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
