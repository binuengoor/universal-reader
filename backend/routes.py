import os
import json
import shutil
import trafilatura
from datetime import datetime, timezone
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from .parsers import parse_pdf, parse_docx, parse_epub, parse_text
from .chunking import chunk_text, save_document, generate_doc_id, BASE_DATA_DIR
from .tts import tts_client, get_audio_filename, UniversalTTSClient
from .config import load_settings, save_settings

router = APIRouter(prefix="/api/documents", tags=["documents"])
models_router = APIRouter(prefix="/api/models", tags=["models"])

@models_router.get("")
async def get_models(search: Optional[str] = None, q: Optional[str] = None):
    """List available TTS models with search/filter support."""
    query = search or q
    err_msg = None
    upstream_available = True
    try:
        resp = await tts_client.list_models()
        if isinstance(resp, dict) and "data" in resp:
            models = resp["data"]
        elif isinstance(resp, list):
            models = resp
        else:
            models = [resp]
    except Exception as e:
        upstream_available = False
        err_msg = str(e)
        models = [
            {"id": "tts-1", "name": "TTS 1 (Standard)"},
            {"id": "tts-1-hd", "name": "TTS 1 HD (High Quality)"},
        ]

    if query:
        q_lower = query.strip().lower()
        filtered = []
        for m in models:
            if isinstance(m, dict):
                m_id = str(m.get("id", "")).lower()
                m_name = str(m.get("name", "")).lower()
                if q_lower in m_id or q_lower in m_name:
                    filtered.append(m)
            elif q_lower in str(m).lower():
                filtered.append(m)
        models = filtered

    return {
        "object": "list",
        "data": models,
        "upstream_available": upstream_available,
        "error": err_msg
    }

voices_router = APIRouter(prefix="/api/voices", tags=["voices"])

@voices_router.get("")
async def get_voices(search: Optional[str] = None, q: Optional[str] = None, engine: Optional[str] = None):
    """List available TTS voices with search and engine filter support."""
    query = search or q
    err_msg = None
    upstream_available = True
    try:
        resp = await tts_client.list_voices()
        if isinstance(resp, dict) and "voices" in resp:
            voices = resp["voices"]
        elif isinstance(resp, list):
            voices = resp
        else:
            voices = []
    except Exception as e:
        upstream_available = False
        err_msg = str(e)
        voices = [
            {"id": "af_alloy", "name": "Kokoro af_alloy", "engine": "kokoro"},
            {"id": "af_heart", "name": "Kokoro af_heart", "engine": "kokoro"},
            {"id": "af_bella", "name": "Kokoro af_bella", "engine": "kokoro"},
            {"id": "am_echo", "name": "Kokoro am_echo", "engine": "kokoro"},
            {"id": "am_onyx", "name": "Kokoro am_onyx", "engine": "kokoro"},
            {"id": "bf_emma", "name": "Kokoro bf_emma", "engine": "kokoro"},
        ]

    if engine:
        e_lower = engine.strip().lower()
        voices = [v for v in voices if isinstance(v, dict) and v.get("engine", "").lower() == e_lower]

    if query:
        q_lower = query.strip().lower()
        filtered = []
        for v in voices:
            if isinstance(v, dict):
                v_id = str(v.get("id", "")).lower()
                v_name = str(v.get("name", "")).lower()
                v_lang = str(v.get("language", "")).lower()
                if q_lower in v_id or q_lower in v_name or q_lower in v_lang:
                    filtered.append(v)
            elif q_lower in str(v).lower():
                filtered.append(v)
        voices = filtered

    return {
        "object": "list",
        "voices": voices,
        "upstream_available": upstream_available,
        "error": err_msg
    }

settings_router = APIRouter(prefix="/api/settings", tags=["settings"])

class SettingsPayload(BaseModel):
    tts_base_url: Optional[str] = None
    tts_api_key: Optional[str] = None
    tts_default_model: Optional[str] = None
    tts_default_voice: Optional[str] = None
    default_model: Optional[str] = None
    default_voice: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None

@settings_router.get("")
async def get_app_settings():
    """Get current TTS settings."""
    return load_settings()

@settings_router.post("")
async def update_app_settings(req: SettingsPayload):
    """Save updated TTS configuration settings."""
    data = req.model_dump(exclude_unset=True)
    if "base_url" in data and "tts_base_url" not in data:
        data["tts_base_url"] = data["base_url"]
    if "api_key" in data and "tts_api_key" not in data:
        data["tts_api_key"] = data["api_key"]
    if "default_model" in data and "tts_default_model" not in data:
        data["tts_default_model"] = data["default_model"]
    if "default_voice" in data and "tts_default_voice" not in data:
        data["tts_default_voice"] = data["default_voice"]
    saved = save_settings(data)
    return {"status": "saved", "settings": saved, **saved}

