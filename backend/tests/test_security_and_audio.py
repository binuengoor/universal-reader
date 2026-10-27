"""Regression tests for the audit fixes: path safety, CSRF/CORS, secrets, audio caching, SSRF, parsers."""
import asyncio
import io
import json
import os
import shutil
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

import backend.main as main_module
import backend.routes as routes
from backend.audio_utils import concat_mp3
from backend.chunking import BASE_DATA_DIR, chunk_text, save_document
from backend.config import SECRET_MASK
from backend.main import app
from backend.tts import SynthesizedAudio, tts_client

client = TestClient(app)


@pytest.fixture
def sample_doc():
    doc_id = uuid.uuid4().hex[:12]
    text = ("First paragraph sentence for audio. " * 8).strip() + "\n\n" + ("Second paragraph sentence. " * 8).strip()
    save_document(doc_id, "Security Doc", "text", text, chunk_text(text))
    yield doc_id
    shutil.rmtree(os.path.join(BASE_DATA_DIR, doc_id), ignore_errors=True)


@pytest.fixture
def victim_dir():
    """A directory next to the documents folder that must never be deleted."""
    parent = os.path.dirname(os.path.realpath(BASE_DATA_DIR))
    path = os.path.join(parent, f"victim_{uuid.uuid4().hex[:6]}")
    os.makedirs(path)
    with open(os.path.join(path, "keep.txt"), "w") as f:
        f.write("keep")
    yield path
    shutil.rmtree(path, ignore_errors=True)


# ------------------------------------------------------------------ path traversal


def test_bulk_delete_rejects_traversal(victim_dir):
    name = os.path.basename(victim_dir)
    res = client.post("/api/documents/bulk-delete", json={"doc_ids": [f"../{name}", "/", ".."]})
    assert res.status_code == 200
    assert res.json()["deleted_count"] == 0
    assert os.path.exists(os.path.join(victim_dir, "keep.txt"))
    assert os.path.isdir(BASE_DATA_DIR)


@pytest.mark.parametrize("path", ["/api/documents/%2e%2e", "/api/documents/..%2f..%2fvictim", "/api/documents/.."])
def test_delete_document_rejects_traversal(path):
    os.makedirs(BASE_DATA_DIR, exist_ok=True)
    res = client.delete(path)
    assert res.status_code in (404, 405)
    assert os.path.isdir(BASE_DATA_DIR)


def test_doc_routes_reject_dotted_ids():
    for path in ("/api/documents/%2e%2e/raw", "/api/documents/%2e%2e/blocks/0/audio"):
        assert client.get(path).status_code == 404


def test_spa_catch_all_cannot_escape_dist(tmp_path, monkeypatch):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html>app</html>")
    (dist / "sw.js").write_text("// sw")
    (tmp_path / "secret.txt").write_text("TOP SECRET")
    monkeypatch.setattr(main_module, "frontend_dist", str(dist))
    monkeypatch.setattr(main_module, "frontend_dist_real", str(dist))

    assert client.get("/sw.js").text == "// sw"
    leaked = client.get("/..%2fsecret.txt")
    assert "TOP SECRET" not in leaked.text
    assert client.get("/api/does-not-exist").status_code == 404


# ------------------------------------------------------------------ CSRF / CORS / auth


def test_cross_site_writes_are_blocked(sample_doc):
    res = client.delete(f"/api/documents/{sample_doc}", headers={"Sec-Fetch-Site": "cross-site", "Origin": "https://evil.example"})
    assert res.status_code == 403
    res = client.delete(f"/api/documents/{sample_doc}", headers={"Origin": "https://evil.example"})
    assert res.status_code == 403
    assert os.path.isdir(os.path.join(BASE_DATA_DIR, sample_doc))
    # Same-origin browser request still works
    ok = client.get(f"/api/documents/{sample_doc}", headers={"Sec-Fetch-Site": "same-origin"})
    assert ok.status_code == 200


