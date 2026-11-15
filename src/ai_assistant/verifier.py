"""Verify explicit claims about the current chessboard before streaming them."""

import re
from typing import Iterable, Iterator, Optional

import chess

from src.ai_assistant.position_facts import PIECE_NAMES_VI

TAG = re.compile(r"⟦([^:⟦⟧\r\n]+):([^⟦⟧\r\n]+)⟧")
PIECE = re.compile(r"([pnbrqkPNBRQK])([a-h][1-8])")
SQUARE = re.compile(r"[a-h][1-8]")
VERIFICATION_NOTICE = (
    "> Một phần nội dung đã được lược bỏ vì không khớp với thế cờ hiện tại "
    "hoặc không đủ dữ kiện để kiểm chứng."
)


class ChessOutputVerifier:
    """Validate tagged positions, controlled squares, legal moves and variations."""

    @staticmethod
    def _render_tag(kind: str, value: str, board: chess.Board) -> str:
        if kind in ("quân", "qh"):
            source, separator, target = value.partition(">")
            match = PIECE.fullmatch(source)
            if not match or (kind == "qh") != bool(separator):
                raise ValueError("Invalid piece or square control tag")

            symbol, square_name = match.groups()
            square = chess.parse_square(square_name)
            piece = board.piece_at(square)
            if piece is None or piece.symbol() != symbol:
                raise ValueError("Piece does not match the board")

            color = "Trắng" if piece.color == chess.WHITE else "Đen"
            label = f"{PIECE_NAMES_VI[piece.piece_type]} {color} {square_name}"
            if kind == "quân":
                return f"**{label}**"
            if not SQUARE.fullmatch(target) or chess.parse_square(target) not in board.attacks(square):
                raise ValueError("Square is outside the piece's control")
            return f"**{label}** khống chế **ô {target}**"

        if kind not in ("nước", "biến") or not board.is_valid():
            raise ValueError("Unknown tag or position unsuitable for move validation")

        tokens = value.split()
        if not tokens or (kind == "nước" and len(tokens) != 1):
            raise ValueError("Expected one SAN move or a sequence of SAN moves")

        position = board.copy(stack=False)
        moves = []
        for san in tokens:
            move = position.parse_san(san)
            # parse_san also accepts null moves and some non-canonical spellings.
            if not move or position.san(move) != san:
                raise ValueError("Expected canonical SAN")
            moves.append(move)
            position.push(move)

        notation = board.variation_san(moves) if kind == "biến" else tokens[0]
        return f"**{notation}**"

    @classmethod
    def _verify_line(cls, line: str, board: Optional[chess.Board]) -> Optional[str]:
        def render(match: re.Match[str]) -> str:
            if board is None:
                raise ValueError("No current position to verify")
            kind, value = match.groups()
            return cls._render_tag(kind.strip(), value.strip(), board)

        try:
            rendered = TAG.sub(render, line)
        except ValueError:
            return None

        if "⟦" in rendered or "⟧" in rendered:
            return None
        return rendered

    @classmethod
    def verify_stream(cls, chunks: Iterable[str], board: Optional[chess.Board]) -> Iterator[str]:
        """Buffer complete lines so split tags cannot reach SSE before verification."""
        pending = ""
        rejected = False
        for chunk in chunks:
            *lines, pending = (pending + chunk).split("\n")
            for line in lines:
                checked = cls._verify_line(line, board)
                if checked is None:
                    rejected = True
                else:
                    yield checked + "\n"

        if pending:
            checked = cls._verify_line(pending, board)
            if checked is None:
                rejected = True
            else:
                yield checked
        if rejected:
            yield "\n\n" + VERIFICATION_NOTICE
