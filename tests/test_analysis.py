"""
Unit Tests for Pawn Structure Analysis Module
---------------------------------------------
Tuân thủ 100% chuẩn học thuật Mauricio Flores Rios - "Chess Structures: A Grandmaster Guide":
- 28 cấu trúc chuẩn (5 Families + 1 Miscellaneous).
- Kiểm tra toàn bộ điều kiện âm tính (Negative Boundary Cases) & triệt tiêu lỗi logic cũ.
- Kiểm tra Bộ lọc Độ bền Cấu trúc (Persistence Filter >= 3 plies).
- Kiểm tra toàn bộ ván mẫu thực chiến trích xuất trực tiếp từ sách Flores Rios.
"""

import sys
import os
import pytest
import chess

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.analysis.pawn_structure import (
    STRATEGIC_PLANS,
    FLORES_RIOS_GROUPS,
    CANONICAL_PAWN_SKELETONS,
    get_canonical_pawn_skeleton,
    find_canonical_pawn_skeleton,
    detect_pawn_structure,
    detect_all_pawn_structures,
    analyze_structural_performance,
)
from src.ai_assistant.intent_router import IntentRouter
from src.analysis.confidence import get_confidence_level
from src.strategy import generate_actionable_match_preparation


def test_confidence_level():
    assert get_confidence_level(12) == "HIGH"
    assert get_confidence_level(7) == "MEDIUM"
    assert get_confidence_level(3) == "LOW"


def test_catalog_completeness():
    """Đảm bảo đầy đủ 28 cấu trúc trong 6 nhóm chuẩn của Flores Rios."""
    assert len(STRATEGIC_PLANS) == 28
    assert len(FLORES_RIOS_GROUPS) == 6
    assert FLORES_RIOS_GROUPS["family_1"]["order"] == 1
    assert FLORES_RIOS_GROUPS["miscellaneous"]["order"] == 6


def test_family_1_d4_and_d5_detections():
    """Family 1: Chapters 1 - 7."""
    # 1. The Isolani (d4 no c/e vs e6/e7 no c/d)
    w_iqp = chess.Board("2rq1rk1/1p1bbppp/p1n1pn2/6B1/3P4/1BN2N2/PP1Q1PPP/3R1RK1 w - - 7 13")
    det_iqp = detect_all_pawn_structures(w_iqp)
    assert any(s["structure"] == "Isolani" and s["group"] == "family_1" for s in det_iqp)

    # 2. Hanging Pawns (c4 + d4, no b/e for White, no c/d for Black)
    hanging_b = chess.Board("r1bq1rk1/pp3ppp/2n1pn2/8/2PP4/2N2N2/P4PPP/R1BQ1RK1 w - - 0 10")
    det_hanging = detect_all_pawn_structures(hanging_b)
    assert any(s["structure"] == "Hanging_Pawns" and s["group"] == "family_1" for s in det_hanging)

    # 3. Caro-Kann Formation (d4 vs c6+e6/e7, no e for White, no d for Black)
    caro_b = chess.Board("r1bqk2r/pp1n1pp1/2p1pn1p/8/3P4/2PB1N2/PP3PPP/R1BQK2R w KQkq - 0 10")
    det_caro = detect_all_pawn_structures(caro_b)
    assert any(s["structure"] == "Caro_Kann_Formation" and s["group"] == "family_1" for s in det_caro)

    # 4. Slav Formation (d4 vs c6+e6/e7, no c for White, no d for Black)
    slav_b = chess.Board("r1bq1rk1/pp1nbppp/2p1pn2/8/2BP4/4PN2/PP1N1PPP/R1BQ1RK1 w - - 0 9")
    det_slav = detect_all_pawn_structures(slav_b)
    assert any(s["structure"] == "Slav_Formation" and s["group"] == "family_1" for s in det_slav)

    # 5. Carlsbad Formation (d4+e3 vs c6+d5, no c for White, no e for Black)
    carlsbad_b = chess.Board("r1bq1rk1/pp1nbppp/2p2n2/3p4/3P4/2N1PN2/PP1B1PPP/R2QKB1R w KQ - 4 9")
    det_carlsbad = detect_all_pawn_structures(carlsbad_b)
    assert any(s["structure"] == "Carlsbad_Formation" and s["group"] == "family_1" for s in det_carlsbad)

    # 6. Stonewall (Dutch: c6-d5-e6-f5 vs d4)
    stonewall_b = chess.Board("r1bq1rk1/pp1n2pp/2pbpn2/3p1p2/2PP4/1P1BPN2/PB1N1PPP/R2Q1RK1 w - - 0 10")
    det_stonewall = detect_all_pawn_structures(stonewall_b)
    assert any(s["structure"] == "Stonewall" and s["group"] == "family_1" for s in det_stonewall)

    # 7. Grünfeld Centre (d4+e4 vs a+b 2-on-1, no b/c for White, no c/d for Black)
    grunfeld_b = chess.Board("r1bq1rk1/pp2ppbp/2n3p1/8/3PP3/4B3/P2Q1PPP/1R2KBNR w K - 1 11")
    det_grunfeld = detect_all_pawn_structures(grunfeld_b)
    assert any(s["structure"] == "Grunfeld_Centre" and s["group"] == "family_1" for s in det_grunfeld)


