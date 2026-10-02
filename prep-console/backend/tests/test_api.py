import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import create_app  # noqa: E402


@pytest.fixture()
def client(tmp_path):
    return create_app(tmp_path / "test.db").test_client()


def test_empty_state(client):
    s = client.get("/api/state").get_json()
    assert s == {"items": {}, "days": {}, "srs": {}, "notes": {}, "logs": []}


def test_done_counts_toward_today_once(client):
    client.put("/api/items/ml1", json={"status": "done"})
    s = client.put("/api/items/ml1", json={"status": "done"}).get_json()
    assert s["items"] == {"ml1": "done"}
    assert sum(s["days"].values()) == 1


def test_clear_and_review(client):
    client.put("/api/items/q1", json={"status": "rev"})
    assert client.get("/api/state").get_json()["items"] == {"q1": "rev"}
    client.put("/api/items/q1", json={"status": None})
    assert client.get("/api/state").get_json()["items"] == {}


def test_rejects_bad_status(client):
    assert client.put("/api/items/q1", json={"status": "maybe"}).status_code == 400


def test_srs_notes_and_mocks(client):
    client.put("/api/srs/b1", json={"box": 3, "due": "2026-10-01"})
    client.put("/api/notes/ts1", json={"text": "  revisit covariates  "})
    s = client.post("/api/mocks", json={"round": "DSA screen", "used": 44, "notes": "ok"}).get_json()
    assert s["srs"]["b1"] == {"box": 3, "due": "2026-10-01"}
    assert s["notes"]["ts1"] == "revisit covariates"
    assert s["logs"][0]["round"] == "DSA screen" and s["logs"][0]["used"] == 44


def test_import_is_idempotent(client):
    old = {"items": {"ml1": "done", "q3": "rev"}, "days": {"2026-09-20": 4},
           "srs": {"b2": {"box": 2, "due": "2026-09-25"}}, "notes": {},
           "logs": [{"round": "LLM & GenAI", "at": 1790000000000, "used": 40, "notes": ""}], "v": 1}
    client.post("/api/import", json=old)
    s = client.post("/api/import", json=old).get_json()["state"]
    assert s["items"] == {"ml1": "done", "q3": "rev"}
    assert s["days"] == {"2026-09-20": 4}
    assert len(s["logs"]) == 1
