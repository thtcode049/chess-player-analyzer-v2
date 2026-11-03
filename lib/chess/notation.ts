/**
 * International Standard Chess Notation Utilities
 * Strictly follows FIDE / Standard Algebraic Notation (SAN):
 * - Pieces: K (King), Q (Queen), R (Rook), B (Bishop), N (Knight)
 * - Pawns: identified by file letter (e.g. e4, d5, c5, cxd4)
 * - Castling: O-O (kingside), O-O-O (queenside), or 0-0 / 0-0-0
 * - Promotions: e8=Q, a1=N, etc.
 * - Annotations: +, #, ?, !
 */

import { Chess } from "chess.js";

export interface NormalizedMove {
  moveNumber: number | null;
  isBlack: boolean;
  san: string;
  original: string;
}

/**
 * Checks if a string looks like a valid FEN position (standard board or pawn skeleton)
 */
export function isFenString(str: string): boolean {
  if (!str) return false;
  const clean = str.trim().replace(/^[(`"']+|[`"';.,)]+$/g, "");
  const parts = clean.split(/\s+/);
  if (parts.length < 1 || parts.length > 6) return false;
  const ranks = parts[0].split("/");
  if (ranks.length !== 8) return false;
  for (const r of ranks) {
    let count = 0;
    for (const ch of r) {
      if (/[1-8]/.test(ch)) count += parseInt(ch, 10);
      else if (/[rnbqkpRNBQKP]/.test(ch)) count += 1;
      else return false;
    }
    if (count !== 8) return false;
  }
  return true;
}

/**
 * Normalizes a FEN string. If only the piece placement part is provided,
 * adds standard active color, castling, en-passant, and move clocks: " w - - 0 1"
 */
export function normalizeFen(str: string): string {
  if (!str) return "";
  const clean = str.trim().replace(/^[(`"']+|[`"';.,)]+$/g, "");
  const parts = clean.split(/\s+/);
  if (parts.length === 1) {
    return `${parts[0]} w - - 0 1`;
  }
  return clean;
}

/**
 * Checks if a FEN represents a bare pawn structure skeleton (only pawns, with or without kings)
 */
export function isPawnSkeletonFen(str: string): boolean {
  if (!isFenString(str)) return false;
  const placement = normalizeFen(str).split(" ")[0];
  // A bare pawn skeleton has pawns, empty numbers, and at most kings (no Q, R, B, N)
  return !/[qrbnQRBN]/.test(placement) && /[pP]/.test(placement);
}

/**
 * Checks if a string looks like a standard international chess move (SAN)
 * Examples: 1.e4, 3...c5, 3...Nh5, 3.Bc4, 3.c5, Nf3, Nh5, Bc4, Qxd4, O-O, O-O-O, e8=Q#, etc.
 */
export function isChessMoveCandidate(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  if (t.length === 0 || t.length > 20) return false;

  // Ignore general non-move text with multiple spaces
  if (/\s{2,}/.test(t)) return false;

  // Castle patterns: O-O, O-O-O, 0-0, 0-0-0 (with optional move number prefix)
  if (/^(?:(\d{1,3})\s*(?:\.{1,3})\s*)?(O-O(?:-O)?|0-0(?:-0)?)[+#?!]*$/i.test(t)) {
    return true;
  }

  // Standard International SAN move pattern:
  // Optional move number: "1.", "3...", "18."
  // Piece: [NBRQK] (Knight, Bishop, Rook, Queen, King) or pawn file [a-h]
  // Disambiguation file/rank: [a-h]?[1-8]?
  // Capture: x?
  // Destination: [a-h][1-8]
  // Promotion: (?:=[NBRQK])?
  // Check/annotation: [+#?!]*
  const moveRegex = /^(?:(\d{1,3})\s*(?:\.{1,3})\s*)?([NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:=[NBRQK])?)[+#?!]*$/i;
  return moveRegex.test(t);
}

/**
 * Extract move number, color, and standard SAN from text.
 * Strictly enforces standard international notation.
 * Examples:
 * - "3...c5" -> { moveNumber: 3, isBlack: true, san: "c5" }
 * - "3.Bc4" -> { moveNumber: 3, isBlack: false, san: "Bc4" }
 * - "3...Nh5" -> { moveNumber: 3, isBlack: true, san: "Nh5" }
 * - "Nbd7" -> { moveNumber: null, isBlack: false, san: "Nbd7" }
 * - "1.e4" -> { moveNumber: 1, isBlack: false, san: "e4" }
 */
export function normalizeMoveToSan(raw: string): NormalizedMove {
  const text = (raw || "").trim();
  const original = text;

  // 1. Extract move number and color
  // Matches: "3...", "3.", "18..", "18..."
  const numMatch = text.match(/^(\d{1,3})\s*(\.{1,3})?\s*(.*)$/);
  let moveNumber: number | null = null;
  let isBlack = false;
  let sanPart = text;

  if (numMatch && numMatch[1]) {
    moveNumber = parseInt(numMatch[1], 10);
    const dots = numMatch[2] || "";
    isBlack = dots.includes("..") || dots.length >= 2;
    sanPart = numMatch[3] || "";
  }

  // 2. Remove leading dots and clean trailing annotations
  const clean = sanPart.replace(/^\.+/, "").trim();
  const trailingSymbols = clean.match(/[+#?!]+$/)?.[0] || "";
  const baseSan = clean.replace(/[+#?!]/g, "").trim();

  // 3. Castle formatting to standard uppercase O-O / O-O-O
  if (baseSan === "0-0-0" || baseSan.toUpperCase() === "O-O-O") {
    return { moveNumber, isBlack, san: "O-O-O" + trailingSymbols, original };
  }
  if (baseSan === "0-0" || baseSan.toUpperCase() === "O-O") {
    return { moveNumber, isBlack, san: "O-O" + trailingSymbols, original };
  }

  // 4. Standard international piece letter casing (capitalize piece, keep destination lowercase)
  // E.g. "nf3" -> "Nf3", "bc4" -> "Bc4", "qxd4" -> "Qxd4", "e4" -> "e4"
  let formattedSan = baseSan;
  if (/^[nbrqk]/i.test(baseSan)) {
    const firstChar = baseSan[0].toUpperCase();
    const rest = baseSan.slice(1);
    formattedSan = firstChar + rest;
  }

  return {
    moveNumber,
    isBlack,
    san: formattedSan + trailingSymbols,
    original,
  };
}

/**
 * Converts a UCI move string (e.g. "d1c2", "e1g1", "c3d5", "a2a3") to standard SAN notation.
 */
export function convertUciToSan(fen: string, uciMove: string): string {
  if (!uciMove || uciMove.length < 4) return uciMove;
  try {
    const game = new Chess(normalizeFen(fen));
    const m = game.move({
      from: uciMove.slice(0, 2) as any,
      to: uciMove.slice(2, 4) as any,
      promotion: (uciMove[4] || undefined) as any,
    });
    return m ? m.san : uciMove.slice(2);
  } catch {
    return uciMove.slice(2);
  }
}

/**
 * Comprehensive Chess Assistant Text Sanitizer & Visual Formatter:
 * 1. Cleans internal tags: ⟦...⟧ and [OPEN_BOARD]
 * 2. Eliminates duplicate "ô ô"
 * 3. Replaces "khả dĩ" with "tối ưu"
 * 4. Resolves raw UCI coordinates (e.g. d1c2 -> Qc2 or c2, (c3d5) -> (Nd5), (như d1c2 hay d1b3) -> (như Qc2 hay Qb3))
 * 5. Bolds all chess moves, piece squares, squares, evaluations and notations for maximum visibility
 */
export function sanitizeAndBoldChessText(text: string, currentFen?: string): string {
  if (!text) return "";
  let s = text;

  // 1. Remove open board and internal tags
  s = s.replace(/\[OPEN_BOARD(?::\s*([^\]]+))?\]/gi, "");
  s = s.replace(/⟦[^:]+:([^⟧]+)⟧/g, "$1");
  s = s.replace(/[⟦⟧]/g, "");

  // 2. Eliminate duplicate "ô ô" with proper Vietnamese Unicode spacing
  s = s.replace(/(^|\s)ô(?:\s+ô)+(\s+)/gi, (m, p1, p2) => p1 + "ô" + p2);
  s = s.replace(/\bô\s+ô\b/gi, "ô");

  // 3. Prohibit "khả dĩ"
  s = s.replace(/\bkhả dĩ\b/gi, "tối ưu");

  // 4. Fix raw prefixes like "nước: a2a3" or "nước: a3"
  s = s.replace(/\bnước:\s*([a-h][1-8])([a-h][1-8])\b/gi, "nước $2");
  s = s.replace(/\bnước:\s*([a-h][1-8])\b/gi, "nước $1");

  // 5. Clean "Piece (fromTo)": e.g. "Be3 (d2e3)" -> "Be3", "Hậu (d1c2)" -> "Hậu c2"
  s = s.replace(/\b([KQRBN][a-h]?[1-8]?x?[a-h][1-8])\s*\([a-h][1-8]([a-h][1-8])\)/g, "$1");
  s = s.replace(/(Hậu|Mã|Tượng|Xe|Vua|Tốt)\s*\([a-h][1-8]([a-h][1-8])\)/gi, "$1 $2");

  // 6. Clean phrases: "từ ô d1 sang ô c2" -> "sang ô c2"
  s = s.replace(/từ ô\s+[a-h][1-8]\s+(sang|lên|về|đến)\s+ô\s+([a-h][1-8])/gi, "$1 ô $2");
  s = s.replace(/ở ô\s+[a-h][1-8]\s+((?:có thể\s+)?(?:nhảy|đi|tiến|lùi|sang|lên|về)\s+(?:lên|vào|sang|đến)?\s*ô\s+[a-h][1-8])/gi, "$1");

  // 7. Dynamic UCI conversion with Chess instance if FEN available
  let chessInstance: Chess | null = null;
  if (currentFen && isFenString(currentFen)) {
    try {
      chessInstance = new Chess(normalizeFen(currentFen));
    } catch {}
  }

  function resolveUci(uci: string): string {
    if (chessInstance) {
      try {
        const m = chessInstance.move({
          from: uci.slice(0, 2) as any,
          to: uci.slice(2, 4) as any,
          promotion: (uci[4] || undefined) as any,
        });
        if (m) {
          chessInstance.undo();
          return m.san;
        }
      } catch {}
    }
    // Fallback: pawn moves like a2a3 -> a3 or destination square
    return uci.slice(2);
  }

  // Replace coordinate moves inside parens like '(như d1c2 hay d1b3)' or '(c3d5)'
  s = s.replace(/\(([a-zA-Z0-9\s,–-]+)\)/g, (_fullMatch: string, inner: string) => {
    const converted = inner.replace(/\b[a-h][1-8][a-h][1-8]\b/g, (uci: string) => resolveUci(uci));
    return "(" + converted + ")";
  });

  // Replace any remaining standalone 4-char UCI coordinate moves
  s = s.replace(/\b[a-h][1-8][a-h][1-8]\b/g, (uci: string) => resolveUci(uci));

  // 8. Auto-bolding for chess elements:
  // a. Squares: "ô d5", "ô c2", "ô e3", etc.
  s = s.replace(/(^|[^\w*])ô\s+([a-h][1-8])(?=[^\w*]|$)/gi, (_m: string, p1: string, sq: string) => `${p1}**ô ${sq}**`);

  // b. Pieces with squares: "Tượng e3", "Mã e4", "Tượng ở g2", "Hậu c2", "Xe d1", "Vua g1", "Tốt a3"
  s = s.replace(/(^|[^\w*])(Tượng|Mã|Hậu|Xe|Vua|Tốt)\s+(?:(ở|đứng ở|tại)\s+)?(?:ô\s+)?([a-h][1-8])(?=[^\w*]|$)/gi, (_m: string, p1: string, piece: string, prep: string, sq: string) => {
    return `${p1}**${piece}${prep ? " " + prep : ""} ${sq}**`;
  });

  // c. "nước [a-h][1-8]" or "nước [KQRBN]..."
  s = s.replace(/\bnước\s+(?!\*\*)([a-h][1-8])\b(?!\*\*)(\s*)/gi, "nước **$1**$2");

  // d. SAN moves: Qc2, Qb3, Nd5, Be3, Nf3, Nf6, Bxd5, Nxe5, Rad1, etc.
  s = s.replace(/(?<![A-Za-z0-9_*`])([KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[KQRBN])?[+#]?)(?![A-Za-z0-9_*`])/g, "**$1**");

  // e. Numbered moves: 1. c4, 1... e5, 2. Nf3, 4. Bg2
  s = s.replace(/(?<!\*\*)(\b\d{1,3}\.(?:\.\.)?\s*(?:\*\*)?[a-h][1-8](?:\*\*)?)\b(?!\*\*)/g, (_m: string, g1: string) => {
    return "**" + g1.replace(/\*\*/g, "") + "**";
  });

  // f. Castling: O-O, O-O-O
  s = s.replace(/(?<!\*\*)\b(O-O(?:-O)?|0-0(?:-0)?)\b(?!\*\*)/g, "**$1**");

  // g. Evaluation numbers: (+0.23), -0.45, #M3
  s = s.replace(/(?<!\*\*)(\+[0-9]+\.[0-9]{2}|-[0-9]+\.[0-9]{2}|#M\d+)\b(?!\*\*)/g, "**$1**");

  // Clean up any double bolding
  s = s.replace(/\*{4,}/g, "**");

  return s.trim();
}

