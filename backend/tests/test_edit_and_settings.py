import pytest
import os
import json
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_settings_flow():
    # Test GET settings
    get_res = client.get("/api/settings")
    assert get_res.status_code == 200
    data = get_res.json()
    assert "tts_base_url" in data
    assert "tts_default_model" in data

    # Test POST settings
    post_res = client.post("/api/settings", json={
        "tts_base_url": "https://test.tts.local",
        "tts_api_key": "sk-testkey",
        "tts_default_model": "edge-tts",
        "tts_default_voice": "en-US-ChristopherNeural"
    })
    assert post_res.status_code == 200
    saved = post_res.json()
    assert saved["tts_base_url"] == "https://test.tts.local"
    assert saved["tts_default_model"] == "edge-tts"

def test_raw_content_and_edit_document():
    # 1. Create a doc
    create_res = client.post("/api/documents/create", json={
        "title": "Editable Document",
        "content": "Paragraph 1 before edit.\n\nParagraph 2 before edit."
    })
    assert create_res.status_code == 200
    doc_id = create_res.json()["id"]

    # 2. GET raw document
    raw_res = client.get(f"/api/documents/{doc_id}/raw")
    assert raw_res.status_code == 200
    raw_data = raw_res.json()
    assert raw_data["title"] == "Editable Document"
    assert "Paragraph 1 before edit" in raw_data["content"]

    # 3. PUT edit document
    new_content = "First edited paragraph here.\n\nSecond brand new paragraph."
    put_res = client.put(f"/api/documents/{doc_id}", json={
        "title": "Renamed Edited Document",
        "content": new_content
    })
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["title"] == "Renamed Edited Document"
    assert updated["block_count"] >= 1

    # 4. Verify chunks reflect edit
    get_updated = client.get(f"/api/documents/{doc_id}")
    assert get_updated.status_code == 200
    chunks = get_updated.json()["chunks"]
    assert any("First edited paragraph" in c["text"] for c in chunks)
