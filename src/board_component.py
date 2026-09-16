"""
Board Component Module
----------------------
Chức năng: Tạo Bàn cờ tương tác 2 chiều (2-Way Interactive Chess Board) nhúng vào Streamlit.
Khi người dùng kéo/thả quân cờ trực tiếp trên bàn cờ, JS sẽ phát sự kiện `streamlit:setComponentValue`
truyền dữ liệu nước đi (`san`, `target_fen`) về Python để cập nhật Opening Tree và Move History lập tức!
"""

import os
import streamlit.components.v1 as components

# Đường dẫn chứa file HTML/JS của component bàn cờ
_ASSETS_DIR = os.path.join(os.path.dirname(__file__), "board_assets")

# Khai báo Streamlit Custom Component hỗ trợ giao tiếp 2 chiều
_chess_board_component = components.declare_component(
    "chess_board_interactive_component",
    path=_ASSETS_DIR
)


def render_interactive_board(
    fen: str,
    orientation: str = "white",
    height: int = 412,
    key: str = "chess_board_widget",
    **kwargs
):
    """
    Hiển thị bàn cờ tương tác và lắng nghe sự kiện di chuyển quân cờ trực tiếp từ người dùng.

    Args:
        fen: Chuỗi FEN vị trí bàn cờ hiện tại.
        orientation: Góc nhìn quân Trắng ('white') hoặc Đen ('black').
        height: Chiều cao iframe (px).
        key: Streamlit widget key.

    Returns:
        Dict chứa thông tin nước đi mới {'san', 'uci', 'target_fen', 'timestamp'} nếu người dùng vừa di chuyển quân,
        hoặc None nếu chưa có nước đi mới.
    """
    return _chess_board_component(
        fen=fen,
        orientation=orientation,
        key=key,
        default=None
    )
