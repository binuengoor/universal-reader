import pytest
from backend.cleaner import clean_text_for_speech, llm_clean_text
from backend.chunking import chunk_text
from backend.config import load_settings, save_settings
from backend.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_clean_text_for_speech():
    raw = (
        "# Heading 1\n\n"
        "Check out [Google](https://google.com) and this link: https://example.com/test?a=1 🚀✨\n\n"
        "Here is a table:\n"
        "| Name | Age |\n"
        "|---|---|\n"
        "| Alice | 30 |\n\n"
        "> A wise quote [1] from author [citation needed].\n\n"
        "Some **bold** and *italic* and `inline_code()` content."
    )
    cleaned = clean_text_for_speech(raw)
    
    # Assert emojis are removed
    assert "🚀" not in cleaned
    assert "✨" not in cleaned
    # Assert links converted to anchor text
    assert "Google" in cleaned
    assert "https://google.com" not in cleaned
    assert "https://example.com" not in cleaned
    # Assert citation brackets stripped
    assert "[1]" not in cleaned
    assert "[citation needed]" not in cleaned
    # Assert markdown syntax markers stripped
    assert "#" not in cleaned
    assert ">" not in cleaned
    assert "**" not in cleaned
    assert "|" not in cleaned
    assert "Alice" in cleaned
    assert "inline_code()" in cleaned

def test_chunk_text_includes_speech_text():
    sample = "This is a **bold** paragraph with emojis 🎉 and links [Click here](http://test.com). It has enough characters to form a valid block in our chunking system."
    chunks = chunk_text(sample, min_chars=10, max_chars=300)
    assert len(chunks) > 0
    first = chunks[0]
    assert "text" in first
    assert "speech_text" in first
    # Raw visual text preserves markdown
    assert "**bold**" in first["text"]
    assert "[Click here]" in first["text"]
    # Cleaned speech_text strips markdown and emojis
    assert "**" not in first["speech_text"]
    assert "🎉" not in first["speech_text"]
    assert "Click here" in first["speech_text"]
    assert "http://test.com" not in first["speech_text"]

def test_scoped_voices_and_llm_settings():
    updated = save_settings({
        "scoped_voices": ["en-US-ChristopherNeural", "kokoro:af_heart"],
        "scoped_voices_enabled": True,
        "llm_base_url": "https://api.test.com/v1",
        "llm_model": "test-gpt",
        "llm_clean_enabled": True
    })
    
    assert updated["scoped_voices"] == ["en-US-ChristopherNeural", "kokoro:af_heart"]
    assert updated["scoped_voices_enabled"] is True
    assert updated["llm_base_url"] == "https://api.test.com/v1"
    assert updated["llm_clean_enabled"] is True

    # Test via FastAPI endpoints
    res = client.get("/api/settings")
    assert res.status_code == 200
    data = res.json()
    assert "scoped_voices" in data
    assert "scoped_voices_enabled" in data
    assert "llm_clean_enabled" in data

    # Test updating via POST /api/settings
    res2 = client.post("/api/settings", json={
        "scoped_voices_enabled": False
    })
    assert res2.status_code == 200
    assert res2.json()["scoped_voices_enabled"] is False
