# Tipitaka.lk - Buddha Jayanthi Tripitaka and Atuwa

The proofread Buddha Jayanthi Tripitaka (Pali + Sinhala) and Atuwa, served as
* the website https://tipitaka.lk
* offline Android and iOS apps (WebView)
* offline desktop apps (Windows / macOS / Linux)

[Github pages](https://pathnirvana.github.io/tipitaka.lk/) explaining the proofreading process.

**The text lives in [`public/static/text/*.json`](public/static/text) - the ground truth edited by proofreaders.**
Everything else is generated from it. See [dev-docs/architecture.md](dev-docs/architecture.md).

## Quick start (development)
Requirements: Node 24+, Go 1.27+ with a C compiler (cgo), tipitaka.app checked out next to this repo (`../cst`, its
`db/dict.db` is the source of the dictionaries).
```
npm ci
npm run build:data       # public/static/text/*.json -> db/text.db (validation, tree, search index) ~15 s
npm run build:dict       # ../cst/db/dict.db -> db/dict.db (English, Sinhala dictionaries, DPD) ~10 s
npm run build:web        # web app -> web/dist
npm run build:server     # Go server -> server/bin/tipitaka_lk
./server/bin/tipitaka_lk  # http://localhost:8400 (localhost, not 127.0.0.1: the recitation CDN allows only that origin)
npm run dev              # vite dev server with hot reload on :8081 (proxies /api to :8400)
```

## After proofreading changes
* `npm run build:data` validates the text (errors fail; new warnings fail unless accepted with
  `npm run build:data -- --update-baseline`) and rebuilds `db/text.db`. See `db/build-report.md`.
* Deploy with `scripts/deploy.sh` (text-only updates use the same command). CI runs the full validation on every push
  to master (proofreaders' corrections).

## Tests
`npm run check` runs everything before a commit (CI only validates the texts). Separately: `npm test` (unit), `npm run test:full` (full corpus, parity with v2), `npm run test:sqlite-compat`
(Android SQLite 3.9.2), `cd server && go test ./...`, `npm run test:e2e` (Playwright). See [dev-docs/testing.md](dev-docs/testing.md).

## Releases
* Website: `scripts/deploy.sh` - pulls the latest text from GitHub, builds, uploads, tests and switches (see dev-docs/deploy.md).
* Apps (tipitaka.app's design: the web app build + the Go engine; dev-docs/native-bridge.md):
  * iOS and macOS (one App Store record, lk.tipitaka.ios): `scripts/build-apple.sh all --upload`, then
    `node scripts/asc-release.mjs listing|build|submit IOS|MAC_OS` and `node scripts/asc-screenshots.mjs IOS|MAC_OS`.
  * Android (lk.tipitaka.main): `scripts/android-assets.sh` (into /Volumes/2TB/Android/Tipitaka.lk-v3), then
    `./gradlew bundleRelease` there.
  * Windows (Microsoft Store): `scripts/build-desktop.sh windows` -> `release/tipitaka_lk-<version>.msix`.
  * Store texts: `release/*/listing.md`; icons `node scripts/make-icons.mjs`; screenshots `node scripts/store-screenshots.mjs`.

**Please check the LICENSE file if you wish to extract any content from the website for redistribution.**
