"""
AI Assistant Configuration Module
---------------------------------
Chức năng: Tự động nạp Gemini API Key từ môi trường máy chủ (Server-side):
1. Biến môi trường hệ thống (Environment variables: GEMINI_API_KEY / GOOGLE_API_KEY)
2. File cấu hình nội bộ .env (nếu có)
3. Streamlit Secrets (st.secrets["GEMINI_API_KEY"] khi triển khai Cloud)
"""

import os
from pathlib import Path
from typing import Optional


def load_server_env_file() -> None:
    """Tự động đọc file .env ở thư mục gốc nếu chưa có trong os.environ."""
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    if env_path.exists():
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    if key and key not in os.environ:
                        os.environ[key] = val
        except Exception:
            pass


def get_server_gemini_api_key() -> str:
    """
    Lấy Gemini API Key máy chủ được cấu hình sẵn trong ứng dụng.
    """
    load_server_env_file()

    # 1. Kiểm tra os.environ
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""
    if key.strip():
        return key.strip()

    # 2. Kiểm tra Streamlit secrets (nếu chạy trên Streamlit Cloud)
    try:
        import streamlit as st
        if hasattr(st, "secrets") and "GEMINI_API_KEY" in st.secrets:
            return str(st.secrets["GEMINI_API_KEY"]).strip()
    except Exception:
        pass

    return ""
