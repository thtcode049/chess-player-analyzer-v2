import os
import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import chess

from src.pgn_parser import parse_pgn, extract_players, detect_primary_player, filter_games_by_player, OPENING_LOOKUP
from src.statistics import calculate_game_stats
from src.opening_tree import build_opening_tree, get_position_details
from src.board_component import render_interactive_board
from src.move_history_component import render_move_history_component
from src.player_profile import analyze_opening_repertoire, generate_deep_opponent_profile
from src.game_fetcher import fetch_lichess_games, fetch_chesscom_games
from src.lichess_oauth import (
    generate_pkce_pair,
    build_lichess_auth_url,
    exchange_code_for_token,
    fetch_current_user_profile,
    get_pkce_verifier_for_state,
    DEFAULT_CLIENT_ID,
    DEFAULT_REDIRECT_URI
)
from src.engine.stockfish_engine import StockfishEngine
from src.engine.evaluator import get_comprehensive_move_evaluations, parallel_batch_analyze_games
from src.ai_assistant import (
    build_player_ai_context,
    stream_gemini_response,
    generate_initial_strategic_briefing,
    get_followup_prompts,
    AVAILABLE_MODELS,
)
from src.ui_components import (
    apply_global_styles,
    AppFooter,
    PageHeader,
    MetricCard,
    InsightCard,
    PastelCard,
    EmptyState,
    RenderDataTable,
    AnalysisProgressTracker,
    COLOR_WIN,
    COLOR_DRAW,
    COLOR_LOSS,
    COLOR_WARNING,
    COLOR_PRIMARY,
    get_icon_svg,
)

# Set Page Config
st.set_page_config(
    page_title="Chess Player Analyzer",
    page_icon="assets/icons/app_logo.svg",
    layout="wide",
    initial_sidebar_state="expanded",
)

@st.cache_resource
def _get_cached_stockfish_engine():
    return StockfishEngine()

def get_stockfish_engine():
    eng = _get_cached_stockfish_engine()
    if not eng.is_available():
        st.cache_resource.clear()
        eng = _get_cached_stockfish_engine()
    return eng

# Initialize Session State Variables
if "language" not in st.session_state:
    st.session_state.language = "vi"

if "theme_mode" not in st.session_state:
    st.session_state.theme_mode = "light"

if "active_nav_page" not in st.session_state:
    st.session_state.active_nav_page = "Dashboard"

if "chess_board" not in st.session_state:
    st.session_state.chess_board = chess.Board()

if "move_history" not in st.session_state:
    st.session_state.move_history = []

if "full_analysis_line" not in st.session_state:
    st.session_state.full_analysis_line = []

if "board_orientation" not in st.session_state:
    st.session_state.board_orientation = "white"

if "user_match_color" not in st.session_state:
    st.session_state.user_match_color = "white"

if "last_selected_player" not in st.session_state:
    st.session_state.last_selected_player = None

if "last_board_timestamp" not in st.session_state:
    st.session_state.last_board_timestamp = 0

if "online_pgn_bytes" not in st.session_state:
    st.session_state.online_pgn_bytes = None

if "online_pgn_name" not in st.session_state:
    st.session_state.online_pgn_name = ""

# Lichess OAuth PKCE State & Callback
if "lichess_api_token" not in st.session_state:
    st.session_state.lichess_api_token = os.getenv("LICHESS_API_TOKEN", "")

if "lichess_logged_user" not in st.session_state:
    st.session_state.lichess_logged_user = ""

if "lichess_pkce_verifier" not in st.session_state or "lichess_pkce_challenge" not in st.session_state:
    _v, _c = generate_pkce_pair()
    st.session_state.lichess_pkce_verifier = _v
    st.session_state.lichess_pkce_challenge = _c

# Tự động bắt Authorization Code từ Lichess OAuth redirect
if "code" in st.query_params:
    oauth_code = st.query_params.get("code")
    oauth_state = st.query_params.get("state") or ""
    verifier = get_pkce_verifier_for_state(oauth_state)
    token_val, err_val = exchange_code_for_token(
        code=oauth_code,
        code_verifier=verifier,
        client_id=DEFAULT_CLIENT_ID,
        redirect_uri=DEFAULT_REDIRECT_URI
    )
    if token_val:
        st.session_state.lichess_api_token = token_val
        user_info, _ = fetch_current_user_profile(token_val)
        if user_info and user_info.get("username"):
            st.session_state.lichess_logged_user = user_info["username"]
            st.session_state.import_page_user_input = user_info["username"]
        st.session_state.active_nav_page = "Import"
        st.toast(f"Đã liên kết Lichess: {st.session_state.get('lichess_logged_user', 'Thành công')}!", icon="⚡")
    else:
        st.error(f"Lỗi xác thực OAuth từ Lichess: {err_val}")
    st.query_params.clear()

# Memoization Cache trong Session State
if "analysis_color_filter" not in st.session_state:
    st.session_state.analysis_color_filter = "all"

if "cached_fen_map" not in st.session_state:
    st.session_state.cached_fen_map = {}

if "cached_fen_map_white" not in st.session_state:
    st.session_state.cached_fen_map_white = {}

if "cached_fen_map_black" not in st.session_state:
    st.session_state.cached_fen_map_black = {}

if "cached_stats" not in st.session_state:
    st.session_state.cached_stats = {}

if "cached_repertoire" not in st.session_state:
    st.session_state.cached_repertoire = {}

if "cached_filtered_games" not in st.session_state:
    st.session_state.cached_filtered_games = []

if "cached_move_evaluations" not in st.session_state:
    st.session_state.cached_move_evaluations = None

if "cached_deep_profile" not in st.session_state:
    st.session_state.cached_deep_profile = None

if "cached_profile_lang" not in st.session_state:
    st.session_state.cached_profile_lang = None

# AI Assistant Session State
if "ai_chat_history" not in st.session_state:
    st.session_state.ai_chat_history = []

if "pending_ai_prompt" not in st.session_state:
    st.session_state.pending_ai_prompt = None

# Pawn Structure Explorer Mode State
if "selected_structure" not in st.session_state:
    st.session_state.selected_structure = None

if "structure_games" not in st.session_state:
    st.session_state.structure_games = []

if "selected_structure_game" not in st.session_state:
    st.session_state.selected_structure_game = None

if "structure_explorer_filter" not in st.session_state:
    st.session_state.structure_explorer_filter = "All"

if "skip_board_reset_on_nav" not in st.session_state:
    st.session_state.skip_board_reset_on_nav = False

if "previous_nav_page" not in st.session_state:
    st.session_state.previous_nav_page = st.session_state.active_nav_page

# Áp dụng Global Design System CSS & Theme Mode (Light Mode)
apply_global_styles(theme_mode="light")


# Caching cho hàm Parse PGN để chỉ parse 1 LẦN DUY NHẤT khi upload/tải file
@st.cache_data(show_spinner="⏳ Đang bóc tách dữ liệu PGN...")
def cached_parse_pgn(file_bytes: bytes):
    return parse_pgn(file_bytes)


# State Mutator Functions
def push_move(san_move: str):
    try:
        move_obj = st.session_state.chess_board.parse_san(san_move)
        st.session_state.chess_board.push(move_obj)
        current_ply = len(st.session_state.move_history)
        st.session_state.move_history.append(san_move)

        full_line = st.session_state.full_analysis_line
        if current_ply < len(full_line) and full_line[current_ply] == san_move:
            # Tiếp tục di chuyển trên dòng phân tích sẵn có -> Giữ nguyên full_analysis_line
            pass
        else:
            # Nước đi mới tạo nhánh biến mới -> Cập nhật full_analysis_line
            st.session_state.full_analysis_line = list(st.session_state.move_history)
    except Exception as e:
        st.error(f"Nước đi không hợp lệ '{san_move}': {e}")


def pop_move():
    if len(st.session_state.move_history) > 0:
        st.session_state.chess_board.pop()
        st.session_state.move_history.pop()


def reset_to_first():
    st.session_state.chess_board.reset()
    st.session_state.move_history = []


def step_next():
    history_len = len(st.session_state.move_history)
    full_len = len(st.session_state.full_analysis_line)
    if history_len < full_len:
        next_move = st.session_state.full_analysis_line[history_len]
        push_move(next_move)


def step_last():
    full_len = len(st.session_state.full_analysis_line)
    while len(st.session_state.move_history) < full_len:
        step_next()


def toggle_orientation():
    st.session_state.board_orientation = (
        "black" if st.session_state.board_orientation == "white" else "white"
    )


def jump_to_move_index(target_index: int):
    """Nhảy trực tiếp đến nước đi thứ target_index trong lịch sử đấu."""
    st.session_state.chess_board.reset()
    full_line = st.session_state.full_analysis_line
    st.session_state.move_history = []
    for i in range(min(target_index + 1, len(full_line))):
        m = full_line[i]
        try:
            move_obj = st.session_state.chess_board.parse_san(m)
            st.session_state.chess_board.push(move_obj)
            st.session_state.move_history.append(m)
        except Exception:
            break


def load_single_game_onto_board(game_info: dict):
    """Nạp toàn bộ nước đi của ván đấu lên bàn cờ phân tích và mở trang Analyze Games."""
    moves = game_info.get("moves", [])
    st.session_state.chess_board.reset()
    st.session_state.move_history = []
    for m in moves:
        try:
            move_obj = st.session_state.chess_board.parse_san(m)
            st.session_state.chess_board.push(move_obj)
            st.session_state.move_history.append(m)
        except Exception:
            break
    st.session_state.full_analysis_line = list(st.session_state.move_history)
    st.session_state.skip_board_reset_on_nav = True
    st.session_state.active_nav_page = "Analyze"
    st.rerun()


def find_common_move_prefix(games: list) -> list:
    """Tìm chuỗi nước đi SAN đầu tiên giống nhau (longest common prefix) giữa tất cả các ván đấu."""
    if not games:
        return []
    all_game_moves = [g.get("moves", []) for g in games if g.get("moves")]
    if not all_game_moves:
        return []

    common = []
    min_len = min(len(m) for m in all_game_moves)
    for i in range(min_len):
        move_i = all_game_moves[0][i]
        if all(m[i] == move_i for m in all_game_moves):
            common.append(move_i)
        else:
            break
    return common


def find_representative_line_for_games(games: list) -> list:
    """
    Phân tích thế cờ (position & transposition analysis) trong nhóm ván đấu để tìm
    thế cờ đặc trưng (canonical position) xuất hiện phổ biến nhất và sinh chuỗi
    nước đi đại diện (representative line) dẫn đến thế cờ đó.
    Sử dụng EPD key (quân cờ + lượt đi + nhập thành + bắt tốt qua đường) để khớp transposition chuẩn xác.
    """
    if not games:
        return []
    if len(games) == 1:
        return games[0].get("moves", [])

    fen_info = {}
    start_key = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"

    for g_idx, game in enumerate(games):
        moves = game.get("moves", [])
        if not moves:
            continue
        board = chess.Board()
        root_key = " ".join(board.fen().split()[:4])

        if root_key not in fen_info:
            fen_info[root_key] = {"games": set(), "paths": {}}
        fen_info[root_key]["games"].add(g_idx)
        fen_info[root_key]["paths"][()] = fen_info[root_key]["paths"].get((), 0) + 1

        current_path = []
        for san in moves:
            try:
                move_obj = board.parse_san(san)
                board.push(move_obj)
                current_path.append(san)
                next_key = " ".join(board.fen().split()[:4])

                if next_key not in fen_info:
                    fen_info[next_key] = {"games": set(), "paths": {}}
                fen_info[next_key]["games"].add(g_idx)
                path_tuple = tuple(current_path)
                fen_info[next_key]["paths"][path_tuple] = (
                    fen_info[next_key]["paths"].get(path_tuple, 0) + 1
                )
            except ValueError:
                break

    if not fen_info:
        return []

    non_root_counts = [
        len(info["games"]) for key, info in fen_info.items() if key != start_key
    ]
    if not non_root_counts:
        return []

    max_games_count = max(non_root_counts)
    threshold = max(2, int(max_games_count * 0.75))

    best_key = None
    max_depth = -1

    for key, info in fen_info.items():
        if key == start_key:
            continue
        g_count = len(info["games"])
        if g_count >= threshold:
            for path_tuple in info["paths"].keys():
                depth = len(path_tuple)
                if depth > max_depth:
                    max_depth = depth
                    best_key = key
                elif depth == max_depth and best_key is not None:
                    if g_count > len(fen_info[best_key]["games"]):
                        best_key = key

    if not best_key:
        return find_common_move_prefix(games)

    best_paths = fen_info[best_key]["paths"]
    most_common_path = max(best_paths.items(), key=lambda x: x[1])[0]
    return list(most_common_path)


def get_games_for_opening(opening_name: str, filtered_games: list) -> list:
    """Lọc tất cả các ván đấu trùng khớp với tên khai cuộc."""
    op_clean = opening_name.strip().lower()
    matching = []
    for g in filtered_games:
        g_op = g.get("opening", "").strip().lower()
        if g_op and (op_clean == g_op or op_clean in g_op or g_op in op_clean):
            matching.append(g)

    if not matching:
        for prefix, eco, name in OPENING_LOOKUP:
            if name.lower() in op_clean or op_clean in name.lower():
                prefix_list = list(prefix)
                for g in filtered_games:
                    g_moves = g.get("moves", [])
                    if g_moves[: len(prefix_list)] == prefix_list:
                        matching.append(g)
                break
    return matching


