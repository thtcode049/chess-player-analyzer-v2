"""
UI Components & Design System Helper Module
-------------------------------------------
Chức năng: Cung cấp hệ thống UI Component dùng chung (Global Design System)
chuẩn hóa theo phong cách "Chess Opponent Analyzer — Modern Light Chess Analytics".
"""

import os
import base64
import streamlit as st
import pandas as pd
from typing import Dict, Any, List, Optional

_ICONS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets", "icons"))

# Global Semantic & Brand Design Tokens
COLOR_WIN = "#22C55E"          # Victory Green
COLOR_DRAW = "#94A3B8"         # Cool Gray Draw
COLOR_LOSS = "#EF4444"         # Coral Red Loss
COLOR_WARNING = "#F59E0B"      # Amber Warning
COLOR_PRIMARY = "#10B981"      # Emerald Primary Brand Color
COLOR_PRIMARY_HOVER = "#059669"
COLOR_BLUE = "#3B82F6"         # Analytics Blue Accent
COLOR_TEXT_PRIMARY = "#0F172A"
COLOR_TEXT_SECONDARY = "#475569"
COLOR_TEXT_MUTED = "#94A3B8"
COLOR_BORDER = "#E2E8F0"
COLOR_BG_PAGE = "#F5F7FA"
COLOR_BG_SURFACE = "#FFFFFF"


