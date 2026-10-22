"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { Player, Game, AnalysisRun, OpeningTreeNode, PawnStructureItem, PawnStructureGame } from "@/lib/api/types";
import { apiClient } from "@/lib/api/client";
import { buildMatchupTreeIndex, MatchupOpeningTreeIndex } from "@/lib/chess/matchupTreeBuilder";

export type ProfileMode = "single" | "multi" | "sandbox";
export type ColorRole = "white" | "black" | "both";
export type WorkspaceTab = "profile" | "board" | "ai";

export interface MultiProfileAssignment {
  player: Player;
  role: ColorRole;
}

export interface CachedProfileData {
  player: Player;
  games: Game[];
  run: AnalysisRun | null;
  loadedAt: number;
}

export interface ActiveOpeningForAnalysis {
  openingName: string;
  playerId?: string;
}

export interface ActiveStructureForAnalysis {
  structureName: string;
  structObj?: PawnStructureItem;
  gameIdx?: number;
  game?: Game | PawnStructureGame;
  playerId?: string;
}

interface ProfileWorkspaceContextType {
  // Players Library
  players: Player[];
  loadingPlayers: boolean;
  refreshPlayersList: () => Promise<void>;

  // Profile Cache & Single-load
  cachedProfiles: Record<string, CachedProfileData>;
  loadingProfileId: string | null;
  loadProfileData: (playerId: string, forceRefresh?: boolean) => Promise<CachedProfileData | null>;
  refreshProfileData: (playerId: string) => Promise<void>;

  // Active Mode & Selections
  activeMode: ProfileMode;
  activePlayerId: string | null;
  activePlayer: Player | null;
  activePlayerGames: Game[];
  activePlayerRun: AnalysisRun | null;

  // Multi-Profile Matchup Mode
  multiProfiles: MultiProfileAssignment[];
  setMultiProfileRole: (player: Player, role: ColorRole | null) => void;
  clearMultiProfiles: () => void;
  openMatchupBoard: () => Promise<void>;
  isMatchupLoading: boolean;
  selectedSubProfileId: string | null;
  setSelectedSubProfileId: (id: string | null) => void;

  // Single Profile Switcher
  selectSingleProfile: (playerId: string, targetTab?: WorkspaceTab) => Promise<void>;
  openSandboxBoard: () => void;

  // View Navigation
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
  isHubOpen: boolean;
  openHub: () => void;
  closeHub: () => void;

  // Game to Board Direct Action
  activeGameForAnalysis: Game | null;
  analyzeGame: (game: Game) => void;
  clearActiveGameForAnalysis: () => void;

  // Opening Explorer Direct Action
  activeOpeningForAnalysis: ActiveOpeningForAnalysis | null;
  exploreOpening: (openingName: string, playerId?: string) => void;
  clearActiveOpeningForAnalysis: () => void;

  // Pawn Structure Explorer Direct Action
  activeStructureForAnalysis: ActiveStructureForAnalysis | null;
  exploreStructure: (
    structure: PawnStructureItem | string,
    playerId?: string,
    gameIdx?: number,
    game?: Game | PawnStructureGame
  ) => void;
  clearActiveStructureForAnalysis: () => void;

  // Opening Tree Provider (Single or Matchup)
  getOpeningTreeBranch: (fen: string, color?: "all" | "white" | "black") => Promise<OpeningTreeNode | null>;
  matchupIndex: MatchupOpeningTreeIndex | null;
}

const ProfileWorkspaceContext = createContext<ProfileWorkspaceContextType | null>(null);

