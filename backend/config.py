import os
import json
from typing import Dict, Any

# Prefer persistent /data volume if present, otherwise local data directory
DEFAULT_CONFIG_PATH = "/data/config.json" if os.path.isdir("/data") else os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "config.json"))
CONFIG_FILE = os.environ.get("CONFIG_FILE", DEFAULT_CONFIG_PATH)

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
        "glossary": [],
        "inter_block_pause_ms": int(os.environ.get("INTER_BLOCK_PAUSE_MS", 300)),
        "reddit_session_cookie": os.environ.get("REDDIT_SESSION_COOKIE", ""),
        "reddit_credential_path": os.environ.get("REDDIT_CREDENTIAL_PATH", ""),
        "reddit_comment_limit": int(os.environ.get("REDDIT_COMMENT_LIMIT", 50)),
        "reddit_comment_depth": int(os.environ.get("REDDIT_COMMENT_DEPTH", 3)),
        "reddit_timeout": float(os.environ.get("REDDIT_TIMEOUT", 15.0)),
    }
    # If CONFIG_FILE does not exist, check if legacy local path exists and copy over
    if not os.path.exists(CONFIG_FILE):
        legacy_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "config.json"))
        if legacy_path != CONFIG_FILE and os.path.exists(legacy_path):
            try:
                with open(legacy_path, "r", encoding="utf-8") as f:
                    saved = json.load(f)
                os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
                with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                    json.dump(saved, f, indent=2)
            except Exception:
                pass

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
    try:
        settings["inter_block_pause_ms"] = int(settings.get("inter_block_pause_ms", 300))
    except (ValueError, TypeError):
        settings["inter_block_pause_ms"] = 300
    try:
        settings["reddit_comment_limit"] = int(settings.get("reddit_comment_limit", 50))
    except (ValueError, TypeError):
        settings["reddit_comment_limit"] = 50
    try:
        settings["reddit_comment_depth"] = int(settings.get("reddit_comment_depth", 3))
    except (ValueError, TypeError):
        settings["reddit_comment_depth"] = 3
    try:
        settings["reddit_timeout"] = float(settings.get("reddit_timeout", 15.0))
    except (ValueError, TypeError):
        settings["reddit_timeout"] = 15.0
    if not isinstance(settings.get("scoped_voices"), list):
        settings["scoped_voices"] = []
    settings["scoped_voices_enabled"] = bool(settings.get("scoped_voices_enabled", False))
    settings["llm_clean_enabled"] = bool(settings.get("llm_clean_enabled", False))
    if not isinstance(settings.get("glossary"), list):
        settings["glossary"] = []
    else:
        # Sanitize glossary items
        sanitized_glossary = []
        for item in settings["glossary"]:
            if isinstance(item, dict) and "find" in item and "replace" in item:
                find_str = str(item["find"]).strip()
                if find_str:
                    sanitized_glossary.append({
                        "find": find_str,
                        "replace": str(item["replace"]).strip()
                    })
        settings["glossary"] = sanitized_glossary
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
