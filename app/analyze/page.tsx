"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { 
  Play, 
  RotateCw, 
  Layers, 
  Cpu, 
  Upload, 
  FileText, 
  ArrowLeft, 
  Share2, 
  Info,
  CheckCircle2,
  Loader2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  User
} from "lucide-react";
import Link from "next/link";
import ChessBoard from "@/components/chess/ChessBoard";
import MoveHistory from "@/components/chess/MoveHistory";
import OpeningTreeTable from "@/components/analysis/OpeningTreeTable";
import { apiClient } from "@/lib/api/client";
import { Game, OpeningContinuation, Player } from "@/lib/api/types";

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const queryGameId = searchParams.get("gameId");
  const queryPlayerId = searchParams.get("playerId");
  const queryRunId = searchParams.get("runId");
  const queryOpening = searchParams.get("opening");
  const queryMove = searchParams.get("move");

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

  // Dynamic Opening Tree Continuations
  const [continuations, setContinuations] = useState<OpeningContinuation[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);

  // Custom PGN modal
  const [showPgnInput, setShowPgnInput] = useState(false);
  const [inputPgn, setInputPgn] = useState("");

  // 1. Fetch available players
  useEffect(() => {
    apiClient.getPlayers().then((list) => {
      setPlayers(list);
      if (list.length > 0 && !selectedPlayerId) {
        const defaultP = list[0];
        setSelectedPlayerId(defaultP.id);
        setActiveRunId(queryRunId || defaultP.id);
      }
    }).catch((err) => {
      console.warn("Failed to load players:", err);
    });
  }, [queryRunId, selectedPlayerId]);

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
        }
      }).catch((err) => console.warn("Failed to load game:", err));
    }
  }, [queryGameId]);

  // 2b. Auto-play initial move if queryMove is present
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

  // Handle Player Switch
  const handlePlayerChange = (newPlayerId: string) => {
    setSelectedPlayerId(newPlayerId);
    setActiveRunId(newPlayerId);
    // Reset board to initial position
    setMoves([]);
    setCurrentPly(0);
    setCurrentFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    setGameInfo(null);
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

  // Lichess URL for current position
  const lichessAnalysisUrl = `https://lichess.org/analysis/standard/${currentFen.replace(/ /g, "_")}`;

  const currentPlayerObj = players.find((p) => p.id === selectedPlayerId);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
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
              height={480}
            />

            {/* Quick Board Utilities Bar */}
            <div className="mt-4 pt-3 border-t border-border/40 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBoardOrientation((prev) => (prev === "white" ? "black" : "white"))}
                  className="px-3 py-1.5 rounded-xl border border-border/60 hover:bg-secondary text-foreground font-semibold flex items-center gap-1.5 transition"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Xoay bàn ({boardOrientation === "white" ? "Trắng" : "Đen"})
                </button>
                <a
                  href={lichessAnalysisUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-secondary hover:bg-primary hover:text-primary-foreground font-semibold text-foreground flex items-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Phân tích trên Lichess
                </a>
              </div>

              {currentPlayerObj && (
                <Link
                  href={`/players/${currentPlayerObj.id}`}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  Xem Hồ sơ {currentPlayerObj.canonical_name} →
                </Link>
              )}
            </div>
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
          <div className="h-[240px]">
            <MoveHistory
              moves={moves}
              currentPly={currentPly}
              onSelectPly={(ply) => {
                setCurrentPly(ply);
              }}
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
              <span>🔄 Tất cả</span>
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
              <span>⚪ Cầm Trắng</span>
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
              <span>⚫ Cầm Đen</span>
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

