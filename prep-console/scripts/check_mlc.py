"""Run the reference solutions in the ML coding section and fail if any of them breaks.

    python scripts/check_mlc.py              # every problem
    python scripts/check_mlc.py mc4 mc16     # just these

Every <pre class="run"> block in a problem's body and exercise is executed in page order, in
one namespace per problem, so a solution and the checks written under it must pass together.
Plain <pre> blocks are shown on the page but not run. Needs NumPy — any Python that has it
(pip install numpy); the Flask venv does not.
"""
from __future__ import annotations

import contextlib
import html
import io
import json
import re
import sys
import time
import traceback
from pathlib import Path

FILE = Path(__file__).resolve().parent.parent / "content" / "designs" / "mlc.json"
RUN = re.compile(r'<pre class="run">(.*?)</pre>', re.S)


def blocks(item: dict) -> list[str]:
    return [html.unescape(b) for field in ("body", "drill") for b in RUN.findall(item.get(field) or "")]


def main() -> int:
    want = set(sys.argv[1:])
    items = [i for i in json.loads(FILE.read_text(encoding="utf8")) if not want or i["id"] in want]
    failed = 0
    for it in items:
        code = blocks(it)
        start = time.perf_counter()
        try:
            if not code:
                raise AssertionError("no runnable blocks")
            ns: dict = {"__name__": "__mlc__"}
            with contextlib.redirect_stdout(io.StringIO()):
                for i, b in enumerate(code):
                    exec(compile(b, f"{it['id']}[{i}]", "exec"), ns)
            print(f"  ok    {it['id']:5} {len(code)} blocks {time.perf_counter() - start:6.2f}s  {it['t']}")
        except Exception:
            failed += 1
            print(f"  FAIL  {it['id']:5} {it['t']}")
            traceback.print_exc()
    print(f"{len(items) - failed}/{len(items)} problems pass")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
