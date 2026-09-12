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
- [x] Implement inline text search to jump to and highlight matching blocks.
- [x] Add display options drawer: font size, line spacing, and theme switcher (Light, Warm Sepia, OLED Dark).

## Phase 5: Audio Player & Lookahead Sliding Buffer
- [x] Build sticky bottom player with Play/Pause, jump $\pm 10$s, speed selector, and searchable model dropdown.
- [x] Implement click-to-play on individual text blocks.
- [x] Implement lookahead prefetch: trigger background fetch for blocks $N+1$ and $N+2$ while block $N$ plays.
- [x] Implement continuous playback: auto-advance to next block upon audio termination.
- [x] Run end-to-end smoke tests on ingestion, playback, and cache persistence.

## Phase 6: Document Editing & Universal TTS Settings Panel
- [x] Implement backend dynamic config management (`backend/config.py`) storing settings at `/data/config.json`.
- [x] Implement backend settings endpoints (`GET /api/settings`, `POST /api/settings`, `POST /api/settings/test`).
- [x] Implement document editing endpoints (`GET /api/documents/{doc_id}/raw` and `PUT /api/documents/{doc_id}`) with re-chunking and audio cache flushing.
- [x] Implement voice listing endpoint (`GET /api/voices`) proxying 379+ available voices across Edge TTS, Piper, and Kokoro.
- [x] Build Document Editor interface (`DocumentEditor.jsx`) for modifying title & raw markdown, saving with live re-chunking.
- [x] Build Settings modal (`SettingsModal.jsx`) for configuring Universal TTS URL, API key, default model (`edge-tts` zero-CPU default), default voice, and connection testing.
- [x] Wire Edit & Settings triggers in Library View and Reader View headers.
- [x] Rebuild container and verify end-to-end functionality on port 9025.

## Phase 7: Library Management, Tags, Prioritized Full Audio & Export
- [x] Implement backend tags support in `meta.json` (`CreateDocRequest`, `UpdateDocRequest`, `GET /api/documents`).
- [x] Implement bulk deletion endpoint `POST /api/documents/bulk-delete` in backend.
- [x] Implement full document audio concatenation / download endpoint `GET /api/documents/{doc_id}/export-audio`.
- [x] Update `DocumentEditor.jsx` to support tag creation and removal.
- [x] Build prioritized audio scheduler (`frontend/src/utils/priorityAudioQueue.js`) with low-priority background whole-note generation that pauses for high-priority foreground playback.
- [x] Update `LibraryView.jsx` with search bar, tag filtering chips, sort options, bulk selection/delete mode, estimated listening times, and reading progress bars.
- [x] Update `ReaderView.jsx` and `AudioPlayer.jsx` with "Generate All Audio" button, background progress pill, and "Download MP3" action.
- [x] Verify functionality with automated tests, oxlint, build, and live Docker verification on port 3003.

## Phase 8: Mobile Polish & PWA, Markdown Rendering, Text Cleanup Pipeline, & Scoped Models
- [x] Implement text cleaner engine (`backend/cleaner.py`) with emoji/syntax regex filters and OpenAI-compatible LLM text cleaner.
- [x] Update backend config (`backend/config.py`) and settings endpoints (`backend/routes.py`) for scoped voices and LLM settings.
- [x] Update chunking engine (`backend/chunking.py`) and audio generation (`backend/routes.py`) to generate and utilize `speech_text`.
- [x] Add backend unit tests for text cleaner, LLM integration, and scoped settings.
- [x] Implement frontend markdown rendering in `ReaderView.jsx` and responsive mobile layout / gutter adjustments.
- [x] Update `SettingsModal.jsx` with Scoped Voices selector, LLM configuration, and connection testing.
- [x] Update `AudioPlayer.jsx` with mobile-first responsive layout, safe-area padding, and Scoped Voices filter toggle.
- [x] Update `App.jsx` to load and synchronize default voice/model and settings dynamically on mount.
- [x] Add PWA support: `manifest.json`, high-res icons, and Service Worker caching in `frontend/`.
- [x] Run full test suite, linting, production build, and verify end-to-end.



