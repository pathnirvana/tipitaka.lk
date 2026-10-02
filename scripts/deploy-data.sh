#!/usr/bin/env bash
# Text-only update (after proofreading commits): rebuild db/text.db and replace it on the server atomically.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST=${DEPLOY_HOST:-tipitaka.lk}
CUR=${DEPLOY_BASE:-www/tipitaka.lk}/current
npm run build:data
rsync -az --info=progress2 db/text.db "$HOST:$CUR/db/text.db.new"
rsync -az public/static/text/ "$HOST:$CUR/dist/static/text/"
ssh "$HOST" "mv $CUR/db/text.db.new $CUR/db/text.db && sudo systemctl restart tipitaka_lk"
EXPECTED=$(node -p "require('./db/build-info.json').api_hash")
sleep 2
curl -fsS https://tipitaka.lk/api/health | grep -q "$EXPECTED" && echo "text.db deployed ($EXPECTED)" || { echo "health check failed"; exit 1; }
