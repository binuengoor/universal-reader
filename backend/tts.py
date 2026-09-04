import os
import httpx
import hashlib
from typing import Optional, Dict, Any
from fastapi import HTTPException

DEFAULT_TTS_BASE_URL = os.environ.get("TTS_BASE_URL", "http://localhost:8000").rstrip("/")
DEFAULT_TTS_API_KEY = os.environ.get("TTS_API_KEY", "")

def compute_audio_hash(block_text: str, voice: str, model: str, speed: float) -> str:
    """Compute sha256 hash based on text, voice, model, and speed."""
    key_str = f"{block_text}_{voice}_{model}_{speed}"
    return hashlib.sha256(key_str.encode("utf-8")).hexdigest()

def get_audio_filename(block_id: int, voice: str, model: str, speed: float, block_text: str) -> str:
    """
    Format audio filename per SPEC.md: <block_id>_<voice>_<hash>.mp3.
    Hash is sha256(block_text + voice + model + speed).
    """
    audio_hash = compute_audio_hash(block_text, voice, model, speed)
    safe_voice = "".join(c for c in voice if c.isalnum() or c in ("-", "_")).lower() or "voice"
    return f"{block_id}_{safe_voice}_{audio_hash}.mp3"

class UniversalTTSClient:
    """Client for upstream OpenAI-compatible Universal TTS service."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: float = 60.0
    ):
        self.base_url = (base_url or DEFAULT_TTS_BASE_URL).rstrip("/")
        self.api_key = api_key if api_key is not None else DEFAULT_TTS_API_KEY
        self.timeout = timeout

    def _get_headers(self) -> Dict[str, str]:
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def list_models(self) -> Dict[str, Any]:
        """Fetch available models from Universal TTS /v1/models."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                url = f"{self.base_url}/v1/models"
                response = await client.get(url, headers=self._get_headers())
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                raise HTTPException(
                    status_code=e.response.status_code,
                    detail=f"TTS service returned error: {e.response.text}"
                )
            except httpx.RequestError as e:
                raise HTTPException(
                    status_code=502,
                    detail=f"Unable to connect to Universal TTS service at {self.base_url}: {str(e)}"
                )

    async def synthesize(
        self,
        text: str,
        voice: str,
        model: str = "tts-1",
        speed: float = 1.0,
        response_format: str = "mp3"
    ) -> bytes:
        """
        Synthesize speech from text via Universal TTS /v1/audio/speech.
        Returns raw audio bytes.
        """
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="Cannot synthesize empty text")

        payload = {
            "model": model,
            "input": text,
            "voice": voice,
            "speed": speed,
            "response_format": response_format
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                url = f"{self.base_url}/v1/audio/speech"
                response = await client.post(url, json=payload, headers=self._get_headers())
                response.raise_for_status()
                return response.content
            except httpx.HTTPStatusError as e:
                raise HTTPException(
                    status_code=e.response.status_code,
                    detail=f"Universal TTS synthesis failed: {e.response.text}"
                )
            except httpx.RequestError as e:
                raise HTTPException(
                    status_code=502,
                    detail=f"Unable to connect to Universal TTS service at {self.base_url}: {str(e)}"
                )

# Global client instance
tts_client = UniversalTTSClient()
