#!/bin/sh
# Compile the Drafting Table Tailwind CSS into the design-sync bundle's cssEntry.
# Content covers src/** (the DS + app usage) AND authored previews.
set -e
cd "$(dirname "$0")/.."   # -> web/
OUT=.design-sync/.cache/ds-tailwind.css
mkdir -p .design-sync/.cache
npx tailwindcss -i src/styles/globals.css -o "$OUT" \
  --content './index.html,./src/**/*.{ts,tsx},./.design-sync/previews/**/*.{ts,tsx}'
FONT="@import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap');"
{ echo "$FONT"; cat "$OUT"; } > "$OUT.tmp" && mv "$OUT.tmp" "$OUT"
echo "wrote $OUT ($(wc -c <"$OUT") bytes)"
