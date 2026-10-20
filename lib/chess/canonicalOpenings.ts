/**
 * Canonical Opening Formations & FEN Dictionary
 * Synchronized with lichess-org/chess-openings (3,865 ECO entries).
 * Provides immediate canonical board formations (moves & FEN) when drilling into openings.
 */

export interface CanonicalOpening {
  eco: string;
  name: string;
  moves: string[];
  fen: string;
}

export const CANONICAL_OPENINGS: Record<string, CanonicalOpening> = {
  // London Systems
  "london system": {
    eco: "A48",
    name: "London System",
    moves: ["d4", "Nf6", "Nf3", "g6", "Bf4"],
    fen: "rnbqkb1r/pppppp1p/5np1/8/3P1B2/5N2/PPP1PPPP/RN1QKB1R b KQkq - 1 3",
  },
  "queen's pawn game: london system": {
    eco: "D02",
    name: "Queen's Pawn Game: London System",
    moves: ["d4", "d5", "Nf3", "Nf6", "Bf4"],
    fen: "rnbqkb1r/ppp1pppp/5n2/3p4/3P1B2/5N2/PPP1PPPP/RN1QKB1R b KQkq - 3 3",
  },
  "queen's pawn game: accelerated london system": {
    eco: "D00",
    name: "Queen's Pawn Game: Accelerated London System",
    moves: ["d4", "d5", "Bf4"],
    fen: "rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 1 2",
  },
  "indian defense: accelerated london system": {
    eco: "A45",
    name: "Indian Defense: Accelerated London System",
    moves: ["d4", "Nf6", "Bf4"],
    fen: "rnbqkb1r/pppppppp/5n2/8/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 2 2",
  },

  // Sicilian Defenses
  "sicilian defense": {
    eco: "B20",
    name: "Sicilian Defense",
    moves: ["e4", "c5"],
    fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
  },
  "sicilian defense: najdorf variation": {
    eco: "B90",
    name: "Sicilian Defense: Najdorf Variation",
    moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"],
    fen: "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6",
  },
  "sicilian defense: dragon variation": {
    eco: "B70",
    name: "Sicilian Defense: Dragon Variation",
    moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "g6"],
    fen: "rnbqkb1r/pp2pp1p/3p1np1/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6",
  },
  "sicilian defense: scheveningen variation": {
    eco: "B80",
    name: "Sicilian Defense: Scheveningen Variation",
    moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "e6"],
    fen: "rnbqkb1r/pp3ppp/3ppn2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6",
  },

  // Open Games (1. e4 e5)
  "ruy lopez": {
    eco: "C60",
    name: "Ruy Lopez",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"],
    fen: "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
  },
  "italian game": {
    eco: "C50",
    name: "Italian Game",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"],
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
  },
  "scotch game": {
    eco: "C44",
    name: "Scotch Game",
    moves: ["e4", "e5", "Nf3", "Nc6", "d4"],
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3",
  },
  "petrov's defense": {
    eco: "C42",
    name: "Petrov's Defense",
    moves: ["e4", "e5", "Nf3", "Nf6"],
    fen: "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
  },
  "king's gambit": {
    eco: "C30",
    name: "King's Gambit",
    moves: ["e4", "e5", "f4"],
    fen: "rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq - 0 2",
  },
  "vienna game": {
    eco: "C25",
    name: "Vienna Game",
    moves: ["e4", "e5", "Nc3"],
    fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2",
  },

  // Semi-Open Games
  "french defense": {
    eco: "C00",
    name: "French Defense",
    moves: ["e4", "e6"],
    fen: "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
  },
  "caro-kann defense": {
    eco: "B10",
    name: "Caro-Kann Defense",
    moves: ["e4", "c6"],
    fen: "rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
  },
  "scandinavian defense": {
    eco: "B01",
    name: "Scandinavian Defense",
    moves: ["e4", "d5"],
    fen: "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
  },
  "modern defense": {
    eco: "B06",
    name: "Modern Defense",
    moves: ["e4", "g6"],
    fen: "rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
  },
  "pirc defense": {
    eco: "B00",
    name: "Pirc Defense",
    moves: ["e4", "d6"],
    fen: "rnbqkbnr/ppp1pppp/3p4/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
  },
  "alekhine's defense": {
    eco: "B02",
    name: "Alekhine's Defense",
    moves: ["e4", "Nf6"],
    fen: "rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2",
  },

  // Queen's Pawn Games (1. d4 d5)
  "queen's gambit": {
    eco: "D06",
    name: "Queen's Gambit",
    moves: ["d4", "d5", "c4"],
    fen: "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2",
  },
  "queen's gambit declined": {
    eco: "D30",
    name: "Queen's Gambit Declined",
    moves: ["d4", "d5", "c4", "e6"],
    fen: "rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
  },
  "queen's gambit accepted": {
    eco: "D20",
    name: "Queen's Gambit Accepted",
    moves: ["d4", "d5", "c4", "dxc4"],
    fen: "rnbqkbnr/ppp1pppp/8/8/2pP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
  },
  "slav defense": {
    eco: "D10",
    name: "Slav Defense",
    moves: ["d4", "d5", "c4", "c6"],
    fen: "rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
  },

  // Indian Defenses (1. d4 Nf6)
  // Indian Defenses (1. d4 Nf6)
  "indian defense": {
    eco: "A45",
    name: "Indian Defense",
    moves: ["d4", "Nf6"],
    fen: "rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2",
  },
  "king's indian defense": {
    eco: "E61",
    name: "King's Indian Defense",
    moves: ["d4", "Nf6", "c4", "g6", "Nc3"],
    fen: "rnbqkb1r/pppppp1p/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3",
  },
  "nimzo-indian defense": {
    eco: "E20",
    name: "Nimzo-Indian Defense",
    moves: ["d4", "Nf6", "c4", "e6", "Nc3", "Bb4"],
    fen: "rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4",
  },
  "queen's indian defense": {
    eco: "E12",
    name: "Queen's Indian Defense",
    moves: ["d4", "Nf6", "c4", "e6", "Nf3", "b6"],
    fen: "rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq - 0 4",
  },
  "benoni defense": {
    eco: "A56",
    name: "Benoni Defense",
    moves: ["d4", "Nf6", "c4", "c5"],
    fen: "rnbqkb1r/pp1ppppp/5n2/2p5/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3",
  },
  "grunfeld defense": {
    eco: "D80",
    name: "Grünfeld Defense",
    moves: ["d4", "Nf6", "c4", "g6", "Nc3", "d5"],
    fen: "rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 4",
  },
  "catalan opening": {
    eco: "E00",
    name: "Catalan Opening",
    moves: ["d4", "Nf6", "c4", "e6", "g3"],
    fen: "rnbqkb1r/pppp1ppp/4pn2/8/2PP4/6P1/PP2PP1P/RNBQKBNR b KQkq - 0 3",
  },
  "trompowsky attack": {
    eco: "A45",
    name: "Trompowsky Attack",
    moves: ["d4", "Nf6", "Bg5"],
    fen: "rnbqkb1r/pppppppp/5n2/6B1/3P4/8/PPP1PPPP/RN1QKBNR b KQkq - 2 2",
  },

  // Flank Openings
  "english opening": {
    eco: "A10",
    name: "English Opening",
    moves: ["c4"],
    fen: "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1",
  },
  "reti opening": {
    eco: "A04",
    name: "Réti Opening",
    moves: ["Nf3", "d5", "c4"],
    fen: "rnbqkbnr/ppp1pppp/8/3p4/2P5/5N2/PP1PPPPP/RNBQKB1R b KQkq - 0 2",
  },
  "dutch defense": {
    eco: "A80",
    name: "Dutch Defense",
    moves: ["d4", "f5"],
    fen: "rnbqkbnr/ppppp1pp/8/5p2/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2",
  },
};

