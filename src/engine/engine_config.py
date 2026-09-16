"""
Engine Configuration Module
---------------------------
Chức năng: Quản lý cấu hình tập trung cho Stockfish Engine.
Đảm bảo khả năng chạy linh hoạt trên môi trường Local và Streamlit Cloud.
"""

import os
import shutil
from pathlib import Path
from typing import Optional

# Cấu hình Mặc định cho Engine Analysis
ENGINE_DEPTH: int = 6
ENGINE_HASH_MB: int = 16
ENGINE_THREADS: int = 1
ENGINE_TIMEOUT_SEC: float = 2.0

# Các đường dẫn Stockfish phổ biến theo hệ điều hành
COMMON_STOCKFISH_PATHS = [
    os.environ.get("STOCKFISH_PATH", ""),
    "/usr/games/stockfish",
    "/usr/bin/stockfish",
    "/usr/local/bin/stockfish",
    "/opt/homebrew/bin/stockfish",
    "stockfish",
    "stockfish.exe",
    "./stockfish",
    "./stockfish.exe",
    "./bin/stockfish",
    "./bin/stockfish.exe",
]


def find_stockfish_executable() -> Optional[str]:
    """
    Tự động dò tìm file thực thi Stockfish theo thứ tự ưu tiên:
    1. Biến môi trường STOCKFISH_PATH
    2. Quét tự động thư mục local (./, ./stockfish/, ./bin/, etc.) tìm các file stockfish*.exe hoặc stockfish
    3. Các đường dẫn Linux/Mac chuẩn (/usr/games/stockfish, /usr/bin/stockfish, etc.)
    4. System PATH (shutil.which)
    """
    env_path = os.environ.get("STOCKFISH_PATH")
    if env_path and Path(env_path).exists():
        return env_path

    # Quét tự động các file stockfish*.exe trong các thư mục local
    search_folders = [".", "./stockfish", "./bin", "./stockfish_engine"]
    for folder_str in search_folders:
        folder_path = Path(folder_str)
        if folder_path.exists() and folder_path.is_dir():
            try:
                for file_path in folder_path.glob("stockfish*"):
                    if file_path.is_file() and file_path.suffix.lower() in ["", ".exe"]:
                        return str(file_path.resolve())
            except Exception:
                pass

    for p in COMMON_STOCKFISH_PATHS:
        if not p:
            continue
        try:
            path_obj = Path(p)
            if path_obj.exists() and path_obj.is_file():
                return str(path_obj.resolve())
        except Exception:
            pass

    system_which = shutil.which("stockfish") or shutil.which("stockfish.exe")
    if system_which:
        return system_which

    return None