def find_moves_for_opening(opening_name: str, filtered_games: list) -> list:
    """Tìm danh sách nước đi SAN tương ứng với tên khai cuộc."""
    op_clean = opening_name.strip().lower()
    for g in filtered_games:
        g_op = g.get("opening", "").strip().lower()
        if g_op and (g_op == op_clean or op_clean in g_op):
            return g.get("moves", [])

    for prefix, eco, name in OPENING_LOOKUP:
        if name.lower() in op_clean or op_clean in name.lower():
            return list(prefix)
    return []


def load_opening_onto_board(opening_name: str, filtered_games: list, color: str = None):
    """
    Nạp biến khai cuộc lên bàn cờ tương tác và mở trang Analyze Games.
    Sử dụng Position & Transposition Analysis để tìm thế cờ đặc trưng (canonical position)
    và nạp chuỗi nước đi đại diện (representative line) lên bàn cờ theo màu quân tương ứng.
    """
    if color and color.lower() in ["white", "black"]:
        target_color = color.lower()
        st.session_state.analysis_color_filter = target_color
        st.session_state.board_orientation = target_color
        games_subset = [g for g in filtered_games if str(g.get("player_color", "")).lower() == target_color]
        if not games_subset:
            games_subset = filtered_games
    else:
        games_subset = filtered_games

    matching_games = get_games_for_opening(opening_name, games_subset)
    if not matching_games and games_subset is not filtered_games:
        matching_games = get_games_for_opening(opening_name, filtered_games)

    if len(matching_games) == 1:
        load_single_game_onto_board(matching_games[0])
        return

    common_moves = find_representative_line_for_games(matching_games)
    if not common_moves:
        common_moves = find_moves_for_opening(opening_name, matching_games if matching_games else games_subset)

    st.session_state.chess_board.reset()
    st.session_state.move_history = []
    for m in common_moves:
        try:
            move_obj = st.session_state.chess_board.parse_san(m)
            st.session_state.chess_board.push(move_obj)
            st.session_state.move_history.append(m)
        except Exception:
            break
    st.session_state.full_analysis_line = list(st.session_state.move_history)
    st.session_state.skip_board_reset_on_nav = True
    st.session_state.active_nav_page = "Analyze"
    st.rerun()


def load_fen_onto_board(fen_str: str):
    """Load vị trí FEN trực tiếp lên bàn cờ tương tác và mở trang Analyze Games."""
    try:
        st.session_state.chess_board = chess.Board(fen_str)
        st.session_state.move_history = []
        st.session_state.full_analysis_line = []
        st.session_state.skip_board_reset_on_nav = True
        st.session_state.active_nav_page = "Analyze"
        st.rerun()
    except Exception as e:
        st.error(f"Lỗi nạp FEN: {e}")


def load_pawn_structure_onto_board(structure_info: dict):
    """
    Kích hoạt Structure Explorer Mode cho Cấu trúc Tốt được chọn và chuyển sang trang Analyze.
    Đảm bảo danh sách ván đấu luôn được nạp đầy đủ (tính lại nếu cache cũ bị thiếu).
    """
    struct_name = structure_info.get("name", "Pawn Structure")
    games_list = structure_info.get("games", [])
    expected_count = structure_info.get("games_count", 0)

    # Nếu list games rỗng hoặc thiếu games so với games_count, lập tức tính lại từ cached_filtered_games
    if (not games_list or len(games_list) < expected_count) and st.session_state.get("cached_filtered_games"):
        from src.analysis.pawn_structure import analyze_structural_performance
        fresh_struct_res = analyze_structural_performance(
            st.session_state.cached_filtered_games,
            move_evaluations=st.session_state.get("cached_move_evaluations"),
            lang=st.session_state.get("language", "vi")
        )
        target_name_lower = str(struct_name).strip().lower()
        target_key_lower = str(structure_info.get("structure_key", "")).strip().lower()

        for s_item in fresh_struct_res.get("structures", []):
            s_name = s_item.get("name", "").strip().lower()
            s_key = s_item.get("structure_key", "").strip().lower()

            if (s_name and (s_name == target_name_lower or target_name_lower in s_name or s_name in target_name_lower)) or \
               (s_key and s_key == target_key_lower):
                games_list = s_item.get("games", [])
                if st.session_state.get("cached_deep_profile"):
                    st.session_state.cached_deep_profile["structures"] = fresh_struct_res
                break

    st.session_state.selected_structure = struct_name
    st.session_state.structure_games = games_list
    st.session_state.selected_structure_game = None
    st.session_state.structure_explorer_filter = "All"
    st.session_state.skip_board_reset_on_nav = True
    st.session_state.active_nav_page = "Analyze"
    st.rerun()


@st.fragment
def render_analysis_section(fen_map: dict, selected_player: str):
    all_player_games = st.session_state.get("cached_filtered_games", [])
    total_cnt = len(all_player_games)
    white_cnt = sum(1 for g in all_player_games if str(g.get("player_color", "")).lower() == "white")
    black_cnt = sum(1 for g in all_player_games if str(g.get("player_color", "")).lower() == "black")

    current_filter = st.session_state.get("analysis_color_filter", "all")

    # Select active fen_map based on color filter
    if current_filter == "white":
        if not st.session_state.get("cached_fen_map_white") and all_player_games:
            _, fm_w = build_opening_tree(all_player_games, color="white")
            st.session_state.cached_fen_map_white = fm_w
        active_fen_map = st.session_state.get("cached_fen_map_white", {})
    elif current_filter == "black":
        if not st.session_state.get("cached_fen_map_black") and all_player_games:
            _, fm_b = build_opening_tree(all_player_games, color="black")
            st.session_state.cached_fen_map_black = fm_b
        active_fen_map = st.session_state.get("cached_fen_map_black", {})
    else:
        active_fen_map = fen_map or st.session_state.get("cached_fen_map", {})

    col_board, col_right = st.columns([5.5, 6.5])

    current_fen = st.session_state.chess_board.fen()
    fen_url = current_fen.replace(" ", "_")
    lichess_url = f"https://lichess.org/analysis/standard/{fen_url}"

    with col_board:
        st.caption(f"Kỳ thủ: **{selected_player}** | Góc nhìn: **{st.session_state.board_orientation.capitalize()}**")
        
        board_event = render_interactive_board(
            fen=current_fen,
            orientation=st.session_state.board_orientation,
            height=412,
            key="main_interactive_board"
        )

        if board_event and isinstance(board_event, dict):
            ts = board_event.get("timestamp", 0)
            if ts != st.session_state.last_board_timestamp:
                st.session_state.last_board_timestamp = ts
                if "san" in board_event:
                    move_san = board_event["san"]
                    push_move(move_san)
                    st.rerun()
                elif "key_action" in board_event:
                    act = board_event["key_action"]
                    if act == "prev":
                        pop_move()
                    elif act == "next":
                        step_next()
                    elif act == "first":
                        reset_to_first()
                    elif act == "last":
                        step_last()
                    st.rerun()

        # Navigation Controls (Centered under board)
        c_pad1, c_ctrl, c_pad2 = st.columns([0.4, 4.3, 0.4])
        with c_ctrl:
            nav1, nav2, nav3, nav4, nav5 = st.columns([1, 1, 1, 1, 1])
            with nav1:
                st.button("|<", on_click=reset_to_first, help="Nước đầu tiên", use_container_width=True)
            with nav2:
                st.button("<", on_click=pop_move, help="Nước trước", use_container_width=True)
            with nav3:
                st.button(">", on_click=step_next, help="Nước tiếp theo", use_container_width=True)
            with nav4:
                st.button(">|", on_click=step_last, help="Nước cuối cùng", use_container_width=True)
            with nav5:
                st.button("", icon=":material/sync:", on_click=toggle_orientation, help="Xoay bàn cờ", use_container_width=True)

        st.link_button(
            "🔍 Phân tích trên Lichess",
            url=lichess_url,
            help="Mở thế cờ hiện tại trên Lichess Analysis Board",
            use_container_width=True
        )

        with st.expander("Hiển thị FEN", expanded=False):
            st.code(current_fen, language="text")

    # Right Column: Move History (top) + Color Filter + Opening Tree Continuations (bottom)
    with col_right:
        full_line = st.session_state.full_analysis_line
        current_ply = len(st.session_state.move_history) - 1
        pin_icon = get_icon_svg("pin", size=16)
        tree_icon = get_icon_svg("tree", size=18)

        with st.container(border=True):
            st.markdown(f"<div style='font-size:13px; font-weight:700; margin-bottom:4px; color:#0F172A;'>{pin_icon} Lịch sử nước đi ({len(full_line)} plies):</div>", unsafe_allow_html=True)
            
            hist_event = render_move_history_component(
                moves=full_line,
                current_ply=current_ply,
                height=150,
                key="main_move_history_component"
            )

            if hist_event and isinstance(hist_event, dict) and "ply" in hist_event:
                ts = hist_event.get("timestamp", 0)
                if ts != st.session_state.get("last_hist_timestamp", 0):
                    st.session_state.last_hist_timestamp = ts
                    target_ply = int(hist_event["ply"])
                    jump_to_move_index(target_ply)
                    st.rerun()

        st.markdown("<div style='margin-bottom:6px;'></div>", unsafe_allow_html=True)

        # Color Filter Control
        flt_col1, flt_col2, flt_col3 = st.columns(3)
        with flt_col1:
            is_all = current_filter == "all"
            if st.button(
                f"🔄 Tất cả ({total_cnt} ván)",
                key="btn_flt_all",
                type="primary" if is_all else "secondary",
                use_container_width=True
            ):
                st.session_state.analysis_color_filter = "all"
                st.rerun()

        with flt_col2:
            is_white = current_filter == "white"
            if st.button(
                f"⚪ Cầm Trắng ({white_cnt} ván)",
                key="btn_flt_white",
                type="primary" if is_white else "secondary",
                use_container_width=True
            ):
                st.session_state.analysis_color_filter = "white"
                st.session_state.board_orientation = "white"
                st.rerun()

        with flt_col3:
            is_black = current_filter == "black"
            if st.button(
                f"⚫ Cầm Đen ({black_cnt} ván)",
                key="btn_flt_black",
                type="primary" if is_black else "secondary",
                use_container_width=True
            ):
                st.session_state.analysis_color_filter = "black"
                st.session_state.board_orientation = "black"
                st.rerun()

        st.markdown("<div style='margin-bottom:6px;'></div>", unsafe_allow_html=True)

        pos_details = get_position_details(active_fen_map, current_fen)

        with st.container(border=True):
            if current_filter == "white":
                filter_suffix = f"<span style='font-size:12px; font-weight:600; color:#475569;'> (⚪ Khai cuộc Trắng - {white_cnt} ván)</span>"
            elif current_filter == "black":
                filter_suffix = f"<span style='font-size:12px; font-weight:600; color:#475569;'> (⚫ Khai cuộc Đen - {black_cnt} ván)</span>"
            else:
                filter_suffix = f"<span style='font-size:12px; font-weight:600; color:#475569;'> ({total_cnt} ván)</span>"

            st.markdown(f"<div style='font-size:15px; font-weight:700; color:#0F172A; margin-bottom:8px;'>{tree_icon} Các Biến Thể Khai Cuộc Tiếp Theo{filter_suffix}</div>", unsafe_allow_html=True)

            continuations = pos_details["continuations"]

            if not continuations:
                st.info("Không có nước đi tiếp theo trong cơ sở dữ liệu ván đấu.")
            else:
                h1, h2, h3, h4, h5 = st.columns([1.5, 1.0, 1.2, 3.8, 1.2])
                with h1:
                    st.markdown("<div class='continuation-header'>Nước đi</div>", unsafe_allow_html=True)
                with h2:
                    st.markdown("<div class='continuation-header'>Số ván</div>", unsafe_allow_html=True)
                with h3:
                    st.markdown("<div class='continuation-header'>Tần suất</div>", unsafe_allow_html=True)
                with h4:
                    st.markdown("<div class='continuation-header'>Kết quả</div>", unsafe_allow_html=True)
                with h5:
                    st.markdown("<div class='continuation-header'>Điểm số</div>", unsafe_allow_html=True)

                for cont in continuations:
                    san = cont["san"]
                    g_count = cont["games_count"]
                    usage = cont["usage_pct"]
                    w_pct = cont["win_pct"]
                    d_pct = cont["draw_pct"]
                    l_pct = cont["loss_pct"]
                    score = cont["score_pct"]
                    sg = cont.get("single_game_info")

                    if g_count == 1 and sg:
                        c1, c_game, c_link = st.columns([1.5, 6.2, 1.0])
                        with c1:
                            if st.button(san, icon=":material/play_arrow:", key=f"tree_move_{san}_{len(st.session_state.move_history)}", use_container_width=True, help=f"Đi tiếp nước {san}"):
                                push_move(san)
                                st.rerun()

                        w_name = sg.get("white", "White")
                        w_elo = f"({sg['white_elo']})" if sg.get("white_elo") and sg["white_elo"] > 0 else ""
                        b_name = sg.get("black", "Black")
                        b_elo = f"({sg['black_elo']})" if sg.get("black_elo") and sg["black_elo"] > 0 else ""
                        res = sg.get("result", "*")
                        game_label = f"{w_name}{w_elo} {res} {b_name}{b_elo}"

                        # Trích xuất URL xem trực tiếp trên nền tảng (Lichess / Chess.com)
                        site_url = sg.get("link", "") or (sg.get("site", "") if str(sg.get("site", "")).startswith("http") else "")
                        has_link = bool(site_url and (site_url.startswith("http://") or site_url.startswith("https://")))

                        # Trích xuất các thông tin cơ bản của ván đấu (Date, Round, Event, Site)
                        raw_date = str(sg.get("date", "")).strip()
                        raw_event = str(sg.get("event", "")).strip()
                        raw_site = str(sg.get("site", "")).strip()
                        raw_round = str(sg.get("round", "")).strip()

                        # Chuẩn hóa hiển thị, loại bỏ các event mặc định trực tuyến như Live Chess
                        generic_events = {
                            "live chess", "live chess match", "chess.com", "let's play!", 
                            "unknown event", "unknown", "?", "rated blitz game", "rated rapid game", 
                            "rated bullet game", "rated classical game", "rated correspondence game"
                        }
                        raw_event_lower = raw_event.lower().strip()
                        is_generic_event = (
                            not raw_event_lower or 
                            raw_event_lower in generic_events or 
                            raw_event_lower.startswith("live chess") or 
                            raw_event_lower.startswith("rated ")
                        )
                        event_display = "" if is_generic_event else raw_event

                        date_display = raw_date if raw_date and raw_date not in ["????.??.??", "Unknown Date", "?"] else ""
                        round_display = f"Vòng {raw_round}" if raw_round and raw_round not in ["?", "-", "0"] else ""
                        site_display = raw_site if raw_site and raw_site not in ["Unknown Site", "?", "Chess.com"] and not raw_site.startswith("http") else ""

                        platform_name = "Lichess" if "lichess.org" in site_url else ("Chess.com" if "chess.com" in site_url else "Nền tảng")

                        if has_link:
                            # Nạp từ Lichess / Chess.com: hiển thị ngày
                            online_suffix = f" - {date_display}" if date_display else ""
                            game_btn_help = f"Xem ván đấu này{online_suffix}"
                            link_btn_help = f"Mở ván đấu trên {platform_name}{online_suffix}"
                        else:
                            # Nạp từ PGN: chỉ hiển thị thông điệp ngắn gọn
                            game_btn_help = "Xem ván đấu"
                            popover_btn_help = "Xem thông tin ván đấu này"

                        with c_game:
                            if st.button(game_label, icon=":material/visibility:", key=f"tree_game_{san}_{len(st.session_state.move_history)}", use_container_width=True, help=game_btn_help):
                                load_single_game_onto_board(sg)

                        with c_link:
                            if has_link:
                                st.link_button(
                                    "↗",
                                    url=site_url,
                                    help=link_btn_help,
                                    use_container_width=True
                                )
                            else:
                                with st.popover("", icon=":material/info:", help=popover_btn_help, use_container_width=True):
                                    extra_rows = []
                                    if date_display:
                                        extra_rows.append(f"<div style='color:#64748B;'>Thời gian:</div><div>{date_display}</div>")
                                    if round_display:
                                        extra_rows.append(f"<div style='color:#64748B;'>Vòng đấu:</div><div>{round_display}</div>")
                                    if event_display:
                                        extra_rows.append(f"<div style='color:#64748B;'>Giải đấu:</div><div>{event_display}</div>")
                                    if site_display:
                                        extra_rows.append(f"<div style='color:#64748B;'>Địa điểm:</div><div>{site_display}</div>")
                                    extra_rows_html = "".join(extra_rows)
                                    st.html(f"""<div style='font-size:13px; min-width:260px; color:#1E293B;'>
    <div style='font-weight:700; font-size:14px; margin-bottom:8px; border-bottom:1px solid #E2E8F0; padding-bottom:6px;'>
        Thông Tin Ván Đấu
    </div>
    <div style='display:grid; grid-template-columns: 75px 1fr; gap: 6px; font-size:12.5px; line-height:1.5;'>
        <div style='color:#64748B;'>Trắng:</div>
        <div><b>{w_name}</b> {w_elo}</div>
        <div style='color:#64748B;'>Đen:</div>
        <div><b>{b_name}</b> {b_elo}</div>
        <div style='color:#64748B;'>Kết quả:</div>
        <div><b>{res}</b></div>
        {extra_rows_html}
    </div>
</div>""")
                    else:
                        c1, c2, c3, c4, c5 = st.columns([1.5, 1.0, 1.2, 3.8, 1.2])

                        with c1:
                            if st.button(san, icon=":material/play_arrow:", key=f"tree_move_{san}_{len(st.session_state.move_history)}", use_container_width=True):
                                push_move(san)
                                st.rerun()

                        with c2:
                            st.markdown(f"<div style='padding-top:4px; font-weight:600; font-size:13px;'>{g_count}</div>", unsafe_allow_html=True)

                        with c3:
                            st.markdown(f"<div style='padding-top:4px; opacity:0.75; font-size:13px;'>{usage}%</div>", unsafe_allow_html=True)

                        with c4:
                            stacked_bar_html = f"""
                            <div style="padding-top:4px;">
                                <div title="Thắng: {w_pct}% | Hòa: {d_pct}% | Thua: {l_pct}%" 
                                     style="display:flex; height:12px; width:100%; border-radius:3px; overflow:hidden; background-color:rgba(148,163,184,0.2);">
                                    <div style="width:{w_pct}%; background-color:{COLOR_WIN};" title="Thắng {w_pct}%"></div>
                                    <div style="width:{d_pct}%; background-color:{COLOR_DRAW};" title="Hòa {d_pct}%"></div>
                                    <div style="width:{l_pct}%; background-color:{COLOR_LOSS};" title="Thua {l_pct}%"></div>
                                </div>
                                <div style="font-size:11px; opacity:0.8; margin-top:2px;">
                                    <span style="color:#22C55E; font-weight:600;">W {w_pct}%</span> · 
                                    <span style="font-weight:600;">D {d_pct}%</span> · 
                                    <span style="color:#EF4444; font-weight:600;">L {l_pct}%</span>
                                </div>
                            </div>
                            """
                            st.markdown(stacked_bar_html, unsafe_allow_html=True)

                        with c5:
                            st.markdown(f"<div style='padding-top:4px; font-weight:700; color:{COLOR_PRIMARY}; font-size:13px;'>{score}%</div>", unsafe_allow_html=True)


