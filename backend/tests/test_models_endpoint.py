import pytest
import httpx
from starlette.testclient import TestClient
from backend.main import app
from backend.tts import tts_client

client = TestClient(app)

def test_get_models_fallback_when_unreachable():
    # Since default mock port is not running, it should return fallback models safely without 500 crash
    response = client.get("/api/models")
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert len(data["data"]) >= 1
    assert any(m["id"] == "tts-1" for m in data["data"])
    assert data["upstream_available"] is False

def test_get_models_with_search_filter(monkeypatch):
    async def mock_list_models():
        return {
            "object": "list",
            "data": [
                {"id": "tts-1", "name": "OpenAI Standard"},
                {"id": "tts-1-hd", "name": "OpenAI HD"},
                {"id": "kokoro-v0_19", "name": "Kokoro 82M"},
                {"id": "piper-en-lessac", "name": "Piper Lessac"}
            ]
        }

    monkeypatch.setattr(tts_client, "list_models", mock_list_models)

    # All models
    res = client.get("/api/models")
    assert res.status_code == 200
    assert len(res.json()["data"]) == 4

    # Search filter "kokoro"
    res_koko = client.get("/api/models?search=kokoro")
    assert res_koko.status_code == 200
    items = res_koko.json()["data"]
    assert len(items) == 1
    assert items[0]["id"] == "kokoro-v0_19"

    # Search filter with q param
    res_q = client.get("/api/models?q=openai")
    assert res_q.status_code == 200
    assert len(res_q.json()["data"]) == 2
