#!/bin/sh
# Verify every reading-list URL still resolves.
#
#   sh src/tools/check-links.sh          # all parts
#   sh src/tools/check-links.sh p06b     # one part
#
# Prints any URL that does not return 200 after following redirects. A 403 is
# usually bot-blocking rather than a dead link — open it in a browser before
# deciding. Be patient: it sleeps between requests to stay polite.
set -e
SRC="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-}"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

if [ -n "$TARGET" ]; then FILES="$SRC/parts/$TARGET.html"; else FILES="$SRC/parts/"*.html; fi

# Reading-list URLs are always a complete quoted token in a ref tuple. Matching
# the quotes (rather than everything up to the next one) keeps example URLs
# written inside prose or <code> blocks out of the check.
URLS=$(grep -hoE '"https://[^" ]+"' $FILES | tr -d '"' | grep -v 'fonts\.googleapis\|fonts\.gstatic' | sort -u)
TOTAL=$(printf '%s\n' "$URLS" | grep -c . || true)
echo "checking $TOTAL urls"

FAILED=0
for u in $URLS; do
  # Ask for the first 2 KB only. Some references are large scanned PDFs, and
  # downloading them whole times out and looks like a dead link. Servers that
  # honour Range answer 206; those that ignore it still answer 200.
  code=$(curl -s -o /dev/null -L --max-time 30 -r 0-2047 -A "$UA" -w "%{http_code}" "$u" || echo 000)
  case "$code" in
    200|206) ;;
    *) echo "  $code  $u"; FAILED=$((FAILED + 1)) ;;
  esac
  sleep 0.4
done

if [ "$FAILED" -eq 0 ]; then echo "all $TOTAL resolved"; else echo "$FAILED of $TOTAL need attention"; fi
