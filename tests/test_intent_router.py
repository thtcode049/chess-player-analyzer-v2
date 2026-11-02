import pytest
import chess
from src.ai_assistant.position_facts import PositionFacts
from src.ai_assistant.intent_router import IntentRouter


def test_intent_router_screenshot_case():
    # Thế cờ: Vua Trắng ở c1, Tượng Đen ở b7
    fen = "r2q1rk1/1b2bppp/p1n1pn2/1p1p4/3PP3/2N2N2/PPB2PPP/2KR3R b - - 1 12"
    facts = PositionFacts(fen)

    # 1. Câu hỏi đúng trong ảnh
    prompt = "a8 h1 liên quan gì đến vua c1"
    res = IntentRouter.try_answer_deterministic(prompt, facts)
    assert res is not None
    assert "KHÔNG nằm trên đường chéo lớn a8–h1" in res or "KHÔNG nằm trên" in res
    assert "c1" in res

    # 2. Câu hỏi ô e4 có quân gì
    prompt_sq = "ô e4 có quân gì"
    res_sq = IntentRouter.try_answer_deterministic(prompt_sq, facts)
    assert res_sq is not None
    assert "e4" in res_sq
    assert "Tốt Trắng" in res_sq

    # 3. Câu hỏi chiến lược chung -> phải trả về None để chuyển tiếp cho LLM
    prompt_strat = "Kế hoạch trung cuộc cho Đen là gì?"
    res_strat = IntentRouter.try_answer_deterministic(prompt_strat, facts)
    assert res_strat is None
