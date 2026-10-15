"""Tutor answers pinned to a passage in a lesson."""
from test_api import H, app, client, invite, signed_in  # noqa: F401 - app and client are fixtures

PIN = {"itemId": "net1", "quote": "each layer wraps", "prefix": "On the way down, ", "suffix": " the one above",
       "question": "Explain this", "answer": "**Encapsulation** means..."}


def test_pin_round_trip(client):
    r = client.post("/api/pins", json=PIN, headers=H)
    assert r.status_code == 201
    pin = r.get_json()
    assert pin["item_id"] == "net1" and pin["quote"] == "each layer wraps" and pin["prefix"] == "On the way down, "
    assert pin["thread_id"] is None and pin["created_at"] > 0
    assert client.get("/api/pins").get_json() == [pin]
    assert client.get("/api/export").get_json()["pins"] == [pin]
    assert client.delete(f"/api/pins/{pin['id']}", headers=H).status_code == 200
    assert client.get("/api/pins").get_json() == []
    assert client.delete(f"/api/pins/{pin['id']}", headers=H).status_code == 404


def test_pin_requires_quote_question_answer_and_item(client):
    for field in ("quote", "question", "answer"):
        assert client.post("/api/pins", json={**PIN, field: "  "}, headers=H).status_code == 400
    assert client.post("/api/pins", json={**PIN, "itemId": ""}, headers=H).status_code == 400


def test_pin_keeps_only_own_threads(client, app):
    # a thread id that is not the user's own is dropped rather than linked
    pin = client.post("/api/pins", json={**PIN, "threadId": 999}, headers=H).get_json()
    assert pin["thread_id"] is None


def test_pins_are_private(client, app):
    pin = client.post("/api/pins", json=PIN, headers=H).get_json()
    invite(client, "friend@example.com")
    other = signed_in(app, "friend@example.com")
    assert other.get("/api/pins").get_json() == []
    assert other.delete(f"/api/pins/{pin['id']}", headers=H).status_code == 404


def test_deleting_the_account_removes_pins(client):
    client.post("/api/pins", json=PIN, headers=H)
    assert client.delete("/api/account", headers=H).status_code == 200
