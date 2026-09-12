import os
import re
import json
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Optional
from backend.cleaner import clean_text_for_speech

# Base storage directory: defaults to data/documents in the project root
BASE_DATA_DIR = os.environ.get("DATA_DIR", os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "documents")))

def chunk_text(text: str, min_chars: int = 250, max_chars: int = 500) -> List[Dict]:
    """
    Split text into semantic blocks between min_chars and max_chars.
    Breaks on paragraphs and sentence boundaries.
    Generates both visual raw `text` and cleaned `speech_text` for TTS.
    """
    cleaned = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not cleaned:
        return []

    # Split into candidate paragraphs
    raw_paragraphs = [p.strip() for p in cleaned.split("\n\n") if p.strip()]
    
    # Split paragraphs into sentences if needed
    units = []
    sentence_splitter = re.compile(r'(?<=[.!?])\s+')
    for p in raw_paragraphs:
        # Check if paragraph has multiple lines or sentences
        sentences = sentence_splitter.split(p)
        for s in sentences:
            s_clean = s.strip()
            if s_clean:
                units.append(s_clean)
        # Empty marker to represent paragraph break
        units.append("")

    chunks = []
    current_parts = []
    current_len = 0

    def add_chunk(parts: List[str]):
        block_text = " ".join(parts).strip()
        if not block_text:
            return
        speech_text = clean_text_for_speech(block_text) or block_text
        chunks.append({
            "id": len(chunks),
            "text": block_text,
            "speech_text": speech_text,
            "char_count": len(block_text)
        })

    for unit in units:
        if unit == "":
            # Paragraph boundary: if current buffer has reached min_chars, flush it
            if current_len >= min_chars:
                add_chunk(current_parts)
                current_parts = []
                current_len = 0
            continue

        unit_len = len(unit)

        # If adding this unit exceeds max_chars and we already have content
        if current_len + unit_len + (1 if current_parts else 0) > max_chars:
            if current_parts:
                add_chunk(current_parts)
                current_parts = []
                current_len = 0

        # If a single sentence is larger than max_chars, split by sub-clauses or words
        if unit_len > max_chars:
            words = unit.split()
            word_buf = []
            word_len = 0
            for w in words:
                if word_len + len(w) + 1 > max_chars:
                    if word_buf:
                        add_chunk(word_buf)
                        word_buf = []
                        word_len = 0
                word_buf.append(w)
                word_len += len(w) + 1
            if word_buf:
                current_parts = word_buf
                current_len = sum(len(w) for w in word_buf) + len(word_buf) - 1
        else:
            current_parts.append(unit)
            current_len += unit_len + (1 if len(current_parts) > 1 else 0)

    if current_parts:
        add_chunk(current_parts)

    return chunks


def save_document(doc_id: str, title: str, source_type: str, text: str, chunks: List[Dict], tags: Optional[List[str]] = None) -> str:
    """Save document metadata, raw markdown, and chunks in the storage directory."""
    doc_dir = os.path.join(BASE_DATA_DIR, doc_id)
    os.makedirs(doc_dir, exist_ok=True)
    os.makedirs(os.path.join(doc_dir, "audio_cache"), exist_ok=True)

    meta = {
        "id": doc_id,
        "title": title,
        "source_type": source_type,
        "tags": [t.strip().lower() for t in (tags or []) if t and t.strip()],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "block_count": len(chunks),
        "total_chars": len(text)
    }

    with open(os.path.join(doc_dir, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    with open(os.path.join(doc_dir, "document.md"), "w", encoding="utf-8") as f:
        f.write(text)

    with open(os.path.join(doc_dir, "chunks.json"), "w", encoding="utf-8") as f:
        json.dump(chunks, f, indent=2)

    return doc_dir

def generate_doc_id() -> str:
    return uuid.uuid4().hex[:12]
