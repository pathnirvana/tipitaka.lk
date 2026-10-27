#!/usr/bin/env bash
# One command deploy of tipitaka.lk (web app + server + dbs) to the production server.
#
#   scripts/deploy.sh             pull the latest text from github, build, upload a new release, test it on a spare port, switch, verify
#   scripts/deploy.sh --rollback  switch back to the previous release
#   scripts/deploy.sh --list      list the releases on the server
#   scripts/deploy.sh --flavor pitaka [--rollback|--list]   the same for the pitaka.lk reader (https://pitaka.lk/main/,
#                                 service pitaka_lk on port 8403, ~/www/pitaka_lk; nginx is in the pathnirvana/pitaka.lk repo)
#
# Server layout: ~/www/tipitaka.lk/releases/<timestamp>/{tipitaka_lk,dist,db}, ~/www/tipitaka.lk/current -> releases/<ts>
# Unchanged files are hard linked from the previous release, so text-only updates upload little except text.db,
# which goes up zstd-compressed (~430 MB -> ~80 MB) and is unpacked and checked on the server.
# sudo (password) is needed to restart the service; the first deploy also installs the systemd unit and can update nginx.
set -euo pipefail
cd "$(dirname "$0")/.."
# use the Node version in .nvmrc (terminals started from an old VS Code window can still have an older node in PATH)
if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" && nvm use >/dev/null; fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge "$(cat .nvmrc)" ] || { echo "node $(node --version) is too old - run: nvm use (needs $(cat .nvmrc))"; exit 1; }
FLAVOR=lk ACTION=
while [ $# -gt 0 ]; do
  case "$1" in
    --flavor) FLAVOR=${2:-}; shift 2 ;;
    *) ACTION=$1; shift ;;
  esac
done
HOST=${DEPLOY_HOST:-tipitaka.lk}
KEEP=${DEPLOY_KEEP:-3}                          # releases kept on the server
case "$FLAVOR" in
  lk) BASE=${DEPLOY_BASE:-www/tipitaka.lk}      # relative to the remote home
    SITE=${DEPLOY_SITE:-https://tipitaka.lk} SERVICE=tipitaka_lk STAGE_PORT=8499 PORT=8400
    TEXT_DB=text.db BUILD_INFO=db/build-info.json DIST=web/dist ;;
  pitaka) BASE=${DEPLOY_BASE:-www/pitaka_lk}
    SITE=${DEPLOY_SITE:-https://pitaka.lk/main} SERVICE=pitaka_lk STAGE_PORT=8498 PORT=8403
    TEXT_DB=pitaka-text.db BUILD_INFO=db/pitaka-build-info.json DIST=web-pitaka/dist ;;
  *) echo "unknown flavor $FLAVOR (lk or pitaka)"; exit 1 ;;
esac
# the url prefix of the server (pitaka.lk: everything under /main)
PREFIX=$([ "$FLAVOR" = pitaka ] && echo /main || true)
# macOS ships openrsync (no --info=progress2); a homebrew rsync is used when installed (brew install rsync)
RSYNC=$(command -v /opt/homebrew/bin/rsync /usr/local/bin/rsync rsync | head -1)
if "$RSYNC" --version 2>&1 | grep -q openrsync; then PROGRESS=--progress; else PROGRESS=--info=progress2; fi

say() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
remote() { ssh "$HOST" "$@"; }
remote_tty() { ssh -t "$HOST" "$@"; }            # for sudo password prompts

# a db of the release: hard linked from the previous release when identical (sha256), otherwise uploaded as zstd
# (a rebuilt sqlite db has little in common with the old one for rsync's delta transfer) and unpacked on the server
upload_db() {
  local name=$1 prev_db=$2 sum zst
  sum=$(shasum -a 256 "db/$name" | cut -d' ' -f1)
  if [ -n "$prev_db" ] && [ "$(remote "sha256sum $prev_db/$name 2>/dev/null | cut -d' ' -f1")" = "$sum" ]; then
    remote "ln $prev_db/$name $REL/db/$name"
    echo "$name unchanged (hard linked)"
    return
  fi
  zst="db/.upload/$name.$sum.zst"                   # kept until the db changes, so a retried deploy does not recompress
  if [ ! -s "$zst" ]; then
    rm -f db/.upload/"$name".*.zst; mkdir -p db/.upload
    echo "compressing $name ($(du -m "db/$name" | cut -f1) MB) ..."
    zstd -q -T0 -19 --long=27 "db/$name" -o "$zst.part" && mv "$zst.part" "$zst"
  fi
  echo "uploading $name as zstd ($(du -m "$zst" | cut -f1) MB)"
  "$RSYNC" -a --whole-file $PROGRESS "$zst" "$HOST:$REL/db/$name.zst"
  remote "zstd -q -d --long=27 --rm $REL/db/$name.zst -o $REL/db/$name && [ \"\$(sha256sum $REL/db/$name | cut -d' ' -f1)\" = $sum ]" \
    || { echo "$name: unpacking on the server failed or the checksum differs"; exit 1; }
}

