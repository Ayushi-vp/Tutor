#!/bin/sh
# Assemble the AI Engineer Prep Console from parts/.
#
#   sh src/build.sh
#
# Outputs
#   <project>/ai-prep-console.html   offline build — own doctype, fonts inlined, opens by double-click
#   <project>/src/build/artifact.html  artifact build — host supplies doctype/head, fonts from the CDN
#
# Part order matters: p05/p06 define the topic data, p06b patches depth onto it,
# and p11-p13 read everything above them.
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SRC/.." && pwd)"
P="$SRC/parts"
BODY="p02 p03 p04 p05 p06 p06b p06c p06d p06e p06f p07 p07b p07c p07d p07e p07f p07g p07h p07i p07j p08 p08b p08c p08d p08e p08f p08g p09 p10 p10b p11 p12 p13"

mkdir -p "$SRC/build"

# 1. Artifact build. The claude.ai host wraps this in <!doctype>/<html>/<head>/<body>
#    and a small reset, so it must NOT carry its own. Fonts load from Google Fonts.
{ cat "$P/p01.html" "$P/p01b.html"
  for f in $BODY; do cat "$P/$f.html"; done
} > "$SRC/build/artifact.html"

# 2. Offline build. Standalone document; the 22 woff2 faces are inlined as data
#    URIs so the file has zero external references and works with no network.
{ cat "$P/offline-head.html"
  sed -n '1p' "$P/p01.html"                 # <title> only — skip the CDN font <link>s
  echo '<style>'; cat "$SRC/fonts-inline.css"; echo '</style>'
  sed -n '5,$p' "$P/p01.html"               # the page stylesheet
  cat "$P/p01b.html" "$P/offline-mid.html"
  for f in $BODY; do cat "$P/$f.html"; done
  cat "$P/offline-tail.html"
} > "$ROOT/ai-prep-console.html"

printf 'artifact  %8s bytes  %s\n' "$(wc -c < "$SRC/build/artifact.html")" "src/build/artifact.html"
printf 'offline   %8s bytes  %s\n' "$(wc -c < "$ROOT/ai-prep-console.html")" "ai-prep-console.html"

# Guard the offline promise. The reading-list URLs are content and belong here; a
# stylesheet, script, image or CSS url() pointing off-machine does not.
LOADS=$(grep -oE '<(link|script|img|iframe)[^>]+(href|src)="https?://[^"]*"|url\(https?://[^)]*\)' \
        "$ROOT/ai-prep-console.html" | sort -u || true)
if [ -n "$LOADS" ]; then
  echo "WARNING: offline build loads external resources — it is no longer self-contained:"
  echo "$LOADS" | head
else
  echo "offline build is self-contained (reading-list URLs are content, not loads)"
fi
