"""The page tutor: config, streaming, saved chats, the daily limit, and the OpenAI-compatible client."""
import json

import pytest

import chat
from app import create_app
from test_api import ADMIN, BASE_CONFIG, H, invite, signed_in

LLM_OFF = {"LLM_PROVIDER": "", "LLM_BASE_URL": "", "LLM_API_KEY": "", "LLM_MODEL": "", "LLM_MAX_TOKENS": "",
           "CHAT_DAILY_LIMIT": 50}
MEMBER = "friend@example.com"


def make_app(tmp_path, **llm):
    return create_app(tmp_path / "test.db", config={**BASE_CONFIG, **LLM_OFF, **llm})


def events(resp) -> list[tuple[str, dict]]:
    """Parse a text/event-stream body into (event, data) pairs."""
    out = []
    for block in resp.get_data(as_text=True).split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines() if ": " in line)
        if "event" in lines:
            out.append((lines["event"], json.loads(lines["data"])))
    return out


def answer(evs) -> str:
    return "".join(d["t"] for e, d in evs if e == "delta")


@pytest.fixture()
def fake(tmp_path):
    return make_app(tmp_path, LLM_PROVIDER="fake")


def member_of(app):
    admin = signed_in(app)
    invite(admin, MEMBER)
    return signed_in(app, MEMBER)


# ---------------------------------------------------------------- config and validation

def test_off_until_configured(tmp_path):
    c = signed_in(make_app(tmp_path))
    assert c.get("/api/chat/config").get_json()["enabled"] is False
    r = c.post("/api/chat", json={"question": "why?"}, headers=H)
    assert r.status_code == 503


def test_base_url_and_model_turn_it_on(tmp_path):
    c = signed_in(make_app(tmp_path, LLM_BASE_URL="http://localhost:11434/v1", LLM_MODEL="llama3"))
    cfg = c.get("/api/chat/config").get_json()
    assert cfg["enabled"] is True and cfg["model"] == "llama3"


def test_requires_sign_in_and_csrf_header(fake):
    assert fake.test_client().post("/api/chat", json={"question": "x"}, headers=H).status_code == 401
    assert signed_in(fake).post("/api/chat", json={"question": "x"}).status_code == 403


def test_rejects_empty_and_huge_questions(fake):
    c = signed_in(fake)
    assert c.post("/api/chat", json={"question": "  "}, headers=H).status_code == 400
    assert c.post("/api/chat", json={"question": "x" * 5000}, headers=H).status_code == 400


# ---------------------------------------------------------------- streaming and saved chats

def test_streams_an_answer_about_the_topic(fake):
    c = signed_in(fake)
    r = c.post("/api/chat", json={"question": "What is encapsulation?", "selection": "each layer wraps",
                                  "itemId": "net1"}, headers=H)
    assert r.mimetype == "text/event-stream"
    evs = events(r)
    assert evs[0][0] == "meta" and evs[0][1]["itemId"] == "net1"
    assert evs[-1][0] == "done" and evs[-1][1]["answerId"]
    assert "Network models" in answer(evs) and "What is encapsulation?" in answer(evs)

    tid = evs[0][1]["threadId"]
    t = c.get(f"/api/chat/threads/{tid}").get_json()
    assert t["item_id"] == "net1" and t["title"] == "What is encapsulation?"
    assert [m["role"] for m in t["messages"]] == ["user", "assistant"]
    assert t["messages"][0]["selection"] == "each layer wraps"
    assert [x["id"] for x in c.get("/api/chat/threads?item=net1").get_json()] == [tid]
    assert c.get("/api/chat/threads?item=net2").get_json() == []


def test_follow_up_continues_the_thread(fake):
    c = signed_in(fake)
    tid = events(c.post("/api/chat", json={"question": "first", "itemId": "net1"}, headers=H))[0][1]["threadId"]
    evs = events(c.post("/api/chat", json={"question": "second", "threadId": tid}, headers=H))
    assert evs[0][1]["threadId"] == tid and evs[0][1]["itemId"] == "net1"   # topic carried over from the thread
    assert "3 message(s)" in answer(evs)                                       # history was sent
    assert len(c.get(f"/api/chat/threads/{tid}").get_json()["messages"]) == 4


def test_bank_question_ids_resolve_to_their_topic(fake):
    c = signed_in(fake)
    evs = events(c.post("/api/chat", json={"question": "q", "itemId": "qa-net1-2"}, headers=H))
    assert evs[0][1]["itemId"] == "net1"


def test_unknown_item_still_answers_without_context(fake):
    c = signed_in(fake)
    evs = events(c.post("/api/chat", json={"question": "q", "itemId": "nope", "page": "Overview"}, headers=H))
    assert evs[0][1]["itemId"] == "" and evs[-1][0] == "done"


def test_chats_are_private(fake):
    owner = signed_in(fake)
    tid = events(owner.post("/api/chat", json={"question": "mine"}, headers=H))[0][1]["threadId"]
    other = member_of(fake)
    assert other.get(f"/api/chat/threads/{tid}").status_code == 404
    assert other.delete(f"/api/chat/threads/{tid}", headers=H).status_code == 404
    assert other.post("/api/chat", json={"question": "x", "threadId": tid}, headers=H).status_code == 404
    assert other.get("/api/chat/threads").get_json() == []


