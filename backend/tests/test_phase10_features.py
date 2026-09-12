import json
import os
import pytest
from starlette.testclient import TestClient
from backend.main import app
from backend.chunking import save_document, chunk_text, BASE_DATA_DIR, compute_hash
from backend.cleaner import clean_text_for_speech, apply_glossary
from backend.config import load_settings, save_settings

client = TestClient(app)

def test_content_hash_and_llm_state():
    """Verify save_document computes content_hash and initializes llm_state."""
    doc_id = "test_phase10_hash_1"
    text = "Universal Reader is a fast text-to-speech reader for notes and articles."
    chunks = chunk_text(text)
    save_document(doc_id, "Phase 10 Test Hash", "text", text, chunks, tags=["audio", "reader"])

    meta_file = os.path.join(BASE_DATA_DIR, doc_id, "meta.json")
    assert os.path.exists(meta_file)
    with open(meta_file, "r", encoding="utf-8") as f:
        meta = json.load(f)

    assert meta["content_hash"] == compute_hash(text)
    assert "llm_state" in meta
    assert meta["status"] == "inbox"
    assert meta["favorite"] is False
    assert meta["last_block_index"] == 0
    assert meta["progress_pct"] == 0.0

def test_apply_glossary_and_phonetics():
    """Verify pronunciation glossary replaces words at word boundaries."""
    glossary = [
        {"find": "k8s", "replace": "Kubernetes"},
        {"find": "FastAPI", "replace": "Fast A-P-I"}
    ]
    raw = "Deploy our k8s cluster using FastAPI on cloud."
    res = apply_glossary(raw, glossary)
    assert "Kubernetes" in res
    assert "Fast A-P-I" in res
    assert "k8s" not in res

    # Verify clean_text_for_speech uses glossary
    cleaned = clean_text_for_speech("Check out k8s **docs** at https://k8s.io [1]!", glossary=glossary)
    assert "Kubernetes docs" in cleaned
    assert "https" not in cleaned

def test_document_status_and_progress():
    """Verify updating document status, favorites, and progress tracking."""
    doc_id = "test_phase10_status_1"
    text = "Paragraph one for testing reading progress.\n\nParagraph two for second block."
    chunks = chunk_text(text)
    save_document(doc_id, "Status Test Doc", "text", text, chunks)

    # 1. Update status to reading and favorite to true
    res = client.patch(f"/api/documents/{doc_id}/status", json={"status": "reading", "favorite": True})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "reading"
    assert data["favorite"] is True

    # 2. Update progress
    res_prog = client.patch(f"/api/documents/{doc_id}/progress", json={"last_block_index": 1})
    assert res_prog.status_code == 200
    prog_data = res_prog.json()
    assert prog_data["last_block_index"] == 1
    assert prog_data["progress_pct"] > 0

    # 3. Verify get_document includes updated fields
    get_res = client.get(f"/api/documents/{doc_id}")
    assert get_res.status_code == 200
    doc_data = get_res.json()
    assert doc_data["meta"]["favorite"] is True
    assert doc_data["meta"]["status"] == "reading"

def test_list_documents_filtering_and_search():
    """Verify filtering by status, favorites, and full-text search."""
    doc_id1 = "test_phase10_search_1"
    doc_id2 = "test_phase10_search_2"
    text1 = "Quantum computing algorithms for cryptography."
    text2 = "Delicious recipes for homemade sourdough bread."
    chunks1 = chunk_text(text1)
    chunks2 = chunk_text(text2)
    save_document(doc_id1, "Quantum Algorithms", "text", text1, chunks1, tags=["physics", "quantum"])
    save_document(doc_id2, "Baking Sourdough", "text", text2, chunks2, tags=["cooking"])

    # Mark doc2 as archived and favorite
    client.patch(f"/api/documents/{doc_id2}/status", json={"status": "archived", "favorite": True})

    # Test favorite filter
    fav_res = client.get("/api/documents?favorite=true")
    assert fav_res.status_code == 200
    fav_ids = [d["id"] for d in fav_res.json()]
    assert doc_id2 in fav_ids
    assert doc_id1 not in fav_ids

    # Test status filter
    arch_res = client.get("/api/documents?status=archived")
    assert arch_res.status_code == 200
    arch_ids = [d["id"] for d in arch_res.json()]
    assert doc_id2 in arch_ids
    assert doc_id1 not in arch_ids

    # Test full-text search
    search_res = client.get("/api/documents?q=cryptography")
    assert search_res.status_code == 200
    search_ids = [d["id"] for d in search_res.json()]
    assert doc_id1 in search_ids
    assert doc_id2 not in search_ids

def test_batch_llm_smart_skipping():
    """Verify batch-llm skips documents whose content_hash is already up-to-date."""
    # Ensure LLM settings are enabled
    save_settings({
        "llm_base_url": "https://api.mock.test/v1",
        "llm_api_key": "test-key",
        "llm_model": "test-model"
    })

    doc_id = "test_phase10_batch_skip_1"
    text = "Short note about artificial intelligence systems."
    chunks = chunk_text(text)
    save_document(doc_id, "AI Systems Note", "text", text, chunks, tags=["tech"])

    # Manually set llm_state hashes to match content_hash
    meta_path = os.path.join(BASE_DATA_DIR, doc_id, "meta.json")
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    chash = meta["content_hash"]
    meta["llm_state"] = {
        "title_hash": chash,
        "tags_hash": chash,
        "speech_hash": chash,
        "last_processed_at": "2026-09-12T00:00:00Z"
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    # Run batch LLM with overwrite=False
    res = client.post("/api/documents/batch-llm", json={
        "doc_ids": [doc_id],
        "job_type": "all",
        "overwrite": False
    })
    assert res.status_code == 200
    data = res.json()
    assert data["processed_count"] == 0
    assert data["skipped_count"] == 1
