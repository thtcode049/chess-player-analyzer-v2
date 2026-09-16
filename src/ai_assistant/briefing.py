"""
AI Strategic Briefing Module
----------------------------
Tự động tổng hợp dữ liệu thực nghiệm (Profile, Repertoire, Structures, Phases, Dynamics)
thành Bản Tóm tắt Suy luận Chiến lược Mở đầu (Executive Strategic Briefing)
theo 2 góc nhìn: Bản thân / Học viên (Self / Coaching) hoặc Đối thủ (Opponent Scouting).
"""

from typing import Dict, Any, List, Optional
from src.strategy import rank_strongest_items, rank_weakest_items


def generate_initial_strategic_briefing(
    deep_profile: Optional[Dict[str, Any]],
    stats: Optional[Dict[str, Any]],
    selected_player: str = "Kỳ thủ",
    mode: str = "self"
) -> str:
    """
    Sinh Bản Đánh giá Chiến lược Mở đầu cho Trợ lí AI dựa trên dữ liệu thực nghiệm.
    mode: 'self' (Bản thân / Học viên) hoặc 'opponent' (Đối thủ sắp gặp).
    """
    if not deep_profile or not stats:
        return (
            f"👋 Xin chào! Tôi là Trợ lí AI Cờ vua.\n\n"
            f"Hiện tại chưa có đủ dữ liệu phân tích ván đấu của **{selected_player}**. "
            f"Vui lòng nạp ván đấu tại trang **Nạp Ván đấu** để tôi có thể cung cấp bản phân tích chiến lược chuyên sâu!"
        )

    total_games = stats.get("total_games", 0)
    score_pct = stats.get("score_percentage", 50.0)
    w_score = stats.get("white_score_percentage", 50.0)
    b_score = stats.get("black_score_percentage", 50.0)

    repertoire = deep_profile.get("repertoire", {})
    all_openings = repertoire.get("all_openings", [])
    eligible_openings = [op for op in all_openings if op.get("games_count", 0) >= 1]

    ranked_strong = rank_strongest_items(eligible_openings)
    ranked_weak = rank_weakest_items(eligible_openings)

    strongest_op = ranked_strong[0] if ranked_strong else None
    weakest_op = ranked_weak[0] if ranked_weak else None

    # Pawn structures
    structs = deep_profile.get("structures", {}).get("structures", [])
    strong_structs = sorted([s for s in structs if s.get("delta_vs_baseline", 0) > 0], key=lambda x: x.get("adjusted_score_pct", 50), reverse=True)
    weak_structs = sorted([s for s in structs if s.get("delta_vs_baseline", 0) < 0], key=lambda x: x.get("adjusted_score_pct", 50))
    top_struct = strong_structs[0] if strong_structs else (structs[0] if structs else None)
    worst_struct = weak_structs[0] if weak_structs else None

    # Phases & Accuracy
    phases = deep_profile.get("phases", {}).get("phases", {})
    weakest_phase_info = deep_profile.get("phases", {}).get("weakest_phase")

    phase_vn = {"opening": "Khai cuộc", "middlegame": "Trung cuộc", "endgame": "Tàn cuộc"}
    best_phase = None
    worst_phase = None
    if phases:
        sorted_p = sorted(phases.items(), key=lambda x: x[1].get("accuracy", 0), reverse=True)
        best_phase = sorted_p[0]
        worst_phase = sorted_p[-1]

    # Style Profile & Dynamics
    style_prof = deep_profile.get("style_profile", {})
    style_name = style_prof.get("primary_style", "Toàn diện (Universal)")
    dynamics = deep_profile.get("dynamics", {})
    blunder_rate = dynamics.get("blunder_rate", 0.0)
    throw_rate = dynamics.get("throw_rate", 0.0)
    resilience_rate = dynamics.get("resilience_rate", 0.0)

    lines = []

    if mode == "self":
        # =====================================================================
        # GÓC NHÌN: BẢN THÂN / HỌC VIÊN (SELF-IMPROVEMENT & COACHING)
        # =====================================================================
        lines.append(f"### 📋 HỒ SƠ ĐÁNH GIÁ & LỘ TRÌNH RÈN LUYỆN: **{selected_player.upper()}**")
        lines.append(f"*🎯 Góc nhìn: 👤 Tự đánh giá & Huấn luyện nâng cao trình độ*\n")
        lines.append(
            f"Chào bạn! Tôi đã phân tích toàn bộ **{total_games} ván đấu** của bạn/học viên. "
            f"Hiệu suất tổng thể đạt **{score_pct}%** (⚪ Cầm Trắng: **{w_score}%** | ⚫ Cầm Đen: **{b_score}%**). "
            f"Dưới đây là các phát hiện quan trọng nhất từ dữ liệu thực nghiệm:\n"
        )
        lines.append("---\n")

        # 1. Repertoire
        lines.append("#### 1. ♟️ Hệ thống Khai cuộc (Repertoire Analysis)")
        if strongest_op:
            lines.append(
                f"- 🟢 **Vũ khí sở trường (Cần phát huy):** **{strongest_op['name']}**\n"
                f"  - Đạt **{strongest_op['score_pct']}%** điểm ({strongest_op.get('adjusted_score_pct', strongest_op['score_pct'])}% Bayesian, "
                f"Delta: `+{strongest_op.get('delta_vs_baseline', 0)}%`) trên {strongest_op['games_count']} ván.\n"
                f"  - 💡 *Đề xuất:* Đây là biến khai cuộc bạn xử lý tự tin nhất. Hãy tiếp tục phát huy và nghiên cứu sâu thêm các nhánh biến phụ để tạo bất ngờ."
            )
        if weakest_op:
            lines.append(
                f"- 🔴 **Lỗ hổng Repertoire (Cần khắc phục ngay):** **{weakest_op['name']}**\n"
                f"  - Chỉ đạt **{weakest_op['score_pct']}%** điểm ({weakest_op.get('adjusted_score_pct', weakest_op['score_pct'])}% Bayesian, "
                f"Delta: `{weakest_op.get('delta_vs_baseline', 0)}%`) trên {weakest_op['games_count']} ván.\n"
                f"  - ⚠️ *Khuyến nghị:* Đây là nơi rò rỉ điểm số nhiều nhất. Bạn nên xem xét bổ sung phương án phòng thủ mới hoặc tạm thời chuyển sang biến khai cuộc khác an toàn hơn."
            )
        lines.append("")

        # 2. Cấu trúc Tốt
        lines.append("#### 2. 🧬 Khả năng Xử lý Cấu trúc Tốt (Pawn Structures)")
        if top_struct:
            lines.append(f"- 🟢 **Cấu trúc chơi thành thạo:** **{top_struct['name']}** (Score: **{top_struct.get('score_pct', 0)}%**, Delta: `+{top_struct.get('delta_vs_baseline', 0)}%`).")
        if worst_struct:
            lines.append(
                f"- 🔴 **Cấu trúc xử lý lúng túng nhất:** **{worst_struct['name']}** (Score: **{worst_struct.get('score_pct', 0)}%**, Delta: `{worst_struct.get('delta_vs_baseline', 0)}%`).\n"
                f"  - 💡 *Bài học:* Cần xem lại các ván đấu có cấu trúc này để học cách điều động Mã và kiểm soát các ô yếu điểm (outposts)."
            )
        else:
            lines.append("- Chưa phát hiện cấu trúc Tốt nào có độ lệch tiêu cực đáng kể.")
        lines.append("")

        # 3. Giai đoạn & Độ chính xác
        lines.append("#### 3. 🎯 Độ chính xác từng Giai đoạn & Giáo trình Đề xuất")
        if best_phase and worst_phase:
            lines.append(
                f"- 🏆 **Giai đoạn vững vàng nhất:** **{phase_vn.get(best_phase[0], best_phase[0])}** "
                f"(Độ chính xác: **{best_phase[1].get('accuracy', 0)}%**).\n"
                f"- 📉 **Giai đoạn giảm sút độ chính xác:** **{phase_vn.get(worst_phase[0], worst_phase[0])}** "
                f"(Độ chính xác: **{worst_phase[1].get('accuracy', 0)}%**)."
            )
            if worst_phase[0] == "endgame":
                lines.append("  - 📚 **Giáo án trọng tâm:** Tăng cường giải bài tập cờ tàn kỹ thuật (Endgame Studies), kỹ năng kích hoạt Vua và phối hợp Tốt thông.")
            elif worst_phase[0] == "middlegame":
                lines.append("  - 📚 **Giáo án trọng tâm:** Rèn luyện đòn phối hợp chiến thuật (Tactical Puzzles) và kỹ năng duy trì kế hoạch trung cuộc khi thế trận phức tạp.")
            else:
                lines.append("  - 📚 **Giáo án trọng tâm:** Ôn tập các nguyên tắc phát triển quân khai cuộc và kiểm soát trung tâm từ sớm.")
        lines.append("")

        # 4. Phong cách & Động lực
        lines.append("#### 4. ⚡ Phong cách Thi đấu & Tâm lý Ván đấu")
        lines.append(
            f"- **Phong cách chủ đạo:** **{style_name}**.\n"
            f"- **Chỉ số động lực:** Tỷ lệ Sai lầm lớn (Blunder): `{blunder_rate}%` | "
            f"Tỷ lệ Đánh mất ưu thế (Throw): `{throw_rate}%` | "
            f"Khả năng Lội ngược dòng (Resilience): `{resilience_rate}%`."
        )

    else:
        # =====================================================================
        # GÓC NHÌN: ĐỐI THỦ SẮP GẶP (OPPONENT SCOUTING & MATCH PREP)
        # =====================================================================
        lines.append(f"### 🎯 KẾ HOẠCH TÁC CHIẾN & DO THÁM ĐỐI THỦ: **{selected_player.upper()}**")
        lines.append(f"*⚔️ Góc nhìn: 🎯 Chuẩn bị Trận đấu & Khai thác Tử huyệt*\n")
        lines.append(
            f"Chào bạn! Dưới đây là hồ sơ trinh sát chiến thuật đối đầu với kỳ thủ **{selected_player}** "
            f"dựa trên phân tích **{total_games} ván đấu** của đối thủ (Hiệu suất gốc: **{score_pct}%** | "
            f"Trắng: **{w_score}%**, Đen: **{b_score}%**):\n"
        )
        lines.append("---\n")

        # 1. Khai cuộc
        lines.append("#### 1. ⚔️ Khai cuộc: Tránh Đòn mạnh & Ép vào Tử huyệt")
        if strongest_op:
            lines.append(
                f"- 🛡️ **Đòn mạnh nhất của đối thủ (CẦN TRÁNH HOẶC CHUẨN BỊ KỸ):** **{strongest_op['name']}**\n"
                f"  - Hiệu suất đối thủ: **{strongest_op['score_pct']}%** ({strongest_op.get('adjusted_score_pct', strongest_op['score_pct'])}% Bayesian, Delta: `+{strongest_op.get('delta_vs_baseline', 0)}%`).\n"
                f"  - ⚠️ *Cảnh báo:* Đối thủ thi đấu cực kỳ sắc bén ở biến cờ này. Trừ khi bạn đã chuẩn bị phương án bẫy đặc biệt, hãy chủ động né tránh biến chính này."
            )
        if weakest_op:
            lines.append(
                f"- 🎯 **Tử huyệt khai cuộc (NÊN CHỦ ĐỘNG ÉP VÀO):** **{weakest_op['name']}**\n"
                f"  - Hiệu suất đối thủ: Chỉ **{weakest_op['score_pct']}%** ({weakest_op.get('adjusted_score_pct', weakest_op['score_pct'])}% Bayesian, Delta: `{weakest_op.get('delta_vs_baseline', 0)}%`).\n"
                f"  - 💡 *Chiến lược:* Hãy chuẩn bị kỹ lưỡng nhánh cờ này để đưa đối thủ vào thế trận họ xử lý thiếu tự tin nhất."
            )
        lines.append("")

        # 2. Cấu trúc Tốt
        lines.append("#### 2. 🧬 Khai thác Điểm yếu Cấu trúc Tốt")
        if worst_struct:
            lines.append(
                f"- 🎯 **Cấu trúc đối thủ xử lý lúng túng nhất:** **{worst_struct['name']}** "
                f"(Score đối thủ chỉ đạt **{worst_struct.get('score_pct', 0)}%**, Delta: `{worst_struct.get('delta_vs_baseline', 0)}%`).\n"
                f"  - 👉 *Kế hoạch:* Hãy chủ động đổi Tốt hoặc tạo sức ép định hình cấu trúc này trên bàn cờ."
            )
        if top_struct:
            lines.append(f"- ⚠️ **Cấu trúc sở trường của đối thủ:** **{top_struct['name']}** (Nên tránh tạo điều kiện cho đối thủ xây dựng cấu trúc này).")
        lines.append("")

        # 3. Giai đoạn
        lines.append("#### 3. 📉 Giai đoạn Đối thủ Dễ Mắc Sai lầm")
        if worst_phase:
            phase_name = phase_vn.get(worst_phase[0], worst_phase[0])
            lines.append(
                f"- 🎯 **Giai đoạn đối thủ sụt giảm độ chính xác:** **{phase_name}** "
                f"(Chỉ đạt **{worst_phase[1].get('accuracy', 0)}%** độ chính xác)."
            )
            if worst_phase[0] == "endgame":
                lines.append("  - 💡 *Kế hoạch tác chiến:* Kiên nhẫn đưa ván cờ về Tàn cuộc, đối thủ thường xử lý thiếu chính xác khi quân số tinh giản.")
            elif worst_phase[0] == "middlegame":
                lines.append("  - 💡 *Kế hoạch tác chiến:* Làm phức tạp hóa thế trận trung cuộc, tạo nhiều đòn phối hợp chiến thuật để ép đối thủ rơi vào khủng hoảng thời gian.")
            else:
                lines.append("  - 💡 *Kế hoạch tác chiến:* Tạo áp lực ngay từ giai đoạn khai cuộc để bắt đối thủ tiêu hao nhiều thời gian suy nghĩ.")
        lines.append("")

        # 4. Phong cách
        lines.append("#### 4. 🎭 Phong cách & Điểm Nhạy cảm Tâm lý")
        lines.append(
            f"- **Phong cách đối thủ:** **{style_name}**.\n"
            f"- **Tỷ lệ Throw (Mất ưu thế):** `{throw_rate}%` | "
            f"**Tỷ lệ Blunder:** `{blunder_rate}%`."
        )

    lines.append("\n---")
    lines.append("💡 *Hãy đặt câu hỏi bên dưới hoặc chọn một trong các gợi ý đào sâu nhanh để tiếp tục!*")
    return "\n".join(lines)


def get_followup_prompts(mode: str = "self") -> List[str]:
    """Trả về danh sách câu hỏi gợi ý đào sâu nhanh theo góc nhìn."""
    if mode == "self":
        return [
            "🛠️ Làm sao để vá lỗ hổng ở khai cuộc yếu nhất?",
            "📚 Lập giáo án rèn luyện 2 tuần để khắc phục điểm yếu",
            "♟️ Phân tích các thế cờ sai lầm then chốt (Blunders) của tôi",
            "🧬 Hướng dẫn cách xử lý cấu trúc Tốt kém nhất",
        ]
    else:
        return [
            "⚔️ Gợi ý các nước đi khắc chế đòn mạnh nhất của đối thủ",
            "🎯 Kế hoạch chi tiết để ép đối thủ vào tử huyệt khai cuộc",
            "♟️ Các thế cờ đối thủ thường mắc Blunder lớn nhất là gì?",
            "🛡️ Nên chọn khai cuộc gì khi tôi cầm Trắng / cầm Đen đấu với họ?",
        ]
