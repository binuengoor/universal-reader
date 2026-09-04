# System Specification: Universal TTS Reader

## Core Architecture
- **Port**: 9025 (Dev & Production reverse proxy / unified frontend-backend host).
- **Backend**: FastAPI (Python 3.11+).
- **Frontend**: Vite SPA (React or Svelte) served alongside backend.
- **Upstream Service**: Universal TTS running on local network (OpenAI-compatible `/v1/audio/speech` and `/v1/models`).

## Storage Layout
/data/documents/<doc_id>/
├── meta.json             # {"id", "title", "source_type", "created_at"}
├── document.md           # Raw ingested text
├── chunks.json           # Array of {"id": int, "text": str, "char_count": int}
└── audio_cache/          # Cached MP3s: <block_id>_<voice>_<hash>.mp3

## Features
1. **Intake**:
   - File uploads: PDF (`pymupdf`), ePub (`ebooklib`), DOCX (`python-docx`), Markdown (`.md`, `.txt`).
   - URL Ingestion: Scrape clean article Markdown via `trafilatura`.
   - Text Scratchpad: Manual entry with fallback title `Doc - YYYY-MM-DD HH:mm`.
2. **Chunking Engine**:
   - Split Markdown into semantic blocks (250–500 characters, breaking on punctuation/paragraphs).
3. **Reader & Audio Engine**:
   - DOM blocks tagged with `data-block-id="<index>"`.
   - Sliding window audio buffer: when block N plays, request and cache audio for blocks N+1 and N+2.
   - Global floating player with searchable voice/model selector, speed controls (0.75x–2.0x), and Kindle display settings (light, sepia, OLED dark, font scaling).

