#!/usr/bin/env bash
# Builds the Go server for the current platform -> server/bin/tipitaka_lk
# (mattn/go-sqlite3 needs cgo: pure Go sqlite drivers lack the FTS4 module used by text.db)
set -euo pipefail
# use the installed Go (go.dev installer in /usr/local/go); fail instead of silently downloading a toolchain
export GOTOOLCHAIN=local
echo "using $(go version)"
cd "$(dirname "$0")/../server"
mkdir -p bin
if ! CGO_ENABLED=1 go build -o bin/tipitaka_lk . 2>/tmp/tipitaka-go-build.log; then
  if [ "$(uname)" = "Darwin" ]; then # some macOS beta SDKs fail to link cgo - retry with the oldest SDK installed
    SDK=$(ls -d /Library/Developer/CommandLineTools/SDKs/MacOSX[0-9]*.sdk 2>/dev/null | sort -V | head -1 || true)
    echo "retrying with SDKROOT=$SDK"
    SDKROOT="$SDK" CGO_ENABLED=1 go build -o bin/tipitaka_lk . 2>&1 | grep -v "ld: warning" || true
  else
    cat /tmp/tipitaka-go-build.log; exit 1
  fi
fi
ls -la bin/tipitaka_lk
