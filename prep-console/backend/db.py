"""SQLite storage: users, invites, and per-user progress. Plain sqlite3.

Schema versions (PRAGMA user_version):
  0  the original single-user tables (no user_id)
  2  multi-user: every progress table is keyed by user_id

Upgrading from 0 renames the old tables to legacy_*; the first admin to sign in
claims that progress (see claim_legacy).
"""
from __future__ import annotations

import sqlite3
import time

VERSION = 2
PROGRESS_TABLES = ("items", "days", "srs", "notes", "mock_logs")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name       TEXT NOT NULL DEFAULT '',
    avatar     TEXT NOT NULL DEFAULT '',
    provider   TEXT NOT NULL DEFAULT '',
    created_at REAL NOT NULL,
    last_login REAL NOT NULL,
    disabled   INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS invites (
    email      TEXT PRIMARY KEY COLLATE NOCASE,
    invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at REAL NOT NULL,
    used_at    REAL
);
CREATE TABLE IF NOT EXISTS items (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id         TEXT NOT NULL,
    status     TEXT NOT NULL CHECK (status IN ('done', 'rev')),
    updated_at REAL NOT NULL,
    PRIMARY KEY (user_id, id)
);
CREATE TABLE IF NOT EXISTS days (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day     TEXT NOT NULL,               -- YYYY-MM-DD
    count   INTEGER NOT NULL DEFAULT 0,  -- items completed that day
    PRIMARY KEY (user_id, day)
);
CREATE TABLE IF NOT EXISTS srs (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id      TEXT NOT NULL,
    box     INTEGER NOT NULL,
    due     TEXT NOT NULL,
    PRIMARY KEY (user_id, id)
);
CREATE TABLE IF NOT EXISTS notes (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id      TEXT NOT NULL,
    text    TEXT NOT NULL,
    PRIMARY KEY (user_id, id)
);
CREATE TABLE IF NOT EXISTS mock_logs (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    round   TEXT NOT NULL,
    at      REAL NOT NULL,               -- epoch milliseconds, as the UI uses
    used    INTEGER NOT NULL,
    notes   TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS mock_logs_user ON mock_logs (user_id, at);
"""


def connect(path: str) -> sqlite3.Connection:
    c = sqlite3.connect(path, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys = ON")
    c.execute("PRAGMA busy_timeout = 10000")
    return c


def _columns(c: sqlite3.Connection, table: str) -> set[str]:
    return {r["name"] for r in c.execute(f"PRAGMA table_info({table})")}


def init(path: str) -> None:
    c = connect(path)
    try:
        # WAL lets readers and one writer work at the same time, which matters once several people use it.
        c.execute("PRAGMA journal_mode = WAL")
        version = c.execute("PRAGMA user_version").fetchone()[0]
        if version < VERSION:
            with c:
                if "id" in _columns(c, "items") and "user_id" not in _columns(c, "items"):
                    for t in PROGRESS_TABLES:
                        if _columns(c, t):
                            c.execute(f"ALTER TABLE {t} RENAME TO legacy_{t}")
                c.executescript(SCHEMA)
                c.execute(f"PRAGMA user_version = {VERSION}")
        else:
            c.executescript(SCHEMA)
    finally:
        c.close()


# ---------------------------------------------------------------- users and invites

def user_by_id(c: sqlite3.Connection, uid: int) -> sqlite3.Row | None:
    return c.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()


def user_by_email(c: sqlite3.Connection, email: str) -> sqlite3.Row | None:
    return c.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()


def upsert_user(c: sqlite3.Connection, email: str, name: str, avatar: str, provider: str) -> int:
    now = time.time()
    c.execute("INSERT INTO users (email, name, avatar, provider, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?) "
              "ON CONFLICT(email) DO UPDATE SET name = excluded.name, avatar = excluded.avatar, "
              "provider = excluded.provider, last_login = excluded.last_login",
              (email, name, avatar, provider, now, now))
    return user_by_email(c, email)["id"]


def is_invited(c: sqlite3.Connection, email: str) -> bool:
    return c.execute("SELECT 1 FROM invites WHERE email = ?", (email,)).fetchone() is not None


def mark_invite_used(c: sqlite3.Connection, email: str) -> None:
    c.execute("UPDATE invites SET used_at = ? WHERE email = ? AND used_at IS NULL", (time.time(), email))


def add_invite(c: sqlite3.Connection, email: str, invited_by: int | None) -> None:
    c.execute("INSERT INTO invites (email, invited_by, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING",
              (email, invited_by, time.time()))


def delete_invite(c: sqlite3.Connection, email: str) -> bool:
    return c.execute("DELETE FROM invites WHERE email = ?", (email,)).rowcount > 0


def list_invites(c: sqlite3.Connection) -> list[dict]:
    return [dict(r) for r in c.execute(
        "SELECT i.email, i.created_at, i.used_at, u.email AS invited_by "
        "FROM invites i LEFT JOIN users u ON u.id = i.invited_by ORDER BY i.created_at DESC")]


def list_users(c: sqlite3.Connection) -> list[dict]:
    return [dict(r) for r in c.execute(
        "SELECT u.id, u.email, u.name, u.avatar, u.provider, u.created_at, u.last_login, u.disabled, "
        "(SELECT COUNT(*) FROM items i WHERE i.user_id = u.id AND i.status = 'done') AS done "
        "FROM users u ORDER BY u.last_login DESC")]


def set_disabled(c: sqlite3.Connection, uid: int, disabled: bool) -> bool:
    return c.execute("UPDATE users SET disabled = ? WHERE id = ?", (int(disabled), uid)).rowcount > 0


def delete_user(c: sqlite3.Connection, uid: int) -> None:
    for t in PROGRESS_TABLES:
        c.execute(f"DELETE FROM {t} WHERE user_id = ?", (uid,))
    c.execute("UPDATE invites SET invited_by = NULL WHERE invited_by = ?", (uid,))
    c.execute("DELETE FROM users WHERE id = ?", (uid,))


def has_legacy(c: sqlite3.Connection) -> bool:
    return bool(_columns(c, "legacy_items"))


def claim_legacy(c: sqlite3.Connection, uid: int) -> bool:
    """Move the pre-accounts single-user progress to `uid`, then drop the legacy tables."""
    if not has_legacy(c):
        return False
    if _columns(c, "legacy_items"):
        c.execute("INSERT OR REPLACE INTO items (user_id, id, status, updated_at) "
                  "SELECT ?, id, status, updated_at FROM legacy_items", (uid,))
    if _columns(c, "legacy_days"):
        c.execute("INSERT INTO days (user_id, day, count) SELECT ?, day, count FROM legacy_days WHERE true "
                  "ON CONFLICT(user_id, day) DO UPDATE SET count = MAX(count, excluded.count)", (uid,))
    if _columns(c, "legacy_srs"):
        c.execute("INSERT OR REPLACE INTO srs (user_id, id, box, due) SELECT ?, id, box, due FROM legacy_srs", (uid,))
    if _columns(c, "legacy_notes"):
        c.execute("INSERT OR REPLACE INTO notes (user_id, id, text) SELECT ?, id, text FROM legacy_notes", (uid,))
    if _columns(c, "legacy_mock_logs"):
        c.execute("INSERT INTO mock_logs (user_id, round, at, used, notes) "
                  "SELECT ?, round, at, used, notes FROM legacy_mock_logs", (uid,))
    for t in PROGRESS_TABLES:
        c.execute(f"DROP TABLE IF EXISTS legacy_{t}")
    return True


# ---------------------------------------------------------------- progress

def read_state(c: sqlite3.Connection, uid: int) -> dict:
    q = lambda sql: c.execute(sql, (uid,))  # noqa: E731
    return {
        "items": {r["id"]: r["status"] for r in q("SELECT id, status FROM items WHERE user_id = ?")},
        "days": {r["day"]: r["count"] for r in q("SELECT day, count FROM days WHERE user_id = ?")},
        "srs": {r["id"]: {"box": r["box"], "due": r["due"]} for r in q("SELECT id, box, due FROM srs WHERE user_id = ?")},
        "notes": {r["id"]: r["text"] for r in q("SELECT id, text FROM notes WHERE user_id = ?")},
        "logs": [dict(r) for r in q("SELECT round, at, used, notes FROM mock_logs WHERE user_id = ? ORDER BY at")],
    }


def _bump_day(c: sqlite3.Connection, uid: int, day: str, by: int = 1) -> None:
    c.execute("INSERT INTO days (user_id, day, count) VALUES (?, ?, ?) "
              "ON CONFLICT(user_id, day) DO UPDATE SET count = count + excluded.count", (uid, day, by))


def set_item(c: sqlite3.Connection, uid: int, item_id: str, status: str | None, today: str) -> None:
    row = c.execute("SELECT status FROM items WHERE user_id = ? AND id = ?", (uid, item_id)).fetchone()
    prev = row["status"] if row else None
    if status is None:
        c.execute("DELETE FROM items WHERE user_id = ? AND id = ?", (uid, item_id))
    else:
        c.execute("INSERT INTO items (user_id, id, status, updated_at) VALUES (?, ?, ?, ?) "
                  "ON CONFLICT(user_id, id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at",
                  (uid, item_id, status, time.time()))
    # A newly completed item counts toward today's activity (the streak calendar).
    if status == "done" and prev != "done":
        _bump_day(c, uid, today)


def set_srs(c: sqlite3.Connection, uid: int, item_id: str, box: int, due: str) -> None:
    c.execute("INSERT INTO srs (user_id, id, box, due) VALUES (?, ?, ?, ?) "
              "ON CONFLICT(user_id, id) DO UPDATE SET box = excluded.box, due = excluded.due", (uid, item_id, box, due))


def set_note(c: sqlite3.Connection, uid: int, item_id: str, text: str) -> None:
    if text.strip():
        c.execute("INSERT INTO notes (user_id, id, text) VALUES (?, ?, ?) "
                  "ON CONFLICT(user_id, id) DO UPDATE SET text = excluded.text", (uid, item_id, text.strip()))
    else:
        c.execute("DELETE FROM notes WHERE user_id = ? AND id = ?", (uid, item_id))


def add_mock(c: sqlite3.Connection, uid: int, round_name: str, used: int, notes: str, today: str) -> None:
    c.execute("INSERT INTO mock_logs (user_id, round, at, used, notes) VALUES (?, ?, ?, ?, ?)",
              (uid, round_name, time.time() * 1000, max(1, used), notes))
    _bump_day(c, uid, today)


def reset_progress(c: sqlite3.Connection, uid: int) -> None:
    for t in PROGRESS_TABLES:
        c.execute(f"DELETE FROM {t} WHERE user_id = ?", (uid,))


def merge_state(c: sqlite3.Connection, uid: int, s: dict) -> dict:
    """Merge an exported state (this app's, or the old single-file console's) into a user's progress.
    Incoming values win for items, srs and notes; day counts take the larger value;
    mock logs are added unless an identical (round, at) already exists."""
    counts = {"items": 0, "days": 0, "srs": 0, "notes": 0, "logs": 0}
    now = time.time()
    for k, v in (s.get("items") or {}).items():
        if v in ("done", "rev"):
            c.execute("INSERT INTO items (user_id, id, status, updated_at) VALUES (?, ?, ?, ?) "
                      "ON CONFLICT(user_id, id) DO UPDATE SET status = excluded.status", (uid, k, v, now))
            counts["items"] += 1
    for k, v in (s.get("days") or {}).items():
        if isinstance(v, int) and v > 0:
            c.execute("INSERT INTO days (user_id, day, count) VALUES (?, ?, ?) "
                      "ON CONFLICT(user_id, day) DO UPDATE SET count = MAX(count, excluded.count)", (uid, k, v))
            counts["days"] += 1
    for k, v in (s.get("srs") or {}).items():
        if isinstance(v, dict) and isinstance(v.get("box"), int) and isinstance(v.get("due"), str):
            set_srs(c, uid, k, v["box"], v["due"])
            counts["srs"] += 1
    for k, v in (s.get("notes") or {}).items():
        if isinstance(v, str):
            set_note(c, uid, k, v)
            counts["notes"] += 1
    for log in s.get("logs") or []:
        if not isinstance(log, dict) or not log.get("round"):
            continue
        at = float(log.get("at") or now * 1000)
        exists = c.execute("SELECT 1 FROM mock_logs WHERE user_id = ? AND round = ? AND at = ?",
                           (uid, log["round"], at)).fetchone()
        if not exists:
            c.execute("INSERT INTO mock_logs (user_id, round, at, used, notes) VALUES (?, ?, ?, ?, ?)",
                      (uid, log["round"], at, int(log.get("used") or 1), str(log.get("notes") or "")))
            counts["logs"] += 1
    return counts
