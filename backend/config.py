import os
import json
from typing import Dict, Any

CONFIG_FILE = os.environ.get(
    "CONFIG_FILE",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "config.json"))
)

def load_settings() -> Dict[str, Any]:
    """Load application settings from config.json with env fallback."""
    settings = {
        "tts_base_url": os.environ.get("TTS_BASE_URL", "https://kokoro.askbp.win").rstrip("/"),
        "tts_api_key": os.environ.get("TTS_API_KEY", ""),
        "default_model": os.environ.get("DEFAULT_MODEL", "edge-tts"),
        "default_voice": os.environ.get("DEFAULT_VOICE", "en-US-JennyNeural"),
        "scoped_voices": [],
        "scoped_voices_enabled": False,
        "llm_base_url": os.environ.get("LLM_BASE_URL", "").rstrip("/"),
        "llm_api_key": os.environ.get("LLM_API_KEY", ""),
        "llm_model": os.environ.get("LLM_MODEL", "gpt-4o-mini"),
        "llm_prompt": os.environ.get("LLM_PROMPT", ""),
        "llm_clean_enabled": False,
    }
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                for k, v in saved.items():
                    if v is not None:
                        settings[k] = v
        except Exception:
            pass
    # Populate compatible alias fields
    settings["tts_default_model"] = settings.get("tts_default_model") or settings.get("default_model", "edge-tts")
    settings["tts_default_voice"] = settings.get("tts_default_voice") or settings.get("default_voice", "en-US-ChristopherNeural")
    if not isinstance(settings.get("scoped_voices"), list):
        settings["scoped_voices"] = []
    settings["scoped_voices_enabled"] = bool(settings.get("scoped_voices_enabled", False))
    settings["llm_clean_enabled"] = bool(settings.get("llm_clean_enabled", False))
    return settings

def save_settings(new_settings: Dict[str, Any]) -> Dict[str, Any]:
    """Persist settings to config.json and update runtime environment."""
    current = load_settings()
    for k, v in new_settings.items():
        if v is not None:
            current[k] = v

    os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(current, f, indent=2)

    # Sync to os.environ for other modules
    if "tts_base_url" in current:
        os.environ["TTS_BASE_URL"] = current["tts_base_url"]
    if "tts_api_key" in current:
        os.environ["TTS_API_KEY"] = current["tts_api_key"]

    return current