def test_family_2_open_sicilian_detections():
    """Family 2: Chapters 8 - 11."""
    # 8. Najdorf Type I (d5 no e, c-pawns present vs d6+e5 no c)
    naj1_b = chess.Board("r2q1rk1/1p1n1pb1/p2p1np1/3Pp2p/8/1N2BP2/PPPQB1PP/R4RK1 w - - 0 14")
    det_naj1 = detect_all_pawn_structures(naj1_b)
    assert any(s["structure"] == "Najdorf_Type_I" and s["group"] == "family_2" for s in det_naj1)

    # 9. Najdorf Type II (e4 no d vs d6+e5 no c)
    naj2_b = chess.Board("r1bq1rk1/1p2bppp/p1np1n2/4p3/4P3/1NN1BP2/PPP1B1PP/R2Q1RK1 b - - 0 10")
    det_naj2 = detect_all_pawn_structures(naj2_b)
    assert any(s["structure"] == "Najdorf_Type_II" and s["group"] == "family_2" for s in det_naj2)

    # 10. The Hedgehog (c4+e4 vs a6+b6+d6+e6)
    hedge_b = chess.Board("r1bq1rk1/3nbppp/pp1ppn2/8/2P1P3/1PN1BN2/P3BPPP/R2Q1RK1 w - - 0 11")
    det_hedge = detect_all_pawn_structures(hedge_b)
    assert any(s["structure"] == "Hedgehog" and s["group"] == "family_2" for s in det_hedge)

    # 11. The Maroczy (c4+e4 vs d6+g6, e-pawn on e7)
    maroczy_b = chess.Board("r1bq1rk1/pp2ppbp/2np2p1/8/2P1P3/2N1BN2/PP2BPPP/R2Q1RK1 b - - 0 10")
    det_maroczy = detect_all_pawn_structures(maroczy_b)
    assert any(s["structure"] == "Maroczy" and s["group"] == "family_2" for s in det_maroczy)


def test_family_3_benoni_detections():
    """Family 3: Chapters 12 - 13."""
    # 12. Asymmetric Benoni (d5+e4 no c vs c5+d6 no e)
    asym_b = chess.Board("r1bq1rk1/1p1n1pbp/p2p1np1/2pP4/4P3/2N2N2/PP1BBPPP/R2Q1RK1 w - - 0 11")
    det_asym = detect_all_pawn_structures(asym_b)
    assert any(s["structure"] == "Asymmetric_Benoni" and s["group"] == "family_3" for s in det_asym)

    # 13. Symmetric Benoni (c4+d5 vs c5+d6 with e open)
    sym_b = chess.Board("r1bq1rk1/pp1n1pbp/3p1np1/2pP4/2P2P2/2N1B3/PP2B1PP/R2QK1NR b KQ - 0 10")
    det_sym = detect_all_pawn_structures(sym_b)
    assert any(s["structure"] == "Symmetric_Benoni" and s["group"] == "family_3" for s in det_sym)


