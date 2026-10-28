#!/usr/bin/env bash
# App Store builds of the iOS and macOS apps (apple/project.yml; tipitaka.app's script), with Xcode on this Mac:
#   scripts/build-apple.sh ios|mac|all            archive + export -> apple/build/export-<target>/ (.ipa / .pkg)
#   scripts/build-apple.sh ios|mac|all --upload   … and upload the packages to App Store Connect (TestFlight)
#   scripts/build-apple.sh pitaka [--upload]      pitaka.lk's iOS app (target Pitaka-iOS, com.pitaka.lk)
# Signing is automatic with the account signed in to Xcode: -allowProvisioningUpdates creates the
# certificates, the app id and the profiles when they are missing (cloud-managed distribution certificates,
# which an App Manager API key may not use, so the key only uploads the signed packages, with altool).
# API key: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (the .p8 file).
# The version is package.json's (VERSION overrides it); BUILD (default: yymmddHHMM) must be new for every upload of a version.
set -euo pipefail
cd "$(dirname "$0")/.."
TEAM_ID=${TEAM_ID:-4456F3J27A} # the Apple developer team (developer.apple.com → Membership)
VERSION=${VERSION:-$(node -p "require('./package.json').version.replace(/\.0$/, '')")} # 3.0.0 -> 3.0
BUILD=${BUILD:-$(date +%y%m%d%H%M)}
export TEAM_ID VERSION BUILD
WHAT=${1:-all} UPLOAD=${2:-}
B=apple/build
if [ "$WHAT" = pitaka ]; then TEXT_DB=pitaka-text.db DB=$B/pitaka/db; else TEXT_DB=text.db DB=$B/db; fi
[ -f "db/$TEXT_DB" ] && [ -f db/dict.db ] || { echo "build the dbs first (npm run build:data && npm run build:dict)"; exit 1; }
export GOTOOLCHAIN=local

mkdir -p "$DB"
cmp -s "db/$TEXT_DB" "$DB/text.db" || cp -c "db/$TEXT_DB" "$DB/text.db" # APFS clone
cmp -s db/dict.db "$DB/dict.db" || cp -c db/dict.db "$DB/dict.db"

if [ "$WHAT" = pitaka ]; then
  npm run -s build:web:pitaka:app
  bash scripts/build-mobile.sh ios
elif [ "$WHAT" != mac ]; then
  npm run -s build:web:app
  bash scripts/build-mobile.sh ios
fi
if [ "$WHAT" = mac ] || [ "$WHAT" = all ]; then
  npm run -s build:web
  # macOS 13 is the minimum of Go 1.27; the flag (not MACOSX_DEPLOYMENT_TARGET) is part of the cgo cache key
  export CGO_LDFLAGS="${CGO_LDFLAGS:-} -mmacosx-version-min=13.0 -framework UniformTypeIdentifiers"
  export CGO_CFLAGS="${CGO_CFLAGS:-} -mmacosx-version-min=13.0 -Wno-deprecated-declarations"
  for arch in arm64 amd64; do
    (cd server && CGO_ENABLED=1 GOARCH=$arch go build -tags desktop,production -trimpath -ldflags "-s -w" \
      -o "bin/desktop_darwin_$arch" .) 2>&1 | grep -v -e 'deprecated' -e 'note:' -e '^ *[0-9]* |' -e '^ *|' || true
  done
  lipo -create -output "$B/tipitaka_lk_universal" server/bin/desktop_darwin_arm64 server/bin/desktop_darwin_amd64
  iconutil -c icns -o "$B/AppIcon.icns" server/packaging/icons/mac/AppIcon.iconset
fi

(cd apple && xcodegen generate --quiet)

ASC_KEY_ID=${ASC_KEY_ID:-CNJQZ82QCH} ASC_ISSUER_ID=${ASC_ISSUER_ID:-177929b9-56d5-4755-88a7-b8a4a017d089}
ASC_KEY_PATH=${ASC_KEY_PATH:-/Volumes/2TB/Android/AuthKey_CNJQZ82QCH.p8}

build() { # target, destination
  local target=$1 dest=$2
  xcodebuild -project apple/Tipitaka.xcodeproj -scheme "$target" -configuration Release -destination "$dest" \
    -archivePath "$B/$target.xcarchive" -allowProvisioningUpdates archive -quiet
  # no symbols for the mac app: its executable is the Go binary, without a dSYM
  cat > "$B/ExportOptions.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>export</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
  <key>uploadSymbols</key><$([ "$target" = Tipitaka-macOS ] && echo false || echo true)/>
</dict></plist>
EOF
  rm -rf "$B/export-$target"
  # the export copies with /usr/bin/rsync, which runs "rsync" from PATH: Homebrew's rejects Apple's options
  PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH" xcodebuild -exportArchive -archivePath "$B/$target.xcarchive" -exportOptionsPlist "$B/ExportOptions.plist" \
    -exportPath "$B/export-$target" -allowProvisioningUpdates -quiet
  local pkg; pkg=$(find "$B/export-$target" -maxdepth 1 \( -name '*.ipa' -o -name '*.pkg' \) | head -1)
  echo "$target $VERSION ($BUILD): $pkg"
  [ "$UPLOAD" = --upload ] || return 0
  xcrun altool --upload-app -f "$pkg" -t "$([ "${pkg##*.}" = ipa ] && echo ios || echo macos)" --api-key "$ASC_KEY_ID" \
    --api-issuer "$ASC_ISSUER_ID" --p8-file-path "$ASC_KEY_PATH" 2>&1 | grep -v -e Progress -e '^$'
}
if [ "$WHAT" = ios ] || [ "$WHAT" = all ]; then build Tipitaka-iOS 'generic/platform=iOS'; fi
if [ "$WHAT" = mac ] || [ "$WHAT" = all ]; then build Tipitaka-macOS 'generic/platform=macOS'; fi
if [ "$WHAT" = pitaka ]; then build Pitaka-iOS 'generic/platform=iOS'; fi
