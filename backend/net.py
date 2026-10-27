"""Outbound HTTP for user-supplied URLs, guarded against SSRF."""
import asyncio
import ipaddress
import os
import socket
from typing import Optional, Tuple
from urllib.parse import urljoin, urlsplit

import httpx

MAX_FETCH_BYTES = int(os.environ.get("MAX_FETCH_MB", "15")) * 1024 * 1024
FETCH_TIMEOUT = float(os.environ.get("FETCH_TIMEOUT", "20"))
MAX_REDIRECTS = 5

_FETCH_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


class UnsafeUrlError(ValueError):
    """The URL is malformed or points at a host the server must not reach."""


def private_urls_allowed() -> bool:
    # Opt-in for people who want to import pages from their own LAN (wikis, NAS, ...).
    return os.environ.get("ALLOW_PRIVATE_URLS", "").lower() in ("1", "true", "yes")


def _is_public_ip(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped:
        addr = addr.ipv4_mapped
    return addr.is_global and not addr.is_multicast


async def validate_public_url(url: str) -> str:
    """Raise UnsafeUrlError unless `url` is http(s) and every resolved address is public."""
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https"):
        raise UnsafeUrlError("Only http(s) URLs can be imported")
    host = parts.hostname
    if not host:
        raise UnsafeUrlError("URL has no host")
    if private_urls_allowed():
        return url

    port = parts.port or (443 if parts.scheme == "https" else 80)
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise UnsafeUrlError(f"Could not resolve host '{host}'") from exc
    for info in infos:
        if not _is_public_ip(info[4][0]):
            raise UnsafeUrlError(
                f"Refusing to fetch '{host}': it resolves to a private or local address "
                "(set ALLOW_PRIVATE_URLS=1 to allow LAN imports)"
            )
    return url


async def fetch_url_safely(url: str, client: Optional[httpx.AsyncClient] = None) -> Tuple[str, str]:
    """
    Fetch a user-supplied URL, validating the target before the first request and
    after every redirect, with a size cap. Returns (final_url, body_text).
    """
    own_client = client is None
    client = client or httpx.AsyncClient(timeout=FETCH_TIMEOUT, follow_redirects=False)
    try:
        current = url
        for _ in range(MAX_REDIRECTS + 1):
            await validate_public_url(current)
            async with client.stream("GET", current, headers=_FETCH_HEADERS) as resp:
                if resp.is_redirect and resp.headers.get("location"):
                    current = urljoin(current, resp.headers["location"])
                    continue
                if resp.status_code >= 400:
                    raise httpx.HTTPStatusError(
                        f"HTTP {resp.status_code}", request=resp.request, response=resp
                    )
                body = bytearray()
                async for chunk in resp.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > MAX_FETCH_BYTES:
                        raise UnsafeUrlError("Page is too large to import")
                encoding = resp.encoding or "utf-8"
                return current, bytes(body).decode(encoding, errors="replace")
        raise UnsafeUrlError("Too many redirects")
    finally:
        if own_client:
            await client.aclose()
