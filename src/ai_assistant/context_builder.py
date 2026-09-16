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


def build_opponent_ai_context(
    deep_profile: Optional[Dict[str, Any]],
    stats: Optional[Dict[str, Any]],
    fen_map_white: Optional[Dict[str, Any]] = None,
    fen_map_black: Optional[Dict[str, Any]] = None,
    selected_player: str = "Kỳ thủ",
    analyzed_games_count: Optional[int] = None,
    total_games_count: Optional[int] = None
) -> str:
    """
    Chuyển đổi toàn bộ dữ liệu thống kê khách quan từ Profile và Opening Tree thành
    ngữ cảnh văn bản có cấu trúc chuẩn xác để làm Ground Truth cho AI.
    """
    if not deep_profile or not stats:
        return "Hiện chưa có dữ liệu phân tích nào được nạp."

    ctx_parts = []
    ctx_parts.append(f"# BÁO CÁO DỮ LIỆU THỰC NGHIỆM KỲ THỦ: {selected_player.upper()}")
    ctx_parts.append("*(Nguồn dữ liệu: 100% trích xuất từ phân tích toán học & Profile, không chứa suy diễn chủ quan)*\n")

    if analyzed_games_count is not None and total_games_count is not None and total_games_count > analyzed_games_count:
        ctx_parts.append(
            f"⚠️ **CẢNH BÁO ĐỘ TIN CẬY DỮ LIỆU ĐÁNH GIÁ NƯỚC ĐI**: "
            f"Hệ thống hiện mới chỉ phân tích mẫu **{analyzed_games_count}/{total_games_count} ván**. "
            f"Khi phân tích về độ chính xác (Phase accuracy), các chỉ số phong cách hay điểm yếu chiến thuật, "
            f"hãy giải thích dựa trên mẫu {analyzed_games_count} ván này và nhắc nhở người dùng có thể bấm 'Phân tích toàn bộ ván đấu' để có số liệu chuẩn xác 100%.\n"
        )

    # 1. Thống kê cơ bản
    ctx_parts.append("## I. THỐNG KÊ TỔNG QUAN")
    ctx_parts.append(f"- **Tổng số ván đấu đã phân tích**: {stats.get('total_games', 0)} ván")
    ctx_parts.append(f"- **Kết quả chung**: {stats.get('wins', 0)} Thắng ({stats.get('win_rate', 0)}%), {stats.get('draws', 0)} Hòa ({stats.get('draw_rate', 0)}%), {stats.get('losses', 0)} Thua ({stats.get('loss_rate', 0)}%)")
    ctx_parts.append(f"- **Điểm số tổng thể (Score %)**: {stats.get('score_percentage', 0)}%")
    ctx_parts.append(f"- **Khi cầm quân TRẮNG**: {stats.get('white_games', 0)} ván, Score: {stats.get('white_score_percentage', 0)}% ({stats.get('white_wins', 0)}T / {stats.get('white_draws', 0)}H / {stats.get('white_losses', 0)}B)")
    ctx_parts.append(f"- **Khi cầm quân ĐEN**: {stats.get('black_games', 0)} ván, Score: {stats.get('black_score_percentage', 0)}% ({stats.get('black_wins', 0)}T / {stats.get('black_draws', 0)}H / {stats.get('black_losses', 0)}B)")
    if stats.get("white_elo"):
        ctx_parts.append(f"- **Elo trung bình**: ~{stats.get('white_elo', 0)}")

    # 2. Cây Khai cuộc & Phản ứng nước đi
    ctx_parts.append("\n## II. CÂY KHAI CUỘC & THÓI QUEN NƯỚC ĐI (OPENING TREE)")
    tree_summary = summarize_opening_tree(fen_map_white, fen_map_black)
    ctx_parts.append(tree_summary)

    # 3. Danh mục Khai cuộc Chi tiết (Repertoire)
    rep = deep_profile.get("repertoire", {})
    ctx_parts.append("\n## III. DANH MỤC KHAI CUỘC CHI TIẾT (REPERTOIRE)")
    
    w_rep = rep.get("white_repertoire", [])
    ctx_parts.append("### 1. Khai cuộc khi kỳ thủ cầm TRẮNG:")
    if w_rep:
        for item in w_rep[:8]:
            ctx_parts.append(
                f"- **{item.get('name', 'N/A')}**: {item.get('games_count', 0)} ván ({item.get('wins', 0)}T/{item.get('draws', 0)}H/{item.get('losses', 0)}B) | Score: {item.get('score_pct', 0)}% | Bayes Adj: {item.get('adjusted_score_pct', 0)}% | Delta: {item.get('delta_vs_baseline', 0):+}% | Đánh giá: {item.get('assessment_badge', 'N/A')}"
            )
    else:
        ctx_parts.append("- Chưa có đủ dữ liệu khai cuộc cầm Trắng.")

    b_rep = rep.get("black_repertoire", [])
    ctx_parts.append("\n### 2. Khai cuộc khi kỳ thủ cầm ĐEN:")
    if b_rep:
        for item in b_rep[:8]:
            ctx_parts.append(
                f"- **{item.get('name', 'N/A')}**: {item.get('games_count', 0)} ván ({item.get('wins', 0)}T/{item.get('draws', 0)}H/{item.get('losses', 0)}B) | Score: {item.get('score_pct', 0)}% | Bayes Adj: {item.get('adjusted_score_pct', 0)}% | Delta: {item.get('delta_vs_baseline', 0):+}% | Đánh giá: {item.get('assessment_badge', 'N/A')}"
            )
    else:
        ctx_parts.append("- Chưa có đủ dữ liệu khai cuộc cầm Đen.")

    # 4. Đặc trưng phong cách thi đấu (Style Profile)
    style_prof = deep_profile.get("style_profile", {})
    ctx_parts.append("\n## IV. ĐẶC TRƯNG PHONG CÁCH THI ĐẤU (PLAYING STYLE PROFILE)")

    raw_m = style_prof.get("raw_metrics", {})
    ctx_parts.append("- **Các chỉ số đo lường thực nghiệm từ ván đấu**:")
    ctx_parts.append(f"  * Độ biến động chiến thuật (Volatility Score): {raw_m.get('volatility_score', 50.0)} / 100")
    ctx_parts.append(f"  * Tỉ lệ ván có nước Thí quân (Sacrifice Rate): {raw_m.get('sacrifice_rate', 0.0)}% ({raw_m.get('total_sacrifices', 0)} nước thí quân)")
    ctx_parts.append(f"  * Tỉ lệ chuyển tàn cuộc sớm (Simplification Rate): {raw_m.get('simplification_rate', 0.0)}%")
    ctx_parts.append(f"  * Khả năng kiên cường lội ngược dòng (Resilience Rate): {raw_m.get('resilience_rate', 50.0)}%")
    dom_name = raw_m.get("dominant_structure", "Cờ kín")
    dom_pct = raw_m.get("dominant_structure_pct", 33.4)
    ctx_parts.append(f"  * Thế trận thường dùng: {dom_name} ({dom_pct}%) | Chi tiết: Kín {raw_m.get('closed_preference', 33.4)}% - Nửa mở {raw_m.get('semi_open_preference', 33.3)}% - Mở {raw_m.get('open_preference', 33.3)}%")

    evidence = style_prof.get("evidence", [])
    if evidence:
        ctx_parts.append("- **Bằng chứng thực nghiệm từ dữ liệu ván đấu**:")
        for ev in evidence:
            ctx_parts.append(f"  * {ev}")

    # 5. Hiệu suất theo Giai đoạn (Phase Accuracy)
    phases = deep_profile.get("phases", {}).get("phases", {})
    ctx_parts.append("\n## V. HIỆU SUẤT THEO GIAI ĐOẠN VÁN ĐẤU (PHASE ACCURACY)")
    for p_key, p_name in [("opening", "Khai cuộc (Opening)"), ("middlegame", "Trung cuộc (Middlegame)"), ("endgame", "Tàn cuộc (Endgame)")]:
        p_data = phases.get(p_key, {})
        acc = p_data.get("accuracy") or p_data.get("accuracy_pct")
        acc_str = f"{acc}%" if acc is not None else "Chưa có eval"
        ctx_parts.append(f"- **{p_name}**: Độ chính xác: {acc_str} ({p_data.get('games_count', 0)} ván, {p_data.get('analyzed_moves', 0)} nước đi đã phân tích)")

    # 6. Cấu trúc Tốt (Pawn Structure Mastery)
    structs = deep_profile.get("structures", {}).get("structures", [])
    ctx_parts.append("\n## VI. HIỆU SUẤT TRÊN CÁC CẤU TRÚC TỐT (PAWN STRUCTURES)")
    if structs:
        for s in structs[:8]:
            ctx_parts.append(
                f"- **{s.get('name', 'N/A')}**: {s.get('games_count', 0)} ván ({s.get('wins', 0)}T/{s.get('draws', 0)}H/{s.get('losses', 0)}B) | Score: {s.get('score_pct', 0)}% | Bayes Adj: {s.get('adjusted_score_pct', 0)}% | Delta: {s.get('delta_vs_baseline', 0):+}% | Đánh giá: {s.get('assessment_badge', 'N/A')} | Nước cờ đặc trưng: Nước {s.get('typical_move', 'N/A')}"
            )
    else:
        ctx_parts.append("- Chưa phát hiện cấu trúc Tốt đặc trưng.")

    return "\n".join(ctx_parts)


build_player_ai_context = build_opponent_ai_context
