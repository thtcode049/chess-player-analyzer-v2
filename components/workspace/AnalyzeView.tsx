"use client";

import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Chess } from "chess.js";
import {
  Play,
  Layers,
  Cpu,
  Upload,
  FileText,
  ArrowLeft,
  Loader2,
  User,
  Search,
  Check,
  BookOpen,
  Compass,
  Lightbulb,
  ShieldAlert,
  Swords,
  RotateCcw,
  RotateCw
} from "lucide-react";
import Link from "next/link";
import ChessBoard, { BOARD_PLAYERS_BAR_HEIGHT, BoardPlayersInfo } from "@/components/chess/ChessBoard";
import MoveHistory from "@/components/chess/MoveHistory";
import PawnStructureInfoBadge from "@/components/chess/PawnStructureInfoBadge";
import OpeningTreeTable from "@/components/analysis/OpeningTreeTable";
import FloatingAiChatWidget from "@/components/ai/FloatingAiChatWidget";
import { apiClient } from "@/lib/api/client";
import {
  Game,
  OpeningContinuation,
  Player,
  PawnStructureItem,
  PawnStructureGame,
  OpeningRepertoireItem
} from "@/lib/api/types";
import { EngineEvaluation } from "@/lib/stockfish/engineWorker";
import { getCanonicalOpeningByName, getCanonicalOpeningByMoves } from "@/lib/chess/canonicalOpenings";
import { useProfileWorkspaceStore } from "@/lib/stores/profileWorkspaceStore";
import {
  MoveTreeState,
  createMoveTreeFromMoves,
  addMoveToTree,
  promoteVariationToMainLine,
  deleteMoveFromHere,
  getActivePath,
  findNodeById,
} from "@/lib/chess/moveTree";
import { getLichessAuth } from "@/lib/auth/lichess";

function parseSanMoves(movesSan?: string | null): string[] {
  if (!movesSan) return [];
  return movesSan
    .split(/\s+/)
    .map((t) => t.replace(/^\d+\.+/, "").trim())
    .filter((t) => t && !["1-0", "0-1", "1/2-1/2", "*"].includes(t));
}

