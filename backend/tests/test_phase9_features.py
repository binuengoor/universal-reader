import pytest
import os
import json
import shutil
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backend.main import app
from backend.cleaner import llm_generate_title_and_tags
from backend.chunking import BASE_DATA_DIR, save_document, generate_doc_id
from backend.config import save_settings

client = TestClient(app)

@pytest.mark.asyncio
async def test_llm_generate_title_and_tags_under_50():
    fake_response = {
        "choices": [
            {
                "message": {
                    "content": json.dumps({
                        "title": "Quantum Computing Breakthroughs",
                        "tags": ["technology", "quantum-physics", "science"]
                    })
                }
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = fake_response

    with patch("httpx.AsyncClient.post", return_value=mock_resp):
        title, tags = await llm_generate_title_and_tags(
            content="Recent advances in quantum computing demonstrate fault-tolerant logical qubits.",
            existing_tags=["technology", "news"],
            llm_base_url="https://api.test.com/v1",
            llm_api_key="secret",
            llm_model="gpt-4o-mini"
        )

        assert title == "Quantum Computing Breakthroughs"
        assert "technology" in tags
        assert "quantum-physics" in tags
        assert len(tags) <= 3


@pytest.mark.asyncio
async def test_llm_generate_title_and_tags_at_50_capacity():
    # 50 existing tags
    existing = [f"category-{i}" for i in range(50)]
    
    # Simulate LLM returning 1 legal tag and 1 illegal new tag
    fake_response = {
        "choices": [
            {
                "message": {
                    "content": json.dumps({
                        "title": "Strict 50 Tag Note",
                        "tags": ["category-5", "unauthorized-new-tag"]
                    })
                }
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = fake_response

    with patch("httpx.AsyncClient.post", return_value=mock_resp):
        title, tags = await llm_generate_title_and_tags(
            content="Some text about category 5.",
            existing_tags=existing,
            llm_base_url="https://api.test.com/v1",
            llm_api_key="secret"
        )

        assert title == "Strict 50 Tag Note"
        # Should include category-5 and reject unauthorized-new-tag because capacity is 50
        assert "category-5" in tags
        assert "unauthorized-new-tag" not in tags


def test_tags_endpoints_and_rename():
    # Set up test document with tags
    doc_id = generate_doc_id()
    save_document(
        doc_id=doc_id,
        title="Test Tag Doc",
        source_type="text",
        text="Some document text for tagging.",
        chunks=[{"id": 0, "text": "Some text", "speech_text": "Some text", "char_count": 9}],
        tags=["ai-research", "robotics"]
    )

    try:
        # 1. Test GET /api/tags
        res = client.get("/api/tags")
        assert res.status_code == 200
        data = res.json()
        assert "tags" in data
        assert data["max_tags"] == 50
        tag_names = [t["tag"] for t in data["tags"]]
        assert "ai-research" in tag_names
        assert "robotics" in tag_names

        # 2. Test POST /api/tags/rename (rename ai-research -> artificial-intelligence)
        rename_res = client.post("/api/tags/rename", json={
            "old_tag": "ai-research",
            "new_tag": "artificial-intelligence"
        })
        assert rename_res.status_code == 200
        rename_data = rename_res.json()
        assert rename_data["status"] == "success"
        assert rename_data["updated_documents"] >= 1

        # Check doc meta has new tag
        meta_file = os.path.join(BASE_DATA_DIR, doc_id, "meta.json")
        with open(meta_file, "r") as f:
            meta = json.load(f)
        assert "artificial-intelligence" in meta["tags"]
        assert "ai-research" not in meta["tags"]

    finally:
        # Cleanup test doc
        shutil.rmtree(os.path.join(BASE_DATA_DIR, doc_id), ignore_errors=True)


def test_batch_llm_requires_config():
    # Temporarily ensure LLM is not configured
    save_settings({"llm_base_url": ""})
    res = client.post("/api/documents/batch-llm", json={
        "job_type": "title"
    })
    assert res.status_code == 400
    assert "LLM Base URL is not configured" in res.json()["detail"]
