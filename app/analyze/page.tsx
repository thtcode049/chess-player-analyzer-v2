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
  Check
} from "lucide-react";
import Link from "next/link";
import ChessBoard from "@/components/chess/ChessBoard";
import MoveHistory from "@/components/chess/MoveHistory";
import OpeningTreeTable from "@/components/analysis/OpeningTreeTable";
import { apiClient } from "@/lib/api/client";
import { Game, OpeningContinuation, Player, PawnStructureItem, PawnStructureGame } from "@/lib/api/types";
import { EngineEvaluation } from "@/lib/stockfish/engineWorker";

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

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const queryGameId = searchParams.get("gameId");
  const queryPlayerId = searchParams.get("playerId");
  const queryRunId = searchParams.get("runId");
  const queryMove = searchParams.get("move");
  const queryStructure = searchParams.get("structure");
  const queryGameIdx = searchParams.get("gameIdx");

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
  const fetchTreeContinuations = useCallback((runId: string, fen: string, color: string) => {
    if (!runId) return;
    setTreeLoading(true);
    apiClient.getOpeningTreeBranch(runId, fen, color)
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
    if (targetRun) {
      fetchTreeContinuations(targetRun, currentFen, colorFilter);
    }
  }, [activeRunId, selectedPlayerId, currentFen, colorFilter, fetchTreeContinuations]);

  // 4. Fetch Analysis Run (Pawn Structures) and Player Games when selectedPlayerId changes
  useEffect(() => {
    const targetPlayer = queryPlayerId || selectedPlayerId;
    if (!targetPlayer) return;

    // Fetch analysis run for pawn structures
    apiClient.getAnalysisRun(targetPlayer)
      .then((run) => {
        const structs: PawnStructureItem[] = run?.pawn_structures_summary?.structures || [];
        setAvailableStructures(structs);

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

    // Fetch player's games list for full moves_san
    apiClient.getPlayerGames(targetPlayer, { pageSize: 500 })
      .then((res) => {
        if (res && res.items) {
          setPlayerGames(res.items);
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
  };

  // Position change from ChessBoard component
  const handlePositionChange = (fen: string, ply: number) => {
    setCurrentFen(fen);
    setCurrentPly(ply);
  };

  // Move list change from ChessBoard component (e.g. piece dropped)
  const handleMovesChange = (newMoves: string[], ply: number, fen: string) => {
    setMoves(newMoves);
    setCurrentPly(ply);
    setCurrentFen(fen);
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
    setGameInfo({
      id: "single_branch",
      dataset_id: "ds_branch",
      white_player: sg.white || "White",
      black_player: sg.black || "Black",
      white_elo: sg.white_elo,
      black_elo: sg.black_elo,
      result: sg.result || "*",
      eco: sg.eco || "",
      opening_name: sg.opening || "",
      moves_san: gMoves.join(" "),
      has_embedded_eval: false,
    });
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
        const targetPly = Math.min(Math.max(0, (formMove - 1) * 2), parsedMoves.length);

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

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Top Header & Context Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mr-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Bảng điều khiển
            </Link>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              ● Stockfish WASM Web Worker Active
            </span>
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight mt-1 flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-primary" />
            Phòng Phân Tích Thế Cờ Tương Tác
          </h1>
          {gameInfo ? (
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              Ván đấu: <b>{gameInfo.white_player}</b> ({gameInfo.white_elo || "?"}) vs <b>{gameInfo.black_player}</b> ({gameInfo.black_elo || "?"}) • Kết quả: <b className="text-primary">{gameInfo.result}</b> • Khai cuộc: <b>{gameInfo.opening_name || "---"}</b>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              Cây khai cuộc chống chuyển vị (Transposition-Safe EPD) • Phân tích trực tiếp trên trình duyệt.
            </p>
          )}
        </div>

        {/* Global Player Selector & PGN upload button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {players.length > 0 && (
            <div className="flex items-center gap-2 bg-card border border-border/60 rounded-xl px-3 py-1.5 shadow-sm">
              <User className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground">Kỳ thủ:</span>
              <select
                value={selectedPlayerId}
                onChange={(e) => handlePlayerChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer pr-2"
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id} className="bg-card text-foreground">
                    {p.canonical_name} ({p.total_games || 0} ván)
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => setShowPgnInput(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-border/60 hover:bg-card text-foreground transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            Dán PGN / FEN
          </button>
        </div>
      </div>

      {/* MODE B: STRUCTURE EXPLORER HEADER BANNER */}
      {selectedStructure && (
        <div className="bg-primary/10 border border-primary/30 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-primary uppercase tracking-wider">
                  Structure Explorer Mode
                </span>
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor: `${selectedStructure.assessment_color ?? "#94A3B8"}20`,
                    color: selectedStructure.assessment_color ?? "#94A3B8",
                  }}
                >
                  {selectedStructure.assessment_badge || "Cấu trúc Tốt"}
                </span>
              </div>
              <h2 className="text-xl font-black text-foreground mt-0.5">
                {selectedStructure.name}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Đang xem <b>{selectedStructure.games?.length || selectedStructure.games_count}</b> ván đấu thực tế có cấu trúc Tốt này • Hình thành quanh nước {selectedStructure.typical_formation_move || 12} • Điểm Bayes: <b>{(selectedStructure.adjusted_score_pct ?? selectedStructure.score_pct).toFixed(1)}%</b>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {availableStructures.length > 1 && (
              <div className="flex items-center gap-1.5 bg-card border border-border/60 rounded-xl px-2.5 py-1.5 shadow-sm">
                <span className="text-[11px] font-semibold text-muted-foreground">Đổi cấu trúc:</span>
                <select
                  value={selectedStructure.name}
                  onChange={(e) => {
                    const target = availableStructures.find((s) => s.name === e.target.value);
                    if (target) handleSelectStructure(target);
                  }}
                  className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer"
                >
                  {availableStructures.map((s) => (
                    <option key={s.name} value={s.name} className="bg-card text-foreground">
                      {s.name} ({s.games_count} ván)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleExitStructureExplorer}
              className="px-3.5 py-2 rounded-xl border border-border/60 hover:bg-secondary text-foreground text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Trở về Phân tích Thường
            </button>
          </div>
        </div>
      )}

      {/* Main Analysis Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive ChessBoard & Bottom Actions (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-card border border-border/60 rounded-3xl p-4 sm:p-6 shadow-sm">
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
              height={480}
            />

            {/* Player Profile Link */}
            {(gameInfo || currentPlayerObj) && (
              <div className="mt-3 pt-2.5 border-t border-border/40 flex flex-wrap items-center justify-end gap-3 text-xs">
                {gameInfo ? (
                  (() => {
                    const whiteP = players.find((p) => isPlayerNameMatch(p.canonical_name, gameInfo.white_player));
                    const blackP = players.find((p) => isPlayerNameMatch(p.canonical_name, gameInfo.black_player));
                    const matched = [whiteP, blackP].filter((p): p is Player => !!p);

                    if (matched.length > 0) {
                      return matched.map((p) => (
                        <Link
                          key={p.id}
                          href={`/players/${p.id}`}
                          className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          Xem Hồ sơ {p.canonical_name} →
                        </Link>
                      ));
                    }

                    if (queryPlayerId && currentPlayerObj) {
                      return (
                        <Link
                          href={`/players/${currentPlayerObj.id}`}
                          className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          Xem Hồ sơ {currentPlayerObj.canonical_name} →
                        </Link>
                      );
                    }

                    return null;
                  })()
                ) : (
                  currentPlayerObj && (
                    <Link
                      href={`/players/${currentPlayerObj.id}`}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      Xem Hồ sơ {currentPlayerObj.canonical_name} →
                    </Link>
                  )
                )}
              </div>
            )}
          </div>

          {/* Current FEN Bar */}
          <div className="bg-card/60 border border-border/40 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs shadow-sm">
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-muted-foreground uppercase text-[10px]">FEN:</span>
              <span className="font-mono text-foreground truncate select-all">
                {currentFen}
              </span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(currentFen);
                alert("Đã sao chép FEN vào clipboard!");
              }}
              className="px-2.5 py-1 rounded-lg bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground font-semibold text-[11px] whitespace-nowrap transition-all flex-shrink-0"
            >
              Sao chép
            </button>
          </div>
        </div>

        {/* Right Column: Move History & Continuations (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Move History Sheet */}
          <div className="h-[340px]">
            <MoveHistory
              moves={moves}
              currentPly={currentPly}
              onSelectPly={(ply) => {
                setCurrentPly(ply);
              }}
              currentFen={currentFen}
              evaluation={evaluation}
              isThinking={isThinking}
              isEngineEnabled={isEngineEnabled}
              onToggleEngine={() => setIsEngineEnabled((prev) => !prev)}
              multiPv={multiPv}
              onMultiPvChange={(count) => setMultiPv(count)}
            />
          </div>

          {/* Color Filter Controls */}
          <div className="flex items-center gap-2 p-1.5 bg-card/80 border border-border/60 rounded-2xl shadow-sm">
            <button
              onClick={() => setColorFilter("all")}
              className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                colorFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tất cả</span>
            </button>
            <button
              onClick={() => {
                setColorFilter("white");
                setBoardOrientation("white");
              }}
              className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                colorFilter === "white"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-300 dark:border-slate-500 shadow-2xs" />
              <span>Cầm Trắng</span>
            </button>
            <button
              onClick={() => {
                setColorFilter("black");
                setBoardOrientation("black");
              }}
              className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                colorFilter === "black"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-600 shadow-2xs" />
              <span>Cầm Đen</span>
            </button>
          </div>

          {/* Opening Continuations Tree Table */}
          <div className="relative">
            {treeLoading && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 rounded-2xl flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            )}
            <OpeningTreeTable
              continuations={continuations}
              totalGames={continuations.reduce((acc, c) => acc + c.games_count, 0)}
              onSelectMove={handleSelectMove}
              onLoadGame={handleLoadSingleGame}
            />
          </div>
        </div>
      </div>

      {/* MODE B: STRUCTURE GAMES LIST PANEL */}
      {selectedStructure && (
        <div className="bg-card border border-border/60 rounded-3xl p-6 shadow-sm space-y-4 animate-fade-in">
          {/* Header & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
            <div>
              <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Danh sách ván đấu có cấu trúc {selectedStructure.name} ({selectedStructure.games?.length || selectedStructure.games_count} ván)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bấm <b>"Xem ván"</b> để nạp toàn bộ nước đi lên bàn cờ và nhảy ngay tới nước hình thành cấu trúc Tốt (Nước {selectedStructure.typical_formation_move || 12}).
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm đối thủ, khai cuộc..."
                value={structureSearch}
                onChange={(e) => setStructureSearch(e.target.value)}
                className="w-full bg-secondary/50 border border-border/60 rounded-xl pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStructureFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                structureFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              Tất cả ({selectedStructure.games?.length || 0})
            </button>
            <button
              onClick={() => setStructureFilter("wins")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                structureFilter === "wins"
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              Ván Thắng ({selectedStructure.wins})
            </button>
            <button
              onClick={() => setStructureFilter("draws")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                structureFilter === "draws"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              Ván Hòa ({selectedStructure.draws})
            </button>
            <button
              onClick={() => setStructureFilter("losses")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                structureFilter === "losses"
                  ? "bg-rose-500 text-white shadow-sm"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              Ván Thua ({selectedStructure.losses})
            </button>
          </div>

          {/* Games Table */}
          <div className="overflow-x-auto border border-border/40 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Trắng vs Đen</th>
                  <th className="px-4 py-3">Khai cuộc / Kết quả</th>
                  <th className="px-4 py-3 text-center">Nước hình thành</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredStructureGames.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      Không có ván đấu nào khớp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredStructureGames.map((g, idx) => {
                    const isCurrent = activeStructureGameIdx === (g.game_index ?? idx);

                    let resBadge = <span className="text-muted-foreground">{g.result}</span>;
                    if (g.is_win) {
                      resBadge = (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          {g.result} (Thắng)
                        </span>
                      );
                    } else if (g.is_draw) {
                      resBadge = (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          {g.result} (Hòa)
                        </span>
                      );
                    } else if (g.is_loss) {
                      resBadge = (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          {g.result} (Thua)
                        </span>
                      );
                    }

                    return (
                      <tr
                        key={idx}
                        className={`transition ${isCurrent ? "bg-primary/5 font-medium" : "hover:bg-secondary/30"}`}
                      >
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {g.game_index !== undefined ? g.game_index + 1 : idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            <span className="w-2 h-2 rounded-full bg-white border border-slate-300 dark:border-slate-500 shrink-0" />
                            <span>{g.white}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-slate-900 border border-slate-700 shrink-0" />
                            <span>{g.black}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-muted-foreground truncate max-w-[220px]">
                            {g.opening || "Khai cuộc không xác định"}
                          </div>
                          <div className="mt-0.5">{resBadge}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-mono text-xs px-2.5 py-0.5 rounded-lg bg-secondary text-foreground">
                            Move {g.formation_move || "?"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleLoadStructureGame(g, g.game_index ?? idx)}
                            disabled={isCurrent}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition shadow-sm ${
                              isCurrent
                                ? "bg-emerald-500 text-white cursor-default"
                                : "bg-primary text-primary-foreground hover:bg-primary/90"
                            }`}
                          >
                            {isCurrent ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Đang xem
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5" />
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
          <div className="bg-card border border-border/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-scale-in">
            <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Tải PGN hoặc FEN vào Bàn cờ
            </h3>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Dán chuỗi PGN
              </label>
              <textarea
                rows={5}
                value={inputPgn}
                onChange={(e) => setInputPgn(e.target.value)}
                placeholder="1. e4 e5 2. Nf3 Nc6 3. Bb5 a6..."
                className="w-full bg-background border border-border/60 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/40">
              <button
                onClick={() => setShowPgnInput(false)}
                className="px-4 py-2 rounded-xl border border-border/60 text-muted-foreground hover:text-foreground text-xs font-medium"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleLoadCustomPgn}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-md"
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
