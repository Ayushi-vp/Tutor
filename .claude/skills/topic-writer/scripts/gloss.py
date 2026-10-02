"""Add glossary entries to a topic source's meta block and re-sort alphabetically.
Usage: gloss.py <source.html> "Term|Definition" ["Term|Definition" ...]"""
import json, re, sys
from pathlib import Path
p = Path(sys.argv[1]); s = p.read_text(encoding="utf-8")
m = re.search(r'(<script type="application/json" id="meta">\s*)(.*?)(\s*</script>)', s, re.S)
meta = json.loads(m.group(2))
have = {t.lower() for t, _ in meta["glossary"]}
for a in sys.argv[2:]:
    t, d = a.split("|", 1)
    if t.lower() not in have: meta["glossary"].append([t, d])
meta["glossary"].sort(key=lambda x: re.sub(r"[^a-z0-9 ]", "", x[0].lower()))
s = s[:m.start(2)] + json.dumps(meta, indent=2, ensure_ascii=False) + s[m.end(2):]
p.write_text(s, encoding="utf-8"); print(len(meta["glossary"]), "terms")
