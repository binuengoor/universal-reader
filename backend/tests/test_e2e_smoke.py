import os
import io
import shutil
import pytest
from starlette.testclient import TestClient
from backend.main import app
from backend.chunking import BASE_DATA_DIR
from backend.tts import tts_client, get_audio_filename

client = TestClient(app)

@pytest.fixture(autouse=True)
def cleanup():
    # Clean up test directories if needed
    yield
    test_docs = ["e2e-scratch-doc", "e2e-upload-doc"]
    for d in test_docs:
        path = os.path.join(BASE_DATA_DIR, d)
        if os.path.exists(path):
            shutil.rmtree(path)

def test_e2e_health_and_spa():
    # 1. Health check
    res_health = client.get("/api/health")
    assert res_health.status_code == 200
    assert res_health.json() == {"status": "ok"}

    # 2. Models endpoint
    res_models = client.get("/api/models?search=tts")
    assert res_models.status_code == 200
    assert "data" in res_models.json()

def test_e2e_ingestion_playback_and_cache(monkeypatch):
    # Mock TTS upstream synthesis
    synth_calls = 0
    fake_mp3 = b"\xff\xfb\x90\x44" + b"ID3_AUDIO_CONTENT_STREAM"

    async def mock_synthesize(text, voice, model="tts-1", speed=1.0, response_format="mp3"):
        nonlocal synth_calls
        synth_calls += 1
        return fake_mp3

    monkeypatch.setattr(tts_client, "synthesize", mock_synthesize)

    # 1. Create document via text scratchpad
    sample_text = (
        "The Universal Reader is designed for long-form deep reading and audio listening. "
        "It splits arbitrary text, articles, books, and documents into coherent semantic chunks. "
        "Each chunk is between 250 and 500 characters, respecting sentence boundaries and paragraphs.\n\n"
        "As the reader plays block N, the client initiates a sliding window prefetch for blocks N+1 and N+2. "
        "This ensures that audio playback is continuous and uninterrupted, without audible delays between sections. "
        "The architecture is modular, efficient, and relies on local disk persistence for caching."
    )
    res_create = client.post("/api/documents/create", json={
        "title": "E2E Test Reading",
        "content": sample_text
    })
    assert res_create.status_code == 200
    doc_info = res_create.json()
    doc_id = doc_info["id"]
    assert doc_id
    assert doc_info["block_count"] >= 2

    # 2. Verify storage files layout
    doc_dir = os.path.join(BASE_DATA_DIR, doc_id)
    assert os.path.exists(os.path.join(doc_dir, "meta.json"))
    assert os.path.exists(os.path.join(doc_dir, "document.md"))
    assert os.path.exists(os.path.join(doc_dir, "chunks.json"))
    assert os.path.isdir(os.path.join(doc_dir, "audio_cache"))

    # 3. Retrieve document metadata and chunks
    res_get = client.get(f"/api/documents/{doc_id}")
    assert res_get.status_code == 200
    doc_data = res_get.json()
    chunks = doc_data["chunks"]
    assert len(chunks) == doc_info["block_count"]
    for c in chunks:
        assert "id" in c
        assert "text" in c
        assert "char_count" in c

    # 4. List documents in library
    res_list = client.get("/api/documents")
    assert res_list.status_code == 200
    assert any(d["id"] == doc_id for d in res_list.json())

    # 5. Playback block 0 (Cache Miss)
    res_audio1 = client.post(f"/api/documents/{doc_id}/blocks/0/audio", json={
        "voice": "alloy",
        "model": "tts-1",
        "speed": 1.0
    })
    assert res_audio1.status_code == 200
    assert res_audio1.headers.get("x-cache") == "MISS"
    assert res_audio1.content == fake_mp3
    assert synth_calls == 1

    # Verify audio file written with correct naming convention: <block_id>_<voice>_<hash>.mp3
    expected_filename = get_audio_filename(0, "alloy", "tts-1", 1.0, chunks[0]["text"])
    audio_file_path = os.path.join(doc_dir, "audio_cache", expected_filename)
    assert os.path.exists(audio_file_path)

    # 6. Playback block 0 again (Cache Hit)
    res_audio2 = client.post(f"/api/documents/{doc_id}/blocks/0/audio", json={
        "voice": "alloy",
        "model": "tts-1",
        "speed": 1.0
    })
    assert res_audio2.status_code == 200
    assert res_audio2.headers.get("x-cache") == "HIT"
    assert res_audio2.content == fake_mp3
    assert synth_calls == 1  # No extra synthesis call

    # 7. Lookahead Prefetch block 1 via GET
    res_audio_get = client.get(f"/api/documents/{doc_id}/blocks/1/audio?voice=alloy&model=tts-1&speed=1.0")
    assert res_audio_get.status_code == 200
    assert res_audio_get.headers.get("x-cache") == "MISS"
    assert synth_calls == 2

    expected_filename_1 = get_audio_filename(1, "alloy", "tts-1", 1.0, chunks[1]["text"])
    assert os.path.exists(os.path.join(doc_dir, "audio_cache", expected_filename_1))

    # 8. Cache invalidation
    res_inv = client.delete(f"/api/documents/{doc_id}/cache")
    assert res_inv.status_code == 200
    assert res_inv.json()["files_removed"] >= 2
    assert not os.path.exists(audio_file_path)

    # 9. Document deletion
    res_del = client.delete(f"/api/documents/{doc_id}")
    assert res_del.status_code == 200
    assert not os.path.exists(doc_dir)

    # 10. Verify 404 after deletion
    res_after = client.get(f"/api/documents/{doc_id}")
    assert res_after.status_code == 404

def test_e2e_file_upload():
    # Test uploading a plain text / markdown file
    content = b"# Chapter 1\n\nIt was a dark and stormy night. The rain poured down in torrents, soaking everything in sight."
    file_tuple = ("chapter1.md", io.BytesIO(content), "text/markdown")
    res = client.post("/api/documents/upload", files={"file": file_tuple}, data={"title": "Chapter One"})
    assert res.status_code == 200
    doc_id = res.json()["id"]

    # Verify created
    res_get = client.get(f"/api/documents/{doc_id}")
    assert res_get.status_code == 200
    assert res_get.json()["meta"]["title"] == "Chapter One"

    # Cleanup
    client.delete(f"/api/documents/{doc_id}")
