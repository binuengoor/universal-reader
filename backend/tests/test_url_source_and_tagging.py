"""Tests for Phase 20: Source URL persistence and topical taxonomy quality."""
import json
import os
import re
import tempfile
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ─── Source URL Persistence ────────────────────────────────────────────────

def test_save_document_persists_source_url():
    """save_document stores source_url in meta.json when supplied."""
    from backend.chunking import save_document, chunk_text, generate_doc_id

    text = "Hello world. This is a test document for URL persistence."
    chunks = chunk_text(text)
    doc_id = generate_doc_id()
    url = "https://example.com/article"

    with tempfile.TemporaryDirectory() as tmpdir:
        with patch("backend.chunking.BASE_DATA_DIR", tmpdir):
            save_document(doc_id, "Test Doc", "url", text, chunks, source_url=url)
            meta_path = os.path.join(tmpdir, doc_id, "meta.json")
            with open(meta_path) as f:
                meta = json.load(f)
    assert meta["source_url"] == url


def test_save_document_source_url_none_when_not_provided():
    """save_document stores null source_url when not supplied."""
    from backend.chunking import save_document, chunk_text, generate_doc_id

    text = "Hello world. This is a manual text document."
    chunks = chunk_text(text)
    doc_id = generate_doc_id()

    with tempfile.TemporaryDirectory() as tmpdir:
        with patch("backend.chunking.BASE_DATA_DIR", tmpdir):
            save_document(doc_id, "Test Doc", "text", text, chunks)
            meta_path = os.path.join(tmpdir, doc_id, "meta.json")
            with open(meta_path) as f:
                meta = json.load(f)
    assert meta["source_url"] is None


def test_save_document_strips_whitespace_from_source_url():
    """save_document strips leading/trailing whitespace from source_url."""
    from backend.chunking import save_document, chunk_text, generate_doc_id

    text = "Sample content for testing URL stripping."
    chunks = chunk_text(text)
    doc_id = generate_doc_id()
    url = "  https://example.com/article  "

    with tempfile.TemporaryDirectory() as tmpdir:
        with patch("backend.chunking.BASE_DATA_DIR", tmpdir):
            save_document(doc_id, "Test Doc", "url", text, chunks, source_url=url)
            with open(os.path.join(tmpdir, doc_id, "meta.json")) as f:
                meta = json.load(f)
    assert meta["source_url"] == "https://example.com/article"


# ─── Tag Taxonomy Filtering ────────────────────────────────────────────────

def test_get_all_library_tags_filters_platform_tags():
    """get_all_library_tags excludes reddit, url, blog, article etc."""
    from backend.routes import get_all_library_tags

    docs_data = [
        {"tags": ["reddit", "r/google_antigravity", "technology"]},
        {"tags": ["article", "pdf", "science"]},
        {"tags": ["url", "web", "parenting"]},
    ]

    with tempfile.TemporaryDirectory() as tmpdir:
        for i, data in enumerate(docs_data):
            doc_dir = os.path.join(tmpdir, f"doc{i:03d}")
            os.makedirs(doc_dir)
            meta = {"id": f"doc{i:03d}", "title": "Test", "tags": data["tags"]}
            with open(os.path.join(doc_dir, "meta.json"), "w") as f:
                json.dump(meta, f)

        with patch("backend.routes.BASE_DATA_DIR", tmpdir):
            tags = get_all_library_tags()

    assert "reddit" not in tags
    assert "article" not in tags
    assert "pdf" not in tags
    assert "url" not in tags
    assert "web" not in tags
    assert "technology" in tags
    assert "science" in tags
    assert "parenting" in tags
    # r/* subreddit tags should be excluded
    assert not any(t.startswith("r/") for t in tags)


def test_get_all_library_tags_include_non_topical():
    """get_all_library_tags(include_non_topical=True) returns ALL tags."""
    from backend.routes import get_all_library_tags

    with tempfile.TemporaryDirectory() as tmpdir:
        doc_dir = os.path.join(tmpdir, "docabc")
        os.makedirs(doc_dir)
        meta = {"id": "docabc", "title": "Test", "tags": ["reddit", "technology"]}
        with open(os.path.join(doc_dir, "meta.json"), "w") as f:
            json.dump(meta, f)

        with patch("backend.routes.BASE_DATA_DIR", tmpdir):
            tags = get_all_library_tags(include_non_topical=True)

    assert "reddit" in tags
    assert "technology" in tags


def test_is_topical_tag():
    """is_topical_tag correctly classifies tags."""
    from backend.routes import is_topical_tag

    # Non-topical
    assert not is_topical_tag("reddit")
    assert not is_topical_tag("url")
    assert not is_topical_tag("blog")
    assert not is_topical_tag("article")
    assert not is_topical_tag("pdf")
    assert not is_topical_tag("r/programming")
    assert not is_topical_tag("u/username")
    assert not is_topical_tag("")

    # Topical
    assert is_topical_tag("technology")
    assert is_topical_tag("parenting")
    assert is_topical_tag("spirituality")
    assert is_topical_tag("machine-learning")
    assert is_topical_tag("personal-development")


# ─── Cleaner Prompt Post-filtering ────────────────────────────────────────

@pytest.mark.asyncio
async def test_llm_generate_title_and_tags_filters_platform_tags():
    """llm_generate_title_and_tags strips forbidden platform tags even if LLM returns them."""
    import httpx
    from backend.cleaner import llm_generate_title_and_tags

    mock_response_body = json.dumps({
        "choices": [{
            "message": {
                "content": json.dumps({
                    "title": "Lessons From My Father",
                    "tags": ["reddit", "parenting", "personal-development"],  # reddit should be stripped
                    "synopsis": "A story about parental wisdom."
                })
            }
        }]
    })

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = json.loads(mock_response_body)
        mock_resp.text = mock_response_body

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_resp)
        mock_client_cls.return_value = mock_client

        title, tags, synopsis = await llm_generate_title_and_tags(
            content="My father always said...",
            existing_tags=["reddit", "technology"],
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="",
            llm_model="test",
            include_synopsis=True
        )

    assert "reddit" not in tags
    assert "parenting" in tags
    assert "personal-development" in tags
    assert title == "Lessons From My Father"


@pytest.mark.asyncio
async def test_llm_generate_title_and_tags_existing_tags_excludes_platform():
    """llm_generate_title_and_tags only shows topical existing tags to LLM."""
    import httpx
    from backend.cleaner import llm_generate_title_and_tags

    # Capture the payload sent to the LLM
    captured_payload = {}

    async def fake_post(url, *, json=None, headers=None, **kwargs):
        captured_payload.update(json or {})
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": '{"title": "Test", "tags": ["technology"]}'}}]
        }
        mock_resp.text = ""
        return mock_resp

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = fake_post
        mock_client_cls.return_value = mock_client

        await llm_generate_title_and_tags(
            content="Article about software engineering practices.",
            existing_tags=["reddit", "r/programming", "technology", "software-architecture"],
            llm_base_url="http://localhost:11434/v1",
            llm_api_key="",
            llm_model="test",
        )

    # The system prompt should NOT mention reddit or r/programming
    system_prompt = captured_payload.get("messages", [{}])[0].get("content", "")
    assert "reddit" not in system_prompt or "FORBIDDEN" in system_prompt
    assert "r/programming" not in system_prompt