def test_family_4_kings_indian_detections():
    """Family 4: Chapters 14 - 18."""
    # 14. KID Type I (d5+e4 vs d6+e5 with c open)
    kid1_b = chess.Board("r1r3k1/1p1bq1bp/1n1p1pp1/1P1Pp3/4P3/P2B1P2/3BN1PP/1R1Q1RK1 w - - 0 24")
    det_kid1 = detect_all_pawn_structures(kid1_b)
    assert any(s["structure"] == "KID_Type_I" and s["group"] == "family_4" for s in det_kid1)

    # 15. KID Type II (c4+d5+e4 vs c5+d6+e5)
    kid2_b = chess.Board("r2q1rk1/pp1b1pbp/3p1np1/n1pPp3/2P1P3/1PN3P1/P2N1PBP/R1BQ1RK1 w - - 0 12")
    det_kid2 = detect_all_pawn_structures(kid2_b)
    assert any(s["structure"] == "KID_Type_II" and s["group"] == "family_4" for s in det_kid2)

    # 16. KID Type III (c4+d5+e4 vs c7(c6)+d6+e5)
    kid3_b = chess.Board("r1bq1rk1/ppp1n1bp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 w - - 0 10")
    det_kid3 = detect_all_pawn_structures(kid3_b)
    assert any(s["structure"] == "KID_Type_III" and s["group"] == "family_4" for s in det_kid3)

    # 17. Open KID (c4+e4 vs c6/c7+d6, no d for White, no e for Black)
    open_kid_b = chess.Board("r2q1rk1/pp1n1pbp/2pp1np1/8/2P1PB2/2N4P/PP2BPP1/R2QR1K1 b - - 0 12")
    det_open_kid = detect_all_pawn_structures(open_kid_b)
    assert any(s["structure"] == "Open_KID" and s["group"] == "family_4" for s in det_open_kid)

    # 18. KID Complex (dxe5 dxe5 open d-file with c4/c5+e4 vs c6+e5)
    kid_cpx_b = chess.Board("r2q1rk1/pp2ppbp/2pp1np1/4P3/2P5/2N2NP1/PP2PPBP/R1BQ1RK1 b - - 0 9")
    det_kid_cpx = detect_all_pawn_structures(kid_cpx_b)
    # Also test tension:
    kid_cpx_tension = chess.Board("r1bq1rk1/pp1n1pbp/2pp1np1/4p3/2PPP3/2N1BNP1/PP3PBP/R2Q1RK1 b - - 0 9")
    det_tension = detect_all_pawn_structures(kid_cpx_tension)
    assert any(s["structure"] == "KID_Complex" and s["group"] == "family_4" for s in det_tension)


def test_family_5_french_detections():
    """Family 5: Chapters 19 - 21."""
    # 19. French Type I (d4 vs d5+e6 with f open)
    f1_b = chess.Board("r2q1rk1/pp1n2bp/1p2pn2/3p4/3P4/1PN3PP/P4PB1/R1BQR1K1 w - - 0 14")
    det_f1 = detect_all_pawn_structures(f1_b)
    assert any(s["structure"] == "French_Type_I" and s["group"] == "family_5" for s in det_f1)

    # 20. French Type II (e5 no d vs d5+e6 no c)
    f2_b = chess.Board("r1b2rk1/pp1nbppp/4p3/3pP3/3q1P2/3B4/PP4PP/RNBQ1R1K w - - 0 13")
    det_f2 = detect_all_pawn_structures(f2_b)
    assert any(s["structure"] == "French_Type_II" and s["group"] == "family_5" for s in det_f2)

    # 21. French Type III (d4+e5 vs d5+e6 intact chain)
    f3_b = chess.Board("r1bqk2r/pp1n1ppp/2n1p3/2ppP3/3P4/2PB1N2/PP1N1PPP/R1BQK2R b KQkq - 0 8")
    det_f3 = detect_all_pawn_structures(f3_b)
    assert any(s["structure"] == "French_Type_III" and s["group"] == "family_5" for s in det_f3)