@settings_router.post("/test")
async def test_upstream_tts(req: SettingsPayload):
    """Test connection to upstream TTS service."""
    current = load_settings()
    url_candidate = req.tts_base_url or req.base_url or current.get("tts_base_url", "")
    key_candidate = req.tts_api_key if req.tts_api_key is not None else (req.api_key if req.api_key is not None else current.get("tts_api_key", ""))
    test_url = (url_candidate or "").rstrip("/")
    test_client = UniversalTTSClient(base_url=test_url, api_key=key_candidate, timeout=10.0)
    try:
        models = await test_client.list_models()
        model_list = models.get("data", []) if isinstance(models, dict) else (models if isinstance(models, list) else [])
        voices = await test_client.list_voices()
        voice_count = len(voices.get("voices", [])) if isinstance(voices, dict) else (len(voices) if isinstance(voices, list) else 0)
        return {
            "ok": True,
            "models": model_list,
            "voice_count": voice_count,
            "message": f"Successfully connected to Universal TTS. Found {len(model_list)} models and {voice_count} voices."
        }
    except Exception as e:
        return {"ok": False, "message": str(e)}

class CreateDocRequest(BaseModel):
    title: Optional[str] = None
    content: str

class UpdateDocRequest(BaseModel):
    title: Optional[str] = None
    content: str

class UrlDocRequest(BaseModel):
    url: str
    title: Optional[str] = None

class BlockAudioRequest(BaseModel):
    voice: str = "alloy"
    model: str = "tts-1"
    speed: float = 1.0
    response_format: str = "mp3"

@router.get("")
async def list_documents():
    """List all ingested documents from storage."""
    docs = []
    if not os.path.exists(BASE_DATA_DIR):
        return docs

    for entry in os.scandir(BASE_DATA_DIR):
        if entry.is_dir():
            meta_path = os.path.join(entry.path, "meta.json")
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                        # Add short excerpt from chunks if available
                        chunks_path = os.path.join(entry.path, "chunks.json")
                        excerpt = ""
                        if os.path.exists(chunks_path):
                            with open(chunks_path, "r", encoding="utf-8") as cf:
                                chunks = json.load(cf)
                                if chunks:
                                    excerpt = chunks[0].get("text", "")[:120] + "..."
                        meta["excerpt"] = excerpt
                        docs.append(meta)
                except Exception:
                    continue

    # Sort descending by created_at
    docs.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return docs

