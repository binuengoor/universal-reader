import hashlib
import json
import os
import shutil
import trafilatura
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .parsers import parse_pdf, parse_docx, parse_epub, parse_text
from .chunking import chunk_text, save_document, generate_doc_id, BASE_DATA_DIR
from .tts import tts_client, get_audio_filename, UniversalTTSClient
from .config import load_settings, save_settings
from .cleaner import clean_text_for_speech, apply_glossary, llm_clean_text, llm_generate_title_and_tags

router = APIRouter(prefix="/api/documents", tags=["documents"])
models_router = APIRouter(prefix="/api/models", tags=["models"])
tags_router = APIRouter(prefix="/api/tags", tags=["tags"])


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
    scoped_voices: Optional[List[str]] = None
    scoped_voices_enabled: Optional[bool] = None
    llm_base_url: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_model: Optional[str] = None
    llm_prompt: Optional[str] = None
    llm_clean_enabled: Optional[bool] = None
    glossary: Optional[List[Dict[str, Any]]] = None

@settings_router.get("")
async def get_app_settings():
    """Get current TTS and LLM settings."""
    return load_settings()

@settings_router.post("")
async def update_app_settings(req: SettingsPayload):
    """Save updated TTS and LLM configuration settings."""
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

@settings_router.post("/test-llm")
async def test_upstream_llm(req: SettingsPayload):
    """Test connection to OpenAI-compatible LLM endpoint."""
    import httpx
    current = load_settings()
    base_url = (req.llm_base_url or current.get("llm_base_url", "")).rstrip("/")
    if not base_url:
        return {"ok": False, "message": "LLM Base URL is empty"}
    api_key = req.llm_api_key if req.llm_api_key is not None else current.get("llm_api_key", "")
    model = req.llm_model or current.get("llm_model", "gpt-4o-mini")

    endpoint = f"{base_url}/chat/completions"
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                endpoint,
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": "Reply with 'OK'."}],
                    "max_tokens": 10
                },
                headers=headers
            )
            if resp.status_code == 200:
                return {"ok": True, "message": f"Successfully connected to LLM endpoint with model '{model}'."}
            else:
                return {"ok": False, "message": f"LLM error HTTP {resp.status_code}: {resp.text[:200]}"}
    except Exception as e:
        return {"ok": False, "message": f"LLM connection error: {str(e)}"}


class CreateDocRequest(BaseModel):
    title: Optional[str] = None
    content: str
    tags: Optional[List[str]] = None

class UpdateDocRequest(BaseModel):
    title: Optional[str] = None
    content: str
    tags: Optional[List[str]] = None

class UrlDocRequest(BaseModel):
    url: str
    title: Optional[str] = None
    tags: Optional[List[str]] = None

class BulkDeleteRequest(BaseModel):
    doc_ids: List[str]

class BlockAudioRequest(BaseModel):
    voice: str = "alloy"
    model: str = "tts-1"
    speed: float = 1.0
    response_format: str = "mp3"

class UpdateStatusRequest(BaseModel):
    status: Optional[str] = None  # "inbox", "reading", "archived"
    favorite: Optional[bool] = None

class UpdateProgressRequest(BaseModel):
    last_block_index: int
    progress_pct: Optional[float] = None