def test_delete_thread_and_export(fake):
    c = signed_in(fake)
    tid = events(c.post("/api/chat", json={"question": "keep me", "itemId": "net1"}, headers=H))[0][1]["threadId"]
    exported = c.get("/api/export").get_json()
    assert exported["chats"][0]["item"] == "net1" and len(exported["chats"][0]["messages"]) == 2
    assert c.delete(f"/api/chat/threads/{tid}", headers=H).status_code == 200
    assert c.get("/api/chat/threads").get_json() == []


# ---------------------------------------------------------------- the daily limit

def test_daily_limit_for_members_not_admins(tmp_path):
    app = make_app(tmp_path, LLM_PROVIDER="fake", CHAT_DAILY_LIMIT=2)
    m = member_of(app)
    for _ in range(2):
        assert events(m.post("/api/chat", json={"question": "q"}, headers=H))[-1][0] == "done"
    assert m.get("/api/chat/config").get_json() == {"enabled": True, "model": "", "limit": 2, "used": 2}
    r = m.post("/api/chat", json={"question": "q"}, headers=H)
    assert r.status_code == 429 and "2 tutor questions" in r.get_json()["error"]
    admin = signed_in(app, ADMIN)
    assert admin.get("/api/chat/config").get_json()["limit"] is None


def test_failed_requests_do_not_count(tmp_path, monkeypatch):
    app = make_app(tmp_path, LLM_PROVIDER="fake", CHAT_DAILY_LIMIT=1)
    m = member_of(app)

    def boom(cfg, messages):
        raise chat.ProviderError("The model server returned 401 (check LLM_API_KEY).")
        yield  # pragma: no cover

    monkeypatch.setattr(chat, "stream_answer", boom)
    evs = events(m.post("/api/chat", json={"question": "q"}, headers=H))
    assert evs[-1] == ("error", {"error": "The model server returned 401 (check LLM_API_KEY).", "answerId": None})
    assert m.get("/api/chat/config").get_json()["used"] == 0
    assert m.get("/api/chat/threads").get_json() == []


# ---------------------------------------------------------------- the OpenAI-compatible client

class FakeRaw:
    """The body arrives in uneven 7-byte reads, so lines span reads."""
    def __init__(self, data: bytes):
        self.pieces = [data[i:i + 7] for i in range(0, len(data), 7)]

    def read1(self, amt, decode_content=True):
        return self.pieces.pop(0) if self.pieces else b""


class FakeResponse:
    def __init__(self, status, lines=(), body=None):
        self.status_code, self.body = status, body
        self.raw = FakeRaw("\r\n".join(lines).encode())

    def json(self):
        if self.body is None:
            raise ValueError("no json")
        return self.body

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def chunk(text):
    return "data: " + json.dumps({"choices": [{"delta": {"content": text}}]})


def test_openai_stream_is_parsed(monkeypatch):
    sent = {}

    def post(url, headers, json, stream, timeout):
        sent.update(url=url, headers=headers, body=json)
        return FakeResponse(200, [": keep-alive", chunk("Hel"), "", chunk("lo — ü"),
                                  'data: {"choices":[{"delta":{"role":"assistant"}}]}', "data: [DONE]", chunk("ignored")])

    monkeypatch.setattr(chat.requests, "post", post)
    cfg = {"LLM_PROVIDER": "", "LLM_BASE_URL": "https://api.example.com/v1/", "LLM_API_KEY": "sk-test",
           "LLM_MODEL": "gpt-x", "LLM_MAX_TOKENS": "800"}
    out = "".join(chat.stream_answer(cfg, [{"role": "user", "content": "hi"}]))
    assert out == "Hello — ü"
    assert sent["url"] == "https://api.example.com/v1/chat/completions"
    assert sent["headers"]["Authorization"] == "Bearer sk-test"
    assert sent["body"] == {"model": "gpt-x", "messages": [{"role": "user", "content": "hi"}], "stream": True, "max_tokens": 800}


def test_openai_errors_are_readable_and_keyless(monkeypatch):
    monkeypatch.setattr(chat.requests, "post",
                        lambda *a, **k: FakeResponse(401, body={"error": {"message": "Incorrect API key provided"}}))
    cfg = {"LLM_BASE_URL": "https://api.example.com/v1", "LLM_API_KEY": "sk-secret", "LLM_MODEL": "m"}
    with pytest.raises(chat.ProviderError) as e:
        list(chat.stream_answer(cfg, []))
    assert "401" in str(e.value) and "LLM_API_KEY" in str(e.value) and "sk-secret" not in str(e.value)


def test_unreachable_server(monkeypatch):
    def post(*a, **k):
        raise chat.requests.ConnectionError("refused")
    monkeypatch.setattr(chat.requests, "post", post)
    with pytest.raises(chat.ProviderError, match="Could not reach"):
        list(chat.stream_answer({"LLM_BASE_URL": "http://localhost:1/v1", "LLM_MODEL": "m"}, []))


# ---------------------------------------------------------------- page text

def test_lesson_html_becomes_readable_text():
    text = chat.html_to_text("<h3>Layers</h3><p>Each  layer\nwraps.</p><ul><li>one</li><li>two</li></ul>"
                             "<pre>x = 1\n  y = 2</pre><svg><text>skip</text></svg>")
    assert text == "### Layers\n\nEach layer wraps.\n\n- one\n- two\n\n```\nx = 1\n  y = 2\n```"


def test_every_content_id_has_text(fake):
    from pathlib import Path
    idx = chat.ContentIndex(Path(fake.config["CONTENT_DIR"]))
    assert len(idx.items) > 500
    for i in ("net1", "hd1", "pat-hash", "q1"):
        assert idx.resolve(i) == i and len(idx.text(i)) > 20, i
