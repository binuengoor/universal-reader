import os
import pytest
from starlette.testclient import TestClient
from backend.main import app
from backend.chunking import save_document, BASE_DATA_DIR

client = TestClient(app)

def test_delete_document_and_cache_invalidation():
    doc_id = "test-doc-delete"
    chunks = [
        {"id": 0, "text": "Block zero text", "char_count": 15},
        {"id": 1, "text": "Block one text", "char_count": 14}
    ]
    doc_dir = save_document(doc_id, "Test Doc Delete", "text", "Full content", chunks)
    cache_dir = os.path.join(doc_dir, "audio_cache")

    # Create dummy audio cache files
    f0 = os.path.join(cache_dir, "0_alloy_hash1.mp3")
    f1 = os.path.join(cache_dir, "1_alloy_hash2.mp3")
    with open(f0, "wb") as f:
        f.write(b"fake-audio-0")
    with open(f1, "wb") as f:
        f.write(b"fake-audio-1")

    assert os.path.exists(f0)
    assert os.path.exists(f1)

    # Invalidate block 0 cache
    res_b = client.delete(f"/api/documents/{doc_id}/blocks/0/cache")
    assert res_b.status_code == 200
    assert res_b.json()["files_removed"] == 1
    assert not os.path.exists(f0)
    assert os.path.exists(f1)

    # Invalidate remaining doc cache
    res_c = client.delete(f"/api/documents/{doc_id}/cache")
    assert res_c.status_code == 200
    assert res_c.json()["files_removed"] == 1
    assert not os.path.exists(f1)
    assert os.path.exists(doc_dir)

    # Delete entire document
    res_del = client.delete(f"/api/documents/{doc_id}")
    assert res_del.status_code == 200
    assert res_del.json()["status"] == "deleted"
    assert not os.path.exists(doc_dir)

    # Subsequent delete gives 404
    res_del404 = client.delete(f"/api/documents/{doc_id}")
    assert res_del404.status_code == 404
