"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Brain,
  Sparkles,
  RotateCcw,
  Send,
  Layers,
  Play,
  RotateCw,
  Eye,
  Database,
  ChevronDown,
  HelpCircle,
  TrendingUp,
  Cpu,
} from "lucide-react";
import ChessBoard from "@/components/chess/ChessBoard";
import AiCoachChat from "@/components/ai/AiCoachChat";
import { apiClient } from "@/lib/api/client";
import { Player, Game } from "@/lib/api/types";
import { EngineEvaluation } from "@/lib/stockfish/engineWorker";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export default function AiCoachPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [playerGames, setPlayerGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>("");

  // Board state
  const [currentFen, setCurrentFen] = useState<string>(START_FEN);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [currentPly, setCurrentPly] = useState<number>(0);
  const [activeMoves, setActiveMoves] = useState<string[]>([]);
  const [currentEval, setCurrentEval] = useState<EngineEvaluation | null>(null);
  const [isEngineThinking, setIsEngineThinking] = useState(false);

  // Reference to pass messages or trigger chat
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  // 1. Fetch Players on mount
  useEffect(() => {
    apiClient.getPlayers()
      .then((data) => {
        setPlayers(data || []);
        if (data && data.length > 0) {
          setSelectedPlayerId(data[0].id);
        }
      })
      .catch(() => {
        setSelectedPlayerId("00000000-0000-0000-0000-000000000001");
      });
  }, []);

  // 2. Fetch Player Games when selected player changes
  useEffect(() => {
    if (!selectedPlayerId) return;

    // Reset board to start
    setCurrentFen(START_FEN);
    setActiveMoves([]);
    setCurrentPly(0);
    setSelectedGameId("");

    apiClient.getPlayerGames(selectedPlayerId, { page: 1, pageSize: 50, allGames: true })
      .then((res) => {
        const items = res?.items || [];
        setPlayerGames(items);
      })
      .catch((err) => {
        console.warn("Failed to fetch player games:", err);
        setPlayerGames([]);
      });
  }, [selectedPlayerId]);

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);

  // 3. Handle loading a game onto the interactive board
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

    // Clean moves array from moves_san string
    const rawMoves = g.moves_san || "";
    const moves = rawMoves
      .split(" ")
      .map((m) => m.replace(/^\d+\.+/, "").trim())
      .filter((m) => m && !["1-0", "0-1", "1/2-1/2", "*"].includes(m));

    setActiveMoves(moves);
    setCurrentPly(0);
    setCurrentFen(START_FEN);

    // Auto set board orientation based on player's color in this game
    const pName = selectedPlayer?.canonical_name?.toLowerCase() || "";
    if (g.black_player && g.black_player.toLowerCase().includes(pName)) {
      setBoardOrientation("black");
    } else {
      setBoardOrientation("white");
    }
  };

  const handleApplyFen = (fen: string) => {
    setCurrentFen(fen);
    setActiveMoves([]);
    setCurrentPly(0);
  };

  const handleApplyMove = (san: string) => {
    // Append move to active moves
    setActiveMoves((prev) => [...prev, san]);
  };

  const handleAskAboutBoard = () => {
    const activeColor = currentFen.split(" ")[1] === "w" ? "Trắng" : "Đen";
    let evalText = "";
    if (currentEval) {
      const scoreStr = currentEval.isMate
        ? `Chiếu bí sau ${currentEval.mateIn ?? currentEval.score} nước`
        : `${currentEval.score > 0 ? "+" : ""}${(currentEval.score / 100).toFixed(1)} điểm`;
      evalText = ` (Stockfish đang chấm: ${scoreStr}, nước tối ưu: ${currentEval.bestMove || "chưa rõ"})`;
    }
    const prompt = `Phân tích thế cờ hiện tại trên bàn cờ giúp tôi (Lượt đi: ${activeColor}${evalText}). Đánh giá kế hoạch chiến lược và nước đi tiếp theo nên là gì?`;
    setPendingPrompt(prompt);
  };

  return (
    <div className="max-w-[1720px] mx-auto space-y-5 animate-fade-in pb-12 px-2 sm:px-4">
      {/* Top Header & Player Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border/60 rounded-3xl p-5 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40 mb-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Phòng Đàm Thoại & Bàn Cờ Tương Tác</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <Brain className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Trợ Lí AI Phân Tích Cờ Vua</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Đồng bộ trực tiếp với bàn cờ, nạp toàn bộ biên bản ván đấu PGN và phân tích chuyên sâu qua Gemini.
          </p>
        </div>

        {/* Player Selector Bar */}
        <div className="flex items-center gap-3">
          <div className="bg-background border border-border/80 rounded-2xl p-2.5 shadow-2xs min-w-[260px]">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Chọn Kỳ Thủ Cần Phân Tích
            </label>
            <select
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="w-full bg-transparent border-0 text-xs sm:text-sm font-bold text-foreground focus:outline-hidden cursor-pointer"
            >
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.canonical_name} {p.title ? `(${p.title})` : ""}
                </option>
              ))}
              {players.length === 0 && (
                <option value="00000000-0000-0000-0000-000000000001">
                  Kỳ Thủ Mẫu
                </option>
              )}
            </select>
          </div>

          <div className="hidden lg:flex flex-col justify-center items-end bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-2xl px-4 py-2 text-right">
            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">
              Dữ liệu PGN đã nạp
            </span>
            <span className="text-sm font-black text-emerald-900 dark:text-emerald-200">
              {playerGames.length} Ván Đấu
            </span>
          </div>
        </div>
      </div>

      {/* Main Split-View Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Chessboard */}
        <div className="lg:col-span-6 xl:col-span-6 space-y-4">
          <div className="bg-card border border-border/60 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col items-center">
            {/* Board Controls Top Bar */}
            <div className="w-full flex items-center justify-between pb-3.5 mb-3 border-b border-border/60 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  Bàn Cờ Tương Tác
                </span>
                {currentEval && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    (currentEval.score || 0) >= 0
                      ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300"
                      : "bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300"
                  }`}>
                    <TrendingUp className="w-3 h-3" />
                    {currentEval.isMate
                      ? `#M${currentEval.mateIn ?? currentEval.score}`
                      : `${currentEval.score > 0 ? "+" : ""}${(currentEval.score / 100).toFixed(1)}`}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setBoardOrientation((prev) => (prev === "white" ? "black" : "white"))}
                  title="Xoay hướng bàn cờ (Đổi bên Trắng / Đen)"
                  className="px-2.5 py-1.5 rounded-xl border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Xoay bàn cờ</span>
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
                  className="px-2.5 py-1.5 rounded-xl border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ban đầu</span>
                </button>
              </div>
            </div>

            {/* Chessboard Component */}
            <div className="w-full flex justify-center py-1">
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
                height={540}
              />
            </div>

            {/* Quick Actions & Game Loader below board */}
            <div className="w-full mt-4 pt-4 border-t border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Game Selector */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Xem ván đấu thực tế trên bàn cờ ({playerGames.length} ván)
                </label>
                <select
                  value={selectedGameId}
                  onChange={(e) => handleSelectGame(e.target.value)}
                  className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer"
                >
                  <option value="">-- Chọn ván đấu để xếp quân --</option>
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

              {/* Ask AI about this Position Button */}
              <button
                type="button"
                onClick={handleAskAboutBoard}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <Sparkles className="w-4 h-4" />
                <span>Hỏi AI về thế cờ này ↗</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: AI Assistant Chat */}
        <div className="lg:col-span-6 xl:col-span-6 h-full">
          <AiCoachChat
            key={selectedPlayerId || "default"}
            runId={`run-${selectedPlayerId || "default"}`}
            playerId={selectedPlayerId}
            playerName={selectedPlayer?.canonical_name || "Kỳ thủ"}
            gamesCount={playerGames.length}
            currentFen={currentFen}
            currentEval={currentEval}
            onApplyFen={handleApplyFen}
            onApplyMove={handleApplyMove}
            heightClass="h-[620px]"
          />
        </div>
      </div>
    </div>
  );
}
