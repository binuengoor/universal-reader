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
