"""Sign-in: Google and GitHub OAuth, an optional local dev login, and the invite list.

Only admins (ADMIN_EMAILS) and invited emails may sign in. The session cookie holds
just the user id; the user row is re-read on every request, so disabling or deleting
a user takes effect immediately.
"""
from __future__ import annotations

import ipaddress
from functools import wraps
from typing import Callable
from urllib.parse import urlencode

from authlib.integrations.flask_client import OAuth
from flask import Blueprint, Flask, abort, current_app, g, redirect, request, session

import db

bp = Blueprint("auth", __name__)
oauth = OAuth()


def init_app(app: Flask) -> None:
    oauth.init_app(app)
    cfg = app.config
    if cfg.get("GOOGLE_CLIENT_ID"):
        oauth.register(
            "google",
            client_id=cfg["GOOGLE_CLIENT_ID"], client_secret=cfg["GOOGLE_CLIENT_SECRET"],
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
            overwrite=True,
        )
    if cfg.get("GITHUB_CLIENT_ID"):
        oauth.register(
            "github",
            client_id=cfg["GITHUB_CLIENT_ID"], client_secret=cfg["GITHUB_CLIENT_SECRET"],
            access_token_url="https://github.com/login/oauth/access_token",
            authorize_url="https://github.com/login/oauth/authorize",
            api_base_url="https://api.github.com/",
            client_kwargs={"scope": "read:user user:email"},
            overwrite=True,
        )
    app.register_blueprint(bp)


def providers() -> list[str]:
    cfg = current_app.config
    return [p for p in ("google", "github") if cfg.get(f"{p.upper()}_CLIENT_ID")]


def is_admin(email: str) -> bool:
    return email.lower() in current_app.config["ADMIN_EMAILS"]


# ---------------------------------------------------------------- request helpers

def load_user() -> None:
    """Attach the signed-in user (or None) to `g.user`."""
    g.user = None
    uid = session.get("uid")
    if not isinstance(uid, int):
        return
    c = db.connect(current_app.config["DB_PATH"])
    try:
        row = db.user_by_id(c, uid)
    finally:
        c.close()
    if row is None or row["disabled"]:
        session.clear()
        return
    g.user = row


def login_required(fn: Callable) -> Callable:
    @wraps(fn)
    def wrapper(*a, **kw):
        if g.get("user") is None:
            abort(401, "sign in required")
        return fn(*a, **kw)
    return wrapper


def admin_required(fn: Callable) -> Callable:
    @wraps(fn)
    def wrapper(*a, **kw):
        if g.get("user") is None:
            abort(401, "sign in required")
        if not is_admin(g.user["email"]):
            abort(403, "admins only")
        return fn(*a, **kw)
    return wrapper


def user_json(row) -> dict:
    return {"id": row["id"], "email": row["email"], "name": row["name"], "avatar": row["avatar"],
            "provider": row["provider"], "admin": is_admin(row["email"])}


# ---------------------------------------------------------------- sign-in

def complete_login(email: str, name: str, avatar: str, provider: str) -> str | None:
    """Sign a verified identity in. Returns None on success, or an error code for the UI."""
    email = email.strip().lower()
    if not email:
        return "no-email"
    c = db.connect(current_app.config["DB_PATH"])
    try:
        with c:
            existing = db.user_by_email(c, email)
            if existing is not None and existing["disabled"]:
                return "disabled"
            admin = is_admin(email)
            if existing is None and not admin and not db.is_invited(c, email):
                return "not-invited"
            uid = db.upsert_user(c, email, name, avatar, provider)
            db.mark_invite_used(c, email)
            if admin:
                db.claim_legacy(c, uid)
    finally:
        c.close()
    session.clear()
    session["uid"] = uid
    session.permanent = True
    return None


def _finish(error: str | None):
    return redirect("/" if error is None else "/?" + urlencode({"auth": error}))


def _redirect_uri(provider: str) -> str:
    base = current_app.config.get("BASE_URL")
    path = f"/auth/callback/{provider}"
    return base.rstrip("/") + path if base else request.host_url.rstrip("/") + path


@bp.get("/auth/login/<provider>")
def login(provider: str):
    if provider not in providers():
        abort(404)
    return oauth.create_client(provider).authorize_redirect(_redirect_uri(provider))


@bp.get("/auth/callback/<provider>")
def callback(provider: str):
    if provider not in providers():
        abort(404)
    client = oauth.create_client(provider)
    try:
        token = client.authorize_access_token()
    except Exception:  # denied consent, state mismatch, expired code
        current_app.logger.warning("OAuth callback failed for %s", provider, exc_info=True)
        return _finish("failed")

    if provider == "google":
        info = token.get("userinfo") or client.userinfo()
        if not info.get("email_verified"):
            return _finish("unverified")
        return _finish(complete_login(info.get("email", ""), info.get("name", ""), info.get("picture", ""), "google"))

    profile = client.get("user", token=token).json()
    emails = client.get("user/emails", token=token).json()
    primary = next((e["email"] for e in emails if isinstance(e, dict) and e.get("primary") and e.get("verified")), "")
    if not primary:
        return _finish("unverified")
    return _finish(complete_login(primary, profile.get("name") or profile.get("login", ""),
                                  profile.get("avatar_url", ""), "github"))


def _is_local_request() -> bool:
    # Behind Tailscale Funnel or any reverse proxy the request carries X-Forwarded-For; those never qualify.
    if request.headers.get("X-Forwarded-For") or request.headers.get("Forwarded"):
        return False
    try:
        return ipaddress.ip_address(request.remote_addr or "").is_loopback
    except ValueError:
        return False


@bp.post("/auth/dev-login")
def dev_login():
    """Sign in as any email without OAuth. Only when DEV_LOGIN is set, and only from this machine."""
    if not current_app.config.get("DEV_LOGIN") or not _is_local_request():
        abort(404)
    body = request.get_json(silent=True) or request.form
    email = str(body.get("email") or "").strip()
    error = complete_login(email, str(body.get("name") or email.split("@")[0]), "", "dev")
    if error:
        abort(403, error)
    return {"ok": True}


@bp.post("/auth/logout")
def logout():
    session.clear()
    return {"ok": True}
