"""
Wikibooks Chess Opening Theory Service
--------------------------------------
Fetches and sanitizes opening theory summaries from English Wikibooks
(https://en.wikibooks.org/wiki/Chess_Opening_Theory), matching Lichess's WikiBook source.
"""
from html.parser import HTMLParser
import json
import logging
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

_WIKIBOOK_API = "https://en.wikibooks.org/w/api.php"
_USER_AGENT = "ChessPlayerAnalyzer/2.0 (https://chesslook.app; contact@chesslook.local)"
_CACHE_TTL_SECONDS = 3600 * 6
_WIKIBOOK_CACHE: Dict[str, Tuple[float, Optional[Dict[str, Any]]]] = {}

_STOP_HEADINGS = {
    "theory table",
    "references",
    "see also",
    "external links",
    "notes",
    "all moves",
    "further reading",
}

_STUB_SNIPPETS = (
    "you can contribute",
    "contributing to this book",
    "expand this page",
    "does not have text on this exact line yet",
)


def build_wikibook_page_title(moves: List[str]) -> str:
    """Convert SAN move list to a Wikibooks Chess Opening Theory page title."""
    parts = ["Chess_Opening_Theory"]
    for idx, san in enumerate(moves):
        clean_san = re.sub(r"[+#!?]+$", "", (san or "").strip())
        if not clean_san:
            break
        move_num = (idx // 2) + 1
        parts.append(f"{move_num}._{clean_san}" if idx % 2 == 0 else f"{move_num}...{clean_san}")
    return "/".join(parts)


_VOID_HTML_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img",
    "input", "link", "meta", "param", "source", "track", "wbr",
}


