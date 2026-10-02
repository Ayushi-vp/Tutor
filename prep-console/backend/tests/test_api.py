import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import create_app  # noqa: E402

ADMIN = "owner@example.com"
H = {"X-Prep-Client": "1"}
BASE_CONFIG = {
    "TESTING": True, "SECRET_KEY": "test", "DEV_LOGIN": True, "ADMIN_EMAILS": {ADMIN},
    "BASE_URL": "", "BEHIND_PROXY": False, "SESSION_COOKIE_SECURE": False,
    "GOOGLE_CLIENT_ID": "", "GOOGLE_CLIENT_SECRET": "", "GITHUB_CLIENT_ID": "", "GITHUB_CLIENT_SECRET": "",
}


@pytest.fixture()
def app(tmp_path):
    return create_app(tmp_path / "test.db", config=dict(BASE_CONFIG))


def signed_in(app, email=ADMIN):
    c = app.test_client()
    r = c.post("/auth/dev-login", json={"email": email}, headers=H)
    assert r.status_code == 200, r.get_json()
    return c


@pytest.fixture()
def client(app):
    return signed_in(app)


def invite(admin_client, email):
    assert admin_client.post("/api/admin/invites", json={"email": email}, headers=H).status_code == 200


# ---------------------------------------------------------------- progress (per user)

def test_empty_state(client):
    s = client.get("/api/state").get_json()
    assert s == {"items": {}, "days": {}, "srs": {}, "notes": {}, "logs": []}


def test_done_counts_toward_today_once(client):
    client.put("/api/items/ml1", json={"status": "done"}, headers=H)
    s = client.put("/api/items/ml1", json={"status": "done"}, headers=H).get_json()
    assert s["items"] == {"ml1": "done"}
    assert sum(s["days"].values()) == 1


def test_clear_and_review(client):
    client.put("/api/items/q1", json={"status": "rev"}, headers=H)
    assert client.get("/api/state").get_json()["items"] == {"q1": "rev"}
    client.put("/api/items/q1", json={"status": None}, headers=H)
    assert client.get("/api/state").get_json()["items"] == {}


def test_rejects_bad_status(client):
    assert client.put("/api/items/q1", json={"status": "maybe"}, headers=H).status_code == 400


def test_srs_notes_and_mocks(client):
    client.put("/api/srs/b1", json={"box": 3, "due": "2026-10-01"}, headers=H)
    client.put("/api/notes/ts1", json={"text": "  revisit covariates  "}, headers=H)
    s = client.post("/api/mocks", json={"round": "DSA screen", "used": 44, "notes": "ok"}, headers=H).get_json()
    assert s["srs"]["b1"] == {"box": 3, "due": "2026-10-01"}
    assert s["notes"]["ts1"] == "revisit covariates"
    assert s["logs"][0]["round"] == "DSA screen" and s["logs"][0]["used"] == 44


def test_import_is_idempotent(client):
    old = {"items": {"ml1": "done", "q3": "rev"}, "days": {"2026-09-20": 4},
           "srs": {"b2": {"box": 2, "due": "2026-09-25"}}, "notes": {},
           "logs": [{"round": "LLM & GenAI", "at": 1790000000000, "used": 40, "notes": ""}], "v": 1}
    client.post("/api/import", json=old, headers=H)
    s = client.post("/api/import", json=old, headers=H).get_json()["state"]
    assert s["items"] == {"ml1": "done", "q3": "rev"}
    assert s["days"] == {"2026-09-20": 4}
    assert len(s["logs"]) == 1


def test_progress_is_isolated_between_users(app, client):
    invite(client, "friend@example.com")
    friend = signed_in(app, "friend@example.com")
    client.put("/api/items/ml1", json={"status": "done"}, headers=H)
    friend.put("/api/items/dl1", json={"status": "rev"}, headers=H)
    assert client.get("/api/state").get_json()["items"] == {"ml1": "done"}
    assert friend.get("/api/state").get_json()["items"] == {"dl1": "rev"}


def test_limits(client):
    assert client.put("/api/notes/x", json={"text": "a" * 20_001}, headers=H).status_code == 400
    assert client.put("/api/items/" + "x" * 201, json={"status": "done"}, headers=H).status_code == 400


def test_reset_progress_keeps_account(client):
    client.put("/api/items/ml1", json={"status": "done"}, headers=H)
    s = client.delete("/api/progress", headers=H).get_json()
    assert s["items"] == {} and s["days"] == {}
    assert client.get("/api/me").status_code == 200


# ---------------------------------------------------------------- sign-in and access

