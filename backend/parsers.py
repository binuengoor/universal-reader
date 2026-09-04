import io
import pymupdf
import docx
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup

def parse_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF using pymupdf."""
    doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    pages_text = []
    for page in doc:
        text = page.get_text()
        if text.strip():
            pages_text.append(text.strip())
    return "\n\n".join(pages_text)

def parse_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX using python-docx."""
    doc = docx.Document(io.BytesIO(file_bytes))
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)

def parse_epub(file_bytes: bytes) -> str:
    """Extract text from ePub using ebooklib and BeautifulSoup."""
    book = epub.read_epub(io.BytesIO(file_bytes))
    sections = []
    for item in book.get_items():
        if item.get_type() == ebooklib.ITEM_DOCUMENT:
            soup = BeautifulSoup(item.get_content(), "html.parser")
            text = soup.get_text(separator="\n").strip()
            if text:
                sections.append(text)
    return "\n\n".join(sections)

def parse_text(file_bytes: bytes) -> str:
    """Extract text from plain text or Markdown with UTF-8 fallback."""
    try:
        return file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return file_bytes.decode("latin-1", errors="replace")
