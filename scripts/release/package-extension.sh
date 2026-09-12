#!/usr/bin/env bash
set -euo pipefail
rm -rf app extension
mkdir -p app
rsync -a --exclude='manifest.json' static/. app/static/
for d in help privacy-policy End-User-License-Agreement; do
  [ -d "$d" ] && cp -R "$d/." "app/$d/" || true
done
cp -R dist/. app/
cp help.html app/ 2>/dev/null || true
cp ZenUML_Sequence_Diagram_addon_help.html app/ 2>/dev/null || true
cp src/detached-window.js app/ 2>/dev/null || true
cp src/icon-*.png app/ 2>/dev/null || true
cp static/manifest.json app/
cp -R app/. extension/
cp static/manifest.json extension/
cp src/extension/options.js extension/
cp src/extension/options.html extension/
cp src/extension/eventPage.js extension/
cp src/extension/script.js extension/
cp static/favicon-128x128.png extension/ 2>/dev/null || true
cp static/icon-*.png extension/ 2>/dev/null || true
rm -rf extension/partials
cd extension && zip -r ../extension.zip . -x "*.DS_Store" && cd ..
