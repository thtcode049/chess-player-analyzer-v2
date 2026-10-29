import pytest
from src.ai_assistant.context_builder import build_opponent_ai_context, summarize_opening_tree
from src.ai_assistant.gemini_client import call_gemini_api, stream_gemini_response, GEMINI_MODELS
from src.ai_assistant.local_expert import generate_local_expert_response
from src.opening_tree import build_opening_tree


def test_build_opponent_ai_context_empty():
    res = build_opponent_ai_context(None, None)
    assert "chưa có dữ liệu" in res.lower()


def test_build_opponent_ai_context_valid():
    stats = {
        "total_games": 20,
        "wins": 10,
        "draws": 4,
        "losses": 6,
        "win_rate": 50.0,
        "draw_rate": 20.0,
        "loss_rate": 30.0,
        "score_percentage": 60.0,
        "white_games": 10,
        "white_score_percentage": 70.0,
        "white_wins": 7,
        "white_draws": 0,
        "white_losses": 3,
        "black_games": 10,
        "black_score_percentage": 50.0,
        "black_wins": 3,
        "black_draws": 4,
        "black_losses": 3,
    }
    deep_profile = {
        "repertoire": {
            "white_repertoire": [
                {
                    "name": "Sicilian Defense",
                    "games_count": 8,
                    "wins": 5,
                    "draws": 2,
                    "losses": 1,
                    "score_pct": 75.0,
                    "adjusted_score_pct": 71.0,
                    "delta_vs_baseline": 11.0,
                    "assessment_badge": "Thế mạnh đã xác nhận",
                }
            ],
            "black_repertoire": []
        },
        "structures": {
            "structures": [
                {
                    "name": "Carlsbad",
                    "games_count": 5,
                    "wins": 1,
                    "draws": 1,
                    "losses": 3,
                    "score_pct": 30.0,
                    "adjusted_score_pct": 36.0,
                    "delta_vs_baseline": -24.0,
                    "assessment_badge": "Điểm yếu đã xác nhận",
                    "typical_move": "12"
                }
            ]
        }
    }

    ctx = build_opponent_ai_context(deep_profile, stats, selected_player="Magnus")
    assert "BÁO CÁO DỮ LIỆU THỰC NGHIỆM KỲ THỦ: MAGNUS" in ctx
    assert "Carlsbad" in ctx
    assert "Sicilian Defense" in ctx

    # Test selected_game support in context
    selected_game = {
        "white": "Magnus",
        "black": "Hikaru",
        "result": "1-0",
        "eco": "B90",
        "opening": "Sicilian Defense, Najdorf",
        "moves_san": "1.e4 c5 2.Nf3 d6 3.d4 cxd4",
        "current_ply": 4,
        "total_ply": 6,
    }
    ctx_game = build_opponent_ai_context(
        deep_profile, stats, selected_player="Magnus", selected_game=selected_game
    )
    assert "VÁN ĐẤU ĐANG ĐƯỢC CHỌN TRÊN BÀN CỜ ĐỂ PHÂN TÍCH" in ctx_game
    assert "Magnus vs ⚫ Hikaru" in ctx_game
    assert "1.e4 c5 2.Nf3 d6" in ctx_game
    assert "Nước 4/6" in ctx_game


def test_initial_strategic_briefing():
    from src.ai_assistant.briefing import generate_initial_strategic_briefing, get_followup_prompts

    stats = {
        "total_games": 20,
        "score_percentage": 60.0,
        "white_score_percentage": 70.0,
        "black_score_percentage": 50.0,
    }
    deep_profile = {
        "repertoire": {
            "all_openings": [
                {
                    "name": "Sicilian Defense",
                    "games_count": 8,
                    "score_pct": 75.0,
                    "adjusted_score_pct": 71.0,
                    "delta_vs_baseline": 11.0,
                },
                {
                    "name": "French Defense",
                    "games_count": 5,
                    "score_pct": 30.0,
                    "adjusted_score_pct": 35.0,
                    "delta_vs_baseline": -25.0,
                }
            ]
        },
        "structures": {
            "structures": [
                {"name": "Carlsbad", "games_count": 5, "score_pct": 20.0, "delta_vs_baseline": -30.0}
            ]
        }
    }

    # Test mode 'self'
    briefing_self = generate_initial_strategic_briefing(deep_profile, stats, selected_player="Magnus", mode="self")
    assert "HỒ SƠ ĐÁNH GIÁ & LỘ TRÌNH RÈN LUYỆN" in briefing_self
    assert "Vũ khí sở trường" in briefing_self
    assert "Sicilian Defense" in briefing_self
    assert "Lỗ hổng Repertoire" in briefing_self
    assert "French Defense" in briefing_self
    assert "Carlsbad" in briefing_self

    # Test mode 'opponent'
    briefing_opp = generate_initial_strategic_briefing(deep_profile, stats, selected_player="Magnus", mode="opponent")
    assert "KẾ HOẠCH TÁC CHIẾN & DO THÁM ĐỐI THỦ" in briefing_opp
    assert "Đòn mạnh nhất của đối thủ" in briefing_opp
    assert "Tử huyệt khai cuộc" in briefing_opp

    # Test prompt chips
    chips_self = get_followup_prompts(mode="self")
    assert len(chips_self) >= 3
    chips_opp = get_followup_prompts(mode="opponent")
    assert len(chips_opp) >= 3


