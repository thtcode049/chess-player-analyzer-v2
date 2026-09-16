"""
Statistical Confidence & Bayesian Performance Assessment Module
---------------------------------------------------------------
Chức năng: Đánh giá hiệu suất và xác định Điểm mạnh / Điểm yếu (Strengths / Weaknesses)
có tính đến kích thước mẫu (Sample Size) thông qua Bayesian / Empirical-Bayes Shrinkage.

Nguyên tắc:
1. Raw Statistics (wins, draws, losses, games_count, score_pct) luôn được giữ nguyên và hiển thị chính xác.
2. Adjusted Score: Áp dụng shrinkage kéo về overall player baseline để tránh ngộ nhận ván 1/1 win là điểm mạnh tuyệt đối.
3. Performance Delta: Tính độ chênh lệch giữa Adjusted Score và Baseline Score.
4. Categorical Assessment: Phân loại 5 cấp độ:
   - CONFIRMED_STRENGTH (Mẫu đủ lớn >= 5 và Delta >= +10%)
   - POTENTIAL_STRENGTH (Mẫu nhỏ < 5 nhưng Delta >= +10%)
   - CONFIRMED_WEAKNESS (Mẫu đủ lớn >= 5 và Delta <= -10%)
   - POTENTIAL_WEAKNESS (Mẫu nhỏ < 5 nhưng Delta <= -10%)
   - NEUTRAL (Trong phạm vi bình thường so với baseline)
"""

from typing import List, Dict, Any, Optional

# ==============================================================================
# CONFIGURATION CONSTANTS
# ==============================================================================
DEFAULT_PRIOR_STRENGTH: float = 6.0       # Trọng số shrinkage kéo về baseline
MIN_CONFIRMED_SAMPLE: int = 5             # Số ván tối thiểu để xác nhận (Confirmed)
DELTA_STRENGTH_THRESHOLD: float = 10.0    # Ngưỡng vượt trội (+10% so với baseline)
DELTA_WEAKNESS_THRESHOLD: float = -10.0   # Ngưỡng sụt giảm (-10% so với baseline)

# Categorical Assessments
ASSESSMENT_CONFIRMED_STRENGTH = "CONFIRMED_STRENGTH"
ASSESSMENT_POTENTIAL_STRENGTH = "POTENTIAL_STRENGTH"
ASSESSMENT_CONFIRMED_WEAKNESS = "CONFIRMED_WEAKNESS"
ASSESSMENT_POTENTIAL_WEAKNESS = "POTENTIAL_WEAKNESS"
ASSESSMENT_NEUTRAL = "NEUTRAL"


def get_confidence_level(sample_size: int) -> str:
    """Xác định mức độ tin cậy dựa trên số lượng mẫu."""
    if sample_size >= 10:
        return "HIGH"
    elif sample_size >= 5:
        return "MEDIUM"
    else:
        return "LOW"


def format_confidence_label(sample_size: int, lang: str = "vi") -> Dict[str, Any]:
    """Định dạng nhãn và màu sắc mức độ tin cậy của mẫu."""
    level = get_confidence_level(sample_size)
    if level == "HIGH":
        label = "Độ tin cậy Cao"
        color = "#22C55E"
    elif level == "MEDIUM":
        label = "Độ tin cậy Trung bình"
        color = "#EAB308"
    else:
        label = "Độ tin cậy Thấp (Cần thêm dữ liệu)"
        color = "#94A3B8"

    return {
        "level": level,
        "sample_size": sample_size,
        "label": label,
        "color": color,
    }


def calculate_adjusted_score(
    wins: int,
    draws: int,
    games_count: int,
    baseline_score: float,
    prior_strength: float = DEFAULT_PRIOR_STRENGTH
) -> float:
    """
    Tính Adjusted Score % (0-100) theo mô hình Bayesian / Empirical-Bayes Shrinkage.
    """
    if games_count <= 0:
        return round(float(baseline_score), 1)

    points = wins + 0.5 * draws
    prior_points = prior_strength * (baseline_score / 100.0)
    adjusted = ((points + prior_points) / (games_count + prior_strength)) * 100.0
    return round(max(0.0, min(100.0, adjusted)), 1)


def calculate_delta(adjusted_score: float, baseline_score: float) -> float:
    """Tính độ chênh lệch (Performance Delta) giữa Adjusted Score và Baseline Score."""
    return round(adjusted_score - baseline_score, 1)


def assess_performance(
    games_count: int,
    delta_vs_baseline: float,
    min_confirmed: int = MIN_CONFIRMED_SAMPLE,
    delta_strength: float = DELTA_STRENGTH_THRESHOLD,
    delta_weakness: float = DELTA_WEAKNESS_THRESHOLD
) -> str:
    """Phân loại đánh giá hiệu suất dựa trên kích thước mẫu và Performance Delta."""
    if delta_vs_baseline >= delta_strength:
        if games_count >= min_confirmed:
            return ASSESSMENT_CONFIRMED_STRENGTH
        return ASSESSMENT_POTENTIAL_STRENGTH
    elif delta_vs_baseline <= delta_weakness:
        if games_count >= min_confirmed:
            return ASSESSMENT_CONFIRMED_WEAKNESS
        return ASSESSMENT_POTENTIAL_WEAKNESS
    return ASSESSMENT_NEUTRAL


