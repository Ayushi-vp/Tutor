"""Copy the progress database to a timestamped file and keep the newest N copies.

    python backend/backup.py [--dir DIR] [--keep N]

Uses SQLite's online backup API, so it is safe while the app is running.
Defaults: PREP_DB (or backend/prep.db) -> BACKUP_DIR (or prep-console/backups), keep 14.
"""
from __future__ import annotations

import argparse
import os
import sqlite3
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent


def backup(db_path: Path, out_dir: Path, keep: int) -> Path:
    if not db_path.exists():
        raise SystemExit(f"no database at {db_path}")
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f"prep-{datetime.now():%Y%m%d-%H%M%S}.db"
    src, dst = sqlite3.connect(db_path), sqlite3.connect(target)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()
    for old in sorted(out_dir.glob("prep-*.db"))[:-keep]:
        old.unlink()
    return target


def main() -> None:
    load_dotenv(ROOT / ".env")
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=os.environ.get("BACKUP_DIR") or str(ROOT / "backups"))
    ap.add_argument("--keep", type=int, default=14)
    a = ap.parse_args()
    db_path = Path(os.environ.get("PREP_DB") or ROOT / "backend" / "prep.db")
    print(f"Backed up to {backup(db_path, Path(a.dir), max(1, a.keep))}")


if __name__ == "__main__":
    main()