def apply_global_styles(theme_mode: str = "light"):
    """Tải và áp dụng Global Light Chess Analytics Design System CSS."""
    
    st.markdown("""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains-Mono:wght@500;600;700&display=swap');

        :root {
            --bg-page: #F5F7FA;
            --bg-primary: #FFFFFF;
            --bg-surface: #FFFFFF;
            --bg-soft: #F0F4F8;
            --bg-hover: #E8EEF5;

            --text-primary: #0F172A;
            --text-secondary: #475569;
            --text-muted: #94A3B8;

            --primary: #10B981;
            --primary-hover: #059669;

            --blue: #3B82F6;
            --blue-soft: #EFF6FF;

            --chess-dark: #1E293B;
            --chess-light: #F8FAFC;

            --win: #22C55E;
            --draw: #94A3B8;
            --loss: #EF4444;
            --warning: #F59E0B;

            --border: #E2E8F0;
            --border-strong: #CBD5E1;

            --shadow-sm: 0 1px 3px rgba(15,23,42,.08);
            --shadow-md: 0 6px 20px rgba(15,23,42,.08);
        }

        .stApp, body {
            background-color: var(--bg-page) !important;
            color: var(--text-primary) !important;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        }

        /* Prevent UI Dimming & Blurring during script runs and background processing */
        [data-stale="true"] {
            opacity: 1 !important;
            filter: none !important;
            transition: none !important;
        }
        div[data-testid="stAppViewBlockContainer"] {
            transition: none !important;
        }

        /* Animations for Stepper Progress */
        @keyframes stepSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .step-spin {
            animation: stepSpin 1s linear infinite !important;
            display: inline-block !important;
        }
        @keyframes dotsBlink {
            0% { opacity: 0.2; }
            20% { opacity: 1; }
            100% { opacity: 0.2; }
        }
        .dots-ellipsis span {
            animation-name: dotsBlink;
            animation-duration: 1.4s;
            animation-iteration-count: infinite;
            animation-fill-mode: both;
            font-weight: 700;
        }
        .dots-ellipsis span:nth-child(2) {
            animation-delay: 0.2s;
        }
        .dots-ellipsis span:nth-child(3) {
            animation-delay: 0.4s;
        }

        /* Animated Thinking Dots Indicator for AI Assistant */
        .ai-thinking-indicator {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 13.5px;
            color: #475569;
            font-weight: 500;
            padding: 6px 12px;
            background: #F1F5F9;
            border: 1px solid #E2E8F0;
            border-radius: 8px;
            margin-bottom: 8px;
        }
        .ai-thinking-dots {
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .ai-thinking-dots span {
            width: 5px;
            height: 5px;
            background-color: #10B981;
            border-radius: 50%;
            display: inline-block;
            animation: bounceDot 1.4s infinite ease-in-out both;
        }
        .ai-thinking-dots span:nth-child(1) {
            animation-delay: -0.32s;
        }
        .ai-thinking-dots span:nth-child(2) {
            animation-delay: -0.16s;
        }
        @keyframes bounceDot {
            0%, 80%, 100% { 
                transform: scale(0);
                opacity: 0.3;
            } 40% { 
                transform: scale(1.0);
                opacity: 1;
            }
        }

        /* Typography */
        h1, h2, h3 {
            color: var(--text-primary) !important;
            font-family: 'Inter', sans-serif !important;
            font-weight: 700 !important;
        }
        
        .mono-font, code, pre, div.stCode, .pgn-text, .fen-text {
            font-family: 'JetBrains Mono', monospace !important;
        }

        /* Content Container - Margins aligned with sidebar layout */
        .block-container {
            padding-top: 1rem !important;
            padding-bottom: 2rem !important;
            padding-left: 1.5rem !important;
            padding-right: 1.5rem !important;
            max-width: 1440px !important;
            margin-left: 0 !important;
            margin-right: auto !important;
        }

        /* Rationale: Hide default Streamlit top toolbar, deploy button, header decoration, and hamburger/collapse controls to maintain a clean desktop app layout. */
        [data-testid="stAppDeployButton"],
        [data-testid="stToolbar"],
        [data-testid="stDecoration"],
        [data-testid="stSidebarCollapseButton"],
        [data-testid="collapsedControl"],
        button[kind="header"] {
            display: none !important;
            visibility: hidden !important;
            height: 0px !important;
            width: 0px !important;
        }

        /* Rationale: Remove top header padding to maximize vertical space. */
        header[data-testid="stHeader"] {
            background: transparent !important;
            height: 0px !important;
            min-height: 0px !important;
            padding: 0 !important;
        }

        /* Rationale: Style fixed permanent 250px left sidebar navigation. Streamlit sidebar by default is collapsible with dynamic width. */
        section[data-testid="stSidebar"],
        section[data-testid="stSidebar"][aria-expanded="false"],
        section[data-testid="stSidebar"][aria-expanded="true"] {
            display: flex !important;
            visibility: visible !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            bottom: 0 !important;
            height: 100vh !important;
            width: 250px !important;
            min-width: 250px !important;
            max-width: 250px !important;
            margin-left: 0 !important;
            transform: none !important;
            z-index: 100 !important;
            background-color: #FFFFFF !important;
            border-right: 1px solid var(--border) !important;
        }

        /* Rationale: Offset main app section by 250px to accommodate the fixed left sidebar. */
        [data-testid="stMain"],
        section[data-testid="stMain"],
        div[data-testid="stAppViewContainer"] > section.main,
        div[data-testid="stAppViewContainer"] > section[data-testid="stMain"],
        .main,
        .stMain {
            margin-left: 250px !important;
            padding-left: 0rem !important;
            width: calc(100% - 250px) !important;
            box-sizing: border-box !important;
        }

        /* Rationale: Collapse empty Streamlit sidebar header container to prevent giant top space. */
        section[data-testid="stSidebar"] [data-testid="stSidebarHeader"],
        div[data-testid="stSidebarHeader"] {
            display: none !important;
            height: 0px !important;
            min-height: 0px !important;
            padding: 0 !important;
            margin: 0 !important;
        }

        /* Rationale: Sidebar content top padding. */
        div[data-testid="stSidebarUserContent"],
        div[data-testid="stSidebarContent"],
        section[data-testid="stSidebar"] [data-testid="stSidebarUserContent"],
        section[data-testid="stSidebar"] [data-testid="stSidebarContent"] {
            padding-top: 0.75rem !important;
            padding-bottom: 0.75rem !important;
            padding-left: 0.75rem !important;
            padding-right: 0.75rem !important;
            overflow-y: auto !important;
        }



        /* Rationale: Tighten spacing between sidebar element containers to fit all buttons cleanly. */
        div[data-testid="stSidebar"] div.stElementContainer,
        div[data-testid="stSidebar"] div.element-container {
            margin-bottom: 2px !important;
        }

        /* Rationale: Hide sidebar scrollbars for clean navigation appearance. */
        section[data-testid="stSidebar"] ::-webkit-scrollbar,
        section[data-testid="stSidebar"] [data-testid="stSidebarContent"] ::-webkit-scrollbar {
            display: none !important;
            width: 0px !important;
            height: 0px !important;
        }

        .sidebar-nav-group {
            font-size: 9.5px;
            font-weight: 800;
            letter-spacing: 0.7px;
            color: var(--text-muted);
            text-transform: uppercase;
            margin-top: 8px;
            margin-bottom: 2px;
        }

        /* Rationale: Custom compact button sizing for sidebar navigation links. */
        div[data-testid="stSidebar"] div.stButton button {
            width: 100% !important;
            justify-content: flex-start !important;
            background-color: transparent !important;
            border: 1px solid transparent !important;
            color: var(--text-secondary) !important;
            font-size: 12.5px !important;
            font-weight: 600 !important;
            padding: 3px 8px !important;
            border-radius: 6px !important;
            height: 30px !important;
            min-height: 30px !important;
            box-shadow: none !important;
            transition: all 0.15s ease !important;
            margin-bottom: 1px !important;
        }

        /* Rationale: Compact selectbox sizing inside sidebar. */
        div[data-testid="stSidebar"] div[data-baseweb="select"] {
            min-height: 30px !important;
        }
        div[data-testid="stSidebar"] div[data-baseweb="select"] > div {
            min-height: 30px !important;
            padding-top: 1px !important;
            padding-bottom: 1px !important;
        }

        div[data-testid="stSidebar"] div.stButton button:hover {
            background-color: var(--bg-soft) !important;
            color: var(--text-primary) !important;
            border-color: var(--border) !important;
        }

        /* Rationale: Highlight active sidebar button when selected. */
        div[data-testid="stSidebar"] div.stButton button[kind="primary"],
        div[data-testid="stSidebar"] div.stButton button[data-testid="stBaseButton-primary"] {
            background-color: #ECFDF5 !important;
            color: #059669 !important;
            border: 1px solid #A7F3D0 !important;
            font-weight: 700 !important;
        }

        div[data-testid="stSidebar"] div.stButton button[kind="primary"] *,
        div[data-testid="stSidebar"] div.stButton button[data-testid="stBaseButton-primary"] * {
            color: #059669 !important;
            font-weight: 700 !important;
        }

        /* Rationale: General button styling for modern light theme aesthetics across the app. */
        .stButton button, 
        button[data-testid="stBaseButton-secondary"],
        button[data-testid="stBaseButton-primary"] {
            min-height: 40px !important;
            height: auto !important;
            padding: 6px 12px !important;
            font-size: 13px !important;
            line-height: 1.35 !important;
            font-weight: 600 !important;
            border-radius: 8px !important;
            border: 1px solid var(--border-strong) !important;
            background-color: #FFFFFF !important;
            color: var(--text-primary) !important;
            box-shadow: var(--shadow-sm) !important;
            transition: all 0.15s ease !important;
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: break-word !important;
        }

        .stButton button:hover {
            background-color: var(--bg-soft) !important;
            border-color: var(--primary) !important;
            color: var(--primary-hover) !important;
        }

        button[kind="primary"], button[data-testid="stBaseButton-primary"] {
            background-color: var(--primary) !important;
            color: #FFFFFF !important;
            border-color: var(--primary) !important;
        }

        button[kind="primary"]:hover, button[data-testid="stBaseButton-primary"]:hover {
            background-color: var(--primary-hover) !important;
            color: #FFFFFF !important;
            border-color: var(--primary-hover) !important;
        }

        /* Rationale: Style native st.form and st.expander containers with uniform card background and border. */
        div[data-testid="stForm"], div[data-testid="stExpander"] {
            background-color: var(--bg-surface) !important;
            border: 1px solid var(--border) !important;
            border-radius: 10px !important;
            box-shadow: var(--shadow-sm) !important;
        }

        /* Rationale: Style native st.metric cards with uniform card background, border, font sizes, and spacing. */
        /* Rationale: Style native st.metric cards with uniform card background, border, font sizes, full width, and consistent height. */
        div[data-testid="stMetric"] {
            background-color: var(--bg-surface) !important;
            border: 1px solid var(--border) !important;
            border-radius: 10px !important;
            padding: 14px 16px !important;
            box-shadow: var(--shadow-sm) !important;
            width: 100% !important;
            min-height: 104px !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
        }

        div[data-testid="stMetricLabel"] {
            font-size: 11.5px !important;
            font-weight: 700 !important;
            color: var(--text-secondary) !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
        }

        div[data-testid="stMetricValue"] {
            font-size: 1.6rem !important;
            font-weight: 800 !important;
            color: var(--text-primary) !important;
            line-height: 1.25 !important;
        }

        div[data-testid="stMetricDelta"] {
            font-size: 12px !important;
            font-weight: 600 !important;
        }

        /* Rationale: Ensure dataframe container has consistent borders and radius matching design system. */
        div[data-testid="stDataFrame"] {
            border: 1px solid var(--border) !important;
            border-radius: 10px !important;
            overflow: hidden !important;
        }

        /* Non-fixed Footer Container */
        .static-footer-container {
            margin-top: 40px;
            padding: 20px 0 10px 0;
            border-top: 1px solid var(--border);
            text-align: center;
            font-size: 12.5px;
            color: var(--text-secondary);
        }
    </style>
    """, unsafe_allow_html=True)