def test_miscellaneous_detections():
    """Miscellaneous: Chapter 22.1 - 22.7."""
    # 22.1 The 3-3 vs. 4-2 Structure
    s33_b = chess.Board("1r3rk1/p1qb1pp1/5b1p/1pn5/4p3/1PP3P1/P2N1PBP/R2Q1RK1 w - - 0 17")
    det_33 = detect_all_pawn_structures(s33_b)
    assert any(s["structure"] == "Structure_33_vs_42" and s["group"] == "miscellaneous" for s in det_33)

    # 22.2 The Panov Structure (c5+d4 no e vs d5+e6 no c)
    panov_b = chess.Board("r4rk1/1pq1bppp/p3pn2/2Pp4/1P1P4/1N2PN2/PB3PPP/R4RK1 b - - 0 15")
    det_panov = detect_all_pawn_structures(panov_b)
    assert any(s["structure"] == "Panov_Structure" and s["group"] == "miscellaneous" for s in det_panov)

    # 22.3 The Dragon Formation (e4 no d, no c4 vs d6+e7+g6 no c)
    dragon_b = chess.Board("r1r3k1/pp1bppbp/3p1np1/q3n2P/3NP3/1BN1BP2/PPPQ2P1/2KR3R b - - 0 13")
    det_dragon = detect_all_pawn_structures(dragon_b)
    assert any(s["structure"] == "Dragon_Formation" and s["group"] == "miscellaneous" for s in det_dragon)

    # 22.4 The Scheveningen Structure (e4 no d, no c4 vs d6+e6 no c)
    schev_b = chess.Board("2rq1rk1/1b1nbpp1/p2ppn1p/1p4PP/3NPP2/2NBB3/PPPQ4/2KR3R b - - 0 14")
    det_schev = detect_all_pawn_structures(schev_b)
    assert any(s["structure"] == "Scheveningen_Structure" and s["group"] == "miscellaneous" for s in det_schev)

    # 22.5 The Benko Structure (d5 no c, a+b for White vs c5+d6 no a/b for Black)
    benko_b = chess.Board("r2q1rk1/3nppbp/b2p1np1/1NpP4/4P3/6P1/PP2NPBP/R1BQK2R w KQ - 0 11")
    det_benko = detect_all_pawn_structures(benko_b)
    assert any(s["structure"] == "Benko_Structure" and s["group"] == "miscellaneous" for s in det_benko)

    # 22.6 The Closed Ruy Lopez (c3+d5+e4 vs d6+e5)
    closed_ruy_b = chess.Board("r4rk1/1nqbbppp/p2p1n2/1p1Pp3/4P3/BPP2N1P/2B2PP1/RN1QR1K1 w - - 3 16")
    det_closed_ruy = detect_all_pawn_structures(closed_ruy_b)
    assert any(s["structure"] == "Closed_Ruy_Lopez" and s["group"] == "miscellaneous" for s in det_closed_ruy)

    # 22.7 The Lopez Formation (c3+d4+e4 vs c5(c6)+d6+e5)
    lopez_b = chess.Board("r2qr1k1/1b1n1pbp/p2p1np1/1pp1p3/3PPP1B/2PB1N1P/PP1N2P1/R2QR1K1 w - - 0 14")
    det_lopez = detect_all_pawn_structures(lopez_b)
    assert any(s["structure"] == "Lopez_Formation" and s["group"] == "miscellaneous" for s in det_lopez)


