# Deploying

## Website (first v3 deploy)
1. Get the linux amd64 server binary: run the `release` workflow (artifact `desktop-ubuntu-latest` contains
   `tipitaka_lk`), or build on a linux machine with `scripts/release-desktop.sh`.
2. `scripts/deploy.sh path/to/tipitaka_lk` - builds data + web, uploads to `~/www/tipitaka.lk/releases/<ts>`,
   flips `~/www/tipitaka.lk/current`, restarts the service and waits for `/api/health` to report the new `api_hash`.
3. One time only: install the new unit (it runs `current/tipitaka_lk` and listens on 127.0.0.1:8400) -
   `sudo cp server/tipitaka_lk.service /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl restart tipitaka_lk`.
   nginx keeps `proxy_pass http://localhost:8400` unchanged.
4. After the new Android / desktop builds are published, change `APPNAME` in `server/main.go` if needed - old apps
   compare the number in `/tipitaka-query/version` with their own (v2 apps are 2.0, so 3.0 tells them to update).
5. `dist/static/text/*.json` is deployed for old cached v2 pages; drop it from `scripts/deploy.sh` after ~2 months.

Rollback: `ssh tipitaka.lk 'cd www/tipitaka.lk && ln -sfn releases/<previous> current && sudo systemctl restart tipitaka_lk'`.

## Text-only updates
`scripts/deploy-data.sh` rebuilds and replaces `db/text.db` (atomic rename + restart).

## Android
`scripts/android-assets.sh /Volumes/2TB/Android/Tipitaka.lk` copies `web/dist-app` and the dbs, then build the app
bundle in Android Studio (branch `v3` of the Android repo: minSdk 24, obsolete fts.db cleanup).
`scripts/android-reload.sh` rebuilds + reinstalls a debug APK on a running emulator (uses `--debug-dbs`).

## Desktop
The `release` workflow builds zips for linux (amd64/arm64), macOS (intel/arm) and windows.
Sign/notarize macOS builds with `server/bin/sign-notorize.sh`.
