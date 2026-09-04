import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_tags_and_bulk_delete():
    # 1. Create two docs with tags
    r1 = client.post("/api/documents/create", json={
        "title": "Doc 1 with Tags",
        "content": "Content for document 1. Multiple sentences here.",
        "tags": ["ai", "research"]
    })
    assert r1.status_code == 200
    doc1_id = r1.json()["id"]

    r2 = client.post("/api/documents/create", json={
        "title": "Doc 2 with Tags",
        "content": "Content for document 2. Another sentence here.",
        "tags": ["research", "news"]
    })
    assert r2.status_code == 200
    doc2_id = r2.json()["id"]

    # 2. Check tags in document listing
    list_res = client.get("/api/documents")
    assert list_res.status_code == 200
    docs = list_res.json()
    d1 = next((d for d in docs if d["id"] == doc1_id), None)
    assert d1 is not None
    assert "ai" in d1.get("tags", [])
    assert "research" in d1.get("tags", [])

    # 3. Test bulk deletion
    bulk_res = client.post("/api/documents/bulk-delete", json={
        "doc_ids": [doc1_id, doc2_id]
    })
    assert bulk_res.status_code == 200
    assert bulk_res.json()["deleted_count"] == 2

    # 4. Verify docs deleted
    check1 = client.get(f"/api/documents/{doc1_id}")
    assert check1.status_code == 404
    check2 = client.get(f"/api/documents/{doc2_id}")
    assert check2.status_code == 404