def test_negative_boundary_cases():
    """Kiểm thử chặt chẽ các trường hợp biên để loại trừ hoàn toàn sai sót logic."""
    # 1. Negative Hanging Pawns: Đen CÒN tốt trên cột c hoặc d -> KHÔNG PHẢI Hanging Pawns!
    not_hanging = chess.Board("r1bq1rk1/pp3ppp/2n1pn2/2pp4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQ - 0 6")
    det_nh = detect_all_pawn_structures(not_hanging)
    assert not any(s["structure"] == "Hanging_Pawns" for s in det_nh)

    # 2. Negative Hanging Pawns: Tốt chồng c3+c4 hoặc d3+d4 -> KHÔNG PHẢI Hanging Pawns!
    doubled_c = chess.Board("r1bq1rk1/pp3ppp/4pn2/8/2PP4/2P2N2/P4PPP/R1BQ1RK1 w - - 0 10")
    det_dc = detect_all_pawn_structures(doubled_c)
    assert not any(s["structure"] == "Hanging_Pawns" for s in det_dc)

    # 3. Negative Stonewall: Khai cuộc 1.d4 2.f4 khi tốt e2 chưa lên e3 -> Chưa tạo lỗ hổng e4!
    e2_f4 = chess.Board("rnbqkb1r/pppppppp/5n2/8/3P1P2/8/PPP1P1PP/RNBQKBNR b KQkq - 0 2")
    det_e2f4 = detect_all_pawn_structures(e2_f4)
    assert not any(s["structure"] == "Stonewall" for s in det_e2f4)

    # 4. Negative Carlsbad: London System nguyên vẹn tốt e (e3) và c (c6/c3) chưa đổi -> KHÔNG PHẢI Carlsbad!
    london_unexchanged = chess.Board("r2qkb1r/pp1n1ppp/2p1pn2/3p1b2/3P4/2P1PN2/PP1NBPPP/R1BQK2R w KQkq - 2 7")
    det_lon = detect_all_pawn_structures(london_unexchanged)
    assert not any(s["structure"] == "Carlsbad_Formation" for s in det_lon)

    # 5. Negative Benoni: Benko Gambit (Đen đã mất cả a và b -> phải là Benko_Structure, KHÔNG PHẢI Asymmetric_Benoni)
    benko_fen = chess.Board("r2q1rk1/3nppbp/b2p1np1/1NpP4/4P3/6P1/PP2NPBP/R1BQK2R w KQ - 0 11")
    det_benko = detect_all_pawn_structures(benko_fen)
    assert any(s["structure"] == "Benko_Structure" for s in det_benko)
    assert not any(s["structure"] == "Asymmetric_Benoni" for s in det_benko)

    # 6. Negative KID Type II vs III: KID với c5 (Type II) không được nhận diện là Type III
    kid_c5 = chess.Board("r2q1rk1/pp1b1pbp/3p1np1/n1pPp3/2P1P3/1PN3P1/P2N1PBP/R1BQ1RK1 w - - 0 12")
    det_k2 = detect_all_pawn_structures(kid_c5)
    assert any(s["structure"] == "KID_Type_II" for s in det_k2)
    assert not any(s["structure"] == "KID_Type_III" for s in det_k2)


