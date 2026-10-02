#!/usr/bin/env bash
# dev helper: rebuild the app assets + debug APK, reinstall on the running emulator, print the web console log
set -euo pipefail
cd "$(dirname "$0")/.."
ANDROID=${ANDROID:-/Volumes/2TB/Android/Tipitaka.lk}
ADB=${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}
scripts/android-assets.sh "$ANDROID" --debug-dbs >/dev/null
(cd "$ANDROID" && ./gradlew assembleDebug --no-daemon -q 2>&1 | grep -v '^Note' || true)
$ADB install -r "$ANDROID/app/build/outputs/apk/debug/app-debug.apk" | tail -1
$ADB shell am force-stop lk.tipitaka.main; sleep 1; $ADB logcat -c
$ADB shell am start -W -n "lk.tipitaka.main/.MainActivity${1:+ -d $1}" >/dev/null
sleep "${WAIT:-30}"
$ADB logcat -d | grep -E 'LOG_TAG' | grep -v 'Table Name' | tail -25
