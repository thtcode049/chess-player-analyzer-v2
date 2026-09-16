"""
Local Chess Expert Engine Module
--------------------------------
Chức năng: Động cơ suy luận chuyên gia cờ vua cục bộ (Zero-Config / 100% Offline).
Tự động phân tích câu hỏi của người dùng và sinh câu trả lời phân tích chuyên sâu,
chính xác 100% dựa trên dữ liệu Profile & Opening Tree mà KHÔNG CẦN nhập bất kỳ API Key nào.
"""

from typing import Dict, Any, List, Optional
import re


def generate_local_expert_response(
    prompt: str,
    deep_profile: Optional[Dict[str, Any]],
    stats: Optional[Dict[str, Any]],
    fen_map_white: Optional[Dict[str, Any]] = None,
    fen_map_black: Optional[Dict[str, Any]] = None,
    selected_player: str = "Kỳ thủ",
    mode: str = "self"
) -> str:
    """
    Phân tích câu hỏi của người dùng và sinh câu trả lời chuyên sâu, có cấu trúc Markdown,
    số liệu chính xác, bảng biểu và lời khuyên chiến thuật từ dữ liệu Profile & Cây Khai cuộc.
    mode: 'self' (Bản thân / Học viên) hoặc 'opponent' (Đối thủ sắp gặp).
    """
    if not deep_profile or not stats:
        return f"⚠️ Hiện chưa có đủ dữ liệu phân tích của kỳ thủ **{selected_player}**. Vui lòng nạp ván đấu từ trang **Nạp Ván đấu** để bắt đầu."

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
    phases = deep_profile.get("phases", {}).get("phases", {})
    style_prof = deep_profile.get("style_profile", {})
    raw_m = style_prof.get("raw_metrics", {})
    simp = deep_profile.get("simplification", {})

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
    # 2. TRẢ LỜI VỀ GIAI ĐOẠN (PHASE ACCURACY)
    # =========================================================================
    if any(k in p for k in ["giai đoạn", "phase", "chính xác", "accuracy", "trung cuộc", "tàn cuộc", "khai cuộc và trung cuộc"]):
        lines = [f"### ⏱ Phân tích Độ chính xác theo Giai đoạn của **{selected_player}**\n"]
        
        op_data = phases.get("opening", {})
        mid_data = phases.get("middlegame", {})
        end_data = phases.get("endgame", {})

        op_acc = op_data.get("accuracy") or op_data.get("accuracy_pct")
        mid_acc = mid_data.get("accuracy") or mid_data.get("accuracy_pct")
        end_acc = end_data.get("accuracy") or end_data.get("accuracy_pct")

        lines.append("| Giai đoạn | Độ chính xác (Accuracy) | Số ván | Số nước đã phân tích | Đánh giá phong độ |")
        lines.append("| :--- | :---: | :---: | :---: | :--- |")
        
        def _get_eval_str(acc):
            if acc is None:
                return "Chờ phân tích"
            if acc >= 88.0:
                return "🟢 Xuất sắc"
            if acc >= 75.0:
                return "🟢 Ổn định"
            if acc >= 60.0:
                return "🟡 Trung bình"
            return "🔴 Cần cải thiện (Điểm yếu)"

        lines.append(f"| **♟ Khai cuộc (Opening)** | **{op_acc if op_acc is not None else 'N/A'}%** | {op_data.get('games_count', 0)} | {op_data.get('analyzed_moves', 0)} | {_get_eval_str(op_acc)} |")
        lines.append(f"| **⚔️ Trung cuộc (Middlegame)** | **{mid_acc if mid_acc is not None else 'N/A'}%** | {mid_data.get('games_count', 0)} | {mid_data.get('analyzed_moves', 0)} | {_get_eval_str(mid_acc)} |")
        lines.append(f"| **🏆 Tàn cuộc (Endgame)** | **{end_acc if end_acc is not None else 'N/A'}%** | {end_data.get('games_count', 0)} | {end_data.get('analyzed_moves', 0)} | {_get_eval_str(end_acc)} |")

        # Nhận định so sánh
        acc_dict = {"Khai cuộc": op_acc, "Trung cuộc": mid_acc, "Tàn cuộc": end_acc}
        valid_accs = {k: v for k, v in acc_dict.items() if v is not None}
        
        if valid_accs:
            best_phase = max(valid_accs.items(), key=lambda x: x[1])
            worst_phase = min(valid_accs.items(), key=lambda x: x[1])
            lines.append(f"\n💡 **Nhận định Chuyên sâu**:")
            if mode == "self":
                lines.append(f"- Bạn/học viên thi đấu chính xác và vững vàng nhất ở giai đoạn **{best_phase[0]}** ({best_phase[1]}%).")
                if worst_phase[0] != best_phase[0]:
                    lines.append(f"- Giai đoạn bạn/học viên dễ mắc sai sót và giảm sút độ chính xác nhiều nhất là **{worst_phase[0]}** ({worst_phase[1]}%).")
                    if worst_phase[0] == "Tàn cuộc":
                        lines.append("- 👉 **Giáo án đề xuất**: Hãy kiên trì rèn luyện tàn cuộc kỹ thuật (Endgame Studies), kỹ năng kích hoạt Vua và phối hợp Tốt thông.")
                    elif worst_phase[0] == "Trung cuộc":
                        lines.append("- 👉 **Giáo án đề xuất**: Rèn luyện bài tập chiến thuật hỗn loạn (Tactics Puzzles) và rèn luyện kỹ năng quản lý thời gian khi thế trận căng thẳng.")
                    elif worst_phase[0] == "Khai cuộc":
                        lines.append("- 👉 **Giáo án đề xuất**: Ôn tập lại lý thuyết khai cuộc và các nước đi nguyên tắc kiểm soát trung tâm.")
            else:
                lines.append(f"- Đối thủ thi đấu chính xác và vững vàng nhất ở giai đoạn **{best_phase[0]}** ({best_phase[1]}%).")
                if worst_phase[0] != best_phase[0]:
                    lines.append(f"- Giai đoạn đối thủ dễ mắc sai sót và giảm sút độ chính xác nhiều nhất là **{worst_phase[0]}** ({worst_phase[1]}%).")
                    if worst_phase[0] == "Tàn cuộc":
                        lines.append("- 👉 **Chiến thuật đề xuất**: Hãy kiên trì đưa trận đấu vào tàn cuộc kỹ thuật, đối thủ thường xử lý thiếu chính xác khi lực lượng tinh giản.")
                    elif worst_phase[0] == "Trung cuộc":
                        lines.append("- 👉 **Chiến thuật đề xuất**: Hãy làm phức tạp hóa thế trận trung cuộc với nhiều biến chiến thuật, đối thủ có xu hướng lúng túng khi thế trận hỗn loạn.")
                    elif worst_phase[0] == "Khai cuộc":
                        lines.append("- 👉 **Chiến thuật đề xuất**: Hãy chuẩn bị các nhánh khai cuộc sắc bén và tạo áp lực ngay từ các nước đầu tiên.")

        return "\n".join(lines)

    # =========================================================================
    # 3. TRẢ LỜI VỀ PHONG CÁCH THI ĐẤU (PLAYING STYLE PROFILE)
    # =========================================================================
    if any(k in p for k in ["phong cách", "style", "chiến thuật", "biến động", "volatility", "thí quân", "sacrifice", "lối chơi"]):
        lines = [f"### 🎭 Đặc trưng Phong cách Thi đấu của **{selected_player}**\n"]

        lines.append("#### 📊 Các Chỉ số Đo lường Thực nghiệm từ Ván đấu:")
        dim_labels = [
            ("Độ biến động chiến thuật (Volatility)", raw_m.get("volatility_score", 50.0)),
            ("Tỉ lệ ván có nước Thí quân (Sacrifice Rate)", raw_m.get("sacrifice_rate", 0.0)),
            ("Chuyển tàn cuộc sớm (Simplification Rate)", raw_m.get("simplification_rate", 0.0)),
            ("Khả năng kiên cường lội ngược dòng (Resilience)", raw_m.get("resilience_rate", 50.0)),
            (f"Thế trận thường dùng ({raw_m.get('dominant_structure', 'Cờ kín')})", raw_m.get("dominant_structure_pct", 33.4)),
        ]
        for name, val in dim_labels:
            bar = "█" * int(min(100.0, max(0.0, float(val))) / 10) + "░" * (10 - int(min(100.0, max(0.0, float(val))) / 10))
            lines.append(f"- **{name}**: `{bar}` **{val}%**")

        evidence = style_prof.get("evidence", [])
        if evidence:
            lines.append("\n#### 🔍 Bằng chứng Thực nghiệm từ Dữ liệu Ván đấu:")
            for ev in evidence:
                lines.append(f"- {ev}")

        return "\n".join(lines)

    # =========================================================================
    # 4. TRẢ LỜI VỀ THÓI QUEN CHUYỂN TÀN CUỘC SỚM (ENDGAME SIMPLIFICATION)
    # =========================================================================
    if any(k in p for k in ["chuyển tàn", "tàn cuộc sớm", "simplifier", "đơn giản hóa", "tàn cuộc"]):
        lines = [f"### ♟️ Thói quen Chuyển Tàn cuộc của **{selected_player}**\n"]
        lines.append(f"- **Tỷ lệ chuyển tàn cuộc sớm (Simplification Rate)**: **{raw_m.get('simplification_rate', 0.0)}%**")
        lines.append(f"- **Thời điểm vào tàn cuộc trung bình**: **Nước {raw_m.get('avg_endgame_move', 0.0)}**")

        if raw_m.get("simplification_rate", 0.0) >= 30.0:
            if mode == "self":
                lines.append("\n💡 **Nhận định**: Bạn/học viên có xu hướng chủ động đổi quân đưa về tàn cuộc tương đối sớm. Hãy tiếp tục phát huy nhưng cần cẩn trọng tránh đơn giản hóa vội vàng khi chưa đủ ưu thế.")
            else:
                lines.append("\n💡 **Khuyến nghị chiến thuật**: Đối thủ có xu hướng chủ động đổi quân sớm đưa về tàn cuộc cân bằng. Nếu muốn tạo áp lực, bạn nên tránh các biến đổi quân sớm và duy trì thế trận phức tạp ở trung cuộc.")
        else:
            if mode == "self":
                lines.append("\n💡 **Nhận định**: Bạn/học viên có xu hướng giải quyết ván đấu ở trung cuộc và ít khi chủ động chuyển tàn sớm.")
            else:
                lines.append("\n💡 **Khuyến nghị chiến thuật**: Đối thủ ít khi chủ động chuyển tàn sớm mà có xu hướng duy trì quân lực để giải quyết ván đấu ở trung cuộc.")

        return "\n".join(lines)

    # =========================================================================
    # 5. TRẢ LỜI VỀ KHAI CUỘC & PHẢN ỨNG NƯỚC ĐI (REPERTOIRE & OPENING TREE)
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
    # 6. TRẢ LỜI VỀ ĐIỂM YẾU (WEAKNESSES)
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

        # 4. Điểm yếu giai đoạn
        phases_acc = {}
        for pk in ["opening", "middlegame", "endgame"]:
            ac = phases.get(pk, {}).get("accuracy")
            if ac is not None:
                phases_acc[pk] = ac
        if phases_acc:
            worst_p = min(phases_acc.items(), key=lambda x: x[1])
            p_map = {"opening": "Khai cuộc", "middlegame": "Trung cuộc", "endgame": "Tàn cuộc"}
            lines.append(f"4. ⏱ **Giai đoạn độ chính xác thấp nhất**: **{p_map.get(worst_p[0], worst_p[0])}** ({worst_p[1]}% accuracy).")

        return "\n".join(lines)

    # =========================================================================
    # 7. TRẢ LỜI MẶC ĐỊNH / TỔNG HỢP TOÀN DIỆN (GENERAL SUMMARY & INSIGHTS)
    # =========================================================================
    lines = [f"### ♟️ Báo cáo Tổng hợp Phân tích Toàn diện: **{selected_player}**\n"]
    lines.append(f"- **Tổng số ván đấu đã phân tích**: **{total_games}** ván • **Score tổng thể**: **{score_pct}%** ({stats.get('wins', 0)}T / {stats.get('draws', 0)}H / {stats.get('losses', 0)}B)")
    lines.append(f"- **Hiệu suất theo màu quân**: Cầm Trắng đạt **{w_score}%** • Cầm Đen đạt **{b_score}%**")
    lines.append(f"- **Phong cách thi đấu**: {style_prof.get('primary_icon', '♟️')} **{style_prof.get('primary_style', 'Chưa rõ')}** ({style_prof.get('archetype', '')})")
    
    if w_rep:
        lines.append(f"- **Khai cuộc chính khi cầm Trắng**: **{w_rep[0]['name']}** ({w_rep[0]['games_count']} ván, {w_rep[0].get('score_pct', 0)}% score)")
    if b_rep:
        lines.append(f"- **Khai cuộc chính khi cầm Đen**: **{b_rep[0]['name']}** ({b_rep[0]['games_count']} ván, {b_rep[0].get('score_pct', 0)}% score)")
    
    if structs:
        lines.append(f"- **Cấu trúc Tốt nổi bật**: **{structs[0]['name']}** (Score: {structs[0].get('score_pct', 0)}%, Bayes: {structs[0].get('adjusted_score_pct', 0)}%)")

    lines.append("\n💡 **Gợi ý**: Bạn có thể bấm vào các câu hỏi nhanh phía trên hoặc hỏi chi tiết về *khai cuộc, cấu trúc tốt, độ chính xác các giai đoạn, thói quen đổi Hậu* để nhận phân tích sâu hơn!")
    
    return "\n".join(lines)