def get_sample_confidence(games_count: int) -> str:
    """Xác định mức độ tin cậy dựa trên số lượng ván đấu."""
    if games_count >= 10:
        return "HIGH"
    elif games_count >= 5:
        return "MEDIUM"
    return "LOW"


def format_assessment_label(assessment: str, lang: str = "vi") -> Dict[str, str]:
    """Trả về nhãn, màu sắc và icon hiển thị cho từng trạng thái assessment (Tiếng Việt)."""
    labels = {
        ASSESSMENT_CONFIRMED_STRENGTH: {
            "label": "Điểm mạnh Đã xác thực",
            "badge": "★ Điểm mạnh Xác thực",
            "color": "#22C55E",
            "icon": "🟢"
        },
        ASSESSMENT_POTENTIAL_STRENGTH: {
            "label": "Điểm mạnh Tiềm năng (Mẫu nhỏ)",
            "badge": "▲ Điểm mạnh Tiềm năng",
            "color": "#10B981",
            "icon": "🌱"
        },
        ASSESSMENT_CONFIRMED_WEAKNESS: {
            "label": "Điểm yếu Đã xác thực",
            "badge": "⚠️ Điểm yếu Xác thực",
            "color": "#EF4444",
            "icon": "🔴"
        },
        ASSESSMENT_POTENTIAL_WEAKNESS: {
            "label": "Điểm yếu Tiềm năng (Mẫu nhỏ)",
            "badge": "▽ Điểm yếu Tiềm năng",
            "color": "#F59E0B",
            "icon": "🌾"
        },
        ASSESSMENT_NEUTRAL: {
            "label": "Hiệu suất Trung tính",
            "badge": "● Trung tính",
            "color": "#94A3B8",
            "icon": "⚪"
        }
    }
    info = labels.get(assessment, labels[ASSESSMENT_NEUTRAL])
    return {
        "assessment": assessment,
        "label": info["label"],
        "badge": info["badge"],
        "color": info["color"],
        "icon": info["icon"]
    }


def enrich_performance_item(
    item: Dict[str, Any],
    baseline_score: float,
    prior_strength: float = DEFAULT_PRIOR_STRENGTH,
    lang: str = "vi"
) -> Dict[str, Any]:
    """Bổ sung các chỉ số Bayesian vào đối tượng thống kê."""
    wins = item.get("wins", 0)
    draws = item.get("draws", 0)
    games_count = item.get("games_count", 0)
    
    raw_score = item.get("score_pct", 0.0)
    if "raw_score_pct" not in item:
        item["raw_score_pct"] = raw_score

    adj_score = calculate_adjusted_score(wins, draws, games_count, baseline_score, prior_strength)
    delta = calculate_delta(adj_score, baseline_score)
    assess = assess_performance(games_count, delta)
    conf_level = get_sample_confidence(games_count)
    assess_format = format_assessment_label(assess, lang=lang)

    item["adjusted_score_pct"] = adj_score
    item["delta_vs_baseline"] = delta
    item["assessment"] = assess
    item["assessment_label"] = assess_format["label"]
    item["assessment_badge"] = assess_format["badge"]
    item["assessment_color"] = assess_format["color"]
    item["confidence_level"] = conf_level

    return item


def rank_strongest_items(
    items: List[Dict[str, Any]],
    score_key: str = "adjusted_score_pct",
    delta_key: str = "delta_vs_baseline",
    assessment_key: str = "assessment"
) -> List[Dict[str, Any]]:
    """Xếp hạng các mục mạnh nhất (Strongest Openings / Structures)."""
    def _rank_weight(it: Dict[str, Any]):
        ass = it.get(assessment_key, ASSESSMENT_NEUTRAL)
        if ass == ASSESSMENT_CONFIRMED_STRENGTH:
            tier = 3
        elif ass == ASSESSMENT_POTENTIAL_STRENGTH:
            tier = 2
        elif ass == ASSESSMENT_NEUTRAL:
            tier = 1
        else:
            tier = 0
        
        adj_s = it.get(score_key, 0.0)
        delta_v = it.get(delta_key, 0.0)
        g_cnt = it.get("games_count", 0)
        return (tier, delta_v, adj_s, g_cnt)

    return sorted(items, key=_rank_weight, reverse=True)


def rank_weakest_items(
    items: List[Dict[str, Any]],
    score_key: str = "adjusted_score_pct",
    delta_key: str = "delta_vs_baseline",
    assessment_key: str = "assessment"
) -> List[Dict[str, Any]]:
    """Xếp hạng các mục yếu nhất / mục tiêu rèn luyện hoặc khai thác."""
    def _rank_weight(it: Dict[str, Any]):
        ass = it.get(assessment_key, ASSESSMENT_NEUTRAL)
        if ass == ASSESSMENT_CONFIRMED_WEAKNESS:
            tier = 3
        elif ass == ASSESSMENT_POTENTIAL_WEAKNESS:
            tier = 2
        elif ass == ASSESSMENT_NEUTRAL:
            tier = 1
        else:
            tier = 0
        
        adj_s = it.get(score_key, 50.0)
        delta_v = it.get(delta_key, 0.0)
        g_cnt = it.get("games_count", 0)
        return (tier, -delta_v, -adj_s, g_cnt)

    return sorted(items, key=_rank_weight, reverse=True)
