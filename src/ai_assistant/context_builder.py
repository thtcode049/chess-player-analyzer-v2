"""
AI Assistant Context Builder Module
------------------------------------
Chức năng: Trích xuất và cấu trúc hóa toàn bộ dữ liệu phân tích khách quan từ
Profile (Repertoire, Pawn Structures, Style Profile, Phase Accuracy, Simplification)
và Opening Tree (các nhánh thế cờ đã dựng ở bàn cờ phân tích) thành văn bản ngữ cảnh
chuẩn xác (Ground Truth) phục vụ cho LLM.
"""

from typing import Dict, Any, List, Optional
import chess


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
    """Chuyển danh sách moves thành chuỗi SAN có số thứ tự nước đi (1.e4 e5 2.Nf3 ...)."""
    if isinstance(moves, str):
        return moves.strip()
    if isinstance(moves, list):
        tokens = []
        for i in range(0, len(moves), 2):
            move_num = (i // 2) + 1
            w = moves[i]
            b = moves[i + 1] if i + 1 < len(moves) else ""
            if b:
                tokens.append(f"{move_num}.{w} {b}")
            else:
                tokens.append(f"{move_num}.{w}")
        return " ".join(tokens)
    return ""


def format_games_pgn_for_context(games: Optional[List[Dict[str, Any]]], max_games: int = 100) -> str:
    """
    Định dạng toàn bộ biên bản ván đấu (PGN) của kỳ thủ thành văn bản có cấu trúc
    để nạp vào Context cho Trợ lí AI phân tích trực tiếp.
    """
    if not games:
        return "Chưa có biên bản ván đấu PGN chi tiết."

    lines = []
    lines.append(f"### Tổng hợp {min(len(games), max_games)} ván đấu PGN thực tế của kỳ thủ:")
    for idx, g in enumerate(games[:max_games], 1):
        white = g.get("white") or g.get("white_player") or "Trắng"
        black = g.get("black") or g.get("black_player") or "Đen"
        w_elo = g.get("white_elo") or ""
        b_elo = g.get("black_elo") or ""
        res = g.get("result") or "*"
        eco = g.get("eco") or ""
        opening = g.get("opening") or g.get("opening_name") or "Khai cuộc không tên"
        date = g.get("date") or g.get("played_at") or "Không rõ ngày"
        moves_list = g.get("moves") or g.get("moves_san") or []
        moves_str = format_moves_san(moves_list)

        w_str = f"{white} ({w_elo})" if w_elo else white
        b_str = f"{black} ({b_elo})" if b_elo else black
        lines.append(f"\n#### [Ván {idx}] ⚪ {w_str} vs ⚫ {b_str}")
        lines.append(f"- **Kết quả**: {res} | **Khai cuộc**: {eco} {opening} | **Ngày**: {date}")
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
    current_fen: Optional[str] = None,
    engine_eval: Optional[Dict[str, Any]] = None,
    games: Optional[List[Dict[str, Any]]] = None
) -> str:
    """
    Chuyển đổi toàn bộ dữ liệu thống kê khách quan từ Profile, Cây Khai cuộc,
    Thế cờ bàn cờ tương tác (current_fen, engine_eval) và Toàn bộ ván đấu PGN
    thành ngữ cảnh chuẩn xác (Ground Truth) cho Trợ lí AI.
    """
    if not deep_profile and not stats and not games:
        return "Hiện chưa có dữ liệu phân tích nào được nạp."

    deep_profile = deep_profile or {}
    stats = stats or {}

    ctx_parts = []
    ctx_parts.append(f"# BÁO CÁO DỮ LIỆU THỰC NGHIỆM KỲ THỦ: {selected_player.upper()}")
    ctx_parts.append("*(Nguồn dữ liệu thực nghiệm: 100% trích xuất từ ván đấu thực tế & bàn cờ phân tích)*\n")

    if analyzed_games_count is not None and total_games_count is not None and total_games_count > analyzed_games_count:
        ctx_parts.append(
            f"⚠️ **CẢNH BÁO ĐỘ TIN CẬY DỮ LIỆU ĐÁNH GIÁ NƯỚC ĐI**: "
            f"Hệ thống hiện mới chỉ phân tích mẫu **{analyzed_games_count}/{total_games_count} ván**.\n"
        )

    # 1. THẾ CỜ TRÊN BÀN CỜ TƯƠNG TÁC (NẾU ĐANG THAO TÁC)
    if current_fen:
        ctx_parts.append("## ♟️ THẾ CỜ HIỆN TẠI TRÊN BÀN CỜ TƯƠNG TÁC")
        ctx_parts.append(f"- **Chuỗi FEN**: `{current_fen}`")
        fen_parts = current_fen.split(" ")
        active_color = "Trắng (White)" if len(fen_parts) > 1 and fen_parts[1] == "w" else "Đen (Black)"
        ctx_parts.append(f"- **Lượt đi**: Đến lượt **{active_color}** đi quân")
        if engine_eval:
            score = engine_eval.get("score")
            score_type = engine_eval.get("scoreType", "cp")
            eval_str = f"Chiếu bí trong {score} nước (#M{score})" if score_type == "mate" else f"{score:+.2f} điểm" if isinstance(score, (int, float)) else str(score)
            ctx_parts.append(f"- **Đánh giá Stockfish**: `{eval_str}`")
            if engine_eval.get("bestMove"):
                ctx_parts.append(f"- **Nước đi tối ưu Stockfish đề xuất**: `{engine_eval.get('bestMove')}`")
            if engine_eval.get("pv"):
                ctx_parts.append(f"- **Biến thể dự tính chính (PV line)**: `{' '.join(engine_eval.get('pv')[:8])}`")
        ctx_parts.append("")

    # 2. Thống kê cơ bản
    ctx_parts.append("## I. THỐNG KÊ TỔNG QUAN")
    ctx_parts.append(f"- **Tổng số ván đấu đã phân tích**: {stats.get('total_games', len(games or []))} ván")
    ctx_parts.append(f"- **Kết quả chung**: {stats.get('wins', 0)} Thắng ({stats.get('win_rate', 0)}%), {stats.get('draws', 0)} Hòa ({stats.get('draw_rate', 0)}%), {stats.get('losses', 0)} Thua ({stats.get('loss_rate', 0)}%)")
    ctx_parts.append(f"- **Tỷ lệ điểm (Score %)**: {stats.get('score_percentage', 0)}%")
    ctx_parts.append(f"- **Khi cầm quân TRẮNG**: {stats.get('white_games', 0)} ván, Score: {stats.get('white_score_percentage', 0)}%")
    ctx_parts.append(f"- **Khi cầm quân ĐEN**: {stats.get('black_games', 0)} ván, Score: {stats.get('black_score_percentage', 0)}%")
    if stats.get("white_elo"):
        ctx_parts.append(f"- **Elo trung bình**: ~{stats.get('white_elo', 0)}")

    # 3. Cây Khai cuộc & Phản ứng nước đi (nếu có)
    if fen_map_white or fen_map_black:
        ctx_parts.append("\n## II. CÂY KHAI CUỘC (OPENING TREE)")
        tree_summary = summarize_opening_tree(fen_map_white, fen_map_black)
        ctx_parts.append(tree_summary)

    # 4. Danh mục Khai cuộc Chi tiết (Repertoire)
    rep = deep_profile.get("repertoire", {})
    w_rep = rep.get("white_repertoire", [])
    b_rep = rep.get("black_repertoire", [])
    if w_rep or b_rep:
        ctx_parts.append("\n## III. KHAI CUỘC THƯỜNG GẶP (REPERTOIRE)")
        if w_rep:
            ctx_parts.append("### Cầm TRẮNG:")
            for item in w_rep[:6]:
                ctx_parts.append(
                    f"- **{item.get('name', 'N/A')}**: {item.get('games_count', 0)} ván ({item.get('wins', 0)}T/{item.get('draws', 0)}H/{item.get('losses', 0)}B) | Score: {item.get('score_pct', 0)}%"
                )
        if b_rep:
            ctx_parts.append("### Cầm ĐEN:")
            for item in b_rep[:6]:
                ctx_parts.append(
                    f"- **{item.get('name', 'N/A')}**: {item.get('games_count', 0)} ván ({item.get('wins', 0)}T/{item.get('draws', 0)}H/{item.get('losses', 0)}B) | Score: {item.get('score_pct', 0)}%"
                )

    # 5. Đặc trưng phong cách thi đấu
    style_prof = deep_profile.get("style_profile", {})
    if style_prof:
        ctx_parts.append("\n## IV. ĐẶC TRƯNG PHONG CÁCH THI ĐẤU (PLAYING STYLE PROFILE)")
        raw_m = style_prof.get("raw_metrics", {})
        if raw_m:
            ctx_parts.append(f"- Độ biến động chiến thuật (Volatility Score): {raw_m.get('volatility_score', 50.0)}")
            ctx_parts.append(f"- Tỉ lệ thí quân (Sacrifice Rate): {raw_m.get('sacrifice_rate', 0.0)}%")
            ctx_parts.append(f"- Tỉ lệ chuyển tàn cuộc (Simplification Rate): {raw_m.get('simplification_rate', 0.0)}%")
        evidence = style_prof.get("evidence", [])
        for ev in evidence:
            ctx_parts.append(f"- {ev}")

    # 6. Cấu trúc Tốt
    structs = deep_profile.get("structures", {}).get("structures", [])
    if structs:
        ctx_parts.append("\n## V. CẤU TRÚC TỐT NỔI BẬT")
        for s in structs[:6]:
            ctx_parts.append(
                f"- **{s.get('name', 'N/A')}**: {s.get('games_count', 0)} ván | Score: {s.get('score_pct', 0)}% | Hình thành quanh nước: {s.get('typical_move', 'N/A')}"
            )

    # 7. Độ chính xác theo giai đoạn (Phase Accuracy)
    phases = deep_profile.get("phases", {}).get("phases", {})
    if phases:
        ctx_parts.append("\n## VI. ĐỘ CHÍNH XÁC THEO GIAI ĐOẠN (PHASE ACCURACY)")
        for p_key, p_name in [("opening", "Khai cuộc"), ("middlegame", "Trung cuộc"), ("endgame", "Tàn cuộc")]:
            p_data = phases.get(p_key, {})
            acc = p_data.get("accuracy") or p_data.get("accuracy_pct")
            if acc is not None:
                ctx_parts.append(f"- **{p_name}**: Độ chính xác: {acc}% ({p_data.get('games_count', 0)} ván)")

    # 8. TOÀN BỘ CƠ SỞ DỮ LIỆU BIÊN BẢN VÁN ĐẤU (PGN GAMES ARCHIVE)
    if games:
        ctx_parts.append("\n## VII. TOÀN BỘ BIÊN BẢN VÁN ĐẤU THỰC TẾ (PGN GAMES ARCHIVE)")
        ctx_parts.append(format_games_pgn_for_context(games))

    return "\n".join(ctx_parts)


build_player_ai_context = build_opponent_ai_context
