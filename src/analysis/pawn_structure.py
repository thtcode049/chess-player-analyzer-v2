"""
Pawn Structure Detection & Performance Analysis Module
------------------------------------------------------
Chức năng: Nhận diện cấu trúc Tốt (Pawn Structure) bằng luật giải định hình cờ (Deterministic Rules) qua python-chess.
Phân tích hiệu suất của đối thủ khi thi đấu trong từng dạng cấu trúc Tốt.
Tổ chức thành 2 nhóm chính:
- Nhóm A: Cấu trúc nền tảng và trạng thái trung tâm (IQP, Hanging Pawns, Open, Semi-Open, Closed, Symmetrical)
- Nhóm B: Cấu trúc chiến lược kinh điển (Carlsbad, Maroczy Bind, Hedgehog, Stonewall)
"""

from typing import List, Dict, Any, Optional
import chess

from src.analysis.confidence import (
    enrich_performance_item,
    rank_weakest_items,
    format_confidence_label,
    ASSESSMENT_CONFIRMED_WEAKNESS,
    ASSESSMENT_POTENTIAL_WEAKNESS,
    DEFAULT_PRIOR_STRENGTH
)


STRATEGIC_PLANS = {
    # Nhóm A: Cấu trúc nền tảng và trạng thái trung tâm
    "IQP": {
        "ideas": [
            "Tận dụng ưu thế không gian và các ô tiền đồn mạnh c5/e5 để phát triển quân chủ động.",
            "Chuẩn bị thời cơ thích hợp đẩy đòn đột phá trung tâm d4-d5 (hoặc ...d5-d4) nhằm mở toang thế trận tấn công thành Vua."
        ],
        "counter_ideas": [
            "Thiết lập khối phong tỏa kiên cố ngay trước mặt tốt cô lập (ô d5 đối với Trắng hoặc d4 đối với Đen), đặc biệt bằng Mã.",
            "Chủ động đổi bớt quân nhẹ nhằm giảm sức ép công thành của đối phương và đưa về tàn cuộc khai thác điểm yếu tốt cô lập."
        ]
    },
    "Hanging_Pawns": {
        "ideas": [
            "Dùng cặp tốt c4+d4 (hoặc c5+d5) kiểm soát các ô trung tâm then chốt, tạo chỗ đứng cho quân nhẹ gây sức ép.",
            "Chọn thời điểm thích hợp đẩy một trong hai tốt lên (d4-d5 hoặc c4-c5) nhằm tạo tốt thông nguy hiểm hoặc mở đường công phá."
        ],
        "counter_ideas": [
            "Gây sức ép trực diện dọc theo cột mở/nửa mở b và d, buộc một tốt phải dâng lên.",
            "Khi một tốt dâng lên, khóa chặt ô trước mặt tốt còn lại (biến nó thành tốt lạc hậu) để tập trung hỏa lực vây bắt."
        ]
    },
    "Open": {
        "ideas": [
            "Nhanh chóng chiếm lĩnh hai cột mở trung tâm (d và e) bằng các quân Xe và Hậu.",
            "Tận dụng đường mở cơ động cho Tượng và Mã thâm nhập sâu vào trận địa đối phương."
        ],
        "counter_ideas": [
            "Tranh chấp quyền kiểm soát cột mở bằng cách đấu bớt Xe và Hậu.",
            "Kiểm soát các ô trung tâm bằng quân nhẹ, tránh để đối phương thâm nhập hàng 7/ hàng 2."
        ]
    },
    "Semi-Open": {
        "ideas": [
            "Dồn quân nặng kiểm soát cột nửa mở, nhắm vào các quân tốt mục tiêu của đối thủ trên cột này.",
            "Phối hợp đòn công phá cánh hoặc đột phá trung tâm trên các cột lân cận."
        ],
        "counter_ideas": [
            "Bảo vệ vững chắc tốt trên cột nửa mở (dùng Xe hoặc quân nhẹ phòng thủ thụ động hiệu quả).",
            "Mở mặt trận đối xứng trên cột nửa mở của chính mình để tạo sức ép ngược lại."
        ]
    },
    "Closed": {
        "ideas": [
            "Do trung tâm đã bị khóa cứng, chuyển toàn bộ trọng tâm tác chiến sang hai cánh.",
            "Chuẩn bị các đòn đột phá tốt ở cánh (f4/f5 để công thành hoặc b4/b5 để mở cánh Hậu)."
        ],
        "counter_ideas": [
            "Khóa chặt cánh mà đối phương đang chuẩn bị đột phá hoặc dồn quân phòng thủ vững chắc.",
            "Chủ động phát động tấn công quyết liệt ở cánh đối diện để buộc đối phương phải phân tán lực lượng."
        ]
    },
    "Symmetrical": {
        "ideas": [
            "Khai thác từng lợi thế nhỏ mang tính vị trí: quyền đi trước, cặp Tượng mạnh hơn, hoặc chiếm ô kiểm soát trung lộ.",
            "Giữ vững thế cờ chặt chẽ, tạo áp lực vi mô buộc đối phương mắc sai lầm kiên nhẫn."
        ],
        "counter_ideas": [
            "Hóa giải áp lực bằng cách đổi quân hợp lý và đối xứng hóa các vị trí then chốt.",
            "Tìm kiếm cơ hội phá vỡ tính đối xứng bất ngờ bằng một nước đi chiến thuật hoặc chuyển đổi cấu trúc tốt."
        ]
    },

    # Nhóm B: Cấu trúc chiến lược kinh điển
    "Carlsbad": {
        "ideas": [
            "Trắng triển khai đòn tấn công thiểu số cánh Hậu (Minority Attack: a4, b4-b5) nhằm làm suy yếu cấu trúc tốt c6/d5 của Đen.",
            "Hoặc Trắng kiểm soát trung tâm chuẩn bị đòn đẩy e3-e4 mở toang trung lộ khi Đen phòng thủ cánh Hậu quá mức."
        ],
        "counter_ideas": [
            "Đen thiết lập tiền đồn Ne4 vững chắc, dồn toàn bộ hỏa lực sang cánh Vua (f7-f5, Rf6-h6, Qh4) để phản công thành Vua.",
            "Hoặc Đen đẩy a7-a5 để chặn đứng đòn b4-b5 của Trắng trên cánh Hậu."
        ]
    },
    "Maroczy_Bind": {
        "ideas": [
            "Trắng dùng cặp tốt c4 và e4 siết chặt ô d5, bóp nghẹt không gian trung tâm và ngăn Đen giải phóng cờ.",
            "Từ từ tích lũy ưu thế không gian, gia tăng sức ép trên cánh Hậu hoặc trung tâm bằng các quân nặng."
        ],
        "counter_ideas": [
            "Đen kiên nhẫn tìm cách đổi bớt quân nhẹ để giảm bớt sự ngột ngạt vì thiếu không gian cơ động.",
            "Chuẩn bị các đòn đột phá giải phóng kinh điển: ...b7-b5 hoặc ...d6-d5 vào thời điểm đối phương sơ hở."
        ]
    },
    "Hedgehog": {
        "ideas": [
            "Đen dàn hàng tốt kiên cố trên hàng 6 (a6, b6, d6, e6) như gai nhím, các quân nhẹ ẩn nấp phía sau chờ thời cơ.",
            "Tích lũy thế năng và rình rập thời khắc bùng nổ bằng các đòn đẩy tốt giải phóng ...d6-d5! hoặc ...b6-b5! đập tan trung tâm Trắng."
        ],
        "counter_ideas": [
            "Trắng duy trì vòng kiềm tỏa không gian chặt chẽ, kiểm soát chặt ô d5 và b5, tránh đẩy tốt quá đà tạo sơ hở.",
            "Điều chuyển quân bài bản gây sức ép lên điểm yếu tiềm tàng d6 của Đen."
        ]
    },
    "Stonewall": {
        "ideas": [
            "Thiết lập khối phòng thủ đá tảng trung tâm (c3/d4/e3/f4 đối với Trắng hoặc c6/d5/e6/f5 đối với Đen).",
            "Chiếm lĩnh ô tiền đồn then chốt Ne5 (hoặc ...Ne4) và mở cuộc tấn công vũ bão sang cánh Vua với Bd3, Qe2, Rf3-h3."
        ],
        "counter_ideas": [
            "Khai thác lỗ hổng chiến lược tại ô e4 (đối với Trắng) hoặc e5 (đối với Đen) bằng cách chiếm giữ bằng Mã kiên cố.",
            "Tìm cách đổi quân Tượng xấu của Stonewall (Bc1 của Trắng hoặc Bc8 của Đen) và mở mặt trận cánh c5/c4."
        ]
    }
}