function parseOptionalElo(val: unknown): number | undefined {
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function readTabSessionItem(key: string): string | null {
  try {
    const local = sessionStorage.getItem(key);
    if (local) return local;
    return (window.opener as Window | null)?.sessionStorage?.getItem(key) || null;
  } catch {
    return null;
  }
}

function normalizePlayerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPlayerNameMatch(nameA?: string | null, nameB?: string | null): boolean {
  if (!nameA || !nameB) return false;
  const a = normalizePlayerName(nameA);
  const b = normalizePlayerName(nameB);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const tokensA = a.split(" ").filter((t) => t.length >= 2);
  const tokensB = b.split(" ").filter((t) => t.length >= 2);
  const matches = tokensA.filter((t) => tokensB.includes(t));
  return matches.length >= 2 || (tokensA.length === 1 && matches.length === 1);
}

function normalizeOpeningName(name: string): string {
  return name.toLowerCase().replace(/['"`]/g, "").replace(/\s+/g, " ").trim();
}

function getOpeningBaseName(name: string): string {
  // Cut at ":" or "," or " - ", NOT at hyphen "-" to preserve "Nimzo-Indian", "King's Indian", etc.
  const base = name.split(/[:]|,|\s+-\s+/)[0].trim();
  return normalizeOpeningName(base);
}

function isOpeningMatch(game: Game, opName: string): boolean {
  if (!opName) return false;
  const rawGOp = game.opening_name || game.raw_headers?.Opening || (game as any).opening || "";
  if (!rawGOp) return false;

  const target = normalizeOpeningName(opName);
  const gOp = normalizeOpeningName(rawGOp);

  // 1. Exact match
  if (target === gOp) return true;

  // 2. Base opening family match (e.g. "Nimzo-Indian Defense: Classical" matches "Nimzo-Indian Defense")
  const baseTarget = getOpeningBaseName(opName);
  const baseGOp = getOpeningBaseName(rawGOp);

  if (baseTarget === baseGOp) return true;

  // 3. Family prefix match (e.g. target is "Sicilian Defense" and gOp is "Sicilian Defense: Najdorf")
  // MUST NOT use substring includes! "nimzo-indian" must not match "indian defense"
  if (gOp.startsWith(baseTarget + ":") || gOp.startsWith(baseTarget + ",") || gOp.startsWith(baseTarget + " -")) {
    return true;
  }
  if (target.startsWith(baseGOp + ":") || target.startsWith(baseGOp + ",") || target.startsWith(baseGOp + " -")) {
    return true;
  }

  // 4. London System alias matching
  if (baseTarget.includes("london") && baseGOp.includes("london")) {
    return true;
  }

  return false;
}

function findLongestCommonPrefix(movesList: string[][]): string[] {
  if (movesList.length === 0) return [];
  const first = movesList[0];
  const common: string[] = [];
  for (let i = 0; i < first.length; i++) {
    const move = first[i];
    if (movesList.every((m) => m[i] === move)) {
      common.push(move);
    } else {
      break;
    }
  }
  return common;
}

function findMostFrequentLine(parsedGamesMoves: string[][], maxPlies: number = 12): string[] {
  if (parsedGamesMoves.length === 0) return [];
  let currentGames = parsedGamesMoves;
  const line: string[] = [];

  for (let ply = 0; ply < maxPlies; ply++) {
    const moveCounts: Record<string, number> = {};
    for (const m of currentGames) {
      if (m.length > ply) {
        const mv = m[ply];
        moveCounts[mv] = (moveCounts[mv] || 0) + 1;
      }
    }
    const entries = Object.entries(moveCounts);
    if (entries.length === 0) break;

    entries.sort((a, b) => b[1] - a[1]);
    const [bestMove, count] = entries[0];
    const minRequired = Math.max(2, Math.floor(currentGames.length * 0.25));
    if (currentGames.length > 1 && count < minRequired) break;

    line.push(bestMove);
    currentGames = currentGames.filter((m) => m.length > ply && m[ply] === bestMove);
  }
  return line;
}

function findRepresentativeLineForGames(games: Game[], openingName?: string): string[] {
  if (!games || games.length === 0) {
    if (openingName) {
      const canonical = getCanonicalOpeningByName(openingName);
      if (canonical && canonical.moves.length > 0) return canonical.moves;
    }
    return [];
  }

  const parsedGamesMoves = games.map((g) => parseSanMoves(g.moves_san)).filter((m) => m.length > 0);
  if (parsedGamesMoves.length === 0) {
    if (openingName) {
      const canonical = getCanonicalOpeningByName(openingName);
      if (canonical && canonical.moves.length > 0) return canonical.moves;
    }
    return [];
  }
  if (parsedGamesMoves.length === 1) {
    return parsedGamesMoves[0].slice(0, Math.min(parsedGamesMoves[0].length, 12));
  }

  // Position & Transposition analysis using first 4 tokens of FEN
  const fenInfo: Record<string, { games: Set<number>; paths: Record<string, number> }> = {};
  const startKey = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";

  parsedGamesMoves.forEach((moves, gIdx) => {
    try {
      const chess = new Chess();
      const currentPath: string[] = [];
      const maxPlies = Math.min(moves.length, 24); // Up to first 12 moves (24 plies)

      for (let i = 0; i < maxPlies; i++) {
        const san = moves[i];
        const res = chess.move(san);
        if (!res) break;
        currentPath.push(san);

        const epdKey = chess.fen().split(" ").slice(0, 4).join(" ");
        if (!fenInfo[epdKey]) {
          fenInfo[epdKey] = { games: new Set(), paths: {} };
        }
        fenInfo[epdKey].games.add(gIdx);
        const pathKey = currentPath.join(" ");
        fenInfo[epdKey].paths[pathKey] = (fenInfo[epdKey].paths[pathKey] || 0) + 1;
      }
    } catch {
      // Ignore invalid moves
    }
  });

  const nonRootEntries = Object.entries(fenInfo).filter(([key]) => key !== startKey);
  if (nonRootEntries.length === 0) {
    const frequent = findMostFrequentLine(parsedGamesMoves);
    return frequent.length > 0 ? frequent : findLongestCommonPrefix(parsedGamesMoves);
  }

  const maxGamesCount = Math.max(...nonRootEntries.map(([_, info]) => info.games.size));
  const threshold = Math.max(2, Math.floor(maxGamesCount * 0.7));

  let bestKey: string | null = null;
  let maxDepth = -1;

  for (const [key, info] of nonRootEntries) {
    const gCount = info.games.size;
    if (gCount >= threshold) {
      for (const pathKey of Object.keys(info.paths)) {
        const depth = pathKey.split(" ").length;
        if (depth > maxDepth) {
          maxDepth = depth;
          bestKey = key;
        } else if (depth === maxDepth && bestKey !== null) {
          if (gCount > fenInfo[bestKey].games.size) {
            bestKey = key;
          }
        }
      }
    }
  }

  let line: string[] = [];
  if (bestKey) {
    const bestPaths = fenInfo[bestKey].paths;
    let mostCommonPath = "";
    let highestCount = -1;
    for (const [pathStr, count] of Object.entries(bestPaths)) {
      if (count > highestCount) {
        highestCount = count;
        mostCommonPath = pathStr;
      }
    }
    line = mostCommonPath ? mostCommonPath.split(" ") : [];
  }

  const canonical = openingName ? getCanonicalOpeningByName(openingName) : null;
  const minRequiredLength = canonical ? canonical.moves.length : 2;

  // If candidate is shorter than canonical defining moves or <= 1 ply,
  // try player's most frequent line first, then canonical moves
  if (line.length < minRequiredLength) {
    const frequent = findMostFrequentLine(parsedGamesMoves);
    if (frequent.length > line.length) {
      line = frequent;
    }
  }

  if (canonical && line.length < canonical.moves.length) {
    return canonical.moves;
  }

  if (line.length > 0) {
    return line;
  }

  return findLongestCommonPrefix(parsedGamesMoves);
}

function getGamePlayerOutcome(
  game: Game,
  canonicalName?: string
): { isWin: boolean; isDraw: boolean; isLoss: boolean; playerColor: "white" | "black" } {
  const isWhite = isPlayerNameMatch(canonicalName, game.white_player);
  const isBlack = isPlayerNameMatch(canonicalName, game.black_player);
  const playerColor: "white" | "black" = isBlack && !isWhite ? "black" : "white";

  const res = (game.result || "").trim();
  if (res === "1/2-1/2" || res === "0.5-0.5") {
    return { isWin: false, isDraw: true, isLoss: false, playerColor };
  }
  if (res === "1-0") {
    return {
      isWin: playerColor === "white",
      isDraw: false,
      isLoss: playerColor === "black",
      playerColor,
    };
  }
  if (res === "0-1") {
    return {
      isWin: playerColor === "black",
      isDraw: false,
      isLoss: playerColor === "white",
      playerColor,
    };
  }
  return { isWin: false, isDraw: false, isLoss: false, playerColor };
}

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function AnalyzeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const workspaceStore = useProfileWorkspaceStore();

  const queryGameId = searchParams.get("gameId");
  const queryLichessId = searchParams.get("lichessId");
  const queryInspectGame = searchParams.get("inspectGame");
  const queryPlayerId = searchParams.get("playerId");
  const queryRunId = searchParams.get("runId");
  const queryMove = searchParams.get("move");
  const queryStructure = searchParams.get("structure");
  const queryGameIdx = searchParams.get("gameIdx");
  const queryOpening = searchParams.get("opening");

  // Player & Run state (unified with ProfileWorkspaceProvider — zero duplicate fetches)
  const players = workspaceStore.players;
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(queryPlayerId || workspaceStore.activePlayerId || "");
  const [activeRunId, setActiveRunId] = useState<string>(queryRunId || queryPlayerId || workspaceStore.activePlayerId || "");
  const [colorFilter, setColorFilter] = useState<"all" | "white" | "black">("all");
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");

  const effectivePlayerId =
    selectedPlayerId ||
    queryPlayerId ||
    (workspaceStore.activeMode === "single" ? workspaceStore.activePlayerId || "" : "");

  const cachedProfile = effectivePlayerId ? workspaceStore.cachedProfiles[effectivePlayerId] || null : null;
  const isProfileDataLoading = Boolean(
    (effectivePlayerId && !cachedProfile && !workspaceStore.failedProfileIds[effectivePlayerId]) ||
    (!effectivePlayerId &&
      workspaceStore.activeMode !== "sandbox" &&
      workspaceStore.activeMode !== "multi" &&
      workspaceStore.loadingPlayers)
  );

  // Chess board state
  const [moves, setMoves] = useState<string[]>([]);
  const [currentPly, setCurrentPly] = useState(0);
  const [currentFen, setCurrentFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [moveTree, setMoveTree] = useState<MoveTreeState>(() => createMoveTreeFromMoves([]));
  const [gameInfo, setGameInfo] = useState<Game | null>(null);
  const [evaluation, setEvaluation] = useState<EngineEvaluation | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isEngineEnabled, setIsEngineEnabled] = useState(true);
  const [multiPv, setMultiPv] = useState(3);

  const boardPlayersInfo = useMemo<BoardPlayersInfo | null>(() => {
    if (!gameInfo) return null;
    const wName = (gameInfo.white_player || "").trim();
    const bName = (gameInfo.black_player || "").trim();
    if (!wName && !bName) return null;
    return {
      whiteName: wName || "Trắng",
      whiteElo: parseOptionalElo(gameInfo.white_elo) ?? null,
      blackName: bName || "Đen",
      blackElo: parseOptionalElo(gameInfo.black_elo) ?? null,
      result: gameInfo.result || null,
    };
  }, [gameInfo]);

  // Auto-load game if activeGameForAnalysis was triggered from Profile games list
  useEffect(() => {
    if (workspaceStore.activeGameForAnalysis) {
      const g = workspaceStore.activeGameForAnalysis;
      setGameInfo(g);
      setSelectedStructure(null);
      setSelectedOpening(null);
      setActiveStructureGameIdx(null);
      setActiveOpeningGameId(null);
      if (g.moves_san) {
        const parsedMoves = parseSanMoves(g.moves_san);
        setMoves(parsedMoves);
        setCurrentPly(0);
        setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
        setMoveTree(createMoveTreeFromMoves(parsedMoves));
      }
      const activeName = workspaceStore.activePlayer?.canonical_name;
      if (activeName) {
        const isBlack =
          isPlayerNameMatch(activeName, g.black_player) &&
          !isPlayerNameMatch(activeName, g.white_player);
        setBoardOrientation(isBlack ? "black" : "white");
      }
      workspaceStore.clearActiveGameForAnalysis();
    }
  }, [workspaceStore.activeGameForAnalysis, workspaceStore.activePlayer?.canonical_name, workspaceStore.clearActiveGameForAnalysis]);

  // Synchronize activePlayerId from store or URL
  useIsomorphicLayoutEffect(() => {
    if (workspaceStore.activeMode === "multi") {
      if (selectedPlayerId) {
        setSelectedPlayerId("");
        setActiveRunId("");
      }
      return;
    }
    const targetPid = queryPlayerId || workspaceStore.activePlayerId;
    if (targetPid && targetPid !== selectedPlayerId) {
      setSelectedPlayerId(targetPid);
      setActiveRunId(queryRunId || targetPid);
    }
  }, [workspaceStore.activeMode, workspaceStore.activePlayerId, queryPlayerId, queryRunId, selectedPlayerId]);

  // Dynamically synchronized board and panel size measured directly from ChessBoard DOM container
  const [boardSize, setBoardSize] = useState<number>(760);
  const [isLgScreen, setIsLgScreen] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const handleResize = () => {
      setIsLgScreen(window.innerWidth >= 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Mobile & iPad Sub-Tabs State (Learned from Chess.com & Lichess)
  const [mobileTab, setMobileTab] = useState<"moves" | "tree" | "structures" | "games">("moves");

  // Dynamic Opening Tree Continuations
  const [continuations, setContinuations] = useState<OpeningContinuation[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);

  // Unified games, pawn structures, and openings derived directly from workspaceStore cache
  const playerGames = useMemo<Game[]>(
    () => cachedProfile?.games || workspaceStore.activePlayerGames || [],
    [cachedProfile?.games, workspaceStore.activePlayerGames]
  );

  const activeRunObj = cachedProfile?.run || workspaceStore.activePlayerRun || null;

  const availableStructures = useMemo<PawnStructureItem[]>(() => {
    const raw = activeRunObj?.pawn_structures_summary?.structures || [];
    return raw.filter(
      (s: PawnStructureItem) =>
        !s.name?.toLowerCase().includes("benoni") && !(s.structure_key || "").toLowerCase().includes("benoni")
    );
  }, [activeRunObj]);

  const availableOpenings = useMemo<OpeningRepertoireItem[]>(() => {
    const rep = activeRunObj?.repertoire_summary?.all_openings;
    if (rep && rep.length > 0) return rep;
    if (playerGames.length === 0) return [];
    const opMap: Record<string, number> = {};
    playerGames.forEach((g) => {
      const name = g.opening_name || g.raw_headers?.Opening;
      if (name) opMap[name] = (opMap[name] || 0) + 1;
    });
    return Object.entries(opMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, games_count: count }));
  }, [activeRunObj, playerGames]);

  // Structure Explorer Mode State
  const [selectedStructure, setSelectedStructure] = useState<PawnStructureItem | null>(null);
  const [structureFilter, setStructureFilter] = useState<"all" | "wins" | "draws" | "losses">("all");
  const [structureSearch, setStructureSearch] = useState<string>("");
  const [activeStructureGameIdx, setActiveStructureGameIdx] = useState<number | null>(null);
  const loadedStructureGameKeyRef = useRef<string | null>(null);

  // Opening Explorer Mode State
  const [selectedOpening, setSelectedOpening] = useState<string | null>(queryOpening || null);
  const [openingFilter, setOpeningFilter] = useState<"all" | "wins" | "draws" | "losses">("all");
  const [openingSearch, setOpeningSearch] = useState<string>("");
  const [activeOpeningGameId, setActiveOpeningGameId] = useState<string | null>(null);
  const [openingRepresentativeLine, setOpeningRepresentativeLine] = useState<string[]>([]);
  const loadedOpeningRef = React.useRef<string | null>(null);
  const lastGamesCountRef = React.useRef<number>(0);
  const isAutoTransitionRef = React.useRef<boolean>(false);

  // Custom PGN modal
  const [showPgnInput, setShowPgnInput] = useState(false);
  const [inputPgn, setInputPgn] = useState("");

  // User explicitly dismissed explorer mode flags (prevents Next.js router delay from reviving explorer)
  const [structureDismissed, setStructureDismissed] = useState<boolean>(false);
  const [openingDismissed, setOpeningDismissed] = useState<boolean>(false);

  const isStructureActive = !structureDismissed && Boolean(selectedStructure || queryStructure);
  const isOpeningActive = !openingDismissed && Boolean(selectedOpening || queryOpening);
  const isExplorerMode = Boolean(isStructureActive || isOpeningActive);

  // 1. Ensure active profile data is loaded once via shared workspaceStore (deduplicated)
  useEffect(() => {
    if (effectivePlayerId && !cachedProfile && !workspaceStore.failedProfileIds[effectivePlayerId]) {
      workspaceStore.loadProfileData(effectivePlayerId);
    }
  }, [effectivePlayerId, cachedProfile, workspaceStore.failedProfileIds, workspaceStore.loadProfileData]);

  // Fallback default player selection when not in sandbox/multi mode
  useEffect(() => {
    if (
      !queryPlayerId &&
      !selectedPlayerId &&
      workspaceStore.activeMode !== "multi" &&
      workspaceStore.activeMode !== "sandbox" &&
      players.length > 0
    ) {
      setSelectedPlayerId(players[0].id);
      setActiveRunId(queryRunId || players[0].id);
    }
  }, [players, queryPlayerId, queryRunId, selectedPlayerId, workspaceStore.activeMode]);

  const hydratedQueryKeyRef = useRef<string | null>(null);

  // 2a-sync. Instant 0ms hydration for new-tab game opens (gameId, lichessId, inspectGame)
  useIsomorphicLayoutEffect(() => {
    if (queryGameId && hydratedQueryKeyRef.current !== `gid:${queryGameId}`) {
      const cachedG = playerGames.find((pg) => pg.id === queryGameId);
      if (cachedG) {
        hydratedQueryKeyRef.current = `gid:${queryGameId}`;
        setGameInfo(cachedG);
        if (cachedG.moves_san) {
          const parsedMoves = parseSanMoves(cachedG.moves_san);
          setMoves(parsedMoves);
          setCurrentPly(0);
          setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
          setMoveTree(createMoveTreeFromMoves(parsedMoves));
        }
        const refName =
          players.find((p) => p.id === (queryPlayerId || selectedPlayerId))?.canonical_name ||
          workspaceStore.activePlayer?.canonical_name;
        if (refName) {
          const isBlack =
            isPlayerNameMatch(refName, cachedG.black_player) &&
            !isPlayerNameMatch(refName, cachedG.white_player);
          setBoardOrientation(isBlack ? "black" : "white");
        }
        return;
      }

      const rawInspect = readTabSessionItem("inspect_game");
      if (rawInspect) {
        try {
          const sg = JSON.parse(rawInspect);
          if (sg && sg.id === queryGameId) {
            hydratedQueryKeyRef.current = `gid:${queryGameId}`;
            const gMoves = Array.isArray(sg.moves) && sg.moves.length > 0 ? sg.moves : parseSanMoves(sg.moves_san);
            if (gMoves.length > 0) {
              setMoves(gMoves);
              setCurrentPly(0);
              setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
              setMoveTree(createMoveTreeFromMoves(gMoves));
            }
            setGameInfo({
              id: sg.id,
              dataset_id: "",
              white_player: sg.white || sg.white_player || "Trắng",
              black_player: sg.black || sg.black_player || "Đen",
              white_elo: parseOptionalElo(sg.white_elo),
              black_elo: parseOptionalElo(sg.black_elo),
              result: sg.result || "*",
              played_at: sg.date || "",
              moves_san: sg.moves_san || gMoves.join(" "),
              opening_name: sg.opening || sg.opening_name || "",
              eco: sg.eco || "",
              site_url: sg.link || sg.site || "",
            });
            if (sg.player_color === "black" || sg.player_color === "white") {
              setBoardOrientation(sg.player_color);
            }
          }
        } catch {}
      }
    }

    if (queryLichessId && hydratedQueryKeyRef.current !== `lid:${queryLichessId}`) {
      const rawMeta = readTabSessionItem(`lichess_game_meta_${queryLichessId}`);
      if (rawMeta) {
        try {
          const meta = JSON.parse(rawMeta);
          hydratedQueryKeyRef.current = `lid:${queryLichessId}`;
          setGameInfo({
            id: meta.id || queryLichessId,
            dataset_id: "",
            white_player: meta.white || "Trắng",
            black_player: meta.black || "Đen",
            white_elo: parseOptionalElo(meta.white_elo),
            black_elo: parseOptionalElo(meta.black_elo),
            result: meta.result || "*",
            played_at: meta.date || "",
            moves_san: "",
            site_url: `https://lichess.org/${queryLichessId}`,
          });
        } catch {}
      }
    }

    if (queryInspectGame && hydratedQueryKeyRef.current !== "inspect") {
      const raw = readTabSessionItem("inspect_game");
      if (raw) {
        try {
          const sg = JSON.parse(raw);
          hydratedQueryKeyRef.current = "inspect";
          const gMoves =
            Array.isArray(sg.moves) && sg.moves.length > 0 ? sg.moves : parseSanMoves(sg.moves_san);
          setMoves(gMoves);
          setCurrentPly(0);
          setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
          setMoveTree(createMoveTreeFromMoves(gMoves));
          const wName = sg.white || sg.white_player || "Trắng";
          const bName = sg.black || sg.black_player || "Đen";
          setGameInfo({
            id: sg.id || `inspect-${Date.now()}`,
            dataset_id: "",
            white_player: wName,
            black_player: bName,
            white_elo: parseOptionalElo(sg.white_elo),
            black_elo: parseOptionalElo(sg.black_elo),
            result: sg.result || "*",
            played_at: sg.date || "",
            moves_san: sg.moves_san || gMoves.join(" "),
            opening_name: sg.opening || sg.opening_name || "",
            eco: sg.eco || "",
            site_url: sg.link || sg.site || "",
          });
          if (sg.player_color === "black" || sg.player_color === "white") {
            setBoardOrientation(sg.player_color);
          } else {
            const refName =
              players.find((p) => p.id === (queryPlayerId || selectedPlayerId))?.canonical_name ||
              workspaceStore.activePlayer?.canonical_name;
            if (refName) {
              const isBlack = isPlayerNameMatch(refName, bName) && !isPlayerNameMatch(refName, wName);
              setBoardOrientation(isBlack ? "black" : "white");
            }
          }
        } catch (err) {
          console.warn("Failed to load inspect game from sessionStorage:", err);
        }
      }
    }
  }, [queryGameId, queryLichessId, queryInspectGame, playerGames, players, queryPlayerId, selectedPlayerId, workspaceStore.activePlayer?.canonical_name]);

  // 2. Load single game from gameId if passed
  useEffect(() => {
    if (queryGameId) {
      if (playerGames.some((pg) => pg.id === queryGameId) && moves.length > 0) {
        return;
      }
      apiClient.getGame(queryGameId).then((g) => {
        if (g) {
          setGameInfo(g);
          if (g.moves_san) {
            const parsedMoves = parseSanMoves(g.moves_san);
            setMoves(parsedMoves);
            setCurrentPly(0);
            setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
            setMoveTree(createMoveTreeFromMoves(parsedMoves));
          }

          let targetPlayerObj = players.find((p) => p.id === (queryPlayerId || selectedPlayerId));
          if (!queryPlayerId && players.length > 0) {
            const matchedPlayer = players.find((p) =>
              isPlayerNameMatch(p.canonical_name, g.white_player) ||
              isPlayerNameMatch(p.canonical_name, g.black_player)
            );
            if (matchedPlayer) {
              targetPlayerObj = matchedPlayer;
              setSelectedPlayerId(matchedPlayer.id);
              setActiveRunId(matchedPlayer.id);
            }
          }

          const refName = targetPlayerObj?.canonical_name || workspaceStore.activePlayer?.canonical_name;
          if (refName) {
            const isBlack =
              isPlayerNameMatch(refName, g.black_player) &&
              !isPlayerNameMatch(refName, g.white_player);
            setBoardOrientation(isBlack ? "black" : "white");
          }
        }
      }).catch((err) => console.warn("Failed to load game:", err));
    }
  }, [queryGameId, queryPlayerId, players]);

  // 2b. Load master game from queryLichessId if opened in a new tab
  useEffect(() => {
    if (queryLichessId) {
      const auth = getLichessAuth();
      apiClient
        .getLichessGame(queryLichessId, auth.token)
        .then((fullGame) => {
          if (fullGame && fullGame.moves && fullGame.moves.length > 0) {
            setMoves(fullGame.moves);
            setCurrentPly(0);
            setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
            setMoveTree(createMoveTreeFromMoves(fullGame.moves));
            setGameInfo((prev) => ({
              id: fullGame.id,
              dataset_id: "",
              white_player: fullGame.white || prev?.white_player || "Trắng",
              black_player: fullGame.black || prev?.black_player || "Đen",
              white_elo: parseOptionalElo(fullGame.white_elo) ?? prev?.white_elo,
              black_elo: parseOptionalElo(fullGame.black_elo) ?? prev?.black_elo,
              result: fullGame.result && fullGame.result !== "*" ? fullGame.result : prev?.result || "*",
              played_at: fullGame.date || prev?.played_at || "",
              moves_san: fullGame.moves_san || fullGame.moves.join(" "),
              opening_name: fullGame.opening || fullGame.eco || "",
              eco: fullGame.eco || "",
              site_url: fullGame.site || `https://lichess.org/${queryLichessId}`,
            }));
          }
        })
        .catch((err) => console.warn("Failed to load Lichess master game:", err));
    }
  }, [queryLichessId]);

  // 2b. Synchronize player matching if players list loaded after gameInfo
  useEffect(() => {
    if (workspaceStore.activeMode === "multi" || workspaceStore.activeMode === "sandbox") return;
    if (gameInfo && !queryPlayerId && players.length > 0) {
      const currentObj = players.find((p) => p.id === selectedPlayerId);
      const isCurrentMatching = currentObj && (
        isPlayerNameMatch(currentObj.canonical_name, gameInfo.white_player) ||
        isPlayerNameMatch(currentObj.canonical_name, gameInfo.black_player)
      );
      if (!isCurrentMatching) {
        const matchedPlayer = players.find((p) =>
          isPlayerNameMatch(p.canonical_name, gameInfo.white_player) ||
          isPlayerNameMatch(p.canonical_name, gameInfo.black_player)
        );
        if (matchedPlayer) {
          setSelectedPlayerId(matchedPlayer.id);
          setActiveRunId(matchedPlayer.id);
        }
      }
    }
  }, [players, gameInfo, queryPlayerId, selectedPlayerId]);

  // 2c. Auto-play initial move if queryMove is present
  useEffect(() => {
    if (queryMove && moves.length === 0) {
      try {
        const game = new Chess();
        const moveRes = game.move(queryMove);
        if (moveRes) {
          setMoves([moveRes.san]);
          setCurrentPly(1);
          setCurrentFen(game.fen());
        }
      } catch (err) {
        console.warn("Could not play query move:", queryMove, err);
      }
    }
  }, [queryMove, moves.length]);

  // 3. Resolve Opening Tree Continuations (0ms sync from cached games, deduplicated async fallback on cold load)
  const treeRequestSeqRef = useRef(0);
  useIsomorphicLayoutEffect(() => {
    const isMulti = workspaceStore.activeMode === "multi";
    if (!isMulti && !effectivePlayerId) {
      setContinuations([]);
      setTreeLoading(false);
      return;
    }

    const syncNode = workspaceStore.getOpeningTreeBranchSync(
      currentFen,
      colorFilter,
      isMulti ? undefined : effectivePlayerId
    );
    if (syncNode) {
      setContinuations(syncNode.continuations || []);
      setTreeLoading(false);
      return;
    }

    const reqId = ++treeRequestSeqRef.current;
    setTreeLoading(true);
    workspaceStore
      .getOpeningTreeBranch(currentFen, colorFilter, isMulti ? undefined : effectivePlayerId)
      .then((treeNode) => {
        if (reqId !== treeRequestSeqRef.current) return;
        setContinuations(treeNode?.continuations || []);
      })
      .catch((err) => {
        if (reqId !== treeRequestSeqRef.current) return;
        console.warn("Failed to fetch tree branch:", err);
        setContinuations([]);
      })
      .finally(() => {
        if (reqId === treeRequestSeqRef.current) {
          setTreeLoading(false);
        }
      });
  }, [
    workspaceStore.activeMode,
    effectivePlayerId,
    currentFen,
    colorFilter,
    playerGames.length,
    Boolean(activeRunObj),
    workspaceStore.getOpeningTreeBranchSync,
    workspaceStore.getOpeningTreeBranch,
  ]);

  const currentPlayerObj = useMemo(() => {
    return (
      cachedProfile?.player ||
      players.find((p) => p.id === effectivePlayerId) ||
      workspaceStore.activePlayer
    );
  }, [cachedProfile?.player, players, effectivePlayerId, workspaceStore.activePlayer]);

  // Load a structure game onto the board and jump to formation move
  const handleLoadStructureGame = useCallback((structGame: PawnStructureGame, indexInStruct: number) => {
    setActiveStructureGameIdx(indexInStruct);

    const gameKey = `${structGame.id || structGame.game_index || indexInStruct}`;
    if (loadedStructureGameKeyRef.current === gameKey && moves.length > 0) {
      return;
    }

    // Find the full Game object
    let fullGame: Game | undefined;
    const allGamesPool = playerGames.length > 0 ? playerGames : (workspaceStore.activePlayerGames || []);
    if (structGame.id) {
      fullGame = allGamesPool.find((pg) => pg.id === structGame.id);
    }
    if (!fullGame && structGame.game_index !== undefined && allGamesPool[structGame.game_index]) {
      fullGame = allGamesPool[structGame.game_index];
    }
    if (!fullGame) {
      fullGame = allGamesPool.find((pg) =>
        isPlayerNameMatch(pg.white_player, structGame.white) &&
        isPlayerNameMatch(pg.black_player, structGame.black) &&
        pg.result === structGame.result
      );
    }

    const applyGameMoves = (targetGame: Game) => {
      loadedStructureGameKeyRef.current = gameKey;
      setGameInfo(targetGame);
      if (targetGame.moves_san) {
        const rawTokens = targetGame.moves_san.split(" ");
        const parsedMoves = rawTokens
          .map((t) => t.replace(/^\d+\.+/, "").trim())
          .filter((t) => t && !["1-0", "0-1", "1/2-1/2", "*"].includes(t));

        setMoves(parsedMoves);
        setMoveTree(createMoveTreeFromMoves(parsedMoves));

        // Jump to the formation move of the structure
        const chess = new Chess();
        const formMove = structGame.formation_move || 10;
        const targetPly = structGame.formation_ply !== undefined
          ? Math.min(structGame.formation_ply, parsedMoves.length)
          : Math.min(Math.max(0, (formMove - 1) * 2), parsedMoves.length);

        for (let i = 0; i < targetPly; i++) {
          try {
            chess.move(parsedMoves[i]);
          } catch {
            break;
          }
        }

        setCurrentPly(targetPly);
        setCurrentFen(chess.fen());
      }

      if (structGame.player_color === "black" || structGame.player_color === "white") {
        setBoardOrientation(structGame.player_color);
      } else if (currentPlayerObj?.canonical_name) {
        const isPlayerBlack = isPlayerNameMatch(currentPlayerObj.canonical_name, targetGame.black_player);
        setBoardOrientation(isPlayerBlack ? "black" : "white");
      }
    };

    if (fullGame) {
      applyGameMoves(fullGame);
    } else {
      setGameInfo({
        id: structGame.id || `struct-${indexInStruct}`,
        dataset_id: "",
        white_player: structGame.white || "Trắng",
        black_player: structGame.black || "Đen",
        white_elo: parseOptionalElo(structGame.white_elo),
        black_elo: parseOptionalElo(structGame.black_elo),
        result: structGame.result || "*",
        played_at: structGame.date || "",
        moves_san: "",
        opening_name: structGame.opening || "",
        site_url: structGame.link || "",
      });
      if (structGame.player_color === "black" || structGame.player_color === "white") {
        setBoardOrientation(structGame.player_color);
      }
      if (structGame.id) {
        apiClient.getGame(structGame.id).then((g) => {
          if (g) applyGameMoves(g);
        }).catch((err) => console.warn("Could not fetch full structure game:", err));
      }
    }
  }, [playerGames, workspaceStore.activePlayerGames, moves.length, currentPlayerObj?.canonical_name]);

  // Switch Structure in Explorer Mode
  const handleSelectStructure = useCallback((struct: PawnStructureItem, targetGameIdx?: number, targetGame?: any) => {
    setStructureDismissed(false);
    loadedStructureGameKeyRef.current = null;
    setSelectedStructure(struct);
    setSelectedOpening(null);
    setActiveOpeningGameId(null);
    setActiveStructureGameIdx(targetGameIdx ?? null);

    if (targetGame) {
      handleLoadStructureGame(targetGame as PawnStructureGame, targetGameIdx ?? 0);
    } else if (targetGameIdx !== undefined && struct.games && struct.games.length > 0) {
      const g = struct.games.find((tg) => tg.game_index === targetGameIdx) || struct.games[targetGameIdx];
      if (g) handleLoadStructureGame(g, targetGameIdx);
    } else if (struct.games && struct.games.length > 0) {
      handleLoadStructureGame(struct.games[0], struct.games[0].game_index ?? 0);
    }

    const params = new URLSearchParams(window.location.search);
    params.set("structure", struct.name);
    params.delete("opening");
    if (targetGameIdx !== undefined) {
      params.set("gameIdx", String(targetGameIdx));
    } else {
      params.delete("gameIdx");
    }
    window.history.replaceState(null, "", `/analyze?${params.toString()}`);
  }, [handleLoadStructureGame]);

  // Exit Structure Explorer Mode
  const handleExitStructureExplorer = useCallback(() => {
    setStructureDismissed(true);
    setSelectedStructure(null);
    setActiveStructureGameIdx(null);
    loadedStructureGameKeyRef.current = null;
    setMoves([]);
    setCurrentPly(0);
    setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    setMoveTree(createMoveTreeFromMoves([]));
    setGameInfo(null);
    const params = new URLSearchParams(window.location.search);
    params.delete("structure");
    params.delete("gameIdx");
    const newQuery = params.toString();
    const nextUrl = newQuery ? `/analyze?${newQuery}` : `/analyze`;
    window.history.replaceState(null, "", nextUrl);
    router.replace(nextUrl, { scroll: false });
  }, [router]);

  // Switch Opening in Explorer Mode
  const handleSelectOpening = useCallback((opName: string) => {
    setOpeningDismissed(false);
    setSelectedOpening(opName);
    setSelectedStructure(null);
    setActiveStructureGameIdx(null);
    setActiveOpeningGameId(null);
    const pool = playerGames.length > 0 ? playerGames : (workspaceStore.activePlayerGames || []);
    const activePlayerNameForKey = currentPlayerObj?.canonical_name || workspaceStore.activePlayer?.canonical_name;
    loadedOpeningRef.current = `${opName}::${pool.length > 0 ? 1 : 0}::${activePlayerNameForKey ? 1 : 0}`;
    const matchingGames = pool.filter((g) => isOpeningMatch(g, opName));

    // 1. Ưu tiên hàng đầu: Nạp trực tiếp thế cờ chuẩn (Canonical Moves & FEN) từ Lichess Openings
    const canonical = getCanonicalOpeningByName(opName);
    let line = canonical ? canonical.moves : [];

    // 2. Nếu chưa có trong từ điển chuẩn, fallback suy luận từ nhóm ván đấu của kỳ thủ
    if (line.length === 0) {
      line = findRepresentativeLineForGames(matchingGames, opName);
    }
    setOpeningRepresentativeLine(line);

    // Apply line moves to board to display canonical opening formation
    const chess = new Chess();
    for (const m of line) {
      try {
        chess.move(m);
      } catch {
        break;
      }
    }
    setMoves(line);
    setCurrentPly(line.length);
    setCurrentFen(chess.fen());
    setMoveTree(createMoveTreeFromMoves(line));
    setGameInfo(null);

    // Async fallback to Lichess Openings API (3,865 ECO entries) if local line was empty
    if (line.length === 0) {
      apiClient.getCanonicalOpening(opName)
        .then((canonicalData) => {
          if (canonicalData && canonicalData.moves && canonicalData.moves.length > 0) {
            const apiLine: string[] = canonicalData.moves;
            setOpeningRepresentativeLine(apiLine);
            const apiChess = new Chess();
            for (const m of apiLine) {
              try {
                apiChess.move(m);
              } catch {
                break;
              }
            }
            setMoves(apiLine);
            setCurrentPly(apiLine.length);
            setCurrentFen(apiChess.fen());
            setMoveTree(createMoveTreeFromMoves(apiLine));
          }
        })
        .catch(() => {});
    }

    // Determine orientation based on player games or defense naming
    const activePlayerName = currentPlayerObj?.canonical_name || workspaceStore.activePlayer?.canonical_name;
    if (matchingGames.length > 0 && activePlayerName) {
      const outcomes = matchingGames.map((g) => getGamePlayerOutcome(g, activePlayerName));
      const blackCount = outcomes.filter((o) => o.playerColor === "black").length;
      const whiteCount = outcomes.filter((o) => o.playerColor === "white").length;
      if (blackCount > whiteCount) {
        setBoardOrientation("black");
        setColorFilter("black");
      } else {
        setBoardOrientation("white");
        setColorFilter("white");
      }
    } else {
      const opLower = opName.toLowerCase();
      if (opLower.includes("defense") || opLower.includes("defence") || opLower.includes("counter")) {
        setBoardOrientation("black");
        setColorFilter("black");
      } else {
        setBoardOrientation("white");
        setColorFilter("white");
      }
    }

    const params = new URLSearchParams(window.location.search);
    params.set("opening", opName);
    params.delete("structure");
    params.delete("gameIdx");
    window.history.replaceState(null, "", `/analyze?${params.toString()}`);
  }, [playerGames, currentPlayerObj?.canonical_name, workspaceStore.activePlayerGames, workspaceStore.activePlayer?.canonical_name]);

  // Exit Opening Explorer Mode
  const handleExitOpeningExplorer = useCallback(() => {
    setOpeningDismissed(true);
    setSelectedOpening(null);
    setActiveOpeningGameId(null);
    setOpeningRepresentativeLine([]);
    loadedOpeningRef.current = null;
    setMoves([]);
    setCurrentPly(0);
    setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    setMoveTree(createMoveTreeFromMoves([]));
    setGameInfo(null);
    const params = new URLSearchParams(window.location.search);
    params.delete("opening");
    const newQuery = params.toString();
    const nextUrl = newQuery ? `/analyze?${newQuery}` : `/analyze`;
    window.history.replaceState(null, "", nextUrl);
    router.replace(nextUrl, { scroll: false });
  }, [router]);

  // Auto-load structure if activeStructureForAnalysis was triggered from Profile PawnStructureGrid
  useEffect(() => {
    if (workspaceStore.activeStructureForAnalysis) {
      setStructureDismissed(false);
      const { structureName, structObj, gameIdx, game } = workspaceStore.activeStructureForAnalysis;
      const targetStruct =
        availableStructures.find(
          (s) =>
            s.name.toLowerCase().trim() === structureName.toLowerCase().trim() ||
            (s.structure_key && s.structure_key.toLowerCase() === structureName.toLowerCase().trim())
        ) || structObj;

      if (targetStruct) {
        handleSelectStructure(targetStruct, gameIdx, game);
      }
      workspaceStore.clearActiveStructureForAnalysis();
    }
  }, [workspaceStore.activeStructureForAnalysis, availableStructures, handleSelectStructure, workspaceStore.clearActiveStructureForAnalysis]);

  // Auto-load opening if activeOpeningForAnalysis was triggered from Profile Repertoire Table
  useEffect(() => {
    if (workspaceStore.activeOpeningForAnalysis) {
      setOpeningDismissed(false);
      const { openingName } = workspaceStore.activeOpeningForAnalysis;
      handleSelectOpening(openingName);
      workspaceStore.clearActiveOpeningForAnalysis();
    }
  }, [workspaceStore.activeOpeningForAnalysis, handleSelectOpening, workspaceStore.clearActiveOpeningForAnalysis]);

  // 4. Sync selectedStructure before first paint if queryStructure is in URL
  useIsomorphicLayoutEffect(() => {
    if (structureDismissed) return;
    if (queryStructure && availableStructures.length > 0) {
      const matched = availableStructures.find((s) =>
        s.name.toLowerCase().trim() === queryStructure.toLowerCase().trim() ||
        (s.structure_key && s.structure_key.toLowerCase() === queryStructure.toLowerCase().trim())
      );
      if (matched && (!selectedStructure || selectedStructure.name.toLowerCase() !== matched.name.toLowerCase())) {
        handleSelectStructure(matched, queryGameIdx ? parseInt(queryGameIdx, 10) : undefined);
      }
    }
  }, [queryStructure, queryGameIdx, availableStructures, selectedStructure, handleSelectStructure, structureDismissed]);

  // Handle Player Switch
  const handlePlayerChange = (newPlayerId: string) => {
    setSelectedPlayerId(newPlayerId);
    setActiveRunId(newPlayerId);
    if (newPlayerId) {
      workspaceStore.selectSingleProfile(newPlayerId, "board");
      const params = new URLSearchParams(window.location.search);
      params.set("playerId", newPlayerId);
      window.history.replaceState(null, "", `/analyze?${params.toString()}`);
    } else {
      workspaceStore.openSandboxBoard();
      const params = new URLSearchParams(window.location.search);
      params.delete("playerId");
      params.delete("runId");
      const q = params.toString();
      window.history.replaceState(null, "", q ? `/analyze?${q}` : "/analyze");
    }
    // Reset board to initial position
    setMoves([]);
    setCurrentPly(0);
    setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    setMoveTree(createMoveTreeFromMoves([]));
    setGameInfo(null);
    setSelectedStructure(null);
    setActiveStructureGameIdx(null);
    loadedStructureGameKeyRef.current = null;
    setSelectedOpening(null);
    setActiveOpeningGameId(null);
    setOpeningRepresentativeLine([]);
    loadedOpeningRef.current = null;
    lastGamesCountRef.current = 0;
  };

  // Check if current moves on board form or transition to another opening
  const checkOpeningTransition = useCallback(async (activeMoves: string[]) => {
    if (!activeMoves || activeMoves.length === 0) return;
    if (!selectedOpening) return;

    // 1. Check games in playerGames starting with activeMoves
    const prefixMatchingGames = playerGames.filter((g) => {
      if (!g.moves_san) return false;
      const gMoves = parseSanMoves(g.moves_san);
      if (gMoves.length < activeMoves.length) return false;
      for (let i = 0; i < activeMoves.length; i++) {
        if (gMoves[i] !== activeMoves[i]) return false;
      }
      return true;
    });

    let detectedOpeningName: string | null = null;

    // 2. Check canonical opening formed at activeMoves
    let canonical = getCanonicalOpeningByMoves(activeMoves);
    if (!canonical && activeMoves.length >= 2) {
      try {
        const serverCanonical = await apiClient.getCanonicalOpening(undefined, activeMoves);
        if (serverCanonical && serverCanonical.name) {
          canonical = serverCanonical;
        }
      } catch {
        // Ignore API 404
      }
    }

    // 3. If player games exist for this prefix, check dominant opening of matching games
    if (prefixMatchingGames.length > 0) {
      const tally: Record<string, number> = {};
      for (const g of prefixMatchingGames) {
        const op = g.opening_name || g.raw_headers?.Opening;
        if (op) {
          tally[op] = (tally[op] || 0) + 1;
        }
      }
      const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) {
        const [topPlayerOpName] = sorted[0];

        // If a canonical opening has formed, ensure topPlayerOpName matches or corresponds to it
        if (canonical) {
          const matched = availableOpenings.find((op) =>
            normalizeOpeningName(op.name) === normalizeOpeningName(topPlayerOpName) ||
            isOpeningMatch({ opening_name: topPlayerOpName } as Game, op.name) ||
            normalizeOpeningName(op.name) === normalizeOpeningName(canonical.name) ||
            isOpeningMatch({ opening_name: canonical.name } as Game, op.name)
          );
          detectedOpeningName = matched ? matched.name : topPlayerOpName;
        } else {
          const matched = availableOpenings.find((op) =>
            normalizeOpeningName(op.name) === normalizeOpeningName(topPlayerOpName) ||
            isOpeningMatch({ opening_name: topPlayerOpName } as Game, op.name)
          );
          if (matched) {
            detectedOpeningName = matched.name;
          }
        }
      }
    } else if (canonical) {
      // No player games with this prefix, but theoretical canonical opening formed
      const matched = availableOpenings.find((op) =>
        normalizeOpeningName(op.name) === normalizeOpeningName(canonical.name) ||
        isOpeningMatch({ opening_name: canonical.name } as Game, op.name)
      );
      detectedOpeningName = matched ? matched.name : canonical.name;
    }

    // 4. If a different opening was detected, trigger automatic transition
    if (detectedOpeningName && detectedOpeningName !== selectedOpening) {
      const isSame = isOpeningMatch({ opening_name: detectedOpeningName } as Game, selectedOpening);
      if (!isSame) {
        isAutoTransitionRef.current = true;
        setSelectedOpening(detectedOpeningName);
        loadedOpeningRef.current = detectedOpeningName;
        setActiveOpeningGameId(null);

        // Update URL query while preserving all other params
        const params = new URLSearchParams(window.location.search);
        params.set("opening", detectedOpeningName);
        router.replace(`/analyze?${params.toString()}`);
      }
    }
  }, [selectedOpening, playerGames, availableOpenings, router]);

  // Position change from ChessBoard component (e.g. keyboard navigation or board buttons)
  const handlePositionChange = useCallback((fen: string, ply: number) => {
    setCurrentFen(fen);
    setCurrentPly(ply);
    setMoveTree((prevTree) => {
      if (ply === 0) {
        return { ...prevTree, activeNodeId: null };
      }
      const activeP = getActivePath(prevTree);
      if (ply > 0 && ply <= activeP.length) {
        return { ...prevTree, activeNodeId: activeP[ply - 1].id };
      }
      return prevTree;
    });
    checkOpeningTransition(moves.slice(0, ply));
  }, [moves, checkOpeningTransition]);

  // Move made on ChessBoard (supports automatic variation branching!)
  const handleMakeMove = useCallback((san: string, newFen: string) => {
    setMoveTree((prevTree) => {
      const { tree: newTree, newNode } = addMoveToTree(prevTree, san, newFen);
      const activeP = getActivePath(newTree);
      const activeIdx = activeP.findIndex((n) => n.id === newNode.id);
      const nextPly = activeIdx !== -1 ? activeIdx + 1 : newNode.ply;
      const newMoves = activeP.map((n) => n.san);

      setMoves(newMoves);
      setCurrentPly(nextPly);
      setCurrentFen(newFen);
      checkOpeningTransition(newMoves.slice(0, nextPly));

      return newTree;
    });
  }, [checkOpeningTransition]);

  // Fallback for legacy onMovesChange
  const handleMovesChange = (newMoves: string[], ply: number, fen: string) => {
    setMoves(newMoves);
    setCurrentPly(ply);
    setCurrentFen(fen);
    setMoveTree(createMoveTreeFromMoves(newMoves));
    checkOpeningTransition(newMoves.slice(0, ply));
  };

  // Select node in MoveTree (main line or variation)
  const handleSelectTreeNode = useCallback((nodeId: string) => {
    setMoveTree((prevTree) => {
      const targetNode = findNodeById(prevTree.rootNodes, nodeId);
      if (!targetNode) return prevTree;

      const updatedTree = { ...prevTree, activeNodeId: nodeId };
      const activeP = getActivePath(updatedTree);
      const activeIdx = activeP.findIndex((n) => n.id === nodeId);
      const nextPly = activeIdx !== -1 ? activeIdx + 1 : targetNode.ply;
      const newMoves = activeP.map((n) => n.san);

      setMoves(newMoves);
      setCurrentPly(nextPly);
      setCurrentFen(targetNode.fen);
      checkOpeningTransition(newMoves.slice(0, nextPly));

      return updatedTree;
    });
  }, [checkOpeningTransition]);

  // Promote a variation to become the main line (Trở thành biến chính)
  const handlePromoteVariation = useCallback((nodeId: string) => {
    setMoveTree((prevTree) => {
      const updatedTree = promoteVariationToMainLine(prevTree, nodeId);
      const activeP = getActivePath(updatedTree);
      const activeIdx = activeP.findIndex((n) => n.id === nodeId);
      const targetNode = findNodeById(updatedTree.rootNodes, nodeId);
      const nextPly = activeIdx !== -1 ? activeIdx + 1 : (targetNode ? targetNode.ply : 0);
      const newMoves = activeP.map((n) => n.san);

      setMoves(newMoves);
      setCurrentPly(nextPly);
      if (targetNode) setCurrentFen(targetNode.fen);
      checkOpeningTransition(newMoves.slice(0, nextPly));

      return updatedTree;
    });
  }, [checkOpeningTransition]);

  // Delete move and subsequent moves in its branch (Xoá từ đây)
  const handleDeleteFromHere = useCallback((nodeId: string) => {
    setMoveTree((prevTree) => {
      const updatedTree = deleteMoveFromHere(prevTree, nodeId);
      const activeP = getActivePath(updatedTree);
      const activeNode = updatedTree.activeNodeId
        ? findNodeById(updatedTree.rootNodes, updatedTree.activeNodeId)
        : null;

      const nextPly = activeNode
        ? (activeP.findIndex((n) => n.id === activeNode.id) + 1)
        : 0;
      const newMoves = activeP.map((n) => n.san);
      const newFen = activeNode ? activeNode.fen : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

      setMoves(newMoves);
      setCurrentPly(nextPly);
      setCurrentFen(newFen);
      checkOpeningTransition(newMoves.slice(0, nextPly));

      return updatedTree;
    });
  }, [checkOpeningTransition]);

  // Select ply (jump by ply count or to starting position)
  const handleSelectPly = useCallback((ply: number) => {
    if (ply === 0) {
      setMoveTree((prev) => ({ ...prev, activeNodeId: null }));
      setCurrentPly(0);
      setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      checkOpeningTransition([]);
      return;
    }
    const activeP = getActivePath(moveTree);
    if (ply > 0 && ply <= activeP.length) {
      const targetNode = activeP[ply - 1];
      handleSelectTreeNode(targetNode.id);
    } else {
      const clamped = Math.max(0, Math.min(moves.length, ply));
      setCurrentPly(clamped);
      checkOpeningTransition(moves.slice(0, clamped));
    }
  }, [moveTree, handleSelectTreeNode, moves, checkOpeningTransition]);

  // Select move from Opening Tree
  const handleSelectMove = (san: string) => {
    try {
      const chess = new Chess(currentFen);
      const res = chess.move(san);
      if (res) {
        handleMakeMove(res.san, chess.fen());
      }
    } catch (e) {
      console.warn("Invalid move selected:", san, e);
    }
  };

  // Open single game in a new tab without affecting the current analysis session
  const handleLoadSingleGame = (sg: any) => {
    if (!sg) return;
    if (sg.lichessId) {
      window.open(`/analyze?lichessId=${sg.lichessId}`, "_blank");
      return;
    }
    const params = new URLSearchParams();
    if (effectivePlayerId) params.set("playerId", effectivePlayerId);
    try {
      sessionStorage.setItem("inspect_game", JSON.stringify(sg));
    } catch {}
    if (sg.id && typeof sg.id === "string" && sg.id.includes("-")) {
      params.set("gameId", sg.id);
      window.open(`/analyze?${params.toString()}`, "_blank");
      return;
    }
    params.set("inspectGame", "1");
    window.open(`/analyze?${params.toString()}`, "_blank");
  };

  // Auto-load initial structure game once games pool arrives (supports both ?gameIdx=N and default first game in new tab)
  const allStructureGamesPool = playerGames.length > 0 ? playerGames : workspaceStore.activePlayerGames;
  useIsomorphicLayoutEffect(() => {
    if (
      loadedStructureGameKeyRef.current === null &&
      selectedStructure?.games &&
      selectedStructure.games.length > 0 &&
      allStructureGamesPool.length > 0
    ) {
      const idxNum = queryGameIdx ? parseInt(queryGameIdx, 10) : undefined;
      const targetG =
        idxNum !== undefined && !Number.isNaN(idxNum)
          ? selectedStructure.games.find((g) => g.game_index === idxNum) || selectedStructure.games[idxNum]
          : selectedStructure.games[0];
      if (targetG) {
        handleLoadStructureGame(targetG, targetG.game_index ?? idxNum ?? 0);
      }
    }
  }, [queryGameIdx, selectedStructure, allStructureGamesPool, handleLoadStructureGame]);

  // Handle Custom PGN Input
  const handleLoadCustomPgn = () => {
    if (!inputPgn.trim()) return;
    try {
      const chess = new Chess();
      chess.loadPgn(inputPgn);
      const history = chess.history();
      const hdr = chess.header();
      setMoves(history);
      setCurrentPly(0);
      setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      setMoveTree(createMoveTreeFromMoves(history));
      if (hdr.White || hdr.Black) {
        setGameInfo({
          id: `pgn-${Date.now()}`,
          dataset_id: "",
          white_player: hdr.White || "Trắng",
          black_player: hdr.Black || "Đen",
          white_elo: parseOptionalElo(hdr.WhiteElo),
          black_elo: parseOptionalElo(hdr.BlackElo),
          result: hdr.Result || "*",
          played_at: hdr.Date || "",
          moves_san: history.join(" "),
          opening_name: hdr.Opening || "",
          eco: hdr.ECO || "",
          site_url: hdr.Site || "",
        });
      } else {
        setGameInfo(null);
      }
      setShowPgnInput(false);
      setInputPgn("");
    } catch (err) {
      alert("PGN không hợp lệ. Vui lòng kiểm tra lại định dạng.");
    }
  };

  // Filtered structure games
  const filteredStructureGames = useMemo(() => {
    if (!selectedStructure || !selectedStructure.games) return [];
    return selectedStructure.games.filter((g) => {
      if (structureFilter === "wins" && !g.is_win) return false;
      if (structureFilter === "draws" && !g.is_draw) return false;
      if (structureFilter === "losses" && !g.is_loss) return false;

      if (structureSearch.trim()) {
        const q = normalizePlayerName(structureSearch);
        const w = normalizePlayerName(g.white || "");
        const b = normalizePlayerName(g.black || "");
        const op = normalizePlayerName(g.opening || "");
        if (!w.includes(q) && !b.includes(q) && !op.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [selectedStructure, structureFilter, structureSearch]);

  // Synchronize Opening Explorer with queryOpening or newly arrived playerGames / player identity
  const activeOpeningGamesPoolCount = playerGames.length || workspaceStore.activePlayerGames.length;
  const hasOpeningPlayerName = Boolean(currentPlayerObj?.canonical_name || workspaceStore.activePlayer?.canonical_name);
  useIsomorphicLayoutEffect(() => {
    if (openingDismissed || !queryOpening) return;

    // Bypass resetting board moves when transition was triggered by user playing moves
    if (isAutoTransitionRef.current) {
      isAutoTransitionRef.current = false;
      loadedOpeningRef.current = `${queryOpening}::${activeOpeningGamesPoolCount > 0 ? 1 : 0}::${hasOpeningPlayerName ? 1 : 0}`;
      return;
    }

    const readyKey = `${queryOpening}::${activeOpeningGamesPoolCount > 0 ? 1 : 0}::${hasOpeningPlayerName ? 1 : 0}`;
    if (loadedOpeningRef.current !== readyKey) {
      handleSelectOpening(queryOpening);
      loadedOpeningRef.current = readyKey;
    }
  }, [queryOpening, activeOpeningGamesPoolCount, hasOpeningPlayerName, handleSelectOpening, openingDismissed]);

  // Load a single game from the opening games list onto the board
  const handleLoadOpeningGame = (targetGame: Game) => {
    setActiveOpeningGameId(targetGame.id);
    setGameInfo(targetGame);

    if (targetGame.moves_san) {
      const parsedMoves = parseSanMoves(targetGame.moves_san);
      setMoves(parsedMoves);

      // Determine target ply: formation ply of the opening
      const chess = new Chess();
      let targetPly = Math.min(openingRepresentativeLine.length, parsedMoves.length);
      if (targetPly === 0) {
        targetPly = Math.min(6, parsedMoves.length);
      }

      for (let i = 0; i < targetPly; i++) {
        try {
          chess.move(parsedMoves[i]);
        } catch {
          break;
        }
      }

      setCurrentPly(targetPly);
      setCurrentFen(chess.fen());

      // Adjust board orientation to analyzed player's perspective in this game
      if (currentPlayerObj?.canonical_name) {
        const isPlayerBlack = isPlayerNameMatch(currentPlayerObj.canonical_name, targetGame.black_player);
        setBoardOrientation(isPlayerBlack ? "black" : "white");
      }
    }
  };

  // Matching games for selected opening
  const matchingOpeningGames = useMemo(() => {
    if (!selectedOpening) return [];
    const pool = playerGames.length > 0 ? playerGames : (workspaceStore.activePlayerGames || []);
    return pool.filter((g) => isOpeningMatch(g, selectedOpening));
  }, [playerGames, selectedOpening, workspaceStore.activePlayerGames]);

  // Statistics for selected opening games
  const openingStats = useMemo(() => {
    let wins = 0;
    let draws = 0;
    let losses = 0;
    matchingOpeningGames.forEach((g) => {
      const outcome = getGamePlayerOutcome(g, currentPlayerObj?.canonical_name);
      if (outcome.isWin) wins++;
      else if (outcome.isDraw) draws++;
      else if (outcome.isLoss) losses++;
    });
    return { wins, draws, losses, total: matchingOpeningGames.length };
  }, [matchingOpeningGames, currentPlayerObj?.canonical_name]);

  // Filtered opening games
  const filteredOpeningGames = useMemo(() => {
    return matchingOpeningGames.filter((g) => {
      const outcome = getGamePlayerOutcome(g, currentPlayerObj?.canonical_name);
      if (openingFilter === "wins" && !outcome.isWin) return false;
      if (openingFilter === "draws" && !outcome.isDraw) return false;
      if (openingFilter === "losses" && !outcome.isLoss) return false;

      if (openingSearch.trim()) {
        const q = normalizePlayerName(openingSearch);
        const w = normalizePlayerName(g.white_player || "");
        const b = normalizePlayerName(g.black_player || "");
        const op = normalizePlayerName(g.opening_name || "");
        const eco = normalizePlayerName(g.eco || "");
        if (!w.includes(q) && !b.includes(q) && !op.includes(q) && !eco.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [matchingOpeningGames, openingFilter, openingSearch, currentPlayerObj?.canonical_name]);

  const currentOpeningItem = useMemo(() => {
    if (!selectedOpening) return null;
    return availableOpenings.find((op) => op.name.toLowerCase() === selectedOpening.toLowerCase()) || null;
  }, [availableOpenings, selectedOpening]);

  const renderExplorerPanel = (isMobileView = false) => {
    if (!isExplorerMode) return null;

    if (isOpeningActive && !isStructureActive) {
      return (
        <div className={`bg-card border border-border/70 rounded-surface overflow-hidden animate-fade-in ${isMobileView ? "mb-3" : "h-full flex flex-col"}`}>
          {/* Top Sticky Header with instant Exit button */}
          <div className="p-3 border-b border-border/60 bg-muted/20 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded bg-emerald-50 text-emerald-700 shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                  Khám phá Khai cuộc
                </div>
                <h3 className="font-bold text-xs sm:text-sm text-foreground truncate" title={selectedOpening || queryOpening || ""}>
                  {selectedOpening || queryOpening}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExitOpeningExplorer}
              className="px-2.5 py-1 rounded border border-border/70 bg-card hover:bg-secondary text-foreground text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer shrink-0 shadow-2xs"
              title="Thoát chế độ Khai cuộc"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Thoát</span>
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3.5">
            {currentOpeningItem?.assessment_badge && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">Đánh giá hồ sơ:</span>
                <span
                  className="assessment-tag border"
                  style={{
                    backgroundColor: `${currentOpeningItem.assessment_color ?? "#94A3B8"}18`,
                    color: `color-mix(in srgb, ${currentOpeningItem.assessment_color ?? "#64748b"} 45%, #0f172a)`,
                    borderColor: `${currentOpeningItem.assessment_color ?? "#94A3B8"}55`,
                  }}
                >
                  {currentOpeningItem.assessment_badge}
                </span>
              </div>
            )}

            {/* Stats */}
            {isProfileDataLoading && playerGames.length === 0 ? (
              <div className="text-xs text-muted-foreground flex items-center gap-2 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />
                <span>Đang tải thống kê khai cuộc...</span>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-muted/40 rounded border border-border/40">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Ván thực tế</span>
                    <span className="font-bold text-sm text-foreground font-mono">{matchingOpeningGames.length}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Điểm Bayes</span>
                    <span className="font-bold text-sm text-emerald-700 font-mono">
                      {currentOpeningItem?.adjusted_score_pct !== undefined
                        ? `${currentOpeningItem.adjusted_score_pct.toFixed(1)}%`
                        : "--"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs px-2 py-1.5 bg-card border border-border/50 rounded">
                  <span className="text-muted-foreground">Kết quả:</span>
                  <div className="flex items-center gap-2 font-mono text-[11px] font-bold">
                    <span className="text-emerald-600">+{openingStats.wins} T</span>
                    <span className="text-amber-600">={openingStats.draws} H</span>
                    <span className="text-rose-600">-{openingStats.losses} B</span>
                  </div>
                </div>
              </div>
            )}

            {/* Opening Switcher */}
            {availableOpenings.length > 1 && (
              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-semibold text-muted-foreground block">
                  Đổi khai cuộc khác:
                </label>
                <select
                  value={selectedOpening || ""}
                  onChange={(e) => handleSelectOpening(e.target.value)}
                  className="w-full bg-secondary/50 border border-border/70 rounded px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                >
                  {availableOpenings.map((op) => (
                    <option key={op.name} value={op.name} className="bg-card text-foreground">
                      {op.name} ({op.games_count} ván)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Bottom Exit Button */}
            <div className="pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={handleExitOpeningExplorer}
                className="w-full py-2 px-3 rounded border border-border/70 hover:bg-secondary text-foreground text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer bg-card shadow-2xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Thoát chế độ Khai cuộc</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (isStructureActive) {
      return (
        <div className={`bg-card border border-border/70 rounded-surface overflow-hidden animate-fade-in ${isMobileView ? "mb-3" : "h-full flex flex-col"}`}>
          {/* Top Sticky Header with instant Exit button */}
          <div className="p-3 border-b border-border/60 bg-muted/20 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded bg-emerald-50 text-emerald-700 shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                  Khám phá Cấu trúc Tốt
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <h3 className="font-bold text-xs sm:text-sm text-foreground truncate" title={selectedStructure?.name || queryStructure || ""}>
                    {selectedStructure?.name || queryStructure}
                  </h3>
                  <PawnStructureInfoBadge structureName={selectedStructure?.name || queryStructure || ""} />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExitStructureExplorer}
              className="px-2.5 py-1 rounded border border-border/70 bg-card hover:bg-secondary text-foreground text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer shrink-0 shadow-2xs"
              title="Thoát chế độ Cấu trúc"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Thoát</span>
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3.5">
            {selectedStructure?.assessment_badge && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">Đánh giá hồ sơ:</span>
                <span
                  className="assessment-tag border"
                  style={{
                    backgroundColor: `${selectedStructure.assessment_color ?? "#94A3B8"}18`,
                    color: `color-mix(in srgb, ${selectedStructure.assessment_color ?? "#64748b"} 45%, #0f172a)`,
                    borderColor: `${selectedStructure.assessment_color ?? "#94A3B8"}55`,
                  }}
                >
                  {selectedStructure.assessment_badge}
                </span>
              </div>
            )}

            {/* Stats */}
            {isProfileDataLoading ? (
              <div className="text-xs text-muted-foreground flex items-center gap-2 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />
                <span>Đang nạp hồ sơ cấu trúc tốt...</span>
              </div>
            ) : selectedStructure ? (
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-muted/40 rounded border border-border/40">
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Ván thực tế</span>
                    <span className="font-bold text-sm text-foreground font-mono">
                      {selectedStructure.games?.length || selectedStructure.games_count || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-muted-foreground block">Điểm Bayes</span>
                    <span className="font-bold text-sm text-emerald-700 font-mono">
                      {(selectedStructure.adjusted_score_pct ?? selectedStructure.score_pct ?? 0).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground px-2 py-1 bg-card border border-border/40 rounded">
                  Nước hình thành: ~<b>{selectedStructure.typical_formation_move || 12}</b>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Không tìm thấy dữ liệu cấu trúc tương ứng trong hồ sơ.
              </p>
            )}

            {/* Strategic Plan ideas & counter_ideas */}
            {selectedStructure?.strategic_plan && (
              <div className="p-3 rounded bg-muted/30 border border-border/40 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-[11px] uppercase tracking-wide">
                  <Compass className="w-3.5 h-3.5" />
                  <span>Kế hoạch Chiến lược</span>
                </div>
                <div className="space-y-1.5 text-[11px] leading-relaxed">
                  <div>
                    <span className="font-semibold text-emerald-700">Kế hoạch: </span>
                    <span className="text-muted-foreground">{selectedStructure.strategic_plan.ideas.join(" ")}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-rose-700">Đối ứng: </span>
                    <span className="text-muted-foreground">{selectedStructure.strategic_plan.counter_ideas.join(" ")}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Structure Switcher */}
            {availableStructures.length > 1 && (
              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-semibold text-muted-foreground block">
                  Đổi cấu trúc khác:
                </label>
                <select
                  value={selectedStructure?.name || ""}
                  onChange={(e) => {
                    const target = availableStructures.find((s) => s.name === e.target.value);
                    if (target) handleSelectStructure(target);
                  }}
                  className="w-full bg-secondary/50 border border-border/70 rounded px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                >
                  {(() => {
                    const validStructures = availableStructures.filter(
                      (s) => !s.name?.toLowerCase().includes("benoni") && !(s.structure_key || "").toLowerCase().includes("benoni")
                    );
                    const groupB = validStructures.filter(
                      (s) =>
                        s.group === "B" ||
                        [
                          "Carlsbad",
                          "French_Chain",
                          "Kings_Indian",
                          "Scheveningen",
                          "Boleslavsky_Hole",
                          "Maroczy_Bind",
                          "Hedgehog",
                          "Stonewall",
                        ].includes(s.structure_key || "")
                    );
                    const groupA = validStructures.filter(
                      (s) => s.group === "A" || !groupB.includes(s)
                    );
                    return (
                      <>
                        {groupB.length > 0 && (
                          <optgroup label="Cấu trúc chiến lược kinh điển" className="bg-card text-foreground font-bold">
                            {groupB.map((s) => (
                              <option key={s.name} value={s.name} className="bg-card text-foreground font-normal">
                                {s.name} ({s.games_count} ván)
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {groupA.length > 0 && (
                          <optgroup label="Cấu trúc nền tảng & Trung tâm" className="bg-card text-foreground font-bold">
                            {groupA.map((s) => (
                              <option key={s.name} value={s.name} className="bg-card text-foreground font-normal">
                                {s.name} ({s.games_count} ván)
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </>
                    );
                  })()}
                </select>
              </div>
            )}

            {/* Bottom Exit Button */}
            <div className="pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={handleExitStructureExplorer}
                className="w-full py-2 px-3 rounded border border-border/70 hover:bg-secondary text-foreground text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer bg-card shadow-2xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Thoát chế độ Cấu trúc</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderChessBoardSection = () => (
    <>
      <div className="relative flex justify-center w-full">
        <ChessBoard
          initialFen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
          moves={moves}
          currentPly={currentPly}
          orientation={boardOrientation}
          onOrientationChange={setBoardOrientation}
          playersInfo={boardPlayersInfo}
          onPositionChange={handlePositionChange}
          onMakeMove={handleMakeMove}
          onMovesChange={handleMovesChange}
          onEvaluationChange={(ev, thinking) => {
            setEvaluation(ev);
            setIsThinking(thinking);
          }}
          isEngineEnabled={isEngineEnabled}
          multiPv={multiPv}
          height={760}
          onBoardWidthChange={(size) => setBoardSize(size)}
        />
        {queryStructure && !selectedOpening && moves.length === 0 && isProfileDataLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/55 backdrop-blur-[2px] rounded-md pointer-events-none">
            <div className="bg-card/95 border border-border/70 rounded-md px-4 py-2.5 shadow-lg flex items-center gap-2.5 text-xs font-semibold text-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
              <span>Đang nạp thế cờ hình thành cấu trúc {queryStructure}...</span>
            </div>
          </div>
        )}
      </div>

      {/* Current FEN Bar & Action Buttons (Directly attached to the board column) */}
      <div
        style={{ width: `${boardSize + 24}px`, maxWidth: "100%" }}
        className="bg-card border border-border/60 rounded-md px-3 py-1.5 flex items-center justify-between gap-2 text-xs shrink-0 mt-2"
      >
        <div className="flex items-center gap-1.5 truncate min-w-0">
          <span className="font-bold text-muted-foreground uppercase text-[10px] shrink-0">FEN:</span>
          <span className="font-mono text-foreground truncate select-all text-[11px]" title={currentFen}>
            {currentFen}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(currentFen);
              alert("Đã sao chép FEN vào clipboard!");
            }}
            className="px-2 py-0.5 rounded bg-secondary hover:bg-muted font-semibold text-[11px] text-foreground transition cursor-pointer"
            title="Sao chép FEN"
          >
            Sao chép
          </button>
          <button
            type="button"
            onClick={() => setShowPgnInput(true)}
            className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-semibold text-[11px] transition flex items-center gap-1 cursor-pointer border border-emerald-200"
            title="Dán PGN hoặc FEN để nạp vào bàn cờ"
          >
            <Upload className="w-3 h-3" />
            <span>Dán PGN / FEN</span>
          </button>
        </div>
      </div>
    </>
  );

  const renderRightPanelContent = () => (
    <>
      {/* Top: Move History (Notation + Stockfish Eval) - 50% equal height */}
      <div className="flex-1 min-h-0 border-b border-border/50 flex flex-col overflow-hidden">
        <MoveHistory
          moves={moves}
          currentPly={currentPly}
          onSelectPly={handleSelectPly}
          currentFen={currentFen}
          evaluation={evaluation}
          isThinking={isThinking}
          isEngineEnabled={isEngineEnabled}
          onToggleEngine={() => setIsEngineEnabled((prev) => !prev)}
          multiPv={multiPv}
          onMultiPvChange={(count) => setMultiPv(count)}
          embedded={true}
          moveTree={moveTree}
          onSelectNode={handleSelectTreeNode}
          onPromoteVariation={handlePromoteVariation}
          onDeleteFromHere={handleDeleteFromHere}
          onFlipBoard={() => setBoardOrientation((prev) => (prev === "white" ? "black" : "white"))}
          boardOrientation={boardOrientation}
          onResetBoard={() => {
            setMoves([]);
            setCurrentPly(0);
            setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
            setMoveTree(createMoveTreeFromMoves([]));
            setSelectedOpening(null);
            setGameInfo(null);
          }}
          canResetBoard={
            Boolean(gameInfo) ||
            moves.length > 0 ||
            currentFen !== "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
          }
        />
      </div>

      {/* Middle: Compact Color Filter / Perspective Toolbar */}
      <div className="px-3.5 py-1 bg-slate-50 border-b border-border/50 flex items-center justify-between shrink-0 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground font-semibold text-[11px]">
          <Layers className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex items-center gap-1 p-0.5 bg-secondary/60 rounded">
          <button
            onClick={() => setColorFilter("all")}
            className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition ${colorFilter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
          >
            Tất cả
          </button>
          <button
            onClick={() => {
              setColorFilter("white");
              setBoardOrientation("white");
            }}
            className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition flex items-center gap-1 ${colorFilter === "white" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
          >
            <span className="w-2 h-2 rounded-full bg-white border border-slate-300" />
            <span>Trắng</span>
          </button>
          <button
            onClick={() => {
              setColorFilter("black");
              setBoardOrientation("black");
            }}
            className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition flex items-center gap-1 ${colorFilter === "black" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-900 border border-slate-600" />
            <span>Đen</span>
          </button>
        </div>
      </div>

      {/* Bottom: Opening Continuations & Master Database - 50% equal height */}
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
        {treeLoading && (
          <div
            className="absolute top-0 left-0 right-0 h-1 bg-emerald-500 animate-pulse z-30 pointer-events-none"
            title="Đang cập nhật biến thể..."
          />
        )}
        <OpeningTreeTable
          continuations={continuations}
          totalGames={continuations.reduce((acc, c) => acc + c.games_count, 0)}
          currentFen={currentFen}
          onSelectMove={handleSelectMove}
          onLoadGame={handleLoadSingleGame}
          playerName={currentPlayerObj?.canonical_name}
          players={players}
          selectedPlayerId={selectedPlayerId || undefined}
          onSelectPlayer={handlePlayerChange}
          embedded={true}
          isLoading={treeLoading || isProfileDataLoading}
          isSandboxMode={workspaceStore.activeMode === "sandbox"}
          isMultiMode={workspaceStore.activeMode === "multi"}
          multiTitle={
            workspaceStore.activeMode === "multi"
              ? `Matchup: ⚪ ${
                  workspaceStore.multiProfiles
                    .filter((m) => m.role === "white" || m.role === "both")
                    .map((m) => m.player.canonical_name)
                    .join(", ") || "Trắng"
                } vs ⚫ ${
                  workspaceStore.multiProfiles
                    .filter((m) => m.role === "black" || m.role === "both")
                    .map((m) => m.player.canonical_name)
                    .join(", ") || "Đen"
                }`
              : undefined
          }
        />
      </div>
    </>
  );

  return (
    <div className={`w-full max-w-[1720px] mx-auto animate-fade-in ${boardPlayersInfo ? "pt-7 sm:pt-8" : "pt-1 sm:pt-3"} pb-6 space-y-5`}>

      {/* MATCHUP MODE BANNER */}
      {workspaceStore.activeMode === "multi" && workspaceStore.multiProfiles.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:px-4 sm:py-3 rounded-md bg-muted/40 border border-border/70 text-foreground">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-emerald-50 text-emerald-700">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Cây Khai Cuộc Matchup Ghép Đôi
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Tần suất nước đi & tỷ lệ thắng được tổng hợp theo đúng vai trò:{" "}
                <b className="text-foreground">⚪ Trắng ({workspaceStore.multiProfiles.filter((m) => m.role === "white" || m.role === "both").map((m) => m.player.canonical_name).join(", ") || "Chưa chọn"})</b>{" "}
                vs{" "}
                <b className="text-foreground">⚫ Đen ({workspaceStore.multiProfiles.filter((m) => m.role === "black" || m.role === "both").map((m) => m.player.canonical_name).join(", ") || "Chưa chọn"})</b>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => workspaceStore.openHub()}
            className="px-3 py-1.5 rounded border border-border/70 hover:bg-muted text-foreground text-xs font-medium transition self-start sm:self-auto shrink-0"
          >
            Chỉnh sửa tổ hợp
          </button>
        </div>
      )}

      {/* Main Analysis Workspace */}
      {isExplorerMode ? (
        <div className="flex flex-col lg:flex-row gap-5 xl:gap-6 items-start w-full">
          {/* Left Column (Only in Explorer Mode on Desktop): Info Panel (280-300px) */}
          <div
            style={{ height: `${boardSize}px` }}
            className="hidden lg:block w-[280px] xl:w-[300px] shrink-0"
          >
            {renderExplorerPanel(false)}
          </div>

          {/* Center Column: ChessBoard Column */}
          <div
            style={{ width: `${boardSize + 24}px`, maxWidth: "100%" }}
            className="shrink-0 flex flex-col items-center sticky top-14 z-20 bg-background pt-1 pb-2 border-b border-border/40 lg:static lg:bg-transparent lg:p-0 lg:border-none"
          >
            <div className="block lg:hidden w-full mb-3">{renderExplorerPanel(true)}</div>
            {renderChessBoardSection()}
          </div>

          {/* Right Column (Desktop >= 1024px): Move History & Variations - Expands to fill screen */}
          <div
            style={{ height: `${boardSize}px` }}
            className="hidden lg:flex flex-1 min-w-[320px] flex-col bg-card border border-border/60 rounded-surface overflow-hidden"
          >
            {renderRightPanelContent()}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
          {/* Left Column: Interactive ChessBoard (7 Cols - Large, filling the screen like Image 2) */}
          <div className="lg:col-span-7 flex flex-col items-center w-full sticky top-14 z-20 bg-background pt-1 pb-2 border-b border-border/40 lg:static lg:bg-transparent lg:p-0 lg:border-none space-y-2">
            {renderChessBoardSection()}
          </div>

          {/* Right Column: Unified Move History & Opening Variations Panel (5 Cols - Large as in Image 2) */}
          <div
            style={{ height: `${boardSize}px` }}
            className="hidden lg:flex lg:col-span-5 flex-col bg-card border border-border/60 rounded-surface overflow-hidden"
          >
            {renderRightPanelContent()}
          </div>
        </div>
      )}

      {/* Mobile & iPad (< 1024px) Streamlined Tabbed Layout (Learned from Chess.com & Lichess) */}
      <div className="block lg:hidden w-full flex flex-col gap-3">
            {/* Tab navigation pills */}
            <div className="flex items-center gap-1 p-1 bg-card border border-border/70 rounded-control overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setMobileTab("moves")}
                className={`flex-1 min-w-[70px] py-1.5 px-2 rounded text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  mobileTab === "moves"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Nước đi</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileTab("tree")}
                className={`flex-1 min-w-[75px] py-1.5 px-2 rounded text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  mobileTab === "tree"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Khai cuộc</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileTab("structures")}
                className={`flex-1 min-w-[80px] py-1.5 px-2 rounded text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  mobileTab === "structures"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Thế trận Tốt</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileTab("games")}
                className={`flex-1 min-w-[75px] py-1.5 px-2 rounded text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  mobileTab === "games"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                <span>Ván đấu {matchingOpeningGames.length > 0 ? `(${matchingOpeningGames.length})` : ""}</span>
              </button>
            </div>

            {/* Mobile Tab 1: Nước đi */}
            {mobileTab === "moves" && (
              <div className="h-[380px] sm:h-[450px] flex flex-col bg-card border border-border/60 rounded-surface overflow-hidden">
                <MoveHistory
                  moves={moves}
                  currentPly={currentPly}
                  onSelectPly={handleSelectPly}
                  currentFen={currentFen}
                  evaluation={evaluation}
                  isThinking={isThinking}
                  isEngineEnabled={isEngineEnabled}
                  onToggleEngine={() => setIsEngineEnabled((prev) => !prev)}
                  multiPv={multiPv}
                  onMultiPvChange={(count) => setMultiPv(count)}
                  embedded={true}
                  moveTree={moveTree}
                  onSelectNode={handleSelectTreeNode}
                  onPromoteVariation={handlePromoteVariation}
                  onDeleteFromHere={handleDeleteFromHere}
                  onFlipBoard={() => setBoardOrientation((prev) => (prev === "white" ? "black" : "white"))}
                  boardOrientation={boardOrientation}
                  onResetBoard={() => {
                    setMoves([]);
                    setCurrentPly(0);
                    setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
                    setMoveTree(createMoveTreeFromMoves([]));
                    setSelectedOpening(null);
                    setGameInfo(null);
                  }}
                  canResetBoard={
                    Boolean(gameInfo) ||
                    moves.length > 0 ||
                    currentFen !== "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                  }
                />
              </div>
            )}

            {/* Mobile Tab 2: Khai cuộc (Opening Tree) */}
            {mobileTab === "tree" && (
              <div className="h-[420px] sm:h-[480px] flex flex-col bg-card border border-border/60 rounded-surface overflow-hidden">
                <div className="px-3 py-1.5 bg-slate-50 border-b border-border/50 flex items-center justify-between shrink-0 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground font-semibold text-[11px]">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex items-center gap-1 p-0.5 bg-secondary/60 rounded">
                    <button
                      onClick={() => setColorFilter("all")}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${colorFilter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                    >
                      Tất cả
                    </button>
                    <button
                      onClick={() => {
                        setColorFilter("white");
                        setBoardOrientation("white");
                      }}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition flex items-center gap-1 ${colorFilter === "white" ? "bg-primary text-primary-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-white border border-slate-300 shadow-2xs" />
                      <span>Trắng</span>
                    </button>
                    <button
                      onClick={() => {
                        setColorFilter("black");
                        setBoardOrientation("black");
                      }}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition flex items-center gap-1 ${colorFilter === "black" ? "bg-primary text-primary-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-slate-900 border border-slate-600 shadow-2xs" />
                      <span>Đen</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
                  <OpeningTreeTable
                    continuations={continuations}
                    totalGames={continuations.reduce((acc, c) => acc + c.games_count, 0)}
                    currentFen={currentFen}
                    onSelectMove={handleSelectMove}
                    onLoadGame={handleLoadSingleGame}
                    playerName={currentPlayerObj?.canonical_name}
                    players={players}
                    selectedPlayerId={selectedPlayerId || undefined}
                    onSelectPlayer={handlePlayerChange}
                    embedded={true}
                    isLoading={treeLoading || isProfileDataLoading}
                    isSandboxMode={workspaceStore.activeMode === "sandbox"}
                    isMultiMode={workspaceStore.activeMode === "multi"}
                  />
                </div>
              </div>
            )}

            {/* Mobile Tab 3: Thế trận Tốt */}
            {mobileTab === "structures" && (
              <div className="bg-card border border-border/60 rounded-surface p-3 sm:p-4 space-y-3">
                {selectedStructure ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-border/50">
                      <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                        <Compass className="w-4 h-4 text-primary" />
                        <span>{selectedStructure.name}</span>
                      </h4>
                      <button
                        onClick={() => setSelectedStructure(null)}
                        className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Đóng
                      </button>
                    </div>
                    {selectedStructure.strategic_plan && (
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <div>
                          <b className="text-emerald-700">Kế hoạch: </b>
                          <span>{selectedStructure.strategic_plan.ideas.join(" ")}</span>
                        </div>
                        <div>
                          <b className="text-rose-700">Đối ứng: </b>
                          <span>{selectedStructure.strategic_plan.counter_ideas.join(" ")}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : isProfileDataLoading ? (
                  <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p>Đang tải phân tích cấu trúc Tốt của kỳ thủ...</p>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground space-y-2">
                    <Compass className="w-8 h-8 text-primary/60 mx-auto" />
                    <p>Chưa có cấu trúc Tốt nào được chọn. Đi các nước cờ để hình thành cấu trúc Tốt hoặc chọn từ danh sách bên dưới.</p>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Tab 4: Ván đấu */}
            {mobileTab === "games" && (
              <div className="bg-card border border-border/60 rounded-surface p-3 sm:p-4 space-y-3">
                {selectedOpening ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <div className="font-bold text-xs text-foreground truncate">
                        Khai cuộc: <span className="text-primary">{selectedOpening}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                        {isProfileDataLoading && playerGames.length === 0 ? "Đang tải..." : `${matchingOpeningGames.length} ván`}
                      </span>
                    </div>
                    {isProfileDataLoading && playerGames.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <p>Đang tải danh sách ván đấu khai cuộc...</p>
                      </div>
                    ) : (
                      <div className="max-h-[360px] overflow-y-auto space-y-1.5">
                        {matchingOpeningGames.slice(0, 40).map((g, idx) => (
                          <div
                            key={g.id || idx}
                            className="flex items-center justify-between p-2 rounded-control bg-secondary/40 hover:bg-secondary/70 border border-border/40 text-xs"
                          >
                            <div className="truncate min-w-0 pr-2">
                              <div className="font-semibold text-foreground truncate">
                                {g.white_player} vs {g.black_player}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                Kết quả: {g.result || "*"} • ECO: {g.eco || "N/A"}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleLoadOpeningGame(g)}
                              className="px-2.5 py-1 rounded bg-primary text-primary-foreground font-bold text-[11px] shrink-0 active:scale-95 transition cursor-pointer"
                            >
                              Xem ván
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground space-y-2">
                    <BookOpen className="w-8 h-8 text-primary/60 mx-auto" />
                    <p>Hãy chọn một khai cuộc từ Cây khai cuộc để xem danh sách các ván đấu tương ứng.</p>
                  </div>
                )}
              </div>
            )}
          </div>

      {/* MODE A: OPENING GAMES LIST PANEL (Chỉ hiển thị trên desktop vì mobile/tablet đã có sub-tab ván đấu riêng) */}
      {isOpeningActive && !isStructureActive && (
        <div className="hidden lg:block bg-card border border-border/60 rounded-surface p-4 sm:p-5 space-y-3.5 animate-fade-in">
          {/* Header & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30 pb-3">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Danh sách ván đấu khai cuộc {selectedOpening} ({matchingOpeningGames.length} ván)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bấm <b>"Xem ván"</b> để nạp toàn bộ nước đi lên bàn cờ và nhảy ngay tới thế cờ hình thành khai cuộc.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm đối thủ, ECO..."
                value={openingSearch}
                onChange={(e) => setOpeningSearch(e.target.value)}
                className="w-full bg-secondary/40 border border-border/50 rounded-control pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setOpeningFilter("all")}
              className={`px-2.5 py-1 rounded-control text-xs font-medium transition cursor-pointer ${
                openingFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              Tất cả ({matchingOpeningGames.length})
            </button>
            <button
              onClick={() => setOpeningFilter("wins")}
              className={`px-2.5 py-1 rounded-control text-xs font-medium transition cursor-pointer ${
                openingFilter === "wins"
                  ? "bg-emerald-600 text-white"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              Thắng ({openingStats.wins})
            </button>
            <button
              onClick={() => setOpeningFilter("draws")}
              className={`px-2.5 py-1 rounded-control text-xs font-medium transition cursor-pointer ${
                openingFilter === "draws"
                  ? "bg-amber-600 text-white"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              Hòa ({openingStats.draws})
            </button>
            <button
              onClick={() => setOpeningFilter("losses")}
              className={`px-2.5 py-1 rounded-control text-xs font-medium transition cursor-pointer ${
                openingFilter === "losses"
                  ? "bg-rose-600 text-white"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              Thua ({openingStats.losses})
            </button>
          </div>

          {/* Games Table */}
          <div className="overflow-x-auto border border-border/60 rounded-table">
            <table className="data-table w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-semibold">
                <tr>
                  <th className="px-3.5 py-2.5">#</th>
                  <th className="px-3.5 py-2.5">Trắng vs Đen</th>
                  <th className="px-3.5 py-2.5">Khai cuộc / Kết quả</th>
                  <th className="px-3.5 py-2.5 text-center">Số nước / Ngày</th>
                  <th className="px-3.5 py-2.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredOpeningGames.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      {isProfileDataLoading && playerGames.length === 0 ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          <span>Đang tải danh sách ván đấu khai cuộc của kỳ thủ...</span>
                        </span>
                      ) : (
                        "Không có ván đấu nào khớp với bộ lọc."
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredOpeningGames.map((g, idx) => {
                    const isCurrent = activeOpeningGameId === g.id;
                    const outcome = getGamePlayerOutcome(g, currentPlayerObj?.canonical_name);

                    let resBadge = <span className="text-muted-foreground font-mono tabular-nums">{g.result}</span>;
                    if (outcome.isWin) {
                      resBadge = (
                        <span className="px-1.5 py-0.5 rounded-tag text-xs font-semibold border border-emerald-200 bg-emerald-50 text-emerald-800">
                          {g.result} (Thắng)
                        </span>
                      );
                    } else if (outcome.isDraw) {
                      resBadge = (
                        <span className="px-1.5 py-0.5 rounded-tag text-xs font-semibold border border-slate-200 bg-slate-100 text-slate-700">
                          {g.result} (Hòa)
                        </span>
                      );
                    } else if (outcome.isLoss) {
                      resBadge = (
                        <span className="px-1.5 py-0.5 rounded-tag text-xs font-semibold border border-rose-200 bg-rose-50 text-rose-800">
                          {g.result} (Thua)
                        </span>
                      );
                    }

                    const movesCount = g.ply_count
                      ? Math.ceil(g.ply_count / 2)
                      : parseSanMoves(g.moves_san).length
                      ? Math.ceil(parseSanMoves(g.moves_san).length / 2)
                      : null;

                    const formattedDate = g.played_at
                      ? new Date(g.played_at).toLocaleDateString("vi-VN")
                      : g.raw_headers?.Date && g.raw_headers.Date !== "????.??.??"
                      ? g.raw_headers.Date
                      : null;

                    return (
                      <tr
                        key={g.id || idx}
                        className={`transition ${isCurrent ? "bg-emerald-50 text-emerald-950 font-semibold" : "hover:bg-muted/50"}`}
                      >
                        <td className="px-3.5 py-2 font-mono tabular-nums text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="px-3.5 py-2">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <span className="w-2 h-2 rounded-full bg-white border border-slate-300 shrink-0" />
                            <span>{g.white_player}</span>
                            {g.white_elo ? (
                              <span className="text-[10px] text-muted-foreground font-normal font-mono tabular-nums">({g.white_elo})</span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-slate-900 border border-slate-700 shrink-0" />
                            <span>{g.black_player}</span>
                            {g.black_elo ? (
                              <span className="text-[10px] text-muted-foreground font-normal font-mono tabular-nums">({g.black_elo})</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3.5 py-2">
                          <div className="text-muted-foreground truncate max-w-[240px]">
                            {g.eco ? <b className="text-foreground font-mono mr-1">[{g.eco}]</b> : null}
                            {g.opening_name || selectedOpening}
                          </div>
                          <div className="mt-0.5">{resBadge}</div>
                        </td>
                        <td className="px-3.5 py-2 text-center">
                          {movesCount ? (
                            <span className="font-mono text-xs px-2 py-0.5 rounded-tag bg-secondary text-foreground tabular-nums">
                              {movesCount} nước
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">--</span>
                          )}
                          {formattedDate && (
                            <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                              {formattedDate}
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-2 text-right">
                          <button
                            onClick={() => handleLoadOpeningGame(g)}
                            disabled={isCurrent}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-control text-xs font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${
                              isCurrent
                                ? "bg-emerald-600 text-white cursor-default"
                                : "bg-secondary text-secondary-foreground hover:bg-emerald-600 hover:text-white"
                            }`}
                          >
                            {isCurrent ? (
                              <>
                                <Check className="w-3 h-3" />
                                Đang xem
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3" />
                                Xem ván
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODE B: STRUCTURE GAMES LIST PANEL (Chỉ hiển thị trên desktop vì mobile/tablet đã có sub-tab cấu trúc riêng) */}
      {isStructureActive && selectedStructure && (
        <div className="hidden lg:block bg-card border border-border/60 rounded-surface p-4 sm:p-5 space-y-3.5 animate-fade-in">
          {/* Header & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/30 pb-3">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Danh sách ván đấu có cấu trúc {selectedStructure.name} ({selectedStructure.games?.length || selectedStructure.games_count} ván)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bấm <b>"Xem ván"</b> để nạp toàn bộ nước đi lên bàn cờ và nhảy ngay tới nước hình thành cấu trúc Tốt (Nước {selectedStructure.typical_formation_move || 12}).
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm đối thủ, khai cuộc..."
                value={structureSearch}
                onChange={(e) => setStructureSearch(e.target.value)}
                className="w-full bg-secondary/40 border border-border/50 rounded-control pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setStructureFilter("all")}
              className={`px-2.5 py-1 rounded-control text-xs font-medium transition cursor-pointer ${
                structureFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              Tất cả ({selectedStructure.games?.length || 0})
            </button>
            <button
              onClick={() => setStructureFilter("wins")}
              className={`px-2.5 py-1 rounded-control text-xs font-medium transition cursor-pointer ${
                structureFilter === "wins"
                  ? "bg-emerald-600 text-white"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              Thắng ({selectedStructure.wins})
            </button>
            <button
              onClick={() => setStructureFilter("draws")}
              className={`px-2.5 py-1 rounded-control text-xs font-medium transition cursor-pointer ${
                structureFilter === "draws"
                  ? "bg-amber-600 text-white"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              Hòa ({selectedStructure.draws})
            </button>
            <button
              onClick={() => setStructureFilter("losses")}
              className={`px-2.5 py-1 rounded-control text-xs font-medium transition cursor-pointer ${
                structureFilter === "losses"
                  ? "bg-rose-600 text-white"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              Thua ({selectedStructure.losses})
            </button>
          </div>

          {/* Games Table */}
          <div className="overflow-x-auto border border-border/60 rounded-table">
            <table className="data-table w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-semibold">
                <tr>
                  <th className="px-3.5 py-2.5">#</th>
                  <th className="px-3.5 py-2.5">Trắng vs Đen</th>
                  <th className="px-3.5 py-2.5">Khai cuộc / Kết quả</th>
                  <th className="px-3.5 py-2.5 text-center">Nước hình thành</th>
                  <th className="px-3.5 py-2.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredStructureGames.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted-foreground">
                      Không có ván đấu nào khớp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredStructureGames.map((g, idx) => {
                    const isCurrent = activeStructureGameIdx === (g.game_index ?? idx);

                    let resBadge = <span className="text-muted-foreground font-mono tabular-nums">{g.result}</span>;
                    if (g.is_win) {
                      resBadge = (
                        <span className="px-1.5 py-0.5 rounded-tag text-xs font-semibold border border-emerald-200 bg-emerald-50 text-emerald-800">
                          {g.result} (Thắng)
                        </span>
                      );
                    } else if (g.is_draw) {
                      resBadge = (
                        <span className="px-1.5 py-0.5 rounded-tag text-xs font-semibold border border-slate-200 bg-slate-100 text-slate-700">
                          {g.result} (Hòa)
                        </span>
                      );
                    } else if (g.is_loss) {
                      resBadge = (
                        <span className="px-1.5 py-0.5 rounded-tag text-xs font-semibold border border-rose-200 bg-rose-50 text-rose-800">
                          {g.result} (Thua)
                        </span>
                      );
                    }

                    return (
                      <tr
                        key={idx}
                        className={`transition ${isCurrent ? "bg-emerald-50 text-emerald-950 font-semibold" : "hover:bg-muted/50"}`}
                      >
                        <td className="px-3.5 py-2 font-mono tabular-nums text-muted-foreground">
                          {g.game_index !== undefined ? g.game_index + 1 : idx + 1}
                        </td>
                        <td className="px-3.5 py-2">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <span className="w-2 h-2 rounded-full bg-white border border-slate-300 shrink-0" />
                            <span>{g.white}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-slate-900 border border-slate-700 shrink-0" />
                            <span>{g.black}</span>
                          </div>
                        </td>
                        <td className="px-3.5 py-2">
                          <div className="text-muted-foreground truncate max-w-[220px]">
                            {g.opening || "Khai cuộc không xác định"}
                          </div>
                          <div className="mt-0.5">{resBadge}</div>
                        </td>
                        <td className="px-3.5 py-2 text-center">
                          <span className="font-mono text-xs px-2 py-0.5 rounded-tag bg-secondary text-foreground tabular-nums">
                            Nước {g.formation_move || "?"}
                          </span>
                        </td>
                        <td className="px-3.5 py-2 text-right">
                          <button
                            onClick={() => handleLoadStructureGame(g, g.game_index ?? idx)}
                            disabled={isCurrent}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-control text-xs font-medium transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${
                              isCurrent
                                ? "bg-emerald-600 text-white cursor-default"
                                : "bg-secondary text-secondary-foreground hover:bg-emerald-600 hover:text-white"
                            }`}
                          >
                            {isCurrent ? (
                              <>
                                <Check className="w-3 h-3" />
                                Đang xem
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3" />
                                Xem ván
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!selectedStructure && isStructureActive && isProfileDataLoading && (
        <div className="hidden lg:flex bg-card border border-border/60 rounded-surface p-6 items-center justify-center gap-2.5 text-xs text-muted-foreground animate-fade-in">
          <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
          <span>Đang tải danh sách các ván đấu thực tế có cấu trúc <b className="text-foreground">{queryStructure}</b>...</span>
        </div>
      )}

      {/* Custom PGN / FEN Modal */}
      {showPgnInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-card rounded-surface max-w-lg w-full p-5 shadow-xl space-y-3.5 animate-scale-in">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Tải PGN hoặc FEN vào Bàn cờ
            </h3>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Dán chuỗi PGN
              </label>
              <textarea
                rows={5}
                value={inputPgn}
                onChange={(e) => setInputPgn(e.target.value)}
                placeholder="1. e4 e5 2. Nf3 Nc6 3. Bb5 a6..."
                className="w-full bg-background border border-border/60 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary/60"
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/40">
              <button
                onClick={() => setShowPgnInput(false)}
                className="px-3.5 py-1.5 rounded border border-border/60 text-muted-foreground hover:text-foreground text-xs font-medium transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleLoadCustomPgn}
                className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition cursor-pointer"
              >
                Tải vào Bàn cờ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating AI Chat Copilot Widget (Context-aware on Board & Players) */}
      <FloatingAiChatWidget
        currentFen={currentFen}
        currentPly={currentPly}
        evaluation={evaluation}
        gameInfo={gameInfo}
        effectivePlayerId={effectivePlayerId}
        playerName={workspaceStore.activePlayer?.canonical_name || cachedProfile?.player?.canonical_name || undefined}
        moves={moves}
      />
    </div>
  );
}

export default function AnalyzeView() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          <p className="text-sm text-muted-foreground font-medium">Đang tải bàn cờ phân tích...</p>
        </div>
      }
    >
      <AnalyzeContent />
    </Suspense>
  );
}