export function ProfileWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  // In-memory cache for profiles
  const [cachedProfiles, setCachedProfiles] = useState<Record<string, CachedProfileData>>({});
  const [loadingProfileId, setLoadingProfileId] = useState<string | null>(null);

  // Active Workspace Mode (Mặc định: Bàn cờ tự do / Master DB)
  const [activeMode, setActiveMode] = useState<ProfileMode>("sandbox");
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [multiProfiles, setMultiProfiles] = useState<MultiProfileAssignment[]>([]);
  const [selectedSubProfileId, setSelectedSubProfileId] = useState<string | null>(null);
  const [isMatchupLoading, setIsMatchupLoading] = useState<boolean>(false);

  // Tabs & Hub Visibility (Mặc định: tab bàn cờ)
  const [activeTab, setActiveTabState] = useState<WorkspaceTab>("board");
  const [isHubOpen, setIsHubOpen] = useState(false);

  // Direct game analysis handoff
  const [activeGameForAnalysis, setActiveGameForAnalysis] = useState<Game | null>(null);
  const [activeOpeningForAnalysis, setActiveOpeningForAnalysis] = useState<ActiveOpeningForAnalysis | null>(null);
  const [activeStructureForAnalysis, setActiveStructureForAnalysis] = useState<ActiveStructureForAnalysis | null>(null);

  // Matchup Opening Tree Index
  const [matchupIndex, setMatchupIndex] = useState<MatchupOpeningTreeIndex | null>(null);

  // 1. Initial Load of Players List
  const refreshPlayersList = useCallback(async () => {
    try {
      setLoadingPlayers(true);
      const list = await apiClient.getPlayers();
      setPlayers(list || []);
      return;
    } catch (err) {
      console.warn("Could not load players list:", err);
    } finally {
      setLoadingPlayers(false);
    }
  }, []);

  useEffect(() => {
    refreshPlayersList();
  }, [refreshPlayersList]);

  // 2. Load Single Profile Data (Cached 1 time, 0ms on revisit)
  const loadProfileData = useCallback(
    async (playerId: string, forceRefresh = false): Promise<CachedProfileData | null> => {
      if (!playerId) return null;

      // Check in-memory cache first
      if (!forceRefresh && cachedProfiles[playerId]) {
        return cachedProfiles[playerId];
      }

      setLoadingProfileId(playerId);
      try {
        // Fetch player, games, and analysis run concurrently
        const [player, gamesRes, run] = await Promise.all([
          apiClient.getPlayer(playerId).catch(() => null),
          apiClient.getPlayerGames(playerId, { allGames: true, pageSize: 10000 }).catch(() => ({ items: [] as Game[] })),
          apiClient.getAnalysisRun(playerId).catch(async () => {
            try {
              return await apiClient.createAnalysisRun({ player_id: playerId });
            } catch {
              return null;
            }
          }),
        ]);

        if (!player) return null;

        const data: CachedProfileData = {
          player,
          games: gamesRes?.items || [],
          run,
          loadedAt: Date.now(),
        };

        setCachedProfiles((prev) => ({
          ...prev,
          [playerId]: data,
        }));

        return data;
      } catch (err) {
        console.error("Failed to load profile data:", err);
        return null;
      } finally {
        setLoadingProfileId(null);
      }
    },
    [cachedProfiles]
  );

  const refreshProfileData = useCallback(
    async (playerId: string) => {
      await loadProfileData(playerId, true);
    },
    [loadProfileData]
  );

  // 3. Select Single Profile
  const selectSingleProfile = useCallback(
    async (playerId: string, targetTab?: WorkspaceTab) => {
      setActiveMode("single");
      setActivePlayerId(playerId);
      setSelectedSubProfileId(playerId);
      setIsHubOpen(false);
      if (targetTab) {
        setActiveTabState(targetTab);
      } else {
        setActiveTabState("profile");
      }

      // Load data in background (or instant if cached)
      await loadProfileData(playerId);
    },
    [loadProfileData]
  );

  // 4. Multi-Profile Role Configuration
  const setMultiProfileRole = useCallback(
    (player: Player, role: ColorRole | null) => {
      setMultiProfiles((prev) => {
        const existingIdx = prev.findIndex((m) => m.player.id === player.id);
        if (!role) {
          // Remove
          if (existingIdx !== -1) {
            const next = [...prev];
            next.splice(existingIdx, 1);
            return next;
          }
          return prev;
        }

        if (existingIdx !== -1) {
          // Update
          const next = [...prev];
          next[existingIdx] = { player, role };
          return next;
        } else {
          // Add
          return [...prev, { player, role }];
        }
      });
    },
    []
  );

  const clearMultiProfiles = useCallback(() => {
    setMultiProfiles([]);
    setMatchupIndex(null);
  }, []);

  // 5. Open Matchup Board
  const openMatchupBoard = useCallback(async () => {
    if (multiProfiles.length === 0) return;

    setIsMatchupLoading(true);
    try {
      // 1. Fetch any un-cached players in parallel for maximum speed
      const unCachedItems = multiProfiles.filter((m) => !cachedProfiles[m.player.id]);
      if (unCachedItems.length > 0) {
        await Promise.all(unCachedItems.map((m) => loadProfileData(m.player.id)));
      }

      // 2. Collect loaded player assignments
      const playerAssignments: Array<{
        player: { id: string; canonical_name: string };
        games: Game[];
        role: "white" | "black" | "both";
      }> = [];

      for (const item of multiProfiles) {
        const pId = item.player.id;
        let cached = cachedProfiles[pId];
        if (!cached) {
          cached = (await loadProfileData(pId)) as CachedProfileData;
        }
        if (cached) {
          playerAssignments.push({
            player: { id: cached.player.id, canonical_name: cached.player.canonical_name },
            games: cached.games,
            role: item.role,
          });
        }
      }

      // 3. Build Matchup Opening Tree Index
      const treeIdx = buildMatchupTreeIndex(playerAssignments);
      setMatchupIndex(treeIdx);

      setActiveMode("multi");
      setActivePlayerId(null);
      if (multiProfiles.length > 0) {
        const firstId = multiProfiles[0].player.id;
        setSelectedSubProfileId(firstId);
        loadProfileData(firstId);
      }
      setIsHubOpen(false);
      setActiveTabState("board");
    } finally {
      setIsMatchupLoading(false);
    }
  }, [multiProfiles, cachedProfiles, loadProfileData]);

  // 6. Open Sandbox Board
  const openSandboxBoard = useCallback(() => {
    setActiveMode("sandbox");
    setActivePlayerId(null);
    setSelectedSubProfileId(null);
    setIsHubOpen(false);
    setActiveTabState("board");
  }, []);

  // 7. Navigation Helpers
  const setActiveTab = useCallback((tab: WorkspaceTab) => {
    setActiveTabState(tab);
    setIsHubOpen(false);
  }, []);

  const openHub = useCallback(() => {
    setIsHubOpen(true);
  }, []);

  const closeHub = useCallback(() => {
    setIsHubOpen(false);
  }, []);

  // 8. Analyze Game Action (0ms jump from games table to board)
  const analyzeGame = useCallback((game: Game) => {
    setActiveGameForAnalysis(game);
    setIsHubOpen(false);
    setActiveTabState("board");
  }, []);

  const clearActiveGameForAnalysis = useCallback(() => {
    setActiveGameForAnalysis(null);
  }, []);

  // 8b. Explore Opening Action (0ms jump from repertoire table to board)
  const exploreOpening = useCallback((openingName: string, playerId?: string) => {
    setActiveOpeningForAnalysis({ openingName, playerId });
    if (playerId && playerId !== activePlayerId) {
      setActivePlayerId(playerId);
      setSelectedSubProfileId(playerId);
    }
    setIsHubOpen(false);
    setActiveTabState("board");
  }, [activePlayerId]);

  const clearActiveOpeningForAnalysis = useCallback(() => {
    setActiveOpeningForAnalysis(null);
  }, []);

  // 8c. Explore Pawn Structure Action (0ms jump from structure grid/modal to board)
  const exploreStructure = useCallback(
    (
      structure: PawnStructureItem | string,
      playerId?: string,
      gameIdx?: number,
      game?: Game | PawnStructureGame
    ) => {
      const structureName = typeof structure === "string" ? structure : structure.name;
      const structObj = typeof structure === "string" ? undefined : structure;
      setActiveStructureForAnalysis({ structureName, structObj, gameIdx, game, playerId });
      if (playerId && playerId !== activePlayerId) {
        setActivePlayerId(playerId);
        setSelectedSubProfileId(playerId);
      }
      setIsHubOpen(false);
      setActiveTabState("board");
    },
    [activePlayerId]
  );

  const clearActiveStructureForAnalysis = useCallback(() => {
    setActiveStructureForAnalysis(null);
  }, []);

  // 9. Opening Tree Branch Provider
  const getOpeningTreeBranch = useCallback(
    async (fen: string, color: "all" | "white" | "black" = "all"): Promise<OpeningTreeNode | null> => {
      if (activeMode === "multi" && matchupIndex) {
        // Multi-Profile Matchup Mode: Query instant client index
        return matchupIndex.queryPosition(fen);
      }

      if (activeMode === "single" && activePlayerId) {
        // Single Player Mode: Query backend or cached snapshot
        const cached = cachedProfiles[activePlayerId];
        const runId = cached?.run?.id || activePlayerId;
        try {
          const res = await apiClient.getOpeningTreeBranch(runId, fen, color, activePlayerId);
          return res;
        } catch {
          // Fallback to local index if available
          if (cached && cached.games.length > 0) {
            const role = color === "all" ? "both" : color;
            const singleIdx = buildMatchupTreeIndex([
              {
                player: { id: cached.player.id, canonical_name: cached.player.canonical_name },
                games: cached.games,
                role: role,
              },
            ]);
            return singleIdx.queryPosition(fen);
          }
          return null;
        }
      }

      return null;
    },
    [activeMode, matchupIndex, activePlayerId, cachedProfiles]
  );

  // Active player resolution
  const activeCached = activePlayerId ? cachedProfiles[activePlayerId] : null;

  // In multi mode, safely determine the sub-profile to display (defaulting to the first group member)
  const effectiveSubProfileId = useMemo(() => {
    if (activeMode !== "multi") return null;
    if (selectedSubProfileId && multiProfiles.some((m) => m.player.id === selectedSubProfileId)) {
      return selectedSubProfileId;
    }
    return multiProfiles[0]?.player.id || null;
  }, [activeMode, selectedSubProfileId, multiProfiles]);

  // Synchronize selectedSubProfileId if it was unset or stale
  useEffect(() => {
    if (activeMode === "multi" && effectiveSubProfileId && selectedSubProfileId !== effectiveSubProfileId) {
      setSelectedSubProfileId(effectiveSubProfileId);
    }
  }, [activeMode, effectiveSubProfileId, selectedSubProfileId]);

  // Auto load data for the effective sub-profile if not yet in cache
  useEffect(() => {
    if (activeMode === "multi" && effectiveSubProfileId && !cachedProfiles[effectiveSubProfileId]) {
      loadProfileData(effectiveSubProfileId);
    }
  }, [activeMode, effectiveSubProfileId, cachedProfiles, loadProfileData]);

  const activePlayer = useMemo(() => {
    if (activeMode === "single" && activePlayerId) {
      return activeCached?.player || players.find((p) => p.id === activePlayerId) || null;
    }
    if (activeMode === "multi" && effectiveSubProfileId) {
      return cachedProfiles[effectiveSubProfileId]?.player || players.find((p) => p.id === effectiveSubProfileId) || null;
    }
    return null;
  }, [activeMode, activePlayerId, activeCached, players, effectiveSubProfileId, cachedProfiles]);

  const activePlayerGames = useMemo(() => {
    if (activeMode === "single" && activePlayerId) {
      return activeCached?.games || [];
    }
    if (activeMode === "multi" && effectiveSubProfileId) {
      return cachedProfiles[effectiveSubProfileId]?.games || [];
    }
    return [];
  }, [activeMode, activePlayerId, activeCached, effectiveSubProfileId, cachedProfiles]);

  const activePlayerRun = useMemo(() => {
    if (activeMode === "single" && activePlayerId) {
      return activeCached?.run || null;
    }
    if (activeMode === "multi" && effectiveSubProfileId) {
      return cachedProfiles[effectiveSubProfileId]?.run || null;
    }
    return null;
  }, [activeMode, activePlayerId, activeCached, effectiveSubProfileId, cachedProfiles]);

  const contextValue: ProfileWorkspaceContextType = {
    players,
    loadingPlayers,
    refreshPlayersList,

    cachedProfiles,
    loadingProfileId,
    loadProfileData,
    refreshProfileData,

    activeMode,
    activePlayerId,
    activePlayer,
    activePlayerGames,
    activePlayerRun,

    multiProfiles,
    setMultiProfileRole,
    clearMultiProfiles,
    openMatchupBoard,
    isMatchupLoading,
    selectedSubProfileId,
    setSelectedSubProfileId,

    selectSingleProfile,
    openSandboxBoard,

    activeTab,
    setActiveTab,
    isHubOpen,
    openHub,
    closeHub,

    activeGameForAnalysis,
    analyzeGame,
    clearActiveGameForAnalysis,

    activeOpeningForAnalysis,
    exploreOpening,
    clearActiveOpeningForAnalysis,

    activeStructureForAnalysis,
    exploreStructure,
    clearActiveStructureForAnalysis,

    getOpeningTreeBranch,
    matchupIndex,
  };

  return (
    <ProfileWorkspaceContext.Provider value={contextValue}>
      {children}
    </ProfileWorkspaceContext.Provider>
  );
}

export function useProfileWorkspaceStore() {
  const ctx = useContext(ProfileWorkspaceContext);
  if (!ctx) {
    throw new Error("useProfileWorkspaceStore must be used within a ProfileWorkspaceProvider");
  }
  return ctx;
}
