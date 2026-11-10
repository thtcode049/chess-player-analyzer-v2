"""Generate descriptive briefings from the analysis snapshot."""
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode


def format_game_reference(game: Dict[str, Any], label: str) -> str:
    game_id = game.get("id")
    if game_id:
        return f"[{label}](/analyze?{urlencode({'gameId': game_id})})"
    return f"{label} ({game.get('white', 'Trắng')} – {game.get('black', 'Đen')})"


def format_group_stats(item: Dict[str, Any]) -> str:
    parts = []
    if item.get("games_count") is not None:
        parts.append(f"{item['games_count']} ván")
    if all(item.get(key) is not None for key in ("wins", "draws", "losses")):
        parts.append(f"{item['wins']} thắng, {item['draws']} hòa, {item['losses']} thua")
    if item.get("score_pct") is not None and item.get("games_count") != 0:
        parts.append(f"{item['score_pct']}% điểm")
    return " · ".join(parts) or "Chưa có thống kê"


def format_profile_stats(stats: Dict[str, Any]) -> List[str]:
    overall = {**stats, "games_count": stats.get("total_games"), "score_pct": stats.get("score_percentage")}
    lines = [f"- **Tổng quan:** {format_group_stats(overall)}"]
    for color, label in (("white", "Cầm Trắng"), ("black", "Cầm Đen")):
        count = stats.get(f"{color}_games")
        if count == 0:
            lines.append(f"- **{label}:** 0 ván")
        elif count is None:
            lines.append(f"- **{label}:** Chưa có số ván theo màu quân.")
        else:
            by_color = {key: stats.get(f"{color}_{key}") for key in ("wins", "draws", "losses")}
            by_color.update(games_count=count, score_pct=stats.get(f"{color}_score_percentage"))
            lines.append(f"- **{label}:** {format_group_stats(by_color)}")
    return lines


def generate_initial_strategic_briefing(
    deep_profile: Optional[Dict[str, Any]],
    stats: Optional[Dict[str, Any]],
    selected_player: str = "Kỳ thủ",
    mode: str = "self",
    games: Optional[List[Dict[str, Any]]] = None,
) -> str:
    if not stats or stats.get("total_games") == 0:
        return f"Chưa có dữ liệu ván đấu đã phân tích của **{selected_player}**."

    title = "Chuẩn bị đối đầu" if mode == "opponent" else "Tổng quan hồ sơ"
    lines = [f"### {title} · {selected_player}", "", *format_profile_stats(stats)]
    repertoire = (deep_profile or {}).get("repertoire", {})
    structures = (deep_profile or {}).get("structures", {}).get("structures", [])

    openings = repertoire.get("all_openings", [])
    def describe(item: Dict[str, Any], indices: List[int]) -> str:
        summary = f"- **{item['name']}** · {format_group_stats(item)}"
        if games:
            references = [format_game_reference(games[index], f"Ván {index + 1}")
                          for index in indices[:2] if isinstance(index, int) and 0 <= index < len(games)]
            if references:
                summary += f" · Xem {', '.join(references)}"
        return summary

    if openings:
        lines.extend(["", "**Khai cuộc trong tập ván đã phân tích**"])
        lines.extend(describe(item, item.get("game_indices", [])) for item in openings[:3])
    if structures:
        lines.extend(["", "**Cấu trúc Tốt đã ghi nhận**"])
        lines.extend(describe(item, [game.get("game_index") for game in item.get("games", [])])
                     for item in structures[:3])
        lines.append("Một ván có thể xuất hiện trong nhiều nhóm cấu trúc Tốt.")
    if openings or structures:
        lines.extend(["", "Mở danh sách ván của nhóm để xem lại các thế cờ và diễn biến cụ thể."])
    return "\n".join(lines)


def get_followup_prompts(mode: str = "self") -> List[str]:
    return [
        "Khai cuộc nào xuất hiện nhiều nhất khi cầm Trắng và khi cầm Đen?",
        "Những cấu trúc Tốt nào đã xuất hiện? Cho mình xem các ván liên quan.",
        "Gợi ý ván để chuẩn bị đối đầu." if mode == "opponent" else "Gợi ý ván để xem lại và luyện tập.",
    ]