class _WikibookHtmlExtractor(HTMLParser):
    """Extract clean heading/paragraph sections from MediaWiki parsed HTML without external deps."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._skip_stack: List[str] = []
        self._capture_tag: Optional[str] = None
        self._buf: List[str] = []
        self.blocks: List[Tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        if self._skip_stack:
            if tag not in _VOID_HTML_TAGS:
                self._skip_stack.append(tag)
            return
        attr_map = dict(attrs)
        cls = (attr_map.get("class") or "").lower()
        should_skip = (
            tag in ("table", "style", "script")
            or "infobox" in cls
            or "navbox" in cls
            or "metadata" in cls
            or "mw-editsection" in cls
            or (tag == "sup" and "reference" in cls)
        )
        if should_skip:
            if tag not in _VOID_HTML_TAGS:
                self._skip_stack.append(tag)
            return
        if tag in ("h2", "h3", "h4", "p") and self._capture_tag is None:
            self._capture_tag = tag
            self._buf = []

    def handle_endtag(self, tag: str) -> None:
        if self._skip_stack:
            if tag in self._skip_stack:
                idx = len(self._skip_stack) - 1 - self._skip_stack[::-1].index(tag)
                del self._skip_stack[idx:]
            return
        if self._capture_tag == tag:
            text = re.sub(r"\s+", " ", "".join(self._buf)).strip()
            text = re.sub(r"\[(?:edit|\d+)\]", "", text).strip()
            if text:
                self.blocks.append((tag, text))
            self._capture_tag = None
            self._buf = []

    def handle_data(self, data: str) -> None:
        if self._skip_stack:
            return
        if self._capture_tag is not None:
            self._buf.append(data)


def parse_wikibook_html(raw_html: str) -> Dict[str, Any]:
    """Extract main heading and structured non-empty text sections from Wikibooks HTML."""
    parser = _WikibookHtmlExtractor()
    parser.feed(raw_html or "")
    parser.close()

    title = ""
    sections: List[Dict[str, Any]] = []
    current_heading = ""
    current_paragraphs: List[str] = []
    total_chars = 0

    for tag, text in parser.blocks:
        lower = text.lower().strip(":")
        if tag in ("h2", "h3", "h4"):
            if lower in _STOP_HEADINGS:
                break
            if not title and tag == "h2":
                title = text
                continue
            if current_paragraphs:
                sections.append({"heading": current_heading, "paragraphs": current_paragraphs})
            current_heading = text
            current_paragraphs = []
        elif tag == "p":
            if len(text) < 25 or any(snippet in lower for snippet in _STUB_SNIPPETS):
                continue
            # Skip bare SAN move notation echoes (e.g. "1. e4 c5")
            if re.fullmatch(r"(?:\d+\.+\s*[A-Za-z0-9+=#-]+(?:\s+[A-Za-z0-9+=#-]+)?\s*)+", text):
                continue
            current_paragraphs.append(text)
            total_chars += len(text)
            if total_chars >= 1600 or len(sections) >= 3:
                break

    if current_paragraphs and (not sections or sections[-1]["paragraphs"] is not current_paragraphs):
        sections.append({"heading": current_heading, "paragraphs": current_paragraphs})

    return {"title": title, "sections": sections}


def _wiki_api_get(params: Dict[str, str]) -> Optional[Dict[str, Any]]:
    query = urllib.parse.urlencode({**params, "format": "json"})
    req = urllib.request.Request(
        f"{_WIKIBOOK_API}?{query}",
        headers={"User-Agent": _USER_AGENT, "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        logger.warning(f"[Wikibook] API request failed: {exc}")
    return None


def _existing_candidate_pages(candidate_titles: List[str]) -> List[str]:
    """Batch-check which Wikibooks pages exist (preserving deepest-first priority)."""
    if not candidate_titles:
        return []
    existing_spaces: set[str] = set()
    # MediaWiki query API allows up to 50 titles per call; limit depth to 14 plies for speed.
    data = _wiki_api_get({
        "action": "query",
        "titles": "|".join(candidate_titles),
        "redirects": "1",
    })
    if not data:
        return []

    norm_map: Dict[str, str] = {}
    for item in data.get("query", {}).get("normalized", []):
        norm_map[item.get("to", "")] = item.get("from", "")

    pages = data.get("query", {}).get("pages", {}) or {}
    for pdata in pages.values():
        if "missing" not in pdata and pdata.get("title"):
            existing_spaces.add(pdata["title"])
            if pdata["title"] in norm_map:
                existing_spaces.add(norm_map[pdata["title"]])

    resolved: List[str] = []
    for cand in candidate_titles:
        spaced = cand.replace("_", " ")
        if cand in existing_spaces or spaced in existing_spaces:
            resolved.append(cand)
    return resolved


class WikibookService:
    @staticmethod
    def get_opening_info(
        opening_name: Optional[str] = None,
        moves: Optional[List[str]] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Look up WikiBook opening summary by canonical opening name (falling back to moves).
        Walks back along move prefixes if an obscure variation lacks a dedicated Wikibooks page.
        """
        from src.pgn_parser import find_opening_by_name, find_opening_by_moves

        clean_name = (opening_name or "").strip()
        clean_moves = [m.strip() for m in (moves or []) if m and m.strip()]

        matched_entry = find_opening_by_name(clean_name) if clean_name else None
        if not matched_entry and clean_moves:
            matched_entry = find_opening_by_moves(clean_moves)

        target_moves: List[str] = (
            list(matched_entry.get("moves") or [])
            if matched_entry and matched_entry.get("moves")
            else clean_moves
        )
        if not target_moves:
            return None

        cache_key = f"{clean_name.lower()}::{' '.join(target_moves)}"
        now = time.time()
        cached = _WIKIBOOK_CACHE.get(cache_key)
        if cached and (now - cached[0]) < _CACHE_TTL_SECONDS:
            return cached[1]

        capped = target_moves[:14]
        candidates = [build_wikibook_page_title(capped[:k]) for k in range(len(capped), 0, -1)]
        existing_pages = _existing_candidate_pages(candidates)
        # If redirects resolved canonical titles away from direct string comparison, try top few directly.
        to_try = existing_pages if existing_pages else candidates[:3]

        result: Optional[Dict[str, Any]] = None
        for page_title in to_try:
            parsed_resp = _wiki_api_get({
                "action": "parse",
                "page": page_title,
                "prop": "text|displaytitle",
                "redirects": "1",
            })
            parse_data = (parsed_resp or {}).get("parse")
            if not parse_data:
                continue

            extracted = parse_wikibook_html((parse_data.get("text") or {}).get("*", ""))
            if not extracted["sections"]:
                continue

            resolved_title = str(parse_data.get("title") or page_title.replace("_", " "))
            heading_title = extracted["title"] or clean_name or resolved_title.split("/")[-1]
            page_url = "https://en.wikibooks.org/wiki/" + urllib.parse.quote(resolved_title.replace(" ", "_"), safe="/:")
            display_opening = clean_name or (matched_entry.get("name") if matched_entry else "") or heading_title

            translated_title, translated_sections = _translate_wikibook_to_vi(
                opening_name=display_opening,
                title=heading_title,
                sections=extracted["sections"],
            )

            result = {
                "opening_name": display_opening,
                "eco": (matched_entry or {}).get("eco", ""),
                "title": translated_title,
                "page_title": resolved_title,
                "page_url": page_url,
                "sections": translated_sections,
            }
            break

        _WIKIBOOK_CACHE[cache_key] = (now, result)
        return result


