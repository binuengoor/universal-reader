# Universal Reader 📖🎧

**Universal Reader** is a self-hosted, local-first semantic document reader and audio synthesizer. It transforms digital documents, web articles, and scratchpad notes into cleanly formatted, distraction-free reading views paired with continuous, high-quality Text-to-Speech (TTS) narration.

Designed for long-form listening, deep reading, and personal knowledge management (PKM), it bridges local TTS engines (Edge TTS, Kokoro neural voices, Piper, Google Cloud) and LLM-assisted text normalization with a modern, Kindle-grade reading experience.

---

## 🌟 Key Features

### 📚 Multiformat Intake & Ingestion
* **File Uploads**: Native parsing for **PDF** (`pymupdf`), **ePub** (`ebooklib`), **Word** (`.docx`), **Markdown** (`.md`), and raw text (`.txt`).
* **Web Article Ingestion**: Clean boilerplate removal, title extraction, and markdown conversion powered by `trafilatura`.
* **Quick Scratchpad**: Instant manual entry for transcripts, thoughts, and pasted notes with auto-titling fallback.
* **PWA Web Share Target**: Share articles and links directly from mobile browsers (iOS/Android) into Universal Reader with one tap.

### 🧠 Semantic Chunking & Audio Narration
* **Sentence-Boundary Chunking**: Splits texts into digestible 250–500 character blocks without breaking thoughts or mid-sentence phrases.
* **Lookahead Sliding Buffer**: While block $N$ is playing, blocks $N+1$ and $N+2$ are pre-fetched and synthesized in the background for zero-latency gapless playback.
* **Continuous Playback**: Auto-advances across paragraphs with a configurable **inter-block natural pause** (0ms–1500ms) to ensure conversational pacing.
* **Background Full-Note Generation**: Prioritized queue allows whole-document audio generation in the background without interrupting foreground playback.
* **Single MP3 Export**: Concatenates and downloads the full document narration as an MP3 file.

### 🎙️ Conversational Speech Pre-Processor
* **Markdown Sanitization**: Automatically strips raw URLs, citation brackets (`[1]`), image tags, horizontal rules (`---`), and stray heading hashes (`#`) so TTS never reads literal syntax or "hash hash hash".
* **Table-to-Speech Conversion**: Automatically transforms markdown tables (`| col | col |`) into flowing, natural spoken sentences rather than reciting raw pipes.
* **Code Block Formatting**: Converts shell commands and code snippets (` ```lang ... ``` `) into spoken descriptions (e.g., *"Command in bash: docker compose up -d"*) rather than reciting brackets, semicolons, and syntax noise.
* **Phonetic Glossary**: Custom pronunciation manager allowing users to define phonetic substitutions for tricky jargon, acronyms, or names.
* **LLM Engine**: Optional integration with OpenAI-compatible LLMs (e.g., Groq `qwen/qwen3.8-27b`) for automated note titling, categorization (max 50 global tags), and deep conversational speech rewriting.

### 📖 Kindle-Style Reader & Navigation
* **Universal Display Control (`Aa`)**: Seamlessly switch themes and typography globally from Library, Reader, or Document Editor.
* **Themes**:
  * **Warm Sepia** (`#fbf0d9` parchment with rich espresso `#433422` typography).
  * **Clean Light** (Crisp modern paper aesthetic).
  * **OLED Dark** (True deep blacks with softened high-contrast text).
* **Typography Controls**: Bookerly / Serif, Modern Sans, Technical Mono, font scaling (14px–32px), line spacing (1.4x, 1.7x, 2.1x), and column width limits.
* **Interactive Table of Contents**: Automatically detects Markdown headings (`#`, `##`, `###`) to generate an interactive chapter/section drawer with block badges and active-chapter tracking.
* **Smooth Follow-Along Auto-Scroll**: Keeps the active playing block centered in view. Includes a non-intrusive manual scroll override that pauses follow-along when reading ahead, with a one-click *"Resume"* floating pill.
* **Auto-Resume**: Remembers `last_block_index` per document and automatically scrolls directly to your saved position on open.
* **Inline Full-Text Search**: Fast in-document keyword search (`Cmd+F` / `Ctrl+F`) with match cycling and highlight overlays.

### 🎵 Global Persistent Audio Suite
* **Sticky Bottom Player**: Full playback controls, $\pm 10$s jump, speed selector ($0.75\times$ to $2.0\times$), block indicators, and sleep timer (15m, 30m, 45m, 60m, or end of document).
* **Floating Mini-Player**: Unobtrusive mini-bar persists across Library and Editor views, allowing continuous listening while organizing your vault.
* **MediaSession API Integration**: Native hardware media keys, Bluetooth headset controls, and lock-screen controls (iOS/Android/macOS/Windows) with real-time scrub position and block metadata.
* **Voice & Engine Picker**: Multi-engine filtering across Edge TTS, Kokoro neural voices, Piper, and Google Cloud with language selection and a "Scoped Voices" favorite manager.

---

## 🏗️ Architecture & Stack

