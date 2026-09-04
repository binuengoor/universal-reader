import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI()

# Mount frontend static files if built
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # Don't intercept API routes
    if full_path.startswith("api"):
        return {"error": "Not found"}
    index_file = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Universal Reader API running. Build frontend with 'npm run build' to serve UI."}