def test_no_wildcard_cors():
    res = client.options(
        "/api/documents/bulk-delete",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert res.headers.get("access-control-allow-origin") is None
    assert res.headers.get("access-control-allow-credentials") is None


def test_settings_secrets_are_masked_and_round_trip(monkeypatch, tmp_path):
    (tmp_path / "config.json").write_text("{}")
    monkeypatch.setattr("backend.config.CONFIG_FILE", str(tmp_path / "config.json"))
    client.post("/api/settings", json={"tts_api_key": "sk-real", "llm_api_key": "sk-llm"})
    data = client.get("/api/settings").json()
    assert data["tts_api_key"] == SECRET_MASK and data["tts_api_key_set"] is True
    assert data["llm_api_key"] == SECRET_MASK
    assert "sk-real" not in json.dumps(data)

    # Posting the mask back must not overwrite the stored secret
    client.post("/api/settings", json={"tts_api_key": SECRET_MASK, "tts_base_url": "http://gw:8000"})
    saved = json.loads((tmp_path / "config.json").read_text())
    assert saved["tts_api_key"] == "sk-real"


def test_env_values_are_not_frozen_into_config(monkeypatch, tmp_path):
    cfg = tmp_path / "config.json"
    cfg.write_text("{}")
    monkeypatch.setattr("backend.config.CONFIG_FILE", str(cfg))
    monkeypatch.setenv("TTS_BASE_URL", "http://from-env:8000")
    client.post("/api/settings", json={"inter_block_pause_ms": 450})
    saved = json.loads(cfg.read_text())
    assert saved == {"inter_block_pause_ms": 450}
    monkeypatch.setenv("TTS_BASE_URL", "http://changed-env:8000")
    assert client.get("/api/settings").json()["tts_base_url"] == "http://changed-env:8000"


def test_basic_auth_when_password_set(monkeypatch):
    monkeypatch.setattr(main_module, "AUTH_PASSWORD", "pw")
    assert client.get("/api/documents").status_code == 401
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/documents", auth=("reader", "pw")).status_code == 200
    assert client.get("/api/documents", auth=("reader", "nope")).status_code == 401


# ------------------------------------------------------------------ audio


def test_fallback_audio_is_served_but_never_cached(sample_doc, monkeypatch):
    async def fake(text, voice, model="tts-1", speed=1.0, response_format="mp3"):
        audio = SynthesizedAudio(b"KOKORO-SUBSTITUTE")
        audio.fallback = True
        return audio

    monkeypatch.setattr(tts_client, "synthesize", fake)
    res = client.get(f"/api/documents/{sample_doc}/blocks/0/audio?voice=en-US-AriaNeural&model=edge-tts")
    assert res.status_code == 200
    assert res.content == b"KOKORO-SUBSTITUTE"
    assert res.headers["cache-control"] == "no-store"
    cache_dir = os.path.join(BASE_DATA_DIR, sample_doc, "audio_cache")
    assert not [f for f in os.listdir(cache_dir) if f.endswith(".mp3")]


def test_audio_is_immutable_only_with_matching_version(sample_doc, monkeypatch):
    monkeypatch.setattr(tts_client, "synthesize", AsyncMock(return_value=b"MP3DATA"))
    chunks = client.get(f"/api/documents/{sample_doc}").json()["chunks"]
    key = chunks[0]["audio_key"]
    base = f"/api/documents/{sample_doc}/blocks/0/audio?voice=v&model=edge-tts"

    assert client.get(base).headers["cache-control"] == "no-cache"
    assert "immutable" in client.get(f"{base}&v={key}").headers["cache-control"]
    assert client.get(f"{base}&v=stale").headers["cache-control"] == "no-cache"

    # Editing the text changes the key
    client.put(f"/api/documents/{sample_doc}", json={"content": "Completely different text. " * 20})
    new_key = client.get(f"/api/documents/{sample_doc}").json()["chunks"][0]["audio_key"]
    assert new_key != key


def test_concurrent_requests_synthesize_block_once(sample_doc, monkeypatch):
    calls = 0

    async def slow(text, voice, model="tts-1", speed=1.0, response_format="mp3"):
        nonlocal calls
        calls += 1
        await asyncio.sleep(0.05)
        return b"MP3DATA"

    monkeypatch.setattr(tts_client, "synthesize", slow)

    async def run():
        return await asyncio.gather(
            routes._synthesize_or_get_cached_audio(sample_doc, 0, "v", "edge-tts", 1.0),
            routes._synthesize_or_get_cached_audio(sample_doc, 0, "v", "edge-tts", 1.0),
        )

    asyncio.run(run())
    assert calls == 1


def test_concat_mp3_strips_per_segment_tags():
    def id3(payload: bytes) -> bytes:
        size = len(payload)
        syncsafe = bytes([(size >> 21) & 0x7F, (size >> 14) & 0x7F, (size >> 7) & 0x7F, size & 0x7F])
        return b"ID3\x04\x00\x00" + syncsafe + payload

    # MPEG1 Layer III, 128kbps, 44.1kHz frame header -> 417 byte frame
    header = bytes([0xFF, 0xFB, 0x90, 0x00])
    xing_frame = header + b"\x00" * 32 + b"Xing" + b"\x00" * (417 - 40)
    audio_frame = header + b"\x11" * (417 - 4)
    seg = id3(b"\x00" * 20) + xing_frame + audio_frame + b"TAG" + b"\x00" * 125
    out = concat_mp3([seg, seg])
    assert out == audio_frame + audio_frame


# ------------------------------------------------------------------ ingestion


def test_url_import_blocks_private_addresses():
    for url in ("http://127.0.0.1:9025/api/settings", "http://169.254.169.254/latest/meta-data/", "file:///etc/passwd"):
        res = client.post("/api/documents/url", json={"url": url})
        assert res.status_code == 400, url


def test_reddit_lookalike_url_is_not_treated_as_reddit():
    from backend.reddit import RedditClient

    assert not RedditClient.is_reddit_url("http://attacker.example/?x=https://reddit.com/s/abc")
    assert not RedditClient.is_reddit_url("https://reddit.com.evil.example/r/a/comments/abc")


def test_upload_size_limit(monkeypatch):
    monkeypatch.setattr(routes, "MAX_UPLOAD_MB", 0)
    res = client.post("/api/documents/upload", files={"file": ("a.txt", b"hello world", "text/plain")})
    assert res.status_code == 413


def test_reddit_docs_get_llm_topical_tags_plus_source_tags():
    from backend.reddit import RedditClient, RedditFetchResult

    fetched = RedditFetchResult(
        success=True, url="https://www.reddit.com/r/homelab/comments/abc/x/",
        markdown="# Title\n\n" + "Body text about servers. " * 20, title="Title", subreddit="homelab",
    )
    with patch.object(RedditClient, "fetch", new_callable=AsyncMock, return_value=fetched), patch(
        "backend.routes.llm_generate_title_and_tags", new_callable=AsyncMock, return_value=("T", ["networking"], "syn")
    ), patch("backend.routes.load_settings", return_value={"llm_base_url": "http://llm", "glossary": []}):
        res = client.post("/api/documents/url", json={"url": "https://www.reddit.com/r/homelab/comments/abc/x/"})
    assert res.status_code == 200
    tags = res.json()["tags"]
    assert tags[0] == "networking" and "reddit" in tags and "r/homelab" in tags
    client.delete(f"/api/documents/{res.json()['id']}")


def test_suggest_does_not_modify_documents(sample_doc):
    before = client.get(f"/api/documents/{sample_doc}").json()["meta"]
    with patch("backend.routes.llm_generate_title_and_tags", new_callable=AsyncMock, return_value=("New", ["x"], "s")), patch(
        "backend.routes.load_settings", return_value={"llm_base_url": "http://llm", "glossary": []}
    ):
        res = client.post("/api/documents/suggest", json={"content": "unsaved editor text"})
    assert res.json() == {"title": "New", "tags": ["x"], "synopsis": "s"}
    after = client.get(f"/api/documents/{sample_doc}").json()["meta"]
    assert after["title"] == before["title"] and after["tags"] == before["tags"]


def test_background_batch_job_reports_progress(sample_doc):
    settings = {"llm_base_url": "http://llm", "llm_api_key": "", "llm_model": "m", "glossary": []}
    with patch("backend.routes.load_settings", return_value=settings), patch(
        "backend.routes.llm_generate_synopsis", new_callable=AsyncMock, return_value="A synopsis."
    ), TestClient(app) as tc:
        job = tc.post(
            "/api/documents/batch-llm",
            json={"job_type": "synopsis", "doc_ids": [sample_doc], "overwrite": True, "background": True},
        ).json()
        assert job["status"] == "running"
        for _ in range(50):
            state = tc.get(f"/api/jobs/{job['id']}").json()
            if state["status"] != "running":
                break
        assert state["status"] == "completed"
        assert state["result"]["processed_count"] == 1


# ------------------------------------------------------------------ parsers


def test_epub_follows_spine_order_and_keeps_headings():
    from ebooklib import epub

    from backend.parsers import parse_epub

    book = epub.EpubBook()
    book.set_identifier("id1")
    book.set_title("T")
    ch2 = epub.EpubHtml(title="Two", file_name="b.xhtml", content="<h1>Chapter Two</h1><p>Second.</p>")
    ch1 = epub.EpubHtml(title="One", file_name="a.xhtml", content="<h1>Chapter One</h1><p>First.</p>")
    book.add_item(ch2)  # added first, but read second
    book.add_item(ch1)
    book.spine = [ch1, ch2]
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    buf = io.BytesIO()
    epub.write_epub(buf, book)

    text = parse_epub(buf.getvalue())
    assert text.index("# Chapter One") < text.index("# Chapter Two")


def test_pdf_drops_running_headers_and_page_numbers():
    import pymupdf

    from backend.parsers import parse_pdf

    doc = pymupdf.open()
    for i in range(4):
        page = doc.new_page()
        page.insert_text((72, 40), "My Book Running Header")
        page.insert_text((72, 200), f"Body text of page {i} with hyphen-")
        page.insert_text((72, 214), "ated words.")
        page.insert_text((300, 800), str(i + 1))
    text = parse_pdf(doc.tobytes())
    assert "Running Header" not in text
    assert "hyphenated" in text
    assert "Body text of page 3" in text
