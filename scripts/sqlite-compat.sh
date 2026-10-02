#!/usr/bin/env bash
# Runs every named query (server/queries.sql) and FTS syntax case on SQLite 3.9.2 compiled like Android's
# framework SQLite (API 24): FTS3/FTS4 but WITHOUT FTS3_PARENTHESIS. Needs the fixture db (npm run build:fixture).
set -euo pipefail
cd "$(dirname "$0")/.."
CACHE=scripts/.cache
BIN=$CACHE/sqlite3-3.9.2
if [ ! -x "$BIN" ]; then
  mkdir -p $CACHE
  [ -f $CACHE/sqlite-amalgamation-3090200.zip ] || curl -sSL -o $CACHE/sqlite-amalgamation-3090200.zip https://www.sqlite.org/2015/sqlite-amalgamation-3090200.zip
  (cd $CACHE && unzip -qo sqlite-amalgamation-3090200.zip)
  SYSROOT=""
  if [ "$(uname)" = "Darwin" ]; then # newest macOS SDKs fail to link this old code - use the oldest available
    SDK=$(ls -d /Library/Developer/CommandLineTools/SDKs/MacOSX[0-9]*.sdk 2>/dev/null | sort -V | head -1 || true)
    [ -n "$SDK" ] && SYSROOT="-isysroot $SDK"
  fi
  cc -O1 -w $SYSROOT -DSQLITE_ENABLE_FTS3 -DSQLITE_ENABLE_FTS3_BACKWARDS -DSQLITE_ENABLE_FTS4 -DSQLITE_OMIT_LOAD_EXTENSION \
    -DSQLITE_WITHOUT_ZONEMALLOC $CACHE/sqlite-amalgamation-3090200/shell.c $CACHE/sqlite-amalgamation-3090200/sqlite3.c \
    -o "$BIN" -lpthread -ldl 2>/dev/null || cc -O1 -w $SYSROOT -DSQLITE_ENABLE_FTS3 -DSQLITE_ENABLE_FTS3_BACKWARDS \
    -DSQLITE_ENABLE_FTS4 -DSQLITE_OMIT_LOAD_EXTENSION -DSQLITE_WITHOUT_ZONEMALLOC $CACHE/sqlite-amalgamation-3090200/shell.c \
    $CACHE/sqlite-amalgamation-3090200/sqlite3.c -o "$BIN"
fi
[ -f e2e/fixtures/db/text.db ] || npx tsx build/cli.ts --fixture
SQLITE_OLD="$BIN" npx tsx scripts/sqlite-compat.ts
