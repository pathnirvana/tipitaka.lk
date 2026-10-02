# Bugs found in the v2 system

Found while planning/implementing v3 (Oct 2026). Status refers to the v3 code.

| Id | Sev | Where (v2) | Problem | v3 status |
|---|---|---|---|---|
| A1 | Critical | server/server.go `/sql-query` | Runs arbitrary client SQL. `?mode=ro` is ignored (no `file:` prefix), so the prod DBs are writable. `dbname` path traversal creates files. No timeout (DoS). The connection map has no bound. | fixed: named read-only queries, `file:` DSN, timeouts, no `/sql-query` |
| A2 | Critical | server/bot-renderer.go:186 `getEntries` | Panics for pali-only or short-sinh pages. With no recover, prod restarts about 3 times a day (journal). | fixed: Go SSR rewritten + recover middleware + fuzz/all-keys tests |
| A3 | High | bot-renderer.go `loadTextFile` | Data race on the `prevDocument` cache. | fixed (code removed) |
| A4 | High | src/store/search.js `runInlineDictQuery`/`runPageDictQuery`; FTS.vue `filterClause` | SQL built by string concatenation. A `'` in the input breaks queries. | fixed: bound / escaped params |
| A5 | High | FTS.vue `filterClause`; TSearch.vue `inFilter` | `LIKE 'an-1%'` / `startsWith('an-1')` also matches an-10 and an-11. | fixed: filter by group |
| A6 | High | FTS.vue `getSearchResults` | `ORDER BY length(offsets)/length(text)` is integer division (≈0), so `LIMIT` keeps an arbitrary subset. | fixed: matchinfo ranking |
| A7 | High | TipitakaTree.vue `watch.$route` | The watcher is disabled by an early `return`, so back/forward don't change the sutta. | fixed: two way route sync |
| A8 | Med | prod | Stale artifacts: sitemap (≈14,939 vs 16,355 nodes); fts.db built 2024-02-17 (466,062 rows vs 466,127). The README describes the obsolete Node/PM2 deploy. | fixed: one build produces db + sitemap; CI validates |
| A9 | Med | Dictionary.vue `getSearchResults` | `errorMessage` is not declared or rendered, so errors are swallowed. | fixed |
| A10 | Low | search.js `processDictRows`; dev/dicts/populate-dict.js | `.sort((a,b) => a > b)` uses a boolean comparator. | fixed |
| A11 | Med | Bookmarks.vue template | Iterates the `text` string character by character, so raw `**`/`{1}` show and there is no styling. | fixed |
| A12 | Med | TextTab.vue `textParts` | Splits on `\|`/`℗`. A literal `\|` in atta-kn-dhp-19.json breaks rendering. | fixed: token parser |
| A13 | Low | TextTab.vue `textParts` | The regexes don't cross `\n` (raw `**` in atta-sn-5 p51). | fixed |
| A14 | Med | tabs.js `addEntryFields` vs tree.js `getKeyForEInd` | Two different entry→sutta mappings. The heading-count one gives the previous sutta's key in heading-at-end collections. | unified on the search rule (report lists differences) |
| A15 | Low | tree.js `syncOpenBranches` | Throws when `#activelabel` isn't rendered. | fixed |
| A16 | Low | tabs.js getters `getShowScanPage`/`getIsAtta` | Throw when there is no active tab. | fixed |
| A17 | Low | tabs.js `normalizeParams` | Error message prints `[object Object]`. | fixed |
| A18 | Low | tabs.js, search.js | Router navigation inside Vuex mutations. | fixed: navigation in composables |
| A19 | Low | store/index.js state | The footnoteMethod default is fixed at the breakpoint seen at store creation. | fixed: first run only |
| A20 | Low | audio.js `loadLabels`/`startEntry` | Assumes LF and a trailing newline. Fractional labels (sn-1-5) are dropped silently. | CRLF fixed; fractional labels still ignored (as v2) |
| A21 | Perf | tree.js, TipitakaTree.vue `created` | The 4 MB tree.json is fetched and made reactive before the first sutta can open. | fixed: tree from db, lazy |
| A22 | Perf | tabs.js `loadTextData` | The whole text file (median 1 MB, max 4 MB) is fetched for one sutta. | fixed: page queries |
| A23 | Perf | fonts, vuetify | 3.5 MB of TTF fonts plus the MDI webfont. Prod ships source maps. No Cache-Control headers. | fixed: woff2, svg icons, cache headers, no source maps |
| A24 | Perf | TextEntry.vue | A `v-menu` per footnote pointer and per hovered entry builds heavy component trees. | fixed: delegated popovers |
| A25 | Med | dev/fts-populate.js; populate-dict.js | The FTS table must be created by hand (not reproducible). The scripts write `server/*.db`, but the runtime reads `db/`. | fixed: build/ creates everything |
| A26 | Med | dev/build-tree.js | A heading-count mismatch silently drops a file's keys. Duplicate keys are overwritten. | fixed: errors |
| A27 | Low | dev/error-check-text.js | Throws when sinh has fewer headings. | fixed (port) |
| A28 | Med | Android MainActivity/WebAppInterface | `setAllowUniversalAccessFromFileURLs(true)`. `runAsync` reflection lets JS call any public method. The 476 MB fts.db is copied out of assets (double storage). Pretty-printed JSON. NULL→"". | partly: minSdk 24, fts.db cleanup; bridge kept by design |
| A29 | Info | bjt tool | Falsy top-level props (`pageOffset: 0`) inherit the previous file's value on load. Save reorders keys and adds `collection` in 15 files. Out of scope. | not in scope (bjt tool) |
| A30 | Info | tipitaka-new server.go | The same writable arbitrary-SQL hole on open.tipitaka.lk. | not fixed (tipitaka-new) |
| A31 | Low | TextEntry.vue CSS | `.centered[level="0"]` never matches because bjt stores level 0 as absent, so 105 entries use the heading font. | fixed |
| A32 | Med | TSearch.vue `getSearchResults` | The query has ZWJ stripped, but 8,536 of 16,355 Sinhala names contain ZWJ, so Sinhala title search misses rakar/yansa words. | fixed |
| A33 | Low | server.go `app.Listen(":8400")` | The desktop server listens on all interfaces, exposing `/sql-query` to the LAN. | fixed: 127.0.0.1 default |
| A34 | Data | corpus | `{එම}` refs without a footnote (anya-vm-12). `<hr/>` (ap-kvu-8, vp-prj-2-3). Stray `</b>` (vp-cv-5). `&gt;` (atta-mn-1). 6 type and 2 level mismatches between pali and sinh. 9 unresolved refs. 183 unreferenced footnotes. 13 files lack `collection`. The validator reports these; nothing is auto-fixed. | reported by the validator |
| A35 | Med | server.go | `/tipitaka-query/version` sends no CORS header, so the desktop app's update check (from the localhost origin to tipitaka.lk) fails. | fixed: CORS |
| A36 | Med | src/store/tabs.js `navigateTabTo` | Prev/next sutta spread the old tab params incl. `eInd`, so the next sutta opened at the previous sutta's position. | fixed |
| A37 | Med | TextTab.vue columns | A pali-only file (ap-pat) opened with `/sinh` hid both columns (empty page). | fixed |
| A38 | Low | public/static/data/tree.json | Committed tree.json was stale (16,355 vs 16,356 nodes, 14 corrected names); the app shipped it. | fixed: tree built from the text at every build |
| A39 | Info | old Android stock WebView | The v2 Vue CLI legacy build targeted `> 1%, last 2 versions`; v3 targets Chrome 53 / Safari 10 explicitly and was verified on Android 7.0. | n/a |
