import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import httpx
from starlette.testclient import TestClient

from backend.reddit import RedditClient, RedditFetchResult
from backend.main import app

SAMPLE_REDDIT_JSON = [
    {
        "kind": "Listing",
        "data": {
            "children": [
                {
                    "kind": "t3",
                    "data": {
                        "id": "1wh1uyl",
                        "title": "What's your Antigravity workflow? Here's mine.",
                        "subreddit": "google_antigravity",
                        "author": "SecondHandLabs",
                        "score": 10,
                        "upvote_ratio": 1.0,
                        "selftext": "I have been using Antigravity with 3.8 medium and I have found it to be surprisingly good with logic and coding.",
                        "permalink": "/r/google_antigravity/comments/1wh1uyl/whats_your_antigravity_workflow_heres_mine/",
                        "url": "https://www.reddit.com/r/google_antigravity/comments/1wh1uyl/whats_your_antigravity_workflow_heres_mine/",
                        "created_utc": 1757946240.0,
                    },
                }
            ]
        },
    },
    {
        "kind": "Listing",
        "data": {
            "children": [
                {
                    "kind": "t1",
                    "data": {
                        "id": "c1",
                        "author": "SuperUser42",
                        "score": 5,
                        "body": "Great workflow! How do you configure memory settings?",
                        "replies": {
                            "kind": "Listing",
                            "data": {
                                "children": [
                                    {
                                        "kind": "t1",
                                        "data": {
                                            "id": "c2",
                                            "author": "SecondHandLabs",
                                            "score": 3,
                                            "body": "I keep AGENTS.md concise and rely on skills.",
                                            "replies": "",
                                        },
                                    }
                                ]
                            },
                        },
                    },
                },
                {
                    "kind": "t1",
                    "data": {
                        "id": "c3",
                        "author": "[deleted]",
                        "score": 1,
                        "body": "[deleted]",
                        "replies": "",
                    },
                },
            ]
        },
    },
]


def test_is_reddit_url():
    valid_urls = [
        "https://www.reddit.com/r/google_antigravity/comments/1wh1uyl/whats_your_antigravity_workflow_heres_mine/",
        "http://reddit.com/r/homelab/comments/123456",
        "https://old.reddit.com/r/selfhosted/comments/abcdef/my_setup/",
        "https://redd.it/1wh1uyl",
        "https://new.reddit.com/comments/xyz123/",
        "https://www.reddit.com/gallery/1wh1uyl",
        "https://www.reddit.com/r/google_antigravity/s/QgktoBYeVl",
        "https://reddit.com/s/AbCdEfGh",
    ]
    for u in valid_urls:
        assert RedditClient.is_reddit_url(u) is True, f"Failed for {u}"

    invalid_urls = [
        "https://google.com",
        "https://github.com/google/antigravity",
        "https://en.wikipedia.org/wiki/Reddit",
        "https://reddit.com/user/someone",
    ]
    for u in invalid_urls:
        assert RedditClient.is_reddit_url(u) is False, f"Incorrectly matched {u}"


def test_extract_direct_post_id():
    assert RedditClient.extract_direct_post_id("https://www.reddit.com/r/test/comments/1wh1uyl/title/") == "1wh1uyl"
    assert RedditClient.extract_direct_post_id("https://redd.it/abcdef") == "abcdef"
    assert RedditClient.extract_direct_post_id("https://old.reddit.com/comments/999xyz") == "999xyz"
    assert RedditClient.extract_direct_post_id("https://www.reddit.com/gallery/gal123") == "gal123"
    assert RedditClient.extract_direct_post_id("https://www.reddit.com/r/test/s/QgktoBYeVl") is None


@pytest.mark.asyncio
async def test_extract_post_id_resolves_share_redirect():
    mock_http = AsyncMock(spec=httpx.AsyncClient)
    mock_resp = MagicMock()
    mock_resp.url = "https://www.reddit.com/r/google_antigravity/comments/1wh1uyl/whats_your_antigravity_workflow_heres_mine/?share_id=..."
    mock_http.get.return_value = mock_resp

    client = RedditClient(settings={})
    post_id = await client.extract_post_id(mock_http, "https://www.reddit.com/r/google_antigravity/s/QgktoBYeVl")
    assert post_id == "1wh1uyl"
    mock_http.get.assert_awaited_once()


