#!/usr/bin/env bash
# One command deploy of tipitaka.lk (web app + server + dbs) to the production server.
#
#   scripts/deploy.sh             pull the latest text from github, build, upload a new release, test it on a spare port, switch, verify
#   scripts/deploy.sh --rollback  switch back to the previous release
#   scripts/deploy.sh --list      list the releases on the server
#
# Server layout: ~/www/tipitaka.lk/releases/<timestamp>/{tipitaka_lk,dist,db}, ~/www/tipitaka.lk/current -> releases/<ts>
# Unchanged files are hard linked from the previous release, so text-only updates upload little except text.db.
# sudo (password) is needed to restart the service; the first deploy also installs the systemd unit and can update nginx.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST=${DEPLOY_HOST:-tipitaka.lk}
BASE=${DEPLOY_BASE:-www/tipitaka.lk}           # relative to the remote home
SITE=${DEPLOY_SITE:-https://tipitaka.lk}
KEEP=${DEPLOY_KEEP:-3}                          # releases kept on the server
STAGE_PORT=8499

say() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
remote() { ssh "$HOST" "$@"; }
remote_tty() { ssh -t "$HOST" "$@"; }            # for sudo password prompts

restart_and_verify() {
  local expected=$1
  remote_tty "sudo systemctl restart tipitaka_lk"
  for _ in $(seq 1 30); do
    got=$(curl -fsS "$SITE/api/health" 2>/dev/null | sed -n 's/.*"api_hash":"\([^"]*\)".*/\1/p' || true)
    if [ -n "$expected" ] && [ "$got" = "$expected" ]; then echo "live: api_hash $got"; return 0; fi
    if [ -z "$expected" ] && [ -n "$got" ]; then echo "live: api_hash $got"; return 0; fi
    sleep 2
  done
  return 1
}

case "${1:-}" in
  --list) remote "ls -1 $BASE/releases 2>/dev/null; echo current: \$(readlink $BASE/current)"; exit 0 ;;
  --rollback)
    PREV=$(remote "cd $BASE/releases && cur=\$(basename \$(readlink ../current)) && ls -1 | sort | awk -v c=\$cur '\$0 < c' | tail -1")
    [ -n "$PREV" ] || { echo "no previous release"; exit 1; }
    say "rolling back to $PREV"
    remote "cd $BASE && ln -sfn releases/$PREV current.new && mv -T current.new current"
    restart_and_verify "" && exit 0 || { echo "health check failed"; exit 1; } ;;
  "") ;;
  *) sed -n '2,12p' "$0"; exit 1 ;;
esac

say "0/6 getting the latest text from github (other proofreaders' commits)"
if [ -n "$(git status --porcelain -- public/static/text)" ]; then
  echo "public/static/text has uncommitted changes - commit or stash them first"; exit 1
fi
git fetch origin
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = master ]; then git merge --ff-only origin/master
else git merge --no-edit origin/master || { git merge --abort; echo "merge of origin/master into $BRANCH failed - resolve it by hand"; exit 1; }; fi
git log -1 --format='deploying %h %s (%cr)'

say "1/6 building data, web app and the linux server binary"
[ -z "$(git status --porcelain -- web shared server build)" ] || echo "warning: uncommitted code changes are being deployed"
npm run build:data
npm run build:web
bash scripts/build-linux.sh
API_HASH=$(node -p "require('./db/build-info.json').api_hash")

