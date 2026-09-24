import { Chess } from "chess.js";

/**
 * Converts piece letter prefix to chess figurine unicode symbols
 * e.g., "Nf3" -> "♘f3", "Bc4" -> "♗c4"
 */
export function sanToFigurine(san: string): string {
  if (!san) return "";
  return san
    .replace(/^N/, "♘")
    .replace(/^B/, "♗")
    .replace(/^R/, "♖")
    .replace(/^Q/, "♕")
    .replace(/^K/, "♔")
    .replace(/=N/g, "=♘")
    .replace(/=B/g, "=♗")
    .replace(/=R/g, "=♖")
    .replace(/=Q/g, "=♕");
}

/**
 * Formats a Stockfish Principal Variation (pv) array of UCI moves
 * into standard SAN with move numbers starting from current position.
 *
 * Example output: "1. e4 e5 2. ♘f3 ♘c6 3. ♗c4 ♘f6 4. d3 ♗c5 5. O-O d6"
 * If Black to move: "3... ♘f6 4. d3 ♗c5 5. O-O d6"
 */
export function formatPvToSan(
  pv: string[] | undefined,
  currentFen: string,
  maxMoves = 12,
  useFigurines = true
): string {
  if (!pv || !Array.isArray(pv) || pv.length === 0) return "";
  if (!currentFen) return "";

  try {
    const tempGame = new Chess(currentFen);
    const tokens: string[] = [];

    // Parse FEN move counter
    const fenParts = currentFen.trim().split(/\s+/);
    let fullMoveNumber = fenParts.length >= 6 ? parseInt(fenParts[5], 10) : 1;
    if (isNaN(fullMoveNumber) || fullMoveNumber < 1) fullMoveNumber = 1;

    let isFirst = true;

    for (let i = 0; i < Math.min(pv.length, maxMoves); i++) {
      const uci = pv[i];
      if (!uci || uci.length < 4) break;

      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4].toLowerCase() : undefined;

      const turnBefore = tempGame.turn(); // 'w' or 'b'

      let moveResult;
      try {
        moveResult = tempGame.move({ from, to, promotion });
      } catch {
        break;
      }
      if (!moveResult) break;

      const sanText = useFigurines ? sanToFigurine(moveResult.san) : moveResult.san;

      if (turnBefore === "w") {
        tokens.push(`${fullMoveNumber}. ${sanText}`);
      } else {
        if (isFirst) {
          tokens.push(`${fullMoveNumber}... ${sanText}`);
        } else {
          tokens.push(sanText);
        }
        fullMoveNumber++;
      }

      isFirst = false;
    }

    return tokens.join(" ");
  } catch (err) {
    console.warn("Error converting PV to SAN:", err);
    return pv.slice(0, 6).join(" ");
  }
}