# /api/health of the live server: through the public site, or for pitaka.lk on the server itself (nginx and the DNS of
# pitaka.lk may not point at it yet on the first deploys)
health() {
  if [ "$FLAVOR" = pitaka ]; then remote "curl -fsS http://127.0.0.1:$PORT$PREFIX/api/health" 2>/dev/null
  else curl -fsS "$SITE/api/health" 2>/dev/null; fi
}

restart_and_verify() {
  local expected=$1 pid
  pid=$(remote "systemctl show -p MainPID --value $SERVICE")
  remote_tty "sudo systemctl restart $SERVICE"
  for _ in $(seq 1 30); do
    got=$(health | sed -n 's/.*"api_hash":"\([^"]*\)".*/\1/p' || true)
    # a new process (the restart happened) that serves the expected data
    if [ -n "$got" ] && { [ -z "$expected" ] || [ "$got" = "$expected" ]; } && [ "$(remote "systemctl show -p MainPID --value $SERVICE")" != "$pid" ]; then
      echo "live: api_hash $got"; return 0
    fi
    sleep 2
  done
  return 1
}

case "$ACTION" in
  --list) remote "ls -1 $BASE/releases 2>/dev/null; echo current: \$(readlink $BASE/current)"; exit 0 ;;
  --rollback)
    PREV=$(remote "cd $BASE/releases && cur=\$(basename \$(readlink ../current)) && ls -1 | sort | awk -v c=\$cur '\$0 < c' | tail -1")
    [ -n "$PREV" ] || { echo "no previous release"; exit 1; }
    say "rolling back to $PREV"
    remote "cd $BASE && ln -sfn releases/$PREV current.new && mv -T current.new current"
    restart_and_verify "" && exit 0 || { echo "health check failed"; exit 1; } ;;
  "") ;;
  *) sed -n '2,14p' "$0"; exit 1 ;;
esac

say "0/6 getting the latest text from github (other proofreaders' commits)"
if [ -n "$(git status --porcelain -- public/static/text public/static/text-apz)" ]; then
  echo "public/static/text or text-apz has uncommitted changes - commit or stash them first"; exit 1
fi
git fetch origin
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = master ]; then git merge --ff-only origin/master
else git merge --no-edit origin/master || { git merge --abort; echo "merge of origin/master into $BRANCH failed - resolve it by hand"; exit 1; }; fi
git log -1 --format='deploying %h %s (%cr)'

say "1/6 building data, web app and the linux server binary"
[ -z "$(git status --porcelain -- web web-pitaka shared server build)" ] || echo "warning: uncommitted code changes are being deployed"
if [ "$FLAVOR" = pitaka ]; then npm run build:data -- --flavor pitaka && npm run build:web:pitaka
else npm run build:data && npm run build:web; fi
bash scripts/build-linux.sh
API_HASH=$(node -p "require('./$BUILD_INFO').api_hash")