def get_icon_svg(icon_name: str, size: int = 18, color: str = None) -> str:
    """Load 2D SVG icon from assets/icons/{icon_name}.svg and return inline SVG string."""
    svg_path = os.path.join(_ICONS_DIR, f"{icon_name}.svg")
    if not os.path.exists(svg_path):
        return ""
    
    with open(svg_path, "r", encoding="utf-8") as f:
        svg_content = f.read().replace('\n', ' ').replace('\r', ' ').strip()
    
    if color:
        svg_content = svg_content.replace('#5B5BD6', color).replace('#10B981', color)
    
    svg_content = svg_content.replace('width="24"', f'width="{size}"').replace('height="24"', f'height="{size}"')
    
    return svg_content


def AppFooter(lang: str = "vi"):
    """Vô hiệu hóa Footer theo yêu cầu giao diện."""
    pass


def PageHeader(title: str, subtitle: str):
    """Render Page Header chuẩn hóa."""
    st.markdown(f"""
    <div style="margin-bottom: 20px; margin-top: 0px;">
        <h2 style="margin:0; font-size:22px; font-weight:800; color:var(--text-primary) !important;">{title}</h2>
        {f'<div style="font-size:13.5px; color:var(--text-secondary) !important; margin-top:2px;">{subtitle}</div>' if subtitle else ''}
    </div>
    """, unsafe_allow_html=True)


