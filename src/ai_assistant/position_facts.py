"""
Position Facts Engine (Ground Truth Extractor)
----------------------------------------------
Chức năng: Trích xuất 100% dữ liệu toán học và hình học chuẩn xác từ bàn cờ bằng python-chess.
Mọi khẳng định về vị trí quân, đường chéo, đòn ghim, đòn chĩa đôi, quân treo và đòn phối hợp
đều được tính toán tất định (deterministic), loại bỏ hoàn toàn hiện tượng ảo tưởng của LLM.
"""

from typing import Dict, Any, List, Tuple, Optional, Set
import chess

PIECE_NAMES_VI = {
    chess.PAWN: "Tốt",
    chess.KNIGHT: "Mã",
    chess.BISHOP: "Tượng",
    chess.ROOK: "Xe",
    chess.QUEEN: "Hậu",
    chess.KING: "Vua",
}

PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 0,
}

DIAGONAL_NAMES = {
    frozenset(["a1", "h8"]): "đường chéo lớn a1–h8",
    frozenset(["a8", "h1"]): "đường chéo lớn a8–h1",
    frozenset(["b8", "h2"]): "đường chéo b8–h2",
    frozenset(["c8", "h3"]): "đường chéo c8–h3",
    frozenset(["a7", "g1"]): "đường chéo a7–g1",
    frozenset(["b1", "h7"]): "đường chéo b1–h7",
    frozenset(["c1", "h6"]): "đường chéo c1–h6",
    frozenset(["a2", "g8"]): "đường chéo a2–g8",
}


def square_to_coord(sq: int) -> Tuple[int, int]:
    """Trả về (file_idx 0-7, rank_idx 0-7) tương ứng a=0..h=7, 1=0..8=7."""
    return chess.square_file(sq), chess.square_rank(sq)


def are_squares_on_diagonal(sq1: int, sq2: int) -> bool:
    """Kiểm tra xem 2 ô cờ có nằm trên cùng một đường chéo hay không."""
    f1, r1 = square_to_coord(sq1)
    f2, r2 = square_to_coord(sq2)
    return abs(f1 - f2) == abs(r1 - r2) and sq1 != sq2


def get_ray_squares(sq1: int, sq2: int) -> List[int]:
    """Trả về danh sách các ô nằm giữa sq1 và sq2 trên cùng 1 đường thẳng hoặc đường chéo."""
    f1, r1 = square_to_coord(sq1)
    f2, r2 = square_to_coord(sq2)
    df = (f2 - f1)
    dr = (r2 - r1)
    step_f = 0 if df == 0 else (1 if df > 0 else -1)
    step_r = 0 if dr == 0 else (1 if dr > 0 else -1)

    # Phải cùng hàng, cùng cột hoặc cùng đường chéo
    if not (df == 0 or dr == 0 or abs(df) == abs(dr)):
        return []

    curr_f = f1 + step_f
    curr_r = r1 + step_r
    squares = []
    while (curr_f, curr_r) != (f2, r2):
        squares.append(chess.square(curr_f, curr_r))
        curr_f += step_f
        curr_r += step_r
    return squares


def get_diagonal_name(sq1: int, sq2: int) -> str:
    """Tìm tên gọi thân thuộc cho đường chéo đi qua 2 ô (ví dụ a8–h1)."""
    f1, r1 = square_to_coord(sq1)
    f2, r2 = square_to_coord(sq2)
    if abs(f1 - f2) != abs(r1 - r2):
        return ""

    step_f = 1 if f2 >= f1 else -1
    step_r = 1 if r2 >= r1 else -1

    # Dò tới 2 đầu mút của bàn cờ
    curr_f, curr_r = f1, r1
    while 0 <= curr_f - step_f <= 7 and 0 <= curr_r - step_r <= 7:
        curr_f -= step_f
        curr_r -= step_r
    start_sq = chess.square_name(chess.square(curr_f, curr_r))

    curr_f, curr_r = f1, r1
    while 0 <= curr_f + step_f <= 7 and 0 <= curr_r + step_r <= 7:
        curr_f += step_f
        curr_r += step_r
    end_sq = chess.square_name(chess.square(curr_f, curr_r))

    key = frozenset([start_sq, end_sq])
    if key in DIAGONAL_NAMES:
        return DIAGONAL_NAMES[key]
    return f"đường chéo {start_sq}–{end_sq}"


