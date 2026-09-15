"""Reddit thread extractor — fetches posts and comments via Reddit JSON API
and formats into structured Markdown for Universal Reader.
"""

from __future__ import annotations

import datetime
import json
import logging
from dataclasses import dataclass
from pathlib import Path
import re
from typing import Any, Optional

import httpx

from backend.config import load_settings

log = logging.getLogger(__name__)

# URL regex for Reddit thread matching
_REDDIT_THREAD_PATTERN = re.compile(
    r"https?://(?:(?:www|old|new|np)\.)?reddit\.com/(?:r/[^/]+/)?comments/([a-z0-9]+)",
    re.IGNORECASE,
)
_REDDIT_SHORT_PATTERN = re.compile(
    r"https?://redd\.it/([a-z0-9]+)",
    re.IGNORECASE,
)
_REDDIT_GALLERY_PATTERN = re.compile(
    r"https?://(?:(?:www|old|new|np)\.)?reddit\.com/gallery/([a-z0-9]+)",
    re.IGNORECASE,
)
_REDDIT_SHARE_PATTERN = re.compile(
    r"https?://(?:(?:www|old|new|np)\.)?reddit\.com/(?:r/[^/]+/)?s/([a-zA-Z0-9]+)",
    re.IGNORECASE,
)

# Standard browser fingerprint headers (Chrome 133 / macOS)
_BROWSER_HEADERS: dict[str, str] = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/133.0.0.0 Safari/537.36"
    ),
    "sec-ch-ua": '"Chromium";v="133", "Not(A:Brand";v="99", "Google Chrome";v="133"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}


@dataclass
class RedditFetchResult:
    success: bool
    url: str
    markdown: str = ""
    title: str = ""
    subreddit: str = ""
    author: str = ""
    score: int = 0
    status_code: Optional[int] = None
    error: Optional[str] = None


