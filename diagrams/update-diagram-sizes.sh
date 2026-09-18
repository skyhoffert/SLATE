#!/bin/sh
# Syncs slate-diagram-sizes.js's DIAGRAM_SIZES with the actual
# `new Circuit(w, h)` call in each diagrams/*.html file - adds entries for
# new diagrams, removes entries for diagrams that no longer exist, and fixes
# any size that's drifted out of sync with its file. Run after creating a
# new diagram or resizing an existing one.
#
# Usage: diagrams/update-diagram-sizes.sh

set -e

cd "$(dirname "$0")"

out="slate-diagram-sizes.js"
tmp="${out}.tmp"

{
  echo "// Native pixel size of each diagrams/*.html file, i.e. the (w, h) passed to"
  echo "// \`new Circuit(w, h)\` in that file - lets <slate-diagram src=\"...\"> know its"
  echo "// aspect ratio without needing same-origin access into the iframe (which"
  echo "// file:// blocks). Keep in sync by running diagrams/update-diagram-sizes.sh."
  echo "const DIAGRAM_SIZES = {"
  for f in *.html; do
    [ -f "$f" ] || continue
    dims=$(grep -o 'new Circuit([0-9]*, *[0-9]*)' "$f" | head -n1 | grep -o '[0-9]*' | tr '\n' ' ')
    if [ -z "$dims" ]; then
      echo "warning: $f has no \`new Circuit(w, h)\` call, skipping" >&2
      continue
    fi
    w=$(echo "$dims" | awk '{print $1}')
    h=$(echo "$dims" | awk '{print $2}')
    echo "  'diagrams/${f}': [${w}, ${h}],"
  done
  echo "};"
} > "$tmp"

mv "$tmp" "$out"
echo "Updated $out"
