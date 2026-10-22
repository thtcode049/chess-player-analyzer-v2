/**
 * Matchup Opening Tree Builder
 * ----------------------------
 * Computes instant, transposition-safe opening continuations for:
 * 1. Single Player (with White/Black/All color filter)
 * 2. Multi-Player Matchup (White Player(s) vs Black Player(s))
 * 3. Clone Aggregation (merging multiple accounts of the same player)
 *
 * When querying a position FEN:
 * - If turn is White ('w'): continuations are extracted from games where the designated White players played White.
 * - If turn is Black ('b'): continuations are extracted from games where the designated Black players played Black.
 */

import { Chess } from "chess.js";
import { Game, OpeningContinuation, OpeningTreeNode } from "@/lib/api/types";

export interface PlayerRoleAssignment {
  playerId: string;
  playerName: string;
  role: "white" | "black" | "both";
}

interface ContinuationAccumulator {
  san: string;
  games_count: number;
  wins: number; // Wins from the moving player's perspective
  draws: number;
  losses: number; // Losses from the moving player's perspective
  sampleGame?: Game;
}

export class MatchupOpeningTreeIndex {
  // Map: normalized fen -> Map<sanMove, ContinuationAccumulator>
  private whiteTurnMoves = new Map<string, Map<string, ContinuationAccumulator>>();
  private blackTurnMoves = new Map<string, Map<string, ContinuationAccumulator>>();

  // Total games count passing through position
  private whiteTurnPositions = new Map<string, { total: number; wins: number; draws: number; losses: number }>();
  private blackTurnPositions = new Map<string, { total: number; wins: number; draws: number; losses: number }>();

  public totalWhiteGames = 0;
  public totalBlackGames = 0;

