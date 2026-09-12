import pytest
from starlette.testclient import TestClient
from backend.main import app
from backend.config import load_settings, save_settings

@pytest.fixture
def client():
    return TestClient(app)

def test_inter_block_pause_setting(client):
    res = client.get("/api/settings")
    assert res.status_code == 200
    data = res.json()
    assert "inter_block_pause_ms" in data
    assert isinstance(data["inter_block_pause_ms"], int)

    # Update pause to 500ms
    update_res = client.post("/api/settings", json={"inter_block_pause_ms": 500})
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data.get("inter_block_pause_ms") == 500

    # Verify persisted
    res2 = client.get("/api/settings")
    assert res2.status_code == 200
    assert res2.json()["inter_block_pause_ms"] == 500


def test_speech_cleanup_strips_all_hashes_and_horizontal_rules():
    from backend.cleaner import clean_text_for_speech
    raw = '--- ### The Three Fatal Flaws of Classical PARA in a Modern Vault #### Flaw 1: The "Area vs. Resource" Cognitive Tax'
    cleaned = clean_text_for_speech(raw)
    assert "#" not in cleaned
    assert "---" not in cleaned
    assert "The Three Fatal Flaws of Classical PARA in a Modern Vault Flaw 1" in cleaned


def test_speech_cleanup_formats_code_blocks_and_tables():
    from backend.cleaner import clean_text_for_speech

    # Code block test
    code_raw = """Check this command:
```bash
docker compose up -d
```
All done."""
    code_cleaned = clean_text_for_speech(code_raw)
    assert "Command in bash: docker compose up -d" in code_cleaned
    assert "```" not in code_cleaned

    # Table test
    table_raw = """Here is the plan:
| Feature | Tier |
|:---|:---|
| Audio | Pro |
| Speed | Fast |
"""
    table_cleaned = clean_text_for_speech(table_raw)
    assert "Table details" in table_cleaned
    assert "For Audio: Tier is Pro" in table_cleaned
    assert "For Speed: Tier is Fast" in table_cleaned
    assert "|" not in table_cleaned


