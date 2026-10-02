#!/usr/bin/env bash
# Copies the offline web build and the dbs into the Android project (also the layout the iOS app expects).
#   scripts/android-assets.sh [/path/to/Android/Tipitaka.lk] [--debug-dbs]
# --debug-dbs also puts the dbs in app/src/debug/assets so a plain debug APK works without the asset pack.
set -euo pipefail
cd "$(dirname "$0")/.."
ANDROID=${1:-/Volumes/2TB/Android/Tipitaka.lk}
[ -f db/text.db ] || npm run build:data
npm run build:web:app
ASSETS="$ANDROID/app/src/main/assets"
DBASSETS="$ANDROID/dbassets/src/main/assets"
mkdir -p "$ASSETS" "$DBASSETS"
# web app (remove the v2 files: js/ css/ fonts/ and the 340 MB static/text json)
rm -rf "$ASSETS/js" "$ASSETS/css" "$ASSETS/fonts" "$ASSETS/assets" "$ASSETS/static" "$ASSETS/index.html" "$ASSETS/index1.html"
cp -R web/dist-app/. "$ASSETS/"
# databases: text.db replaces fts.db (dict.db is unchanged - keep its version at 2 in web/src/data/source.ts)
rm -f "$DBASSETS/fts.db"
cp db/text.db db/dict.db "$DBASSETS/"
if [ "${2:-}" = "--debug-dbs" ]; then
  mkdir -p "$ANDROID/app/src/debug/assets"
  cp db/text.db db/dict.db "$ANDROID/app/src/debug/assets/"
fi
echo "copied web/dist-app and dbs to $ANDROID (db_version $(node -p "require('./db/build-info.json').db_version"))"
du -sh "$ASSETS" "$DBASSETS"