  /**
   * Normalizes a FEN to board position, turn, castling, and en-passant (ignoring halfmove and fullmove clock).
   */
  public static normalizeFen(fen: string): string {
    const parts = fen.trim().split(/\s+/);
    if (parts.length >= 4) {
      return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]}`;
    }
    return fen.trim();
  }

  /**
   * Extracts clean SAN move tokens from game moves_san.
   */
  public static parseSanTokens(movesSan?: string | null): string[] {
    if (!movesSan) return [];
    return movesSan
      .split(/\s+/)
      .map((t) => t.replace(/^\d+\.+/, "").trim())
      .filter((t) => t && !["1-0", "0-1", "1/2-1/2", "*"].includes(t));
  }

  /**
   * Indexes a collection of games for White moves.
   */
  public indexWhiteGames(games: Game[], playerCanonicalName?: string) {
    for (const game of games) {
      this.totalWhiteGames++;
      this.indexGame(game, "white", playerCanonicalName);
    }
  }

  /**
   * Indexes a collection of games for Black moves.
   */
  public indexBlackGames(games: Game[], playerCanonicalName?: string) {
    for (const game of games) {
      this.totalBlackGames++;
      this.indexGame(game, "black", playerCanonicalName);
    }
  }

  private indexGame(game: Game, expectedRole: "white" | "black", playerCanonicalName?: string) {
    const tokens = MatchupOpeningTreeIndex.parseSanTokens(game.moves_san);
    if (tokens.length === 0) return;

    const res = (game.result || "").trim();
    // Outcome from the perspective of the expectedRole
    let isWin = false;
    let isDraw = res === "1/2-1/2" || res === "0.5-0.5";
    let isLoss = false;

    if (expectedRole === "white") {
      isWin = res === "1-0";
      isLoss = res === "0-1";
    } else {
      isWin = res === "0-1";
      isLoss = res === "1-0";
    }

    const chess = new Chess();
    const maxPlies = Math.min(tokens.length, 40); // Index up to 40 plies (20 full moves) for opening analysis

    for (let ply = 0; ply < maxPlies; ply++) {
      const currentFen = MatchupOpeningTreeIndex.normalizeFen(chess.fen());
      const turn = chess.turn(); // 'w' or 'b'
      const sanMove = tokens[ply];

      // Update position counts
      if (turn === "w" && expectedRole === "white") {
        const pStat = this.whiteTurnPositions.get(currentFen) || { total: 0, wins: 0, draws: 0, losses: 0 };
        pStat.total++;
        if (isWin) pStat.wins++;
        else if (isDraw) pStat.draws++;
        else if (isLoss) pStat.losses++;
        this.whiteTurnPositions.set(currentFen, pStat);

        let moveMap = this.whiteTurnMoves.get(currentFen);
        if (!moveMap) {
          moveMap = new Map();
          this.whiteTurnMoves.set(currentFen, moveMap);
        }

        const moveAcc = moveMap.get(sanMove) || {
          san: sanMove,
          games_count: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          sampleGame: game,
        };
        moveAcc.games_count++;
        if (isWin) moveAcc.wins++;
        else if (isDraw) moveAcc.draws++;
        else if (isLoss) moveAcc.losses++;
        moveMap.set(sanMove, moveAcc);
      } else if (turn === "b" && expectedRole === "black") {
        const pStat = this.blackTurnPositions.get(currentFen) || { total: 0, wins: 0, draws: 0, losses: 0 };
        pStat.total++;
        if (isWin) pStat.wins++;
        else if (isDraw) pStat.draws++;
        else if (isLoss) pStat.losses++;
        this.blackTurnPositions.set(currentFen, pStat);

        let moveMap = this.blackTurnMoves.get(currentFen);
        if (!moveMap) {
          moveMap = new Map();
          this.blackTurnMoves.set(currentFen, moveMap);
        }

        const moveAcc = moveMap.get(sanMove) || {
          san: sanMove,
          games_count: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          sampleGame: game,
        };
        moveAcc.games_count++;
        if (isWin) moveAcc.wins++;
        else if (isDraw) moveAcc.draws++;
        else if (isLoss) moveAcc.losses++;
        moveMap.set(sanMove, moveAcc);
      }

      // Step forward
      try {
        const valid = chess.move(sanMove);
        if (!valid) break;
      } catch {
        break;
      }
    }
  }

  /**
   * Queries the tree continuations for any given FEN position.
   */
  public queryPosition(rawFen: string): OpeningTreeNode {
    const norm = MatchupOpeningTreeIndex.normalizeFen(rawFen);
    const turn = rawFen.trim().split(/\s+/)[1] || "w";

    const moveMap = turn === "w" ? this.whiteTurnMoves.get(norm) : this.blackTurnMoves.get(norm);
    const posStat = turn === "w" ? this.whiteTurnPositions.get(norm) : this.blackTurnPositions.get(norm);

    const totalGamesAtPos = posStat?.total || 0;
    const wins = posStat?.wins || 0;
    const draws = posStat?.draws || 0;
    const losses = posStat?.losses || 0;
    const scorePct =
      totalGamesAtPos > 0
        ? Number((((wins + 0.5 * draws) / totalGamesAtPos) * 100).toFixed(1))
        : 0.0;

    const continuations: OpeningContinuation[] = [];

    if (moveMap && moveMap.size > 0) {
      for (const acc of Array.from(moveMap.values())) {
        const gCount = acc.games_count;
        const w = acc.wins;
        const d = acc.draws;
        const l = acc.losses;

        const usagePct =
          totalGamesAtPos > 0 ? Number(((gCount / totalGamesAtPos) * 100).toFixed(1)) : 0;
        const winPct = gCount > 0 ? Number(((w / gCount) * 100).toFixed(1)) : 0;
        const drawPct = gCount > 0 ? Number(((d / gCount) * 100).toFixed(1)) : 0;
        const lossPct = gCount > 0 ? Number(((l / gCount) * 100).toFixed(1)) : 0;
        const moveScorePct =
          gCount > 0 ? Number((((w + 0.5 * d) / gCount) * 100).toFixed(1)) : 0;

        const sample = acc.sampleGame;
        const singleGameInfo = sample
          ? {
              white: sample.white_player,
              white_elo: sample.white_elo || undefined,
              black: sample.black_player,
              black_elo: sample.black_elo || undefined,
              result: sample.result,
              site: sample.site_url || undefined,
              date: sample.played_at || undefined,
              opening: sample.opening_name || undefined,
            }
          : undefined;

        continuations.push({
          san: acc.san,
          games_count: gCount,
          usage_pct: usagePct,
          win_pct: winPct,
          draw_pct: drawPct,
          loss_pct: lossPct,
          score_pct: moveScorePct,
          single_game_info: singleGameInfo,
        });
      }

      // Sort by games_count descending
      continuations.sort((a, b) => b.games_count - a.games_count);
    }

    return {
      fen: rawFen,
      games_count: totalGamesAtPos,
      in_pgn: totalGamesAtPos > 0,
      total_games: totalGamesAtPos,
      wins,
      draws,
      losses,
      score_pct: scorePct,
      continuations,
    };
  }
}

/**
 * Builds a MatchupOpeningTreeIndex from games and role assignments.
 */
export function buildMatchupTreeIndex(
  playerAssignments: Array<{ player: { id: string; canonical_name: string }; games: Game[]; role: "white" | "black" | "both" }>
): MatchupOpeningTreeIndex {
  const index = new MatchupOpeningTreeIndex();

  for (const item of playerAssignments) {
    const { player, games, role } = item;
    const pName = player.canonical_name.toLowerCase();

    if (role === "white" || role === "both") {
      // Filter games where player played as White
      const whiteGames = games.filter((g) => {
        const w = (g.white_player || "").toLowerCase();
        return w.includes(pName);
      });
      index.indexWhiteGames(whiteGames, player.canonical_name);
    }

    if (role === "black" || role === "both") {
      // Filter games where player played as Black
      const blackGames = games.filter((g) => {
        const b = (g.black_player || "").toLowerCase();
        return b.includes(pName);
      });
      index.indexBlackGames(blackGames, player.canonical_name);
    }
  }

  return index;
}
