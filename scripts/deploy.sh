#!/usr/bin/env bash
# Deploys a full release (web + server + dbs) to the production server.
#   scripts/deploy.sh path/to/tipitaka_lk_linux_amd64     (binary from the release workflow artifact)
# Layout on the server: ~/www/tipitaka.lk/releases/<timestamp>/{tipitaka_lk,dist,db} and a `current` symlink.
# The systemd unit (server/tipitaka_lk.service) runs current/tipitaka_lk.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST=${DEPLOY_HOST:-tipitaka.lk}
BASE=${DEPLOY_BASE:-www/tipitaka.lk}
BIN=${1:?usage: scripts/deploy.sh <linux amd64 binary>}
TS=$(date +%Y%m%d-%H%M%S)
npm run build:data && npm run build:web
REL="$BASE/releases/$TS"
ssh "$HOST" "mkdir -p $REL/db $REL/dist"
PREV=$(ssh "$HOST" "readlink $BASE/current || true")
# --link-dest hard links unchanged files from the previous release (paths are relative to each destination dir)
LINKW=""; [ -n "$PREV" ] && LINKW="--link-dest=../../$(basename "$PREV")/dist"
rsync -az --info=progress2 $LINKW web/dist/ "$HOST:$REL/dist/"
# legacy clients (cached v2 pages) still fetch /static/text/*.json - keep serving them for a while after the cutover
LINKT=""; [ -n "$PREV" ] && LINKT="--link-dest=../../../$(basename "$PREV")/dist/static/text"
rsync -az $LINKT public/static/text/ "$HOST:$REL/dist/static/text/"
LINKD=""; [ -n "$PREV" ] && LINKD="--link-dest=../../$(basename "$PREV")/db"
rsync -az --info=progress2 $LINKD db/text.db db/dict.db "$HOST:$REL/db/"
rsync -az "$BIN" "$HOST:$REL/tipitaka_lk"
ssh "$HOST" "chmod +x $REL/tipitaka_lk && cd $BASE && ln -sfn releases/$TS current.new && mv -T current.new current && sudo systemctl restart tipitaka_lk"
EXPECTED=$(node -p "require('./db/build-info.json').api_hash")
for i in $(seq 1 20); do
  GOT=$(curl -fsS https://tipitaka.lk/api/health 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).api_hash)}catch{}})" || true)
  [ "$GOT" = "$EXPECTED" ] && { echo "deployed $TS (api_hash $GOT)"; exit 0; }
  sleep 2
done
echo "health check failed. rollback: ssh $HOST 'cd $BASE && ln -sfn $PREV current && sudo systemctl restart tipitaka_lk'"
exit 1
