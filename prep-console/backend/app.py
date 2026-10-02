"""Prep Console API.

Stores each signed-in user's study progress in SQLite and, once the frontend has
been built, serves it too — so `python backend/app.py` is the whole app.

    GET    /api/health                  liveness, public
    GET    /api/auth/config             sign-in providers on offer, public
    GET    /api/me                      the signed-in user (401 when signed out)
    GET    /api/state                   everything the UI needs to render progress
    PUT    /api/items/<id>              {"status": "done" | "rev" | null}
    PUT    /api/srs/<id>                {"box": 0..5, "due": "YYYY-MM-DD"}
    PUT    /api/notes/<id>              {"text": "..."}
    POST   /api/mocks                   {"round", "used", "notes"}
    GET    /api/export                  the user's state as a JSON download
    POST   /api/import                  a previously exported (or old console) state
    DELETE /api/progress                wipe the user's progress, keep the account
    DELETE /api/account                 delete the user and all their progress
    GET    /api/admin/users             admins: everyone who has signed in
    PUT    /api/admin/users/<id>        admins: {"disabled": bool}
    GET    /api/admin/invites           admins: the invite list
    POST   /api/admin/invites           admins: {"email"}
    DELETE /api/admin/invites/<email>   admins

    GET  /auth/login/<google|github>    start OAuth; /auth/callback/<provider> finishes it
    POST /auth/dev-login                {"email"} — only with DEV_LOGIN=1, only from localhost
    POST /auth/logout

Every non-GET request must carry the header `X-Prep-Client: 1`. Browsers will not
send a custom header cross-site without a CORS preflight (which this app never
grants), so this blocks cross-site request forgery alongside the SameSite cookie.
"""
from __future__ import annotations

import os
import re
import secrets
from contextlib import contextmanager
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, abort, g, jsonify, request, send_from_directory, session
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

import auth
import db

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "frontend" / "dist"
STATUSES = {"done", "rev"}
MAX_ID = 200
MAX_NOTE = 20_000
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
CSRF_HEADER = "X-Prep-Client"


def _env_flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def load_config() -> dict:
    """Settings from the environment, with prep-console/.env filling in anything unset."""
    load_dotenv(ROOT / ".env")
    base = os.environ.get("BASE_URL", "").strip()
    return {
        "DB_PATH": os.environ.get("PREP_DB") or str(ROOT / "backend" / "prep.db"),
        "SECRET_KEY": os.environ.get("SECRET_KEY", ""),
        "BASE_URL": base,
        "ADMIN_EMAILS": {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()},
        "GOOGLE_CLIENT_ID": os.environ.get("GOOGLE_CLIENT_ID", ""),
        "GOOGLE_CLIENT_SECRET": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
        "GITHUB_CLIENT_ID": os.environ.get("GITHUB_CLIENT_ID", ""),
        "GITHUB_CLIENT_SECRET": os.environ.get("GITHUB_CLIENT_SECRET", ""),
        "DEV_LOGIN": _env_flag("DEV_LOGIN"),
        "BEHIND_PROXY": _env_flag("BEHIND_PROXY") or base.startswith("https://"),
        "SESSION_COOKIE_SECURE": base.startswith("https://"),
    }


