import pytest
import httpx
from fastapi import HTTPException
from backend.tts import (
    UniversalTTSClient,
    compute_audio_hash,
    get_audio_filename
)

def test_compute_audio_hash_and_filename():
    h1 = compute_audio_hash("Hello world", "alloy", "tts-1", 1.0)
    h2 = compute_audio_hash("Hello world", "alloy", "tts-1", 1.0)
    h3 = compute_audio_hash("Hello world", "echo", "tts-1", 1.0)
    assert h1 == h2
    assert h1 != h3

    filename = get_audio_filename(3, "Alloy-Voice", "tts-1", 1.0, "Hello world")
    assert filename.startswith("3_alloy-voice_")
    assert filename.endswith(".mp3")
    assert compute_audio_hash("Hello world", "Alloy-Voice", "tts-1", 1.0) in filename

@pytest.mark.asyncio
async def test_list_models_success():
    def handler(request: httpx.Request):
        assert request.url.path == "/v1/models"
        assert request.headers.get("authorization") == "Bearer test-key"
        return httpx.Response(200, json={"data": [{"id": "tts-1"}, {"id": "tts-1-hd"}]})

    transport = httpx.MockTransport(handler)
    client = UniversalTTSClient(base_url="http://mock-tts:8000", api_key="test-key")

    original_init = httpx.AsyncClient.__init__
    def custom_init(self, *args, **kwargs):
        kwargs["transport"] = transport
        original_init(self, *args, **kwargs)

    httpx.AsyncClient.__init__ = custom_init
    try:
        models = await client.list_models()
        assert "data" in models
        assert len(models["data"]) == 2
    finally:
        httpx.AsyncClient.__init__ = original_init

@pytest.mark.asyncio
async def test_synthesize_success():
    fake_audio = b"\xff\xfb\x90\x00fake_mp3_data"

    def handler(request: httpx.Request):
        assert request.url.path == "/v1/audio/speech"
        import json
        body = json.loads(request.content.decode("utf-8"))
        assert body["input"] == "Test block text"
        assert body["voice"] == "alloy"
        assert body["model"] == "tts-1"
        assert body["speed"] == 1.25
        return httpx.Response(200, content=fake_audio, headers={"content-type": "audio/mpeg"})

    transport = httpx.MockTransport(handler)
    client = UniversalTTSClient(base_url="http://mock-tts:8000")

    original_init = httpx.AsyncClient.__init__
    def custom_init(self, *args, **kwargs):
        kwargs["transport"] = transport
        original_init(self, *args, **kwargs)

    httpx.AsyncClient.__init__ = custom_init
    try:
        result = await client.synthesize("Test block text", "alloy", "tts-1", 1.25)
        assert result == fake_audio
    finally:
        httpx.AsyncClient.__init__ = original_init

@pytest.mark.asyncio
async def test_synthesize_empty_text():
    client = UniversalTTSClient()
    with pytest.raises(HTTPException) as exc_info:
        await client.synthesize("", "alloy")
    assert exc_info.value.status_code == 400
