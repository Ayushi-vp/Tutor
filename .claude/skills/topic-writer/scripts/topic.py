"""Author prep-console learning topics as readable HTML source files, check them, merge them.

A topic source lives at prep-console/content/topics/<track>/<id>.html: a <script id="meta">
JSON block for the structured fields, then one <section data-field="..."> per HTML field.
The track JSON (content/tracks/<track>.json) is what the app loads; `merge` writes into it.
Design-case families work the same way: content/topics/<family>/<id>.html merges into
content/designs/<family>.json (classic, infra, hld, lld, mlc). The source folder name picks the file.

  python topic.py export <track> <id>     # existing topic -> source file (starting point)
  python topic.py check  <source.html>    # validate + word counts + beginner-readability report
  python topic.py merge  <source.html>    # check, then replace (or append) the topic in the track JSON
  python topic.py merge  <source.html> --dry-run   # show what merge would do, write nothing
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4] / "prep-console" / "content"
TRACKS = ROOT / "tracks"
DESIGNS = ROOT / "designs"
TOPICS = ROOT / "topics"


def content_file(name: str) -> Path:
    """The JSON the app loads for a track (content/tracks/) or design family (content/designs/)."""
    for d in (TRACKS, DESIGNS):
        if (d / f"{name}.json").exists():
            return d / f"{name}.json"
    sys.exit(f"no content/tracks/{name}.json or content/designs/{name}.json")

HTML_FIELDS = ["why", "primer", "body", "deep", "prod", "lab", "drill"]
FIELD_ORDER = ["id", "t", "tag", "sum", "prereq", "why", "primer", "body", "deep", "prod",
               "myths", "lab", "recap", "glossary", "viz", "drill", "qa", "refs"]
# Minimum words per HTML field. Below these the section is almost certainly a summary, not teaching.
MIN_WORDS = {"why": 250, "primer": 500, "body": 1800, "deep": 700, "prod": 500, "lab": 250}
MIN_TOTAL = 5000

META_RE = re.compile(r'<script[^>]*id="meta"[^>]*>(.*?)</script>', re.S)
SECTION_RE = re.compile(r'<section data-field="(\w+)">(.*?)</section>', re.S)


def words(html: str) -> int:
    text = re.sub(r"<svg.*?</svg>", " ", html, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return len(re.findall(r"[\w'’.-]+", text))


def parse(src: Path) -> dict:
    raw = src.read_text(encoding="utf-8")
    m = META_RE.search(raw)
    if not m:
        sys.exit(f"{src}: no <script id=\"meta\"> JSON block")
    try:
        topic = json.loads(m.group(1))
    except json.JSONDecodeError as e:
        sys.exit(f"{src}: meta JSON is invalid: {e}")
    for field, inner in SECTION_RE.findall(raw):
        if field not in HTML_FIELDS:
            sys.exit(f"{src}: unknown section data-field=\"{field}\" (allowed: {', '.join(HTML_FIELDS)})")
        topic[field] = inner.strip()
    return {k: topic[k] for k in FIELD_ORDER if topic.get(k) not in (None, "", [])}


def all_ids() -> set[str]:
    ids = set()
    for f in [*TRACKS.glob("*.json"), *DESIGNS.glob("*.json")]:
        ids.update(t["id"] for t in json.loads(f.read_text(encoding="utf-8")))
    return ids


def check(topic: dict) -> tuple[list[str], list[str]]:
    errors, warns = [], []
    for k in ["id", "t", "tag", "sum", "why", "primer", "body", "deep", "prod", "lab", "drill",
              "myths", "recap", "glossary", "qa", "refs"]:
        if k not in topic:
            errors.append(f"missing field: {k}")

    total = 0
    for k in HTML_FIELDS:
        n = words(topic.get(k, ""))
        total += n
        if k in MIN_WORDS and n < MIN_WORDS[k]:
            warns.append(f"{k}: {n} words (aim for at least {MIN_WORDS[k]})")
    total += sum(words(" ".join(r)) for r in topic.get("myths", []))
    total += sum(words(r[2]) + words(r[3] if len(r) > 3 else "") for r in topic.get("qa", []))
    if total < MIN_TOTAL:
        warns.append(f"total: {total} words (aim for at least {MIN_TOTAL})")

    qa = topic.get("qa", [])
    levels = [r[0] for r in qa]
    if len(qa) < 10:
        warns.append(f"qa: {len(qa)} questions (aim for 10-15)")
    for lv in "EMH":
        if lv not in levels:
            warns.append(f"qa: no {lv}-level question")
    for i, r in enumerate(qa):
        if r[0] not in "EMH" or len(r) not in (3, 4):
            errors.append(f"qa[{i}]: must be [E|M|H, question, answer] or [.., follow-up]")
    if len(topic.get("glossary", [])) < 10:
        warns.append(f"glossary: {len(topic.get('glossary', []))} terms (aim for 10+)")
    if len(topic.get("myths", [])) < 4:
        warns.append(f"myths: {len(topic.get('myths', []))} (aim for 4-6)")
    if not 5 <= len(topic.get("recap", [])) <= 10:
        warns.append(f"recap: {len(topic.get('recap', []))} points (aim for 5-10)")
    for i, r in enumerate(topic.get("refs", [])):
        if len(r) != 4 or not r[3].startswith("https://"):
            errors.append(f"refs[{i}]: must be [kind, title, note, https-url]")

    known = all_ids() | {topic["id"]}
    for r in topic.get("prereq", []):
        if r[0] not in known:
            errors.append(f"prereq: unknown topic id {r[0]!r}")

    html = " ".join(topic.get(k, "") for k in HTML_FIELDS)
    svgs = re.findall(r"<svg.*?</svg>", html, re.S)
    if len(svgs) < 2:
        warns.append(f"figures: {len(svgs)} inline <svg> (aim for 2-4)")
    for s in svgs:
        if re.search(r'\s(fill|stroke|stop-color)="(#|rgb|var\()', s):
            errors.append("svg: colours go in style=\"fill:var(--x)\", not fill=/stroke= attributes "
                          "(hex breaks dark mode; var() does not work in presentation attributes)")
            break
        if "viewBox" not in s:
            errors.append("svg: missing viewBox (needed to scale on phones)")
            break
    if re.search(r"<h[1-3][ >]", html):
        errors.append("headings: use <h4> (h1-h3 clash with the app's page headings)")

    # Beginner report: acronyms used but never glossed. Advisory only.
    gloss = " ".join(t for t, _ in topic.get("glossary", [])).upper()
    prose = re.sub(r"<(svg|pre|code).*?</\1>", " ", html, flags=re.S)
    prose = re.sub(r"<[^>]+>", " ", prose)
    acr = sorted({a for a in re.findall(r"\b[A-Z][A-Z0-9]{1,6}s?\b", prose)
                  if a.rstrip("s") not in gloss})
    if acr:
        warns.append("acronyms not in glossary (define on first use, gloss, or cite a prereq): "
                     + ", ".join(acr))
    return errors, warns


def cmd_export(track: str, tid: str) -> None:
    path = content_file(track)
    topics = json.loads(path.read_text(encoding="utf-8"))
    t = next((x for x in topics if x["id"] == tid), None)
    if not t:
        sys.exit(f"{tid} not in {path.name}")
    meta = {k: t.get(k) for k in ["id", "t", "tag", "sum", "viz", "prereq", "myths", "recap",
                                  "glossary", "qa", "refs"] if t.get(k) is not None}
    out = [f"<!-- topic source for {track}/{tid}; build with topic.py merge -->",
           '<script type="application/json" id="meta">',
           json.dumps(meta, indent=2, ensure_ascii=False), "</script>", ""]
    for k in HTML_FIELDS:
        out += [f'<section data-field="{k}">', t.get(k, ""), "</section>", ""]
    dest = TOPICS / track / f"{tid}.html"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("\n".join(out), encoding="utf-8")
    print(dest)


def cmd_check(src: Path) -> tuple[dict, list[str]]:
    topic = parse(src)
    errors, warns = check(topic)
    counts = {k: words(topic.get(k, "")) for k in HTML_FIELDS}
    print(f"{topic.get('id')}: " + ", ".join(f"{k} {n}" for k, n in counts.items())
          + f" | qa {len(topic.get('qa', []))}, glossary {len(topic.get('glossary', []))}")
    for w in warns:
        print("  warn:", w)
    for e in errors:
        print("  ERROR:", e)
    return topic, errors


def cmd_merge(src: Path, dry_run: bool = False) -> None:
    topic, errors = cmd_check(src)
    if errors and not dry_run:
        sys.exit("not merged: fix the errors above")
    path = content_file(src.parent.name)
    topics = json.loads(path.read_text(encoding="utf-8"))
    idx = next((i for i, x in enumerate(topics) if x["id"] == topic["id"]), None)
    if dry_run:
        old = set(topics[idx]) if idx is not None else set()
        print(f"dry run: would {'replace' if idx is not None else 'append'} {topic['id']} in "
              f"{path.relative_to(ROOT)}; fields {', '.join(topic)}"
              + (f" ({len(errors)} errors would block it)" if errors else ""))
        if old - set(topic):
            print("  warn: existing fields that would be dropped:", ", ".join(sorted(old - set(topic))))
        return
    if idx is None:
        topics.append(topic)
    else:
        topics[idx] = topic
    path.write_text(json.dumps(topics, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{'replaced' if idx is not None else 'appended'} {topic['id']} in {path.name}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    cmd, *args = sys.argv[1:]
    if cmd == "export" and len(args) == 2:
        cmd_export(*args)
    elif cmd == "check":
        cmd_check(Path(args[0]))
    elif cmd == "merge":
        cmd_merge(Path(args[0]), dry_run="--dry-run" in args[1:])
    else:
        sys.exit(__doc__)
