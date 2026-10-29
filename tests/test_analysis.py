"""
Unit Tests for Deep Analytics Modules
-------------------------------------
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import chess

from src.analysis.pawn_structure import detect_pawn_structure, detect_all_pawn_structures, analyze_structural_performance
from src.analysis.confidence import get_confidence_level
from src.strategy import generate_actionable_match_preparation


def test_confidence_level():
    assert get_confidence_level(12) == "HIGH"
    assert get_confidence_level(7) == "MEDIUM"
    assert get_confidence_level(3) == "LOW"


def test_detect_pawn_structure():
    # Starting board structure is Standard / Symmetrical
    board = chess.Board()
    res = detect_pawn_structure(board)
    assert "structure" in res

    # 1. Nhóm A: IQP position (White pawn d4, no c/e pawns for White)
    iqp_board = chess.Board("r1bqk2r/pp3ppp/2n5/3p4/3P4/5N2/PP1Q1PPP/R3KB1R w KQkq - 0 10")
    res_iqp = detect_pawn_structure(iqp_board)
    assert res_iqp["structure"] == "IQP"
    assert res_iqp["group"] == "A"
    assert "strategic_plan" in res_iqp

    # 2. Nhóm A: Hanging Pawns (c4, d4 without b and e pawns)
    hanging_board = chess.Board("r1bq1rk1/pp3ppp/2n1pn2/8/2PP4/2N2N2/P4PPP/R1BQ1RK1 w - - 0 10")
    res_hanging = detect_all_pawn_structures(hanging_board)
    assert any(s["structure"] == "Hanging_Pawns" for s in res_hanging)

    # 3. Nhóm A: Open Center (no central pawns on d and e)
    open_board = chess.Board("r1bq1rk1/ppp2ppp/2n5/8/8/2N2N2/PPP2PPP/R1BQ1RK1 w - - 0 10")
    res_open = detect_all_pawn_structures(open_board)
    assert any(s["structure"] == "Open" for s in res_open)

    # 4. Nhóm A: Closed Center (d4/d5, e5/e6 locked)
    closed_board = chess.Board("r1bqk2r/pp3ppp/2n1p3/3pP3/3P4/5N2/PP1N1PPP/R2QKB1R w KQkq - 0 10")
    res_closed = detect_all_pawn_structures(closed_board)
    assert any(s["structure"] == "Closed" for s in res_closed)

    # 5. Nhóm A: Symmetrical Center (d4 vs d5 at ply >= 14)
    sym_board = chess.Board("r1bq1rk1/pp3ppp/2n1pn2/3p4/3P4/2N1PN2/PP3PPP/R1BQKB1R w KQ - 0 8")
    res_sym = detect_all_pawn_structures(sym_board, ply=16)
    assert any(s["structure"] == "Symmetrical" for s in res_sym)

    # 6. Nhóm B: Carlsbad - Standard (QGD Exchange: White d4/e3 no c-pawn, Black c6/d5 no e-pawn)
    std_carlsbad = chess.Board("r1bq1rk1/pp1nbppp/2p2n2/3p4/3P4/2N1PN2/PP1B1PPP/R2QKB1R w KQ - 4 9")
    res_std = detect_all_pawn_structures(std_carlsbad)
    assert any(s["structure"] == "Carlsbad" for s in res_std)

    # 7. Nhóm B: Carlsbad - Reversed (Caro-Kann Exchange: White c3/d4 no e-pawn, Black d5/e6 no c-pawn)
    rev_carlsbad = chess.Board("r1b1kb1r/ppq1pp1p/2n2np1/3p4/3P4/2PB1N1P/PP3PP1/RNBQ1RK1 b kq - 1 8")
    res_rev = detect_all_pawn_structures(rev_carlsbad)
    assert any(s["structure"] == "Carlsbad" for s in res_rev)

    # Carlsbad backward-compatible test board:
    carlsbad_board = chess.Board("r1bq1rk1/pp3ppp/2p2n2/3p4/3P4/2P1PN2/P4PPP/R1BQ1RK1 w - - 0 10")
    res_carlsbad = detect_all_pawn_structures(carlsbad_board)
    assert any(s["structure"] == "Carlsbad" for s in res_carlsbad)
    carlsbad_primary = detect_pawn_structure(carlsbad_board)
    assert carlsbad_primary["structure"] == "Carlsbad"
    assert carlsbad_primary["group"] == "B"

    # Dutch Defense must NOT be detected as Carlsbad
    dutch_board = chess.Board("rn1k1b1r/pp3q2/2p1b1pp/3p1p2/3P3N/4P3/PPPNBPPP/2RQK2R w K - 0 13")
    res_dutch = detect_all_pawn_structures(dutch_board)
    assert not any(s["structure"] == "Carlsbad" for s in res_dutch)

    # 8. Nhóm B: French Structure (White d4, e5 vs Black d5, e6)
    french_board = chess.Board("r1bqk2r/pp1n1ppp/2n1p3/2ppP3/3P4/2PB1N2/PP1N1PPP/R1BQK2R b KQkq - 0 8")
    res_french = detect_all_pawn_structures(french_board)
    assert any(s["structure"] == "French_Chain" for s in res_french)

    # 9. Nhóm B: King's Indian Complex (White d5, e4 vs Black d6, e5)
    kid_board = chess.Board("r1bq1rk1/ppp2pbp/2np1np1/3Pp3/4P3/2PB1N2/PP3PPP/R1BQRNK1 b - - 0 10")
    res_kid = detect_all_pawn_structures(kid_board)
    assert any(s["structure"] == "Kings_Indian" for s in res_kid)

    # 10. Nhóm B: Scheveningen Structure (White e4 no d-pawn, Black d6, e6 no c-pawn)
    schev_board = chess.Board("r1bq1rk1/pp2bppp/2nppn2/8/4P3/2N1BN2/PPP2PPP/R2QKB1R w KQ - 0 9")
    res_schev = detect_all_pawn_structures(schev_board)
    assert any(s["structure"] == "Scheveningen" for s in res_schev)

    # 11. Nhóm B: Boleslavsky Hole (White e4 no d-pawn, Black d6, e5 no c-pawn)
    boles_board = chess.Board("r1bqkb1r/1p3ppp/p1np1n2/4p3/4P3/1NN1B3/PPP2PPP/R2QKB1R w KQkq - 0 8")
    res_boles = detect_all_pawn_structures(boles_board)
    assert any(s["structure"] == "Boleslavsky_Hole" for s in res_boles)

    # 12. Nhóm B: Maroczy Bind (c4 + e4 vs d6)
    maroczy_board = chess.Board("r1bqk2r/pp2ppbp/2np1np1/8/2P1P3/2N2N2/PP2BPPP/R1BQK2R w KQkq - 0 8")
    res_maroczy = detect_all_pawn_structures(maroczy_board)
    assert any(s["structure"] == "Maroczy_Bind" for s in res_maroczy)

    # 13. Nhóm B: Hedgehog (Black a6, b6, d6, e6; White c4)
    hedgehog_board = chess.Board("r1bq1rk1/5ppp/pp1ppn2/8/2P1P3/2N5/PP2BPPP/R1BQK2R w KQ - 0 10")
    res_hedgehog = detect_all_pawn_structures(hedgehog_board)
    assert any(s["structure"] == "Hedgehog" for s in res_hedgehog)

    # 14. Nhóm B: Stonewall (White c3, d4, e3, f4)
    stonewall_board = chess.Board("r1bqk2r/ppp2ppp/2n1pn2/3p4/3P1P2/2P1P3/PP1N2PP/R1BQKBNR b KQkq - 0 6")
    res_stonewall = detect_all_pawn_structures(stonewall_board)
    assert any(s["structure"] == "Stonewall" for s in res_stonewall)


def test_negative_boundary_cases():
    """
    Kiểm thử âm tính (Negative Boundary Testing) cho toàn bộ các cấu trúc Tốt:
    Đảm bảo các thế trận sát biên hoặc có tọa độ tương đồng không bị nhận diện nhầm.
    """
    # 1. Negative Carlsbad: Dutch Defense (White c2, d4, e3 vs Black c6, d5, f5)
    dutch = chess.Board("rn1k1b1r/pp3q2/2p1b1pp/3p1p2/3P3N/4P3/PPPNBPPP/2RQK2R w K - 0 13")
    res_dutch = detect_all_pawn_structures(dutch)
    assert not any(s["structure"] == "Carlsbad" for s in res_dutch), "Dutch Defense không được gán nhãn Carlsbad"

    # 2. Negative Carlsbad: London System nguyên vẹn tốt (White c3, d4, e3 vs Black c6, d5, e6)
    london_unexchanged = chess.Board("r2qkb1r/pp1n1ppp/2p1pn2/3p1b2/3P4/2P1PN2/PP1NBPPP/R1BQK2R w KQkq - 2 7")
    res_london = detect_all_pawn_structures(london_unexchanged)
    assert not any(s["structure"] == "Carlsbad" for s in res_london), "London nguyên vẹn tốt e/c không được gán nhãn Carlsbad"

    # 3. Negative French: Caro-Kann Advance với tốt c6 (White d4, e5; Black c6, d5)
    caro_adv = chess.Board("r1b1kb1r/pp2pppp/2n2n2/2ppP3/3P4/2P2N2/PP3PPP/RNBQKB1R b KQkq - 0 5")
    res_caro = detect_all_pawn_structures(caro_adv)
    assert not any(s["structure"] == "French_Chain" for s in res_caro), "Caro-Kann Advance (c6/d5) không được gán nhãn French_Chain"

    # 4. Negative French: French Exchange (cột e mở, không có e5)
    french_ex = chess.Board("r1bqk2r/ppp2ppp/2n5/3p4/3P4/5N2/PP1Q1PPP/R3KB1R w KQkq - 0 10")
    res_french_ex = detect_all_pawn_structures(french_ex)
    assert not any(s["structure"] == "French_Chain" for s in res_french_ex), "French Exchange không được gán nhãn French_Chain"

    # 5. Negative King's Indian: Modern Benoni (White d5, c4; Black c5, d6 - không có e5)
    benoni = chess.Board("rnbqkb1r/pp1p1ppp/4pn2/2pP4/2P5/8/PP2PPPP/RNBQKBNR w KQkq - 0 4")
    res_benoni = detect_all_pawn_structures(benoni)
    assert not any(s["structure"] == "Kings_Indian" for s in res_benoni), "Benoni (c5/d6) không được gán nhãn Kings_Indian"

    # 6. Negative Scheveningen: Sicilian với ...e5 (Đã chuyển thành Boleslavsky Hole)
    najdorf_e5 = chess.Board("r1bqkb1r/1p3ppp/p1np1n2/4p3/4P3/1NN1B3/PPP2PPP/R2QKB1R w KQkq - 0 8")
    res_najdorf = detect_all_pawn_structures(najdorf_e5)
    assert not any(s["structure"] == "Scheveningen" for s in res_najdorf), "Sicilian Najdorf ...e5 không được gán nhãn Scheveningen"
    assert any(s["structure"] == "Boleslavsky_Hole" for s in res_najdorf), "Sicilian Najdorf ...e5 phải gán nhãn Boleslavsky_Hole"

    # 7. Negative Scheveningen: Sicilian Dragon (tốt e còn ở e7, g6)
    dragon = chess.Board("r1bqk2r/pp2ppbp/2np1np1/8/3NP3/2N1B3/PPP2PPP/R2QKB1R w KQkq - 2 7")
    res_dragon = detect_all_pawn_structures(dragon)
    assert not any(s["structure"] == "Scheveningen" for s in res_dragon), "Sicilian Dragon không được gán nhãn Scheveningen"

    # 8. Negative Boleslavsky: King's Indian (Trắng đã có tốt ở d5, ô d5 không phải lỗ hổng)
    kid_board = chess.Board("r1bq1rk1/ppp2pbp/2np1np1/3Pp3/4P3/2PB1N2/PP3PPP/R1BQRNK1 b - - 0 10")
    res_kid = detect_all_pawn_structures(kid_board)
    assert not any(s["structure"] == "Boleslavsky_Hole" for s in res_kid), "King's Indian không được gán nhãn Boleslavsky_Hole"


def test_actionable_match_preparation():
    deep_profile = {
        "repertoire": {
            "all_openings": [{"name": "Sicilian Defense", "games_count": 10, "score_pct": 70.0}],
            "black_repertoire": [{"name": "Sicilian Defense", "games_count": 10, "score_pct": 70.0}]
        },
        "structures": {
            "target_structure": {"name": "IQP", "score_pct": 30.0, "games_count": 8, "confidence": {"label": "Medium"}}
        }
    }

    action_prep = generate_actionable_match_preparation(deep_profile, user_color="white")
    assert "play_plan" in action_prep
    assert "target_plan" in action_prep
    assert "avoid_plan" in action_prep
    assert len(action_prep["play_plan"]) > 0
    assert len(action_prep["target_plan"]) > 0


def test_analyze_structural_performance():
    # Game reaching IQP around move 10 (ply 18)
    game_iqp_moves = [
        "e4", "c5", "Nf3", "e6", "d4", "cxd4", "Nxd4", "a6",
        "c4", "Nf6", "Nc3", "d5", "exd5", "exd5", "cxd5", "Nxd5",
        "Nxd5", "Qxd5"  # IQP formed around ply 17
    ]
    games = [{
        "moves": game_iqp_moves,
        "player_color": "white",
        "result": "1-0",
        "white": "Player A",
        "black": "Player B",
        "opening": "Sicilian Defense",
        "date": "2026.01.01"
    }]
    res = analyze_structural_performance(games)
    structs = res.get("structures", [])
    assert len(structs) >= 1
    iqp_struct = next((s for s in structs if s["structure_key"] == "IQP"), None)
    assert iqp_struct is not None
    assert iqp_struct["games_count"] == 1
    assert "typical_formation_move" in iqp_struct
    assert len(iqp_struct["games"]) == 1
    g_info = iqp_struct["games"][0]
    assert g_info["game_index"] == 0
    assert g_info["formation_move"] >= 8
    assert g_info["white"] == "Player A"

