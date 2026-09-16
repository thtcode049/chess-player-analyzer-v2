"""
Match Preparation & Strategic Recommendations Module
---------------------------------------------------
Chức năng: Phân tích điểm yếu và tự động tạo đề xuất chiến thuật thi đấu (Rule-Based Logic)
giúp người chơi chuẩn bị trước trận đấu đối đầu với một đối thủ cụ thể.
"""

from typing import List, Dict, Any


def analyze_opponent_responses(
    filtered_games: List[Dict[str, Any]],
    user_color: str = "white",
    chosen_move: str = "ALL"
) -> Dict[str, Any]:
    """
    Phân tích phản ứng của đối thủ đối với từng nước đi khai cuộc do người chơi chủ động lựa chọn.
    """
    first_move_groups: Dict[str, Dict[str, Any]] = {}

    target_player_color = "black" if user_color == "white" else "white"
    relevant_games = [g for g in filtered_games if g.get("player_color") == target_player_color]

    for game in relevant_games:
        moves = game.get("moves", [])
        if not moves:
            continue
        
        first_move = moves[0]
        resp_move = moves[1] if len(moves) >= 2 else "Unknown"
        opening_name = game.get("opening", "Unknown Opening")
        result = game.get("result", "*")

        if result == "1/2-1/2":
            is_win, is_draw, is_loss = False, True, False
        elif (target_player_color == "white" and result == "1-0") or (target_player_color == "black" and result == "0-1"):
            is_win, is_draw, is_loss = True, False, False
        else:
            is_win, is_draw, is_loss = False, False, True

        if first_move not in first_move_groups:
            first_move_groups[first_move] = {
                "total_games": 0,
                "responses": {}
            }

        group = first_move_groups[first_move]
        group["total_games"] += 1

        if resp_move not in group["responses"]:
            group["responses"][resp_move] = {
                "resp_move": resp_move,
                "opening_name": opening_name,
                "games_count": 0,
                "wins": 0,
                "draws": 0,
                "losses": 0,
            }

        r_stat = group["responses"][resp_move]
        r_stat["games_count"] += 1
        if is_win:
            r_stat["wins"] += 1
        elif is_draw:
            r_stat["draws"] += 1
        elif is_loss:
            r_stat["losses"] += 1

    move_options = sorted(first_move_groups.keys(), key=lambda k: first_move_groups[k]["total_games"], reverse=True)
    
    selected_first_move = chosen_move if (chosen_move and chosen_move in first_move_groups) else (move_options[0] if move_options else "e4")

    active_group = first_move_groups.get(selected_first_move, {"total_games": 0, "responses": {}})
    total_in_group = active_group.get("total_games", 0)

    responses_list = []
    for resp_move, data in active_group.get("responses", {}).items():
        g_count = data["games_count"]
        w, d, l = data["wins"], data["draws"], data["losses"]
        score_pct = round(((w + 0.5 * d) / g_count) * 100, 1) if g_count > 0 else 0.0
        usage_pct = round((g_count / total_in_group) * 100, 1) if total_in_group > 0 else 0.0

        if score_pct <= 40.0:
            assessment = "weakness"
            tag_label = "Điểm yếu đối thủ (Tỷ lệ thắng thấp)"
        elif score_pct >= 60.0:
            assessment = "stronghold"
            tag_label = "Đòn mạnh đối thủ (Tỷ lệ thắng cao)"
        else:
            assessment = "neutral"
            tag_label = "Thế trận cân bằng"

        responses_list.append({
            "response_move": resp_move,
            "games_count": g_count,
            "usage_pct": usage_pct,
            "wins": w,
            "draws": d,
            "losses": l,
            "score_pct": score_pct,
            "win_pct": round((w / g_count) * 100, 1) if g_count > 0 else 0.0,
            "draw_pct": round((d / g_count) * 100, 1) if g_count > 0 else 0.0,
            "loss_pct": round((l / g_count) * 100, 1) if g_count > 0 else 0.0,
            "primary_openings": data.get("opening_name", "")
        })

    responses_list.sort(key=lambda x: x["games_count"], reverse=True)

    return {
        "available_first_moves": move_options,
        "selected_first_move": selected_first_move,
        "total_games_in_move": total_in_group,
        "responses": responses_list
    }


from src.analysis.confidence import (
    rank_weakest_items,
    rank_strongest_items,
    ASSESSMENT_CONFIRMED_WEAKNESS,
    ASSESSMENT_POTENTIAL_WEAKNESS,
)


