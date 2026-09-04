# Implementation Checklist

## Phase 1: Environment & Project Scaffolding
- [x] Initialize Git repository (if uninitialized) and configure `.gitignore` for Python, Node, and `/data/`.
- [x] Scaffold FastAPI backend directory (`/backend`) with dependencies (`fastapi`, `uvicorn`, `pydantic`, `httpx`).
- [x] Scaffold Vite frontend directory (`/frontend`) with Tailwind CSS.
- [x] Implement reverse proxy / static mount so port 9025 serves both backend API (`/api/*`) and frontend SPA.
- [x] Verify setup by querying `GET /api/health` on port 9025.

## Phase 2: Ingestion & Parsing Engine
- [x] Install ingestion libraries (`pymupdf`, `ebooklib`, `python-docx`, `trafilatura`, `beautifulsoup4`).
- [x] Implement text parsers for PDF, ePub, DOCX, and raw text.
- [x] Implement URL extraction route `POST /api/documents/url` with `trafilatura`.
- [x] Implement file upload route `POST /api/documents/upload`.
- [x] Implement manual creation route `POST /api/documents/create`.
- [x] Build chunking utility: split ingested text into 250–500 char blocks and save `meta.json`, `document.md`, and `chunks.json` to `/data/documents/<id>/`.

## Phase 3: Universal TTS Integration & Audio Caching
- [x] Implement upstream client wrapper for Universal TTS (`/v1/models` and `/v1/audio/speech`).
- [x] Create endpoint `GET /api/models` with search/filter proxy support.
- [x] Implement `POST /api/documents/{id}/blocks/{block_id}/audio`:
  - Compute cache key: `sha256(block_text + voice + model + speed)`.
  - Check local disk cache; if missed, request synthesis from upstream Universal TTS and save to `audio_cache/`.
- [x] Add cache invalidation and document deletion logic (`DELETE /api/documents/{id}`).

## Phase 4: Reader UI & Document Navigation
- [x] Build Library View: document grid/list showing title, excerpt, creation date, and delete action.
- [x] Build Document Reader View: render blocks sequentially with `data-block-id` attributes.
- [ ] Implement inline text search to jump to and highlight matching blocks.
- [ ] Add display options drawer: font size, line spacing, and theme switcher (Light, Warm Sepia, OLED Dark).

## Phase 5: Audio Player & Lookahead Sliding Buffer
- [ ] Build sticky bottom player with Play/Pause, jump $\pm 10$s, speed selector, and searchable model dropdown.
- [ ] Implement click-to-play on individual text blocks.
- [ ] Implement lookahead prefetch: trigger background fetch for blocks $N+1$ and $N+2$ while block $N$ plays.
- [ ] Implement continuous playback: auto-advance to next block upon audio termination.
- [ ] Run end-to-end smoke tests on ingestion, playback, and cache persistence.