say "2/6 uploading the release"
TS=$(date +%Y%m%d-%H%M%S)
REL="$BASE/releases/$TS"
# hard link unchanged files from the current release, or from the v2 layout on the first deploy
PREV=$(remote "readlink $BASE/current || true")
if [ -n "$PREV" ]; then LDIST="../../$(basename "$PREV")/dist"; PREV_DB="$BASE/releases/$(basename "$PREV")/db"
elif [ "$FLAVOR" = pitaka ]; then LDIST="../../../../tipitaka.lk/current/dist"; PREV_DB="www/tipitaka.lk/current/db" # the first one: tipitaka.lk's dict.db
else LDIST="../../../dist"; PREV_DB="$BASE/db"; fi
remote "mkdir -p $REL/dist $REL/db"
SWITCHED=0
# a failed upload / staging test leaves no half release behind (the live site is not touched before the switch)
trap '[ $SWITCHED = 1 ] || { echo "removing the unfinished release $TS"; ssh "$HOST" "rm -rf $REL"; }' EXIT
"$RSYNC" -az --delete --link-dest="$LDIST" $DIST/ "$HOST:$REL/dist/"
# v2 pages cached in browsers still fetch /static/text/*.json - keep serving them for a while after the switch
[ "$FLAVOR" = pitaka ] || "$RSYNC" -az --link-dest="../../$LDIST/static/text" public/static/text/ "$HOST:$REL/dist/static/text/"
for db in $TEXT_DB dict.db; do upload_db "$db" "$PREV_DB"; done
"$RSYNC" -az server/bin/tipitaka_lk_linux_amd64 "$HOST:$REL/tipitaka_lk"
remote "chmod +x $REL/tipitaka_lk"
# the country database of the statistics (server/geo.go): DB-IP's country lite file of the month, fetched on the
# server once it is out (as tipitaka.app's deploy)
[ "$FLAVOR" = pitaka ] || remote "mkdir -p $BASE/geo && cd $BASE/geo && f=dbip-country-lite-\$(date -u +%Y-%m).csv.gz && { [ -s \$f ] \
  || { curl -fsS -o \$f.part https://download.db-ip.com/free/\$f && mv \$f.part \$f && ln -sfn \$f country.csv.gz \
       && ls -1 dbip-*.csv.gz | grep -vx \$f | xargs -r rm -f; } \
  || { rm -f \$f.part; echo 'geoip: no DB-IP file for this month yet, keeping the last one'; }; }"

say "3/6 testing the new release on port $STAGE_PORT"
if [ "$FLAVOR" = pitaka ]; then
remote "cd $REL && (nohup ./tipitaka_lk -flavor pitaka -no-open -listen 127.0.0.1:$STAGE_PORT < /dev/null > /tmp/pitaka-stage.log 2>&1 & echo \$! > /tmp/pitaka-stage.pid); sleep 2
  ok=1
  curl -fsS http://127.0.0.1:$STAGE_PORT/main/api/health | grep -q '\"api_hash\":\"$API_HASH\"' || ok=0
  curl -fsS http://127.0.0.1:$STAGE_PORT/main/dn-1-1 | grep -q 'id=\"ssr\"' || ok=0
  curl -fsS 'http://127.0.0.1:$STAGE_PORT/main/api/q/tree.node?key=dn-1-1' | grep -q 'dn-1' || ok=0
  curl -fsS http://127.0.0.1:$STAGE_PORT/main/sitemaps/si.xml | grep -q 'https://pitaka.lk/main/dn-1-1<' || ok=0
  curl -fsS http://127.0.0.1:$STAGE_PORT/main/help | grep -q '<div id=\"app\"' || ok=0
  kill \$(cat /tmp/pitaka-stage.pid) 2>/dev/null || true
  [ \$ok = 1 ] || { cat /tmp/pitaka-stage.log; exit 1; }" || { echo "staging test failed - nothing was switched"; exit 1; }
else
remote "cd $REL && (nohup ./tipitaka_lk -no-open -listen 127.0.0.1:$STAGE_PORT < /dev/null > /tmp/tipitaka-stage.log 2>&1 & echo \$! > /tmp/tipitaka-stage.pid); sleep 2
  ok=1
  curl -fsS http://127.0.0.1:$STAGE_PORT/api/health | grep -q '\"api_hash\":\"$API_HASH\"' || ok=0
  curl -fsS http://127.0.0.1:$STAGE_PORT/dn-1-1/sinh | grep -q 'id=\"ssr\"' || ok=0
  curl -fsS 'http://127.0.0.1:$STAGE_PORT/api/q/tree.node?key=dn-1-1' | grep -q 'dn-1' || ok=0
  curl -fsS http://127.0.0.1:$STAGE_PORT/sitemaps/sinh.xml | grep -q '/dn-1-1/sinh<' || ok=0
  curl -fsS http://127.0.0.1:$STAGE_PORT/robots.txt | grep -q 'Sitemap:' || ok=0
  curl -fsS http://127.0.0.1:$STAGE_PORT/help | grep -q '<div id=\"app\"' || ok=0
  kill \$(cat /tmp/tipitaka-stage.pid) 2>/dev/null || true
  [ \$ok = 1 ] || { cat /tmp/tipitaka-stage.log; exit 1; }" || { echo "staging test failed - nothing was switched"; exit 1; }
fi
echo "staging ok"

