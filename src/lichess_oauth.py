"""
Lichess OAuth 2.0 PKCE Integration Module
----------------------------------------
Chức năng: Xử lý quy trình đăng nhập Lichess 1-click (OAuth 2.0 PKCE Flow) tương tự OpeningTree.
Tự động trao đổi Authorization Code lấy Access Token và lấy tên tài khoản người dùng
để kích hoạt chế độ nạp ván đấu siêu tốc (Fast-lane) không cần copy-paste token thủ công.
"""

import hashlib
import hmac
import base64
import secrets
import urllib.request
import urllib.parse
import json
import os
from typing import Tuple, Optional, Dict, Any


DEFAULT_CLIENT_ID = os.getenv("LICHESS_CLIENT_ID", "chess-opponent-analyzer")
DEFAULT_REDIRECT_URI = os.getenv("LICHESS_REDIRECT_URI", "http://localhost:8501/")
_SERVER_SECRET = os.getenv("APP_SECRET_KEY", "chess-opponent-analyzer-pkce-secret-key-2026").encode('utf-8')
_STATE_CACHE: Dict[str, str] = {}


def generate_state() -> str:
    """Sinh chuỗi state ngẫu nhiên an toàn."""
    return secrets.token_urlsafe(24)


def get_pkce_verifier_for_state(state: str) -> str:
    """
    Trích xuất hoặc suy diễn code_verifier từ chuỗi state.
    Đảm bảo 100% không bị lệch giữa trước và sau khi redirect kể cả khi session Streamlit khởi tạo lại.
    """
    if state and state in _STATE_CACHE:
        return _STATE_CACHE[state]
    
    clean_state = state or "default_state"
    # Suy diễn bảo mật qua HMAC-SHA384 (64 ký tự base64url hợp lệ theo RFC 7636: 43 <= len <= 128)
    h = hmac.new(_SERVER_SECRET, clean_state.encode('utf-8'), hashlib.sha384).digest()
    verifier = base64.urlsafe_b64encode(h).decode('utf-8').rstrip('=')
    if state:
        _STATE_CACHE[state] = verifier
    return verifier


def get_code_challenge(code_verifier: str) -> str:
    """Tính code_challenge từ code_verifier theo chuẩn S256."""
    sha = hashlib.sha256(code_verifier.encode('utf-8')).digest()
    return base64.urlsafe_b64encode(sha).decode('utf-8').rstrip('=')


def generate_pkce_pair() -> Tuple[str, str]:
    """
    Sinh cặp code_verifier và code_challenge (S256) theo chuẩn RFC 7636 PKCE.
    """
    state = generate_state()
    verifier = get_pkce_verifier_for_state(state)
    challenge = get_code_challenge(verifier)
    return verifier, challenge


def build_lichess_auth_url(
    client_id: str = DEFAULT_CLIENT_ID,
    redirect_uri: str = DEFAULT_REDIRECT_URI,
    state: Optional[str] = None,
    code_challenge: Optional[str] = None
) -> str:
    """
    Tạo Authorization URL mở trang cấp quyền Lichess OAuth PKCE.
    """
    actual_state = state or generate_state()
    if not code_challenge:
        verifier = get_pkce_verifier_for_state(actual_state)
        code_challenge = get_code_challenge(verifier)

    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": "",
        "state": actual_state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256"
    }
    return f"https://lichess.org/oauth?{urllib.parse.urlencode(params)}"


def exchange_code_for_token(
    code: str,
    code_verifier: str,
    client_id: str = DEFAULT_CLIENT_ID,
    redirect_uri: str = DEFAULT_REDIRECT_URI
) -> Tuple[Optional[str], Optional[str]]:
    """
    Đổi authorization code lấy Access Token từ Lichess API endpoint (/api/token).
    """
    token_url = "https://lichess.org/api/token"
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "code_verifier": code_verifier,
        "redirect_uri": redirect_uri,
        "client_id": client_id
    }
    data = urllib.parse.urlencode(payload).encode('utf-8')
    req = urllib.request.Request(
        token_url,
        data=data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "ChessOpponentAnalyzer/1.0"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 200:
                res_json = json.loads(resp.read().decode('utf-8'))
                access_token = res_json.get("access_token")
                return access_token, None
            return None, f"Lichess API trả về HTTP {resp.status}"
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='ignore')
        return None, f"Lỗi xác thực Lichess (HTTP {e.code}): {err_body or e.reason}"
    except Exception as e:
        return None, f"Không thể kết nối đến Lichess: {e}"


def fetch_current_user_profile(token: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Lấy thông tin profile người dùng đã đăng nhập (/api/account) bằng Access Token.
    """
    url = "https://lichess.org/api/account"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "User-Agent": "ChessOpponentAnalyzer/1.0"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            if resp.status == 200:
                user_data = json.loads(resp.read().decode('utf-8'))
                return user_data, None
            return None, f"HTTP {resp.status}"
    except Exception as e:
        return None, str(e)