```
                     ┌─────────────────────────────────────────┐
                     │          Universal Reader (9025)        │
                     │                                         │
                     │   ┌─────────────────────────────────┐   │
                     │   │   Vite React SPA (Tailwind CSS) │   │
                     │   └───────────────▲─────────────────┘   │
                     │                   │ /api/*              │
                     │   ┌───────────────▼─────────────────┐   │
                     │   │      FastAPI Backend Engine     │   │
                     │   └──────┬───────────────┬──────────┘   │
                     └──────────┼───────────────┼──────────────┘
                                │               │
                OpenAI Speech   │               │ Chat Completions
                API Proxy       │               │ (Auto-title, cleanup)
                                ▼               ▼
                      ┌──────────────────┐ ┌──────────────────┐
                      │  Universal TTS   │ │     Groq LLM     │
                      │  (Port 8880)     │ │  (API Endpoint)  │
                      └──────────────────┘ └──────────────────┘
```

* **Backend**: Python 3.11+ / FastAPI, Uvicorn, Pydantic, HTTPX.
* **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Marked, DOMPurify.
* **Unified Host**: Port `9025` inside container (mapped to `3003` in Docker Compose). Backend serves both the REST API under `/api/*` and the static SPA.
* **Storage**: Local filesystem per document under `/data/documents/<doc_id>/`. Zero external database dependencies (SQLite/Postgres not required).

---

## 📂 Storage Layout

```text
/data/
├── config.json              # Global settings, voices, glossary, LLM credentials
└── documents/
    └── <doc_id>/
        ├── meta.json        # Title, tags, source type, dates, reading progress
        ├── document.md      # Raw ingested markdown / text
        ├── chunks.json      # Array of semantic blocks, hashes, speech_text
        └── audio_cache/     # Disk-cached MP3s: <block_id>_<voice>_<hash>.mp3
```

---

## 🚀 Quick Start (Docker Compose)

### 1. `docker-compose.yml`

```yaml
services:
  universal-reader:
    image: ghcr.io/binuengoor/universal-reader:latest
    container_name: universal-reader
    restart: unless-stopped
    ports:
      - "3003:9025"
    volumes:
      - ./data:/data
    environment:
      - TTS_BASE_URL=http://universal-speech:8880
      - TTS_API_KEY=your-tts-key-if-any
      - DEFAULT_MODEL=edge-tts
      - DEFAULT_VOICE=en-US-ChristopherNeural
      - LLM_BASE_URL=https://api.groq.com/openai/v1
      - LLM_API_KEY=gsk_your_groq_api_key
      - LLM_MODEL=qwen/qwen3.8-27b
```

### 2. Start the Container

```bash
docker compose pull
docker compose up -d
```

Open your browser at `http://localhost:3003`.

---

## 🛠️ Local Development

### Prerequisites
* Python 3.11+
* Node.js 20+ & npm

### Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 9025 --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Running Backend Tests
```bash
./backend/venv/bin/pytest backend/tests -q
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Space` | Toggle Play / Pause audio |
| `J` / `K` | Jump to Next / Previous block |
| `[` / `]` | Decrease / Increase playback speed ($\pm 0.1\times$) |
| `0` | Reset playback speed to $1.0\times$ |
| `Cmd` + `F` / `Ctrl` + `F` | Open in-document search |
| `Esc` | Close drawers/modals, or return to Library |
| `?` | Toggle Keyboard Shortcuts HUD |

---

## 📡 API Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Healthcheck endpoint (`{"status": "ok"}`) |
| `GET` | `/api/documents` | List documents with metadata, tags, and progress |
| `POST` | `/api/documents/upload` | Upload and chunk file (PDF, ePub, DOCX, MD, TXT) |
| `POST` | `/api/documents/url` | Ingest web article via Trafilatura |
| `POST` | `/api/documents/create` | Create document from scratchpad text |
| `GET` | `/api/documents/{id}` | Get document metadata and chunk blocks |
| `PUT` | `/api/documents/{id}` | Edit markdown & re-chunk with cache invalidation |
| `DELETE` | `/api/documents/{id}` | Delete document and audio cache |
| `POST` | `/api/documents/bulk-delete`| Delete multiple documents simultaneously |
| `GET` | `/api/documents/{id}/blocks/{b}/audio` | Fetch or synthesize block MP3 audio |
| `GET` | `/api/documents/{id}/export-audio` | Concatenate and export full document MP3 |
| `GET` | `/api/settings` | Get current TTS, LLM, glossary, and pause settings |
| `POST` | `/api/settings` | Update runtime settings and persist to `/data/config.json` |
| `GET` | `/api/voices` | Proxy available voices across all engines |
| `GET` | `/api/models` | Proxy available TTS models |
| `GET` | `/api/tags` | List all unique category tags across the library |
| `POST` | `/api/tags/rename` | Rename or merge global tags |
| `POST` | `/api/documents/batch-llm` | Batch LLM jobs (auto-title, tags, clean text) |

---

## 📄 License

MIT License. Built for local, private, and distraction-free reading and listening.
