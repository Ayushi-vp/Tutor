"""Check every reading-list URL in content/ resolves.

    python scripts/check_links.py                 # all content
    python scripts/check_links.py tracks/net.json # one file

Uses a browser user-agent: several publishers (otexts, robjhyndman) return 403 to
plain clients. ScienceDirect blocks everything automated — verify those via Crossref.
"""
from __future__ import annotations

import json
import sys
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

CONTENT = Path(__file__).resolve().parent.parent / "content"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
KNOWN_BLOCKERS = ("sciencedirect.com", "dl.acm.org", "leetcode.com")


def urls(files: list[Path]) -> dict[str, str]:
    out: dict[str, str] = {}
    for f in files:
        for item in json.loads(f.read_text(encoding="utf8")):
            for ref in item.get("refs") or []:
                out.setdefault(ref[3], f"{f.relative_to(CONTENT)}:{item['id']}")
    return out


def status(url: str) -> int:
    # curl, not urllib: it uses the OS certificate store, which stays current. Python's
    # bundled CA list can be stale (seen here as CERTIFICATE_VERIFY_FAILED on valid sites).
    r = subprocess.run(["curl", "-s", "-o", os.devnull, "-w", "%{http_code}", "-L", "-m", "25",
                        "-A", UA, "-H", "Accept: text/html,*/*", url], capture_output=True, text=True)
    try:
        return int(r.stdout.strip() or 0)
    except ValueError:
        return 0


def main() -> int:
    args = sys.argv[1:]
    files = [CONTENT / a for a in args] if args else sorted(CONTENT.rglob("*.json"))
    todo = urls([f for f in files if f.exists()])
    with ThreadPoolExecutor(16) as ex:
        results = dict(zip(todo, ex.map(status, todo)))
    bad = {u: c for u, c in results.items() if c != 200 and not any(b in u for b in KNOWN_BLOCKERS)}
    for u, c in sorted(bad.items(), key=lambda kv: kv[1]):
        print(f"  {c or '---'}  {u}   ({todo[u]})")
    print(f"checked {len(results)} urls, {len(bad)} need attention")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