@router.get("")
async def list_documents(
    status: Optional[str] = None,
    favorite: Optional[bool] = None,
    tag: Optional[str] = None,
    q: Optional[str] = None
):
    """List all ingested documents from storage with optional filtering and full-text search."""
    docs = []
    if not os.path.exists(BASE_DATA_DIR):
        return docs

    search_term = q.strip().lower() if q else None
    tag_filter = tag.strip().lower() if tag else None

    for entry in os.scandir(BASE_DATA_DIR):
        if entry.is_dir():
            meta_path = os.path.join(entry.path, "meta.json")
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        meta = json.load(f)

                    meta.setdefault("status", "inbox")
                    meta.setdefault("favorite", False)
                    meta.setdefault("last_block_index", 0)
                    meta.setdefault("progress_pct", 0.0)

                    # Status filter
                    if status and meta.get("status") != status:
                        continue

                    # Favorite filter
                    if favorite is not None and meta.get("favorite") != favorite:
                        continue

                    # Tag filter
                    if tag_filter:
                        doc_tags = [t.lower() for t in meta.get("tags", [])]
                        if tag_filter not in doc_tags:
                            continue

                    # Full-text or title search
                    doc_md_path = os.path.join(entry.path, "document.md")
                    doc_content = ""
                    if search_term and os.path.exists(doc_md_path):
                        try:
                            with open(doc_md_path, "r", encoding="utf-8") as dmf:
                                doc_content = dmf.read().lower()
                        except Exception:
                            pass

                    if search_term:
                        title_match = search_term in (meta.get("title") or "").lower()
                        tags_match = any(search_term in t.lower() for t in meta.get("tags", []))
                        content_match = search_term in doc_content
                        if not (title_match or tags_match or content_match):
                            continue

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
    meta.setdefault("status", "inbox")
    meta.setdefault("favorite", False)
    meta.setdefault("last_block_index", 0)
    meta.setdefault("progress_pct", 0.0)

    with open(chunks_path, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    return {
        "meta": meta,
        "chunks": chunks
    }

@router.patch("/{doc_id}/status")
async def update_document_status(doc_id: str, req: UpdateStatusRequest):
    """Update document lifecycle status ('inbox', 'reading', 'archived') and favorite flag."""
    doc_dir = os.path.join(BASE_DATA_DIR, doc_id)
    meta_path = os.path.join(doc_dir, "meta.json")
    if not os.path.exists(doc_dir) or not os.path.exists(meta_path):
        raise HTTPException(status_code=404, detail="Document not found")

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    if req.status is not None:
        valid_statuses = ("inbox", "reading", "archived")
        if req.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")
        meta["status"] = req.status

    if req.favorite is not None:
        meta["favorite"] = bool(req.favorite)

    meta["updated_at"] = datetime.now(timezone.utc).isoformat()
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    return {
        "id": doc_id,
        "status": meta.get("status", "inbox"),
        "favorite": meta.get("favorite", False)
    }

@router.patch("/{doc_id}/progress")
async def update_document_progress(doc_id: str, req: UpdateProgressRequest):
    """Update document listening/reading progress and position."""
    doc_dir = os.path.join(BASE_DATA_DIR, doc_id)
    meta_path = os.path.join(doc_dir, "meta.json")
    if not os.path.exists(doc_dir) or not os.path.exists(meta_path):
        raise HTTPException(status_code=404, detail="Document not found")

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    block_count = meta.get("block_count", 1) or 1
    idx = max(0, req.last_block_index)
    meta["last_block_index"] = idx

    if req.progress_pct is not None:
        meta["progress_pct"] = round(req.progress_pct, 1)
    else:
        calc_pct = ((idx + 1) / block_count) * 100
        meta["progress_pct"] = round(min(100.0, calc_pct), 1)

    # Auto-transition from inbox to reading once progress begins
    if meta.get("status") == "inbox" and idx > 0:
        meta["status"] = "reading"

    meta["updated_at"] = datetime.now(timezone.utc).isoformat()
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    return {
        "id": doc_id,
        "last_block_index": meta["last_block_index"],
        "progress_pct": meta["progress_pct"],
        "status": meta.get("status", "inbox")
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

    if req.tags is not None:
        meta["tags"] = [t.strip().lower() for t in req.tags if t and t.strip()]

    chunks = chunk_text(content)
    if not chunks:
        raise HTTPException(status_code=400, detail="Could not extract readable blocks from content")

    meta["block_count"] = len(chunks)
    meta["total_chars"] = len(content)
    meta["content_hash"] = hashlib.sha256(content.encode("utf-8")).hexdigest()
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

    settings = load_settings()
    glossary = settings.get("glossary", [])

    block_text = target_block.get("text", "").strip()
    speech_text = target_block.get("speech_text")
    if not speech_text or not speech_text.strip():
        speech_text = clean_text_for_speech(block_text, glossary=glossary)
    else:
        speech_text = apply_glossary(speech_text, glossary=glossary)
    if not speech_text.strip():
        speech_text = block_text

    if not speech_text.strip():
        raise HTTPException(status_code=400, detail="Block contains no readable text")

    cache_dir = os.path.join(doc_dir, "audio_cache")
    os.makedirs(cache_dir, exist_ok=True)

    filename = get_audio_filename(block_id, voice, model, speed, speech_text)
    file_path = os.path.join(cache_dir, filename)

    is_cache_hit = os.path.exists(file_path) and os.path.getsize(file_path) > 0

    if not is_cache_hit:
        audio_bytes = await tts_client.synthesize(
            text=speech_text,
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

@router.post("/bulk-delete")
async def bulk_delete_documents(req: BulkDeleteRequest):
    """Bulk delete documents and their cached files."""
    deleted_ids = []
    not_found_ids = []
    for doc_id in req.doc_ids:
        doc_dir = os.path.join(BASE_DATA_DIR, doc_id)
        if os.path.exists(doc_dir):
            shutil.rmtree(doc_dir)
            deleted_ids.append(doc_id)
        else:
            not_found_ids.append(doc_id)
    return {
        "status": "bulk_deleted",
        "deleted_count": len(deleted_ids),
        "deleted_ids": deleted_ids,
        "not_found_ids": not_found_ids
    }

@router.delete("/{doc_id}")
async def delete_document(doc_id: str):
    """Delete a document and all its cached audio."""
    doc_dir = os.path.join(BASE_DATA_DIR, doc_id)
    if not os.path.exists(doc_dir):
        raise HTTPException(status_code=404, detail="Document not found")

    shutil.rmtree(doc_dir)
    return {"status": "deleted", "id": doc_id}

@router.get("/{doc_id}/export-audio")
async def export_full_audio(
    doc_id: str,
    voice: str = "en-US-ChristopherNeural",
    model: str = "edge-tts",
    speed: float = 1.0
):
    """
    Concatenate all cached audio blocks for this document and return a single .mp3 download.
    Synthesizes any missing blocks on demand.
    """
    doc_dir = os.path.join(BASE_DATA_DIR, doc_id)
    if not os.path.isdir(doc_dir):
        raise HTTPException(status_code=404, detail="Document not found")

    chunks_path = os.path.join(doc_dir, "chunks.json")
    meta_path = os.path.join(doc_dir, "meta.json")
    if not os.path.exists(chunks_path) or not os.path.exists(meta_path):
        raise HTTPException(status_code=404, detail="Document data not found")

    with open(chunks_path, "r", encoding="utf-8") as f:
        chunks = json.load(f)
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    if not chunks:
        raise HTTPException(status_code=400, detail="Document has no blocks")

    cache_dir = os.path.join(doc_dir, "audio_cache")
    os.makedirs(cache_dir, exist_ok=True)

    settings = load_settings()
    glossary = settings.get("glossary", [])

    # Gather or synthesize all blocks
    combined_audio = bytearray()
    for chunk in chunks:
        block_id = chunk["id"]
        block_text = chunk.get("text", "").strip()
        speech_text = chunk.get("speech_text")
        if not speech_text or not speech_text.strip():
            speech_text = clean_text_for_speech(block_text, glossary=glossary)
        else:
            speech_text = apply_glossary(speech_text, glossary=glossary)
        if not speech_text.strip():
            speech_text = block_text

        if not speech_text:
            continue

        filename = get_audio_filename(block_id, voice, model, speed, speech_text)
        file_path = os.path.join(cache_dir, filename)

        if not (os.path.exists(file_path) and os.path.getsize(file_path) > 0):
            audio_bytes = await tts_client.synthesize(
                text=speech_text,
                voice=voice,
                model=model,
                speed=speed,
                response_format="mp3"
            )
            with open(file_path, "wb") as f:
                f.write(audio_bytes)
        else:
            with open(file_path, "rb") as f:
                audio_bytes = f.read()


        combined_audio.extend(audio_bytes)

    # Clean title for filename
    raw_title = meta.get("title", "audiobook")
    safe_title = "".join(c for c in raw_title if c.isalnum() or c in (" ", "_", "-")).strip() or "document"
    export_filename = f"{safe_title}.mp3"

    export_path = os.path.join(cache_dir, f"_export_{voice}_{model}_{speed}.mp3")
    with open(export_path, "wb") as f:
        f.write(combined_audio)

    return FileResponse(
        path=export_path,
        media_type="audio/mpeg",
        filename=export_filename,
        headers={"Content-Disposition": f'attachment; filename="{export_filename}"'}
    )

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


def get_all_library_tags() -> List[str]:
    """Retrieve all unique tags across all documents in the library."""
    unique = set()
    if not os.path.exists(BASE_DATA_DIR):
        return []
    for entry in os.scandir(BASE_DATA_DIR):
        if entry.is_dir():
            meta_path = os.path.join(entry.path, "meta.json")
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                        for t in meta.get("tags", []):
                            if t and str(t).strip():
                                unique.add(str(t).strip().lower())
                except Exception:
                    pass
    return sorted(list(unique))


async def _resolve_title_and_tags(
    content: str,
    user_title: Optional[str],
    user_tags: Optional[List[str]],
    default_title: str
) -> Tuple[str, List[str]]:
    """
    If title or tags are not specified, call OpenAI-compatible LLM if configured.
    Respects user overrides and the 50-tag global constraint.
    """
    settings = load_settings()
    llm_base = settings.get("llm_base_url", "").strip()
    llm_key = settings.get("llm_api_key", "").strip()
    llm_model = settings.get("llm_model", "gpt-4o-mini").strip()

    title = user_title.strip() if (user_title and user_title.strip()) else None
    tags = [t.strip().lower() for t in user_tags if t and t.strip()] if user_tags is not None else None

    # If both user provided title and tags, no need for LLM
    if title is not None and tags is not None and len(tags) > 0:
        return title, tags

    # Attempt LLM generation if URL configured
    if llm_base and (title is None or tags is None or len(tags) == 0):
        all_tags = get_all_library_tags()
        llm_title, llm_tags = await llm_generate_title_and_tags(
            content=content,
            existing_tags=all_tags,
            llm_base_url=llm_base,
            llm_api_key=llm_key,
            llm_model=llm_model
        )
        if title is None and llm_title:
            title = llm_title
        if (tags is None or len(tags) == 0) and llm_tags:
            tags = llm_tags

    final_title = title if title else default_title
    final_tags = tags if tags is not None else []
    return final_title, final_tags


@router.post("/create")
async def create_document(req: CreateDocRequest):
    """Create document from scratchpad text with optional LLM title/tags."""
    content = req.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Content cannot be empty")

    now = datetime.now()
    default_title = f"Doc - {now.strftime('%Y-%m-%d %H:%M')}"
    title, tags = await _resolve_title_and_tags(content, req.title, req.tags, default_title)

    chunks = chunk_text(content)
    if not chunks:
        raise HTTPException(status_code=400, detail="Unable to extract meaningful text")

    doc_id = generate_doc_id()
    save_document(doc_id, title, "text", content, chunks, tags=tags)
    return {"id": doc_id, "title": title, "block_count": len(chunks), "tags": tags}


@router.post("/url")
async def ingest_url(req: UrlDocRequest):
    """Ingest clean article markdown from a URL using trafilatura."""
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")

    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        raise HTTPException(status_code=400, detail=f"Failed to fetch content from URL: {url}")

    extracted = trafilatura.extract(downloaded, include_comments=False, output_format="txt")
    if not extracted or not extracted.strip():
        raise HTTPException(status_code=400, detail="Could not extract readable article text from this URL")

    # Check extracted metadata title if user didn't supply one
    meta_title = None
    if not (req.title and req.title.strip()):
        metadata = trafilatura.extract_metadata(downloaded)
        if metadata and metadata.title:
            meta_title = metadata.title.strip()

    now = datetime.now()
    domain = url.split('//')[-1].split('/')[0]
    default_title = meta_title or f"Web - {domain} ({now.strftime('%Y-%m-%d')})"

    title, tags = await _resolve_title_and_tags(extracted, req.title or meta_title, req.tags, default_title)

    chunks = chunk_text(extracted)
    if not chunks:
        raise HTTPException(status_code=400, detail="Extracted content is too short or empty")

    doc_id = generate_doc_id()
    save_document(doc_id, title, "url", extracted, chunks, tags=tags)
    return {"id": doc_id, "title": title, "block_count": len(chunks), "tags": tags}


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    tags: Optional[str] = Form(None)
):
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

    default_title = os.path.splitext(filename)[0]
    user_tags = [t.strip().lower() for t in tags.split(",") if t.strip()] if tags else None
    resolved_title, resolved_tags = await _resolve_title_and_tags(text, title, user_tags, default_title)

    chunks = chunk_text(text)
    if not chunks:
        raise HTTPException(status_code=400, detail="File content resulted in 0 readable blocks")

    doc_id = generate_doc_id()
    save_document(doc_id, resolved_title, source_type, text, chunks, tags=resolved_tags)
    return {"id": doc_id, "title": resolved_title, "block_count": len(chunks), "tags": resolved_tags}


class BatchLlmRequest(BaseModel):
    job_type: str  # 'title' | 'tags' | 'clean_text' | 'all'
    doc_ids: Optional[List[str]] = None
    overwrite: bool = False


@router.post("/batch-llm")
async def run_batch_llm_job(req: BatchLlmRequest):
    """
    Run bulk background/batch LLM tasks on documents:
    - 'title': re-evaluate or generate titles
    - 'tags': re-evaluate categories with 50-tag constraint
    - 'clean_text': re-generate speech_text for audio chunks using LLM
    - 'all': full optimization pass
    """
    settings = load_settings()
    llm_base = settings.get("llm_base_url", "").strip()
    llm_key = settings.get("llm_api_key", "").strip()
    llm_model = settings.get("llm_model", "gpt-4o-mini").strip()

    if not llm_base:
        raise HTTPException(status_code=400, detail="LLM Base URL is not configured in Settings")

    all_docs = []
    if not os.path.exists(BASE_DATA_DIR):
        return {"status": "completed", "processed_count": 0, "results": []}

    target_ids = set(req.doc_ids) if req.doc_ids else None

    for entry in os.scandir(BASE_DATA_DIR):
        if entry.is_dir():
            if target_ids is None or entry.name in target_ids:
                all_docs.append(entry.name)

    results = []
    processed_count = 0
    skipped_count = 0

    for doc_id in all_docs:
        doc_dir = os.path.join(BASE_DATA_DIR, doc_id)
        meta_path = os.path.join(doc_dir, "meta.json")
        doc_file = os.path.join(doc_dir, "document.md")
        chunks_path = os.path.join(doc_dir, "chunks.json")

        if not os.path.exists(meta_path) or not os.path.exists(doc_file):
            continue

        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            with open(doc_file, "r", encoding="utf-8") as f:
                content = f.read()

            content_hash = meta.get("content_hash")
            if not content_hash:
                content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
                meta["content_hash"] = content_hash

            llm_state = meta.get("llm_state") or {
                "title_hash": None,
                "tags_hash": None,
                "speech_hash": None,
                "last_processed_at": None,
            }

            modified = False
            result_item = {"id": doc_id, "title": meta.get("title")}

            # 1. Title generation
            if req.job_type in ("title", "all"):
                curr_title = meta.get("title", "")
                is_default_title = curr_title.startswith("Doc - ") or curr_title.startswith("Web - ")
                should_run_title = req.overwrite or (
                    llm_state.get("title_hash") != content_hash and (is_default_title or not curr_title)
                )
                if should_run_title:
                    all_tags = get_all_library_tags()
                    new_title, _ = await llm_generate_title_and_tags(
                        content=content,
                        existing_tags=all_tags,
                        llm_base_url=llm_base,
                        llm_api_key=llm_key,
                        llm_model=llm_model
                    )
                    if new_title:
                        meta["title"] = new_title
                        result_item["new_title"] = new_title
                        llm_state["title_hash"] = content_hash
                        modified = True

            # 2. Tag generation with 50-tag limit
            if req.job_type in ("tags", "all"):
                curr_tags = meta.get("tags", [])
                should_run_tags = req.overwrite or (
                    llm_state.get("tags_hash") != content_hash and not curr_tags
                )
                if should_run_tags:
                    all_tags = get_all_library_tags()
                    _, new_tags = await llm_generate_title_and_tags(
                        content=content,
                        existing_tags=all_tags,
                        llm_base_url=llm_base,
                        llm_api_key=llm_key,
                        llm_model=llm_model
                    )
                    if new_tags:
                        meta["tags"] = new_tags
                        result_item["new_tags"] = new_tags
                        llm_state["tags_hash"] = content_hash
                        modified = True

            # 3. Clean text re-chunking
            if req.job_type in ("clean_text", "all") and os.path.exists(chunks_path):
                should_run_clean = req.overwrite or (llm_state.get("speech_hash") != content_hash)
                if should_run_clean:
                    with open(chunks_path, "r", encoding="utf-8") as cf:
                        chunks = json.load(cf)
                    chunks_modified = False
                    for c in chunks:
                        raw_block = c.get("text", "")
                        if raw_block:
                            block_hash = hashlib.sha256(raw_block.encode("utf-8")).hexdigest()
                            # If not overwrite and block was already cleaned with matching hash, skip LLM call
                            if not req.overwrite and c.get("speech_cleaned") and c.get("raw_hash") == block_hash:
                                continue

                            cleaned = await llm_clean_text(
                                text=raw_block,
                                llm_base_url=llm_base,
                                llm_api_key=llm_key,
                                llm_model=llm_model
                            )
                            if cleaned != c.get("speech_text") or not c.get("speech_cleaned"):
                                c["speech_text"] = cleaned
                                c["speech_cleaned"] = True
                                c["raw_hash"] = block_hash
                                chunks_modified = True

                    if chunks_modified:
                        with open(chunks_path, "w", encoding="utf-8") as cf:
                            json.dump(chunks, cf, indent=2)
                        modified = True
                        result_item["speech_text_updated"] = True
                    llm_state["speech_hash"] = content_hash

            if modified:
                llm_state["last_processed_at"] = datetime.now(timezone.utc).isoformat()
                meta["llm_state"] = llm_state
                meta["updated_at"] = datetime.now(timezone.utc).isoformat()
                with open(meta_path, "w", encoding="utf-8") as f:
                    json.dump(meta, f, indent=2)
                processed_count += 1
                results.append(result_item)
            else:
                skipped_count += 1

        except Exception as err:
            results.append({"id": doc_id, "error": str(err)})

    return {
        "status": "completed",
        "job_type": req.job_type,
        "processed_count": processed_count,
        "skipped_count": skipped_count,
        "total_evaluated": len(all_docs),
        "results": results
    }


# Tags Router Endpoints
@tags_router.get("")
async def list_tags():
    """Retrieve all library tags with usage counts and capacity stats."""
    tag_counts = {}
    total_docs = 0
    if os.path.exists(BASE_DATA_DIR):
        for entry in os.scandir(BASE_DATA_DIR):
            if entry.is_dir():
                meta_path = os.path.join(entry.path, "meta.json")
                if os.path.exists(meta_path):
                    total_docs += 1
                    try:
                        with open(meta_path, "r", encoding="utf-8") as f:
                            meta = json.load(f)
                            for t in meta.get("tags", []):
                                if t and str(t).strip():
                                    norm = str(t).strip().lower()
                                    tag_counts[norm] = tag_counts.get(norm, 0) + 1
                    except Exception:
                        pass

    items = [{"tag": t, "count": c} for t, c in sorted(tag_counts.items(), key=lambda x: (-x[1], x[0]))]
    return {
        "tags": items,
        "total_tags": len(items),
        "max_tags": 50,
        "remaining_capacity": max(0, 50 - len(items)),
        "total_docs": total_docs
    }


class RenameTagRequest(BaseModel):
    old_tag: str
    new_tag: str


@tags_router.post("/rename")
async def rename_or_merge_tag(req: RenameTagRequest):
    """
    Rename or merge a tag across all documents in the library.
    Helps maintain clean taxonomy under 50 categories.
    """
    old_norm = req.old_tag.strip().lower()
    new_norm = req.new_tag.strip().lower().replace(" ", "-")
    if not old_norm or not new_norm:
        raise HTTPException(status_code=400, detail="Tag names cannot be empty")

    updated_docs = 0
    if os.path.exists(BASE_DATA_DIR):
        for entry in os.scandir(BASE_DATA_DIR):
            if entry.is_dir():
                meta_path = os.path.join(entry.path, "meta.json")
                if os.path.exists(meta_path):
                    try:
                        with open(meta_path, "r", encoding="utf-8") as f:
                            meta = json.load(f)
                        tags = meta.get("tags", [])
                        if old_norm in tags:
                            new_tags = [new_norm if t == old_norm else t for t in tags]
                            # Deduplicate preserving order
                            deduped = []
                            for t in new_tags:
                                if t not in deduped:
                                    deduped.append(t)
                            meta["tags"] = deduped
                            meta["updated_at"] = datetime.now(timezone.utc).isoformat()
                            with open(meta_path, "w", encoding="utf-8") as f:
                                json.dump(meta, f, indent=2)
                            updated_docs += 1
                    except Exception:
                        pass

    return {
        "status": "success",
        "old_tag": old_norm,
        "new_tag": new_norm,
        "updated_documents": updated_docs
    }
