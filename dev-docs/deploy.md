# Deploying

## Website
```
scripts/deploy.sh             # merge the latest text from GitHub, build, upload, test on a spare port, switch, verify
scripts/deploy.sh --rollback  # back to the previous release
scripts/deploy.sh --list      # releases on the server
```
Run on the Mac from the repo. It needs ssh access to `tipitaka.lk` and the linux cross compiler for the cgo build
(`brew install x86_64-unknown-linux-gnu`; `scripts/build-linux.sh`). Text-only updates use the same command - unchanged
files are hard linked from the previous release. A failed upload or staging test removes the unfinished release and
leaves the live site untouched; a failed health check after the switch rolls back automatically.

Server layout: `~/www/tipitaka.lk/releases/<ts>/{tipitaka_lk,dist,db}`, `~/www/tipitaka.lk/current` -> live release,
the last 3 releases are kept. systemd unit: `server/tipitaka_lk.service`; nginx proxies to `127.0.0.1:8400`
(one time setup done by the script on the first deploy, 2026-10-07).

## After the v3 apps are published
Old apps compare their version with `/tipitaka-query/version` (now `v2.0`). Change `-published-version 2.0` to `3.0` in
`server/tipitaka_lk.service`, copy it to `/etc/systemd/system/` on the server, then
`sudo systemctl daemon-reload && sudo systemctl restart tipitaka_lk`.
Around December 2026 remove the `public/static/text` upload from `scripts/deploy.sh` (served for old cached v2 pages).

## Android
`scripts/android-assets.sh /Volumes/2TB/Android/Tipitaka.lk` copies `web/dist-app` and the dbs; then build the app
bundle in Android Studio (branch `v3` of the Android repo: minSdk 24, obsolete fts.db cleanup).
`scripts/android-reload.sh` rebuilds + reinstalls a debug APK on a running emulator.

## iOS
Give the iOS developer `dev-docs/native-bridge.md`, `web/dist-app` (`npm run build:web:app`) and `db/text.db`, `db/dict.db`.

## Desktop
Push a `v*` tag: the `release` GitHub workflow builds zips for linux, macOS (intel/arm) and windows
(`scripts/release-desktop.sh`). Sign/notarize the macOS builds with `server/bin/sign-notorize.sh`.