def MetricCard(label: str, value: Any, subtext: str = "", badge_type: str = "neutral"):
    """
    Render a beautifully styled, responsive KPI card with 100% uniform height, width, and alignment.
    badge_type: 'neutral', 'success', 'warning', 'danger', 'primary'
    """
    badge_styles = {
        "success": "background-color: #ECFDF5; color: #059669; border: 1px solid #A7F3D0;",
        "warning": "background-color: #FFFBEB; color: #D97706; border: 1px solid #FDE68A;",
        "danger": "background-color: #FEF2F2; color: #DC2626; border: 1px solid #FECACA;",
        "primary": "background-color: #EEF2FF; color: #4F46E5; border: 1px solid #C7D2FE;",
        "neutral": "background-color: #F1F5F9; color: #475569; border: 1px solid #E2E8F0;",
    }
    b_style = badge_styles.get(badge_type, badge_styles["neutral"])
    badge_html = f"""<span style="{b_style} font-size: 11.5px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; display: inline-block;">{subtext}</span>""" if subtext else """<span style="font-size: 11.5px; opacity: 0;">&nbsp;</span>"""
    
    st.markdown(f"""
    <div style="background-color: var(--bg-surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; box-shadow: var(--shadow-sm); width: 100%; min-height: 104px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
        <div style="font-size: 11.5px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">
            {label}
        </div>
        <div style="font-size: 1.65rem; font-weight: 800; color: var(--text-primary); line-height: 1.25; margin: 4px 0;">
            {value}
        </div>
        <div>
            {badge_html}
        </div>
    </div>
    """, unsafe_allow_html=True)


