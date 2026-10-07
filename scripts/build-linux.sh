#!/usr/bin/env bash
# Cross-compiles the linux amd64 server binary on macOS -> server/bin/tipitaka_lk_linux_amd64
# Needs a linux C cross compiler for cgo (sqlite): brew install x86_64-unknown-linux-gnu (provides x86_64-linux-gnu-gcc)
set -euo pipefail
# use the installed Go (go.dev installer in /usr/local/go); fail instead of silently downloading a toolchain
export GOTOOLCHAIN=local
echo "using $(go version)"
cd "$(dirname "$0")/../server"
CC=${CC:-$(command -v x86_64-linux-gnu-gcc || command -v x86_64-unknown-linux-gnu-gcc || true)}
[ -n "$CC" ] || { echo "no linux cross compiler - brew install x86_64-unknown-linux-gnu"; exit 1; }
mkdir -p bin
CGO_ENABLED=1 GOOS=linux GOARCH=amd64 CC="$CC" go build -trimpath -ldflags "-s -w" -o bin/tipitaka_lk_linux_amd64 .
echo "built server/bin/tipitaka_lk_linux_amd64"
