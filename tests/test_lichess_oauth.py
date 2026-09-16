import pytest
from unittest.mock import MagicMock
import json
from src.lichess_oauth import (
    generate_pkce_pair,
    build_lichess_auth_url,
    exchange_code_for_token,
    fetch_current_user_profile,
    get_pkce_verifier_for_state,
    get_code_challenge,
    DEFAULT_CLIENT_ID
)


def test_generate_pkce_pair():
    verifier, challenge = generate_pkce_pair()
    assert len(verifier) >= 43
    assert len(challenge) >= 40
    assert "=" not in challenge


def test_state_bound_pkce_consistency():
    state = "unique_state_value_123"
    verifier1 = get_pkce_verifier_for_state(state)
    verifier2 = get_pkce_verifier_for_state(state)
    assert verifier1 == verifier2
    assert len(verifier1) >= 43

    challenge1 = get_code_challenge(verifier1)
    challenge2 = get_code_challenge(verifier2)
    assert challenge1 == challenge2



def test_build_lichess_auth_url():
    verifier, challenge = generate_pkce_pair()
    url = build_lichess_auth_url(
        client_id="test-client",
        redirect_uri="http://localhost:8501/",
        state="test-state-123",
        code_challenge=challenge
    )
    assert "https://lichess.org/oauth?" in url
    assert "response_type=code" in url
    assert "client_id=test-client" in url
    assert "code_challenge_method=S256" in url
    assert f"code_challenge={challenge}" in url
    assert "state=test-state-123" in url


def test_exchange_code_for_token_success(monkeypatch):
    def mock_urlopen(req, timeout=15):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps({
            "access_token": "lip_mock_access_token_123",
            "token_type": "Bearer"
        }).encode('utf-8')
        mock_resp.__enter__.return_value = mock_resp
        return mock_resp

    monkeypatch.setattr("urllib.request.urlopen", mock_urlopen)

    token, err = exchange_code_for_token(
        code="mock_code_abc",
        code_verifier="mock_verifier_xyz",
        client_id="test-client"
    )
    assert err is None
    assert token == "lip_mock_access_token_123"


def test_fetch_current_user_profile_success(monkeypatch):
    def mock_urlopen(req, timeout=12):
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps({
            "id": "trang66",
            "username": "trang66"
        }).encode('utf-8')
        mock_resp.__enter__.return_value = mock_resp
        return mock_resp

    monkeypatch.setattr("urllib.request.urlopen", mock_urlopen)

    profile, err = fetch_current_user_profile("lip_mock_token")
    assert err is None
    assert profile is not None
    assert profile["username"] == "trang66"
