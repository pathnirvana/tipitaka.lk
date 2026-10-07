# Deploying

## Website - one command
```
scripts/deploy.sh             # build data + web + linux binary, upload a release, test it on a spare port, switch, verify
scripts/deploy.sh --rollback  # back to the previous release
scripts/deploy.sh --list
```
* Run from the repo on the Mac. Needs ssh access to `tipitaka.lk` and the linux cross compiler used for the cgo build
  (`brew install x86_64-unknown-linux-gnu` - already installed). `scripts/build-linux.sh` builds the binary.
* The same command deploys text-only updates: unchanged files are hard linked from the previous release and
  `text.db` is delta-transferred.
* sudo asks for your password to restart the service. To avoid that add with `sudo visudo -f /etc/sudoers.d/tipitaka`:
  `janaka ALL=(root) NOPASSWD: /usr/bin/systemctl restart tipitaka_lk`

Server layout: `~/www/tipitaka.lk/releases/<ts>/{tipitaka_lk,dist,db}` and `~/www/tipitaka.lk/current` -> the live
release. The last 3 releases are kept. The v2 files (`~/www/tipitaka.lk/{dist,db,tipitaka_lk_linux_intel}`) are left
untouched - delete them once v3 has run for a while.

## First deploy (what the script does once)
1. Installs `server/tipitaka_lk.service` (runs `current/tipitaka_lk -listen 127.0.0.1:8400`) and reloads systemd.
2. Offers to change nginx (`/etc/nginx/sites-enabled/tipitaka.lk.conf`), with a backup in `/tmp` and `nginx -t`:
   `proxy_pass http://localhost:8400;` -> `proxy_pass http://127.0.0.1:8400; proxy_set_header Host $host;`
   (`localhost` also resolves to `::1` there, where the new server does not listen; the Host header lets the server
   know it is tipitaka.lk). Nothing else in nginx changes - the other sites/locations stay as they are.

## After the v3 apps are published
Change `-published-version 2.0` to `3.0` in `server/tipitaka_lk.service` (old apps then show "update available"),
copy it to `/etc/systemd/system/` and `sudo systemctl daemon-reload && sudo systemctl restart tipitaka_lk`.
Also remove the `public/static/text` upload from `scripts/deploy.sh` after ~2 months (old cached pages).

## Android
`scripts/android-assets.sh /Volumes/2TB/Android/Tipitaka.lk` copies `web/dist-app` and the dbs, then build the app
bundle in Android Studio (branch `v3` of the Android repo: minSdk 24, obsolete fts.db cleanup).
`scripts/android-reload.sh` rebuilds + reinstalls a debug APK on a running emulator.

## Desktop
The `release` GitHub workflow builds zips for linux, macOS (intel/arm) and windows (`scripts/release-desktop.sh`).
Sign/notarize macOS builds with `server/bin/sign-notorize.sh`.