def test_persistence_filter_rejects_1ply_transient():
    """
    Persistence Filter: Nhiễu 1-2 ply khi hai bên đang ăn đổi tốt dở dang
    (ví dụ cxd5 trước khi ...exd5 ở nước kế tiếp) sẽ KHÔNG bị ghi nhận.
    Chỉ cấu trúc tồn tại >= 3 plies liên tiếp mới được ghi nhận vào hiệu suất.
    """
    # Ván đấu có 1 ply tạm thời giống Isolani ở ply 15 sau 8.cxd5, nhưng ngay ply 16 Đen ăn lại ...exd5 chuyển sang Carlsbad
    moves_with_transient = [
        "d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7",
        "e3", "O-O", "Nf3", "Nbd7", "Rc1", "c6",
        "cxd5",  # ply 15: tạm thời cột c Trắng rỗng, Đen còn e6/c6
        "exd5",  # ply 16: Carlsbad hình thành và duy trì suốt nhiều nước sau đó
        "Bd3", "Re8", "O-O", "Nf8", "Ne5", "N6d7", "Bxe7", "Qxe7", "f4", "Nxe5", "fxe5"
    ]
    perf = analyze_structural_performance([{
        "id": "transient_test",
        "moves": moves_with_transient,
        "player_color": "white",
        "result": "1-0"
    }], min_move_window=8, min_persistence_plies=3)

    struct_keys = [s["structure_key"] for s in perf["structures"]]
    # Carlsbad hình thành từ ply 16 và kéo dài nhiều plies -> PHẢI CÓ
    assert "Carlsbad_Formation" in struct_keys
    # Isolani chỉ xuất hiện đúng 1 ply tại ply 15 -> BỊ BỘ LỌC ĐỘ BỀN LOẠI BỎ
    assert "Isolani" not in struct_keys


def test_actionable_match_preparation():
    deep_profile = {
        "repertoire": {
            "all_openings": [{"name": "Sicilian Defense", "games_count": 10, "score_pct": 70.0}],
            "black_repertoire": [{"name": "Sicilian Defense", "games_count": 10, "score_pct": 70.0}],
            "white_repertoire": [],
        },
        "structures": {
            "target_structure": {
                "name": "The Isolani",
                "structure_key": "Isolani",
                "score_pct": 30.0,
                "games_count": 8,
                "confidence": "medium",
            }
        },
    }

    action_prep = generate_actionable_match_preparation(deep_profile, user_color="white")
    assert "play_plan" in action_prep
    assert "target_plan" in action_prep
    assert "avoid_plan" in action_prep
    assert len(action_prep["play_plan"]) > 0
    assert len(action_prep["target_plan"]) > 0


def test_analyze_structural_performance_end_to_end():
    # Ván đấu hình thành Isolani từ nước 9 và duy trì ổn định
    moves = [
        "c4", "c6", "e4", "d5", "exd5", "Nf6", "Nc3", "cxd5",
        "cxd5", "Nxd5", "Nf3", "e6", "Bc4", "Nc6", "O-O", "Be7",
        "d4", "O-O", "Re1", "Nf6", "Bg5", "b6", "a3", "Bb7", "Qd3"
    ]
    games = [{
        "id": "real_game_1",
        "moves": moves,
        "player_color": "white",
        "result": "1-0",
        "white": "Zvjaginsev",
        "black": "Vasquez",
        "opening": "Reti Opening",
        "date": "2013.06.07"
    }]
    res = analyze_structural_performance(games, min_move_window=8, max_move_window=25, min_persistence_plies=3)
    structs = res.get("structures", [])
    assert len(structs) >= 1
    isolani = next((s for s in structs if s["structure_key"] == "Isolani"), None)
    assert isolani is not None
    assert isolani["group"] == "family_1"
    assert isolani["group_title"] == "Family One – d4 & ...d5"
    assert isolani["chapter"] == "Ch. 1"
    assert isolani["games_count"] == 1
    assert isolani["typical_formation_move"] >= 8
    assert len(isolani["games"]) == 1
    assert isolani["games"][0]["white"] == "Zvjaginsev"
    assert "strategic_plan" in isolani
    assert len(isolani["strategic_plan"]["ideas"]) >= 2


