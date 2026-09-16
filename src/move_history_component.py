"""
Move History Component Module
------------------------------
Chức năng: Component 2 chiều render Lịch sử nước đi dạng đoạn văn PGN liên tục.
Không có nút bấm hay viền ô bọc quanh từ. Click vào từng từ nước đi gửi ply index về Python
để nhảy trực tiếp thế cờ trên bàn cờ.
"""

import os
import streamlit.components.v1 as components

_ASSETS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "move_history_assets"))

_move_history_component = components.declare_component(
    "move_history_inline_component",
    path=_ASSETS_DIR
)


def render_move_history_component(
    moves: list[str],
    current_ply: int,
    height: int = 160,
    key: str = "main_move_history_component",
    **kwargs
):
    """
    Render đoạn văn PGN liên tục và trả về ply được nhấp.
    """
    return _move_history_component(
        moves=moves,
        current_ply=current_ply,
        currentPly=current_ply,
        height=height,
        key=key,
        default=None
    )
