#!/usr/bin/env bash
# Builds the Windows desktop app (Wails, server/desktop.go) for the Microsoft Store, on this Mac (tipitaka.app's script):
#   scripts/build-desktop.sh windows   -> release/tipitaka_lk-<version>.msix (unsigned: the Store signs it)
#   scripts/build-desktop.sh windows --flavor pitaka   -> release/pitaka_lk-<version>.msix, the pitaka.lk app (web-pitaka,
#     db/pitaka-text.db; MSIX_NAME must be its Partner Center identity name, VERSION its own version)
# The Mac App Store app is built by scripts/build-apple.sh (Xcode signs and uploads it).
# The version is package.json's (VERSION=x.y.z overrides it); every store upload needs a higher one.
# Microsoft Store: the Product identity values of the app in Partner Center (MSIX_NAME, MSIX_PUBLISHER and
#   MSIX_PUBLISHER_DISPLAY override them). The publisher is the Path Nirvana Foundation account of tipitaka.app; the
#   name is the one Partner Center gives when the app's name is reserved (Product management > Product identity).
# Tools: brew install mingw-w64 cmake; makemsix from github.com/microsoft/msix-packaging (makemac.sh --pack),
#   expected in ~/.local/opt/msix/bin (MAKEMSIX=path overrides).
set -euo pipefail
cd "$(dirname "$0")/.."
WHAT=${1:-} FLAVOR=lk
[ "${2:-}" = --flavor ] && FLAVOR=${3:-}
case "$FLAVOR" in
  lk) VERSION=${VERSION:-$(node -p "require('./package.json').version")} # x.y.z (the package adds .0)
    ICONS=server/packaging/icons # scripts/make-icons.mjs
    TEXT_DB=text.db WEB=web BUILD=build:web EXE=tipitaka_lk APP_ID=TipitakaLk DISPLAY=Tipitaka.lk
    PRODUCT=Tipitaka.lk FILE_DESC="Buddha Jayanthi Tipitaka" DESC="පාළි පෙළ, සිංහල පරිවර්තනය, අටුවාව, සජ්ඣායනා සහ ශබ්දකෝෂ"
    RESOURCES='<Resource Language="en-us"/>'
    MSIX_NAME=${MSIX_NAME:-PathNirvanaFoundation.Tipitaka.lk} ;;
  pitaka) VERSION=${VERSION:-3.0.0}
    ICONS=server/packaging/icons-pitaka # scripts/make-pitaka-icons.mjs
    TEXT_DB=pitaka-text.db WEB=web-pitaka BUILD=build:web:pitaka EXE=pitaka_lk APP_ID=PitakaLk DISPLAY="Pitaka.lk ත්‍රිපිටකය"
    PRODUCT=Pitaka.lk FILE_DESC="Sarala Sinhala Tripitaka" DESC="සරල සිංහල ත්‍රිපිටකය – පාළි පෙළ සහ සරල සිංහල පරිවර්තනය"
    RESOURCES='<Resource Language="en-us"/><Resource Language="si"/>'
    [ -n "${MSIX_NAME:-}" ] || { echo "MSIX_NAME: the identity name of the pitaka.lk app in Partner Center"; exit 1; } ;;
  *) echo "unknown flavor $FLAVOR"; exit 1 ;;
esac
OUT=release
[ -f db/$TEXT_DB ] && [ -f db/dict.db ] || { echo "build the dbs first (npm run build:data -- --flavor $FLAVOR && npm run build:dict)"; exit 1; }
export GOTOOLCHAIN=local
npm run -s $BUILD # a fresh web build: an old dist would not match the binary and the dbs
mkdir -p "$OUT"

windows() {
  local name=$MSIX_NAME publisher=${MSIX_PUBLISHER:-CN=BC7CD46E-BF3E-4587-BEED-608011FA908B}
  local publisher_display=${MSIX_PUBLISHER_DISPLAY:-Path Nirvana Foundation}
  local makemsix=${MAKEMSIX:-$HOME/.local/opt/msix/bin/makemsix} dir="$OUT/windows"
  [ -x "$makemsix" ] || { echo "makemsix not found at $makemsix"; exit 1; }
  rm -rf "$dir" && mkdir -p "$dir/db" "$dir/Assets"
  # icon and manifest (per monitor dpi, common controls v6) of the exe; the .syso is only used by windows builds
  (cd server && go run github.com/tc-hib/go-winres@v0.3.3 simply --arch amd64 --out rsrc --icon "../$ICONS/windows/app.ico" \
    --manifest gui --product-name "$PRODUCT" --file-description "$FILE_DESC" --original-filename $EXE.exe \
    --product-version "$VERSION.0" --file-version "$VERSION.0")
  trap 'rm -f server/rsrc_windows_amd64.syso' RETURN
  (cd server && CGO_ENABLED=1 GOOS=windows GOARCH=amd64 CC=x86_64-w64-mingw32-gcc \
    go build -tags desktop,production -trimpath -ldflags "-s -w -H windowsgui -X main.desktopFlavor=$FLAVOR" -o "../$dir/$EXE.exe" .)
  cp "$ICONS"/windows/*.png "$dir/Assets/"
  sed -e "s|__IDENTITY_NAME__|$name|" -e "s|__PUBLISHER__|$publisher|" \
    -e "s|__PUBLISHER_DISPLAY__|$publisher_display|" -e "s|__VERSION__|$VERSION|" -e "s|__DISPLAY_NAME__|$DISPLAY|g" \
    -e "s|__RESOURCES__|    $RESOURCES|" -e "s|__APP_ID__|$APP_ID|" -e "s|__EXE__|$EXE.exe|" -e "s|__DESCRIPTION__|$DESC|" \
    server/packaging/windows/AppxManifest.xml > "$dir/AppxManifest.xml"
  cp -R $WEB/dist "$dir/dist"
  cp db/$TEXT_DB db/dict.db "$dir/db/"
  rm -f "$OUT/$EXE-$VERSION.msix"
  "$makemsix" pack -d "$dir" -p "$OUT/$EXE-$VERSION.msix"
  ls -lh "$OUT/$EXE-$VERSION.msix"
}

case "$WHAT" in
  windows) windows ;;
  *) echo "usage: $0 windows [--flavor pitaka]"; exit 1 ;;
esac