def test_signed_out_gets_401(app):
    c = app.test_client()
    assert c.get("/api/state").status_code == 401
    assert c.get("/api/me").status_code == 401
    assert c.put("/api/items/ml1", json={"status": "done"}, headers=H).status_code == 401
    assert c.get("/api/health").status_code == 200
    assert c.get("/api/auth/config").get_json() == {"providers": [], "devLogin": True}


def test_me_and_logout(client):
    me = client.get("/api/me").get_json()
    assert me["email"] == ADMIN and me["admin"] is True
    client.post("/auth/logout", headers=H)
    assert client.get("/api/me").status_code == 401


def test_writes_need_the_csrf_header(client):
    r = client.put("/api/items/ml1", json={"status": "done"})
    assert r.status_code == 403
    assert client.get("/api/state").get_json()["items"] == {}


def test_only_invited_emails_can_sign_in(app, client):
    stranger = app.test_client()
    r = stranger.post("/auth/dev-login", json={"email": "stranger@example.com"}, headers=H)
    assert r.status_code == 403 and r.get_json()["error"] == "not-invited"
    invite(client, "Stranger@Example.com")
    signed_in(app, "stranger@example.com")
    invites = client.get("/api/admin/invites").get_json()
    assert invites[0]["email"] == "stranger@example.com" and invites[0]["used_at"] is not None


def test_dev_login_off_by_default(tmp_path):
    app = create_app(tmp_path / "t.db", config={**BASE_CONFIG, "DEV_LOGIN": False})
    assert app.test_client().post("/auth/dev-login", json={"email": ADMIN}, headers=H).status_code == 404


def test_dev_login_refuses_proxied_requests(app):
    r = app.test_client().post("/auth/dev-login", json={"email": ADMIN},
                               headers={**H, "X-Forwarded-For": "203.0.113.9"})
    assert r.status_code == 404


def test_missing_secret_key_refuses_to_start(tmp_path):
    with pytest.raises(RuntimeError):
        create_app(tmp_path / "t.db", config={**BASE_CONFIG, "SECRET_KEY": "", "DEV_LOGIN": False, "TESTING": False})


# ---------------------------------------------------------------- admin

def test_members_cannot_use_admin_routes(app, client):
    invite(client, "member@example.com")
    member = signed_in(app, "member@example.com")
    assert member.get("/api/me").get_json()["admin"] is False
    assert member.get("/api/admin/users").status_code == 403
    assert member.post("/api/admin/invites", json={"email": "x@example.com"}, headers=H).status_code == 403


def test_admin_invite_validation_and_delete(client):
    assert client.post("/api/admin/invites", json={"email": "not-an-email"}, headers=H).status_code == 400
    invite(client, "a@example.com")
    assert [i["email"] for i in client.get("/api/admin/invites").get_json()] == ["a@example.com"]
    assert client.delete("/api/admin/invites/a@example.com", headers=H).get_json() == []
    assert client.delete("/api/admin/invites/a@example.com", headers=H).status_code == 404


def test_disabling_a_user_signs_them_out(app, client):
    invite(client, "m@example.com")
    member = signed_in(app, "m@example.com")
    users = {u["email"]: u for u in client.get("/api/admin/users").get_json()}
    mid = users["m@example.com"]["id"]
    assert client.put(f"/api/admin/users/{mid}", json={"disabled": True}, headers=H).status_code == 200
    assert member.get("/api/state").status_code == 401
    r = app.test_client().post("/auth/dev-login", json={"email": "m@example.com"}, headers=H)
    assert r.status_code == 403 and r.get_json()["error"] == "disabled"
    me = client.get("/api/me").get_json()["id"]
    assert client.put(f"/api/admin/users/{me}", json={"disabled": True}, headers=H).status_code == 400


def test_delete_account_removes_progress(app, client):
    invite(client, "leaver@example.com")
    leaver = signed_in(app, "leaver@example.com")
    leaver.put("/api/items/ml1", json={"status": "done"}, headers=H)
    assert leaver.delete("/api/account", headers=H).status_code == 200
    assert leaver.get("/api/state").status_code == 401
    emails = [u["email"] for u in client.get("/api/admin/users").get_json()]
    assert "leaver@example.com" not in emails
    # The invite was used, so signing in again is still allowed and starts from nothing.
    again = signed_in(app, "leaver@example.com")
    assert again.get("/api/state").get_json()["items"] == {}


# ---------------------------------------------------------------- OAuth callbacks (provider faked)

class FakeResp:
    def __init__(self, data):
        self.data = data

    def json(self):
        return self.data


class FakeClient:
    def __init__(self, token, api=None):
        self.token, self.api = token, api or {}

    def authorize_access_token(self):
        return self.token

    def get(self, path, token=None):
        return FakeResp(self.api[path])


