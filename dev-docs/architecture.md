# Architecture (v3)

```
public/static/text/*.json  (ground truth, edited by proofreaders - never written by any build step)
        │  npm run build:data   (build/, Node + better-sqlite3)
        ▼
db/text.db  files, pages, entries (pali+sinhala pairs), footnotes, tree, FTS4 index   + db/dict.db
        │
        ├── Go server (server/)  website + desktop app
        │     GET|POST /api/q/<name>   named read-only queries from server/queries.sql
        │     SSR-lite: title/meta/canonical + <article id="ssr"> + <script id="ssr-data"> for sutta urls
        │     /tipitaka-query/version, /tipitaka-query/bjt-params, /bjt-scanned-pages/* (legacy endpoints)
        └── Android / iOS WebView apps: native bridge window.Android.runSqliteQuery({type, sql});
              the web app inlines the params of the same named query (dev-docs/native-bridge.md)
web/  Vite + Vue 3 + TypeScript + Pinia + Vue Router 4 + Tailwind 3.4
shared/  pure TS used by web, build and tests (markup parser, beautify, search normalisation, queries.sql parser...)
```

## Key decisions
* **Named queries only.** `server/queries.sql` lists every SQL statement. The server never runs client SQL
  (v2 did, and opened the dbs writable - see dev-docs/v2-bugs.md). Params are scalar; lists are one string joined
  with `\x1f` and split in SQL with a recursive CTE. Every output column is non-NULL and integers fit int32
  (Android bridge limits). All SQL must run on SQLite 3.9.2 (Android 7) - `npm run test:sqlite-compat`.
* **One text.db** replaces fts.db + 340 MB of JSON on every platform. The reader fetches only the pages it shows.
  `entry` rows hold the pali/sinhala pair of one entry; `fts` is a contentless FTS4 table (simple tokenizer)
  over `shared/normalize.ts` text with `docid = entry.id * 2 + lang`. Ranking (`matchinfo('x')`), snippets and
  highlights are computed client side from the raw text.
* **Tree from the db.** No 4 MB tree.json download: the drawer loads children on demand, breadcrumbs come
  from `tree.paths*`, the title search downloads `tree.titleIndex` once when used.
* **SSR-lite.** Sutta pages are rendered by Go (`server/markup.go`, same output as `shared/markup.ts`) so text
  is visible before the JS loads and for crawlers; the query results are embedded and pre-fill the client cache.
* **cgo sqlite.** Pure Go drivers (modernc, ncruces) lack FTS4, so the server uses mattn/go-sqlite3; desktop
  builds run natively on each OS in the release workflow.
* **Old devices.** Tailwind 3.4 (v4 needs Safari 16.4/Chrome 111), legacy build for Chrome 53 / Safari 10
  (Android 7 stock WebView), flexbox instead of grid, `npm run check:css`.

## Compatibility contract (do not break)
* URLs: `/`, `/settings`, `/abbreviations`, `/bookmarks`, `/title/:term?`, `/dict/:word?`,
  `/fts/:words?/:options?` (options `exactWord-matchPhrase-wordDistance`), `/:key/:pageIdx-entryIdx?/:pali|sinh?`.
  History mode on the web/desktop, hash mode in the apps (`VITE_APP=1`).
* localStorage keys and shapes: `tipitaka.lk-settings-2`, `tipitaka.lk-search-settings-1`, `tipitaka.lk-bookmarks-1`.
* `/tipitaka-query/version` returns `Tipitaka.lk vX.Y` (old apps compare the number).
* The Android bridge contract (dev-docs/native-bridge.md).

## Source map
| area | files |
|---|---|
| data build | `build/cli.ts`, `corpus.ts`, `validate.ts`, `tree.ts` (exact port of dev/build-tree.js), `entry-nodes.ts`, `write-db.ts` |
| queries | `server/queries.sql`, `shared/queries.ts`, `server/queries.go` |
| server | `server/main.go`, `api.go`, `ssr.go`, `markup.go`, `static.go`, `legacy.go` |
| web data | `web/src/data/source.ts` (HttpSource / AndroidSource / cache), `fts.ts`, `dictionary.ts`, `title.ts` |
| web state | `web/src/stores/*` (settings, tabs, text pages, tree, search, bookmarks, audio, inlineDict) |
| reader | `web/src/components/TextTab.vue`, `EntryCell.vue`, `RichText.ts`, `FootnoteContent.ts` |
