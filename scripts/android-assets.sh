#!/usr/bin/env bash
# Copies the web app build, the engine AAR and the databases into the Android project (README-v3.md there;
# tipitaka.app's script).
#   scripts/android-assets.sh [/Volumes/2TB/Android/Tipitaka.lk-v3] [--fixture]
# --fixture: the small test dbs (e2e/fixtures/db) go into the debug assets instead of the full ones.
set -euo pipefail
cd "$(dirname "$0")/.."
APP=${1:-/Volumes/2TB/Android/Tipitaka.lk-v3}
[ -f db/text.db ] && [ -f db/dict.db ] || { echo "build the dbs first (npm run build:data && npm run build:dict)"; exit 1; }
npm run -s build:web:app # a fresh app build: an old web/dist-app would not match the engine and the dbs
bash scripts/build-mobile.sh android
rm -rf "$APP/app/src/main/assets/dist-app" && mkdir -p "$APP/app/src/main/assets" "$APP/app/libs"
cp -R web/dist-app "$APP/app/src/main/assets/dist-app"
cp server/mobile/build/engine.aar "$APP/app/libs/engine.aar"
if [ "${2:-}" = "--fixture" ]; then
  mkdir -p "$APP/app/src/debug/assets/db" && cp e2e/fixtures/db/text.db e2e/fixtures/db/dict.db "$APP/app/src/debug/assets/db/"
else
  mkdir -p "$APP/server_data/src/main/assets/db" && cp db/text.db db/dict.db "$APP/server_data/src/main/assets/db/"
fi
echo "copied web app, engine and dbs to $APP"
du -sh "$APP/app/src/main/assets" "$APP/server_data/src/main/assets" 2>/dev/null || true
