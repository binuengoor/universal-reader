import base64
import hmac
import logging
import os
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, Response
from .routes import router as documents_router, models_router, voices_router, settings_router, tags_router, jobs_router

log = logging.getLogger(__name__)

app = FastAPI(title="Universal Reader API")

# The UI is served from this same origin, so cross-origin access is only needed for
# a separately hosted dev server. Comma-separated list, e.g. "http://localhost:5173".
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
if CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Optional HTTP Basic auth for the whole app (UI, API and audio). Browsers handle the
# prompt natively and resend credentials for <audio> elements and the service worker.
AUTH_USER = os.environ.get("READER_USERNAME", "reader")
AUTH_PASSWORD = os.environ.get("READER_PASSWORD", "")
_AUTH_EXEMPT = ("/api/health",)


def _basic_auth_ok(header: str) -> bool:
    scheme, _, encoded = header.partition(" ")
    if scheme.lower() != "basic" or not encoded:
        return False
    try:
        user, _, password = base64.b64decode(encoded).decode("utf-8").partition(":")
    except Exception:
        return False
    return hmac.compare_digest(user.encode(), AUTH_USER.encode()) and hmac.compare_digest(
        password.encode(), AUTH_PASSWORD.encode()
    )


def _same_origin(request: Request, origin: str) -> bool:
    if origin in CORS_ORIGINS:
        return True
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    return urlsplit(origin).netloc.lower() == host.split(",")[0].strip().lower()


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    if AUTH_PASSWORD and request.url.path not in _AUTH_EXEMPT:
        if not _basic_auth_ok(request.headers.get("authorization", "")):
            return Response(
                status_code=401,
                content="Authentication required",
                headers={"WWW-Authenticate": 'Basic realm="Universal Reader", charset="UTF-8"'},
            )

    # Block cross-site writes (CSRF): a page on another site must not be able to
    # delete documents or change settings through the user's browser.
    if request.method not in ("GET", "HEAD", "OPTIONS") and _is_cross_site(request):
        return JSONResponse(status_code=403, content={"detail": "Cross-origin request blocked"})

    return await call_next(request)


def _is_cross_site(request: Request) -> bool:
    origin = request.headers.get("origin")
    if origin and origin in CORS_ORIGINS:
        return False
    # Browsers set Sec-Fetch-Site themselves; it survives reverse proxies that rewrite Host.
    fetch_site = request.headers.get("sec-fetch-site")
    if fetch_site:
        return fetch_site == "cross-site"
    if not origin:
        return False  # Non-browser clients (curl, scripts) send no Origin
    return origin == "null" or not _same_origin(request, origin)


if not AUTH_PASSWORD:
    log.warning(
        "READER_PASSWORD is not set: anyone who can reach this port can read and delete "
        "your library. Set it unless the app is only reachable through an authenticating proxy."
    )


app.include_router(documents_router)
app.include_router(models_router)
app.include_router(voices_router)
app.include_router(settings_router)
app.include_router(tags_router)
app.include_router(jobs_router)

# Mount frontend static files if built
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
frontend_dist_real = os.path.realpath(frontend_dist)
if os.path.exists(os.path.join(frontend_dist, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

@app.api_route("/api/health", methods=["GET", "HEAD"])
async def health_check():
    return {"status": "ok"}

@app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
async def serve_spa(full_path: str):
    # Unknown API routes are real 404s, not the SPA shell
    if full_path == "api" or full_path.startswith("api/"):
        return JSONResponse(status_code=404, content={"detail": "Not found"})

    # Serve top-level static files from frontend_dist (e.g. manifest.json, sw.js, favicon.svg),
    # never anything outside it.
    if full_path:
        candidate = os.path.realpath(os.path.join(frontend_dist_real, full_path))
        if candidate.startswith(frontend_dist_real + os.sep) and os.path.isfile(candidate):
            headers = {}
            if full_path in ("sw.js", "manifest.json", "index.html"):
                headers = {"Cache-Control": "no-cache, no-store, must-revalidate"}
            return FileResponse(candidate, headers=headers)

    index_file = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    return {"message": "Universal Reader API running. Build frontend with 'npm run build' to serve UI."}