# ==============================================================================
# UNIFIED UNIFIED STICKY LEFT SIDEBAR
# ==============================================================================
with st.sidebar:
    # Sidebar Header Block (Logo + Title + Slogan tightly coupled)
    st.markdown("""
    <div style="display: flex; align-items: flex-start; gap: 8px; margin-top: 4px; margin-bottom: 8px;">
        <span style="font-size: 24px; line-height: 1; color: #10B981; display: inline-block; margin-top: 2px;">♟</span>
        <div>
            <div style="font-size: 15px; font-weight: 800; line-height: 1.15; color: #1E293B;">Chess Player Analyzer</div>
            <div style="font-size: 10px; color: #64748B; margin-top: 3px; line-height: 1.25; font-weight: 400;">Phân tích kỳ thủ. Khai thác dữ liệu.<br>Rèn luyện & Chuẩn bị đỉnh cao.</div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Navigation Group: ANALYZER
    st.markdown("<div class='sidebar-nav-group'>CÔNG CỤ PHÂN TÍCH</div>", unsafe_allow_html=True)
    
    analyzer_pages = [
        ("Dashboard", "Tổng quan", ":material/dashboard:"),
        ("Analyze", "Phân tích Ván đấu", ":material/analytics:"),
        ("Profile", "Hồ sơ & Phong độ", ":material/person:"),
        ("AIAssistant", "Trợ lí AI", ":material/smart_toy:"),
    ]

    for p_id, p_name, p_icon in analyzer_pages:
        is_active = st.session_state.active_nav_page == p_id
        if st.button(
            p_name,
            icon=p_icon,
            key=f"side_nav_{p_id}",
            use_container_width=True,
            type="primary" if is_active else "secondary"
        ):
            st.session_state.active_nav_page = p_id
            st.rerun()

    # Navigation Group: DATA
    st.markdown("<div class='sidebar-nav-group'>DỮ LIỆU</div>", unsafe_allow_html=True)
    is_active_import = st.session_state.active_nav_page == "Import"
    if st.button(
        "Nạp Ván đấu",
        icon=":material/cloud_upload:",
        key="side_nav_Import",
        use_container_width=True,
        type="primary" if is_active_import else "secondary"
    ):
        st.session_state.active_nav_page = "Import"
        st.rerun()

    # Navigation Group: SYSTEM
    st.markdown("<div class='sidebar-nav-group'>HỆ THỐNG</div>", unsafe_allow_html=True)
    if st.button(
        "Xóa Cache Dữ liệu",
        icon=":material/delete_sweep:",
        key="side_nav_clear_cache",
        use_container_width=True,
        type="secondary",
        help="Xóa sạch dữ liệu phân tích hiện tại, giải phóng bộ nhớ và quay về màn hình nạp ván đấu"
    ):
        st.session_state.online_pgn_bytes = None
        st.session_state.online_pgn_name = ""
        st.session_state.cached_fen_map = {}
        st.session_state.cached_fen_map_white = {}
        st.session_state.cached_fen_map_black = {}
        st.session_state.analysis_color_filter = "all"
        st.session_state.cached_stats = {}
        st.session_state.cached_repertoire = {}
        st.session_state.cached_filtered_games = []
        st.session_state.cached_move_evaluations = None
        st.session_state.cached_deep_profile = None
        st.session_state.chess_board.reset()
        st.session_state.move_history = []
        st.session_state.full_analysis_line = []
        st.session_state.active_nav_page = "Import"
        st.cache_data.clear()
        st.toast("Đã xóa sạch cache dữ liệu!", icon="🗑️")
        st.rerun()

    # Sidebar Bottom Context: CURRENT OPPONENT
    active_bytes = st.session_state.online_pgn_bytes
    active_name = st.session_state.online_pgn_name
    selected_player = None

    if active_bytes is not None:
        try:
            all_games = cached_parse_pgn(active_bytes)
            players_dict = extract_players(all_games)

            if players_dict:
                player_options = list(players_dict.keys())
                primary_player = detect_primary_player(all_games)
                default_index = (
                    player_options.index(primary_player)
                    if primary_player in player_options
                    else 0
                )

                st.markdown("<div style='font-size:11px; font-weight:800; color:#94A3B8; letter-spacing:0.8px; text-transform:uppercase;'>KỲ THỦ ĐANG PHÂN TÍCH</div>", unsafe_allow_html=True)
                
                selected_player = st.selectbox(
                    "Chọn kỳ thủ",
                    options=player_options,
                    index=default_index,
                    help="Chọn kỳ thủ để phân tích (bản thân, học viên hoặc đối thủ)",
                    key="sidebar_global_player_select",
                    label_visibility="collapsed"
                )

                if st.session_state.last_selected_player != selected_player or not st.session_state.cached_fen_map:
                    st.session_state.last_selected_player = selected_player
                    reset_to_first()

                    filtered_games = filter_games_by_player(all_games, selected_player)
                    st.session_state.cached_filtered_games = filtered_games

                    stats = calculate_game_stats(filtered_games)
                    st.session_state.cached_stats = stats

                    _, fen_map_all = build_opening_tree(filtered_games, color="all")
                    _, fen_map_white = build_opening_tree(filtered_games, color="white")
                    _, fen_map_black = build_opening_tree(filtered_games, color="black")
                    st.session_state.cached_fen_map = fen_map_all
                    st.session_state.cached_fen_map_white = fen_map_white
                    st.session_state.cached_fen_map_black = fen_map_black

                    repertoire_data = analyze_opening_repertoire(filtered_games)
                    st.session_state.cached_repertoire = repertoire_data

                    # Pre-compute comprehensive evaluations (embedded PGN evals or parallel Stockfish)
                    st.session_state.cached_move_evaluations = None
                    if filtered_games:
                        comp_res = get_comprehensive_move_evaluations(filtered_games, depth=6, max_stockfish_games=10)
                        if comp_res.get("available"):
                            st.session_state.cached_move_evaluations = comp_res.get("move_evaluations", [])

                    # Pre-compute Deep Profile & store in session state for instant load
                    st.session_state.cached_deep_profile = generate_deep_opponent_profile(
                        filtered_games,
                        stats,
                        move_evaluations=st.session_state.cached_move_evaluations
                    )

                st.caption(f"📊 {len(st.session_state.cached_filtered_games)} ván đấu đã phân tích")
        except Exception:
            pass


# RENDER ACTIVE PAGE VIEW
active_page = st.session_state.active_nav_page

# Tự động xóa lịch sử ván đấu & reset bàn cờ khi chuyển giữa các trang khác nhau
if "previous_nav_page" not in st.session_state:
    st.session_state.previous_nav_page = active_page

if active_page != st.session_state.previous_nav_page:
    if not st.session_state.get("skip_board_reset_on_nav", False):
        st.session_state.chess_board.reset()
        st.session_state.move_history = []
        st.session_state.full_analysis_line = []
        st.session_state.last_board_timestamp = 0
        if active_page != "Analyze":
            st.session_state.selected_structure = None
            st.session_state.structure_games = []
            st.session_state.selected_structure_game = None

    st.session_state.skip_board_reset_on_nav = False
    st.session_state.previous_nav_page = active_page

# ==============================================================================
# VIEW 01: DASHBOARD PAGE
# ==============================================================================
if active_page == "Dashboard":
    PageHeader("Tổng quan", "Bảng điều khiển tổng quan hiệu suất và chỉ số trọng yếu của kỳ thủ")

    if not active_bytes or not selected_player or not st.session_state.cached_stats:
        def on_import_click():
            st.session_state.active_nav_page = "Import"
            st.rerun()

        EmptyState(
            title="Chưa có dữ liệu ván đấu",
            description="Vui lòng tải lên file PGN hoặc nạp từ Lichess/Chess.com qua tab 'Nạp Ván đấu'.",
            icon="♟️",
            cta_label="Nạp dữ liệu ngay",
            cta_key="dash_empty_cta",
            on_cta_click=on_import_click
        )
    else:
        stats = st.session_state.cached_stats
        repertoire = st.session_state.cached_repertoire

        # 1. HERO BANNER
        with st.container(border=True):
            st.markdown(f"""
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; padding: 2px 0;">
                <div>
                    <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.8px; color: var(--text-muted); text-transform: uppercase;">
                        CHESS PLAYER ANALYTICS
                    </div>
                    <div style="font-size: 22px; font-weight: 800; color: var(--text-primary); margin-top: 4px;">
                        Kỳ thủ: {selected_player}
                    </div>
                    <div style="font-size: 13px; color: var(--text-secondary); margin-top: 2px;">
                        Tổng số ván đã phân tích: <strong style="color:var(--text-primary);">{stats['total_games']}</strong> ván đấu
                    </div>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                    <div style="background: #F8FAFC; border: 1px solid var(--border); border-radius: 8px; padding: 6px 14px; font-size: 12.5px; color: var(--text-secondary);">
                        Hiệu suất: <b style="color: var(--primary);">{stats['score_percentage']}%</b>
                    </div>
                    <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 6px 14px; font-size: 12.5px; color: #059669;">
                        Tỉ lệ thắng: <b>{stats['win_rate']}%</b>
                    </div>
                </div>
            </div>
            """, unsafe_allow_html=True) 

        st.markdown("<div style='margin-bottom:16px;'></div>", unsafe_allow_html=True)

        # 2. 5 KPI CARDS
        k1, k2, k3, k4, k5 = st.columns(5)
        with k1:
            MetricCard("Tổng ván", stats["total_games"], subtext="100% ván", badge_type="neutral")
        with k2:
            MetricCard("Điểm số", f"{stats['score_percentage']}%", subtext="Hiệu suất chung", badge_type="primary")
        with k3:
            MetricCard("Thắng", stats["wins"], subtext=f"{stats['win_rate']}%", badge_type="success")
        with k4:
            MetricCard("Hòa", stats["draws"], subtext=f"{stats['draw_rate']}%", badge_type="warning")
        with k5:
            MetricCard("Thua", stats["losses"], subtext=f"{stats['loss_rate']}%", badge_type="danger")

        st.markdown("<div style='margin-bottom:20px;'></div>", unsafe_allow_html=True)

        # 3. KEY INSIGHTS (4 CARDS GRID)
        st.markdown("<div style='font-size:18px; font-weight:800; color:var(--text-primary); margin-bottom:12px;'>Nhận Định Chiến Thuật Nổi Bật</div>", unsafe_allow_html=True)
        
        most_played = repertoire.get("most_played", [])
        best_scoring = repertoire.get("best_scoring", [])
        worst_scoring = repertoire.get("worst_scoring", [])

        fav_op = most_played[0]['name'] if most_played else "N/A"
        fav_desc = f"{most_played[0]['games_count']} ván - Score {most_played[0]['score_pct']}%" if most_played else "Chưa có dữ liệu"

        strong_op = best_scoring[0]['name'] if best_scoring else "N/A"
        strong_desc = f"Score cao nhất {best_scoring[0]['score_pct']}% ({best_scoring[0]['games_count']} ván)" if best_scoring else "Chưa có dữ liệu"

        weak_op = worst_scoring[0]['name'] if worst_scoring else "N/A"
        weak_desc = f"Score thấp nhất {worst_scoring[0]['score_pct']}% ({worst_scoring[0]['games_count']} ván)" if worst_scoring else "Chưa có dữ liệu"

        prep_desc = "Tư vấn chiến lược & Lộ trình rèn luyện AI"

        ic1, ic2, ic3, ic4 = st.columns(4)
        with ic1:
            InsightCard("🌿", "Khai cuộc chơi nhiều nhất", f"<b>{fav_op}</b><br>{fav_desc}")
        with ic2:
            InsightCard("⚔️", "Vũ khí mạnh nhất", f"<b>{strong_op}</b><br>{strong_desc}")
        with ic3:
            InsightCard("📊", "Điểm yếu tiềm tàng", f"<b>{weak_op}</b><br>{weak_desc}")
        with ic4:
            InsightCard("🧠", "Trợ lí AI Chiến lược", f"<b>Phân tích & Huấn luyện</b><br>{prep_desc}")

        st.markdown("<div style='margin-bottom:20px;'></div>", unsafe_allow_html=True)

        # 4. DASHBOARD CHARTS (Opening Overview & Performance by Color)
        c_left, c_right = st.columns(2)
        with c_left:
            with st.container(border=True):
                st.subheader('Tổng quan Khai cuộc')
                if most_played:
                    op_names = [op['name'][:22] for op in most_played[:5]]
                    op_counts = [op['games_count'] for op in most_played[:5]]
                    fig_op = px.bar(
                        x=op_counts,
                        y=op_names,
                        orientation='h',
                        labels={'x': 'Số ván', 'y': 'Khai cuộc'},
                        color_discrete_sequence=['#10B981']
                    )
                    fig_op.update_layout(
                        height=260,
                        margin=dict(l=10, r=10, t=10, b=10),
                        paper_bgcolor='rgba(0,0,0,0)',
                        plot_bgcolor='rgba(0,0,0,0)',
                        font=dict(family='Inter', color='#0F172A'),
                        yaxis=dict(autorange="reversed")
                    )
                    st.plotly_chart(fig_op, use_container_width=True)
                else:
                    st.info("Chưa có thông tin khai cuộc.")

        with c_right:
            with st.container(border=True):
                st.subheader("Hiệu suất theo Màu quân")
                fig_perf = go.Figure(data=[
                    go.Bar(name='Thắng', x=['Trắng', 'Đen'], y=[stats['white_wins'], stats['black_wins']], marker_color=COLOR_WIN),
                    go.Bar(name='Hòa', x=['Trắng', 'Đen'], y=[stats['white_draws'], stats['black_draws']], marker_color=COLOR_DRAW),
                    go.Bar(name='Thua', x=['Trắng', 'Đen'], y=[stats['white_losses'], stats['black_losses']], marker_color=COLOR_LOSS)
                ])
                fig_perf.update_layout(
                    barmode='group',
                    height=260,
                    margin=dict(l=10, r=10, t=10, b=10),
                    paper_bgcolor='rgba(0,0,0,0)',
                    plot_bgcolor='rgba(0,0,0,0)',
                    font=dict(family='Inter', color='#0F172A')
                )
                st.plotly_chart(fig_perf, use_container_width=True)

        st.markdown("<div style='margin-bottom:24px;'></div>", unsafe_allow_html=True)

        # 5. QUICK ACTIONS
        st.markdown("### Truy cập nhanh tính năng")
        qa1, qa2, qa3, qa4 = st.columns(4)

        with qa1:
            if st.button("Phân tích Ván đấu →", use_container_width=True, key="qa_analyze"):
                st.session_state.active_nav_page = "Analyze"
                st.rerun()

        with qa2:
            if st.button("Hồ sơ & Phong độ →", use_container_width=True, key="qa_profile"):
                st.session_state.active_nav_page = "Profile"
                st.rerun()

        with qa3:
            if st.button("Trợ lí AI →", use_container_width=True, key="qa_ai", type="primary"):
                st.session_state.active_nav_page = "AIAssistant"
                st.rerun()

        with qa4:
            if st.button("Nạp Ván đấu →", use_container_width=True, key="qa_import"):
                st.session_state.active_nav_page = "Import"
                st.rerun()


# ==============================================================================
# VIEW 02: ANALYZE GAMES PAGE
# ==============================================================================
elif active_page == "Analyze":
    PageHeader("Phân tích Ván đấu", "Khám phá cây khai cuộc trực quan và duyệt qua từng nước đi")

    if not active_bytes or not selected_player or not st.session_state.cached_fen_map:
        st.info("Vui lòng nạp dữ liệu ván đấu để sử dụng bàn cờ phân tích.")
        if st.button("🚀 Nạp dữ liệu ngay", type="primary", use_container_width=True, key="an_empty_cta"):
            st.session_state.active_nav_page = "Import"
            st.rerun()
    else:
        # MODE B: STRUCTURE EXPLORER HEADER BANNER
        if st.session_state.selected_structure is not None:
            struct_name = st.session_state.selected_structure
            struct_games = st.session_state.structure_games or []

            with st.container(border=True):
                head_col1, head_col2 = st.columns([4.5, 1.5])
                with head_col1:
                    st.markdown(f"### 🧩 STRUCTURE EXPLORER: **{struct_name}**")
                    st.caption(f"Đang xem **{len(struct_games)}** ván đấu thực tế có cấu trúc Tốt này (Move 8–15).")
                with head_col2:
                    if st.button("⬅️ Trở về Phân tích Thường", use_container_width=True, key="btn_exit_struct_explorer"):
                        st.session_state.selected_structure = None
                        st.session_state.structure_games = []
                        st.session_state.selected_structure_game = None
                        st.rerun()

            st.markdown("<div style='margin-bottom:12px;'></div>", unsafe_allow_html=True)

        # Render Interactive Chessboard & Move History
        render_analysis_section(st.session_state.cached_fen_map, selected_player)

        # MODE B: STRUCTURE GAMES LIST PANEL
        if st.session_state.selected_structure is not None:
            st.markdown("<div style='margin-top:20px;'></div>", unsafe_allow_html=True)
            struct_name = st.session_state.selected_structure
            struct_games = st.session_state.structure_games or []

            with st.container(border=True):
                st.markdown(f"### 📋 Danh sách ván đấu có cấu trúc **{struct_name}** ({len(struct_games)} ván)")

                filter_opts = {
                    "All": "Tất cả",
                    "Wins": "Ván Thắng",
                    "Draws": "Ván Hòa",
                    "Losses": "Ván Thua",
                }

                selected_filter = st.radio(
                    "Lọc kết quả ván đấu:",
                    options=list(filter_opts.keys()),
                    format_func=lambda x: filter_opts[x],
                    horizontal=True,
                    key="struct_games_filter_radio"
                )

                filtered_struct_games = []
                for g in struct_games:
                    if selected_filter == "Wins" and not g.get("is_win"):
                        continue
                    if selected_filter == "Draws" and not g.get("is_draw"):
                        continue
                    if selected_filter == "Losses" and not g.get("is_loss"):
                        continue
                    filtered_struct_games.append(g)

                st.markdown("<hr style='margin:8px 0 12px 0; border:0; border-top:1px solid #E2E8F0;'>", unsafe_allow_html=True)

                if not filtered_struct_games:
                    st.info("Không có ván đấu nào khớp với bộ lọc.")
                else:
                    gh1, gh2, gh3, gh4 = st.columns([4, 3, 2, 2])
                    gh1.markdown("**Trắng vs Đen**")
                    gh2.markdown("**Khai cuộc / Kết quả**")
                    gh3.markdown("**Hình thành**")
                    gh4.markdown("**Thao tác**")

                    st.markdown("<hr style='margin:4px 0 8px 0; border:0; border-top:1px solid #E2E8F0;'>", unsafe_allow_html=True)

                    for idx, g_info in enumerate(filtered_struct_games):
                        gc1, gc2, gc3, gc4 = st.columns([4, 3, 2, 2])
                        g_idx = g_info.get("game_index", idx)
                        form_move = g_info.get("formation_move", "?")
                        w_name = g_info.get("white", "White")
                        b_name = g_info.get("black", "Black")
                        res = g_info.get("result", "*")
                        op_name = g_info.get("opening", "Unknown Opening")

                        if g_info.get("is_win"):
                            res_badge = f"<span style='color:{COLOR_WIN}; font-weight:700;'>{res} (Thắng)</span>"
                        elif g_info.get("is_draw"):
                            res_badge = f"<span style='color:{COLOR_DRAW}; font-weight:700;'>{res} (Hòa)</span>"
                        elif g_info.get("is_loss"):
                            res_badge = f"<span style='color:{COLOR_LOSS}; font-weight:700;'>{res} (Thua)</span>"
                        else:
                            res_badge = f"<span>{res}</span>"

                        with gc1:
                            st.markdown(f"**Game #{g_idx + 1}**: ⚪ {w_name} vs ⚫ {b_name}")
                        with gc2:
                            st.markdown(f"{op_name}<br>{res_badge}", unsafe_allow_html=True)
                        with gc3:
                            st.markdown(f"<div style='padding-top:4px;'>Move {form_move}</div>", unsafe_allow_html=True)
                        with gc4:
                            is_current = (st.session_state.selected_structure_game == g_idx)
                            btn_label = "✅ Đang xem" if is_current else "👁️ Xem ván"
                            if st.button(
                                btn_label,
                                key=f"btn_view_struct_game_{idx}_{g_idx}",
                                use_container_width=True,
                                disabled=is_current
                            ):
                                all_games = st.session_state.cached_filtered_games
                                if 0 <= g_idx < len(all_games):
                                    target_game = all_games[g_idx]
                                    load_single_game_onto_board(target_game)
                                    st.session_state.selected_structure_game = g_idx
                                    st.rerun()


# ==============================================================================
# VIEW 03: PLAYER PROFILE & DEEP ANALYTICS PAGE
# ==============================================================================
elif active_page in ["Profile", "Performance"]:
    PageHeader("Hồ sơ & Phong độ", "Hồ sơ phong cách chơi, cấu trúc Tốt và phân tích độ chính xác theo từng giai đoạn của kỳ thủ")

    if not active_bytes or not selected_player or not st.session_state.cached_stats:
        st.info("Vui lòng nạp dữ liệu ván đấu để xem Hồ sơ & Phong độ kỳ thủ.")
        if st.button("🚀 Nạp Dữ Liệu Ngay", type="primary", use_container_width=True, key="prof_empty_cta"):
            st.session_state.active_nav_page = "Import"
            st.rerun()
    else:
        filtered_games = st.session_state.cached_filtered_games or []
        stats = st.session_state.cached_stats or {}
        engine = get_stockfish_engine()

        # Automatic Stockfish engine execution if evaluations are not yet cached
        if st.session_state.cached_move_evaluations is None and engine.is_available() and filtered_games:
            batch_res = get_comprehensive_move_evaluations(filtered_games, depth=6, max_stockfish_games=10)
            if batch_res.get("available"):
                st.session_state.cached_move_evaluations = batch_res.get("move_evaluations", [])
                st.session_state.cached_deep_profile = None

        # Retrieve or refresh cached deep profile
        is_stale_profile = False
        if st.session_state.cached_deep_profile:
            structs_check = st.session_state.cached_deep_profile.get("structures", {}).get("structures", [])
            if structs_check and "games" not in structs_check[0]:
                is_stale_profile = True
            style_prof_check = st.session_state.cached_deep_profile.get("style_profile", {})
            if "dominant_structure" not in style_prof_check or any("bán mở" in str(ev).lower() for ev in style_prof_check.get("evidence", [])):
                is_stale_profile = True

        if st.session_state.cached_deep_profile is None or is_stale_profile:
            st.session_state.cached_deep_profile = generate_deep_opponent_profile(
                st.session_state.cached_filtered_games,
                stats,
                move_evaluations=st.session_state.cached_move_evaluations
            )

        deep_profile = st.session_state.cached_deep_profile

        # 1. Header Card & Engine Status
        head_col1, head_col2 = st.columns([3, 1])
        with head_col1:
            with st.container(border=True):
                st.markdown(f"### ♟ {selected_player}")
                st.caption(f"Đã phân tích **{stats['total_games']}** ván đấu • Score tổng thể: **{stats['score_percentage']}%**")
        with head_col2:
            with st.container(border=True):
                if engine.is_available():
                    st.success("🟢 Stockfish Active (Depth 6)", icon="🤖")
                    st.caption("Đã tự động phân tích thế cờ ở nền.")
                else:
                    st.warning("⚠️ Engine Unavailable", icon="🤖")
                    st.caption("Chi tiết thống kê cơ bản vẫn hiển thị đầy đủ.")

        st.markdown("<div style='margin-bottom:16px;'></div>", unsafe_allow_html=True)

        # 2. Performance 4 KPI Metrics
        pm1, pm2, pm3, pm4 = st.columns(4)
        pm1.metric("Tỷ lệ Thắng", f"{stats['win_rate']}%", f"{stats['wins']} Thắng")
        pm2.metric("Tỷ lệ Hòa", f"{stats['draw_rate']}%", f"{stats['draws']} Hòa")
        pm3.metric("Tỷ lệ Thua", f"{stats['loss_rate']}%", f"{stats['losses']} Thua", delta_color="inverse")
        pm4.metric("Điểm số Tổng thể", f"{stats['score_percentage']}%", f"{stats['total_games']} Tổng số ván")

        st.markdown("<div style='margin-bottom:20px;'></div>", unsafe_allow_html=True)

        # 3. Performance Charts
        col_left, col_right = st.columns(2)
        with col_left:
            with st.container(border=True):
                st.markdown("##### Performance theo Màu quân")
                colors_fig = go.Figure(data=[
                    go.Bar(name='Thắng', x=['Trắng', 'Đen'], y=[stats['white_wins'], stats['black_wins']], marker_color=COLOR_WIN),
                    go.Bar(name='Hòa', x=['Trắng', 'Đen'], y=[stats['white_draws'], stats['black_draws']], marker_color=COLOR_DRAW),
                    go.Bar(name='Thua', x=['Trắng', 'Đen'], y=[stats['white_losses'], stats['black_losses']], marker_color=COLOR_LOSS)
                ])
                colors_fig.update_layout(
                    barmode='group',
                    height=240,
                    margin=dict(l=10, r=10, t=30, b=10),
                    paper_bgcolor='rgba(0,0,0,0)',
                    plot_bgcolor='rgba(0,0,0,0)',
                    font=dict(family='Inter', color='#0F172A')
                )
                st.plotly_chart(colors_fig, use_container_width=True)

        with col_right:
            with st.container(border=True):
                st.markdown("##### Tỷ lệ Kết quả Ván đấu")
                donut_fig = go.Figure(data=[go.Pie(
                    labels=['Thắng', 'Hòa', 'Thua'],
                    values=[stats['wins'], stats['draws'], stats['losses']],
                    hole=.4,
                    marker_colors=[COLOR_WIN, COLOR_DRAW, COLOR_LOSS],
                    textinfo='label+percent+value'
                )])
                donut_fig.update_layout(
                    height=240,
                    margin=dict(l=10, r=10, t=30, b=10),
                    paper_bgcolor='rgba(0,0,0,0)',
                    plot_bgcolor='rgba(0,0,0,0)',
                    font=dict(family='Inter', color='#0F172A')
                )
                st.plotly_chart(donut_fig, use_container_width=True)

        st.markdown("<div style='margin-bottom:20px;'></div>", unsafe_allow_html=True)
        st.markdown("### 🧩 Hiệu Suất Theo Cấu Trúc Tốt (Pawn Structure Performance)")
        struct_list = deep_profile.get("structures", {}).get("structures", [])
        if struct_list:
            with st.container(border=True):
                sh1, sh2, sh3, sh4, sh5, sh6 = st.columns([3.6, 1.0, 1.8, 1.4, 2.4, 1.8])
                sh1.markdown("**Cấu trúc Tốt**")
                sh2.markdown("**Số ván**")
                sh3.markdown("**W / D / L**")
                sh4.markdown("**Raw %**")
                sh5.markdown("**Độ tin cậy**", help="Chỉ số hiệu chỉnh Bayesian: Triệt tiêu sai lệch khi số lượng ván đấu còn ít (kéo điểm về mức phong độ trung bình). Phần trăm trong ngoặc là độ lệch (+/-) so với trung bình, kèm nhãn đánh giá độ tin cậy.")
                sh6.markdown("**Thao tác**")

                st.markdown("<hr style='margin:4px 0 8px 0; border:0; border-top:1px solid #E2E8F0;'>", unsafe_allow_html=True)

                for idx, item in enumerate(struct_list):
                    s1, s2, s3, s4, s5, s6 = st.columns([3.6, 1.0, 1.8, 1.4, 2.4, 1.8])
                    typ_move = item.get("typical_formation_move", 12)
                    raw_s = item.get("score_pct", 0.0)
                    adj_s = item.get("adjusted_score_pct", raw_s)
                    delta = item.get("delta_vs_baseline", 0.0)
                    delta_str = f"+{delta}%" if delta > 0 else f"{delta}%"
                    delta_color = "#22C55E" if delta > 0 else ("#EF4444" if delta < 0 else "#94A3B8")
                    badge = item.get("assessment_badge", "")
                    badge_color = item.get("assessment_color", "#94A3B8")

                    with s1:
                        st.markdown(f"**🧩 {item['name']}**")
                        st.caption(f"Move {typ_move}")
                    with s2:
                        st.markdown(f"<div style='padding-top:8px; color:#475569;'>{item['games_count']} ván</div>", unsafe_allow_html=True)
                    with s3:
                        st.markdown(f"<div style='padding-top:8px;'><span style='color:#22C55E; font-weight:600;'>{item['wins']}</span>/<span style='color:#94A3B8;'>{item['draws']}</span>/<span style='color:#EF4444; font-weight:600;'>{item['losses']}</span></div>", unsafe_allow_html=True)
                    with s4:
                        st.markdown(f"<div style='padding-top:8px; font-weight:700; color:#1E293B;'>{raw_s}%</div>", unsafe_allow_html=True)
                    with s5:
                        st.markdown(f"<div style='padding-top:4px;'><span style='font-weight:700; color:#4F46E5;'>{adj_s}%</span> <span style='font-size:11px; color:{delta_color}; font-weight:600;'>({delta_str})</span><br><span style='font-size:11.5px; font-weight:600; color:{badge_color};'>{badge}</span></div>", unsafe_allow_html=True)
                    with s6:
                        if st.button(
                            "🔍 Khám phá",
                            key=f"prof_struct_btn_{idx}_{item['name']}",
                            help=f"Bấm để mở Structure Explorer cho {item['name']}",
                            use_container_width=True
                        ):
                            load_pawn_structure_onto_board(item)
        else:
            st.info("Chưa phát hiện cấu trúc Tốt đặc trưng.")

        st.markdown("<div style='margin-bottom:20px;'></div>", unsafe_allow_html=True)

        # 5. PHASE ACCURACY TABLE (Khai cuộc, Trung cuộc, Tàn cuộc - Dynamic Phase Detection)
        has_engine = deep_profile.get("has_engine_data", False)
        phases_info = deep_profile.get("phases", {}).get("phases", {})
        
        phase_names_map = {
            "opening": ("♟ Khai cuộc", "Opening", "Phát triển quân nhẹ"),
            "middlegame": ("⚔️ Trung cuộc", "Middlegame", "Chiến thuật & Thế trận"),
            "endgame": ("🏆 Tàn cuộc", "Endgame", "Lực lượng tinh giản"),
        }

        with st.container(border=True):
            st.markdown("### 📊 Độ Chính Xác Từng Giai Đoạn (Phase Accuracy Analysis)")
            if not has_engine:
                st.info("💡 Chưa có dữ liệu phân tích từ Stockfish Engine. Hệ thống đang hiển thị thống kê đếm số nước đi phân loại theo từng giai đoạn động:")

            # Table Header
            h1, h2, h3, h4, h5 = st.columns([3.0, 1.8, 1.8, 3.2, 2.2])
            h1.markdown("**Giai đoạn (Phase)**")
            h2.markdown("**Số ván**")
            h3.markdown("**Số nước**")
            h4.markdown("**Tỷ lệ Chính xác**", help="Tỷ lệ phần trăm nước đi tốt/tối ưu được tính bởi Stockfish Engine")
            h5.markdown("**Đánh giá**")

            st.markdown("<hr style='margin:4px 0 8px 0; border:0; border-top:1px solid #E2E8F0;'>", unsafe_allow_html=True)

            for phase_key in ["opening", "middlegame", "endgame"]:
                p_data = phases_info.get(phase_key, {})
                vi_title, en_title, move_range = phase_names_map[phase_key]
                title_label = vi_title

                acc_val = p_data.get("accuracy") or p_data.get("accuracy_pct")
                games_cnt = p_data.get("games_count", 0)
                moves_cnt = p_data.get("analyzed_moves", p_data.get("moves_count", 0))

                if has_engine and acc_val is not None:
                    acc_str = f"{acc_val}%"
                    if acc_val >= 88.0:
                        color = "#22C55E"
                        status = "Xuất sắc"
                    elif acc_val >= 75.0:
                        color = "#10B981"
                        status = "Ổn định"
                    elif acc_val >= 60.0:
                        color = "#F59E0B"
                        status = "Trung bình"
                    else:
                        color = "#EF4444"
                        status = "Cần cải thiện"
                else:
                    acc_str = "N/A"
                    color = "#64748B"
                    status = "Chờ Stockfish"

                p1, p2, p3, p4, p5 = st.columns([3.0, 1.8, 1.8, 3.2, 2.2])
                with p1:
                    st.markdown(f"**{title_label}**  \n<span style='font-size:11px; color:#64748B;'>{move_range}</span>", unsafe_allow_html=True)
                with p2:
                    st.markdown(f"<div style='padding-top:6px; color:#475569;'>{games_cnt} ván</div>", unsafe_allow_html=True)
                with p3:
                    st.markdown(f"<div style='padding-top:6px; font-weight:600;'>{moves_cnt}</div>", unsafe_allow_html=True)
                with p4:
                    if has_engine and acc_val is not None:
                        st.markdown(f"<div style='font-size:15px; font-weight:800; color:{color};'>{acc_str}</div>", unsafe_allow_html=True)
                        st.progress(float(acc_val) / 100.0)
                    else:
                        st.markdown("<div style='color:#94A3B8; font-weight:600; padding-top:4px;'>N/A</div>", unsafe_allow_html=True)
                with p5:
                    st.markdown(f"<div style='padding-top:6px; font-weight:700; color:{color};'>{status}</div>", unsafe_allow_html=True)

                st.markdown("<div style='margin-bottom:6px;'></div>", unsafe_allow_html=True)

            # Check coverage of evaluated games and provide On-Demand Deep Analysis button
            total_filtered_games_count = len(filtered_games)
            analyzed_indices = set(e["game_index"] for e in (st.session_state.cached_move_evaluations or []) if "game_index" in e)
            analyzed_games_count = len(analyzed_indices)

            st.markdown("<hr style='margin:12px 0 10px 0; border:0; border-top:1px dashed #E2E8F0;'>", unsafe_allow_html=True)
            
            if total_filtered_games_count > analyzed_games_count and total_filtered_games_count > 0:
                dc1, dc2 = st.columns([7, 3])
                with dc1:
                    st.markdown(
                        f"**🔬 Phân tích Chuyên sâu Toàn bộ**  \n"
                        f"<span style='font-size:12.5px; color:#64748B;'>"
                        f"Đang hiển thị mẫu từ **{analyzed_games_count}/{total_filtered_games_count} ván**. Bấm nút để kích hoạt cụm Stockfish đa luồng phân tích toàn bộ 100% {total_filtered_games_count} ván:"
                        f"</span>",
                        unsafe_allow_html=True
                    )
                with dc2:
                    if st.button(
                        f"🚀 Phân tích {total_filtered_games_count} ván",
                        type="primary",
                        use_container_width=True,
                        key="phase_deep_scan_btn"
                    ):
                        init_pct = float(analyzed_games_count) / max(1, total_filtered_games_count) * 0.92
                        progress_bar = st.progress(init_pct, text=f"Đang phân tích {analyzed_games_count}/{total_filtered_games_count} ván...")
                        def _on_prog(cur, tot):
                            overall_done = analyzed_games_count + cur
                            pct = min(0.92, float(overall_done) / max(1, total_filtered_games_count) * 0.92)
                            progress_bar.progress(pct, text=f"Đang phân tích ván {overall_done}/{total_filtered_games_count}...")

                        deep_eval_res = parallel_batch_analyze_games(
                            filtered_games,
                            depth=6,
                            max_games=total_filtered_games_count,
                            progress_callback=_on_prog,
                            existing_evaluations=st.session_state.cached_move_evaluations
                        )
                        progress_bar.progress(0.95, text="⚡ Đang tính toán Hồ sơ Phong cách & Cấu trúc Tốt...")
                        st.session_state.cached_move_evaluations = deep_eval_res.get("move_evaluations", [])
                        st.session_state.cached_deep_profile = generate_deep_opponent_profile(
                            filtered_games,
                            stats,
                            move_evaluations=st.session_state.cached_move_evaluations
                        )
                        progress_bar.progress(1.0, text="✅ Hoàn tất 100%! Đang tải giao diện mới...")
                        st.rerun()
            else:
                st.caption(f"✅ Đã phân tích toàn diện 100% dữ liệu ({total_filtered_games_count}/{total_filtered_games_count} ván đấu)")

        st.markdown("<div style='margin-bottom:20px;'></div>", unsafe_allow_html=True)

        # 6. PLAYING STYLE PROFILE & BEHAVIORAL INDICATORS
        style_prof = deep_profile.get("style_profile", {})
        raw_m = style_prof.get("raw_metrics", {})
        evidence_list = style_prof.get("evidence", [])

        with st.container(border=True):
            st.markdown("### 🏆 Hồ Sơ Phong Cách Thi Đấu (Playing Style Profile)")
            st.caption("Hệ thống phân loại phong cách đa chiều từ dữ liệu thế cờ & đánh giá nước đi")

            if total_filtered_games_count > analyzed_games_count and total_filtered_games_count > 0:
                st.warning(
                    f"⚠️ **Độ tin cậy thấp (Dữ liệu mẫu: {analyzed_games_count}/{total_filtered_games_count} ván)**: "
                    f"Các chỉ số phong cách và bằng chứng hành vi bên dưới hiện tại chỉ được ước tính dựa trên {analyzed_games_count} ván có đánh giá Stockfish. "
                    f"Hãy bấm **'Phân tích {total_filtered_games_count} ván'** ở trên để có hồ sơ phong cách chuẩn xác 100%."
                )
            else:
                st.success(
                    f"✅ **Độ tin cậy cao**: Đã phân tích toàn bộ 100% dữ liệu ({total_filtered_games_count}/{total_filtered_games_count} ván đấu) bằng Stockfish."
                )

            st.markdown("<div style='margin-bottom:12px;'></div>", unsafe_allow_html=True)

            # Style Dimension Bars & Style Evidence
            dim_col1, dim_col2 = st.columns(2)

            with dim_col1:
                st.markdown("**Các Chiều Phong Cách Thực Chiến**")
                # Xác định thế trận thường dùng (tỉ lệ cao nhất giữa cờ kín, nửa mở và mở)
                dom_name = raw_m.get("dominant_structure")
                dom_pct = raw_m.get("dominant_structure_pct")
                if not dom_name or dom_pct is None:
                    open_p = raw_m.get("open_preference", 33.3)
                    semi_p = raw_m.get("semi_open_preference", 33.3)
                    closed_p = raw_m.get("closed_preference", 33.4)
                    struct_candidates = [
                        ("Cờ kín", closed_p),
                        ("Cờ nửa mở", semi_p),
                        ("Cờ mở", open_p),
                    ]
                    dom_name, dom_pct = max(struct_candidates, key=lambda x: x[1])

                dim_items = [
                    ("Độ biến động thế cờ", raw_m.get("volatility_score", 50.0), "/ 100", None),
                    ("Tần suất thí quân", raw_m.get("sacrifice_rate", 0.0), "%", None),
                    ("Xu hướng đơn giản hóa", raw_m.get("simplification_rate", 0.0), "%", None),
                    ("Khả năng lật kèo", raw_m.get("resilience_rate", 50.0), "%", None),
                    ("Thế trận thường dùng", dom_pct, "%", dom_name),
                ]
                for d_label, d_val, unit, tag in dim_items:
                    d_c1, d_c2 = st.columns([6, 2.5])
                    tag_html = f" <span style='font-size:11px; font-weight:600; color:#4F46E5; background:#EEF2FF; padding:1px 6px; border-radius:4px;'>{tag}</span>" if tag else ""
                    d_c1.markdown(f"<span style='font-size:12.5px; font-weight:600;'>{d_label}</span>{tag_html}", unsafe_allow_html=True)
                    d_c2.markdown(f"<span style='font-size:12.5px; font-weight:800; color:#4F46E5;'>{d_val} {unit}</span>", unsafe_allow_html=True)
                    prog_val = max(0.0, min(1.0, float(d_val) / 100.0))
                    st.progress(prog_val)

            with dim_col2:
                st.markdown("**Bằng Chứng Hành Vi Cụ Thể**")
                if evidence_list:
                    for ev_item in evidence_list:
                        clean_ev = str(ev_item).replace("bán mở", "nửa mở").replace("Bán mở", "Nửa mở")
                        st.markdown(f"• <span style='font-size:13px; color:#334155; line-height:1.5;'>{clean_ev}</span>", unsafe_allow_html=True)
                else:
                    st.caption("Chưa có đủ dữ liệu để trích xuất bằng chứng.")

                st.markdown("<div style='margin-bottom:10px;'></div>", unsafe_allow_html=True)

        st.markdown("<div style='margin-bottom:20px;'></div>", unsafe_allow_html=True)

        # 7. Repertoire Tables
        st.markdown("### 📚 Danh mục Khai cuộc (Opening Repertoire)")
        c_white, c_black = st.columns(2)
        with c_white:
            with st.container(border=True):
                st.markdown("##### Repertoire cầm Trắng")
                w_rep = deep_profile["repertoire"].get("white_repertoire", [])
                if w_rep:
                    wh1, wh2, wh3, wh4, wh5 = st.columns([4.8, 1.0, 1.8, 1.4, 2.6])
                    wh1.markdown("**Khai cuộc**")
                    wh2.markdown("**Ván**")
                    wh3.markdown("**W/D/L**")
                    wh4.markdown("**Raw %**")
                    wh5.markdown("**Độ tin cậy**", help="Chỉ số hiệu chỉnh Bayesian: Triệt tiêu sai lệch khi số lượng ván đấu còn ít (kéo điểm về mức phong độ trung bình). Phần trăm trong ngoặc là độ lệch (+/-) so với trung bình, kèm nhãn đánh giá độ tin cậy.")

                    st.markdown("<hr style='margin:4px 0 8px 0; border:0; border-top:1px solid #E2E8F0;'>", unsafe_allow_html=True)

                    for idx, item in enumerate(w_rep):
                        w1, w2, w3, w4, w5 = st.columns([4.8, 1.0, 1.8, 1.4, 2.6])
                        raw_s = item.get("score_pct", 0.0)
                        adj_s = item.get("adjusted_score_pct", raw_s)
                        delta = item.get("delta_vs_baseline", 0.0)
                        delta_str = f"+{delta}%" if delta > 0 else f"{delta}%"
                        delta_color = "#22C55E" if delta > 0 else ("#EF4444" if delta < 0 else "#94A3B8")
                        badge = item.get("assessment_badge", "")
                        badge_color = item.get("assessment_color", "#94A3B8")

                        with w1:
                            if st.button(
                                f"♟ {item['name']}",
                                key=f"prof_w_op_btn_{idx}_{item['name']}",
                                help=f"Bấm để nạp {item['name']} lên Bàn cờ Phân tích (Cầm Trắng)",
                                use_container_width=True
                            ):
                                load_opening_onto_board(item['name'], st.session_state.cached_filtered_games, color="white")
                        with w2:
                            st.markdown(f"<div style='padding-top:6px; color:#475569;'>{item['games_count']}</div>", unsafe_allow_html=True)
                        with w3:
                            st.markdown(f"<div style='padding-top:6px;'><span style='color:#22C55E; font-weight:600;'>{item['wins']}</span>/<span style='color:#94A3B8;'>{item['draws']}</span>/<span style='color:#EF4444; font-weight:600;'>{item['losses']}</span></div>", unsafe_allow_html=True)
                        with w4:
                            st.markdown(f"<div style='padding-top:6px; font-weight:700; color:#1E293B;'>{raw_s}%</div>", unsafe_allow_html=True)
                        with w5:
                            st.markdown(f"<div style='padding-top:4px;'><span style='font-weight:700; color:#4F46E5;'>{adj_s}%</span> <span style='font-size:10.5px; color:{delta_color}; font-weight:600;'>({delta_str})</span><br><span style='font-size:10.5px; font-weight:600; color:{badge_color};'>{badge}</span></div>", unsafe_allow_html=True)
                else:
                    st.info("Không có dữ liệu khi cầm Trắng.")

        with c_black:
            with st.container(border=True):
                st.markdown("##### Repertoire cầm Đen")
                b_rep = deep_profile["repertoire"].get("black_repertoire", [])
                if b_rep:
                    bh1, bh2, bh3, bh4, bh5 = st.columns([4.8, 1.0, 1.8, 1.4, 2.6])
                    bh1.markdown("**Khai cuộc**")
                    bh2.markdown("**Ván**")
                    bh3.markdown("**W/D/L**")
                    bh4.markdown("**Raw %**")
                    bh5.markdown("**Độ tin cậy**", help="Chỉ số hiệu chỉnh Bayesian: Triệt tiêu sai lệch khi số lượng ván đấu còn ít (kéo điểm về mức phong độ trung bình). Phần trăm trong ngoặc là độ lệch (+/-) so với trung bình, kèm nhãn đánh giá độ tin cậy.")

                    st.markdown("<hr style='margin:4px 0 8px 0; border:0; border-top:1px solid #E2E8F0;'>", unsafe_allow_html=True)

                    for idx, item in enumerate(b_rep):
                        b1, b2, b3, b4, b5 = st.columns([4.8, 1.0, 1.8, 1.4, 2.6])
                        raw_s = item.get("score_pct", 0.0)
                        adj_s = item.get("adjusted_score_pct", raw_s)
                        delta = item.get("delta_vs_baseline", 0.0)
                        delta_str = f"+{delta}%" if delta > 0 else f"{delta}%"
                        delta_color = "#22C55E" if delta > 0 else ("#EF4444" if delta < 0 else "#94A3B8")
                        badge = item.get("assessment_badge", "")
                        badge_color = item.get("assessment_color", "#94A3B8")

                        with b1:
                            if st.button(
                                f"♟ {item['name']}",
                                key=f"prof_b_op_btn_{idx}_{item['name']}",
                                help=f"Bấm để nạp {item['name']} lên Bàn cờ Phân tích (Cầm Đen)",
                                use_container_width=True
                            ):
                                load_opening_onto_board(item['name'], st.session_state.cached_filtered_games, color="black")
                        with b2:
                            st.markdown(f"<div style='padding-top:6px; color:#475569;'>{item['games_count']}</div>", unsafe_allow_html=True)
                        with b3:
                            st.markdown(f"<div style='padding-top:6px;'><span style='color:#22C55E; font-weight:600;'>{item['wins']}</span>/<span style='color:#94A3B8;'>{item['draws']}</span>/<span style='color:#EF4444; font-weight:600;'>{item['losses']}</span></div>", unsafe_allow_html=True)
                        with b4:
                            st.markdown(f"<div style='padding-top:6px; font-weight:700; color:#1E293B;'>{raw_s}%</div>", unsafe_allow_html=True)
                        with b5:
                            st.markdown(f"<div style='padding-top:4px;'><span style='font-weight:700; color:#4F46E5;'>{adj_s}%</span> <span style='font-size:10.5px; color:{delta_color}; font-weight:600;'>({delta_str})</span><br><span style='font-size:10.5px; font-weight:600; color:{badge_color};'>{badge}</span></div>", unsafe_allow_html=True)
                else:
                    st.info("Không có dữ liệu khi cầm Đen.")


# ==============================================================================
# VIEW: AI ASSISTANT PAGE (Trò chuyện trực tiếp & Huấn luyện viên AI)
# ==============================================================================
elif active_page == "AIAssistant":
    PageHeader("Trợ lí AI", "Đại kiện tướng AI tư vấn chiến lược, phân tích chuyên sâu và đồng hành rèn luyện")

    if not active_bytes or not selected_player or not st.session_state.cached_stats:
        def on_import_click():
            st.session_state.active_nav_page = "Import"
            st.rerun()

        EmptyState(
            title="Chưa có dữ liệu kỳ thủ",
            description="Vui lòng nạp ván đấu của kỳ thủ từ PGN, Lichess hoặc Chess.com để bắt đầu trò chuyện với Trợ lí AI.",
            icon="🤖",
            cta_label="Nạp Dữ liệu Ngay",
            cta_key="ai_empty_cta",
            on_cta_click=on_import_click
        )
    else:
        if "ai_chat_history" not in st.session_state:
            st.session_state.ai_chat_history = []
        if "pending_ai_prompt" not in st.session_state:
            st.session_state.pending_ai_prompt = None
        if "ai_analysis_mode" not in st.session_state:
            st.session_state.ai_analysis_mode = "self"
        if "ai_last_briefed_player" not in st.session_state:
            st.session_state.ai_last_briefed_player = None
        if "ai_last_briefed_mode" not in st.session_state:
            st.session_state.ai_last_briefed_mode = None

        stats = st.session_state.cached_stats or {}
        deep_profile = st.session_state.cached_deep_profile or {}
        fen_w = st.session_state.cached_fen_map_white or {}
        fen_b = st.session_state.cached_fen_map_black or {}
        filtered_games = st.session_state.cached_filtered_games or []

        total_filtered_games_count = len(filtered_games)
        analyzed_indices = set(e["game_index"] for e in (st.session_state.cached_move_evaluations or []) if "game_index" in e)
        analyzed_games_count = len(analyzed_indices)

        # Cảnh báo nếu chưa phân tích toàn bộ ván đấu
        if total_filtered_games_count > analyzed_games_count and total_filtered_games_count > 0:
            with st.container(border=True):
                w_col1, w_col2 = st.columns([7, 3])
                with w_col1:
                    st.markdown(
                        f"⚠️ **Cảnh báo: Dữ liệu chưa đủ độ tin cậy để phân tích chuyên sâu**  \n"
                        f"<span style='font-size:13px; color:#475569;'>"
                        f"Hệ thống hiện tại mới chỉ phân tích mẫu **{analyzed_games_count}/{total_filtered_games_count} ván**. "
                        f"Các chỉ số phân tích chuyên sâu (độ chính xác từng giai đoạn, điểm yếu chiến thuật, cấu trúc Tốt, phong cách) chưa đầy đủ 100% để đưa ra kết luận chuẩn xác nhất. "
                        f"Hãy bấm nút bên cạnh để phân tích toàn bộ {total_filtered_games_count} ván đấu cho Trợ lí AI!"
                        f"</span>",
                        unsafe_allow_html=True
                    )
                with w_col2:
                    if st.button(
                        f"🚀 Phân tích {total_filtered_games_count} ván ngay",
                        type="primary",
                        use_container_width=True,
                        key="ai_deep_scan_btn"
                    ):
                        prog_slot = st.empty()
                        init_pct = float(analyzed_games_count) / max(1, total_filtered_games_count) * 0.92
                        progress_bar = prog_slot.progress(init_pct, text=f"Đang phân tích {analyzed_games_count}/{total_filtered_games_count} ván...")
                        
                        def _on_ai_prog(cur, tot):
                            overall_done = analyzed_games_count + cur
                            pct = min(0.92, float(overall_done) / max(1, total_filtered_games_count) * 0.92)
                            progress_bar.progress(pct, text=f"Đang phân tích ván {overall_done}/{total_filtered_games_count}...")

                        deep_eval_res = parallel_batch_analyze_games(
                            filtered_games,
                            depth=6,
                            max_games=total_filtered_games_count,
                            progress_callback=_on_ai_prog,
                            existing_evaluations=st.session_state.cached_move_evaluations
                        )
                        progress_bar.progress(0.95, text="⚡ Đang cập nhật Hồ sơ Kỳ thủ & Phong cách chơi...")
                        st.session_state.cached_move_evaluations = deep_eval_res.get("move_evaluations", [])
                        st.session_state.cached_deep_profile = generate_deep_opponent_profile(
                            filtered_games,
                            stats,
                            move_evaluations=st.session_state.cached_move_evaluations
                        )
                        progress_bar.progress(1.0, text="✅ Hoàn tất 100%! Đang làm mới dữ liệu...")
                        st.rerun()

        # Top Bar: Kỳ thủ Info + Góc nhìn Selector + Mô hình AI + Nút Reset
        top_c1, top_c2, top_c3, top_c4 = st.columns([3.5, 3.5, 2.5, 1.5])
        with top_c1:
            if analyzed_games_count >= total_filtered_games_count and total_filtered_games_count > 0:
                cov_badge = f"<span style='display:inline-flex; align-items:center; font-size:11.5px; font-weight:600; color:#15803D; background:#DCFCE7; border:1px solid #86EFAC; padding:2px 8px; border-radius:12px;'>✅ 100% Eval</span>"
            else:
                cov_badge = f"<span style='display:inline-flex; align-items:center; font-size:11.5px; font-weight:600; color:#B45309; background:#FEF3C7; border:1px solid #FCD34D; padding:2px 8px; border-radius:12px;'>⚠️ Mẫu ({analyzed_games_count}/{total_filtered_games_count})</span>"

            st.markdown(
                f"""
                <div style='display:flex; align-items:center; gap:8px; height:38px;'>
                    <span style='font-size:13px; font-weight:600; color:#64748B;'>Kỳ thủ:</span>
                    <span style='font-size:15px; font-weight:700; color:#0F172A; font-family:Inter, sans-serif;'>
                        ♟️ {selected_player}
                    </span>
                    {cov_badge}
                </div>
                """,
                unsafe_allow_html=True
            )

        with top_c2:
            current_mode = st.session_state.ai_analysis_mode
            mode_options = ["self", "opponent"]
            selected_mode = st.radio(
                "Mục đích phân tích",
                options=mode_options,
                index=mode_options.index(current_mode),
                format_func=lambda x: "👤 Bản thân / Học viên" if x == "self" else "🎯 Đối thủ sắp gặp",
                horizontal=True,
                key="ai_mode_radio_selector",
                label_visibility="collapsed"
            )
            if selected_mode != current_mode:
                st.session_state.ai_analysis_mode = selected_mode
                st.session_state.ai_chat_history = []
                st.session_state.ai_last_briefed_mode = None
                st.rerun()

        with top_c3:
            model_options = list(AVAILABLE_MODELS.keys())
            model_display = [AVAILABLE_MODELS[k] for k in model_options]
            def_idx = 0
            selected_display = st.selectbox(
                "Mô hình AI",
                options=model_display,
                index=def_idx,
                key="ai_model_selector",
                label_visibility="collapsed"
            )
            selected_model = model_options[model_display.index(selected_display)]

        with top_c4:
            if st.button("🗑️ Làm mới", use_container_width=True, key="clear_ai_chat_btn", help="Khởi tạo lại bản suy luận mở đầu"):
                st.session_state.ai_chat_history = []
                st.session_state.pending_ai_prompt = None
                st.session_state.ai_last_briefed_player = None
                st.session_state.ai_last_briefed_mode = None
                st.rerun()

        # Tự động tạo Bản Suy luận Chiến lược Mở đầu (Proactive Strategic Briefing)
        cur_mode = st.session_state.ai_analysis_mode
        needs_briefing = (
            not st.session_state.ai_chat_history or
            st.session_state.ai_last_briefed_player != selected_player or
            st.session_state.ai_last_briefed_mode != cur_mode
        )
        if needs_briefing:
            briefing_text = generate_initial_strategic_briefing(
                deep_profile=deep_profile,
                stats=stats,
                selected_player=selected_player,
                mode=cur_mode
            )
            st.session_state.ai_chat_history = [{"role": "assistant", "content": briefing_text}]
            st.session_state.ai_last_briefed_player = selected_player
            st.session_state.ai_last_briefed_mode = cur_mode

        st.markdown("<div style='margin-bottom:12px;'></div>", unsafe_allow_html=True)

        # Chat Message History Container
        chat_container = st.container()
        with chat_container:
            for msg in st.session_state.ai_chat_history:
                role = msg["role"]
                content = msg["content"]
                avatar = "♟️" if role == "user" else "🤖"
                with st.chat_message(role, avatar=avatar):
                    st.markdown(content)

            # Nếu chỉ mới có bản Briefing mở đầu, hiển thị các nút Gợi ý Đào sâu 1-Click
            if len(st.session_state.ai_chat_history) == 1:
                st.markdown("<div style='margin-top:14px; margin-bottom:8px; font-size:12.5px; font-weight:700; color:#475569;'>💡 GỢI Ý HỎI ĐÀO SÂU (BẤM ĐỂ HỎI NGAY):</div>", unsafe_allow_html=True)
                chips = get_followup_prompts(cur_mode)
                chip_cols = st.columns(len(chips))
                for i, chip_prompt in enumerate(chips):
                    with chip_cols[i]:
                        if st.button(chip_prompt, key=f"ai_chip_{i}", use_container_width=True):
                            st.session_state.pending_ai_prompt = chip_prompt
                            st.rerun()

        # Chat Input
        input_placeholder = (
            "Hỏi Trợ lí AI về điểm yếu, bài tập rèn luyện hoặc kế hoạch nâng cao trình độ..."
            if cur_mode == "self"
            else "Hỏi Trợ lí AI về cách khai thác điểm yếu, bẫy khai cuộc hoặc khắc chế đối thủ..."
        )
        user_prompt = st.chat_input(input_placeholder, key="ai_chat_input_box")

        active_prompt = None
        if user_prompt:
            active_prompt = user_prompt
        elif st.session_state.pending_ai_prompt:
            active_prompt = st.session_state.pending_ai_prompt
            st.session_state.pending_ai_prompt = None

        if active_prompt:
            # Append user message
            st.session_state.ai_chat_history.append({"role": "user", "content": active_prompt})
            with chat_container:
                with st.chat_message("user", avatar="♟️"):
                    st.markdown(active_prompt)

                with st.chat_message("assistant", avatar="🤖"):
                    msg_slot = st.empty()
                    msg_slot.markdown(
                        """
                        <div class='ai-thinking-indicator'>
                            <span>🤖 AI đang suy luận chiến lược</span>
                            <span class='ai-thinking-dots'>
                                <span></span><span></span><span></span>
                            </span>
                        </div>
                        """,
                        unsafe_allow_html=True
                    )
                    context_data = build_player_ai_context(
                        deep_profile=deep_profile,
                        stats=stats,
                        fen_map_white=fen_w,
                        fen_map_black=fen_b,
                        selected_player=selected_player,
                        analyzed_games_count=analyzed_games_count,
                        total_games_count=total_filtered_games_count
                    )
                    stream_gen = stream_gemini_response(
                        prompt=active_prompt,
                        context=context_data,
                        chat_history=st.session_state.ai_chat_history,
                        model=selected_model,
                        deep_profile=deep_profile,
                        stats=stats,
                        fen_map_white=fen_w,
                        fen_map_black=fen_b,
                        selected_player=selected_player,
                        mode=cur_mode
                    )
                    full_response = msg_slot.write_stream(stream_gen)
                    if not full_response:
                        full_response = "⚠️ Không nhận được phản hồi từ mô hình AI. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại với câu hỏi khác."
                    st.session_state.ai_chat_history.append({"role": "assistant", "content": full_response})

            st.rerun()


# ==============================================================================
# VIEW 07: IMPORT GAMES PAGE
# ==============================================================================
elif active_page == "Import":
    PageHeader("Nạp Ván đấu", "Nạp dữ liệu ván đấu từ file PGN hoặc tải trực tuyến từ Lichess / Chess.com")

    col_up, col_on = st.columns(2)

    with col_up:
        with st.container(border=True):
            st.markdown("#### 📁 Upload File PGN")
            file_up = st.file_uploader(
                "Kéo thả file PGN vào đây",
                type=["pgn"],
                key="import_page_pgn_file_uploader",
                label_visibility="visible"
            )
            if file_up is not None:
                new_bytes = file_up.getvalue()
                if st.session_state.online_pgn_bytes != new_bytes:
                    progress_placeholder = st.empty()
                    steps_def = [
                        {"id": "parse", "title": f"Bóc tách dữ liệu từ file {file_up.name}"},
                        {"id": "tree", "title": "Xây dựng Cây Khai cuộc Trắng / Đen"},
                        {"id": "engine", "title": "Phân tích chuyên sâu (Đánh giá có sẵn / Đa luồng)"},
                        {"id": "ready", "title": "Nạp bàn cờ phân tích và hoàn tất"},
                    ]
                    tracker = AnalysisProgressTracker(
                        progress_placeholder,
                        steps_def,
                        title=f"Tiến trình nạp file PGN: {file_up.name}"
                    )

                    # Step 1: Parse
                    tracker.set_step_running("parse", "Đang bóc tách PGN...")
                    all_games = cached_parse_pgn(new_bytes)
                    primary_player = detect_primary_player(all_games)
                    target_player = primary_player if primary_player else "Unknown Player"
                    tracker.set_step_done("parse", f"Đã nhận diện {len(all_games)} ván đấu (Kỳ thủ: {target_player})")

                    # Step 2: Tree
                    tracker.set_step_running("tree", "Đang tính toán các biến và thống kê...")
                    filtered_games = filter_games_by_player(all_games, target_player)
                    stats = calculate_game_stats(filtered_games)
                    _, fen_map_all = build_opening_tree(filtered_games, color="all")
                    _, fen_map_white = build_opening_tree(filtered_games, color="white")
                    _, fen_map_black = build_opening_tree(filtered_games, color="black")
                    repertoire_data = analyze_opening_repertoire(filtered_games)
                    tracker.set_step_done("tree", f"Đã tạo 3 cây khai cuộc (Tất cả: {len(fen_map_all)}, Trắng: {len(fen_map_white)}, Đen: {len(fen_map_black)} thế cờ)")

                    # Step 3: Engine
                    tracker.set_step_running("engine", "Đang đánh giá chất lượng nước đi...")
                    comp_res = get_comprehensive_move_evaluations(filtered_games, depth=6, max_stockfish_games=10)
                    move_evals = comp_res.get("move_evaluations", []) if comp_res.get("available") else None
                    if comp_res.get("source") == "embedded_pgn":
                        eval_msg = f"Đã trích xuất đánh giá chất lượng cao từ {comp_res.get('analyzed_games', 0)} ván đấu (0s)"
                    else:
                        eval_msg = f"Đã phân tích {comp_res.get('analyzed_games', 0)} ván đấu mẫu (Depth 6)"

                    deep_profile = generate_deep_opponent_profile(
                        filtered_games,
                        stats,
                        move_evaluations=move_evals
                    )
                    tracker.set_step_done("engine", eval_msg)

                    # Step 4: Ready
                    tracker.set_step_running("ready", "Đang nạp bàn cờ...")
                    st.session_state.online_pgn_bytes = new_bytes
                    st.session_state.online_pgn_name = file_up.name
                    st.session_state.last_selected_player = target_player
                    st.session_state.cached_filtered_games = filtered_games
                    st.session_state.cached_stats = stats
                    st.session_state.cached_fen_map = fen_map_all
                    st.session_state.cached_fen_map_white = fen_map_white
                    st.session_state.cached_fen_map_black = fen_map_black
                    st.session_state.cached_repertoire = repertoire_data
                    st.session_state.cached_move_evaluations = move_evals
                    st.session_state.cached_deep_profile = deep_profile
                    tracker.set_step_done("ready", "Sẵn sàng phân tích!")

                    st.session_state.active_nav_page = "Analyze"
                    st.rerun()

    with col_on:
        with st.container(border=True):
            st.markdown("#### 🌐 Fetch từ Lichess / Chess.com")
            platform = st.selectbox("Nền tảng Online", options=["Lichess", "Chess.com"], key="import_page_platform_select")
            online_user = st.text_input("Tên tài khoản", placeholder="Ví dụ: MagnusCarlsen hoặc Hikaru", key="import_page_user_input")
            max_games_input = st.number_input(
                "Số lượng ván đấu",
                min_value=1,
                max_value=300,
                value=None,
                step=10,
                placeholder="Tối đa 300 ván",
                key="import_page_max_games"
            )
            max_games = int(max_games_input) if max_games_input is not None else 50

            col_sub1, col_sub2 = st.columns(2)
            with col_sub1:
                selected_game_types = st.multiselect(
                    "Thể loại",
                    options=["Bullet", "Blitz", "Rapid", "Classical", "Daily / Correspondence"],
                    default=[],
                    help="Chọn một hoặc nhiều thể loại cần tải. Bỏ trống để tải tất cả các thể loại.",
                    key="import_page_game_types"
                )
            with col_sub2:
                rated_mode = st.selectbox(
                    "Rated",
                    options=["Tất cả (Rated & Casual)", "Chỉ ván tính điểm (Rated)", "Chỉ ván không tính điểm (Not Rated)"],
                    index=0,
                    key="import_page_rated_mode"
                )
                if rated_mode == "Chỉ ván tính điểm (Rated)":
                    is_rated = True
                elif rated_mode == "Chỉ ván không tính điểm (Not Rated)":
                    is_rated = False
                else:
                    is_rated = None

            # Tùy chọn tăng tốc tải Lichess qua OAuth 1-Click (Giống OpeningTree)
            if platform == "Lichess":
                if st.session_state.get("lichess_api_token"):
                    logged_name = st.session_state.get("lichess_logged_user") or "Đã xác thực"
                    st.markdown(
                        f"""
                        <div style='background:#F0FDF4; border:1px solid #BBF7D0; border-radius:8px; padding:10px 14px; margin-bottom:12px;'>
                            <div style='font-size:13px; color:#166534; font-weight:500;'>
                                🟢 <b>Đã đăng nhập Lichess:</b> <span style='font-weight:700;'>{logged_name}</span> (Tải siêu tốc ⚡)
                            </div>
                        </div>
                        """,
                        unsafe_allow_html=True
                    )
                    if st.button("Đăng xuất Lichess", key="import_lichess_logout_btn"):
                        st.session_state.lichess_api_token = ""
                        st.session_state.lichess_logged_user = ""
                        st.rerun()
                else:
                    auth_url = build_lichess_auth_url(
                        client_id=DEFAULT_CLIENT_ID,
                        redirect_uri=DEFAULT_REDIRECT_URI
                    )
                    st.markdown(
                        f"""
                        <div style='background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 14px; margin-bottom:12px;'>
                            <div style='font-size:13px; font-weight:600; color:#1E293B; margin-bottom:4px; display:flex; align-items:center; gap:6px;'>
                                <span>⚡</span> <span>Tăng tốc nạp ván đấu Lichess</span>
                            </div>
                            <div style='font-size:12px; color:#64748B; line-height:1.45; margin-bottom:10px;'>
                                Lichess cho phép tải ván đấu <b>nhanh hơn gấp 3–5 lần</b> khi đăng nhập.
                            </div>
                            <a href='{auth_url}' target='_self' style='display:inline-block; background:#10B981; color:#ffffff; font-weight:600; font-size:13px; padding:8px 18px; border-radius:6px; text-decoration:none;'>
                                🔒 LOGIN TO LICHESS
                            </a>
                        </div>
                        """,
                        unsafe_allow_html=True
                    )

            if st.button("Tải ván đấu", type="primary", use_container_width=True, key="import_page_fetch_online_btn"):
                if online_user.strip():
                    progress_placeholder = st.empty()
                    steps_def = [
                        {"id": "fetch", "title": f"Tải {max_games} ván đấu của {online_user} từ {platform}"},
                        {"id": "parse", "title": "Bóc tách dữ liệu PGN và phát hiện kỳ thủ"},
                        {"id": "tree", "title": "Xây dựng Cây Khai cuộc Trắng / Đen"},
                        {"id": "engine", "title": "Phân tích chuyên sâu (Đánh giá có sẵn / Đa luồng)"},
                        {"id": "ready", "title": "Nạp bàn cờ phân tích và hoàn tất"},
                    ]
                    tracker = AnalysisProgressTracker(
                        progress_placeholder,
                        steps_def,
                        title=f"Tiến trình nạp và phân tích ván đấu ({platform})"
                    )

                    # Step 1: Fetch
                    tracker.set_step_running("fetch", "Đang kết nối máy chủ...")
                    if platform == "Lichess":
                        token_to_use = st.session_state.get("lichess_api_token", "").strip() or None
                        pgn_bytes, err = fetch_lichess_games(online_user, max_games, perf_types=selected_game_types, rated=is_rated, token=token_to_use)
                    else:
                        pgn_bytes, err = fetch_chesscom_games(online_user, max_games, perf_types=selected_game_types, rated=is_rated)

                    if err:
                        tracker.set_step_error("fetch", f"Lỗi tải ván đấu: {err}")
                        st.error(err)
                    elif pgn_bytes:
                        tracker.set_step_done("fetch", f"Đã tải thành công ván đấu từ {platform}")

                        # Step 2: Parse
                        tracker.set_step_running("parse", "Đang bóc tách PGN...")
                        all_games = cached_parse_pgn(pgn_bytes)[:max_games]
                        primary_player = detect_primary_player(all_games)
                        target_player = primary_player if primary_player else online_user
                        tracker.set_step_done("parse", f"Đã nhận diện {len(all_games)} ván đấu hợp lệ (Kỳ thủ: {target_player})")

                        # Step 3: Tree
                        tracker.set_step_running("tree", "Đang tính toán các biến và thống kê...")
                        filtered_games = filter_games_by_player(all_games, target_player)[:max_games]
                        stats = calculate_game_stats(filtered_games)
                        _, fen_map_all = build_opening_tree(filtered_games, color="all")
                        _, fen_map_white = build_opening_tree(filtered_games, color="white")
                        _, fen_map_black = build_opening_tree(filtered_games, color="black")
                        repertoire_data = analyze_opening_repertoire(filtered_games)
                        tracker.set_step_done("tree", f"Đã tạo 3 cây khai cuộc (Tất cả: {len(fen_map_all)}, Trắng: {len(fen_map_white)}, Đen: {len(fen_map_black)} thế cờ)")

                        # Step 4: Engine & Deep Profile
                        tracker.set_step_running("engine", "Đang đánh giá chất lượng nước đi & cấu trúc...")
                        if platform == "Lichess":
                            # Lichess: Sử dụng dữ liệu đầy đủ từ Lichess, trích xuất evals có sẵn nếu có, không cần phân tích thêm ván đấu mẫu
                            comp_res = get_comprehensive_move_evaluations(filtered_games, depth=6, max_stockfish_games=0)
                            move_evals = comp_res.get("move_evaluations", []) if comp_res.get("available") else None
                            if comp_res.get("source") == "embedded_pgn":
                                eval_msg = f"Đã trích xuất đánh giá có sẵn từ {comp_res.get('analyzed_games', 0)} ván đấu Lichess"
                            else:
                                eval_msg = "Sử dụng dữ liệu đầy đủ từ Lichess"
                        else:
                            # Chess.com: Phân tích trước 10 ván đấu mẫu ở Depth 6
                            comp_res = get_comprehensive_move_evaluations(filtered_games, depth=6, max_stockfish_games=10)
                            move_evals = comp_res.get("move_evaluations", []) if comp_res.get("available") else None
                            if comp_res.get("source") == "embedded_pgn":
                                eval_msg = f"Đã trích xuất đánh giá có sẵn từ {comp_res.get('analyzed_games', 0)} ván đấu (0s)"
                            else:
                                eval_msg = f"Đã phân tích {comp_res.get('analyzed_games', 0)} ván đấu mẫu (Depth 6)"

                        deep_profile = generate_deep_opponent_profile(
                            filtered_games,
                            stats,
                            move_evaluations=move_evals
                        )
                        tracker.set_step_done("engine", eval_msg)

                        # Step 5: Ready
                        tracker.set_step_running("ready", "Đang lưu bộ nhớ và chuyển trang...")
                        st.session_state.online_pgn_bytes = pgn_bytes
                        st.session_state.online_pgn_name = f"{platform}_{online_user}.pgn"
                        st.session_state.last_selected_player = target_player
                        st.session_state.cached_filtered_games = filtered_games
                        st.session_state.cached_stats = stats
                        st.session_state.cached_fen_map = fen_map_all
                        st.session_state.cached_fen_map_white = fen_map_white
                        st.session_state.cached_fen_map_black = fen_map_black
                        st.session_state.cached_repertoire = repertoire_data
                        st.session_state.cached_move_evaluations = move_evals
                        st.session_state.cached_deep_profile = deep_profile
                        tracker.set_step_done("ready", "Sẵn sàng phân tích!")

                        st.session_state.active_nav_page = "Analyze"
                        st.rerun()

    st.markdown("<div style='margin-bottom:20px;'></div>", unsafe_allow_html=True)

    # Data Preview Card
    if st.session_state.online_pgn_bytes is not None:
        try:
            games_preview = cached_parse_pgn(st.session_state.online_pgn_bytes)
            players_p = extract_players(games_preview)
            primary_p = detect_primary_player(games_preview)

            with st.container(border=True):
                st.markdown("#### Tổng quan Dữ liệu Đã Nạp")
                dp1, dp2, dp3 = st.columns(3)
                dp1.metric("Số ván nhận diện", len(games_preview))
                dp2.metric("Số kỳ thủ", len(players_p))
                dp3.metric("Kỳ thủ chính", primary_p if primary_p else "N/A")

                st.markdown("<div style='margin-bottom:12px;'></div>", unsafe_allow_html=True)

                if st.button("Bắt đầu Phân tích", type="primary", use_container_width=True, key="import_start_analysis_btn"):
                    st.session_state.active_nav_page = "Analyze"
                    st.rerun()
        except Exception as e:
            st.error(f"Lỗi đọc PGN: {e}")


# ==============================================================================
elif active_page == "Settings":
    st.session_state.active_nav_page = "Dashboard"
    st.rerun()