def test_all_28_canonical_pawn_skeletons_registry():
    """
    Kiểm tra toàn diện 100% 28 hình thái cấu trúc Tốt chuẩn (Canonical Pawn Skeletons)
    theo sách Mauricio Flores Rios 'Chess Structures: A Grandmaster Guide'.
    assert mọi FEN chuẩn đều được detect_all_pawn_structures nhận diện chính xác.
    """
    assert len(CANONICAL_PAWN_SKELETONS) == 28

    for key, data in CANONICAL_PAWN_SKELETONS.items():
        fen = data["fen"]
        board = chess.Board(fen)
        assert board is not None

        # Kiểm tra khớp vị trí Tốt với danh sách ô
        for sq_name in data["white_pawns"]:
            sq = chess.parse_square(sq_name)
            p = board.piece_at(sq)
            assert p is not None and p.piece_type == chess.PAWN and p.color == chess.WHITE, f"{key}: White pawn missing at {sq_name}"

        for sq_name in data["black_pawns"]:
            sq = chess.parse_square(sq_name)
            p = board.piece_at(sq)
            assert p is not None and p.piece_type == chess.PAWN and p.color == chess.BLACK, f"{key}: Black pawn missing at {sq_name}"

        # Nhận diện cấu trúc bằng code engine
        detected = detect_all_pawn_structures(board)
        matched = [s for s in detected if s["structure"] == key and s["group"] == data["group"]]
        assert len(matched) >= 1, f"Engine failed to detect canonical skeleton for {key} ({data['group']}) with FEN {fen}. Detected: {[s['structure'] for s in detected]}"


def test_find_canonical_pawn_skeleton_query_matching():
    """Kiểm tra tra cứu linh hoạt tên cấu trúc Tốt qua tiếng Việt, tiếng Anh và bí danh."""
    test_cases = [
        ("giới thiệu cấu trúc hanging pawns", "Hanging_Pawns"),
        ("cấu trúc tốt treo là gì", "Hanging_Pawns"),
        ("pawn skeleton của isolani", "Isolani"),
        ("cấu trúc carlsbad", "Carlsbad_Formation"),
        ("cấu trúc nhím", "Hedgehog"),
        ("gọng kìm maroczy", "Maroczy"),
        ("bức tường đá stonewall", "Stonewall"),
        ("pháp type 2", "French_Type_II"),
        ("cấu trúc 3-3 vs 4-2", "Structure_33_vs_42"),
        ("cấu trúc rồng dragon", "Dragon_Formation"),
        ("tây ban nha đóng", "Closed_Ruy_Lopez"),
        ("benko gambit", "Benko_Structure"),
    ]
    for query, exp_key in test_cases:
        res = find_canonical_pawn_skeleton(query)
        assert res is not None, f"Failed to match query: '{query}'"
        assert res[0] == exp_key, f"Expected {exp_key} for '{query}', got {res[0]}"


def test_intent_router_pawn_structure_answer():
    """Kiểm tra IntentRouter trả về câu trả lời tất định chuẩn xác cho cấu trúc Hanging Pawns."""
    answer = IntentRouter.try_answer_pawn_structure("giới thiệu cấu trúc hanging pawns")
    assert answer is not None
    # Bắt buộc chứa FEN chuẩn xác của Hanging Pawns (6 quân Trắng vs 6 quân Đen)
    assert "`8/pp3ppp/4p3/8/2PP4/8/P4PPP/8 w - - 0 1`" in answer
    # Bắt buộc chứa phân nhóm và chương sách của Flores Rios
    assert "Nhóm 1: Các cấu trúc d4 và ...d5 (Chương 1 - 7)" in answer
    assert "Chương 2 (Chapter 2)" in answer
    # Bắt buộc chứa kế hoạch GM của Trắng và Đen
    assert "Kế hoạch Chiến lược Chuẩn Đại Kiện tướng" in answer
    assert "Kế hoạch hành động tiêu biểu của bên Trắng" in answer
    assert "Kế hoạch tác chiến tiêu biểu của bên Đen" in answer