say "2/6 uploading the release"
TS=$(date +%Y%m%d-%H%M%S)
REL="$BASE/releases/$TS"
# hard link unchanged files from the current release, or from the v2 layout on the first deploy
PREV=$(remote "readlink $BASE/current || true")
if [ -n "$PREV" ]; then LDIST="../../$(basename "$PREV")/dist"; LDB="../../$(basename "$PREV")/db"
else LDIST="../../../dist"; LDB="../../../db"; fi
remote "mkdir -p $REL/dist $REL/db"
rsync -az --delete --link-dest="$LDIST" web/dist/ "$HOST:$REL/dist/"
# v2 pages cached in browsers still fetch /static/text/*.json - keep serving them for a while after the switch
rsync -az --link-dest="../../$LDIST/static/text" public/static/text/ "$HOST:$REL/dist/static/text/"
rsync -azc --info=progress2 --link-dest="$LDB" db/text.db db/dict.db "$HOST:$REL/db/" # -c: identical files are hard linked, changed ones delta-transferred
rsync -az server/bin/tipitaka_lk_linux_amd64 "$HOST:$REL/tipitaka_lk"
remote "chmod +x $REL/tipitaka_lk"

say "3/6 testing the new release on port $STAGE_PORT"
remote "cd $REL && (nohup ./tipitaka_lk -no-open -listen 127.0.0.1:$STAGE_PORT < /dev/null > /tmp/tipitaka-stage.log 2>&1 & echo \$! > /tmp/tipitaka-stage.pid); sleep 2
  ok=1
  curl -fsS http://127.0.0.1:$STAGE_PORT/api/health | grep -q '\"api_hash\":\"$API_HASH\"' || ok=0
  curl -fsS http://127.0.0.1:$STAGE_PORT/dn-1-1/sinh | grep -q 'id=\"ssr\"' || ok=0
  curl -fsS 'http://127.0.0.1:$STAGE_PORT/api/q/tree.node?key=dn-1-1' | grep -q 'dn-1' || ok=0
  kill \$(cat /tmp/tipitaka-stage.pid) 2>/dev/null || true
  [ \$ok = 1 ] || { cat /tmp/tipitaka-stage.log; exit 1; }" || { echo "staging test failed - nothing was switched"; remote "rm -rf $REL"; exit 1; }
echo "staging ok"

say "4/6 one time setup: systemd unit and nginx"
if ! remote "systemctl cat tipitaka_lk 2>/dev/null | grep -q 'current/tipitaka_lk'"; then
  echo "installing the v3 systemd unit (runs current/tipitaka_lk on 127.0.0.1:8400)"
  rsync -az server/tipitaka_lk.service "$HOST:/tmp/tipitaka_lk.service"
  remote_tty "sudo cp /tmp/tipitaka_lk.service /etc/systemd/system/tipitaka_lk.service && sudo systemctl daemon-reload"
fi
NGINX=/etc/nginx/sites-enabled/tipitaka.lk.conf
if remote "grep -q 'proxy_pass http://localhost:8400;' $NGINX"; then
  echo "nginx proxies to localhost:8400 (also ::1, where the new server does not listen). Proposed change:"
  echo "    proxy_pass http://localhost:8400;  ->  proxy_pass http://127.0.0.1:8400; proxy_set_header Host \$host;"
  read -r -p "apply it now? [y/N] " yn
  if [ "$yn" = y ]; then
    remote_tty "sudo cp $NGINX /tmp/tipitaka.lk.conf.bak && sudo sed -i 's#proxy_pass http://localhost:8400;#proxy_pass http://127.0.0.1:8400; proxy_set_header Host \$host;#' $NGINX && sudo nginx -t && sudo systemctl reload nginx" \
      || { echo "nginx change failed - restoring"; remote_tty "sudo cp /tmp/tipitaka.lk.conf.bak $NGINX"; exit 1; }
  fi
fi

say "5/6 switching to $TS"
remote "cd $BASE && ln -sfn releases/$TS current.new && mv -T current.new current"
if ! restart_and_verify "$API_HASH"; then
  echo "the new release is not healthy - rolling back"
  if [ -n "$PREV" ]; then remote "cd $BASE && ln -sfn $PREV current.new && mv -T current.new current"; remote_tty "sudo systemctl restart tipitaka_lk"; fi
  exit 1
fi

say "6/6 cleaning up old releases (keeping $KEEP)"
remote "cd $BASE/releases && ls -1 | sort | head -n -$KEEP | xargs -r rm -rf"
echo "deployed $TS. Rollback: scripts/deploy.sh --rollback"