def InsightCard(icon: str, title: str, text: str):
    """Render Insight Card sử dụng Streamlit Native Container với chiều cao đồng bộ."""
    with st.container(border=True):
        st.markdown(f"""
        <div style="min-height: 76px; display: flex; flex-direction: column; justify-content: flex-start;">
            <div style="font-weight: 700; font-size: 13.5px; color: var(--text-primary); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                <span>{icon}</span> <span>{title}</span>
            </div>
            <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
                {text}
            </div>
        </div>
        """, unsafe_allow_html=True)


def PastelCard(title: str, items: List[Dict[str, Any]], card_type: str = "danger"):
    """Render Status Card tương thích với Light Theme dùng Streamlit Native Container."""
    bg_color = "rgba(239, 68, 68, 0.05)" if card_type == "danger" else "rgba(245, 158, 11, 0.05)" if card_type == "warning" else "rgba(34, 197, 94, 0.05)"
    border_color = "rgba(239, 68, 68, 0.2)" if card_type == "danger" else "rgba(245, 158, 11, 0.2)" if card_type == "warning" else "rgba(34, 197, 94, 0.2)"
    title_color = "#EF4444" if card_type == "danger" else "#F59E0B" if card_type == "warning" else "#22C55E"
    
    with st.container(border=True):
        st.markdown(f"##### {title}")
        if items:
            for item in items:
                st.markdown(f"""
                <div style="background-color:{bg_color}; border:1px solid {border_color}; border-radius:8px; padding:12px 14px; margin-bottom:10px;">
                    <div style="font-weight:700; font-size:13.5px; color:{title_color};">{item.get('title', item.get('name', ''))}</div>
                    <div style="font-size:12.5px; margin-top:4px; color:var(--text-secondary);">{item.get('detail', item.get('reason', item.get('note', '')))}</div>
                </div>
                """, unsafe_allow_html=True)
        else:
            st.caption("Không phát hiện dữ liệu phù hợp.")


def EmptyState(title: str, description: str, icon: str = "♟️", cta_label: str = None, cta_key: str = None, on_cta_click = None):
    """Render Empty State bằng Streamlit Native Container."""
    with st.container(border=True):
        st.markdown(f"""
        <div style="text-align:center; padding:24px 12px;">
            <div style="font-size:48px; margin-bottom:12px;">{icon}</div>
            <h3 style="margin:0; font-size:20px; font-weight:800; color:#0F172A;">{title}</h3>
            <p style="font-size:14px; color:#475569; max-width:500px; margin:8px auto 16px auto; line-height:1.5;">
                {description}
            </p>
        </div>
        """, unsafe_allow_html=True)
        if cta_label:
            c1, c2, c3 = st.columns([3, 4, 3])
            with c2:
                if st.button(f"🚀 {cta_label}", type="primary", use_container_width=True, key=cta_key):
                    if on_cta_click:
                        on_cta_click()


def PlaystyleMeter(label_left: str, label_right: str, pct: int, desc: str = ""):
    """Render Playstyle progress meter bar."""
    st.markdown(f"""
    <div style="margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px;">
            <span>{label_left}</span>
            <span style="color:var(--primary);">{pct}% - {label_right}</span>
        </div>
        <div style="height: 8px; background-color: var(--border); border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; width: {pct}%; background-color: var(--primary); border-radius: 4px;"></div>
        </div>
    </div>
    """, unsafe_allow_html=True)


def RenderDataTable(df: pd.DataFrame, lang: str = "vi"):
    """Format và hiển thị Dataframe Repertoire chuẩn Tiếng Việt không hiện index."""
    col_map = {
        "name": "Khai cuộc",
        "games_count": "Số ván",
        "usage_pct": "Tần suất (%)",
        "score_pct": "Điểm số (%)",
        "wins": "Thắng",
        "draws": "Hòa",
        "losses": "Thua",
    }
    
    df_clean = df.rename(columns=col_map)
    cols = list(col_map.values())
    valid_cols = [c for c in cols if c in df_clean.columns]
    
    st.dataframe(
        df_clean[valid_cols],
        hide_index=True,
        use_container_width=True
    )


