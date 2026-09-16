"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  Loader2
} from "lucide-react";
import Link from "next/link";
import ChessBoard from "@/components/chess/ChessBoard";
import MoveHistory from "@/components/chess/MoveHistory";
import OpeningTreeTable from "@/components/analysis/OpeningTreeTable";
import { apiClient } from "@/lib/api/client";
import { Game, OpeningContinuation } from "@/lib/api/types";

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get("gameId");
  const initialMove = searchParams.get("move");

  const [moves, setMoves] = useState<string[]>([]);
  const [currentPly, setCurrentPly] = useState(0);
  const [currentFen, setCurrentFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [gameInfo, setGameInfo] = useState<Game | null>(null);
  
  // Custom PGN/FEN input modal or drawers
  const [showPgnInput, setShowPgnInput] = useState(false);
  const [inputPgn, setInputPgn] = useState("");
  const [inputFen, setInputFen] = useState("");

  // Sample opening continuations matching initial moves
  const [continuations, setContinuations] = useState<OpeningContinuation[]>([
    { san: "e4", games_count: 520, usage_pct: 54.2, win_pct: 61.2, draw_pct: 24.1, loss_pct: 14.7, score_pct: 73.2 },
    { san: "d4", games_count: 310, usage_pct: 32.3, win_pct: 55.4, draw_pct: 26.5, loss_pct: 18.1, score_pct: 68.6 },
    { san: "Nf3", games_count: 85, usage_pct: 8.9, win_pct: 52.0, draw_pct: 31.0, loss_pct: 17.0, score_pct: 67.5 },
    { san: "c4", games_count: 45, usage_pct: 4.6, win_pct: 48.9, draw_pct: 33.3, loss_pct: 17.8, score_pct: 65.5 },
  ]);

  // Load game from ID if present
  useEffect(() => {
    if (gameId) {
      apiClient.getGame(gameId).then((g) => {
        if (g) {
          setGameInfo(g);
          if (g.moves_san) {
            const parsedMoves = g.moves_san.split(" ").filter(Boolean);
            setMoves(parsedMoves);
          }
        }
      }).catch((err) => {
        console.warn("Could not load game:", err);
      });
    } else if (initialMove) {
      setMoves([initialMove]);
    }
  }, [gameId, initialMove]);

  const handlePositionChange = (fen: string, ply: number) => {
    setCurrentFen(fen);
    setCurrentPly(ply);
  };

  const handleSelectMove = (san: string) => {
    try {
      const chess = new Chess(currentFen);
      chess.move(san);
      setMoves(prev => [...prev.slice(0, currentPly), san]);
      setCurrentPly(prev => prev + 1);
      setCurrentFen(chess.fen());
    } catch (e) {
      console.warn("Invalid move selected:", san, e);
    }
  };

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

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
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
              Ván đấu: <b>{gameInfo.white_player}</b> ({gameInfo.white_elo || "?"}) vs <b>{gameInfo.black_player}</b> ({gameInfo.black_elo || "?"}) • Kết quả: <b className="text-primary">{gameInfo.result}</b> • ECO: <b>{gameInfo.eco || "---"}</b>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              Phân tích trực tiếp trên trình duyệt, không gây tải cho máy chủ.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPgnInput(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-border/60 hover:bg-card text-foreground transition-all flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            Dán PGN / FEN
          </button>
        </div>
      </div>

      {/* Main Analysis Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left / Center: Interactive Board & Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-card border border-border/60 rounded-3xl p-4 sm:p-6 shadow-sm">
            <ChessBoard
              initialFen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
              moves={moves}
              onPositionChange={handlePositionChange}
              height={500}
            />
          </div>

          {/* Current FEN Bar */}
          <div className="bg-card/60 border border-border/40 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
            <span className="font-mono text-muted-foreground truncate select-all">
              {currentFen}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(currentFen);
                alert("Đã sao chép FEN vào clipboard!");
              }}
              className="px-2.5 py-1 rounded bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground font-semibold text-[11px] whitespace-nowrap transition-all"
            >
              Sao chép FEN
            </button>
          </div>
        </div>

        {/* Right: Move History & Continuations (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Move History Sheet */}
          <div className="h-[280px]">
            <MoveHistory
              moves={moves}
              currentPly={currentPly}
              onSelectPly={(ply) => {
                setCurrentPly(ply);
              }}
            />
          </div>

          {/* Opening Continuations Tree */}
          <div>
            <OpeningTreeTable
              continuations={continuations}
              totalGames={100}
              onSelectMove={handleSelectMove}
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
