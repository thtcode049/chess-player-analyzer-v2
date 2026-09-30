import React from "react";

const PIECE_SYMBOLS: Record<string, string> = {
  N: "♘",
  B: "♗",
  R: "♖",
  Q: "♕",
  K: "♔",
};

interface FigurineMoveProps {
  san: string;
  className?: string;
}

/**
 * Renders chess SAN notation with piece figurine symbols.
 * Uses font-normal for both figurine and text so that stroke weight
 * remains completely uniform and non-bold, matching the chess piece symbol.
 */
export function FigurineMove({ san, className = "" }: FigurineMoveProps) {
  if (!san) return null;

  let pieceSymbol: string | undefined;
  let rest = san;

  const match = san.match(/^([NBRQK])(.*)$/);
  if (match) {
    pieceSymbol = PIECE_SYMBOLS[match[1]];
    rest = match[2];
  }

  // Handle promotion if any (e.g., e8=Q)
  let promotedSymbol: string | undefined;
  const promoMatch = rest.match(/^(.*?)=([NBRQ])(.*)$/);
  if (promoMatch) {
    promotedSymbol = PIECE_SYMBOLS[promoMatch[2]];
    rest = promoMatch[1] + promoMatch[3];
  }

  return (
    <span className={`inline-flex items-center tracking-tight font-normal ${className}`}>
      {pieceSymbol && (
        <span className="text-[16px] leading-none -mr-[1px] select-none inline-block font-normal">
          {pieceSymbol}
        </span>
      )}
      <span className="font-normal">{rest}</span>
      {promotedSymbol && (
        <span className="inline-flex items-center ml-0.5 font-normal">
          <span className="text-[12px] opacity-75 mr-[1px] font-normal">=</span>
          <span className="text-[16px] leading-none select-none inline-block font-normal">
            {promotedSymbol}
          </span>
        </span>
      )}
    </span>
  );
}

export default FigurineMove;
