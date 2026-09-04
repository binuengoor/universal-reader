import os
import json
import pytest
from starlette.testclient import TestClient
from backend.main import app
from backend.chunking import save_document, BASE_DATA_DIR
from backend.tts import tts_client, get_audio_filename

client = TestClient(app)

@pytest.fixture
def sample_doc():
    doc_id = "test-doc-audio"
    chunks = [
        {"id": 0, "text": "This is block zero of our test document.", "char_count": 40},
        {"id": 1, "text": "This is block one with more informative details.", "char_count": 49}
    ]
    save_document(doc_id, "Test Doc Audio", "text", "Full text here", chunks)
    yield doc_id
    # Clean up
    doc_dir = os.path.join(BASE_DATA_DIR, doc_id)
    import shutil
    if os.path.exists(doc_dir):
        shutil.rmtree(doc_dir)

def test_audio_not_found_document():
    res = client.post("/api/documents/non-existent-doc/blocks/0/audio", json={"voice": "alloy"})
    assert res.status_code == 404

def test_audio_not_found_block(sample_doc):
    res = client.post(f"/api/documents/{sample_doc}/blocks/999/audio", json={"voice": "alloy"})
    assert res.status_code == 404

def test_audio_cache_miss_then_hit(sample_doc, monkeypatch):
    call_count = 0
    fake_audio = b"\xff\xfb\x90\x00synthetic_audio_payload"

    async def mock_synthesize(text, voice, model="tts-1", speed=1.0, response_format="mp3"):
        nonlocal call_count
        call_count += 1
        return fake_audio

    monkeypatch.setattr(tts_client, "synthesize", mock_synthesize)

    # First call: Cache Miss
    res1 = client.post(
        f"/api/documents/{sample_doc}/blocks/0/audio",
        json={"voice": "alloy", "model": "tts-1", "speed": 1.0}
    )
    assert res1.status_code == 200
    assert res1.headers.get("x-cache") == "MISS"
    assert res1.content == fake_audio
    assert call_count == 1

    # Verify file exists on disk with correct spec format: <block_id>_<voice>_<hash>.mp3
    cache_dir = os.path.join(BASE_DATA_DIR, sample_doc, "audio_cache")
    expected_filename = get_audio_filename(0, "alloy", "tts-1", 1.0, "This is block zero of our test document.")
    cached_file = os.path.join(cache_dir, expected_filename)
    assert os.path.exists(cached_file)
    with open(cached_file, "rb") as f:
        assert f.read() == fake_audio

    # Second call: Cache Hit
    res2 = client.post(
        f"/api/documents/{sample_doc}/blocks/0/audio",
        json={"voice": "alloy", "model": "tts-1", "speed": 1.0}
    )
    assert res2.status_code == 200
    assert res2.headers.get("x-cache") == "HIT"
    assert res2.content == fake_audio
    assert call_count == 1  # Was not called again!

    # Also test GET endpoint for audio tags
    res3 = client.get(
        f"/api/documents/{sample_doc}/blocks/0/audio?voice=alloy&model=tts-1&speed=1.0"
    )
    assert res3.status_code == 200
    assert res3.headers.get("x-cache") == "HIT"
    assert res3.content == fake_audio
    assert call_count == 1