say "4/6 systemd units (installed when they differ from the server's) and nginx"
if [ "$FLAVOR" = pitaka ]; then
  # the unit, and (once) the passwordless restart of later deploys, as tipitaka_lk has
  "$RSYNC" -az server/pitaka_lk.service "$HOST:$REL/systemd/"
  if ! remote "cmp -s $REL/systemd/pitaka_lk.service /etc/systemd/system/pitaka_lk.service && sudo -n -l /usr/bin/systemctl restart pitaka_lk >/dev/null 2>&1"; then
    echo "installing the pitaka_lk unit and its passwordless restart - sudo password:"
    remote_tty "sudo install -m 644 $REL/systemd/pitaka_lk.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable pitaka_lk \
      && echo 'janaka ALL=(root) NOPASSWD: /usr/bin/systemctl restart pitaka_lk' > /tmp/pitaka_lk.sudoers && sudo visudo -cf /tmp/pitaka_lk.sudoers \
      && sudo install -m 440 /tmp/pitaka_lk.sudoers /etc/sudoers.d/pitaka_lk; rm -f /tmp/pitaka_lk.sudoers"
  fi
else
# the server unit and the watchdog (server/tipitaka_lk*.{service,timer,sh}, same scheme as tipitaka.app). Installing
# needs the sudo password; deploys that do not change the units only need the passwordless restart.
"$RSYNC" -az server/tipitaka_lk.service server/tipitaka_lk_watchdog.service server/tipitaka_lk_watchdog.timer server/tipitaka_lk_watchdog.sh "$HOST:$REL/systemd/"
if ! remote "cd $REL/systemd && cmp -s tipitaka_lk_watchdog.sh /usr/local/bin/tipitaka_lk_watchdog && for f in *.service *.timer; do cmp -s \$f /etc/systemd/system/\$f || exit 1; done"; then
  echo "installing the systemd units (server, watchdog every 2 minutes) - sudo password:"
  remote_tty "cd $REL/systemd && sudo install -m 644 *.service *.timer /etc/systemd/system/ && sudo install -m 755 tipitaka_lk_watchdog.sh /usr/local/bin/tipitaka_lk_watchdog \
    && sudo systemctl daemon-reload && sudo systemctl enable tipitaka_lk && sudo systemctl enable --now tipitaka_lk_watchdog.timer"
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
# the statistics need the visitor's address for the country (server/geo.go: X-Real-IP from nginx on this machine)
if remote "grep -q 'proxy_pass http://127.0.0.1:8400;' $NGINX && ! grep -q 'X-Real-IP' $NGINX"; then
  echo "nginx does not pass the visitor's address (the countries of /stats). Proposed change:"
  echo "    proxy_pass http://127.0.0.1:8400;  ->  proxy_pass http://127.0.0.1:8400; proxy_set_header X-Real-IP \$remote_addr;"
  read -r -p "apply it now? [y/N] " yn
  if [ "$yn" = y ]; then
    remote_tty "sudo cp $NGINX /tmp/tipitaka.lk.conf.bak && sudo sed -i 's#proxy_pass http://127.0.0.1:8400;#proxy_pass http://127.0.0.1:8400; proxy_set_header X-Real-IP \$remote_addr;#' $NGINX && sudo nginx -t && sudo systemctl reload nginx" \
      || { echo "nginx change failed - restoring"; remote_tty "sudo cp /tmp/tipitaka.lk.conf.bak $NGINX"; exit 1; }
  fi
fi
# the password of /stats (any user name): ~/www/tipitaka.lk/stats.env, STATS_PASSWORD=... (made once, kept)
remote "[ -s $BASE/stats.env ] || { umask 077; echo STATS_PASSWORD=\$(head -c 18 /dev/urandom | base64 | tr -d '/+=') > $BASE/stats.env; echo 'made $BASE/stats.env (the /stats password)'; }"
fi

say "5/6 switching to $TS"
SWITCHED=1
remote "cd $BASE && ln -sfn releases/$TS current.new && mv -T current.new current"
if ! restart_and_verify "$API_HASH"; then
  echo "the new release is not healthy - rolling back"
  if [ -n "$PREV" ]; then remote "cd $BASE && ln -sfn $PREV current.new && mv -T current.new current"; remote_tty "sudo systemctl restart $SERVICE"; fi
  exit 1
fi

say "6/6 cleaning up old releases (keeping $KEEP)"
remote "cd $BASE/releases && ls -1 | sort | head -n -$KEEP | xargs -r rm -rf"
echo "deployed $TS. Rollback: scripts/deploy.sh$([ "$FLAVOR" = lk ] || echo " --flavor $FLAVOR") --rollback"
