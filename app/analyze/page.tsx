"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
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
  ShieldAlert
} from "lucide-react";
import Link from "next/link";
import ChessBoard from "@/components/chess/ChessBoard";
import MoveHistory from "@/components/chess/MoveHistory";
import OpeningTreeTable from "@/components/analysis/OpeningTreeTable";
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

function parseSanMoves(movesSan?: string | null): string[] {
  if (!movesSan) return [];
  return movesSan
    .split(/\s+/)
    .map((t) => t.replace(/^\d+\.+/, "").trim())
    .filter((t) => t && !["1-0", "0-1", "1/2-1/2", "*"].includes(t));
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

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const queryGameId = searchParams.get("gameId");
  const queryPlayerId = searchParams.get("playerId");
  const queryRunId = searchParams.get("runId");
  const queryMove = searchParams.get("move");
  const queryStructure = searchParams.get("structure");
  const queryGameIdx = searchParams.get("gameIdx");
  const queryOpening = searchParams.get("opening");

  // Player & Run state
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(queryPlayerId || "");
  const [activeRunId, setActiveRunId] = useState<string>(queryRunId || queryPlayerId || "");
  const [colorFilter, setColorFilter] = useState<"all" | "white" | "black">("all");
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");

  // Chess board state
  const [moves, setMoves] = useState<string[]>([]);
  const [currentPly, setCurrentPly] = useState(0);
  const [currentFen, setCurrentFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [gameInfo, setGameInfo] = useState<Game | null>(null);
  const [evaluation, setEvaluation] = useState<EngineEvaluation | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isEngineEnabled, setIsEngineEnabled] = useState(true);
  const [multiPv, setMultiPv] = useState(3);

  // Dynamically synchronized board and panel size measured directly from ChessBoard DOM container
  const [boardSize, setBoardSize] = useState<number>(640);

  // Dynamic Opening Tree Continuations
  const [continuations, setContinuations] = useState<OpeningContinuation[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);

  // Structure Explorer Mode State
  const [availableStructures, setAvailableStructures] = useState<PawnStructureItem[]>([]);
  const [selectedStructure, setSelectedStructure] = useState<PawnStructureItem | null>(null);
  const [structureFilter, setStructureFilter] = useState<"all" | "wins" | "draws" | "losses">("all");
  const [structureSearch, setStructureSearch] = useState<string>("");
  const [playerGames, setPlayerGames] = useState<Game[]>([]);
  const [activeStructureGameIdx, setActiveStructureGameIdx] = useState<number | null>(null);

  // Opening Explorer Mode State
  const [availableOpenings, setAvailableOpenings] = useState<OpeningRepertoireItem[]>([]);
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

  // 1. Fetch available players
  useEffect(() => {
    apiClient.getPlayers().then((list) => {
      setPlayers(list);
      if (list.length > 0) {
        if (queryPlayerId && list.some((p) => p.id === queryPlayerId)) {
          setSelectedPlayerId(queryPlayerId);
          setActiveRunId(queryRunId || queryPlayerId);
        } else if (!selectedPlayerId) {
          const defaultP = list[0];
          setSelectedPlayerId(defaultP.id);
          setActiveRunId(queryRunId || defaultP.id);
        }
      }
    }).catch((err) => {
      console.warn("Failed to load players:", err);
    });
  }, [queryRunId, queryPlayerId]);

  // 2. Load single game from gameId if passed
  useEffect(() => {
    if (queryGameId) {
      apiClient.getGame(queryGameId).then((g) => {
        if (g) {
          setGameInfo(g);
          if (g.moves_san) {
            // Clean move tokens
            const rawTokens = g.moves_san.split(" ");
            const parsedMoves = rawTokens
              .map((t) => t.replace(/^\d+\.+/, "").trim())
              .filter((t) => t && !["1-0", "0-1", "1/2-1/2", "*"].includes(t));
            setMoves(parsedMoves);
            setCurrentPly(0);
            setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
          }

          // Automatically match and select player from the game if queryPlayerId is not provided
          if (!queryPlayerId && players.length > 0) {
            const matchedPlayer = players.find((p) =>
              isPlayerNameMatch(p.canonical_name, g.white_player) ||
              isPlayerNameMatch(p.canonical_name, g.black_player)
            );
            if (matchedPlayer) {
              setSelectedPlayerId(matchedPlayer.id);
              setActiveRunId(matchedPlayer.id);
            }
          }
        }
      }).catch((err) => console.warn("Failed to load game:", err));
    }
  }, [queryGameId, queryPlayerId, players]);

  // 2b. Synchronize player matching if players list loaded after gameInfo
  useEffect(() => {
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

  // 3. Fetch real Opening Tree Continuations whenever FEN, activeRunId, or colorFilter changes
  const fetchTreeContinuations = useCallback((runId: string, fen: string, color: string, playerId?: string) => {
    if (!runId && !playerId) return;
    setTreeLoading(true);
    apiClient.getOpeningTreeBranch(runId || playerId || "", fen, color, playerId)
      .then((treeNode) => {
        if (treeNode && treeNode.continuations) {
          setContinuations(treeNode.continuations);
        } else {
          setContinuations([]);
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch tree branch:", err);
        setContinuations([]);
      })
      .finally(() => setTreeLoading(false));
  }, []);

  useEffect(() => {
    const targetRun = activeRunId || selectedPlayerId;
    const targetPlayer = selectedPlayerId || queryPlayerId || undefined;
    if (targetRun || targetPlayer) {
      fetchTreeContinuations(targetRun, currentFen, colorFilter, targetPlayer);
    }
  }, [activeRunId, selectedPlayerId, queryPlayerId, currentFen, colorFilter, fetchTreeContinuations]);

  // 4. Fetch Analysis Run (Pawn Structures) and Player Games when selectedPlayerId changes
  useEffect(() => {
    const targetPlayer = queryPlayerId || selectedPlayerId;
    if (!targetPlayer) return;

    // Fetch analysis run for pawn structures and instant opening continuations
    apiClient.getAnalysisRun(targetPlayer)
      .then((run) => {
        if (run?.id) {
          setActiveRunId(run.id);
        }
        if (run?.opening_tree_snapshot?.continuations && run.opening_tree_snapshot.continuations.length > 0 && moves.length === 0 && colorFilter === "all") {
          setContinuations(run.opening_tree_snapshot.continuations);
        }
        const structs: PawnStructureItem[] = run?.pawn_structures_summary?.structures || [];
        setAvailableStructures(structs);

        const repOpenings: OpeningRepertoireItem[] = run?.repertoire_summary?.all_openings || [];
        setAvailableOpenings(repOpenings);

        if (queryStructure) {
          const matched = structs.find((s) =>
            s.name.toLowerCase().trim() === queryStructure.toLowerCase().trim() ||
            (s.structure_key && s.structure_key.toLowerCase() === queryStructure.toLowerCase().trim())
          );
          if (matched) {
            setSelectedStructure(matched);
          }
        }
      })
      .catch((err) => console.warn("Failed to load run structures:", err));

    // Fetch player's games list for full moves_san (unlimited)
    apiClient.getPlayerGames(targetPlayer, { allGames: true, pageSize: 10000 })
      .then((res) => {
        if (res && res.items) {
          setPlayerGames(res.items);

          // Populate availableOpenings if run had empty repertoire
          setAvailableOpenings((prev) => {
            if (prev && prev.length > 0) return prev;
            const opMap: Record<string, number> = {};
            res.items.forEach((g) => {
              const name = g.opening_name || g.raw_headers?.Opening;
              if (name) opMap[name] = (opMap[name] || 0) + 1;
            });
            return Object.entries(opMap)
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => ({ name, games_count: count }));
          });
        }
      })
      .catch((err) => console.warn("Failed to load player games:", err));
  }, [selectedPlayerId, queryPlayerId, queryStructure]);

  // 4b. Sync selectedStructure if queryStructure changes
  useEffect(() => {
    if (queryStructure && availableStructures.length > 0) {
      const matched = availableStructures.find((s) =>
        s.name.toLowerCase().trim() === queryStructure.toLowerCase().trim() ||
        (s.structure_key && s.structure_key.toLowerCase() === queryStructure.toLowerCase().trim())
      );
      if (matched) {
        setSelectedStructure(matched);
      }
    } else if (!queryStructure) {
      setSelectedStructure(null);
    }
  }, [queryStructure, availableStructures]);

  // Handle Player Switch
  const handlePlayerChange = (newPlayerId: string) => {
    setSelectedPlayerId(newPlayerId);
    setActiveRunId(newPlayerId);
    // Reset board to initial position
    setMoves([]);
    setCurrentPly(0);
    setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    setGameInfo(null);
    setSelectedStructure(null);
    setActiveStructureGameIdx(null);
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

  // Position change from ChessBoard component
  const handlePositionChange = (fen: string, ply: number) => {
    setCurrentFen(fen);
    setCurrentPly(ply);
    checkOpeningTransition(moves.slice(0, ply));
  };

  // Move list change from ChessBoard component (e.g. piece dropped)
  const handleMovesChange = (newMoves: string[], ply: number, fen: string) => {
    setMoves(newMoves);
    setCurrentPly(ply);
    setCurrentFen(fen);
    checkOpeningTransition(newMoves.slice(0, ply));
  };

  // Select move from Opening Tree
  const handleSelectMove = (san: string) => {
    try {
      const chess = new Chess(currentFen);
      chess.move(san);
      const newFen = chess.fen();
      const updatedMoves = [...moves.slice(0, currentPly), san];
      setMoves(updatedMoves);
      setCurrentPly(updatedMoves.length);
      setCurrentFen(newFen);
      checkOpeningTransition(updatedMoves);
    } catch (e) {
      console.warn("Invalid move selected:", san, e);
    }
  };


  // Load a single game branch onto the board
  const handleLoadSingleGame = (sg: any) => {
    if (!sg || !sg.moves) return;
    const gMoves = sg.moves;
    setMoves(gMoves);
    setCurrentPly(0);
    setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    setGameInfo(null);
  };

  // Load a structure game onto the board
  const handleLoadStructureGame = (structGame: PawnStructureGame, indexInStruct: number) => {
    setActiveStructureGameIdx(indexInStruct);

    // Find the full Game object
    let fullGame: Game | undefined;
    if (structGame.id) {
      fullGame = playerGames.find((pg) => pg.id === structGame.id);
    }
    if (!fullGame && structGame.game_index !== undefined && playerGames[structGame.game_index]) {
      fullGame = playerGames[structGame.game_index];
    }
    if (!fullGame) {
      fullGame = playerGames.find((pg) =>
        isPlayerNameMatch(pg.white_player, structGame.white) &&
        isPlayerNameMatch(pg.black_player, structGame.black) &&
        pg.result === structGame.result
      );
    }

    const applyGameMoves = (targetGame: Game) => {
      setGameInfo(targetGame);
      if (targetGame.moves_san) {
        const rawTokens = targetGame.moves_san.split(" ");
        const parsedMoves = rawTokens
          .map((t) => t.replace(/^\d+\.+/, "").trim())
          .filter((t) => t && !["1-0", "0-1", "1/2-1/2", "*"].includes(t));

        setMoves(parsedMoves);

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
    };

    if (fullGame) {
      applyGameMoves(fullGame);
    } else if (structGame.id) {
      apiClient.getGame(structGame.id).then((g) => {
        if (g) applyGameMoves(g);
      }).catch((err) => console.warn("Could not fetch full structure game:", err));
    }
  };

  // Auto-load game if queryGameIdx is in URL
  useEffect(() => {
    if (queryGameIdx && selectedStructure?.games && selectedStructure.games.length > 0 && playerGames.length > 0) {
      const idxNum = parseInt(queryGameIdx, 10);
      const targetG = selectedStructure.games.find((g) => g.game_index === idxNum) || selectedStructure.games[idxNum];
      if (targetG) {
        handleLoadStructureGame(targetG, targetG.game_index ?? idxNum);
      }
    }
  }, [queryGameIdx, selectedStructure, playerGames]);

  // Exit Structure Explorer Mode
  const handleExitStructureExplorer = () => {
    setSelectedStructure(null);
    setActiveStructureGameIdx(null);
    const params = new URLSearchParams(window.location.search);
    params.delete("structure");
    params.delete("gameIdx");
    const newQuery = params.toString();
    router.replace(newQuery ? `/analyze?${newQuery}` : `/analyze`);
  };

  // Switch Structure in Explorer Mode
  const handleSelectStructure = (struct: PawnStructureItem) => {
    setSelectedStructure(struct);
    setActiveStructureGameIdx(null);
    const params = new URLSearchParams(window.location.search);
    params.set("structure", struct.name);
    params.delete("gameIdx");
    router.replace(`/analyze?${params.toString()}`);
  };

  // Handle Custom PGN Input
  const handleLoadCustomPgn = () => {
    if (!inputPgn.trim()) return;
    try {
      const chess = new Chess();
      chess.loadPgn(inputPgn);
      const history = chess.history();
      setMoves(history);
      setCurrentPly(0);
      setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
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

  const currentPlayerObj = players.find((p) => p.id === selectedPlayerId);

  // Synchronize Opening Explorer with queryOpening or newly arrived playerGames
  useEffect(() => {
    if (!queryOpening) {
      if (selectedOpening !== null && loadedOpeningRef.current !== null) {
        setSelectedOpening(null);
        setActiveOpeningGameId(null);
        setOpeningRepresentativeLine([]);
        loadedOpeningRef.current = null;
      }
      return;
    }

    // Bypass resetting board moves when transition was triggered by user playing moves
    if (isAutoTransitionRef.current) {
      isAutoTransitionRef.current = false;
      loadedOpeningRef.current = queryOpening;
      return;
    }

    const gamesJustArrived = playerGames.length > 0 && lastGamesCountRef.current === 0;
    lastGamesCountRef.current = playerGames.length;

    // Load or refine opening formation
    if (loadedOpeningRef.current !== queryOpening || gamesJustArrived) {
      setSelectedOpening(queryOpening);
      setActiveOpeningGameId(null);

      const matchingGames = playerGames.filter((g) => isOpeningMatch(g, queryOpening));

      // 1. Ưu tiên hàng đầu: Nạp trực tiếp thế cờ chuẩn (Canonical Moves & FEN) từ Lichess Openings
      const canonical = getCanonicalOpeningByName(queryOpening);
      let line = canonical ? canonical.moves : [];

      // 2. Nếu chưa có trong từ điển chuẩn, fallback suy luận từ nhóm ván đấu của kỳ thủ
      if (line.length === 0) {
        line = findRepresentativeLineForGames(matchingGames, queryOpening);
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
      setGameInfo(null);

      // Async fallback to Lichess Openings API (3,865 ECO entries) if local line was empty
      if (line.length === 0) {
        apiClient.getCanonicalOpening(queryOpening)
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
            }
          })
          .catch(() => {});
      }

      // Determine orientation based on player games or defense naming
      if (matchingGames.length > 0 && currentPlayerObj?.canonical_name) {
        const outcomes = matchingGames.map((g) => getGamePlayerOutcome(g, currentPlayerObj.canonical_name));
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
        const opLower = queryOpening.toLowerCase();
        if (opLower.includes("defense") || opLower.includes("defence") || opLower.includes("counter")) {
          setBoardOrientation("black");
          setColorFilter("black");
        } else {
          setBoardOrientation("white");
          setColorFilter("white");
        }
      }

      loadedOpeningRef.current = queryOpening;
    }
  }, [queryOpening, playerGames, currentPlayerObj?.canonical_name, selectedOpening]);

  // Switch opening in Explorer Mode
  const handleSelectOpening = (opName: string) => {
    setSelectedOpening(opName);
    setActiveOpeningGameId(null);
    loadedOpeningRef.current = null;
    const params = new URLSearchParams(window.location.search);
    params.set("opening", opName);
    params.delete("structure");
    params.delete("gameIdx");
    router.replace(`/analyze?${params.toString()}`);
  };

  // Exit opening Explorer Mode
  const handleExitOpeningExplorer = () => {
    setSelectedOpening(null);
    setActiveOpeningGameId(null);
    setOpeningRepresentativeLine([]);
    loadedOpeningRef.current = null;
    const params = new URLSearchParams(window.location.search);
    params.delete("opening");
    const newQuery = params.toString();
    router.replace(newQuery ? `/analyze?${newQuery}` : `/analyze`);
  };

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
    return playerGames.filter((g) => isOpeningMatch(g, selectedOpening));
  }, [playerGames, selectedOpening]);

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

  return (
    <div className="w-full max-w-[1720px] mx-auto animate-fade-in pb-4 -mt-3 sm:-mt-6 space-y-4">

      {/* MODE A: OPENING EXPLORER HEADER BANNER */}
      {selectedOpening && !selectedStructure && (
        <div className="bg-card/70 border border-border/50 rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-primary uppercase tracking-wide">
                  Khám phá Khai cuộc
                </span>
                {currentOpeningItem?.assessment_badge && (
                  <span
                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                    style={{
                      backgroundColor: `${currentOpeningItem.assessment_color ?? "#94A3B8"}15`,
                      color: currentOpeningItem.assessment_color ?? "#94A3B8",
                      borderColor: `${currentOpeningItem.assessment_color ?? "#94A3B8"}30`
                    }}
                  >
                    {currentOpeningItem.assessment_badge}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-foreground">
                {selectedOpening}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Đang xem <b>{matchingOpeningGames.length}</b> ván thực tế •{" "}
                {currentOpeningItem?.adjusted_score_pct !== undefined && (
                  <>Điểm Bayes: <b>{currentOpeningItem.adjusted_score_pct.toFixed(1)}%</b> • </>
                )}
                Thắng: <b className="text-emerald-500">{openingStats.wins}</b> •{" "}
                Hòa: <b className="text-amber-500">{openingStats.draws}</b> •{" "}
                Thua: <b className="text-rose-500">{openingStats.losses}</b>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {availableOpenings.length > 1 && (
              <div className="flex items-center gap-1.5 bg-card border border-border/50 rounded-lg px-2.5 py-1 text-xs">
                <span className="text-[11px] text-muted-foreground">Khai cuộc:</span>
                <select
                  value={selectedOpening}
                  onChange={(e) => handleSelectOpening(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                >
                  {availableOpenings.map((op) => (
                    <option key={op.name} value={op.name} className="bg-card text-foreground">
                      {op.name} ({op.games_count} ván)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleExitOpeningExplorer}
              className="px-3 py-1.5 rounded-lg border border-border/50 hover:bg-secondary text-foreground text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Thoát chế độ
            </button>
          </div>
        </div>
      )}

      {/* MODE B: STRUCTURE EXPLORER HEADER BANNER */}
      {selectedStructure && (
        <div className="bg-card/70 border border-border/50 rounded-xl px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-primary uppercase tracking-wide">
                  Khám phá Cấu trúc Tốt
                </span>
                <span
                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                  style={{
                    backgroundColor: `${selectedStructure.assessment_color ?? "#94A3B8"}15`,
                    color: selectedStructure.assessment_color ?? "#94A3B8",
                    borderColor: `${selectedStructure.assessment_color ?? "#94A3B8"}30`
                  }}
                >
                  {selectedStructure.assessment_badge || "Cấu trúc Tốt"}
                </span>
              </div>
              <h2 className="text-base font-bold text-foreground">
                {selectedStructure.name}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Đang xem <b>{selectedStructure.games?.length || selectedStructure.games_count}</b> ván thực tế • Nước hình thành ~{selectedStructure.typical_formation_move || 12} • Điểm Bayes: <b>{(selectedStructure.adjusted_score_pct ?? selectedStructure.score_pct).toFixed(1)}%</b>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {availableStructures.length > 1 && (
              <div className="flex items-center gap-1.5 bg-card border border-border/50 rounded-lg px-2.5 py-1 text-xs">
                <span className="text-[11px] text-muted-foreground">Cấu trúc:</span>
                <select
                  value={selectedStructure.name}
                  onChange={(e) => {
                    const target = availableStructures.find((s) => s.name === e.target.value);
                    if (target) handleSelectStructure(target);
                  }}
                  className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                >
                  {(() => {
                    const groupB = availableStructures.filter(
                      (s) => s.group === "B" || ["Carlsbad", "Maroczy_Bind", "Hedgehog", "Stonewall"].includes(s.structure_key || "")
                    );
                    const groupA = availableStructures.filter(
                      (s) => s.group === "A" || !["Carlsbad", "Maroczy_Bind", "Hedgehog", "Stonewall"].includes(s.structure_key || "")
                    );
                    return (
                      <>
                        {groupB.length > 0 && (
                          <optgroup label="Nhóm B — Cấu trúc chiến lược kinh điển" className="bg-card text-foreground font-bold">
                            {groupB.map((s) => (
                              <option key={s.name} value={s.name} className="bg-card text-foreground font-normal">
                                {s.name} ({s.games_count} ván)
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {groupA.length > 0 && (
                          <optgroup label="Nhóm A — Cấu trúc nền tảng & Trung tâm" className="bg-card text-foreground font-bold">
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

            <button
              onClick={handleExitStructureExplorer}
              className="px-3 py-1.5 rounded-lg border border-border/50 hover:bg-secondary text-foreground text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Thoát chế độ
            </button>
          </div>
        </div>
      )}

      {/* Strategic Plan Guidance Banner when structure is selected */}
      {selectedStructure && selectedStructure.strategic_plan && (
        <div className="bg-card/60 border border-border/50 rounded-xl px-4 py-2.5 text-xs shadow-2xs space-y-1.5 animate-fade-in">
          <div className="flex items-center gap-1.5 font-bold text-primary text-[11px] uppercase tracking-wide">
            <Compass className="w-3.5 h-3.5" />
            <span>Kế hoạch & Phương án Chiến lược Tham khảo ({selectedStructure.group === "B" ? "Nhóm B: Chiến lược" : "Nhóm A: Trung tâm"})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-muted-foreground">
            <div>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Kế hoạch: </span>
              <span>{selectedStructure.strategic_plan.ideas.join(" ")}</span>
            </div>
            <div>
              <span className="font-semibold text-rose-600 dark:text-rose-400">Đối ứng: </span>
              <span>{selectedStructure.strategic_plan.counter_ideas.join(" ")}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Analysis Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
        {/* Left Column: Interactive ChessBoard (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col items-center w-full">
          <ChessBoard
            initialFen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
            moves={moves}
            currentPly={currentPly}
            orientation={boardOrientation}
            onPositionChange={handlePositionChange}
            onMovesChange={handleMovesChange}
            onEvaluationChange={(ev, thinking) => {
              setEvaluation(ev);
              setIsThinking(thinking);
            }}
            isEngineEnabled={isEngineEnabled}
            multiPv={multiPv}
            height={720}
            onBoardWidthChange={(size) => setBoardSize(size)}
          />
        </div>

        {/* Right Column: Unified Move History & Opening Variations Panel (Like Lichess) */}
        <div
          style={{ height: `${boardSize}px`, minHeight: "500px" }}
          className="lg:col-span-5 flex flex-col bg-card border border-border/50 rounded-xl shadow-2xs overflow-hidden"
        >
          {/* Top: Move History (Notation + Stockfish Eval) - 50% equal height */}
          <div className="flex-1 min-h-0 border-b border-border/50 flex flex-col overflow-hidden">
            <MoveHistory
              moves={moves}
              currentPly={currentPly}
              onSelectPly={(ply) => {
                setCurrentPly(ply);
                checkOpeningTransition(moves.slice(0, ply));
              }}
              currentFen={currentFen}
              evaluation={evaluation}
              isThinking={isThinking}
              isEngineEnabled={isEngineEnabled}
              onToggleEngine={() => setIsEngineEnabled((prev) => !prev)}
              multiPv={multiPv}
              onMultiPvChange={(count) => setMultiPv(count)}
              embedded={true}
            />
          </div>

          {/* Middle: Compact Color Filter / Perspective Toolbar */}
          <div className="px-3.5 py-1 bg-slate-50/80 dark:bg-slate-800/40 border-b border-border/50 flex items-center justify-between shrink-0 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground font-semibold text-[11px]">
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>Góc nhìn:</span>
            </div>
            <div className="flex items-center gap-1 p-0.5 bg-secondary/60 rounded-lg">
              <button
                onClick={() => setColorFilter("all")}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition ${colorFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => {
                  setColorFilter("white");
                  setBoardOrientation("white");
                }}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition flex items-center gap-1 ${colorFilter === "white"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
              >
                <span className="w-2 h-2 rounded-full bg-white border border-slate-300 dark:border-slate-500 shadow-2xs" />
                <span>Trắng</span>
              </button>
              <button
                onClick={() => {
                  setColorFilter("black");
                  setBoardOrientation("black");
                }}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition flex items-center gap-1 ${colorFilter === "black"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
              >
                <span className="w-2 h-2 rounded-full bg-slate-900 border border-slate-600 shadow-2xs" />
                <span>Đen</span>
              </button>
            </div>
          </div>

          {/* Bottom: Opening Continuations & Master Database - 50% equal height */}
          <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
            {treeLoading && (
              <div
                className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-primary to-blue-500 animate-pulse z-30 pointer-events-none"
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
              selectedPlayerId={selectedPlayerId}
              onSelectPlayer={handlePlayerChange}
              embedded={true}
            />
          </div>
        </div>
      </div>

      {/* Current FEN Bar & Action Buttons (Centered directly under the chessboard) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 pt-1">
        <div className="lg:col-span-7 flex flex-col items-center">
          <div
            style={{ width: `${boardSize + 22}px`, maxWidth: "100%" }}
            className="bg-card/60 border border-border/40 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs shadow-xs"
          >
            <div className="flex items-center gap-2 truncate min-w-0">
              <span className="font-bold text-muted-foreground uppercase text-[10px] shrink-0">FEN:</span>
              <span className="font-mono text-foreground truncate select-all text-[11px]">
                {currentFen}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(currentFen);
                  alert("Đã sao chép FEN vào clipboard!");
                }}
                className="px-2.5 py-1 rounded-lg bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground font-semibold text-[11px] whitespace-nowrap transition-all cursor-pointer"
                title="Sao chép FEN"
              >
                Sao chép
              </button>
              <button
                onClick={() => setShowPgnInput(true)}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white font-semibold text-[11px] whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer border border-emerald-500/20"
                title="Dán PGN hoặc FEN để nạp vào bàn cờ"
              >
                <Upload className="w-3 h-3" />
                <span>Dán PGN / FEN</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODE A: OPENING GAMES LIST PANEL */}
      {selectedOpening && !selectedStructure && (
        <div className="bg-card border border-border/50 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3.5 animate-fade-in">
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
                className="w-full bg-secondary/40 border border-border/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setOpeningFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                openingFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              Tất cả ({matchingOpeningGames.length})
            </button>
            <button
              onClick={() => setOpeningFilter("wins")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                openingFilter === "wins"
                  ? "bg-emerald-600 text-white"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              Thắng ({openingStats.wins})
            </button>
            <button
              onClick={() => setOpeningFilter("draws")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                openingFilter === "draws"
                  ? "bg-amber-600 text-white"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              Hòa ({openingStats.draws})
            </button>
            <button
              onClick={() => setOpeningFilter("losses")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                openingFilter === "losses"
                  ? "bg-rose-600 text-white"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              Thua ({openingStats.losses})
            </button>
          </div>

          {/* Games Table */}
          <div className="overflow-x-auto border border-border/40 rounded-lg">
            <table className="w-full text-left text-xs">
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
                      Không có ván đấu nào khớp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredOpeningGames.map((g, idx) => {
                    const isCurrent = activeOpeningGameId === g.id;
                    const outcome = getGamePlayerOutcome(g, currentPlayerObj?.canonical_name);

                    let resBadge = <span className="text-muted-foreground font-mono">{g.result}</span>;
                    if (outcome.isWin) {
                      resBadge = (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {g.result} (Thắng)
                        </span>
                      );
                    } else if (outcome.isDraw) {
                      resBadge = (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {g.result} (Hòa)
                        </span>
                      );
                    } else if (outcome.isLoss) {
                      resBadge = (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
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
                        className={`transition ${isCurrent ? "bg-primary/5 font-medium" : "hover:bg-secondary/20"}`}
                      >
                        <td className="px-3.5 py-2 font-mono text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="px-3.5 py-2">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <span className="w-2 h-2 rounded-full bg-white border border-slate-300 dark:border-slate-500 shrink-0" />
                            <span>{g.white_player}</span>
                            {g.white_elo ? (
                              <span className="text-[10px] text-muted-foreground font-normal font-mono">({g.white_elo})</span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-slate-900 border border-slate-700 shrink-0" />
                            <span>{g.black_player}</span>
                            {g.black_elo ? (
                              <span className="text-[10px] text-muted-foreground font-normal font-mono">({g.black_elo})</span>
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
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-secondary text-foreground">
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
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                              isCurrent
                                ? "bg-emerald-600 text-white cursor-default"
                                : "bg-primary text-primary-foreground hover:bg-primary/90"
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

      {/* MODE B: STRUCTURE GAMES LIST PANEL */}
      {selectedStructure && (
        <div className="bg-card border border-border/50 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3.5 animate-fade-in">
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
                className="w-full bg-secondary/40 border border-border/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setStructureFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                structureFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              Tất cả ({selectedStructure.games?.length || 0})
            </button>
            <button
              onClick={() => setStructureFilter("wins")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                structureFilter === "wins"
                  ? "bg-emerald-600 text-white"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              Thắng ({selectedStructure.wins})
            </button>
            <button
              onClick={() => setStructureFilter("draws")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                structureFilter === "draws"
                  ? "bg-amber-600 text-white"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              Hòa ({selectedStructure.draws})
            </button>
            <button
              onClick={() => setStructureFilter("losses")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                structureFilter === "losses"
                  ? "bg-rose-600 text-white"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              Thua ({selectedStructure.losses})
            </button>
          </div>

          {/* Games Table */}
          <div className="overflow-x-auto border border-border/40 rounded-lg">
            <table className="w-full text-left text-xs">
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

                    let resBadge = <span className="text-muted-foreground font-mono">{g.result}</span>;
                    if (g.is_win) {
                      resBadge = (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {g.result} (Thắng)
                        </span>
                      );
                    } else if (g.is_draw) {
                      resBadge = (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {g.result} (Hòa)
                        </span>
                      );
                    } else if (g.is_loss) {
                      resBadge = (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          {g.result} (Thua)
                        </span>
                      );
                    }

                    return (
                      <tr
                        key={idx}
                        className={`transition ${isCurrent ? "bg-primary/5 font-medium" : "hover:bg-secondary/20"}`}
                      >
                        <td className="px-3.5 py-2 font-mono text-muted-foreground">
                          {g.game_index !== undefined ? g.game_index + 1 : idx + 1}
                        </td>
                        <td className="px-3.5 py-2">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <span className="w-2 h-2 rounded-full bg-white border border-slate-300 dark:border-slate-500 shrink-0" />
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
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-secondary text-foreground">
                            Nước {g.formation_move || "?"}
                          </span>
                          {g.evidence && (
                            <div className="text-[10px] text-muted-foreground truncate max-w-[160px] mx-auto mt-0.5" title={g.evidence}>
                              {g.evidence}
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-2 text-right">
                          <button
                            onClick={() => handleLoadStructureGame(g, g.game_index ?? idx)}
                            disabled={isCurrent}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                              isCurrent
                                ? "bg-emerald-600 text-white cursor-default"
                                : "bg-primary text-primary-foreground hover:bg-primary/90"
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

      {/* Custom PGN / FEN Modal */}
      {showPgnInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-card border border-border/80 rounded-xl max-w-lg w-full p-5 shadow-xl space-y-3.5 animate-scale-in">
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
                className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary/60"
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/40">
              <button
                onClick={() => setShowPgnInput(false)}
                className="px-3.5 py-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground text-xs font-medium transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleLoadCustomPgn}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition shadow-xs cursor-pointer"
              >
                Tải vào Bàn cờ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Đang tải phòng phân tích...</p>
        </div>
      }
    >
      <AnalyzeContent />
    </Suspense>
  );
}