_TRANSLATION_MODELS = (
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash",
)


def _translate_wikibook_to_vi(
    opening_name: str,
    title: str,
    sections: List[Dict[str, Any]],
) -> Tuple[str, List[Dict[str, Any]]]:
    """Translate WikiBook opening theory title/sections into natural Vietnamese chess prose."""
    if not sections:
        return title, sections

    try:
        from src.ai_assistant.config import get_server_gemini_api_key
        api_key = (get_server_gemini_api_key() or "").strip()
    except Exception:
        api_key = ""

    if not api_key:
        return title, sections

    trimmed_sections = [
        {
            "heading": str(sec.get("heading") or ""),
            "paragraphs": [str(p) for p in (sec.get("paragraphs") or [])[:2]],
        }
        for sec in sections[:3]
    ]
    payload_in = {
        "title": title,
        "sections": trimmed_sections,
    }

    prompt = (
        "Dịch nội dung lý thuyết khai cuộc cờ vua sau từ tiếng Anh sang tiếng Việt tự nhiên, súc tích, chuẩn thuật ngữ cờ vua Việt Nam "
        "(ví dụ: Tốt, Mã, Tượng, Xe, Hậu, Vua, nhập thành, trung tâm, ô yếu, phản công, chuyển thế/transposition). "
        "Giữ nguyên các ký hiệu nước đi đại số (như 1. d4, 2...g6, Nf3, c4, e5) và giữ nguyên cấu trúc JSON đầu vào. "
        "Không thêm lời giải thích ngoài JSON.\n"
        f"Khai cuộc: {opening_name}\n"
        f"Dữ liệu JSON:\n{json.dumps(payload_in, ensure_ascii=False)}"
    )

    body = json.dumps({
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }).encode("utf-8")

    for model in _TRANSLATION_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        req = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status != 200:
                    continue
                raw_resp = json.loads(resp.read().decode("utf-8"))
            text = (
                raw_resp.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
                .strip()
            )
            if not text:
                continue
            if text.startswith("```"):
                text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text).strip()
            parsed = json.loads(text)
            vi_sections_raw = parsed.get("sections")
            if not isinstance(vi_sections_raw, list) or len(vi_sections_raw) != len(trimmed_sections):
                continue

            vi_sections: List[Dict[str, Any]] = []
            for orig_sec, vi_sec in zip(trimmed_sections, vi_sections_raw):
                if not isinstance(vi_sec, dict):
                    raise ValueError("Invalid translated section")
                vi_paras = vi_sec.get("paragraphs")
                if not isinstance(vi_paras, list) or not vi_paras:
                    vi_paras = orig_sec["paragraphs"]
                vi_sections.append({
                    "heading": str(vi_sec.get("heading") if vi_sec.get("heading") is not None else orig_sec["heading"]),
                    "paragraphs": [str(p) for p in vi_paras],
                })

            vi_title = str(parsed.get("title") or title)
            return vi_title, vi_sections
        except Exception as exc:
            logger.debug(f"[Wikibook] Translation attempt failed on {model}: {exc}")
            continue

    return title, sections
