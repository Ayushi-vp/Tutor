"""SQLite storage for progress. Plain sqlite3 — the schema is five small tables."""
from __future__ import annotations

import sqlite3
import time

SCHEMA = """
CREATE TABLE IF NOT EXISTS items (
    id         TEXT PRIMARY KEY,
    status     TEXT NOT NULL CHECK (status IN ('done', 'rev')),
    updated_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS days (
    day   TEXT PRIMARY KEY,          -- YYYY-MM-DD
    count INTEGER NOT NULL DEFAULT 0 -- items completed that day
);
CREATE TABLE IF NOT EXISTS srs (
    id  TEXT PRIMARY KEY,
    box INTEGER NOT NULL,
    due TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notes (
    id   TEXT PRIMARY KEY,
    text TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mock_logs (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    round TEXT NOT NULL,
    at    REAL NOT NULL,             -- epoch milliseconds, as the UI uses
    used  INTEGER NOT NULL,
    notes TEXT NOT NULL DEFAULT ''
);
"""


def connect(path: str) -> sqlite3.Connection:
    c = sqlite3.connect(path)
    c.row_factory = sqlite3.Row
    return c


def init(path: str) -> None:
    c = connect(path)
    try:
        c.executescript(SCHEMA)
    finally:
        c.close()


def read_state(c: sqlite3.Connection) -> dict:
    return {
        "items": {r["id"]: r["status"] for r in c.execute("SELECT id, status FROM items")},
        "days": {r["day"]: r["count"] for r in c.execute("SELECT day, count FROM days")},
        "srs": {r["id"]: {"box": r["box"], "due": r["due"]} for r in c.execute("SELECT id, box, due FROM srs")},
        "notes": {r["id"]: r["text"] for r in c.execute("SELECT id, text FROM notes")},
        "logs": [dict(r) for r in c.execute("SELECT round, at, used, notes FROM mock_logs ORDER BY at")],
    }


def _bump_day(c: sqlite3.Connection, day: str, by: int = 1) -> None:
    c.execute("INSERT INTO days (day, count) VALUES (?, ?) "
              "ON CONFLICT(day) DO UPDATE SET count = count + excluded.count", (day, by))


def set_item(c: sqlite3.Connection, item_id: str, status: str | None, today: str) -> None:
    row = c.execute("SELECT status FROM items WHERE id = ?", (item_id,)).fetchone()
    prev = row["status"] if row else None
    if status is None:
        c.execute("DELETE FROM items WHERE id = ?", (item_id,))
    else:
        c.execute("INSERT INTO items (id, status, updated_at) VALUES (?, ?, ?) "
                  "ON CONFLICT(id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at",
                  (item_id, status, time.time()))
    # A newly completed item counts toward today's activity (the streak calendar).
    if status == "done" and prev != "done":
        _bump_day(c, today)


def set_srs(c: sqlite3.Connection, item_id: str, box: int, due: str) -> None:
    c.execute("INSERT INTO srs (id, box, due) VALUES (?, ?, ?) "
              "ON CONFLICT(id) DO UPDATE SET box = excluded.box, due = excluded.due", (item_id, box, due))


def set_note(c: sqlite3.Connection, item_id: str, text: str) -> None:
    if text.strip():
        c.execute("INSERT INTO notes (id, text) VALUES (?, ?) "
                  "ON CONFLICT(id) DO UPDATE SET text = excluded.text", (item_id, text.strip()))
    else:
        c.execute("DELETE FROM notes WHERE id = ?", (item_id,))


def add_mock(c: sqlite3.Connection, round_name: str, used: int, notes: str, today: str) -> None:
    c.execute("INSERT INTO mock_logs (round, at, used, notes) VALUES (?, ?, ?, ?)",
              (round_name, time.time() * 1000, max(1, used), notes))
    _bump_day(c, today)


def merge_state(c: sqlite3.Connection, s: dict) -> dict:
    """Merge an exported state (this app's, or the old single-file console's) into the DB.
    Incoming values win for items, srs and notes; day counts take the larger value;
    mock logs are added unless an identical (round, at) already exists."""
    counts = {"items": 0, "days": 0, "srs": 0, "notes": 0, "logs": 0}
    now = time.time()
    for k, v in (s.get("items") or {}).items():
        if v in ("done", "rev"):
            c.execute("INSERT INTO items (id, status, updated_at) VALUES (?, ?, ?) "
                      "ON CONFLICT(id) DO UPDATE SET status = excluded.status", (k, v, now))
            counts["items"] += 1
    for k, v in (s.get("days") or {}).items():
        if isinstance(v, int) and v > 0:
            c.execute("INSERT INTO days (day, count) VALUES (?, ?) "
                      "ON CONFLICT(day) DO UPDATE SET count = MAX(count, excluded.count)", (k, v))
            counts["days"] += 1
    for k, v in (s.get("srs") or {}).items():
        if isinstance(v, dict) and isinstance(v.get("box"), int) and isinstance(v.get("due"), str):
            set_srs(c, k, v["box"], v["due"])
            counts["srs"] += 1
    for k, v in (s.get("notes") or {}).items():
        if isinstance(v, str):
            set_note(c, k, v)
            counts["notes"] += 1
    for log in s.get("logs") or []:
        if not isinstance(log, dict) or not log.get("round"):
            continue
        at = float(log.get("at") or now * 1000)
        exists = c.execute("SELECT 1 FROM mock_logs WHERE round = ? AND at = ?", (log["round"], at)).fetchone()
        if not exists:
            c.execute("INSERT INTO mock_logs (round, at, used, notes) VALUES (?, ?, ?, ?)",
                      (log["round"], at, int(log.get("used") or 1), str(log.get("notes") or "")))
            counts["logs"] += 1
    return counts
