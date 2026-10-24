#!/bin/sh
# Restarts tipitaka_lk when /api/health does not answer three times in a row (a hung or overloaded server: nginx
# returns 502 but systemd sees a running process). Run as root by tipitaka_lk_watchdog.timer every 2 minutes.
# Install: /usr/local/bin/tipitaka_lk_watchdog (scripts/deploy.sh). Log: journalctl -t tipitaka_lk_watchdog
URL=http://127.0.0.1:8400/api/health
systemctl is-active -q tipitaka_lk || exit 0 # stopped on purpose, or restarting
for i in 1 2 3; do
  curl -fsS -m 10 -o /dev/null "$URL" && exit 0
  sleep 5
done
logger -t tipitaka_lk_watchdog "no answer from $URL three times: restarting tipitaka_lk"
systemctl restart tipitaka_lk
