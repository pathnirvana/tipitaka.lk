# Tipitaka.lk - Buddha Jayanthi Tripitaka and Atuwa

The proofread Buddha Jayanthi Tripitaka (Pali + Sinhala) and Atuwa, served as
* the website https://tipitaka.lk
* offline Android and iOS apps (WebView)
* offline desktop apps (Windows / macOS / Linux)

[Github pages](https://pathnirvana.github.io/tipitaka.lk/) explaining the proofreading process.

**The text lives in [`public/static/text/*.json`](public/static/text) - the ground truth edited by proofreaders.**
Everything else is generated from it. See [dev-docs/architecture.md](dev-docs/architecture.md).

## Quick start (development)
Requirements: Node 22+, Go 1.25+ with a C compiler (cgo), `unzip`.
```
npm ci
unzip -o db/dict.db.zip -x '__MACOSX/*' -d db   # dictionary db (rarely changes)
npm run build:data       # public/static/text/*.json -> db/text.db (validation, tree, search index) ~15 s
npm run build:web        # web app -> web/dist
npm run build:server     # Go server -> server/bin/tipitaka_lk
./server/bin/tipitaka_lk -root-path ..   # http://localhost:8400
npm run dev              # vite dev server with hot reload on :8081 (proxies /api to :8400)
```

## After proofreading changes
* `npm run build:data` validates the text (errors fail; new warnings fail unless accepted with
  `npm run build:data -- --update-baseline`) and rebuilds `db/text.db`. See `db/build-report.md`.
* Deploy with `scripts/deploy.sh` (text-only updates use the same command). CI runs the full validation on every push.

## Tests
`npm test` (unit), `npm run test:full` (full corpus, parity with v2), `npm run test:sqlite-compat`
(Android SQLite 3.9.2), `cd server && go test ./...`, `npm run test:e2e` (Playwright). See [dev-docs/testing.md](dev-docs/testing.md).

## Releases
* Website: `scripts/deploy.sh` - pulls the latest text from GitHub, builds, uploads, tests and switches (see dev-docs/deploy.md).
* Desktop: the `release` workflow builds zips for all platforms (`scripts/release-desktop.sh` for the current one).
* Android: `scripts/android-assets.sh /path/to/Android/Tipitaka.lk` then build the bundle in Android Studio.
  iOS: see [dev-docs/native-bridge.md](dev-docs/native-bridge.md).

**Please check the LICENSE file if you wish to extract any content from the website for redistribution.**
