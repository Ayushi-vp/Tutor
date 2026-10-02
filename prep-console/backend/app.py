"""Prep Console API.

Stores study progress in a local SQLite file and, once the frontend has been
built, serves it too — so `python backend/app.py` is the whole app.

    GET  /api/state            everything the UI needs to render progress
    PUT  /api/items/<id>       {"status": "done" | "rev" | null}
    PUT  /api/srs/<id>         {"box": 1..5, "due": "YYYY-MM-DD"}
    PUT  /api/notes/<id>       {"text": "..."}
    POST /api/mocks            {"round", "used", "notes"}
    GET  /api/export           the full state as a JSON download
    POST /api/import           a previously exported (or old console) state
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from datetime import date
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_from_directory

import db

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "frontend" / "dist"
STATUSES = {"done", "rev"}


def create_app(db_path: str | os.PathLike | None = None) -> Flask:
    app = Flask(__name__, static_folder=None)
    app.config["DB_PATH"] = str(db_path or os.environ.get("PREP_DB") or ROOT / "backend" / "prep.db")
    db.init(app.config["DB_PATH"])

    @contextmanager
    def conn():
        c = db.connect(app.config["DB_PATH"])
        try:
            with c:              # commits on success, rolls back on error
                yield c
        finally:
            c.close()

    @app.get("/api/health")
    def health():
        return {"ok": True}

    @app.get("/api/state")
    def state():
        with conn() as c:
            return jsonify(db.read_state(c))

    @app.put("/api/items/<path:item_id>")
    def put_item(item_id: str):
        status = (request.get_json(silent=True) or {}).get("status")
        if status is not None and status not in STATUSES:
            abort(400, "status must be 'done', 'rev' or null")
        with conn() as c:
            db.set_item(c, item_id, status, _today())
            return jsonify(db.read_state(c))

    @app.put("/api/srs/<path:item_id>")
    def put_srs(item_id: str):
        body = request.get_json(silent=True) or {}
        box, due = body.get("box"), body.get("due")
        if not isinstance(box, int) or not 0 <= box <= 5 or not isinstance(due, str):
            abort(400, "expected {box: 0..5, due: 'YYYY-MM-DD'}")
        with conn() as c:
            db.set_srs(c, item_id, box, due)
        return {"ok": True}

    @app.put("/api/notes/<path:item_id>")
    def put_note(item_id: str):
        text = str((request.get_json(silent=True) or {}).get("text") or "")
        with conn() as c:
            db.set_note(c, item_id, text)
        return {"ok": True}

    @app.post("/api/mocks")
    def add_mock():
        body = request.get_json(silent=True) or {}
        if not body.get("round"):
            abort(400, "round is required")
        with conn() as c:
            db.add_mock(c, str(body["round"]), int(body.get("used") or 1), str(body.get("notes") or ""), _today())
            return jsonify(db.read_state(c))

    @app.get("/api/export")
    def export():
        with conn() as c:
            resp = jsonify(db.read_state(c))
        resp.headers["Content-Disposition"] = f"attachment; filename=prep-progress-{_today()}.json"
        return resp

    @app.post("/api/import")
    def import_state():
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            abort(400, "expected a JSON object")
        with conn() as c:
            counts = db.merge_state(c, body)
            return jsonify({"imported": counts, "state": db.read_state(c)})

    # Serve the built frontend when it exists; in development Vite serves it instead.
    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def frontend(path: str):
        if path.startswith("api/"):
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
    # Listens on localhost only. Remote access goes through `tailscale serve`, which proxies
    # the tailnet's HTTPS address to this port — see the README.
    port = int(os.environ.get("PORT", 5000))
    print(f"Prep Console on http://localhost:{port}")
    if os.environ.get("FLASK_DEBUG"):
        create_app().run(host="127.0.0.1", port=port, debug=True)
    else:
        from waitress import serve
        serve(create_app(), host="127.0.0.1", port=port, threads=8)