@pytest.fixture()
def oauth_app(tmp_path):
    cfg = {**BASE_CONFIG, "DEV_LOGIN": False, "GOOGLE_CLIENT_ID": "g", "GOOGLE_CLIENT_SECRET": "gs",
           "GITHUB_CLIENT_ID": "h", "GITHUB_CLIENT_SECRET": "hs"}
    return create_app(tmp_path / "o.db", config=cfg)


def test_google_callback_signs_in_admin(oauth_app, monkeypatch):
    import auth
    fake = FakeClient({"userinfo": {"email": ADMIN, "email_verified": True, "name": "Owner", "picture": "p"}})
    monkeypatch.setattr(auth.oauth, "create_client", lambda name: fake)
    c = oauth_app.test_client()
    assert c.get("/api/auth/config").get_json()["providers"] == ["google", "github"]
    r = c.get("/auth/callback/google")
    assert r.status_code == 302 and r.headers["Location"] == "/"
    assert c.get("/api/me").get_json()["name"] == "Owner"


def test_google_rejects_unverified_email(oauth_app, monkeypatch):
    import auth
    fake = FakeClient({"userinfo": {"email": ADMIN, "email_verified": False}})
    monkeypatch.setattr(auth.oauth, "create_client", lambda name: fake)
    c = oauth_app.test_client()
    assert c.get("/auth/callback/google").headers["Location"] == "/?auth=unverified"
    assert c.get("/api/me").status_code == 401


def test_github_uses_primary_verified_email(oauth_app, monkeypatch):
    import auth
    fake = FakeClient({}, {"user": {"login": "octo", "name": None, "avatar_url": "a"},
                           "user/emails": [{"email": "other@x.com", "primary": False, "verified": True},
                                           {"email": ADMIN, "primary": True, "verified": True}]})
    monkeypatch.setattr(auth.oauth, "create_client", lambda name: fake)
    c = oauth_app.test_client()
    assert c.get("/auth/callback/github").headers["Location"] == "/"
    me = c.get("/api/me").get_json()
    assert me["email"] == ADMIN and me["name"] == "octo" and me["provider"] == "github"


def test_oauth_rejects_uninvited(oauth_app, monkeypatch):
    import auth
    fake = FakeClient({"userinfo": {"email": "nobody@example.com", "email_verified": True}})
    monkeypatch.setattr(auth.oauth, "create_client", lambda name: fake)
    c = oauth_app.test_client()
    assert c.get("/auth/callback/google").headers["Location"] == "/?auth=not-invited"


def test_unknown_provider_is_404(app):
    assert app.test_client().get("/auth/login/google").status_code == 404


# ---------------------------------------------------------------- migration from the single-user schema

def test_first_admin_claims_pre_accounts_progress(tmp_path):
    path = tmp_path / "old.db"
    c = sqlite3.connect(path)
    c.executescript("""
        CREATE TABLE items (id TEXT PRIMARY KEY, status TEXT NOT NULL, updated_at REAL NOT NULL);
        CREATE TABLE days (day TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE srs (id TEXT PRIMARY KEY, box INTEGER NOT NULL, due TEXT NOT NULL);
        CREATE TABLE notes (id TEXT PRIMARY KEY, text TEXT NOT NULL);
        CREATE TABLE mock_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, round TEXT NOT NULL, at REAL NOT NULL,
                                used INTEGER NOT NULL, notes TEXT NOT NULL DEFAULT '');
        INSERT INTO items VALUES ('ml1', 'done', 1.0), ('q2', 'rev', 2.0);
        INSERT INTO days VALUES ('2026-09-20', 3);
        INSERT INTO srs VALUES ('b1', 2, '2026-09-30');
        INSERT INTO notes VALUES ('ts1', 'old note');
        INSERT INTO mock_logs (round, at, used, notes) VALUES ('DSA screen', 1790000000000, 40, '');
    """)
    c.commit()
    c.close()

    app = create_app(path, config=dict(BASE_CONFIG))
    invite_app = signed_in(app)          # the admin signs in and takes the old progress
    s = invite_app.get("/api/state").get_json()
    assert s["items"] == {"ml1": "done", "q2": "rev"}
    assert s["days"] == {"2026-09-20": 3}
    assert s["srs"] == {"b1": {"box": 2, "due": "2026-09-30"}}
    assert s["notes"] == {"ts1": "old note"}
    assert len(s["logs"]) == 1

    # Restarting does not migrate twice, and a second user starts empty.
    app2 = create_app(path, config=dict(BASE_CONFIG))
    admin2 = signed_in(app2)
    assert admin2.get("/api/state").get_json()["items"] == {"ml1": "done", "q2": "rev"}
    invite(admin2, "new@example.com")
    assert signed_in(app2, "new@example.com").get("/api/state").get_json()["items"] == {}
