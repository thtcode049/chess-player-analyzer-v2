"""
AI Local Expert Module
-----------------------
Chức năng: Cung cấp bộ máy suy luận chiến thuật ngoại tuyến (Offline Rule-Based Expert Engine)
trả lời câu hỏi người dùng dựa trên dữ liệu thống kê khách quan từ Profile và Cây Khai cuộc
khi không có API Key của Gemini hoặc khi mạng Internet gián đoạn.
"""

from typing import Dict, Any, List, Optional


def generate_local_expert_response(
    prompt: str,
    deep_profile: Optional[Dict[str, Any]],
    stats: Optional[Dict[str, Any]],
    fen_map_white: Optional[Dict[str, Any]] = None,
    fen_map_black: Optional[Dict[str, Any]] = None,
    selected_player: str = "Kỳ thủ",
    mode: str = "self",
    **kwargs: Any
) -> str:
    """
    Sinh câu trả lời thông minh dựa trên luật (Rule-Based Expert System) từ dữ liệu thực nghiệm.
    """
    if not deep_profile or not stats:
        return (
            f"Hiện tại chưa có đủ dữ liệu phân tích ván đấu của **{selected_player}**. "
            f"Vui lòng nạp ván đấu tại trang **Nạp Ván đấu** để hệ thống có thể phân tích."
        )

    p = prompt.strip().lower()

    # Trích xuất dữ liệu cơ sở
    total_games = stats.get("total_games", 0)
    score_pct = stats.get("score_percentage", 50.0)
    w_score = stats.get("white_score_percentage", 50.0)
    b_score = stats.get("black_score_percentage", 50.0)
    
    rep = deep_profile.get("repertoire", {})
    w_rep = rep.get("white_repertoire", [])
    b_rep = rep.get("black_repertoire", [])
    
    structs = deep_profile.get("structures", {}).get("structures", [])

    # =========================================================================
    # 1. TRẢ LỜI VỀ CẤU TRÚC TỐT (PAWN STRUCTURES)
    # =========================================================================
    if any(k in p for k in ["cấu trúc", "tốt", "structure", "pawn", "carlsbad", "isolani", "hanging", "mar del plata"]):
        lines = [f"### 🧬 Phân tích Chuyên sâu về Cấu trúc Tốt của **{selected_player}**\n"]
        if not structs:
            lines.append("Chưa phát hiện cấu trúc Tốt đặc trưng nào nổi bật trong các ván đấu đã phân tích.")
            return "\n".join(lines)

        # Kiểm tra nếu hỏi cấu trúc cụ thể
        specific_match = None
        for s in structs:
            if s["name"].lower() in p:
                specific_match = s
                break

        if specific_match:
            s = specific_match
            lines.append(f"#### 📌 Cấu trúc mục tiêu: **{s['name']}**")
            lines.append(f"- **Số ván xuất hiện**: {s['games_count']} ván ({s['wins']} Thắng / {s['draws']} Hòa / {s['losses']} Thua)")
            lines.append(f"- **Điểm số thực tế**: **{s.get('score_pct', 0)}%**")
            lines.append(f"- **Điểm số hiệu chỉnh Bayesian**: **{s.get('adjusted_score_pct', 0)}%** (Độ lệch: `{s.get('delta_vs_baseline', 0):+}%` so với phong độ gốc {score_pct}%)")
            lines.append(f"- **Đánh giá độ tin cậy**: `{s.get('assessment_badge', 'N/A')}`")
            lines.append(f"- **Thời điểm hình thành đặc trưng**: Khoảng nước **{s.get('typical_move', 'N/A')}**")
            
            if s.get("delta_vs_baseline", 0) < -5.0:
                if mode == "self":
                    lines.append(f"\n💡 **Khuyến nghị cải thiện**: Đây là **lỗ hổng cần khắc phục**. Bạn/học viên thường xử lý lúng túng ở cấu trúc *{s['name']}*. Cần xem lại các ván thua để học cách điều động quân hợp lý hơn.")
                else:
                    lines.append(f"\n💡 **Lời khuyên tác chiến**: Đây là **điểm yếu đã xác nhận** của đối thủ. Hãy chủ động dẫn dắt thế trận về cấu trúc *{s['name']}* để ép đối thủ rơi vào thế cờ họ xử lý kém.")
            elif s.get("delta_vs_baseline", 0) > 5.0:
                if mode == "self":
                    lines.append(f"\n🟢 **Thế mạnh sở trường**: Bạn/học viên xử lý cấu trúc *{s['name']}* rất thành thạo và đạt điểm số vượt trội. Hãy tiếp tục phát huy!")
                else:
                    lines.append(f"\n⚠️ **Cảnh báo**: Đây là **thế mạnh sở trường** của đối thủ. Họ xử lý cấu trúc *{s['name']}* rất thành thạo, bạn nên tránh tạo ra cấu trúc này.")
            else:
                lines.append(f"\nℹ️ **Nhận định**: Kỳ thủ thi đấu ở mức ổn định trung bình trên cấu trúc này.")
            return "\n".join(lines)

        # Tổng quan thế mạnh & điểm yếu cấu trúc
        strong_structs = [s for s in structs if s.get("delta_vs_baseline", 0) > 0]
        weak_structs = [s for s in structs if s.get("delta_vs_baseline", 0) < 0]

        lines.append("Dựa trên phân tích toán học và kiểm định Bayesian Shrinkage:\n")
        
        if strong_structs:
            top_s = strong_structs[0]
            lines.append(f"🟢 **Cấu trúc xử lý tốt nhất**: **{top_s['name']}**")
            lines.append(f"  - Đạt **{top_s.get('score_pct', 0)}% score** ({top_s.get('adjusted_score_pct', 0)}% sau hiệu chỉnh, Delta: `+{top_s.get('delta_vs_baseline', 0)}%`) trên {top_s['games_count']} ván.")
            lines.append(f"  - Đánh giá: `{top_s.get('assessment_badge', 'N/A')}`.")
        
        if weak_structs:
            worst_s = sorted(weak_structs, key=lambda x: x.get("adjusted_score_pct", 50))[0]
            badge_title = "Cấu trúc cần rèn luyện nhất" if mode == "self" else "Cấu trúc xử lý kém nhất (TỬ HUYỆT)"
            lines.append(f"\n🔴 **{badge_title}**: **{worst_s['name']}**")
            lines.append(f"  - Chỉ đạt **{worst_s.get('score_pct', 0)}% score** ({worst_s.get('adjusted_score_pct', 0)}% sau hiệu chỉnh, Delta: `{worst_s.get('delta_vs_baseline', 0)}%`) trên {worst_s['games_count']} ván.")
            lines.append(f"  - Đánh giá: `{worst_s.get('assessment_badge', 'N/A')}` (Nước hình thành: ~nước {worst_s.get('typical_move', 'N/A')}).")
            if mode == "self":
                lines.append(f"  - 📚 **Lộ trình khắc phục**: Cần luyện tập các bài học định vị Tốt và kiểm soát ô tiền đồn trong cấu trúc **{worst_s['name']}**.")
            else:
                lines.append(f"  - 👉 **Kế hoạch khai thác**: Hãy điều hướng ván cờ vào dạng cấu trúc **{worst_s['name']}** này để tạo ưu thế chiến lược.")

        lines.append("\n**Bảng tổng hợp tất cả cấu trúc Tốt kỳ thủ từng gặp:**\n")
        lines.append("| Cấu trúc Tốt | Số ván | W/D/L | Score % | Độ tin cậy | Đánh giá |")
        lines.append("| :--- | :---: | :---: | :---: | :---: | :--- |")
        for s in structs[:6]:
            lines.append(f"| **{s['name']}** | {s['games_count']} | {s['wins']}/{s['draws']}/{s['losses']} | {s.get('score_pct', 0)}% | **{s.get('adjusted_score_pct', 0)}%** | {s.get('assessment_badge', 'N/A')} |")

        return "\n".join(lines)

    # =========================================================================
    # 2. TRẢ LỜI VỀ GIAI ĐOẠN (PHASES)
    # =========================================================================
    if any(k in p for k in ["giai đoạn", "phase", "chính xác", "accuracy", "trung cuộc", "tàn cuộc", "khai cuộc và trung cuộc"]):
        return (
            f"### ⏱ Đánh giá Giai đoạn & Động cơ đối với **{selected_player}**\n\n"
            f"Hệ thống phân tích tập trung vào **Danh mục Khai cuộc (Repertoire)** và **Cấu trúc Tốt (Pawn Structures)**.\n"
            f"Để phân tích chi tiết từng nước đi hoặc đánh giá độ sâu bàn cờ bằng Stockfish, bạn hãy mở bàn cờ tương tác và kích hoạt **Stockfish 19 Web Worker** trực tiếp trên trình duyệt."
        )

    # =========================================================================
    # 3. TRẢ LỜI VỀ PHONG CÁCH / LỐI CHƠI (PLAYING STYLE & PATTERNS)
    # =========================================================================
    if any(k in p for k in ["phong cách", "style", "lối chơi"]):
        lines = [f"### ♟️ Phân tích Xu hướng & Phong cách Thi đấu của **{selected_player}**\n"]
        lines.append(f"- **Tổng số ván đấu đã phân tích**: **{total_games}** ván (Hiệu suất tổng thể: **{score_pct}%**)")
        lines.append(f"- **Hiệu suất theo màu quân**: ⚪ Trắng: **{w_score}%** | ⚫ Đen: **{b_score}%**")
        if w_rep:
            lines.append(f"- **Vũ khí sở trường khi cầm Trắng**: **{w_rep[0]['name']}** ({w_rep[0]['games_count']} ván, Score: **{w_rep[0].get('score_pct', 0)}%**)")
        if b_rep:
            lines.append(f"- **Hệ thống phòng thủ chính khi cầm Đen**: **{b_rep[0]['name']}** ({b_rep[0]['games_count']} ván, Score: **{b_rep[0].get('score_pct', 0)}%**)")
        if structs:
            lines.append(f"- **Cấu trúc Tốt thi đấu tốt nhất**: **{structs[0]['name']}** ({structs[0]['games_count']} ván, Score: **{structs[0].get('score_pct', 0)}%**)")
        return "\n".join(lines)

    # =========================================================================
    # 4. TRẢ LỜI VỀ KHAI CUỘC & PHẢN ỨNG NƯỚC ĐI (REPERTOIRE & OPENING TREE)
    # =========================================================================
    if any(k in p for k in ["khai cuộc", "opening", "repertoire", "1.e4", "1.d4", "1.c4", "1.nf3", "cầm trắng", "cầm đen", "sở trường", "vũ khí"]):
        lines = [f"### 📚 Phân tích Danh mục Khai cuộc (Repertoire) của **{selected_player}**\n"]
        
        # Cầm Trắng
        lines.append("#### ⚪ Khi kỳ thủ cầm TRẮNG (White Repertoire):")
        if w_rep:
            top_w = w_rep[0]
            lines.append(f"- **Khai cuộc chơi nhiều nhất**: **{top_w['name']}** ({top_w['games_count']} ván, Score: **{top_w.get('score_pct', 0)}%**, Độ tin cậy: **{top_w.get('adjusted_score_pct', 0)}%**)")
            lines.append(f"- **Đánh giá**: `{top_w.get('assessment_badge', 'N/A')}` (Delta: `{top_w.get('delta_vs_baseline', 0):+}%`)")

            lines.append("\n| Khai cuộc (Trắng) | Số ván | W/D/L | Score % | Độ tin cậy | Đánh giá |")
            lines.append("| :--- | :---: | :---: | :---: | :---: | :--- |")
            for item in w_rep[:5]:
                lines.append(f"| **{item['name']}** | {item['games_count']} | {item['wins']}/{item['draws']}/{item['losses']} | {item.get('score_pct', 0)}% | **{item.get('adjusted_score_pct', 0)}%** | {item.get('assessment_badge', 'N/A')} |")
        else:
            lines.append("- Chưa có đủ dữ liệu ván đấu khi cầm Trắng.")

        # Cầm Đen
        lines.append("\n#### ⚫ Khi kỳ thủ cầm ĐEN (Black Repertoire):")
        if b_rep:
            top_b = b_rep[0]
            lines.append(f"- **Khai cuộc phòng thủ chính**: **{top_b['name']}** ({top_b['games_count']} ván, Score: **{top_b.get('score_pct', 0)}%**, Độ tin cậy: **{top_b.get('adjusted_score_pct', 0)}%**)")
            lines.append(f"- **Đánh giá**: `{top_b.get('assessment_badge', 'N/A')}` (Delta: `{top_b.get('delta_vs_baseline', 0):+}%`)")

            lines.append("\n| Khai cuộc (Đen) | Số ván | W/D/L | Score % | Độ tin cậy | Đánh giá |")
            lines.append("| :--- | :---: | :---: | :---: | :---: | :--- |")
            for item in b_rep[:5]:
                lines.append(f"| **{item['name']}** | {item['games_count']} | {item['wins']}/{item['draws']}/{item['losses']} | {item.get('score_pct', 0)}% | **{item.get('adjusted_score_pct', 0)}%** | {item.get('assessment_badge', 'N/A')} |")
        else:
            lines.append("- Chưa có đủ dữ liệu ván đấu khi cầm Đen.")

        return "\n".join(lines)

    # =========================================================================
    # 5. TRẢ LỜI VỀ ĐIỂM YẾU (WEAKNESSES)
    # =========================================================================
    if any(k in p for k in ["điểm yếu", "yếu nhất", "lỗ hổng", "sơ hở", "khai thác", "weakness"]):
        lines = [f"### 🎯 Phân tích Các Điểm Yếu Lớn Nhất của **{selected_player}**\n"]
        lines.append("Dựa trên phân tích thống kê toán học đa chiều từ Profile:\n")

        # 1. Điểm yếu màu quân
        if w_score - b_score >= 10.0:
            if mode == "self":
                lines.append(f"1. ♟ **Lệch hiệu suất màu quân**: Bạn/học viên thi đấu **kém hơn rõ rệt khi cầm ĐEN** ({b_score}% so với {w_score}% khi cầm Trắng). Cần gia cố thêm các phương án phòng thủ vững chắc khi cầm quân Đen.")
            else:
                lines.append(f"1. ♟ **Lệch hiệu suất màu quân**: Đối thủ thi đấu **kém hơn rõ rệt khi cầm ĐEN** ({b_score}% so với {w_score}% khi cầm Trắng). Hãy tận dụng tối đa khi bạn được cầm Trắng để tấn công dồn dập.")
        elif b_score - w_score >= 10.0:
            if mode == "self":
                lines.append(f"1. ♟ **Lệch hiệu suất màu quân**: Bạn/học viên thi đấu **kém hơn khi cầm TRẮNG** ({w_score}% so với {b_score}% khi cầm Đen). Cần chủ động hơn trong việc tận dụng lợi thế đi trước.")
            else:
                lines.append(f"1. ♟ **Lệch hiệu suất màu quân**: Đối thủ thi đấu **kém hơn khi cầm TRẮNG** ({w_score}% so với {b_score}% khi cầm Đen).")

        # 2. Điểm yếu cấu trúc Tốt
        weak_structs = [s for s in structs if s.get("delta_vs_baseline", 0) < 0]
        if weak_structs:
            worst_s = sorted(weak_structs, key=lambda x: x.get("adjusted_score_pct", 50))[0]
            lines.append(f"2. 🧬 **Tử huyệt Cấu trúc Tốt**: Cấu trúc **{worst_s['name']}** (Score: **{worst_s.get('score_pct', 0)}%**, Độ tin cậy: **{worst_s.get('adjusted_score_pct', 0)}%**, Đánh giá: `{worst_s.get('assessment_badge', 'N/A')}`).")

        # 3. Điểm yếu khai cuộc
        all_rep = w_rep + b_rep
        weak_openings = [o for o in all_rep if o.get("delta_vs_baseline", 0) < 0 and o.get("games_count", 0) >= 2]
        if weak_openings:
            worst_op = sorted(weak_openings, key=lambda x: x.get("adjusted_score_pct", 50))[0]
            lines.append(f"3. 📚 **Khai cuộc dễ tổn thương nhất**: **{worst_op['name']}** (Score: **{worst_op.get('score_pct', 0)}%**, Độ tin cậy: **{worst_op.get('adjusted_score_pct', 0)}%**, Thua: {worst_op.get('losses', 0)}/{worst_op.get('games_count', 0)} ván).")

        return "\n".join(lines)

    # =========================================================================
    # 6. TRẢ LỜI MẶC ĐỊNH / TỔNG HỢP TOÀN DIỆN (GENERAL SUMMARY & INSIGHTS)
    # =========================================================================
    lines = [f"### ♟️ Báo cáo Tổng hợp Phân tích Toàn diện: **{selected_player}**\n"]
    lines.append(f"- **Tổng số ván đấu đã phân tích**: **{total_games}** ván • **Score tổng thể**: **{score_pct}%** ({stats.get('wins', 0)}T / {stats.get('draws', 0)}H / {stats.get('losses', 0)}B)")
    lines.append(f"- **Hiệu suất theo màu quân**: Cầm Trắng đạt **{w_score}%** • Cầm Đen đạt **{b_score}%**")
    
    if w_rep:
        lines.append(f"- **Khai cuộc chính khi cầm Trắng**: **{w_rep[0]['name']}** ({w_rep[0]['games_count']} ván, {w_rep[0].get('score_pct', 0)}% score)")
    if b_rep:
        lines.append(f"- **Khai cuộc chính khi cầm Đen**: **{b_rep[0]['name']}** ({b_rep[0]['games_count']} ván, {b_rep[0].get('score_pct', 0)}% score)")
    
    if structs:
        lines.append(f"- **Cấu trúc Tốt nổi bật**: **{structs[0]['name']}** (Score: {structs[0].get('score_pct', 0)}%, Bayes: {structs[0].get('adjusted_score_pct', 0)}%)")

    lines.append("\n💡 **Gợi ý**: Bạn có thể bấm vào các câu hỏi nhanh phía trên hoặc hỏi chi tiết về *khai cuộc, cấu trúc tốt, điểm mạnh/yếu chiến lược* để nhận phân tích sâu hơn!")
    
    return "\n".join(lines)
