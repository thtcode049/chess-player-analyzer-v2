"use client";

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from "react";
import { Player, Game, AnalysisRun, OpeningTreeNode, PawnStructureItem, PawnStructureGame } from "@/lib/api/types";
import { apiClient } from "@/lib/api/client";
import {
  buildMatchupTreeIndex,
  MatchupOpeningTreeIndex,
  querySinglePlayerTreePosition,
} from "@/lib/chess/matchupTreeBuilder";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface WorkspaceWindowSnapshot {
  players: Player[];
  cachedProfiles: Record<string, CachedProfileData>;
  guestSessionId?: string | null;
}

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
  failedProfileIds: Record<string, string>;
  loadProfileData: (playerId: string, forceRefresh?: boolean) => Promise<CachedProfileData | null>;
  refreshProfileData: (playerId: string) => Promise<void>;
  retryLoadProfile: (playerId: string) => Promise<CachedProfileData | null>;
  seedProfileData: (profile: CachedProfileData) => void;

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
  getOpeningTreeBranchSync: (
    fen: string,
    color?: "all" | "white" | "black",
    playerIdOverride?: string
  ) => OpeningTreeNode | null;
  getOpeningTreeBranch: (
    fen: string,
    color?: "all" | "white" | "black",
    playerIdOverride?: string
  ) => Promise<OpeningTreeNode | null>;
  matchupIndex: MatchupOpeningTreeIndex | null;
}

const ProfileWorkspaceContext = createContext<ProfileWorkspaceContextType | null>(null);

