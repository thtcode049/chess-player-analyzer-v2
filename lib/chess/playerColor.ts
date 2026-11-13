import type { Game } from "@/lib/api/types";

export function getGamePlayerColor(game: Game, canonicalName?: string): "white" | "black" | null {
  if (game.player_color === "white" || game.player_color === "black") {
    return game.player_color;
  }

  const name = canonicalName?.trim().normalize("NFC");
  if (!name) return null;
  const whiteMatches = game.white_player?.trim().normalize("NFC") === name;
  const blackMatches = game.black_player?.trim().normalize("NFC") === name;
  if (whiteMatches === blackMatches) return null;
  return whiteMatches ? "white" : "black";
}
