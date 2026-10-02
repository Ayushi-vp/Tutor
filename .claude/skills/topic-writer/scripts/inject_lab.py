"""Fill placeholders in a topic source from files in a scratch dir.
  {{LAB:file}}  -> HTML-escaped file contents (for code inside <pre>)
  {{RAW:file}}  -> file contents as-is (for generated SVG figures)
Usage: inject_lab.py <source.html> <dir>"""
import html, re, sys
from pathlib import Path
src, base = Path(sys.argv[1]), Path(sys.argv[2])
s = src.read_text(encoding="utf-8")
def rd(name): return (base / name).read_text(encoding="utf-8").rstrip("\n")
s2 = re.sub(r"\{\{LAB:([\w.\-]+)\}\}", lambda m: html.escape(rd(m.group(1)), quote=False), s)
s2 = re.sub(r"\{\{RAW:([\w.\-]+)\}\}", lambda m: rd(m.group(1)), s2)
src.write_text(s2, encoding="utf-8")
print("injected" if s2 != s else "no placeholder")