def test_cookie_resolution(tmp_path):
    # Test setting resolution
    client = RedditClient(settings={"reddit_session_cookie": "token_abc"})
    assert client._resolve_cookies() == {"reddit_session": "token_abc"}

    # Test file resolution
    cred_file = tmp_path / "credential.json"
    cred_file.write_text(json.dumps({"cookies": {"reddit_session": "token_file", "loid": "loid_123"}}))
    client_file = RedditClient(settings={"reddit_credential_path": str(cred_file)})
    assert client_file._resolve_cookies() == {"reddit_session": "token_file", "loid": "loid_123"}


def test_format_thread():
    client = RedditClient(settings={"reddit_comment_depth": 3})
    markdown, title, subreddit, author, score = client._format_thread(
        SAMPLE_REDDIT_JSON,
        original_url="https://www.reddit.com/r/google_antigravity/comments/1wh1uyl/whats_your_antigravity_workflow_heres_mine/",
    )

    assert title == "What's your Antigravity workflow? Here's mine."
    assert subreddit == "google_antigravity"
    assert author == "SecondHandLabs"
    assert score == 10

    # Header checks
    assert "# What's your Antigravity workflow? Here's mine." in markdown
    assert "**Subreddit:** r/google_antigravity" in markdown
    assert "**Author:** u/SecondHandLabs" in markdown
    assert "**Score:** +10" in markdown
    assert "[Thread Link]" in markdown

    # Body check
    assert "I have been using Antigravity with 3.8 medium" in markdown

    # Comments check
    assert "## Comments Section" in markdown
    assert "### u/SuperUser42 (+5)" in markdown
    assert "Great workflow! How do you configure memory settings?" in markdown

    # Nested reply check
    assert "> **u/SecondHandLabs** (+3):" in markdown
    assert "> I keep AGENTS.md concise and rely on skills." in markdown

    # Deleted comments omitted
    assert "[deleted]" not in markdown


@pytest.mark.asyncio
async def test_fetch_success():
    mock_http = AsyncMock(spec=httpx.AsyncClient)
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 200
    mock_resp.json.return_value = SAMPLE_REDDIT_JSON
    mock_http.get.return_value = mock_resp

    client = RedditClient(settings={})
    res = await client.fetch(
        "https://www.reddit.com/r/google_antigravity/comments/1wh1uyl/whats_your_antigravity_workflow_heres_mine/",
        client=mock_http,
    )

    assert res.success is True
    assert res.status_code == 200
    assert res.title == "What's your Antigravity workflow? Here's mine."
    assert "SuperUser42" in res.markdown
    assert "SecondHandLabs" in res.markdown


@pytest.mark.asyncio
async def test_fetch_http_error():
    mock_http = AsyncMock(spec=httpx.AsyncClient)
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.status_code = 403
    mock_http.get.return_value = mock_resp

    client = RedditClient(settings={})
    res = await client.fetch(
        "https://www.reddit.com/r/google_antigravity/comments/1wh1uyl/test/",
        client=mock_http,
    )

    assert res.success is False
    assert res.status_code == 403
    assert "HTTP 403" in res.error


def test_api_ingest_reddit_url_mocked(tmp_path):
    with patch.object(
        RedditClient,
        "fetch",
        new_callable=AsyncMock,
        return_value=RedditFetchResult(
            success=True,
            url="https://www.reddit.com/r/google_antigravity/comments/1wh1uyl/test/",
            markdown="# Mocked Post Title\n\n**Subreddit:** r/google_antigravity\n\nSome great post content.\n\n---\n## Comments Section\n\n### u/commenter (+2)\nNice post!",
            title="Mocked Post Title",
            subreddit="google_antigravity",
            author="test_author",
            score=5,
            status_code=200,
        ),
    ):
        client = TestClient(app)
        resp = client.post(
            "/api/documents/url",
            json={"url": "https://www.reddit.com/r/google_antigravity/s/QgktoBYeVl"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Mocked Post Title"
        assert "reddit" in data["tags"]
        assert "r/google_antigravity" in data["tags"]
        assert data["block_count"] >= 1

        # Clean up document
        doc_id = data["id"]
        del_resp = client.delete(f"/api/documents/{doc_id}")
        assert del_resp.status_code == 200


def test_live_example_url_fetch():
    """Live verification using the actual example Reddit URL."""
    client = TestClient(app)
    url = "https://www.reddit.com/r/google_antigravity/s/QgktoBYeVl"
    resp = client.post("/api/documents/url", json={"url": url})
    assert resp.status_code == 200
    data = resp.json()
    assert "Antigravity workflow" in data["title"]
    assert "reddit" in data["tags"]
    assert "r/google_antigravity" in data["tags"]
    assert data["block_count"] >= 10

    # Clean up created doc
    doc_id = data["id"]
    del_resp = client.delete(f"/api/documents/{doc_id}")
    assert del_resp.status_code == 200
