"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  Cpu, 
  Loader2
} from "lucide-react";
import ChessBoard from "@/components/chess/ChessBoard";
import MoveHistory from "@/components/chess/MoveHistory";
import CriticalPositionsList from "@/components/analysis/CriticalPositionsList";
import { apiClient } from "@/lib/api/client";
import { Game, CriticalPosition } from "@/lib/api/types";

export default function GameViewerPage() {
  const params = useParams();
  const gameId = params.gameId as string;

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [moves, setMoves] = useState<string[]>([]);
  const [currentPly, setCurrentPly] = useState(0);
  const [currentFen, setCurrentFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [criticalPositions, setCriticalPositions] = useState<CriticalPosition[]>([]);

  useEffect(() => {
    if (!gameId) return;

    apiClient.getGame(gameId)
      .then((g) => {
        if (g) {
          setGame(g);
          if (g.moves_san) {
            setMoves(g.moves_san.split(" ").filter(Boolean));
          }
          if (g.critical_positions) {
            setCriticalPositions(g.critical_positions);
          } else {
            // Sample critical positions for inspection
            setCriticalPositions([
              {
                ply: 14,
                fen: "r1bqk2r/1pp1bppp/p1np1n2/4p3/B3P3/2PP1N2/PP3PPP/RNBQ1RK1 b kq - 0 7",
                eval_before: 0.3,
                eval_after: -1.8,
                cpl: 210,
                event_type: "BLUNDER",
                played_move: "Na5",
                best_move: "b5",
                phase: "opening"
              },
              {
                ply: 28,
                fen: "2r2rk1/1b2bppp/p2p1n2/1p2p3/2P1P3/1PN1BP2/P5PP/2RR1BK1 b - - 0 14",
                eval_before: -1.2,
                eval_after: 0.1,
                cpl: 130,
                event_type: "MISTAKE",
                played_move: "bxc4",
                best_move: "Rfd8",
                phase: "middlegame"
              }
            ]);
          }
        }
      })
      .catch((err) => {
        console.warn("Could not fetch game:", err);
      })
      .finally(() => setLoading(false));
  }, [gameId]);

  const handlePositionChange = (fen: string, ply: number) => {
    setCurrentFen(fen);
    setCurrentPly(ply);
  };

  const handleSelectCriticalPosition = (fen: string, ply: number) => {
    setCurrentFen(fen);
    setCurrentPly(ply);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Đang tải ván đấu...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <Link
            href="/players"
            className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Quay lại Hồ sơ Kỳ thủ
          </Link>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-3">
            <span>{game?.white_player || "Quân Trắng"}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {game?.white_elo ? `${game.white_elo}` : "N/A"}
            </span>
            <span className="text-primary font-mono text-xl font-bold">vs</span>
            <span>{game?.black_player || "Quân Đen"}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {game?.black_elo ? `${game.black_elo}` : "N/A"}
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Kết quả: <b className="text-foreground">{game?.result || "---"}</b> • ECO: <b className="text-foreground">{game?.eco || "---"}</b> • {game?.opening_name || "Khai cuộc không xác định"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/analyze?gameId=${gameId}`}
            className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20 flex items-center gap-1.5"
          >
            <Cpu className="w-4 h-4" />
            Mở Phòng Phân Tích Chuyên Sâu
          </Link>
        </div>
      </div>

      {/* Main Board & Information Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Interactive Board (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-card border border-border/60 rounded-3xl p-4 sm:p-6 shadow-sm">
            <ChessBoard
              initialFen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
              moves={moves}
              currentPly={currentPly}
              onPositionChange={handlePositionChange}
              height={480}
            />
          </div>

          <div className="bg-card/60 border border-border/40 rounded-xl p-3 flex items-center justify-between text-xs">
            <span className="font-mono text-muted-foreground truncate select-all">
              {currentFen}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(currentFen);
                alert("Đã sao chép FEN!");
              }}
              className="px-2.5 py-1 rounded bg-secondary text-secondary-foreground font-semibold text-[11px]"
            >
              Copy FEN
            </button>
          </div>
        </div>

        {/* Right: Move History & Critical Positions (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="h-[260px]">
            <MoveHistory
              moves={moves}
              currentPly={currentPly}
              onSelectPly={(ply) => setCurrentPly(ply)}
            />
          </div>

          <div>
            <CriticalPositionsList
              positions={criticalPositions}
              onSelectPosition={handleSelectCriticalPosition}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
