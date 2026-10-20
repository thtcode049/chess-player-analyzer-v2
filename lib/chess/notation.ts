/**
 * International Standard Chess Notation Utilities
 * Strictly follows FIDE / Standard Algebraic Notation (SAN):
 * - Pieces: K (King), Q (Queen), R (Rook), B (Bishop), N (Knight)
 * - Pawns: identified by file letter (e.g. e4, d5, c5, cxd4)
 * - Castling: O-O (kingside), O-O-O (queenside), or 0-0 / 0-0-0
 * - Promotions: e8=Q, a1=N, etc.
 * - Annotations: +, #, ?, !
 */

export interface NormalizedMove {
  moveNumber: number | null;
  isBlack: boolean;
  san: string;
  original: string;
}

/**
 * Checks if a string looks like a valid FEN position
 */
export function isFenString(str: string): boolean {
  if (!str) return false;
  const trimmed = str.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return false;
  const ranks = parts[0].split("/");
  return ranks.length === 8 && /^[rnbqkpRNBQKP1-8]+$/.test(ranks.join(""));
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
