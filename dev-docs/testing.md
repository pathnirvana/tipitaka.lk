# Testing

| command | what |
|---|---|
| `npm test` | Vitest: shared modules (markup parser golden vectors, beautify parity with v2 on 2,022 samples x 4 options, search normalisation, FTS query builder, footnotes, routes, queries.sql parser), pipeline on the fixture corpus (tree parity with the unmodified v2 `dev/build-tree.js`, round trip, every named query returns non-NULL rows, validation rules), web data layer and stores (HttpSource, AndroidSource gating, cache, ranking, title search, settings/bookmarks storage compatibility) |
| `npm run test:full` | full corpus: tree parity (16,356 nodes), round trip of all 237,631 entry pairs and 28,812 footnotes, FTS recall vs the v2 index (>95%), dictionary identical to v2 for the same word lists, title search keeps every v2 result |
| `npm run test:sqlite-compat` | every named query + FTS syntax on SQLite 3.9.2 compiled like Android 7 |
| `cd server && go test -race ./...` | API (status codes, caching, gzip, read-only dbs, timeout), SSR, markup golden vectors, legacy endpoints. `FULL=1 go test -run TestSSRAllKeys` renders every key x 5 url forms; `go test -fuzz FuzzSSRPath` |
| `npm run test:e2e` | Playwright on the real Go server with the fixture dbs: desktop chromium/webkit/firefox, Pixel 5, iPhone 12, and `android-sim` (app build + simulated native bridge). Reader, tabs, back/forward, footnotes (4 modes), columns, scans, settings, bookmarks (incl. v2 data), title/content search with filters, dictionary + inline dictionary, audio, SSR without JS, API security, transfer budget |
| `npm run check:css` | built CSS against Chrome 53 / Safari 10 |

Goldens from the v2 system are in `e2e/legacy/goldens` (captured once with `e2e/legacy/capture.mjs`); accepted
differences are in `e2e/legacy/accepted-diffs.md`.

## Measurements (2026-10-02)
* cold deep link `/dn-1-1/sinh`: 322 KB transferred (v2: tree.json 460 KB gz + whole text file 300-760 KB gz + ~3.5 MB fonts/icons)
* initial JS ~115 KB gz (modern build)
* `npm run build:data`: ~15 s, db/text.db 426 MB (v2 shipped 340 MB json + 476 MB fts.db)
* Android app assets: 2.9 MB web + 486 MB dbs (v2: 345 MB + 560 MB)
* Android 7.0 emulator (stock WebView 53): first run db copy ~4 min, reading/search/footnotes/dictionary work

Firefox could not start in the sandboxed development machine (profile folder error); it runs in CI.