def detect_all_pawn_structures(board: chess.Board, ply: int = 20) -> List[Dict[str, Any]]:
    """
    Phân tích toàn diện và trả về TẤT CẢ các cấu trúc Tốt thỏa mãn điều kiện tại thế cờ.
    Bao gồm Nhóm A (Trạng thái trung tâm / nền tảng) và Nhóm B (Cấu trúc chiến lược kinh điển).
    """
    pawn_map = {
        "white": [sq for sq in chess.SQUARES if board.piece_at(sq) == chess.Piece(chess.PAWN, chess.WHITE)],
        "black": [sq for sq in chess.SQUARES if board.piece_at(sq) == chess.Piece(chess.PAWN, chess.BLACK)]
    }

    white_files = {chess.square_file(sq) for sq in pawn_map["white"]}
    black_files = {chess.square_file(sq) for sq in pawn_map["black"]}

    w_central = [sq for sq in pawn_map["white"] if chess.square_file(sq) in [3, 4]]  # d, e
    b_central = [sq for sq in pawn_map["black"] if chess.square_file(sq) in [3, 4]]

    detected: List[Dict[str, Any]] = []

    # =========================================================================
    # NHÓM A: CẤU TRÚC NỀN TẢNG VÀ TRẠNG THÁI TRUNG TÂM
    # =========================================================================

    # 1. IQP (Isolated Queen's Pawn)
    w_d_pawns = [sq for sq in pawn_map["white"] if chess.square_file(sq) == 3]
    if w_d_pawns and (2 not in white_files) and (4 not in white_files):
        sq_name = chess.square_name(w_d_pawns[0])
        detected.append({
            "structure": "IQP",
            "name": "Isolated Queen's Pawn (IQP)",
            "group": "A",
            "group_title": "Cấu trúc nền tảng & Trung tâm",
            "side": "white",
            "square": sq_name,
            "evidence": f"Trắng có tốt d ({sq_name}) cô lập, không có tốt bảo vệ trên cột c và e.",
            "strategic_plan": STRATEGIC_PLANS["IQP"]
        })

    b_d_pawns = [sq for sq in pawn_map["black"] if chess.square_file(sq) == 3]
    if b_d_pawns and (2 not in black_files) and (4 not in black_files):
        sq_name = chess.square_name(b_d_pawns[0])
        detected.append({
            "structure": "IQP",
            "name": "Isolated Queen's Pawn (IQP)",
            "group": "A",
            "group_title": "Cấu trúc nền tảng & Trung tâm",
            "side": "black",
            "square": sq_name,
            "evidence": f"Đen có tốt d ({sq_name}) cô lập, không có tốt bảo vệ trên cột c và e.",
            "strategic_plan": STRATEGIC_PLANS["IQP"]
        })

    # 2. Hanging Pawns (Cặp tốt treo)
    w_c4 = chess.C4 in pawn_map["white"]
    w_d4 = chess.D4 in pawn_map["white"]
    if w_c4 and w_d4 and (1 not in white_files) and (4 not in white_files):
        detected.append({
            "structure": "Hanging_Pawns",
            "name": "Hanging Pawns",
            "group": "A",
            "group_title": "Cấu trúc nền tảng & Trung tâm",
            "side": "white",
            "square": "c4/d4",
            "evidence": "Trắng sở hữu cặp tốt treo c4+d4 trên các cột mở b và e.",
            "strategic_plan": STRATEGIC_PLANS["Hanging_Pawns"]
        })

    b_c5 = chess.C5 in pawn_map["black"]
    b_d5 = chess.D5 in pawn_map["black"]
    if b_c5 and b_d5 and (1 not in black_files) and (4 not in black_files):
        detected.append({
            "structure": "Hanging_Pawns",
            "name": "Hanging Pawns",
            "group": "A",
            "group_title": "Cấu trúc nền tảng & Trung tâm",
            "side": "black",
            "square": "c5/d5",
            "evidence": "Đen sở hữu cặp tốt treo c5+d5 trên các cột mở b và e.",
            "strategic_plan": STRATEGIC_PLANS["Hanging_Pawns"]
        })

    # 3. Open Center (Trung tâm mở)
    d_all = [sq for sq in pawn_map["white"] + pawn_map["black"] if chess.square_file(sq) == 3]
    e_all = [sq for sq in pawn_map["white"] + pawn_map["black"] if chess.square_file(sq) == 4]
    is_open = (not d_all) and (not e_all)
    if is_open:
        detected.append({
            "structure": "Open",
            "name": "Open Center",
            "group": "A",
            "group_title": "Cấu trúc nền tảng & Trung tâm",
            "side": "both",
            "square": "d/e files",
            "evidence": "Hai cột trung tâm d và e hoàn toàn không còn quân Tốt nào.",
            "strategic_plan": STRATEGIC_PLANS["Open"]
        })

    # 4. Closed Center (Trung tâm đóng)
    is_closed = False
    evidence_closed = ""
    w_e4 = chess.E4 in pawn_map["white"]
    b_e5 = chess.E5 in pawn_map["black"]
    w_d5 = chess.D5 in pawn_map["white"]
    b_d6 = chess.D6 in pawn_map["black"]
    w_e5 = chess.E5 in pawn_map["white"]
    b_e6 = chess.E6 in pawn_map["black"]

    if w_d4 and b_d5 and w_e4 and b_e5:
        is_closed = True
        evidence_closed = "Tốt trung tâm d4/d5 và e4/e5 bị khóa đối đầu trực diện."
    elif w_d4 and b_d5 and w_e5 and b_e6:
        is_closed = True
        evidence_closed = "Tốt trung tâm d4/d5 và e5/e6 bị khóa đối đầu (Kiểu Pháp/Caro Advance)."
    elif w_d5 and b_d6 and w_e4 and b_e5:
        is_closed = True
        evidence_closed = "Tốt trung tâm d5/d6 và e4/e5 bị khóa đối đầu (Kiểu King's Indian)."
    elif w_e5 and b_e6 and w_d5 and b_d6:
        is_closed = True
        evidence_closed = "Tốt trung tâm bị khóa đối đầu liên hoàn."

    if is_closed:
        detected.append({
            "structure": "Closed",
            "name": "Closed Center",
            "group": "A",
            "group_title": "Cấu trúc nền tảng & Trung tâm",
            "side": "both",
            "square": "d/e locked",
            "evidence": evidence_closed,
            "strategic_plan": STRATEGIC_PLANS["Closed"]
        })

    # 5. Semi-Open Center (Trung tâm nửa mở)
    if not is_open and not is_closed:
        d_white_has = 3 in white_files
        d_black_has = 3 in black_files
        e_white_has = 4 in white_files
        e_black_has = 4 in black_files

        d_empty = not d_all
        e_empty = not e_all
        d_half_open = (d_white_has != d_black_has)
        e_half_open = (e_white_has != e_black_has)

        if d_empty or e_empty or (d_half_open and e_half_open) or (d_half_open and not e_white_has and not e_black_has) or (e_half_open and not d_white_has and not d_black_has):
            detected.append({
                "structure": "Semi-Open",
                "name": "Semi-Open Center",
                "group": "A",
                "group_title": "Cấu trúc nền tảng & Trung tâm",
                "side": "both",
                "square": "d/e semi-open",
                "evidence": "Có ít nhất 1 cột mở hoặc nửa mở ở trung tâm d/e.",
                "strategic_plan": STRATEGIC_PLANS["Semi-Open"]
            })

    # 6. Symmetrical Center (Trung tâm đối xứng)
    # Điều kiện đối xứng: chỉ xét từ nước 8 trở đi (ply >= 14), trung tâm không rỗng và các hàng tốt phản chiếu chính xác
    if ply >= 14 and not is_open and not is_closed:
        w_d = [sq for sq in pawn_map["white"] if chess.square_file(sq) == 3]
        b_d = [sq for sq in pawn_map["black"] if chess.square_file(sq) == 3]
        w_e = [sq for sq in pawn_map["white"] if chess.square_file(sq) == 4]
        b_e = [sq for sq in pawn_map["black"] if chess.square_file(sq) == 4]

        if len(w_d) == len(b_d) and len(w_e) == len(b_e) and (len(w_d) + len(w_e) > 0):
            w_ranks = sorted([chess.square_rank(sq) for sq in w_central])
            b_ranks = sorted([7 - chess.square_rank(sq) for sq in b_central])
            if w_ranks == b_ranks:
                detected.append({
                    "structure": "Symmetrical",
                    "name": "Symmetrical Center",
                    "group": "A",
                    "group_title": "Cấu trúc nền tảng & Trung tâm",
                    "side": "both",
                    "square": "d/e symmetric",
                    "evidence": "Cấu trúc tốt các cột trung tâm d và e đối xứng hoàn toàn giữa hai bên.",
                    "strategic_plan": STRATEGIC_PLANS["Symmetrical"]
                })

    # =========================================================================
    # NHÓM B: CẤU TRÚC CHIẾN LƯỢC KINH ĐIỂN
    # =========================================================================

    # 1. Carlsbad Structure
    w_has_c3_or_c2 = chess.C3 in pawn_map["white"] or chess.C2 in pawn_map["white"]
    w_has_e3_or_e2 = chess.E3 in pawn_map["white"] or chess.E2 in pawn_map["white"]
    w_no_c4_c5 = (chess.C4 not in pawn_map["white"]) and (chess.C5 not in pawn_map["white"])
    b_c6 = chess.C6 in pawn_map["black"]
    b_no_e_pawns = not any(chess.square_file(sq) == 4 for sq in pawn_map["black"])

    if w_has_c3_or_c2 and w_d4 and w_has_e3_or_e2 and w_no_c4_c5 and b_c6 and b_d5 and b_no_e_pawns:
        detected.append({
            "structure": "Carlsbad",
            "name": "Carlsbad Structure",
            "group": "B",
            "group_title": "Cấu trúc chiến lược kinh điển",
            "side": "white",
            "square": "c3/d4 vs c6/d5",
            "evidence": "Trắng có tốt c3/d4/e3 (cột c nửa mở), Đen có c6/d5 (cột e nửa mở).",
            "strategic_plan": STRATEGIC_PLANS["Carlsbad"]
        })

    # 2. Maroczy Bind
    w_no_d = not any(chess.square_file(sq) == 3 for sq in pawn_map["white"])
    b_d6_has = chess.D6 in pawn_map["black"]
    b_no_c5_e5 = (chess.C5 not in pawn_map["black"]) and (chess.E5 not in pawn_map["black"])
    if w_c4 and w_e4 and w_no_d and b_d6_has and b_no_c5_e5:
        detected.append({
            "structure": "Maroczy_Bind",
            "name": "Maroczy Bind",
            "group": "B",
            "group_title": "Cấu trúc chiến lược kinh điển",
            "side": "white",
            "square": "c4/e4 vs d6",
            "evidence": "Trắng thiết lập gọng kìm c4+e4 kiểm soát chặt ô d5, Đen có tốt d6.",
            "strategic_plan": STRATEGIC_PLANS["Maroczy_Bind"]
        })

    # 3. Hedgehog Structure
    b_a6 = chess.A6 in pawn_map["black"]
    b_b6 = chess.B6 in pawn_map["black"]
    b_e6_has = chess.E6 in pawn_map["black"]
    b_no_c_pawns = not any(chess.square_file(sq) == 2 for sq in pawn_map["black"])
    if b_a6 and b_b6 and b_d6_has and b_e6_has and b_no_c_pawns and w_c4:
        detected.append({
            "structure": "Hedgehog",
            "name": "Hedgehog Structure",
            "group": "B",
            "group_title": "Cấu trúc chiến lược kinh điển",
            "side": "black",
            "square": "a6/b6/d6/e6",
            "evidence": "Đen dàn hàng tốt gai nhím trên hàng 6 (a6/b6/d6/e6), cột c mở.",
            "strategic_plan": STRATEGIC_PLANS["Hedgehog"]
        })

    # 4. Stonewall Structure
    w_f4 = chess.F4 in pawn_map["white"]
    if w_has_c3_or_c2 and w_d4 and w_has_e3_or_e2 and w_f4:
        detected.append({
            "structure": "Stonewall",
            "name": "Stonewall Structure",
            "group": "B",
            "group_title": "Cấu trúc chiến lược kinh điển",
            "side": "white",
            "square": "c3/d4/e3/f4",
            "evidence": "Trắng dựng tường đá Stonewall với cấu trúc c3/d4/e3/f4 (lỗ hổng ô e4).",
            "strategic_plan": STRATEGIC_PLANS["Stonewall"]
        })
    else:
        b_has_c6_or_c7 = chess.C6 in pawn_map["black"] or chess.C7 in pawn_map["black"]
        b_f5 = chess.F5 in pawn_map["black"]
        if b_has_c6_or_c7 and b_d5 and b_e6_has and b_f5:
            detected.append({
                "structure": "Stonewall",
                "name": "Stonewall Structure",
                "group": "B",
                "group_title": "Cấu trúc chiến lược kinh điển",
                "side": "black",
                "square": "c6/d5/e6/f5",
                "evidence": "Đen dựng tường đá Stonewall Dutch với cấu trúc c6/d5/e6/f5 (lỗ hổng ô e5).",
                "strategic_plan": STRATEGIC_PLANS["Stonewall"]
            })

    return detected