class RedditClient:
    """Specialized client for Reddit post and discussion extraction."""

    def __init__(self, settings: Optional[dict[str, Any]] = None) -> None:
        self._settings = settings if settings is not None else load_settings()
        self._timeout = float(self._settings.get("reddit_timeout", 15.0))
        self._comment_limit = int(self._settings.get("reddit_comment_limit", 50))
        self._max_depth = int(self._settings.get("reddit_comment_depth", 3))

    @staticmethod
    def is_reddit_url(url: str) -> bool:
        """Check if a given URL is a Reddit post, thread, or share link."""
        return bool(
            _REDDIT_THREAD_PATTERN.search(url)
            or _REDDIT_SHORT_PATTERN.search(url)
            or _REDDIT_GALLERY_PATTERN.search(url)
            or _REDDIT_SHARE_PATTERN.search(url)
        )

    @staticmethod
    def extract_direct_post_id(url: str) -> str | None:
        """Extract the base36 post ID from a standard Reddit URL without network calls."""
        match = _REDDIT_THREAD_PATTERN.search(url)
        if match:
            return match.group(1)
        match = _REDDIT_SHORT_PATTERN.search(url)
        if match:
            return match.group(1)
        match = _REDDIT_GALLERY_PATTERN.search(url)
        if match:
            return match.group(1)
        return None

    async def extract_post_id(self, client: httpx.AsyncClient, url: str) -> str | None:
        """Extract post ID, resolving Reddit share redirects (/s/...) if necessary."""
        direct_id = self.extract_direct_post_id(url)
        if direct_id:
            return direct_id

        if _REDDIT_SHARE_PATTERN.search(url):
            try:
                # Resolve share URL redirect
                resp = await client.head(
                    url,
                    headers=_BROWSER_HEADERS,
                    follow_redirects=True,
                    timeout=self._timeout,
                )
                final_url = str(resp.url)
                resolved_id = self.extract_direct_post_id(final_url)
                if resolved_id:
                    return resolved_id

                # Fallback to GET if HEAD didn't follow to final destination
                resp = await client.get(
                    url,
                    headers=_BROWSER_HEADERS,
                    follow_redirects=True,
                    timeout=self._timeout,
                )
                return self.extract_direct_post_id(str(resp.url))
            except Exception as exc:
                log.warning("Failed to resolve Reddit share redirect for %s: %s", url, exc)

        return None

    def _resolve_cookies(self) -> dict[str, str]:
        """Resolve Reddit authentication cookies from settings or local credentials file."""
        # 1. Explicit session cookie in settings
        session_cookie = self._settings.get("reddit_session_cookie")
        if session_cookie and str(session_cookie).strip():
            return {"reddit_session": str(session_cookie).strip()}

        # 2. Configured credential file path
        candidate_paths: list[Path] = []
        cred_path = self._settings.get("reddit_credential_path")
        if cred_path and str(cred_path).strip():
            candidate_paths.append(Path(str(cred_path).strip()))

        # 3. Default rdt-cli credential location (~/.config/rdt-cli/credential.json)
        default_cred = Path.home() / ".config" / "rdt-cli" / "credential.json"
        candidate_paths.append(default_cred)

        for path in candidate_paths:
            if path.is_file():
                try:
                    with open(path, encoding="utf-8") as f:
                        data = json.load(f)
                    cookies = data.get("cookies", {})
                    if isinstance(cookies, dict) and cookies:
                        return {str(k): str(v) for k, v in cookies.items()}
                except Exception as exc:
                    log.debug("Failed reading credentials from %s: %s", path, exc)

        return {}

    async def fetch(
        self,
        url: str,
        client: Optional[httpx.AsyncClient] = None,
    ) -> RedditFetchResult:
        """Fetch post and comments from Reddit JSON API and format into Markdown."""
        if client is not None:
            return await self._fetch_with_client(client, url)
        else:
            async with httpx.AsyncClient(follow_redirects=True) as new_client:
                return await self._fetch_with_client(new_client, url)

    async def _fetch_with_client(self, client: httpx.AsyncClient, url: str) -> RedditFetchResult:
        post_id = await self.extract_post_id(client, url)
        if not post_id:
            return RedditFetchResult(
                success=False,
                url=url,
                error="Could not extract Reddit post ID from URL",
            )

        api_url = (
            f"https://www.reddit.com/comments/{post_id}.json"
            f"?raw_json=1&limit={self._comment_limit}&sort=best"
        )
        cookies = self._resolve_cookies()
        if cookies:
            client.cookies.update(cookies)

        try:
            resp = await client.get(
                api_url,
                headers=_BROWSER_HEADERS,
                timeout=self._timeout,
                follow_redirects=True,
            )

            if resp.status_code != 200:
                log.warning("Reddit API returned HTTP %s for %s", resp.status_code, url)
                return RedditFetchResult(
                    success=False,
                    url=url,
                    status_code=resp.status_code,
                    error=f"Reddit API returned HTTP {resp.status_code}",
                )

            data = resp.json()
            if not isinstance(data, list) or len(data) < 2:
                return RedditFetchResult(
                    success=False,
                    url=url,
                    status_code=resp.status_code,
                    error="Unexpected response structure from Reddit JSON API",
                )

            markdown, title, subreddit, author, score = self._format_thread(data, original_url=url)

            return RedditFetchResult(
                success=True,
                url=url,
                markdown=markdown,
                title=title,
                subreddit=subreddit,
                author=author,
                score=score,
                status_code=resp.status_code,
            )

        except httpx.TimeoutException:
            log.warning("Reddit fetch timed out for %s", url)
            return RedditFetchResult(
                success=False,
                url=url,
                error="Reddit fetch timed out",
            )
        except Exception as exc:
            log.warning("Reddit fetch failed for %s: %s", url, exc)
            return RedditFetchResult(
                success=False,
                url=url,
                error=str(exc),
            )

    def _format_thread(
        self,
        data: list[dict[str, Any]],
        original_url: str,
    ) -> tuple[str, str, str, str, int]:
        """Convert Reddit JSON payload into structured Markdown."""
        post_listing = data[0].get("data", {}).get("children", [])
        post_data = post_listing[0].get("data", {}) if post_listing else {}

        title = post_data.get("title", "Reddit Post")
        subreddit = post_data.get("subreddit", "reddit")
        author = post_data.get("author", "[unknown]")
        score = post_data.get("score", 0)
        upvote_ratio = post_data.get("upvote_ratio")
        selftext = post_data.get("selftext", "").strip()
        permalink = post_data.get("permalink", "")
        full_permalink = f"https://www.reddit.com{permalink}" if permalink else original_url
        external_url = post_data.get("url", "")
        created_utc = post_data.get("created_utc")

        date_str = ""
        if created_utc:
            try:
                date_str = datetime.datetime.fromtimestamp(
                    created_utc, tz=datetime.timezone.utc
                ).strftime("%Y-%m-%d %H:%M UTC")
            except Exception:
                pass

        # Build Post Header
        lines: list[str] = [f"# {title}", ""]
        meta_items: list[str] = [
            f"**Subreddit:** r/{subreddit}",
            f"**Author:** u/{author}",
            f"**Score:** +{score}",
        ]
        if upvote_ratio is not None:
            meta_items.append(f"({int(upvote_ratio * 100)}% upvoted)")
        if date_str:
            meta_items.append(f"**Posted:** {date_str}")
        meta_items.append(f"[Thread Link]({full_permalink})")

        lines.append(" | ".join(meta_items))
        lines.append("")

        # Post body or external link
        if (
            external_url
            and external_url != full_permalink
            and not external_url.startswith(f"https://www.reddit.com{permalink}")
        ):
            lines.append(f"**Linked URL:** [{external_url}]({external_url})")
            lines.append("")

        if selftext:
            lines.append(selftext)
            lines.append("")

        # Comments
        comment_listing = data[1].get("data", {}).get("children", [])
        comment_lines = self._format_comments(comment_listing, current_depth=1)

        if comment_lines:
            lines.append("---")
            lines.append("## Comments Section")
            lines.append("")
            lines.extend(comment_lines)

        return "\n".join(lines).strip(), title, subreddit, author, score

    def _format_comments(
        self,
        comments: list[dict[str, Any]],
        current_depth: int,
    ) -> list[str]:
        """Format a list of comment nodes into markdown with indentations/quotes."""
        lines: list[str] = []

        for item in comments:
            kind = item.get("kind")
            data = item.get("data", {})

            if kind != "t1":
                continue

            author = data.get("author", "[deleted]")
            score = data.get("score", 0)
            body = (data.get("body") or "").strip()

            if not body or body in ("[deleted]", "[removed]"):
                continue

            if current_depth == 1:
                lines.append(f"### u/{author} (+{score})")
                lines.append(body)
                lines.append("")
            else:
                # Use markdown blockquote for nested replies
                prefix = "> " * (current_depth - 1)
                lines.append(f"{prefix}**u/{author}** (+{score}):")
                indented_body = "\n".join(
                    f"{prefix}{line}" if line else prefix.rstrip()
                    for line in body.splitlines()
                )
                lines.append(indented_body)
                lines.append("")

            # Handle replies
            if current_depth < self._max_depth:
                replies = data.get("replies")
                if isinstance(replies, dict):
                    child_comments = replies.get("data", {}).get("children", [])
                    if child_comments:
                        child_lines = self._format_comments(
                            child_comments, current_depth=current_depth + 1
                        )
                        lines.extend(child_lines)

        return lines
