"""Register a new learning track in the app.

    python scripts/add_track.py <key> "<Nav label>" <ICON> "<Bank category label>" <pillar-key>
        --eyebrow "..." --title "..." --lede "..." --blurb "..." --round-name "..." --round-desc "..."
        [--group Learn] [--after aieng]

Prerequisite: content/tracks/<key>.json exists. Edits content.ts (import, TRACKS, TRACK_CAT,
a nav group — Engineering unless --group says otherwise, placed after --after or at the end —
and the pillar), meta.json, views.json and rounds.json, and adds the route to the render test.
Idempotent: running it twice changes nothing.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CT = ROOT / "frontend" / "src" / "content.ts"
RENDER_TEST = ROOT / "frontend" / "src" / "test" / "render.test.tsx"


def load(p: Path):
    return json.loads(p.read_text(encoding="utf8"))


def dump(p: Path, data) -> None:
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf8")


def sub_once(s: str, anchor: str, insert: str, marker: str) -> str:
    """Insert `insert` right after `anchor`, unless `marker` is already present."""
    if marker in s:
        return s
    assert anchor in s, f"anchor not found: {anchor!r}"
    return s.replace(anchor, anchor + insert, 1)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("key"); ap.add_argument("label"); ap.add_argument("icon")
    ap.add_argument("cat_label"); ap.add_argument("pillar")
    for f in ("eyebrow", "title", "lede", "blurb", "round_name", "round_desc"):
        ap.add_argument("--" + f.replace("_", "-"), required=True)
    ap.add_argument("--group", default="Engineering")
    ap.add_argument("--after", default=None)
    a = ap.parse_args()
    k = a.key
    assert (ROOT / "content" / "tracks" / f"{k}.json").exists(), "write the track JSON first"

    s = CT.read_text(encoding="utf8")
    s = sub_once(s, 'import swe from "@content/tracks/swe.json";', f'\nimport {k} from "@content/tracks/{k}.json";',
                 f'@content/tracks/{k}.json')
    s = sub_once(s, "  swe: cast<Item[]>(swe),", f"\n  {k}: cast<Item[]>({k}),", f"  {k}: cast<Item[]>({k}),")
    s = sub_once(s, 'swe: "swe"', f', {k}: "{k}"', f'{k}: "{k}"')
    # nav: into the chosen group, after --after if given, else at the end
    nav_item = f'    {{ v: "{k}", n: "{a.label}", i: "{a.icon}", count: TRACKS.{k}.length }}'
    if f'v: "{k}"' not in s:
        start = s.index(f'{{ g: "{a.group}", items: [')
        end = s.index(" ] },", start)
        anchor = s.find(f'{{ v: "{a.after}",', start, end) if a.after else -1
        if anchor >= 0:
            line_end = s.index("\n", anchor)
            s = s[:line_end] + "\n" + nav_item + "," + s[line_end:]
        else:
            s = s[:end] + ",\n" + nav_item + s[end:]
    # pillar: add the track's ids to the named pillar
    pk = f'{{ k: "{a.pillar}",'
    i = s.index(pk)
    line_end = s.index("\n", s.index("ids:", i))
    line = s[i:line_end]
    if f"TRACKS.{k}" not in line:
        if "ids: TRACKS." in line and ".map(t => t.id)" in line and "[..." not in line:
            first = line[line.index("ids: ") + 5:line.rindex(".map(t => t.id)")]
            new_line = line.replace(f"ids: {first}.map(t => t.id)", f"ids: [...{first}, ...TRACKS.{k}].map(t => t.id)")
        else:
            new_line = line.replace("].map(t => t.id)", f", ...TRACKS.{k}].map(t => t.id)", 1)
        assert new_line != line, "could not extend pillar"
        s = s[:i] + new_line + s[line_end:]
    CT.write_text(s, encoding="utf8")

    meta = load(ROOT / "content" / "meta.json")
    if k not in meta["cats"]:
        cats = {}
        for ck, cv in meta["cats"].items():
            if ck == "code":
                cats[k] = a.cat_label
            cats[ck] = cv
        meta["cats"] = cats
    meta["blurb"][k] = a.blurb
    dump(ROOT / "content" / "meta.json", meta)

    views = load(ROOT / "content" / "views.json")
    views[k] = {"kind": "track", "eyebrow": a.eyebrow, "title": a.title, "lede": a.lede}
    dump(ROOT / "content" / "views.json", views)

    rounds = load(ROOT / "content" / "rounds.json")
    if not any(r.get("draw", {}).get("cats") == [k] for r in rounds):
        n = max(int(r["id"][1:]) for r in rounds) + 1
        idx = [r["id"] for r in rounds].index("m6")          # keep Behavioural last
        rounds.insert(idx, {"id": f"m{n}", "n": a.round_name, "mins": 45, "d": a.round_desc,
                            "draw": {"type": "bank", "cats": [k], "n": 6}})
        dump(ROOT / "content" / "rounds.json", rounds)

    t = RENDER_TEST.read_text(encoding="utf8")
    if f'"/{k}"' not in t:
        t = t.replace('"/swe",', f'"/swe", "/{k}",', 1)
        RENDER_TEST.write_text(t, encoding="utf8")
    print(f"registered track {k}")


if __name__ == "__main__":
    main()