def create_app(db_path: str | os.PathLike | None = None, config: dict | None = None) -> Flask:
    app = Flask(__name__, static_folder=None)
    app.config.update(load_config() if config is None else {**load_config(), **config})
    if db_path:
        app.config["DB_PATH"] = str(db_path)
    if not app.config["SECRET_KEY"]:
        if not (app.config["DEV_LOGIN"] or app.config.get("TESTING")):
            raise RuntimeError("SECRET_KEY is not set. Copy .env.example to .env and fill it in.")
        # Dev only: sessions will not survive a restart.
        app.config["SECRET_KEY"] = secrets.token_hex(32)
    app.config.update(
        SESSION_COOKIE_NAME="prep_session",
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        PERMANENT_SESSION_LIFETIME=timedelta(days=30),
        MAX_CONTENT_LENGTH=5 * 1024 * 1024,
    )
    if app.config["BEHIND_PROXY"]:
        # Tailscale Funnel / Caddy / nginx terminate TLS and forward one hop to us.
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

    db.init(app.config["DB_PATH"])
    auth.init_app(app)

    @contextmanager
    def conn():
        c = db.connect(app.config["DB_PATH"])
        try:
            with c:              # commits on success, rolls back on error
                yield c
        finally:
            c.close()

    def uid() -> int:
        return g.user["id"]

    def item_id(raw: str) -> str:
        if not raw or len(raw) > MAX_ID:
            abort(400, "bad id")
        return raw

    @app.before_request
    def before():
        if request.method not in ("GET", "HEAD", "OPTIONS") and request.headers.get(CSRF_HEADER) != "1":
            abort(403, f"missing {CSRF_HEADER} header")
        auth.load_user()

    @app.after_request
    def headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        if request.path.startswith("/api/"):
            resp.headers.setdefault("Cache-Control", "no-store")
        if app.config["SESSION_COOKIE_SECURE"]:
            resp.headers.setdefault("Strict-Transport-Security", "max-age=31536000")
        return resp

    @app.errorhandler(HTTPException)
    def http_error(e: HTTPException):
        if request.path.startswith(("/api/", "/auth/")):
            return jsonify({"error": e.description, "status": e.code}), e.code
        return e

    # ------------------------------------------------------------ public

    @app.get("/api/health")
    def health():
        return {"ok": True}

    @app.get("/api/auth/config")
    def auth_config():
        return {"providers": auth.providers(), "devLogin": bool(app.config["DEV_LOGIN"])}

    # ------------------------------------------------------------ the signed-in user

    @app.get("/api/me")
    @auth.login_required
    def me():
        return auth.user_json(g.user)

    @app.get("/api/state")
    @auth.login_required
    def state():
        with conn() as c:
            return jsonify(db.read_state(c, uid()))

    @app.put("/api/items/<path:raw_id>")
    @auth.login_required
    def put_item(raw_id: str):
        status = (request.get_json(silent=True) or {}).get("status")
        if status is not None and status not in STATUSES:
            abort(400, "status must be 'done', 'rev' or null")
        with conn() as c:
            db.set_item(c, uid(), item_id(raw_id), status, _today())
            return jsonify(db.read_state(c, uid()))

    @app.put("/api/srs/<path:raw_id>")
    @auth.login_required
    def put_srs(raw_id: str):
        body = request.get_json(silent=True) or {}
        box, due = body.get("box"), body.get("due")
        if not isinstance(box, int) or not 0 <= box <= 5 or not isinstance(due, str) or len(due) > 10:
            abort(400, "expected {box: 0..5, due: 'YYYY-MM-DD'}")
        with conn() as c:
            db.set_srs(c, uid(), item_id(raw_id), box, due)
        return {"ok": True}

    @app.put("/api/notes/<path:raw_id>")
    @auth.login_required
    def put_note(raw_id: str):
        text = str((request.get_json(silent=True) or {}).get("text") or "")
        if len(text) > MAX_NOTE:
            abort(400, f"notes are limited to {MAX_NOTE} characters")
        with conn() as c:
            db.set_note(c, uid(), item_id(raw_id), text)
        return {"ok": True}

    @app.post("/api/mocks")
    @auth.login_required
    def add_mock():
        body = request.get_json(silent=True) or {}
        if not body.get("round"):
            abort(400, "round is required")
        notes = str(body.get("notes") or "")
        if len(notes) > MAX_NOTE:
            abort(400, f"notes are limited to {MAX_NOTE} characters")
        with conn() as c:
            db.add_mock(c, uid(), str(body["round"])[:200], int(body.get("used") or 1), notes, _today())
            return jsonify(db.read_state(c, uid()))

    @app.get("/api/export")
    @auth.login_required
    def export():
        with conn() as c:
            resp = jsonify(db.read_state(c, uid()))
        resp.headers["Content-Disposition"] = f"attachment; filename=prep-progress-{_today()}.json"
        return resp

    @app.post("/api/import")
    @auth.login_required
    def import_state():
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            abort(400, "expected a JSON object")
        with conn() as c:
            counts = db.merge_state(c, uid(), body)
            return jsonify({"imported": counts, "state": db.read_state(c, uid())})

    @app.delete("/api/progress")
    @auth.login_required
    def reset_progress():
        with conn() as c:
            db.reset_progress(c, uid())
            return jsonify(db.read_state(c, uid()))

    @app.delete("/api/account")
    @auth.login_required
    def delete_account():
        with conn() as c:
            db.delete_user(c, uid())
        session.clear()
        return {"ok": True}

    # ------------------------------------------------------------ admin

    @app.get("/api/admin/users")
    @auth.admin_required
    def admin_users():
        with conn() as c:
            users = db.list_users(c)
        for u in users:
            u["admin"] = auth.is_admin(u["email"])
            u["disabled"] = bool(u["disabled"])
        return jsonify(users)

    @app.put("/api/admin/users/<int:target>")
    @auth.admin_required
    def admin_update_user(target: int):
        disabled = (request.get_json(silent=True) or {}).get("disabled")
        if not isinstance(disabled, bool):
            abort(400, "expected {disabled: true|false}")
        if target == uid():
            abort(400, "you cannot disable yourself")
        with conn() as c:
            if not db.set_disabled(c, target, disabled):
                abort(404, "no such user")
        return {"ok": True}

    @app.get("/api/admin/invites")
    @auth.admin_required
    def admin_invites():
        with conn() as c:
            return jsonify(db.list_invites(c))

    @app.post("/api/admin/invites")
    @auth.admin_required
    def admin_add_invite():
        email = str((request.get_json(silent=True) or {}).get("email") or "").strip().lower()
        if not EMAIL_RE.match(email) or len(email) > 254:
            abort(400, "a valid email is required")
        with conn() as c:
            db.add_invite(c, email, uid())
            return jsonify(db.list_invites(c))

    @app.delete("/api/admin/invites/<path:email>")
    @auth.admin_required
    def admin_delete_invite(email: str):
        with conn() as c:
            if not db.delete_invite(c, email.strip().lower()):
                abort(404, "no such invite")
            return jsonify(db.list_invites(c))

    # ------------------------------------------------------------ frontend

    # Serve the built frontend when it exists; in development Vite serves it instead.
    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def frontend(path: str):
        if path.startswith(("api/", "auth/")):
            abort(404)
        if not DIST.exists():
            return ("Frontend not built. Run `npm run build` in frontend/, "
                    "or use `npm run dev` and open http://localhost:5173."), 503
        target = DIST / path
        if path and target.is_file():
            return send_from_directory(DIST, path)
        return send_from_directory(DIST, "index.html")

    return app


def _today() -> str:
    return date.today().isoformat()


if __name__ == "__main__":
    # Listens on localhost only. Remote access goes through a proxy on this machine
    # (Tailscale Funnel, Caddy, nginx) — see the README.
    port = int(os.environ.get("PORT", 5000))
    application = create_app()
    print(f"Prep Console on http://localhost:{port}")
    if application.config["DEV_LOGIN"]:
        print("DEV_LOGIN is on: anyone on this machine can sign in as any invited email.")
    if os.environ.get("FLASK_DEBUG"):
        application.run(host="127.0.0.1", port=port, debug=True)
    else:
        from waitress import serve
        serve(application, host="127.0.0.1", port=port, threads=8)