def test_local_expert_response():
    stats = {"total_games": 20, "score_percentage": 60.0}
    deep_profile = {
        "repertoire": {"white_repertoire": [{"name": "Sicilian Defense", "games_count": 8, "score_pct": 75.0, "wins": 5, "draws": 2, "losses": 1}]},
        "structures": {"structures": [{"name": "Carlsbad", "games_count": 5, "score_pct": 30.0, "adjusted_score_pct": 36.0, "delta_vs_baseline": -24.0, "wins": 1, "draws": 1, "losses": 3, "assessment_badge": "Điểm yếu", "typical_move": "12"}]}
    }
    resp = generate_local_expert_response("Khai cuộc của đối thủ thế nào?", deep_profile, stats, selected_player="Magnus")
    assert "Khai cuộc" in resp or "Repertoire" in resp

    resp_struct = generate_local_expert_response("Cấu trúc Tốt đối thủ chơi ra sao?", deep_profile, stats, selected_player="Magnus")
    assert "Cấu trúc" in resp_struct or "Carlsbad" in resp_struct


def test_call_gemini_api_fallback_when_no_key():
    stats = {
        "total_games": 20, "wins": 10, "draws": 4, "losses": 6,
        "win_rate": 50.0, "draw_rate": 20.0, "loss_rate": 30.0,
        "score_percentage": 60.0, "white_games": 10, "white_score_percentage": 70.0,
        "black_games": 10, "black_score_percentage": 50.0,
    }
    deep_profile = {
        "repertoire": {"white_repertoire": [], "black_repertoire": []},
        "structures": {"structures": []}
    }
    resp = call_gemini_api(
        prompt="Khai cuộc của đối thủ thế nào?",
        context="Kỳ thủ Magnus Carlsen.",
        chat_history=[],
        api_key="",
        deep_profile=deep_profile,
        stats=stats,
        selected_player="Magnus"
    )
    assert "Khai cuộc" in resp or "Repertoire" in resp or "Magnus" in resp


def test_stream_gemini_response_fallback():
    stats = {"total_games": 20, "score_percentage": 60.0}
    deep_profile = {
        "repertoire": {"white_repertoire": []},
        "structures": {"structures": []}
    }
    chunks = list(stream_gemini_response(
        prompt="Tóm tắt đối thủ",
        context="Data",
        chat_history=[],
        api_key="",
        deep_profile=deep_profile,
        stats=stats,
        selected_player="Magnus"
    ))
    assert len(chunks) > 0
    full_text = "".join(chunks)
    assert "Báo cáo" in full_text or "Magnus" in full_text


def test_prepare_gemini_payload_config():
    from src.ai_assistant.gemini_client import _prepare_gemini_payload
    payload = _prepare_gemini_payload("Chào AI", "Ngữ cảnh", [{"role": "user", "content": "hello"}], include_thinking_config=True)
    assert payload["generationConfig"]["maxOutputTokens"] == 8192
    assert payload["generationConfig"]["thinkingConfig"]["thinkingBudget"] == 0

    payload_no_thinking = _prepare_gemini_payload("Chào AI", "Ngữ cảnh", [], include_thinking_config=False)
    assert payload_no_thinking["generationConfig"]["maxOutputTokens"] == 8192
    assert "thinkingConfig" not in payload_no_thinking["generationConfig"]


def test_available_models_config():
    from src.ai_assistant.gemini_client import AVAILABLE_MODELS, GEMINI_MODELS
    assert "gemini-3.8-flash" in AVAILABLE_MODELS
    assert "gemini-3.5-flash" in AVAILABLE_MODELS
    assert "gemini-3.1-flash-lite" in AVAILABLE_MODELS
    assert GEMINI_MODELS[0] == "gemini-3.8-flash"
    assert GEMINI_MODELS[1] == "gemini-3.5-flash"
    assert GEMINI_MODELS[2] == "gemini-3.1-flash-lite"

