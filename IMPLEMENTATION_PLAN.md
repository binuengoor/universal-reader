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

## Phase 9: LLM Title & Tag Generation, Tag Autocomplete, LLM Tasks & Batch Jobs
- [x] Implement backend LLM title and tag generator in `backend/cleaner.py` with 50-tag global constraint logic.
- [x] Update document ingestion routes (`/create`, `/url`, `/upload`) to auto-generate title & tags via LLM when unspecified.
- [x] Implement tags management endpoints (`GET /api/tags`, `POST /api/tags/rename`) and LLM batch jobs endpoint (`POST /api/documents/batch-llm`).
- [x] Add backend unit tests for title/tag generation, 50-tag limit, tag rename/merge, and batch jobs.
- [x] Build interactive `TagInput` component with live matching autocomplete from existing library tags.
- [x] Integrate `TagInput` in `LibraryView` modals (URL, Scratchpad, Upload) and `DocumentEditor`.
- [x] Update `SettingsModal` to rename "AI Text Cleaner" to "LLM Engine", add "LLM Tasks & Batch Jobs" tab, and Tag Health / Consolidation Manager.
- [x] Add Reader View QoL enhancements: word count, estimated reading/listening time badges, and tag chips in header.
- [x] Run full backend pytest suite, frontend build, rebuild Docker container, and verify live.

## Phase 10: State-Tracked Batch LLM, Persistent Global Player & Reader Power Suite
- [x] Implement SHA-256 content_hash calculation, llm_state metadata persistence, and smart skipping in backend/routes.py and backend/chunking.py.
- [x] Implement Pronunciation Glossary configuration in backend/config.py and phonetic replacements in backend/cleaner.py.
- [x] Implement Document Status Lifecycle (inbox/reading/archived), favorite, and last_block_index progress tracking in backend routes.
- [x] Write backend unit tests in backend/tests/test_phase10_features.py and verify all test suites pass.
- [x] Implement Pronunciation Glossary editor and Batch Results feedback counters in frontend/src/components/SettingsModal.jsx.
- [x] Implement Global Persistent Audio Player with floating mini-player bar across all views and sleep timer.
- [x] Implement Library Status Tabs (All/Inbox/Reading/Archived/Favorites), Quick Archive/Star toggles, and Full-Text search in frontend/src/components/LibraryView.jsx.
- [x] Implement Keyboard Shortcuts HUD (?) and PWA Web Share Target handling in frontend/src/App.jsx and manifest.json.
- [x] Build frontend, verify end-to-end, commit, push to GitHub, monitor CI, and deploy to oracle-xmillionmax:3003.

## Phase 11: Dynamic Dropdowns for Model and Voice Configuration
- [x] Convert Default Model into a dynamic dropdown fed from `GET /api/models` (with robust standard fallbacks).
- [x] Convert Default Voice from plain text input into a dynamic `<select>` dropdown populated from `availableVoices` matching the selected model/engine.
- [x] Add popular preset model suggestions (Groq, Cerebras, OpenAI, Anthropic) to LLM Model Name via HTML datalist dropdown.
- [x] Build frontend, rebuild local Docker container on port 3003, commit, push to `main`, and deploy to `oracle-xmillionmax:3003`.

## Phase 12: Standardized Cohesive Theme System (Home, Players, Modals)
- [x] Create standardized semantic theme palette helper in `frontend/src/utils/theme.js` unifying Light, Warm Sepia (`#fbf0d9`), and OLED Dark styling.
- [x] Refactor `LibraryView.jsx` to use theme tokens for header, buttons, search input, status tabs, document cards, tag chips, and intake modals.
- [x] Refactor `AudioPlayer.jsx` and `MiniPlayer.jsx` to use theme tokens for tracks, controls, block badges, speed menus, and voice popovers.
- [x] Refactor `DisplaySettingsDrawer.jsx` and `KeyboardShortcutsModal.jsx` to adapt seamlessly to active theme.
- [x] Validate changes via `./backend/venv/bin/pytest backend/tests -q` and `npm run build`, and verify live rendering.

## Phase 13: Lock-Screen Controls, Auto-Scroll Follow-Along & Auto-Resume (Option A)
- [x] Implement MediaSession API integration in `frontend/src/App.jsx` for lock-screen / Bluetooth controls (play, pause, next block, prev block, seek, title & block metadata).
- [x] Implement smooth auto-scroll follow-along in `ReaderView.jsx` to keep the active playing block centered, with user manual scroll override and resume indicator.
- [x] Implement auto-resume to `last_block_index` upon opening a document in `ReaderView.jsx`.
- [x] Validate with frontend test/build, commit, push, and deploy to `oracle-xmillionmax`.

## Phase 14: Chapter Navigation (Table of Contents) & Playback Timing Customization (Option B)
- [x] Implement Table of Contents parser in frontend to extract headings (`#`, `##`, `###`) and render a jump-to-chapter drawer/menu.
- [x] Implement configurable inter-block pause / silence buffer in `backend/config.py` and frontend playback loop in `App.jsx`.
- [x] Add unit tests for inter-block pause settings and heading navigation.
- [x] Build, verify end-to-end, commit, push, and deploy to `oracle-xmillionmax`.

## Phase 15: TTS Sanitization Hardening, Universal Theme Control & PWA Cache Busting
- [x] Strip horizontal rules (`---`) and stray hash characters (`#`) unconditionally from TTS speech text.
- [x] Fix audio synthesis route so `clean_text_for_speech` is always enforced on block audio synthesis even if pre-populated in `chunks.json`.
- [x] Reformat markdown code blocks (```) and tables into natural spoken sentences and conversational summaries in `backend/cleaner.py`.
- [x] Upgrade tag and badge color palettes across Light, Warm Sepia, and OLED Dark themes for high contrast and legibility.
- [x] Add global Theme / Display Options button (`Aa`) across all views: Library View (home), Document Editor, and Reader View.
- [x] Make Table of Contents (Chapters) button permanently visible in Reader View with guided empty state when headings are missing.
- [x] Fix PWA Service Worker caching by switching HTML navigation to strict Network-First, bumping cache version to `v3`, adding `Cache-Control: no-cache` for entry files, and clearing stale audio disk caches on server.

## Phase 16: Mobile Safe-Area Polish, Zen Mode / Player Collapse & LLM Card Synopsis
- [x] Fix PWA header safe-area insets: Apply `pt-safe` padding (`padding-top: max(0.75rem, env(safe-area-inset-top, 0px))`) across `LibraryView`, `ReaderView`, and `DocumentEditor`.
- [x] Implement Collapsible Audio Player in `AudioPlayer.jsx` (one-tap toggle between full controls and ultra-compact mini-bar) and streamline mobile reader header.
- [x] Implement LLM Synopsis generation in `backend/cleaner.py` and `backend/routes.py` (punchy card summaries fitting 120–180 chars) for intakes and batch jobs.
- [x] Update `LibraryView.jsx` to render high-value note synopses on cards, and add "Generate Synopses" batch trigger in `SettingsModal.jsx`.
- [x] Validate changes via automated tests, build, commit, push, and deploy to `oracle-xmillionmax`.