def generate_match_preparation(
    filtered_games: List[Dict[str, Any]],
    stats: Dict[str, Any],
    repertoire_data: Dict[str, Any],
    fen_map: Dict[str, Any],
    user_color: str = "white",
    selected_player: str = "",
    chosen_move: str = ""
) -> Dict[str, Any]:
    """
    Tạo kế hoạch chuẩn bị trận đấu chi tiết dựa trên dữ liệu lịch sử đấu của đối thủ.
    Tích hợp Bayesian Framework để chỉ tập trung vào các điểm yếu có độ tin cậy thống kê cao.
    """
    if not filtered_games:
        return {
            "target_weaknesses": [],
            "recommended_lines": [],
            "surprise_weapons": [],
            "opponent_responses": {"available_first_moves": [], "selected_first_move": "", "total_games_in_move": 0, "responses": []},
            "gameplan_checklist": ["Không đủ dữ liệu ván đấu để phân tích."]
        }

    all_openings = repertoire_data.get("all_openings", [])
    white_rep = repertoire_data.get("white_repertoire", [])
    black_rep = repertoire_data.get("black_repertoire", [])

    # Phân tích phản ứng đối thủ theo nước đi chủ động
    opponent_responses = analyze_opponent_responses(filtered_games, user_color, chosen_move)

    # 1. Điểm yếu của đối thủ (Ưu tiên Confirmed Weakness -> Potential Weakness)
    target_weaknesses = []
    ranked_all_weak = rank_weakest_items(all_openings)
    for op in ranked_all_weak:
        assess = op.get("assessment", "")
        delta = op.get("delta_vs_baseline", 0.0)
        raw_score = op.get("score_pct", 50.0)
        g_count = op.get("games_count", 0)

        # Điều kiện điểm yếu: Confirmed Weakness HOẶC Potential Weakness HOẶC Delta <= -5% HOẶC Raw Score <= 45%
        if assess in [ASSESSMENT_CONFIRMED_WEAKNESS, ASSESSMENT_POTENTIAL_WEAKNESS] or delta <= -5.0 or (g_count >= 1 and raw_score <= 45.0):
            l_pct = op.get("loss_pct", round((op.get("losses", 0) / g_count) * 100, 1) if g_count > 0 else 0.0)
            target_weaknesses.append({
                "name": op["name"],
                "games_count": g_count,
                "score_pct": raw_score,
                "adjusted_score_pct": op.get("adjusted_score_pct", raw_score),
                "delta_vs_baseline": delta,
                "assessment": assess,
                "assessment_badge": op.get("assessment_badge", ""),
                "loss_pct": l_pct,
                "reason": f"Điểm số thấp ({raw_score}%) và tỷ lệ thua {l_pct}% trong {g_count} ván."
            })

    # 2. Đề xuất phương án tác chiến theo Màu quân của Người dùng
    recommended_lines = []
    
    if user_color == "white":
        # Bạn cầm Trắng -> Đối thủ cầm Đen
        ranked_b_weak = rank_weakest_items(black_rep)
        weak_black_ops = [
            b for b in ranked_b_weak 
            if b.get("assessment") in [ASSESSMENT_CONFIRMED_WEAKNESS, ASSESSMENT_POTENTIAL_WEAKNESS] 
            or b.get("delta_vs_baseline", 0.0) <= -5.0 
            or b.get("score_pct", 50.0) <= 50.0
        ]
        if weak_black_ops:
            for b_op in weak_black_ops[:3]:
                priority = "High" if b_op.get("assessment") == ASSESSMENT_CONFIRMED_WEAKNESS or b_op.get("score_pct", 50.0) < 40.0 else "Medium"
                recommended_lines.append({
                    "title": f"Tấn công vào {b_op['name']}",
                    "detail": f"Đối thủ đạt hiệu suất kém ({b_op['score_pct']}%) ở biến cờ này khi cầm Đen.",
                    "priority": priority
                })
        else:
            if black_rep:
                most_played_b = max(black_rep, key=lambda x: x["games_count"])
                recommended_lines.append({
                    "title": f"Chuẩn bị đối đầu {most_played_b['name']}",
                    "detail": f"Đây là vũ khí chính của đối thủ khi cầm Đen ({most_played_b['games_count']} ván, {most_played_b['score_pct']}% score).",
                    "priority": "Medium"
                })
    else:
        # Bạn cầm Đen -> Đối thủ cầm Trắng
        ranked_w_weak = rank_weakest_items(white_rep)
        weak_white_ops = [
            w for w in ranked_w_weak 
            if w.get("assessment") in [ASSESSMENT_CONFIRMED_WEAKNESS, ASSESSMENT_POTENTIAL_WEAKNESS] 
            or w.get("delta_vs_baseline", 0.0) <= -5.0 
            or w.get("score_pct", 50.0) <= 50.0
        ]
        if weak_white_ops:
            for w_op in weak_white_ops[:3]:
                priority = "High" if w_op.get("assessment") == ASSESSMENT_CONFIRMED_WEAKNESS or w_op.get("score_pct", 50.0) < 40.0 else "Medium"
                recommended_lines.append({
                    "title": f"Nhắm vào biến {w_op['name']}",
                    "detail": f"Đối thủ thi đấu kém ({w_op['score_pct']}%) khi cầm Trắng ở biến này.",
                    "priority": priority
                })
        else:
            if white_rep:
                most_played_w = max(white_rep, key=lambda x: x["games_count"])
                recommended_lines.append({
                    "title": f"Phòng thủ trước {most_played_w['name']}",
                    "detail": f"Khai cuộc xuất hiện nhiều nhất của đối thủ khi cầm Trắng ({most_played_w['games_count']} ván, {most_played_w['score_pct']}% score).",
                    "priority": "High"
                })

    # 3. Vũ khí bất ngờ (Surprise Weapons - Các nhánh hiếm gặp mà đối thủ thua)
    surprise_weapons = []
    for fen, node in fen_map.items():
        if node.games_count >= 1 and node.games_count <= 3 and node.losses >= 1:
            win_pct = round((node.wins / node.games_count) * 100, 1)
            if win_pct < 34.0:
                surprise_weapons.append({
                    "move_san": node.move_san,
                    "fen": fen,
                    "games_count": node.games_count,
                    "losses": node.losses,
                    "note": f"Đối thủ từng thua {node.losses}/{node.games_count} ván khi thế cờ này xuất hiện."
                })
                if len(surprise_weapons) >= 3:
                    break

    # 4. Actionable Checklist (Sử dụng đúng kỳ thủ đối thủ được chọn)
    target_opponent = selected_player if selected_player else "Opponent"
    checklist = [
        f"Bạn cầm quân {user_color.upper()} đối đầu với {target_opponent}.",
        f"Hiệu suất tổng thể của đối thủ: {stats.get('score_percentage', 0)}% (Thắng: {stats.get('wins', 0)}, Hòa: {stats.get('draws', 0)}, Thua: {stats.get('losses', 0)}).",
    ]

    if recommended_lines:
        checklist.append(f"Mục tiêu ưu tiên: {recommended_lines[0]['title']} — {recommended_lines[0]['detail']}")
    
    if target_weaknesses:
        checklist.append(f"Khai thác điểm yếu: Đối thủ thi đấu kém ở {target_weaknesses[0]['name']} (Điểm số: {target_weaknesses[0]['score_pct']}%).")
    else:
        checklist.append("Chưa phát hiện điểm yếu khai cuộc đáng kể từ đối thủ.")

    checklist.append("Duy trì cấu trúc tốt vững chắc và tận dụng tối đa lợi thế thời gian.")

    return {
        "target_weaknesses": target_weaknesses[:5],
        "recommended_lines": recommended_lines,
        "surprise_weapons": surprise_weapons,
        "opponent_responses": opponent_responses,
        "gameplan_checklist": checklist
    }