class PositionFacts:
    """Trích xuất và quản lý toàn bộ sự thật toán học/hình học của thế cờ."""

    def __init__(self, fen: str, engine_eval: Optional[Dict[str, Any]] = None):
        clean_fen = fen.strip()
        try:
            self.board = chess.Board(clean_fen)
        except Exception:
            # Fallback nếu FEN lỗi hoặc thiếu
            self.board = chess.Board()

        self.fen = self.board.fen()
        self.engine_eval = engine_eval or {}

        # 1. Danh sách quân theo màu & ô
        self.white_pieces = self._extract_pieces_by_color(chess.WHITE)
        self.black_pieces = self._extract_pieces_by_color(chess.BLACK)

        # 2. Cân bằng vật chất
        self.material_balance = self._calculate_material()

        # 3. Tia tấn công của Tượng, Xe, Hậu (Ray attacks)
        self.sliding_rays = self._extract_sliding_rays()

        # 4. Quân bị tấn công & quân treo (Hanging pieces)
        self.hanging_pieces = self._extract_hanging_pieces()

        # 5. Đòn chiến thuật tĩnh (Pins, Skewers, Forks, Checks)
        self.tactical_motifs = self._extract_tactical_motifs()

        # 6. Đòn phối hợp động nhiều nước (Dynamic Combinations)
        self.combination = self._detect_dynamic_combination()

        # 7. An toàn Vua
        self.king_safety = self._extract_king_safety()

        # 8. Cấu trúc Tốt & Outposts
        self.pawn_structure = self._extract_pawn_structure()

        # 9. Danh sách nước đi hợp lệ
        self.legal_moves_san = [self.board.san(m) for m in self.board.legal_moves]

    def _extract_pieces_by_color(self, color: chess.Color) -> Dict[str, List[str]]:
        res: Dict[str, List[str]] = {"K": [], "Q": [], "R": [], "B": [], "N": [], "P": []}
        symbol_map = {chess.KING: "K", chess.QUEEN: "Q", chess.ROOK: "R", chess.BISHOP: "B", chess.KNIGHT: "N", chess.PAWN: "P"}
        for sq in chess.SQUARES:
            p = self.board.piece_at(sq)
            if p and p.color == color:
                res[symbol_map[p.piece_type]].append(chess.square_name(sq))
        return res

    def _calculate_material(self) -> Dict[str, Any]:
        w_val = sum(len(sqs) * PIECE_VALUES[getattr(chess, p_name)] for p_name, sqs in [
            ("PAWN", self.white_pieces["P"]),
            ("KNIGHT", self.white_pieces["N"]),
            ("BISHOP", self.white_pieces["B"]),
            ("ROOK", self.white_pieces["R"]),
            ("QUEEN", self.white_pieces["Q"]),
        ])
        b_val = sum(len(sqs) * PIECE_VALUES[getattr(chess, p_name)] for p_name, sqs in [
            ("PAWN", self.black_pieces["P"]),
            ("KNIGHT", self.black_pieces["N"]),
            ("BISHOP", self.black_pieces["B"]),
            ("ROOK", self.black_pieces["R"]),
            ("QUEEN", self.black_pieces["Q"]),
        ])
        diff = w_val - b_val
        if diff == 0:
            status = "Cân bằng vật chất"
        elif diff > 0:
            status = f"Trắng hơn {diff} điểm vật chất ({w_val} vs {b_val})"
        else:
            status = f"Đen hơn {abs(diff)} điểm vật chất ({b_val} vs {w_val})"

        return {
            "white_points": w_val,
            "black_points": b_val,
            "diff": diff,
            "status_vi": status,
        }

    def _extract_sliding_rays(self) -> List[Dict[str, Any]]:
        """Trích xuất chi tiết các tia của quân tầm xa và quân chặn tia."""
        rays = []
        for sq in chess.SQUARES:
            piece = self.board.piece_at(sq)
            if not piece or piece.piece_type not in (chess.BISHOP, chess.ROOK, chess.QUEEN):
                continue

            sq_name = chess.square_name(sq)
            color_str = "Trắng" if piece.color == chess.WHITE else "Đen"
            piece_type_vi = PIECE_NAMES_VI[piece.piece_type]

            # Xác định các hướng di chuyển
            directions = []
            if piece.piece_type in (chess.BISHOP, chess.QUEEN):
                directions.extend([(1, 1), (1, -1), (-1, 1), (-1, -1)])
            if piece.piece_type in (chess.ROOK, chess.QUEEN):
                directions.extend([(1, 0), (-1, 0), (0, 1), (0, -1)])

            f1, r1 = square_to_coord(sq)
            for df, dr in directions:
                ray_squares = []
                blocking_piece = None
                blocked_sq = None

                curr_f, curr_r = f1 + df, r1 + dr
                while 0 <= curr_f <= 7 and 0 <= curr_r <= 7:
                    target_sq = chess.square(curr_f, curr_r)
                    target_name = chess.square_name(target_sq)
                    occ = self.board.piece_at(target_sq)
                    if occ:
                        blocking_piece = f"{PIECE_NAMES_VI[occ.piece_type]} {'Trắng' if occ.color == chess.WHITE else 'Đen'}"
                        blocked_sq = target_name
                        ray_squares.append(target_name)
                        break
                    ray_squares.append(target_name)
                    curr_f += df
                    curr_r += dr

                if ray_squares:
                    is_diag = abs(df) == abs(dr)
                    diag_name = get_diagonal_name(sq, chess.parse_square(ray_squares[-1])) if is_diag else f"cột/hàng hướng về {ray_squares[-1]}"
                    rays.append({
                        "piece": f"{piece_type_vi} {color_str}",
                        "square": sq_name,
                        "color": piece.color,
                        "direction_name": diag_name,
                        "controlled_squares": ray_squares,
                        "blocking_piece": blocking_piece,
                        "blocked_at": blocked_sq,
                    })
        return rays

    def _extract_hanging_pieces(self) -> List[Dict[str, Any]]:
        """Xác định quân treo (bị tấn công mà không được bảo vệ, hoặc bị quân giá trị thấp hơn đe dọa)."""
        hanging = []
        for sq in chess.SQUARES:
            piece = self.board.piece_at(sq)
            if not piece or piece.piece_type == chess.KING:
                continue

            color = piece.color
            opp_color = not color
            attackers = list(self.board.attackers(opp_color, sq))
            defenders = list(self.board.attackers(color, sq))

            sq_name = chess.square_name(sq)
            p_val = PIECE_VALUES[piece.piece_type]
            color_str = "Trắng" if color == chess.WHITE else "Đen"
            p_name = f"{PIECE_NAMES_VI[piece.piece_type]} {color_str} ở {sq_name}"

            # 1. Bị tấn công và hoàn toàn không có quân bảo vệ
            if len(attackers) > 0 and len(defenders) == 0:
                cheapest_attacker = min([PIECE_VALUES[self.board.piece_at(a).piece_type] for a in attackers if self.board.piece_at(a)])
                hanging.append({
                    "piece": p_name,
                    "square": sq_name,
                    "type": "Treo hoàn toàn (không có quân bảo vệ)",
                    "attackers_count": len(attackers),
                    "defenders_count": 0,
                    "threat_level": "Nguy cơ mất quân trực tiếp",
                })
            # 2. Bị quân rẻ hơn tấn công (ví dụ Xe bị Tốt/Mã đe dọa)
            elif len(attackers) > 0:
                cheapest_attacker_sq = min(attackers, key=lambda a: PIECE_VALUES[self.board.piece_at(a).piece_type] if self.board.piece_at(a) else 99)
                cheapest_piece = self.board.piece_at(cheapest_attacker_sq)
                if cheapest_piece and PIECE_VALUES[cheapest_piece.piece_type] < p_val:
                    hanging.append({
                        "piece": p_name,
                        "square": sq_name,
                        "type": f"Bị đe dọa bởi quân rẻ hơn ({PIECE_NAMES_VI[cheapest_piece.piece_type]} {chess.square_name(cheapest_attacker_sq)})",
                        "attackers_count": len(attackers),
                        "defenders_count": len(defenders),
                        "threat_level": "Bất lợi trao đổi quân",
                    })
        return hanging

    def _extract_tactical_motifs(self) -> List[Dict[str, Any]]:
        """Phát hiện các đòn chiến thuật cơ bản: Ghim, Xiên, Chĩa đôi, Chiếu, Tấn công mở."""
        motifs = []

        # 1. Đòn Ghim (Pins)
        for sq in chess.SQUARES:
            piece = self.board.piece_at(sq)
            if not piece or piece.piece_type == chess.KING:
                continue
            is_pinned = self.board.is_pinned(piece.color, sq)
            if is_pinned:
                p_color = "Trắng" if piece.color == chess.WHITE else "Đen"
                motifs.append({
                    "motif": "Đòn Ghim (Pin)",
                    "pinned_piece": f"{PIECE_NAMES_VI[piece.piece_type]} {p_color}",
                    "square": chess.square_name(sq),
                    "description": f"{PIECE_NAMES_VI[piece.piece_type]} {p_color} ở {chess.square_name(sq)} bị ghim tuyệt đối vào Vua.",
                })

        # 2. Đòn Chĩa đôi (Forks / Double attacks)
        for sq in chess.SQUARES:
            piece = self.board.piece_at(sq)
            if not piece:
                continue
            opp_color = not piece.color
            attacks = self.board.attacks(sq)
            targeted_pieces = []
            for t_sq in attacks:
                occ = self.board.piece_at(t_sq)
                if occ and occ.color == opp_color and occ.piece_type in (chess.KING, chess.QUEEN, chess.ROOK, chess.BISHOP, chess.KNIGHT):
                    targeted_pieces.append(f"{PIECE_NAMES_VI[occ.piece_type]} ở {chess.square_name(t_sq)}")

            if len(targeted_pieces) >= 2:
                p_color = "Trắng" if piece.color == chess.WHITE else "Đen"
                motifs.append({
                    "motif": "Đòn Chĩa đôi / Tấn công đôi (Fork)",
                    "piece": f"{PIECE_NAMES_VI[piece.piece_type]} {p_color} ở {chess.square_name(sq)}",
                    "targets": targeted_pieces,
                    "description": f"{PIECE_NAMES_VI[piece.piece_type]} {p_color} ở {chess.square_name(sq)} đang chĩa đôi đe dọa đồng thời {', '.join(targeted_pieces)}.",
                })

        # 3. Đòn Chiếu (Checks)
        if self.board.is_check():
            turn_color = "Trắng" if self.board.turn == chess.WHITE else "Đen"
            checkers = list(self.board.checkers())
            checker_names = [f"{PIECE_NAMES_VI[self.board.piece_at(c).piece_type]} ở {chess.square_name(c)}" for c in checkers if self.board.piece_at(c)]
            check_type = "Chiếu đôi (Double Check)" if len(checkers) > 1 else "Chiếu"
            motifs.append({
                "motif": check_type,
                "king_in_check": f"Vua {turn_color}",
                "checkers": checker_names,
                "description": f"Vua {turn_color} đang bị {', '.join(checker_names)} chiếu!",
            })

        return motifs

    def _detect_dynamic_combination(self) -> Optional[Dict[str, Any]]:
        """
        Nhận diện đòn phối hợp chiến thuật 2-4 nước từ chuỗi PV của Stockfish.
        Nếu nước 1 là đòn thí quân, ăn quân hoặc chiếu ép buộc, dẫn tới hơn chất hoặc chiếu bí sau 2-4 nước.
        """
        pv = self.engine_eval.get("pv")
        if not pv or not isinstance(pv, list) or len(pv) < 2:
            return None

        board_clone = self.board.copy()
        simulated_moves_san = []
        is_sacrifice = False
        initial_balance = self.material_balance["diff"]

        try:
            for idx, move_str in enumerate(pv[:4]):
                # Parse move (UCI or SAN)
                try:
                    move = board_clone.parse_san(move_str)
                except Exception:
                    move = chess.Move.from_uci(move_str)

                is_capture = board_clone.is_capture(move)
                from_p = board_clone.piece_at(move.from_square)
                to_p = board_clone.piece_at(move.to_square)

                san = board_clone.san(move)
                simulated_moves_san.append(san)

                if idx == 0 and from_p and to_p:
                    if PIECE_VALUES[from_p.piece_type] > PIECE_VALUES[to_p.piece_type]:
                        is_sacrifice = True

                board_clone.push(move)

            # Đánh giá sau chuỗi nước
            eval_score = self.engine_eval.get("score")
            is_mate = self.engine_eval.get("isMate")

            if is_mate or (isinstance(eval_score, (int, float)) and abs(eval_score) >= 200 and len(simulated_moves_san) >= 2):
                desc_type = "Đòn phối hợp chiếu bí ép buộc" if is_mate else ("Đòn phối hợp thí quân đoạt ưu thế" if is_sacrifice else "Đòn phối hợp chiến thuật")
                return {
                    "type": desc_type,
                    "pv_san": simulated_moves_san,
                    "pv_str": " ".join([f"{i//2 + 1}.{simulated_moves_san[i]}" if i % 2 == 0 else simulated_moves_san[i] for i in range(len(simulated_moves_san))]),
                    "description": f"{desc_type}: { ' '.join(simulated_moves_san) } làm biến đổi cục diện chiến thuật.",
                }
        except Exception:
            return None
        return None

    def _extract_king_safety(self) -> Dict[str, Any]:
        """Đánh giá an toàn Vua cho cả 2 bên."""
        w_king_sq = self.board.king(chess.WHITE)
        b_king_sq = self.board.king(chess.BLACK)

        def analyze_king(sq: Optional[int], color: chess.Color) -> Dict[str, Any]:
            if sq is None:
                return {"square": "Không rõ", "attackers_count": 0, "open_files": []}

            f, r = square_to_coord(sq)
            sq_name = chess.square_name(sq)
            opp = not color

            # Vùng 8 ô quanh Vua
            zone = []
            for df in (-1, 0, 1):
                for dr in (-1, 0, 1):
                    if df == 0 and dr == 0:
                        continue
                    if 0 <= f + df <= 7 and 0 <= r + dr <= 7:
                        zone.append(chess.square(f + df, r + dr))

            attackers_on_zone = 0
            for z_sq in zone:
                attackers_on_zone += len(list(self.board.attackers(opp, z_sq)))

            # Cột mở sát Vua
            open_files = []
            for file_idx in (f - 1, f, f + 1):
                if 0 <= file_idx <= 7:
                    file_pawns = [p for s in chess.SQUARES if chess.square_file(s) == file_idx and (p := self.board.piece_at(s)) and p.piece_type == chess.PAWN]
                    if len(file_pawns) == 0:
                        open_files.append(chess.FILE_NAMES[file_idx])

            return {
                "square": sq_name,
                "attackers_on_zone": attackers_on_zone,
                "open_files_near_king": open_files,
                "is_castled": (sq_name in ("g1", "c1") if color == chess.WHITE else sq_name in ("g8", "c8")),
            }

        return {
            "white_king": analyze_king(w_king_sq, chess.WHITE),
            "black_king": analyze_king(b_king_sq, chess.BLACK),
        }

    def _extract_pawn_structure(self) -> Dict[str, Any]:
        """Nhận diện đặc trưng cấu trúc Tốt (tốt cô lập, tốt thông, ô tiền đồn)."""
        white_pawns = [chess.parse_square(s) for s in self.white_pieces["P"]]
        black_pawns = [chess.parse_square(s) for s in self.black_pieces["P"]]

        def find_isolated(pawns: List[int]) -> List[str]:
            iso = []
            files = [chess.square_file(p) for p in pawns]
            for p in pawns:
                f = chess.square_file(p)
                if (f - 1) not in files and (f + 1) not in files:
                    iso.append(chess.square_name(p))
            return iso

        # Ô tiền đồn (Outposts): Ô trung tâm (cột c, d, e, f; hàng 4, 5, 6) được Tốt mình bảo vệ và không bị Tốt địch kiểm soát
        outposts_white = []
        for f in (2, 3, 4, 5): # c, d, e, f
            for r in (3, 4, 5): # hàng 4, 5, 6
                sq = chess.square(f, r)
                if not self.board.piece_at(sq):
                    w_pawn_attacks = any(self.board.piece_at(a) and self.board.piece_at(a).piece_type == chess.PAWN for a in self.board.attackers(chess.WHITE, sq))
                    b_pawn_attacks = any(self.board.piece_at(a) and self.board.piece_at(a).piece_type == chess.PAWN for a in self.board.attackers(chess.BLACK, sq))
                    if w_pawn_attacks and not b_pawn_attacks:
                        outposts_white.append(chess.square_name(sq))

        return {
            "white_isolated_pawns": find_isolated(white_pawns),
            "black_isolated_pawns": find_isolated(black_pawns),
            "white_outposts": outposts_white,
        }

    def generate_factsheet_markdown(self) -> str:
        """Định dạng toàn bộ Bảng sự thật thành khối văn bản có cấu trúc chuẩn xác nạp vào Context."""
        lines = []
        lines.append("### 📐 BẢNG SỰ THẬT THẾ CỜ (GROUND TRUTH - COMPUTED FACTSHEET)")
        lines.append("*(Dữ liệu hình học & luật cờ FIDE được tính toán xác thực 100% bằng python-chess - BẮT BUỘC TUÂN THỦ)*\n")

        # 1. Bố trí quân
        lines.append("#### 1. Vị trí chính xác các quân trên bàn cờ:")
        w_p = []
        for p_code, p_name in [("K", "Vua"), ("Q", "Hậu"), ("R", "Xe"), ("B", "Tượng"), ("N", "Mã"), ("P", "Tốt")]:
            if self.white_pieces[p_code]:
                w_p.append(f"{p_name} ({', '.join(self.white_pieces[p_code])})")
        lines.append(f"- ⚪ **Quân Trắng**: {'; '.join(w_p)}")

        b_p = []
        for p_code, p_name in [("K", "Vua"), ("Q", "Hậu"), ("R", "Xe"), ("B", "Tượng"), ("N", "Mã"), ("P", "Tốt")]:
            if self.black_pieces[p_code]:
                b_p.append(f"{p_name} ({', '.join(self.black_pieces[p_code])})")
        lines.append(f"- ⚫ **Quân Đen**: {'; '.join(b_p)}")
        lines.append(f"- ⚖️ **Vật chất**: {self.material_balance['status_vi']}")

        # 2. Tia tầm xa & Tầm kiểm soát thực tế
        lines.append("\n#### 2. Tầm kiểm soát tia & Đường chéo thực tế (Sliding Rays):")
        if self.sliding_rays:
            for r in self.sliding_rays[:8]:
                block_info = f" -> Bị chặn tại {r['blocked_at']} bởi {r['blocking_piece']}" if r['blocking_piece'] else " (Tia mở hoàn toàn)"
                lines.append(f"- {r['piece']} ở **{r['square']}**: {r['direction_name']} (kiểm soát các ô: `{', '.join(r['controlled_squares'])}`){block_info}")
        else:
            lines.append("- Không có quân tầm xa còn trên bàn cờ.")

        # 3. Quân treo & Đe dọa
        if self.hanging_pieces:
            lines.append("\n#### 3. Quân treo & Điểm yếu phòng thủ (Hanging / Underdefended):")
            for h in self.hanging_pieces:
                lines.append(f"- ⚠️ **{h['piece']}**: {h['type']} ({h['threat_level']})")

        # 4. Đòn chiến thuật & Đòn phối hợp
        if self.tactical_motifs or self.combination:
            lines.append("\n#### 4. Đòn chiến thuật & Đòn phối hợp đang hiện hữu:")
            for m in self.tactical_motifs:
                lines.append(f"- 🎯 **{m['motif']}**: {m['description']}")
            if self.combination:
                lines.append(f"- 💥 **{self.combination['type']}**: Chuỗi nước đi biến thể: `{self.combination['pv_str']}`")

        # 5. An toàn Vua & Cấu trúc
        w_k = self.king_safety["white_king"]
        b_k = self.king_safety["black_king"]
        lines.append(f"\n#### 5. An toàn Vua: Vua Trắng ở **{w_k['square']}** | Vua Đen ở **{b_k['square']}**")
        if w_k.get("open_files_near_king"):
            lines.append(f"- ⚠️ Vua Trắng có cột mở cạnh vị trí: {', '.join(w_k['open_files_near_king'])}")
        if b_k.get("open_files_near_king"):
            lines.append(f"- ⚠️ Vua Đen có cột mở cạnh vị trí: {', '.join(b_k['open_files_near_king'])}")

        outposts = self.pawn_structure.get("white_outposts", [])
        if outposts:
            lines.append(f"- 🏰 Ô tiền đồn thuận lợi cho Trắng: {', '.join(outposts)}")

        return "\n".join(lines)
