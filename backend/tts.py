import os
import httpx
import hashlib
from typing import Optional, Dict, Any, List
from fastapi import HTTPException
from .config import load_settings

def get_tts_base_url() -> str:
    return load_settings()["tts_base_url"].rstrip("/")

def get_tts_api_key() -> str:
    return load_settings()["tts_api_key"]

KOKORO_VOICE_MAP = {
    "alloy": "af_alloy",
    "echo": "am_echo",
    "fable": "bm_fable",
    "onyx": "am_onyx",
    "nova": "af_nova",
    "shimmer": "af_sky",
}

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

def _upstream_error_message(response: httpx.Response) -> str:
    """Pull the human-readable message out of an OpenAI- or FastAPI-style error body."""
    try:
        body = response.json()
    except ValueError:
        return response.text[:500]
    if isinstance(body, dict):
        err = body.get("error")
        if isinstance(err, dict) and err.get("message"):
            return str(err["message"])
        if isinstance(body.get("detail"), str):
            return body["detail"]
    return response.text[:500]


class SynthesizedAudio(bytes):
    """Audio bytes plus what the speech gateway reported about how they were made."""

    engine: Optional[str] = None
    voice: Optional[str] = None
    fallback: bool = False

    @classmethod
    def from_response(cls, response: httpx.Response) -> "SynthesizedAudio":
        audio = cls(response.content)
        audio.engine = response.headers.get("x-engine")
        audio.voice = response.headers.get("x-voice")
        audio.fallback = response.headers.get("x-fallback", "").lower() == "true"
        return audio


def is_tts_model_id(model_id: str) -> bool:
    """The gateway's /v1/models also lists speech-to-text models; hide those from TTS pickers."""
    m = (model_id or "").lower()
    return not any(k in m for k in ("whisper", "groq", "transcri", "stt"))


class UniversalTTSClient:
    """Client for upstream OpenAI-compatible Universal TTS service."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: float = 60.0
    ):
        self._custom_base_url = base_url.rstrip("/") if base_url else None
        self._custom_api_key = api_key
        self.timeout = timeout

    @property
    def base_url(self) -> str:
        return self._custom_base_url or get_tts_base_url()

    @property
    def api_key(self) -> str:
        return self._custom_api_key if self._custom_api_key is not None else get_tts_api_key()

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
                response = await client.get(url, params={"type": "tts"}, headers=self._get_headers())
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

    async def list_voices(self) -> Dict[str, Any]:
        """Fetch available voices from Universal TTS /v1/voices if available."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                url = f"{self.base_url}/v1/voices"
                response = await client.get(url, headers=self._get_headers())
                response.raise_for_status()
                return response.json()
            except Exception as e:
                raise HTTPException(
                    status_code=502,
                    detail=f"Unable to fetch voices from Universal TTS service at {self.base_url}: {str(e)}"
                )

    async def synthesize(
        self,
        text: str,
        voice: str,
        model: str = "tts-1",
        speed: float = 1.0,
        response_format: str = "mp3"
    ) -> SynthesizedAudio:
        """
        Synthesize speech from text via Universal TTS /v1/audio/speech.
        Returns audio bytes; `.fallback` is True when the gateway substituted another voice.
        """
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="Cannot synthesize empty text")

        # Automatically map OpenAI voices if using Kokoro engine
        target_voice = voice
        if model.lower() == "kokoro" and voice.lower() in KOKORO_VOICE_MAP:
            target_voice = KOKORO_VOICE_MAP[voice.lower()]

        payload = {
            "model": model,
            "input": text,
            "voice": target_voice,
            "speed": speed,
            "response_format": response_format
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                url = f"{self.base_url}/v1/audio/speech"
                response = await client.post(url, json=payload, headers=self._get_headers())
                response.raise_for_status()
                return SynthesizedAudio.from_response(response)
            except httpx.HTTPStatusError as e:
                status = e.response.status_code
                raise HTTPException(
                    # Upstream auth/server problems are a gateway failure from the browser's view.
                    status_code=status if 400 <= status < 500 and status not in (401, 403) else 502,
                    detail=f"Universal TTS synthesis failed: {_upstream_error_message(e.response)}"
                )
            except httpx.RequestError as e:
                raise HTTPException(
                    status_code=502,
                    detail=f"Unable to connect to Universal TTS service at {self.base_url}: {str(e)}"
                )

# Global client instance
tts_client = UniversalTTSClient()
