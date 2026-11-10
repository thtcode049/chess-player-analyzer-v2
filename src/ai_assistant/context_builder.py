"""
AI Assistant Context Builder Module
------------------------------------
Chức năng: Trích xuất và cấu trúc hóa toàn bộ dữ liệu phân tích khách quan từ
Profile (Repertoire, Pawn Structures)
và Opening Tree (các nhánh thế cờ đã dựng ở bàn cờ phân tích) thành văn bản ngữ cảnh
chuẩn xác (Ground Truth) phục vụ cho LLM.
"""

import re
from typing import Any, Dict, Iterable, List, Optional

import chess

from src.ai_assistant.briefing import format_game_reference, format_group_stats, format_profile_stats
from src.analysis.pawn_structure import CANONICAL_PAWN_SKELETONS


def format_pv_to_san(fen: str, pv_moves: List[str]) -> str:
    """
    Chuyển đổi danh sách nước đi dạng UCI (vd: ['g1f3', 'g8f6', 'g2g3', 'd7d5'])
    thành chuỗi ký hiệu biên bản tiêu chuẩn quốc tế (SAN) có đánh số thứ tự nước đi chuẩn xác.
    Ví dụ:
      - Nếu Trắng đi trước ở nước 1: '1. Nf3 Nf6 2. g3 d5'
      - Nếu Đen đi trước ở nước 1: '1... e5 2. Nf3 Nc6'
    """
    if not pv_moves:
        return ""
    try:
        board = chess.Board(fen)
    except Exception:
        return " ".join(pv_moves)

    san_parts: List[str] = []
    for uci_move in pv_moves:
        try:
            move = chess.Move.from_uci(uci_move)
            if move not in board.legal_moves:
                break
            san = board.san(move)
            num = board.fullmove_number
            if board.turn == chess.WHITE:
                san_parts.append(f"{num}. {san}")
            else:
                if not san_parts:
                    san_parts.append(f"{num}... {san}")
                else:
                    san_parts.append(san)
            board.push(move)
        except Exception:
            break

    return " ".join(san_parts) if san_parts else " ".join(pv_moves)


def summarize_opening_tree(
    fen_map_white: Optional[Dict[str, Any]] = None,
    fen_map_black: Optional[Dict[str, Any]] = None,
    max_depth: int = 3
) -> str:
    """
    Tóm tắt các nhánh chính từ Cây Khai cuộc (Opening Tree) đã xây dựng trên bàn cờ.
    """
    lines = []
    start_fen = chess.Board().fen()

    # 1. Nhánh khi kỳ thủ cầm Trắng (First moves as White)
    if fen_map_white and start_fen in fen_map_white:
        root_w = fen_map_white[start_fen]
        if root_w.children:
            lines.append("### 1. Xu hướng đi quân từ Cây Khai cuộc khi cầm TRẮNG:")
            sorted_moves = sorted(
                root_w.children.items(),
                key=lambda x: x[1].games_count,
                reverse=True
            )
            for move, child in sorted_moves:
                score = round((child.wins + 0.5 * child.draws) / max(1, child.games_count) * 100, 1)
                lines.append(
                    f"  - **1.{move}**: {child.games_count} ván ({child.wins} Thắng / {child.draws} Hòa / {child.losses} Thua, Score: {score}%)"
                )
                if child.children:
                    top_replies = sorted(
                        child.children.items(),
                        key=lambda x: x[1].games_count,
                        reverse=True
                    )[:3]
                    for reply_move, reply_child in top_replies:
                        rep_score = round((reply_child.wins + 0.5 * reply_child.draws) / max(1, reply_child.games_count) * 100, 1)
                        lines.append(
                            f"      ↳ Đáp trả 1.{move} {reply_move}: {reply_child.games_count} ván (Score Trắng: {rep_score}%)"
                        )

    # 2. Nhánh khi kỳ thủ cầm Đen (Responses as Black against 1.e4, 1.d4, 1.c4, 1.Nf3)
    if fen_map_black and start_fen in fen_map_black:
        root_b = fen_map_black[start_fen]
        if root_b.children:
            lines.append("\n### 2. Phản ứng từ Cây Khai cuộc khi cầm ĐEN:")
            sorted_white_openings = sorted(
                root_b.children.items(),
                key=lambda x: x[1].games_count,
                reverse=True
            )
            for w_move, child in sorted_white_openings:
                if child.children:
                    lines.append(f"  - **Khi đối phương mở đầu 1.{w_move}** ({child.games_count} ván gặp):")
                    top_black_replies = sorted(
                        child.children.items(),
                        key=lambda x: x[1].games_count,
                        reverse=True
                    )
                    for b_move, b_child in top_black_replies:
                        b_score = round((b_child.wins + 0.5 * b_child.draws) / max(1, b_child.games_count) * 100, 1)
                        lines.append(
                            f"      ↳ Đối thủ đáp trả **1... {b_move}**: {b_child.games_count} ván ({b_child.wins} Thắng / {b_child.draws} Hòa / {b_child.losses} Thua, Score Đen: {b_score}%)"
                        )

    if not lines:
        return "Chưa có dữ liệu cây khai cuộc chi tiết."
    return "\n".join(lines)


