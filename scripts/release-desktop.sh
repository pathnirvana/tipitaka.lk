#!/usr/bin/env bash
# Builds the desktop app zip for the CURRENT platform (cgo + sqlite FTS4 => build natively on each OS;
# .github/workflows/release.yml runs this on linux, macos-intel, macos-arm and windows runners).
#   scripts/release-desktop.sh            -> release/tipitaka_lk_<os>_<arch>.zip
set -euo pipefail
# use the installed Go (go.dev installer in /usr/local/go); fail instead of silently downloading a toolchain
export GOTOOLCHAIN=local
echo "using $(go version)"
cd "$(dirname "$0")/.."
OS=$(go env GOOS); ARCH=$(go env GOARCH)
NAME="tipitaka_lk_${OS}_${ARCH}"
[ -f db/text.db ] || npm run build:data
[ -f web/dist/index.html ] || npm run build:web
EXT=""; [ "$OS" = "windows" ] && EXT=".exe"
OUT="release/$NAME"
rm -rf "$OUT" && mkdir -p "$OUT/db"
(cd server && CGO_ENABLED=1 go build -trimpath -ldflags "-s -w" -o "../$OUT/tipitaka_lk$EXT" .) || { [ "$OS" = darwin ] && bash scripts/build-server.sh && cp server/bin/tipitaka_lk "$OUT/"; }
cp -R web/dist "$OUT/dist"
cp db/text.db db/dict.db "$OUT/db/"
cat > "$OUT/README.txt" <<TXT
Tipitaka.lk offline app. Run tipitaka_lk$EXT and open http://localhost:8400 in your browser.
Optional: put BJT scanned pages in /Pictures/bjt_newbooks (or pass -bjt-path).
TXT
(cd release && rm -f "$NAME.zip" && if command -v zip >/dev/null; then zip -qr "$NAME.zip" "$NAME"; else powershell -Command "Compress-Archive -Path '$NAME' -DestinationPath '$NAME.zip'"; fi)
echo "built release/$NAME.zip"
# macOS signing/notarization: server/bin/sign-notorize.sh