def generate_actionable_match_preparation(
    deep_profile: Dict[str, Any],
    user_color: str = "white",
    lang: str = "vi"
) -> Dict[str, Any]:
    """
    Chuyển đổi các phát hiện từ Deep Opponent Profile thành Kế hoạch Thi đấu Ngắn gọn & Có thể Hành động (Decision Support Match Prep).
    Kết hợp đa chiều: Repertoire, Structures, Phases, Dynamics, Simplification, và Playing Style Profile.
    Áp dụng Bayesian Ranking để chọn đúng vũ khí chủ lực và điểm yếu xác thực của đối thủ.
    """
    repertoire = deep_profile.get("repertoire", {})
    structures = deep_profile.get("structures", {})
    phases = deep_profile.get("phases", {})
    dynamics = deep_profile.get("dynamics", {})
    simplification = deep_profile.get("simplification", {})
    style_profile = deep_profile.get("style_profile", {})
    critical_positions = deep_profile.get("critical_positions", [])

    # A. Khai cuộc Mạnh nhất & Yếu nhất của đối thủ (Xếp hạng Bayesian)
    all_openings = repertoire.get("all_openings", [])
    target_rep = repertoire.get("black_repertoire" if user_color == "white" else "white_repertoire", all_openings)

    eligible_ops = [op for op in target_rep if op.get("games_count", 0) >= 1]
    ranked_strong_ops = rank_strongest_items(eligible_ops)
    ranked_weak_ops = rank_weakest_items(eligible_ops)

    strongest_op = ranked_strong_ops[0] if ranked_strong_ops else None
    weakest_op = ranked_weak_ops[0] if ranked_weak_ops else None

    # B. Target Structure
    target_struct = structures.get("target_structure")

    # C. Vulnerability Phase
    weakest_phase = phases.get("weakest_phase")

    # D. Game Dynamics & Style Profile
    throw_rate = dynamics.get("throw_rate", 0.0)
    resilience_rate = dynamics.get("resilience_rate", 0.0)
    primary_style_key = style_profile.get("primary_key", "")
    scores = style_profile.get("scores", {})
    tactical_score = scores.get("tactical", 50.0)
    positional_score = scores.get("positional", 50.0)
    solid_score = scores.get("solid", 50.0)
    universal_score = scores.get("universal", 50.0)

    # E. Final Game Plan (PLAY, TARGET, AVOID)
    play_recs = []
    target_recs = []
    avoid_recs = []

    # --- 1. PLAY Recommendations ---
    if weakest_phase and weakest_phase.get("phase") == "endgame":
        play_recs.append(
            "Đưa trận đấu về Cờ tàn (Endgame) khi vị trí thuận lợi vì đối thủ sụt giảm độ chính xác rõ rệt."
        )
    elif weakest_phase and weakest_phase.get("phase") == "middlegame":
        play_recs.append(
            "Duy trì sức ép phức tạp trong Trung cuộc để khai thác điểm yếu xử lý trung cuộc của đối thủ."
        )
    else:
        play_recs.append(
            "Thi đấu chắc chắn, phát triển quân hài hòa và tuân thủ nguyên tắc vị trí."
        )

    # Đề xuất bổ trợ từ Style Profile
    if primary_style_key == "tactical" and tactical_score >= 65.0:
        play_recs.append(
            "Ưu tiên các phương án làm giảm độ biến động thế cờ (Low Volatility), tránh để đối thủ mở toang trung lộ."
        )
    elif primary_style_key == "positional" and positional_score >= 65.0:
        play_recs.append(
            "Chủ động phá vỡ cấu trúc Tốt và mở cột giao tranh, không đánh thụ động để tránh bị đối thủ bóp nghẹt không gian."
        )
    elif primary_style_key == "solid" and solid_score >= 65.0:
        play_recs.append(
            "Duy trì sức ép kiên nhẫn, không vội vàng dồn toàn lực công phá mạo hiểm dễ dính bẫy phản công."
        )

    if throw_rate >= 25.0:
        play_recs.append(
            f"Duy trì kiên trì khi bị lép vế vì đối thủ có tỷ lệ quăng lợi thế cao ({throw_rate}% throw rate)."
        )

    # --- 2. TARGET Recommendations ---
    if target_struct:
        target_recs.append(
            f"Chủ động lái trận đấu về cấu trúc {target_struct['name']} (đối thủ chỉ đạt {target_struct['score_pct']}% score)."
        )

    if weakest_op:
        target_recs.append(
            f"Khai thác hệ thống {weakest_op['name']} (đối thủ đạt {weakest_op['score_pct']}% score)."
        )

    # --- 3. AVOID Recommendations ---
    if strongest_op and strongest_op.get("score_pct", 0) >= 55.0:
        avoid_recs.append(
            f"Tránh đi vào biến chuẩn bị mạnh nhất của đối thủ: {strongest_op['name']} ({strongest_op['score_pct']}% score) trừ khi đã chuẩn bị kỹ."
        )

    if not avoid_recs:
        avoid_recs.append(
            "Tránh các phương án chiến thuật bẫy rủi ro cao chưa chuẩn bị kỹ."
        )

    return {
        "strongest_opening": strongest_op,
        "weakest_opening": weakest_op,
        "target_structure": target_struct,
        "vulnerability_phase": weakest_phase,
        "throw_rate": throw_rate,
        "resilience_rate": resilience_rate,
        "style_profile": style_profile,
        "play_plan": play_recs,
        "target_plan": target_recs,
        "avoid_plan": avoid_recs,
        "training_positions": critical_positions[:3]
    }