def format_moves_san(moves: Any) -> str:
    """Chuyển danh sách moves hoặc chuỗi moves thành chuỗi SAN có số thứ tự nước đi chuẩn (1. c4 e5 2. Nc3 f5 ...)."""
    if not moves:
        return ""
    if isinstance(moves, str):
        s_moves = moves.strip()
        if re.search(r"\b1\.", s_moves) or re.search(r"\b1\.\.\.", s_moves):
            return s_moves
        tokens = [t.strip() for t in s_moves.split() if t.strip()]
    elif isinstance(moves, list):
        tokens = [str(m).strip() for m in moves if str(m).strip()]
    else:
        return ""

    parts = []
    for i in range(0, len(tokens), 2):
        move_num = (i // 2) + 1
        w = tokens[i]
        b = tokens[i + 1] if i + 1 < len(tokens) else ""
        if b:
            parts.append(f"{move_num}. {w} {b}")
        else:
            parts.append(f"{move_num}. {w}")
    return " ".join(parts)


def format_games_pgn_for_context(
    games: Optional[List[Dict[str, Any]]],
    max_games: int = 15,
    *,
    game_indices: Optional[List[int]] = None,
    sources: Optional[Dict[str, str]] = None,
    source_prefix: str = "",
) -> str:
    """Provide a bounded set of games with references to their snapshot positions."""
    if not games:
        return "Chưa có biên bản ván đấu PGN chi tiết thuộc lượt phân tích này."

    indices = game_indices if game_indices is not None else list(range(min(len(games), max_games)))
    lines = []
    lines.append(f"Biên bản được cung cấp: {len(indices)}/{len(games)} ván của lượt phân tích.")
    for index in indices:
        g = games[index]
        idx = index + 1
        source = f"{source_prefix}G{idx}"
        if sources is not None:
            label = f"Ván {idx}" if not source_prefix else f"Hồ sơ {source_prefix[1:]} · Ván {idx}"
            sources[source] = format_game_reference(g, label)
        white = g.get("white") or g.get("white_player") or "Trắng"
        black = g.get("black") or g.get("black_player") or "Đen"
        w_elo = g.get("white_elo") or ""
        b_elo = g.get("black_elo") or ""
        res = g.get("result") or "*"
        eco = g.get("eco") or ""
        opening = g.get("opening") or g.get("opening_name") or "Khai cuộc không tên"
        raw_h = g.get("raw_headers") or {}
        date = g.get("date") or g.get("played_at") or raw_h.get("Date") or raw_h.get("UTCDate") or "Không rõ ngày"
        event = g.get("event") or raw_h.get("Event") or ""
        site = g.get("site") or g.get("site_url") or raw_h.get("Site") or raw_h.get("Link") or ""
        tc = g.get("time_control") or raw_h.get("TimeControl") or ""
        moves_list = g.get("moves") or g.get("moves_san") or []
        moves_str = format_moves_san(moves_list)

        w_str = f"{white} ({w_elo})" if w_elo else white
        b_str = f"{black} ({b_elo})" if b_elo else black
        lines.append(f"\n#### {{{{{source}}}}} · {w_str} – {b_str}")
        meta_items = [f"**Kết quả**: {res}", f"**Khai cuộc**: {eco} {opening}".strip(), f"**Ngày**: {date}"]
        if event and event not in ["?", "Unknown Event"]:
            meta_items.append(f"**Giải**: {event}")
        if site and site not in ["?", "Unknown Site"]:
            meta_items.append(f"**Nguồn/Link**: {site}")
        if tc and tc != "?":
            meta_items.append(f"**Thời gian**: {tc}")
        lines.append(f"- {' | '.join(meta_items)}")
        if moves_str:
            lines.append(f"- **Biên bản nước đi (PGN)**: {moves_str}")
        else:
            lines.append("- **Biên bản nước đi**: (Chưa có ghi chép nước đi)")

    return "\n".join(lines)


def build_opponent_ai_context(
    deep_profile: Optional[Dict[str, Any]],
    stats: Optional[Dict[str, Any]],
    fen_map_white: Optional[Dict[str, Any]] = None,
    fen_map_black: Optional[Dict[str, Any]] = None,
    selected_player: str = "Kỳ thủ",
    analyzed_games_count: Optional[int] = None,
    total_games_count: Optional[int] = None,
    is_board_open: bool = True,
    current_fen: Optional[str] = None,
    engine_eval: Optional[Dict[str, Any]] = None,
    selected_game: Optional[Dict[str, Any]] = None,
    games: Optional[List[Dict[str, Any]]] = None,
    question: str = "",
    sources: Optional[Dict[str, str]] = None,
    source_prefix: str = "",
) -> str:
    """
    Chuyển đổi toàn bộ dữ liệu thống kê khách quan từ Profile, Cây Khai cuộc,
    Ván đấu đang chọn (selected_game), Thế cờ bàn cờ tương tác (current_fen) và Toàn bộ ván đấu PGN
    thành ngữ cảnh chuẩn xác (Ground Truth) cho Trợ lí AI.
    """
    if not deep_profile and not stats and not games and not selected_game:
        return "Hiện chưa có dữ liệu phân tích nào được nạp."

    deep_profile = deep_profile or {}
    stats = stats or {}

    ctx_parts = []
    ctx_parts.append(f"# BÁO CÁO DỮ LIỆU THỰC NGHIỆM KỲ THỦ: {selected_player.upper()}")
    ctx_parts.append("*(Thống kê quan sát từ lượt phân tích và dữ liệu bàn cờ được cung cấp)*\n")

    # 1. VÁN ĐẤU ĐANG ĐƯỢC CHỌN ĐỂ PHÂN TÍCH TRÊN GIAO DIỆN
    if selected_game:
        g_white = selected_game.get("white") or selected_game.get("white_player") or "Trắng"
        g_black = selected_game.get("black") or selected_game.get("black_player") or "Đen"
        g_w_elo = selected_game.get("white_elo") or ""
        g_b_elo = selected_game.get("black_elo") or ""
        g_res = selected_game.get("result") or "*"
        g_eco = selected_game.get("eco") or ""
        g_open = selected_game.get("opening") or selected_game.get("opening_name") or ""
        raw_h = selected_game.get("raw_headers") or {}
        g_date = selected_game.get("date") or selected_game.get("played_at") or raw_h.get("Date") or raw_h.get("UTCDate") or "Không rõ ngày"
        g_event = selected_game.get("event") or raw_h.get("Event") or ""
        g_site = selected_game.get("site") or selected_game.get("site_url") or raw_h.get("Site") or raw_h.get("Link") or ""
        g_round = selected_game.get("round") or raw_h.get("Round") or ""
        g_tc = selected_game.get("time_control") or raw_h.get("TimeControl") or ""
        g_moves = format_moves_san(selected_game.get("moves_san") or selected_game.get("moves", []))
        curr_ply = selected_game.get("current_ply", 0)
        tot_ply = selected_game.get("total_ply", 0)

        ctx_parts.append("## 🏆 VÁN ĐẤU ĐANG ĐƯỢC CHỌN TRÊN BÀN CỜ ĐỂ PHÂN TÍCH:")
        w_text = f"{g_white} ({g_w_elo})" if g_w_elo else g_white
        b_text = f"{g_black} ({g_b_elo})" if g_b_elo else g_black
        ctx_parts.append(f"- **Cặp đấu**: ⚪ {w_text} vs ⚫ {b_text}")
        ctx_parts.append(f"- **Kết quả**: {g_res}")
        if g_eco or g_open:
            ctx_parts.append(f"- **Khai cuộc**: {g_eco} {g_open}".strip())
        ctx_parts.append(f"- **Ngày thi đấu**: {g_date}")
        if g_event and g_event not in ["?", "Unknown Event"]:
            ctx_parts.append(f"- **Giải đấu / Sự kiện**: {g_event}")
        if g_site and g_site not in ["?", "Unknown Site"]:
            ctx_parts.append(f"- **Nền tảng / Địa điểm (Lichess/Chess.com)**: {g_site}")
        if g_round and g_round != "?":
            ctx_parts.append(f"- **Vòng đấu**: {g_round}")
        if g_tc and g_tc != "?":
            ctx_parts.append(f"- **Kiểm soát thời gian**: {g_tc}")
        if tot_ply > 0:
            ctx_parts.append(f"- **Vị trí nước đi đang xem trên bàn cờ**: Nước {curr_ply}/{tot_ply}")
        if g_moves:
            ctx_parts.append(f"- **TOÀN BỘ BIÊN BẢN NƯỚC ĐI CỦA VÁN ĐẤU (PGN ĐẦY ĐỦ)**:\n  {g_moves}\n")
        ctx_parts.append(
            "> ⚠️ **HƯỚNG DẪN QUAN TRỌNG DÀNH CHO TRỢ LÍ AI**: Người dùng đang chọn xem ván đấu này trên giao diện. "
            "Khi người dùng hỏi 'phân tích toàn bộ ván cờ', 'nhận xét ván này', 'ván cờ diễn ra thế nào' hoặc hỏi về kết quả/sai lầm của ván, "
            "bạn PHẢI phân tích toàn diện toàn bộ tiến trình ván đấu từ Khai cuộc, Trung cuộc đến Kết thúc dựa trên toàn bộ chuỗi nước đi PGN của ván ở trên. "
            "KHÔNG ĐƯỢC chỉ phân tích duy nhất hình cờ FEN hiện tại (hình cờ FEN chỉ là nước cờ người dùng đang tạm dừng để xem trên bàn cờ).\n"
        )

    # 2. THẾ CỜ TRÊN BÀN CỜ TƯƠNG TÁC
    if is_board_open and current_fen:
        ctx_parts.append("## ♟️ THẾ CỜ HIỆN TẠI TRÊN BÀN CỜ TƯƠNG TÁC (BÀN CỜ ĐANG MỞ)")
        ctx_parts.append(f"- **Chuỗi FEN**: `{current_fen}`")
        fen_parts = current_fen.split(" ")
        active_color = "Trắng (White)" if len(fen_parts) > 1 and fen_parts[1] == "w" else "Đen (Black)"
        ctx_parts.append(f"- **Lượt đi**: Đến lượt **{active_color}** đi quân")
        if engine_eval:
            score = engine_eval.get("score")
            score_type = engine_eval.get("scoreType", "cp")
            is_mate = engine_eval.get("isMate") or score_type == "mate"
            mate_in = engine_eval.get("mateIn")

            if is_mate:
                eval_str = f"Chiếu bí sau {mate_in or score} nước (#M{mate_in or score})"
            elif isinstance(score, (int, float)):
                pawn_val = score / 100.0 if abs(score) >= 10 else float(score)
                adv = "Trắng ưu thế nhẹ" if pawn_val > 0.3 else "Đen ưu thế nhẹ" if pawn_val < -0.3 else "Thế cờ cân bằng"
                eval_str = f"{pawn_val:+.2f} Tốt ({int(score)} centipawns - {adv})"
            else:
                eval_str = str(score)

            ctx_parts.append(f"- **Đánh giá Stockfish**: `{eval_str}`")
            best_move = engine_eval.get("bestMoveSan")
            if not best_move and engine_eval.get("bestMove"):
                raw_bm = str(engine_eval.get("bestMove")).strip()
                try:
                    b_test = chess.Board(current_fen)
                    m_test = chess.Move.from_uci(raw_bm)
                    if m_test in b_test.legal_moves:
                        best_move = b_test.san(m_test)
                    else:
                        best_move = raw_bm
                except Exception:
                    best_move = raw_bm

            if best_move:
                try:
                    b_bm = chess.Board(current_fen)
                    move_pfx = f"{b_bm.fullmove_number}. " if b_bm.turn == chess.WHITE else f"{b_bm.fullmove_number}... "
                except Exception:
                    move_pfx = ""
                ctx_parts.append(f"- **Nước đi tối ưu Stockfish đề xuất**: **{move_pfx}{best_move}** (Ký hiệu SAN chuẩn)")
            if engine_eval.get("pv"):
                pv_san = format_pv_to_san(current_fen, engine_eval.get("pv")[:8])
                if pv_san:
                    ctx_parts.append(f"- **Biến thể dự tính chính (PV line chuẩn SAN)**: {pv_san}")

        if selected_game:
            board_moves = format_moves_san(selected_game.get("moves_san") or selected_game.get("moves", []))
            curr_ply = selected_game.get("current_ply", 0)
            tot_ply = selected_game.get("total_ply", 0)
            if board_moves:
                ctx_parts.append(f"- **Biên bản toàn bộ nước đi đã chơi trên bàn cờ (Move History / PGN)**: {board_moves} (Đang xem ở Nước {curr_ply}/{tot_ply})")
                ctx_parts.append(
                    "> 💡 **HƯỚNG DẪN QUAN TRỌNG VỀ KHAI CUỘC & TIẾN TRÌNH**: Toàn bộ chuỗi nước đi đã chơi trên bàn cờ được cung cấp ở trên (bắt đầu từ nước 1...). "
                    "Khi người dùng hỏi 'ván này dùng khai cuộc gì', 'khai cuộc gì', 'các nước đi tiếp theo', hoặc hỏi về kế hoạch ván đấu, "
                    "bạn PHẢI tra cứu trực tiếp từ chuỗi nước đi trên bàn cờ ở trên (ví dụ: nước đầu 1. c4 là Khai cuộc Anh - English Opening, 1. e4 e5 là Khai cuộc Mở, v.v.) "
                    "để trả lời chính xác tên khai cuộc, biến thể và phân tích kế hoạch. TUYỆT ĐỐI KHÔNG trả lời rằng bạn không có chuỗi nước đi PGN!"
                )

        # Nạp Bảng sự thật thế cờ (Ground Truth Factsheet) tính toán chính xác 100% bằng python-chess
        try:
            from src.ai_assistant.position_facts import PositionFacts
            facts = PositionFacts(current_fen, engine_eval=engine_eval)
            ctx_parts.append("\n" + facts.generate_factsheet_markdown())
        except Exception:
            pass
        ctx_parts.append("")
    elif not is_board_open:
        ctx_parts.append("## ♟️ TRẠNG THÁI BÀN CỜ TƯƠNG TÁC")
        ctx_parts.append("- **Bàn cờ hiện tại**: ĐANG ĐÓNG.")
        ctx_parts.append("- **Quy tắc**: Bạn KHÔNG cần bình luận về thế cờ hay điểm số Stockfish nếu người dùng chỉ hỏi về ván đấu hoặc lý thuyết. NẾU người dùng hỏi về một thế cờ cụ thể hoặc bạn thấy cần thiết phải mở bàn cờ để minh họa một hình cờ, hãy viết mã `[OPEN_BOARD]` hoặc `[OPEN_BOARD: <chuỗi FEN>]` trong câu trả lời để hệ thống tự động mở bàn cờ cho người dùng.")
        ctx_parts.append("")

    rep = deep_profile.get("repertoire", {})
    structs = deep_profile.get("structures", {}).get("structures", [])
    query = question.casefold().strip()

    def asked_about(item: Dict[str, Any]) -> bool:
        name = str(item.get("name") or "").casefold()
        return bool(name and name in query)

    preferred_indices = {
        index
        for item in rep.get("all_openings", [])
        if asked_about(item)
        for index in item.get("game_indices", [])
    }
    for structure in structs:
        if asked_about(structure):
            preferred_indices.update(game.get("game_index") for game in structure.get("games", []))
    indices = sorted(range(len(games or [])), key=lambda index: index not in preferred_indices)[:15]
    provided_indices = set(indices)
    stat_index = 0

    def observed(text: str, evidence_indices: Iterable[int] = ()) -> str:
        nonlocal stat_index
        stat_index += 1
        key = f"{source_prefix}S{stat_index}"
        if sources is not None:
            sources[key] = text
        references = [
            "{{" + f"{source_prefix}G{index + 1}" + "}}"
            for index in evidence_indices if index in provided_indices
        ]
        suffix = f" · Ván tham chiếu: {', '.join(references[:3])}" if references else ""
        return f"{{{{{key}}}}} {text}{suffix}"

    ctx_parts.append("## I. THỐNG KÊ TỔNG QUAN")
    if stats:
        ctx_parts.extend(
            "- " + observed(f"**{selected_player}** · {line.removeprefix('- ')}")
            for line in format_profile_stats(stats)
        )
    else:
        ctx_parts.append("Chưa có thống kê hồ sơ.")

    if fen_map_white or fen_map_black:
        ctx_parts.append("\n## II. CÂY KHAI CUỘC (OPENING TREE)")
        ctx_parts.append(summarize_opening_tree(fen_map_white, fen_map_black))

    ctx_parts.append("\n## III. KHAI CUỘC THEO MÀU QUÂN")
    for key, label in (("white_repertoire", "Cầm Trắng"), ("black_repertoire", "Cầm Đen")):
        items = rep.get(key, [])
        if items:
            ctx_parts.append(f"### {label}")
            for item in sorted(items, key=lambda entry: not asked_about(entry))[:6]:
                text = f"**{selected_player} · {label} · {item['name']}** · {format_group_stats(item)}"
                ctx_parts.append("- " + observed(text, item.get("game_indices", [])))

    ctx_parts.append("\n## IV. CẤU TRÚC TỐT")
    if structs:
        ctx_parts.append("Một ván có thể xuất hiện trong nhiều nhóm cấu trúc Tốt.")
        for item in sorted(structs, key=lambda entry: not asked_about(entry))[:6]:
            text = f"**{selected_player} · {item['name']}** · {format_group_stats(item)}"
            move = item.get("typical_formation_move")
            if move is not None:
                text += f" · Hình thành khoảng nước {move}"
            members = [game for game in item.get("games", []) if game.get("game_index") in provided_indices]
            ctx_parts.append("- " + observed(text, [game["game_index"] for game in members]))
            for game in members[:2]:
                if game.get("formation_fen"):
                    source = "{{" + f"{source_prefix}G{game['game_index'] + 1}" + "}}"
                    ctx_parts.append(f"  - {source} · nước {game.get('formation_move')} · FEN {game['formation_fen']}")

    ctx_parts.append("\n### Bảng Tra cứu 28 Hình thái Cấu trúc Tốt Chuẩn (Flores Rios Ground Truth):")
    for k, data in CANONICAL_PAWN_SKELETONS.items():
        ctx_parts.append(f"- **{data['name']}** ({data['vietnamese_name']}) [{data['chapter']}]: `{data['fen']}`")

    ctx_parts.append("\n## V. BIÊN BẢN ĐƯỢC CUNG CẤP CHO CÂU HỎI")
    if games and len(indices) < len(games):
        ctx_parts.append("Ưu tiên ván thuộc nhóm được nhắc trong câu hỏi, sau đó lấy theo thứ tự của lượt phân tích.")
    ctx_parts.append(format_games_pgn_for_context(
        games, game_indices=indices, sources=sources, source_prefix=source_prefix,
    ))

    return "\n".join(ctx_parts)


build_player_ai_context = build_opponent_ai_context