def detect_pawn_structure(board: chess.Board, ply: int = 20) -> Dict[str, Any]:
    """
    Hàm nhận diện cấu trúc Tốt đơn nhất (Tương thích ngược).
    Ưu tiên cấu trúc Chiến lược Nhóm B; nếu không có thì trả về Nhóm A; nếu không thì Standard.
    """
    all_structs = detect_all_pawn_structures(board, ply=ply)
    if not all_structs:
        return {
            "structure": "Standard",
            "name": "Standard Structure",
            "group": "A",
            "group_title": "Cấu trúc nền tảng & Trung tâm",
            "side": "both",
            "square": ""
        }

    # Ưu tiên cấu trúc chiến lược Nhóm B
    for s in all_structs:
        if s.get("group") == "B":
            return s
    return all_structs[0]


def analyze_structural_performance(
    filtered_games: List[Dict[str, Any]],
    move_evaluations: Optional[List[Dict[str, Any]]] = None,
    baseline_score: Optional[float] = None,
    prior_strength: float = DEFAULT_PRIOR_STRENGTH,
    lang: str = "vi",
    min_move_window: int = 8,
    max_move_window: int = 20
) -> Dict[str, Any]:
    """
    Phân tích hiệu suất thi đấu của đối thủ theo từng dạng Cấu trúc Tốt.
    Quét từ nước 8 đến hết nước 20 (ply 14 -> max_move_window * 2) để đảm bảo hình cờ đã ổn định
    vào giai đoạn trung cuộc, tránh bắt nhầm các nước đổi quân tạm thời trong khai cuộc.
    Mỗi ván đấu được đếm tối đa 1 LẦN cho mỗi cấu trúc mà ván đó đi qua.
    Hỗ trợ song song cả Nhóm A (Nền tảng & Trung tâm) và Nhóm B (Chiến lược kinh điển).
    Tích hợp Bayesian Shrinkage & Statistical Confidence Framework.
    """
    struct_stats: Dict[str, Dict[str, Any]] = {}
    total_games = len(filtered_games)
    total_wins = 0
    total_draws = 0

    min_ply_window = max(0, (min_move_window - 1) * 2)
    max_ply_window = max_move_window * 2

    for g_idx, game in enumerate(filtered_games):
        moves = game.get("moves", [])
        player_color = game.get("player_color", "white")
        result = game.get("result", "*")

        is_win = (player_color == "white" and result == "1-0") or (player_color == "black" and result == "0-1")
        is_draw = (result == "1/2-1/2")
        is_loss = (player_color == "white" and result == "0-1") or (player_color == "black" and result == "1-0")

        if is_win:
            total_wins += 1
        elif is_draw:
            total_draws += 1

        board = chess.Board()
        seen_in_game = set()

        for ply, san in enumerate(moves):
            if ply > max_ply_window:
                break

            try:
                move_obj = board.parse_san(san)
                board.push(move_obj)
            except Exception:
                break

            move_number = (ply // 2) + 1

            # Chỉ xét cấu trúc Tốt xuất hiện trong cửa sổ phân tích định hình trung cuộc
            if ply >= min_ply_window:
                all_detected = detect_all_pawn_structures(board, ply=ply)
                for st in all_detected:
                    st_name = st["name"]
                    if st_name != "Standard Structure" and st_name not in seen_in_game:
                        seen_in_game.add(st_name)

                        if st_name not in struct_stats:
                            struct_stats[st_name] = {
                                "name": st_name,
                                "structure_key": st["structure"],
                                "group": st.get("group", "A"),
                                "group_title": st.get("group_title", "Cấu trúc nền tảng & Trung tâm"),
                                "strategic_plan": st.get("strategic_plan"),
                                "games_count": 0,
                                "wins": 0,
                                "draws": 0,
                                "losses": 0,
                                "cpls": [],
                                "formation_moves": [],
                                "games": []
                            }

                        stat = struct_stats[st_name]
                        stat["games_count"] += 1
                        stat["formation_moves"].append(move_number)
                        if is_win:
                            stat["wins"] += 1
                        elif is_draw:
                            stat["draws"] += 1
                        elif is_loss:
                            stat["losses"] += 1

                        stat["games"].append({
                            "id": game.get("id"),
                            "game_index": g_idx,
                            "formation_move": move_number,
                            "formation_ply": ply,
                            "formation_fen": board.fen(),
                            "evidence": st.get("evidence", ""),
                            "white": game.get("white", "Unknown"),
                            "black": game.get("black", "Unknown"),
                            "result": result,
                            "opening": game.get("opening", "Unknown Opening"),
                            "date": game.get("date", ""),
                            "site": game.get("site", ""),
                            "player_color": player_color,
                            "is_win": is_win,
                            "is_draw": is_draw,
                            "is_loss": is_loss,
                            "game_accuracy": game.get("game_accuracy")
                        })

    # Tính Overall Player Baseline Score (mặc định 50% nếu chưa có dữ liệu)
    if baseline_score is None:
        effective_baseline = round(((total_wins + 0.5 * total_draws) / total_games) * 100, 1) if total_games > 0 else 50.0
    else:
        effective_baseline = round(float(baseline_score), 1)

    # Kết hợp CPL từ move_evaluations nếu có
    if move_evaluations:
        for ev in move_evaluations:
            fen = ev.get("fen_before", "")
            cpl = ev.get("cpl", 0.0)
            if fen:
                try:
                    b = chess.Board(fen)
                    all_res = detect_all_pawn_structures(b)
                    for st_res in all_res:
                        st_name = st_res["name"]
                        if st_name in struct_stats:
                            struct_stats[st_name]["cpls"].append(cpl)
                except Exception:
                    pass

    result_list = []
    for name, data in struct_stats.items():
        g_count = data["games_count"]
        w, d, l = data["wins"], data["draws"], data["losses"]
        score_pct = round(((w + 0.5 * d) / g_count) * 100, 1) if g_count > 0 else 0.0
        cpls = data["cpls"]
        avg_acpl = round(sum(cpls) / len(cpls), 1) if cpls else 0.0
        conf = format_confidence_label(g_count, lang=lang)

        formation_moves = data["formation_moves"]
        typical_move = round(sum(formation_moves) / len(formation_moves)) if formation_moves else 12

        struct_item = {
            "name": name,
            "structure_key": data["structure_key"],
            "group": data["group"],
            "group_title": data["group_title"],
            "strategic_plan": data["strategic_plan"],
            "games_count": g_count,
            "wins": w,
            "draws": d,
            "losses": l,
            "score_pct": score_pct,
            "avg_acpl": avg_acpl,
            "confidence": conf,
            "typical_formation_move": typical_move,
            "games": data["games"]
        }
        # Bổ sung Bayesian Shrinkage & Assessment
        enriched_struct = enrich_performance_item(struct_item, effective_baseline, prior_strength=prior_strength, lang=lang)
        result_list.append(enriched_struct)

    # Sắp xếp: ưu tiên số ván đấu giảm dần
    result_list.sort(key=lambda x: x["games_count"], reverse=True)

    # Xác định Cấu trúc điểm yếu nhất (Target Structure) bằng Bayesian Framework
    target_structure = None
    if result_list:
        ranked_weakest = rank_weakest_items(result_list)
        if ranked_weakest:
            candidate = ranked_weakest[0]
            if candidate.get("assessment") in [ASSESSMENT_CONFIRMED_WEAKNESS, ASSESSMENT_POTENTIAL_WEAKNESS] or candidate.get("delta_vs_baseline", 0.0) <= -5.0:
                target_structure = candidate
            elif candidate.get("games_count", 0) >= 1:
                target_structure = candidate

    return {
        "structures": result_list,
        "target_structure": target_structure,
        "overall_baseline": effective_baseline
    }