export function ProfileWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  // In-memory cache for profiles
  const [cachedProfiles, setCachedProfiles] = useState<Record<string, CachedProfileData>>({});
  const [loadingProfileId, setLoadingProfileId] = useState<string | null>(null);
  const [failedProfileIds, setFailedProfileIds] = useState<Record<string, string>>({});

  // Refs for instant synchronous access, deduplication, and stable callbacks
  const playersRef = useRef<Player[]>(players);
  playersRef.current = players;
  const cachedProfilesRef = useRef<Record<string, CachedProfileData>>(cachedProfiles);
  cachedProfilesRef.current = cachedProfiles;
  const failedProfileIdsRef = useRef<Record<string, string>>(failedProfileIds);
  failedProfileIdsRef.current = failedProfileIds;
  const inFlightProfileLoadsRef = useRef<Map<string, Promise<CachedProfileData | null>>>(new Map());
  const singleTreeCacheRef = useRef<Map<string, OpeningTreeNode>>(new Map());
  const inFlightTreeRef = useRef<Map<string, Promise<OpeningTreeNode | null>>>(new Map());

  const seedProfileData = useCallback((profile: CachedProfileData) => {
    if (!profile?.player?.id) return;
    cachedProfilesRef.current = {
      ...cachedProfilesRef.current,
      [profile.player.id]: profile,
    };
    setCachedProfiles((prev) => ({
      ...prev,
      [profile.player.id]: profile,
    }));
    setFailedProfileIds((prev) => {
      if (!prev[profile.player.id]) return prev;
      const next = { ...prev };
      delete next[profile.player.id];
      return next;
    });
  }, []);

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

  const syncWindowSnapshot = useCallback(
    (nextPlayers?: Player[], nextCached?: Record<string, CachedProfileData>) => {
      if (typeof window === "undefined") return;
      try {
        const guestSessionId = sessionStorage.getItem("chess_guest_session_id");
        (window as any).__CHESSLOOK_WORKSPACE_SNAPSHOT__ = {
          players: nextPlayers ?? playersRef.current,
          cachedProfiles: nextCached ?? cachedProfilesRef.current,
          guestSessionId,
        } satisfies WorkspaceWindowSnapshot;
      } catch {
        // Ignore storage / cross-window errors
      }
    },
    []
  );

  // Synchronously hydrate from window.opener BEFORE first browser paint (0ms new-tab handoff, 0 SSR mismatch)
  useIsomorphicLayoutEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlPlayerId = params.get("playerId");

      let openerSnap: WorkspaceWindowSnapshot | undefined;
      try {
        openerSnap = (window.opener as any)?.__CHESSLOOK_WORKSPACE_SNAPSHOT__;
      } catch {
        // Cross-origin opener, ignore
      }

      if (openerSnap?.guestSessionId) {
        try {
          if (!sessionStorage.getItem("chess_guest_session_id")) {
            sessionStorage.setItem("chess_guest_session_id", openerSnap.guestSessionId);
          }
        } catch {
          // Ignore blocked sessionStorage
        }
      }

      if (openerSnap?.players && openerSnap.players.length > 0) {
        playersRef.current = openerSnap.players;
        setPlayers(openerSnap.players);
        setLoadingPlayers(false);
      }

      if (openerSnap?.cachedProfiles && Object.keys(openerSnap.cachedProfiles).length > 0) {
        const merged = { ...openerSnap.cachedProfiles, ...cachedProfilesRef.current };
        cachedProfilesRef.current = merged;
        setCachedProfiles(merged);
      }

      if (urlPlayerId) {
        setActiveMode("single");
        setActivePlayerId(urlPlayerId);
        setSelectedSubProfileId(urlPlayerId);
        if (window.location.pathname.startsWith("/analyze")) {
          setActiveTabState("board");
        }
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  useEffect(() => {
    syncWindowSnapshot(players, cachedProfiles);
  }, [players, cachedProfiles, syncWindowSnapshot]);

  // 1. Initial Load of Players List
  const refreshPlayersList = useCallback(async () => {
    try {
      if (playersRef.current.length === 0) {
        setLoadingPlayers(true);
      }
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

  // 2. Load Single Profile Data (Cached 1 time, 0ms on revisit, deduplicated across concurrent callers)
  const loadProfileData = useCallback(
    async (playerId: string, forceRefresh = false): Promise<CachedProfileData | null> => {
      if (!playerId) return null;

      // Check in-memory cache first
      if (!forceRefresh && cachedProfilesRef.current[playerId]) {
        return cachedProfilesRef.current[playerId];
      }

      // If previously failed and not forcing refresh, avoid infinite retry loop
      if (!forceRefresh && failedProfileIdsRef.current[playerId]) {
        return null;
      }

      // Deduplicate concurrent requests for the same playerId
      const existingLoad = inFlightProfileLoadsRef.current.get(playerId);
      if (!forceRefresh && existingLoad) {
        return existingLoad;
      }

      setLoadingProfileId(playerId);
      const loadPromise = (async (): Promise<CachedProfileData | null> => {
        try {
          // Fetch player, games, and analysis run concurrently
          const [playerRes, gamesRes, run] = await Promise.all([
            apiClient.getPlayer(playerId).catch(() => null),
            apiClient
              .getPlayerGames(playerId, { allGames: true, pageSize: 10000, refresh: forceRefresh })
              .catch(() => ({ items: [] as Game[] })),
            apiClient.getAnalysisRun(playerId).catch(async () => {
              try {
                return await apiClient.createAnalysisRun({ player_id: playerId });
              } catch {
                return null;
              }
            }),
          ]);

          // Fallback: check if player is in players list if API returned null
          const player = playerRes || playersRef.current.find((p) => p.id === playerId) || null;

          if (!player) {
            setFailedProfileIds((prev) => ({
              ...prev,
              [playerId]: "Không tìm thấy hồ sơ kỳ thủ",
            }));
            return null;
          }

          // Clear failure if successful
          setFailedProfileIds((prev) => {
            if (!prev[playerId]) return prev;
            const next = { ...prev };
            delete next[playerId];
            return next;
          });

          const data: CachedProfileData = {
            player,
            games: gamesRes?.items || [],
            run,
            loadedAt: Date.now(),
          };

          cachedProfilesRef.current = {
            ...cachedProfilesRef.current,
            [playerId]: data,
          };
          setCachedProfiles((prev) => ({
            ...prev,
            [playerId]: data,
          }));

          return data;
        } catch (err: any) {
          console.error("Failed to load profile data:", err);
          setFailedProfileIds((prev) => ({
            ...prev,
            [playerId]: err?.message || "Lỗi khi tải dữ liệu hồ sơ kỳ thủ",
          }));
          return null;
        } finally {
          inFlightProfileLoadsRef.current.delete(playerId);
          setLoadingProfileId((curr) => (curr === playerId ? null : curr));
        }
      })();

      inFlightProfileLoadsRef.current.set(playerId, loadPromise);
      return loadPromise;
    },
    []
  );

  const retryLoadProfile = useCallback(
    async (playerId: string) => {
      setFailedProfileIds((prev) => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
      return await loadProfileData(playerId, true);
    },
    [loadProfileData]
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

  // 8b. Explore Opening Action (open in new tab so current profile view is unaffected)
  const exploreOpening = useCallback((openingName: string, playerId?: string) => {
    syncWindowSnapshot();
    const targetId = playerId || activePlayerId;
    const params = new URLSearchParams();
    if (targetId) params.set("playerId", targetId);
    params.set("opening", openingName);
    window.open(`/analyze?${params.toString()}`, "_blank");
  }, [activePlayerId, syncWindowSnapshot]);

  const clearActiveOpeningForAnalysis = useCallback(() => {
    setActiveOpeningForAnalysis(null);
  }, []);

  // 8c. Explore Pawn Structure Action (open in new tab so current profile view is unaffected)
  const exploreStructure = useCallback(
    (
      structure: PawnStructureItem | string,
      playerId?: string,
      gameIdx?: number,
      _game?: Game | PawnStructureGame
    ) => {
      syncWindowSnapshot();
      const structureName = typeof structure === "string" ? structure : structure.name;
      const targetId = playerId || activePlayerId;
      const params = new URLSearchParams();
      if (targetId) params.set("playerId", targetId);
      params.set("structure", structureName);
      if (gameIdx !== undefined) params.set("gameIdx", String(gameIdx));
      window.open(`/analyze?${params.toString()}`, "_blank");
    },
    [activePlayerId, syncWindowSnapshot]
  );

  const clearActiveStructureForAnalysis = useCallback(() => {
    setActiveStructureForAnalysis(null);
  }, []);

  // 9. Opening Tree Branch Provider (Instant 0ms in-memory query + cached API fallback)
  const getOpeningTreeBranchSync = useCallback(
    (
      fen: string,
      color: "all" | "white" | "black" = "all",
      playerIdOverride?: string
    ): OpeningTreeNode | null => {
      if (activeMode === "multi") {
        return matchupIndex ? matchupIndex.queryPosition(fen) : null;
      }

      const targetPid = playerIdOverride || (activeMode === "single" ? activePlayerId : null);
      if (!targetPid) return null;

      const cached = cachedProfilesRef.current[targetPid];
      const normFen = MatchupOpeningTreeIndex.normalizeFen(fen);
      const cacheKey = `${targetPid}::${cached?.games?.length || 0}::${cached?.run?.id || ""}::${color}::${normFen}`;

      const hit = singleTreeCacheRef.current.get(cacheKey);
      if (hit) return hit;

      const rootEpd = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";
      if (normFen === rootEpd && color === "all" && cached?.run?.opening_tree_snapshot?.continuations?.length) {
        const snap = cached.run.opening_tree_snapshot;
        const rootNode: OpeningTreeNode = {
          fen,
          games_count: snap.total_games || snap.games_count || 0,
          in_pgn: snap.in_pgn ?? true,
          total_games: snap.total_games || 0,
          score_pct: snap.score_pct || 0,
          wins: snap.wins || 0,
          draws: snap.draws || 0,
          losses: snap.losses || 0,
          continuations: snap.continuations,
        };
        singleTreeCacheRef.current.set(cacheKey, rootNode);
        return rootNode;
      }

      if (cached && cached.games.length > 0) {
        const parts = fen.trim().split(/\s+/);
        const turn = parts[1] || "w";
        const fullmove = Math.max(1, parseInt(parts[5] || "1", 10) || 1);
        const targetPly = Math.max(0, (fullmove - 1) * 2 + (turn === "b" ? 1 : 0));

        if (targetPly === 0 || cached.games.length <= 500 || (targetPly <= 14 && cached.games.length <= 1200)) {
          const localNode = querySinglePlayerTreePosition(
            cached.games,
            cached.player.canonical_name,
            fen,
            color
          );
          singleTreeCacheRef.current.set(cacheKey, localNode);
          return localNode;
        }
      }

      return null;
    },
    [activeMode, matchupIndex, activePlayerId]
  );

  const getOpeningTreeBranch = useCallback(
    async (
      fen: string,
      color: "all" | "white" | "black" = "all",
      playerIdOverride?: string
    ): Promise<OpeningTreeNode | null> => {
      const syncNode = getOpeningTreeBranchSync(fen, color, playerIdOverride);
      if (syncNode) return syncNode;

      if (activeMode === "multi") return null;

      const targetPid = playerIdOverride || (activeMode === "single" ? activePlayerId : null);
      if (!targetPid) return null;

      const cached = cachedProfilesRef.current[targetPid];
      const runId = cached?.run?.id || targetPid;
      const normFen = MatchupOpeningTreeIndex.normalizeFen(fen);
      const cacheKey = `${targetPid}::${cached?.games?.length || 0}::${cached?.run?.id || ""}::${color}::${normFen}`;
      const inflightKey = `${targetPid}::${color}::${normFen}`;

      const existingReq = inFlightTreeRef.current.get(inflightKey);
      if (existingReq) return existingReq;

      const reqPromise = (async (): Promise<OpeningTreeNode | null> => {
        try {
          const res = await apiClient.getOpeningTreeBranch(runId, fen, color, targetPid);
          if (res) {
            singleTreeCacheRef.current.set(cacheKey, res);
          }
          return res;
        } catch {
          const latestCached = cachedProfilesRef.current[targetPid];
          if (latestCached && latestCached.games.length > 0) {
            const fallbackNode = querySinglePlayerTreePosition(
              latestCached.games,
              latestCached.player.canonical_name,
              fen,
              color
            );
            singleTreeCacheRef.current.set(cacheKey, fallbackNode);
            return fallbackNode;
          }
          return null;
        } finally {
          inFlightTreeRef.current.delete(inflightKey);
        }
      })();

      inFlightTreeRef.current.set(inflightKey, reqPromise);
      return reqPromise;
    },
    [activeMode, activePlayerId, getOpeningTreeBranchSync]
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

  const contextValue = useMemo<ProfileWorkspaceContextType>(
    () => ({
      players,
      loadingPlayers,
      refreshPlayersList,

      cachedProfiles,
      loadingProfileId,
      failedProfileIds,
      loadProfileData,
      refreshProfileData,
      retryLoadProfile,
      seedProfileData,

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

      getOpeningTreeBranchSync,
      getOpeningTreeBranch,
      matchupIndex,
    }),
    [
      players,
      loadingPlayers,
      refreshPlayersList,
      cachedProfiles,
      loadingProfileId,
      failedProfileIds,
      loadProfileData,
      refreshProfileData,
      retryLoadProfile,
      seedProfileData,
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
      getOpeningTreeBranchSync,
      getOpeningTreeBranch,
      matchupIndex,
    ]
  );

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