class AnalysisProgressTracker:
    """
    Trình theo dõi tiến trình phân tích nhiều bước (Analysis Multi-step Progress Tracker)
    Hiển thị giao diện trực quan:
    - Bước hoàn thành: Dấu tích xanh ✅
    - Bước đang chạy: Spinner xoay + Dấu chấm động lặp lại (...)
    - Bước đang chờ: Vòng tròn xám ⚪
    - Bước lỗi: Dấu gạch chéo đỏ ❌
    """
    def __init__(self, placeholder, steps: List[Dict[str, str]], title: str = "Tiến trình phân tích", lang: str = "vi"):
        self.placeholder = placeholder
        self.steps = steps
        self.title = title
        self.lang = lang
        self.statuses = {s["id"]: {"state": "pending", "detail": ""} for s in steps}
        self.render()

    def set_step_running(self, step_id: str, detail: str = ""):
        if step_id in self.statuses:
            self.statuses[step_id]["state"] = "running"
            self.statuses[step_id]["detail"] = detail
            self.render()

    def set_step_done(self, step_id: str, detail: str = ""):
        if step_id in self.statuses:
            self.statuses[step_id]["state"] = "done"
            self.statuses[step_id]["detail"] = detail
            self.render()

    def set_step_error(self, step_id: str, detail: str = ""):
        if step_id in self.statuses:
            self.statuses[step_id]["state"] = "error"
            self.statuses[step_id]["detail"] = detail
            self.render()

    def render(self):
        items_html = []
        for s in self.steps:
            sid = s["id"]
            title = s["title"]
            info = self.statuses.get(sid, {"state": "pending", "detail": ""})
            state = info["state"]
            detail = info["detail"]

            if state == "done":
                icon_html = '<span style="color:#10B981; font-size:18px; margin-right:10px;">✅</span>'
                title_style = 'font-weight:600; color:#0F172A;'
                detail_html = f'<div style="font-size:12px; color:#059669; margin-left:28px; margin-top:2px;">{detail}</div>' if detail else ''
            elif state == "running":
                icon_html = '<span class="step-spin" style="display:inline-block; margin-right:10px; font-size:16px;">🔄</span>'
                title_style = 'font-weight:700; color:#2563EB;'
                running_text = f'{detail} ' if detail else ''
                detail_html = f'<div style="font-size:12px; color:#2563EB; margin-left:28px; margin-top:2px;">{running_text}<span class="dots-ellipsis"><span>.</span><span>.</span><span>.</span></span></div>'
            elif state == "error":
                icon_html = '<span style="color:#EF4444; font-size:18px; margin-right:10px;">❌</span>'
                title_style = 'font-weight:600; color:#EF4444;'
                detail_html = f'<div style="font-size:12px; color:#DC2626; margin-left:28px; margin-top:2px;">{detail}</div>' if detail else ''
            else:
                icon_html = '<span style="color:#94A3B8; font-size:16px; margin-right:10px;">⚪</span>'
                title_style = 'font-weight:500; color:#64748B;'
                detail_html = ''

            item_str = (
                '<div style="padding:10px 14px; margin-bottom:8px; background:rgba(248, 250, 252, 0.9); border:1px solid #E2E8F0; border-radius:8px;">'
                f'<div style="display:flex; align-items:center;">{icon_html}<span style="{title_style} font-size:14px;">{title}</span></div>'
                f'{detail_html}'
                '</div>'
            )
            items_html.append(item_str)

        all_steps_html = "".join(items_html)
        full_html = (
            '<div style="background:#FFFFFF; border:1px solid #CBD5E1; border-radius:12px; padding:18px 20px; margin:16px 0; box-shadow:0 4px 12px rgba(0,0,0,0.06);">'
            f'<div style="font-size:16px; font-weight:800; color:#0F172A; margin-bottom:14px; display:flex; align-items:center;"><span style="margin-right:8px;">⏳</span> {self.title}</div>'
            f'{all_steps_html}'
            '</div>'
        )
        self.placeholder.markdown(full_html, unsafe_allow_html=True)



