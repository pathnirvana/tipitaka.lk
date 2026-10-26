#!/usr/bin/env bash
# Builds the engine for the apps with gomobile (tipitaka.app's script):
#   scripts/build-mobile.sh android   -> server/mobile/build/engine.aar (arm64, armv7, x86_64 emulator)
#   scripts/build-mobile.sh ios       -> server/mobile/build/Engine.xcframework
set -euo pipefail
cd "$(dirname "$0")/../server"
export GOTOOLCHAIN=local
go install golang.org/x/mobile/cmd/gomobile@latest golang.org/x/mobile/cmd/gobind@latest
export PATH="$PATH:$(go env GOPATH)/bin"
gomobile init
mkdir -p mobile/build
case "${1:-android}" in
  android) gomobile bind -target=android/arm64,android/arm,android/amd64 -androidapi 24 -javapkg lk.tipitaka.engine -trimpath \
    -ldflags "-s -w -extldflags=-Wl,-z,max-page-size=16384" -o mobile/build/engine.aar ./mobile ;; # 16 KB pages (Play, Android 15+)
  ios) gomobile bind -target=ios,iossimulator -trimpath -ldflags "-s -w" -o mobile/build/Engine.xcframework ./mobile ;;
  *) echo "usage: $0 android|ios"; exit 1 ;;
esac
ls -la mobile/build