@router.get("/{doc_id}")
async def get_document(doc_id: str):
    """Retrieve full document metadata and chunks."""
    doc_dir = os.path.join(BASE_DATA_DIR, doc_id)
    meta_path = os.path.join(doc_dir, "meta.json")
    chunks_path = os.path.join(doc_dir, "chunks.json")

    if not os.path.exists(meta_path) or not os.path.exists(chunks_path):
        raise HTTPException(status_code=404, detail="Document not found")

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    with open(chunks_path, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    return {
        "meta": meta,
        "chunks": chunks
    }

@router.get("/{doc_id}/raw")
async def get_raw_document(doc_id: str):
    """Retrieve raw markdown text for editing."""
    doc_dir = os.path.join(BASE_DATA_DIR, doc_id)
    doc_file = os.path.join(doc_dir, "document.md")
    meta_file = os.path.join(doc_dir, "meta.json")
    if not os.path.exists(doc_file) or not os.path.exists(meta_file):
        raise HTTPException(status_code=404, detail="Document not found")

    with open(meta_file, "r", encoding="utf-8") as f:
        meta = json.load(f)
    with open(doc_file, "r", encoding="utf-8") as f:
        raw_text = f.read()

    return {
        "id": doc_id,
        "title": meta.get("title", ""),
        "content": raw_text,
        "meta": meta
    }

@router.put("/{doc_id}")
async def update_document(doc_id: str, req: UpdateDocRequest):
    """Update document raw text and title, re-chunk, and clear outdated cache."""
    doc_dir = os.path.join(BASE_DATA_DIR, doc_id)
    meta_file = os.path.join(doc_dir, "meta.json")
    if not os.path.exists(doc_dir) or not os.path.exists(meta_file):
        raise HTTPException(status_code=404, detail="Document not found")

    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Content cannot be empty")

    with open(meta_file, "r", encoding="utf-8") as f:
        meta = json.load(f)

    if req.title and req.title.strip():
        meta["title"] = req.title.strip()

    chunks = chunk_text(content)
    if not chunks:
        raise HTTPException(status_code=400, detail="Could not extract readable blocks from content")

    meta["block_count"] = len(chunks)
    meta["total_chars"] = len(content)
    meta["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Write document.md
    with open(os.path.join(doc_dir, "document.md"), "w", encoding="utf-8") as f:
        f.write(content)

    # Write chunks.json
    with open(os.path.join(doc_dir, "chunks.json"), "w", encoding="utf-8") as f:
        json.dump(chunks, f, indent=2)

    # Write meta.json
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    # Invalidate audio cache since text blocks changed
    cache_dir = os.path.join(doc_dir, "audio_cache")
    if os.path.exists(cache_dir):
        for fname in os.listdir(cache_dir):
            p = os.path.join(cache_dir, fname)
            if os.path.isfile(p):
                try:
                    os.remove(p)
                except Exception:
                    pass

    return {
        "id": doc_id,
        "title": meta.get("title"),
        "block_count": len(chunks),
        "status": "updated"
    }

async def _synthesize_or_get_cached_audio(
    doc_id: str,
    block_id: int,
    voice: str,
    model: str,
    speed: float,
    response_format: str = "mp3"
):
    doc_dir = os.path.join(BASE_DATA_DIR, doc_id)
    if not os.path.isdir(doc_dir):
        raise HTTPException(status_code=404, detail="Document not found")

    chunks_path = os.path.join(doc_dir, "chunks.json")
    if not os.path.exists(chunks_path):
        raise HTTPException(status_code=404, detail="Document chunks not found")

    try:
        with open(chunks_path, "r", encoding="utf-8") as f:
            chunks = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read chunks: {str(e)}")

    target_block = None
    for chunk in chunks:
        if chunk.get("id") == block_id:
            target_block = chunk
            break

    if target_block is None:
        raise HTTPException(status_code=404, detail=f"Block {block_id} not found")

    block_text = target_block.get("text", "").strip()
    if not block_text:
        raise HTTPException(status_code=400, detail="Block contains no readable text")

    cache_dir = os.path.join(doc_dir, "audio_cache")
    os.makedirs(cache_dir, exist_ok=True)

    filename = get_audio_filename(block_id, voice, model, speed, block_text)
    file_path = os.path.join(cache_dir, filename)

    is_cache_hit = os.path.exists(file_path) and os.path.getsize(file_path) > 0

    if not is_cache_hit:
        audio_bytes = await tts_client.synthesize(
            text=block_text,
            voice=voice,
            model=model,
            speed=speed,
            response_format=response_format
        )
        with open(file_path, "wb") as f:
            f.write(audio_bytes)

    return FileResponse(
        path=file_path,
        media_type="audio/mpeg",
        filename=filename,
        headers={"X-Cache": "HIT" if is_cache_hit else "MISS"}
    )

@router.post("/{doc_id}/blocks/{block_id}/audio")
async def generate_block_audio(
    doc_id: str,
    block_id: int,
    req: BlockAudioRequest = BlockAudioRequest()
):
    """Synthesize or retrieve cached audio for a specific text block."""
    return await _synthesize_or_get_cached_audio(
        doc_id=doc_id,
        block_id=block_id,
        voice=req.voice,
        model=req.model,
        speed=req.speed,
        response_format=req.response_format
    )

@router.get("/{doc_id}/blocks/{block_id}/audio")
async def get_block_audio(
    doc_id: str,
    block_id: int,
    voice: str = "alloy",
    model: str = "tts-1",
    speed: float = 1.0,
    response_format: str = "mp3"
):
    """Retrieve or generate block audio via GET for browser audio elements."""
    return await _synthesize_or_get_cached_audio(
        doc_id=doc_id,
        block_id=block_id,
        voice=voice,
        model=model,
        speed=speed,
        response_format=response_format
    )

@router.delete("/{doc_id}")
async def delete_document(doc_id: str):
    """Delete a document and all its cached audio."""
    doc_dir = os.path.join(BASE_DATA_DIR, doc_id)
    if not os.path.exists(doc_dir):
        raise HTTPException(status_code=404, detail="Document not found")

    shutil.rmtree(doc_dir)
    return {"status": "deleted", "id": doc_id}

@router.delete("/{doc_id}/cache")
async def invalidate_document_cache(doc_id: str):
    """Invalidate all cached audio files for a document."""
    doc_dir = os.path.join(BASE_DATA_DIR, doc_id)
    if not os.path.exists(doc_dir):
        raise HTTPException(status_code=404, detail="Document not found")

    cache_dir = os.path.join(doc_dir, "audio_cache")
    count = 0
    if os.path.exists(cache_dir):
        for filename in os.listdir(cache_dir):
            file_path = os.path.join(cache_dir, filename)
            if os.path.isfile(file_path):
                os.remove(file_path)
                count += 1
    return {"status": "cache_invalidated", "id": doc_id, "files_removed": count}

@router.delete("/{doc_id}/blocks/{block_id}/cache")
async def invalidate_block_cache(doc_id: str, block_id: int):
    """Invalidate cached audio files for a specific block."""
    doc_dir = os.path.join(BASE_DATA_DIR, doc_id)
    if not os.path.exists(doc_dir):
        raise HTTPException(status_code=404, detail="Document not found")

    cache_dir = os.path.join(doc_dir, "audio_cache")
    count = 0
    prefix = f"{block_id}_"
    if os.path.exists(cache_dir):
        for filename in os.listdir(cache_dir):
            if filename.startswith(prefix) and filename.endswith(".mp3"):
                file_path = os.path.join(cache_dir, filename)
                if os.path.isfile(file_path):
                    os.remove(file_path)
                    count += 1
    return {"status": "block_cache_invalidated", "doc_id": doc_id, "block_id": block_id, "files_removed": count}

@router.post("/create")
async def create_document(req: CreateDocRequest):
    """Create document from scratchpad text."""
    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Content cannot be empty")

    now = datetime.now()
    title = req.title.strip() if (req.title and req.title.strip()) else f"Doc - {now.strftime('%Y-%m-%d %H:%M')}"
    chunks = chunk_text(content)
    if not chunks:
        raise HTTPException(status_code=400, detail="Unable to extract meaningful text")

    doc_id = generate_doc_id()
    save_document(doc_id, title, "text", content, chunks)
    return {"id": doc_id, "title": title, "block_count": len(chunks)}

@router.post("/url")
async def ingest_url(req: UrlDocRequest):
    """Ingest clean article markdown from a URL using trafilatura."""
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")

    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        raise HTTPException(status_code=400, detail="Failed to fetch content from URL")

    extracted = trafilatura.extract(
        downloaded,
        output_format="markdown",
        include_links=False,
        include_images=False,
        with_metadata=True
    )
    if not extracted or not extracted.strip():
        raise HTTPException(status_code=400, detail="No readable article content found at URL")

    # Extract metadata title if available
    metadata = trafilatura.extract_metadata(downloaded)
    title = req.title or (metadata.title if metadata and metadata.title else None)
    if not title:
        now = datetime.now()
        title = f"Web - {url.split('//')[-1].split('/')[0]} ({now.strftime('%Y-%m-%d')})"

    chunks = chunk_text(extracted)
    if not chunks:
        raise HTTPException(status_code=400, detail="Extracted content is too short or empty")

    doc_id = generate_doc_id()
    save_document(doc_id, title, "url", extracted, chunks)
    return {"id": doc_id, "title": title, "block_count": len(chunks)}

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), title: Optional[str] = Form(None)):
    """Upload and parse PDF, DOCX, ePub, or plain text / markdown file."""
    filename = file.filename or "uploaded_file"
    ext = os.path.splitext(filename)[1].lower()
    content_bytes = await file.read()

    if not content_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    if ext == ".pdf":
        text = parse_pdf(content_bytes)
        source_type = "pdf"
    elif ext == ".docx":
        text = parse_docx(content_bytes)
        source_type = "docx"
    elif ext == ".epub":
        text = parse_epub(content_bytes)
        source_type = "epub"
    elif ext in [".txt", ".md"]:
        text = parse_text(content_bytes)
        source_type = ext.replace(".", "")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported file format: {ext}. Supported: .pdf, .docx, .epub, .md, .txt")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract readable text from uploaded file")

    doc_title = title.strip() if (title and title.strip()) else os.path.splitext(filename)[0]
    chunks = chunk_text(text)
    if not chunks:
        raise HTTPException(status_code=400, detail="File content resulted in 0 readable blocks")

    doc_id = generate_doc_id()
    save_document(doc_id, doc_title, source_type, text, chunks)
    return {"id": doc_id, "title": doc_title, "block_count": len(chunks)}