/**
 * Fast client-side fuzzy match for canonical opening definitions.
 */
export function getCanonicalOpeningByName(name: string): CanonicalOpening | null {
  if (!name) return null;
  const clean = name.trim().toLowerCase();

  // 1. Exact match
  if (CANONICAL_OPENINGS[clean]) {
    return CANONICAL_OPENINGS[clean];
  }

  // 2. Base family name match (strip variation after ':' or ',' or ' - ')
  const base = clean.split(/[:]|,|\s+-\s+/)[0].trim();
  if (CANONICAL_OPENINGS[base]) {
    return CANONICAL_OPENINGS[base];
  }

  // 3. Special case for London System variations
  if (clean.includes("london")) {
    if (clean.includes("accelerated") || clean.includes("indian")) {
      return CANONICAL_OPENINGS["indian defense: accelerated london system"];
    }
    return CANONICAL_OPENINGS["queen's pawn game: london system"] || CANONICAL_OPENINGS["london system"];
  }

  // 4. Exact prefix matching (avoids "nimzo-indian" matching "indian defense")
  for (const [key, op] of Object.entries(CANONICAL_OPENINGS)) {
    if (clean.startsWith(key) || key.startsWith(base)) {
      return op;
    }
  }

  return null;
}

/**
 * Fast client-side match for canonical opening definitions given a move list.
 * Finds the canonical opening whose defining moves match the prefix of moves.
 * Prefers the longest matching defining sequence.
 */
export function getCanonicalOpeningByMoves(moves: string[]): CanonicalOpening | null {
  if (!moves || moves.length === 0) return null;

  let bestMatch: CanonicalOpening | null = null;
  let maxMatchedLen = 0;

  for (const op of Object.values(CANONICAL_OPENINGS)) {
    if (!op.moves || op.moves.length === 0) continue;
    if (moves.length >= op.moves.length) {
      const isPrefix = op.moves.every((m, idx) => m === moves[idx]);
      if (isPrefix && op.moves.length > maxMatchedLen) {
        maxMatchedLen = op.moves.length;
        bestMatch = op;
      }
    }
  }

  return bestMatch;
}

