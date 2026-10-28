#!/usr/bin/env bash
# Copies the web app build, the engine AAR and the databases into the Android project (README-v3.md there;
# tipitaka.app's script).
#   scripts/android-assets.sh [--flavor pitaka] [<project folder>] [--fixture]
# The project: /Volumes/2TB/Android/Tipitaka.lk-v3 (lk.tipitaka.main), with --flavor pitaka
# /Volumes/2TB/Android/SaralaTipitaka-v3 (lk.pitaka.saralatipitaka: web-pitaka, db/pitaka-text.db as text.db).
# --fixture: the small test dbs (e2e/fixtures/db) go into the debug assets instead of the full ones.
set -euo pipefail
cd "$(dirname "$0")/.."
FLAVOR=lk APP='' FIXTURE=''
while [ $# -gt 0 ]; do
  case "$1" in
    --flavor) FLAVOR=$2; shift ;;
    --fixture) FIXTURE=1 ;;
    *) APP=$1 ;;
  esac
  shift
done
case "$FLAVOR" in
  lk) APP=${APP:-/Volumes/2TB/Android/Tipitaka.lk-v3} TEXT_DB=text.db WEB=web BUILD=build:web:app DATA='' ;;
  pitaka) APP=${APP:-/Volumes/2TB/Android/SaralaTipitaka-v3} TEXT_DB=pitaka-text.db WEB=web-pitaka BUILD=build:web:pitaka:app DATA=' -- --flavor pitaka' ;;
  *) echo "unknown flavor $FLAVOR"; exit 1 ;;
esac
[ -f "db/$TEXT_DB" ] && [ -f db/dict.db ] || { echo "build the dbs first (npm run build:data$DATA && npm run build:dict)"; exit 1; }
npm run -s "$BUILD" # a fresh app build: an old dist-app would not match the engine and the dbs
bash scripts/build-mobile.sh android
rm -rf "$APP/app/src/main/assets/dist-app" && mkdir -p "$APP/app/src/main/assets" "$APP/app/libs"
cp -R "$WEB/dist-app" "$APP/app/src/main/assets/dist-app"
cp server/mobile/build/engine.aar "$APP/app/libs/engine.aar"
if [ -n "$FIXTURE" ]; then
  mkdir -p "$APP/app/src/debug/assets/db" && cp "e2e/fixtures/db/$TEXT_DB" "$APP/app/src/debug/assets/db/text.db" \
    && cp e2e/fixtures/db/dict.db "$APP/app/src/debug/assets/db/"
else
  mkdir -p "$APP/server_data/src/main/assets/db" && cp "db/$TEXT_DB" "$APP/server_data/src/main/assets/db/text.db" \
    && cp db/dict.db "$APP/server_data/src/main/assets/db/"
fi
echo "copied web app, engine and dbs ($FLAVOR) to $APP"
du -sh "$APP/app/src/main/assets" "$APP/server_data/src/main/assets" 2>/dev/null || true
