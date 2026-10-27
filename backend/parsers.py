import io
import re
from collections import Counter
from typing import List

import pymupdf
import docx
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup

_PAGE_NUMBER_RE = re.compile(r"^(page\s*)?\d{1,4}(\s*(of|/)\s*\d{1,4})?$", re.IGNORECASE)


def _normalize_margin_line(line: str) -> str:
    # Running headers often differ only by the page number.
    return re.sub(r"\d+", "#", line.strip().lower())


def _strip_running_headers(pages: List[List[str]]) -> List[List[str]]:
    """Drop page numbers and header/footer lines that repeat on most pages."""
    if len(pages) < 3:
        return [[l for l in p if not _PAGE_NUMBER_RE.match(l.strip())] for p in pages]
    margin_counts: Counter = Counter()
    for lines in pages:
        margin = {_normalize_margin_line(l) for l in lines[:2] + lines[-2:] if l.strip()}
        margin_counts.update(margin)
    threshold = max(3, int(len(pages) * 0.6))
    repeated = {k for k, c in margin_counts.items() if c >= threshold}

    cleaned = []
    for lines in pages:
        keep = []
        for i, line in enumerate(lines):
            in_margin = i < 2 or i >= len(lines) - 2
            if in_margin and (_normalize_margin_line(line) in repeated or _PAGE_NUMBER_RE.match(line.strip())):
                continue
            keep.append(line)
        cleaned.append(keep)
    return cleaned


def _join_pdf_lines(lines: List[str]) -> str:
    """Re-flow hard-wrapped lines into paragraphs and undo end-of-line hyphenation."""
    text = "\n".join(lines)
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)          # hyphen-\nated -> hyphenated
    text = re.sub(r"[ \t]*\n[ \t]*\n+", "\n\n", text)        # keep paragraph breaks
    text = re.sub(r"(?<!\n)\n(?!\n)", " ", text)            # single newlines are soft wraps
    return re.sub(r"[ \t]{2,}", " ", text).strip()


def parse_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF using pymupdf, without running headers, footers or page numbers."""
    doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    pages = []
    for page in doc:
        # Block-level extraction keeps paragraph boundaries between text blocks.
        blocks = page.get_text("blocks", sort=True)
        lines: List[str] = []
        for block in blocks:
            if len(block) > 6 and block[6] != 0:  # skip image blocks
                continue
            block_text = block[4].strip()
            if block_text:
                lines.extend(block_text.splitlines())
                lines.append("")
        pages.append(lines)

    pages = _strip_running_headers([[l for l in p] for p in pages])
    pages_text = [_join_pdf_lines(p) for p in pages]
    return "\n\n".join(t for t in pages_text if t)

def parse_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX using python-docx."""
    doc = docx.Document(io.BytesIO(file_bytes))
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)

_HEADING_LEVELS = {"h1": "#", "h2": "##", "h3": "###", "h4": "####", "h5": "#####", "h6": "######"}
_BLOCK_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "blockquote", "pre"]


def _epub_html_to_markdown(html: bytes) -> str:
    """Convert a chapter to light Markdown, keeping headings so the reader's TOC works."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav"]):
        tag.decompose()
    body = soup.body or soup
    parts: List[str] = []
    for el in body.find_all(_BLOCK_TAGS):
        # Skip containers whose text is emitted by a nested block element.
        if el.find(_BLOCK_TAGS):
            continue
        text = re.sub(r"\s+", " ", el.get_text(" ")).strip()
        if not text:
            continue
        if el.name in _HEADING_LEVELS:
            parts.append(f"{_HEADING_LEVELS[el.name]} {text}")
        elif el.name == "li":
            parts.append(f"- {text}")
        else:
            parts.append(text)
    if not parts:
        fallback = body.get_text(separator="\n").strip()
        return fallback
    return "\n\n".join(parts)


def parse_epub(file_bytes: bytes) -> str:
    """Extract text from ePub in reading (spine) order, preserving chapter headings."""
    book = epub.read_epub(io.BytesIO(file_bytes))
    ordered = []
    seen = set()
    for idref, _linear in book.spine:
        item = book.get_item_with_id(idref)
        if item is not None and item.get_type() == ebooklib.ITEM_DOCUMENT:
            ordered.append(item)
            seen.add(item.get_id())
    # Documents missing from the spine (rare) are appended rather than lost.
    for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
        if item.get_id() not in seen:
            ordered.append(item)

    sections = []
    for item in ordered:
        text = _epub_html_to_markdown(item.get_content())
        if text:
            sections.append(text)
    return "\n\n".join(sections)

def parse_text(file_bytes: bytes) -> str:
    """Extract text from plain text or Markdown with UTF-8 fallback."""
    try:
        return file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return file_bytes.decode("latin-1", errors="replace")
