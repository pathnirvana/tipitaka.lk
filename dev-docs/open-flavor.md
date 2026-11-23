# open.tipitaka.lk flavor: design and plan

Status: agreed design (2026-11-22). Phases 1 to 6 are written on `open-flavor`, not committed; the cut-over itself
(first deploy, nginx, stopping the old server) is the maintainer's to run, see "Cut-over". Written in the
tipitaka-new session; `dev-docs/pitaka-flavor.md` is the template this follows.

## Goal
Offer the BJT Pali to readers who do not read Sinhala script: the same text as tipitaka.lk in the 22 scripts
of `@pnfo/pali-converter` (tipitaka.app's converter), with full-text search, title search, recitation audio
and footnotes. It replaces the 2025 site at open.tipitaka.lk (repo `tipitaka-new`: converter 1.1.0, its own
stale copy of the text, the old audio CDN, search in Sinhala script only, a server that runs SQL sent by the
browser), which is retired.

It is a **third flavor of this repo**, as pitaka.lk is the second: it shares the Go engine, `shared/`, the
db and the deploy, and has its own small web app. tipitaka.lk and pitaka.lk must keep working unchanged.

## Decisions (made by the maintainer, don't revisit without asking)
| Topic | Decision |
|---|---|
| Codebase | Third flavor here (`web-open/`, server `-flavor open`), not a BJT edition inside tipitaka.app and not a standalone repo |
| UI | tipitaka.app style: script picker, `/<script>/<key>` urls, UI strings in several languages |
| Text | The mūla Pali only, from tipitaka.lk's `db/text.db` as it is (no db of its own) |
| At launch | 22 scripts, full-text search, title search, audio, footnotes |
| Not at launch | Translations, dictionary, aṭṭhakathā, scanned pages, desktop and mobile apps |
| Later | Aṭṭhakathā: the `atta-` files already here, then the sinhala-ocr commentary books once they are in this repo |

## Where things stand (phases 1 to 6 written, not committed, not deployed)
- **Server** (`server/flavor.go`): flavor `open` (tipitaka.lk's `text.db`, `web-open/dist`, no legacy endpoints) and
  `withScripts`, which makes `/<script>/x` the page `/x`. `server/open_test.go`.
  - `server/ssr.go`: for this flavor the page carries the reader's data (`ssr-data`) but no article, title or
    canonical link, because the server can't convert the text yet (phase 5).
- **`web-open/`** is built as `web-pitaka/` is: it imports `web/src` (`@/…`) and replaces four modules for every
  importer (`vite.config.ts` OVERRIDES). Its own code is `@o/…`.
  - `shared/beautify.ts` → `overrides/beautify.ts`: every Pali text the `web/src` components show (tree, tab names,
    titles, copies) goes through `beautifyText`, so it is converted there.
  - `components/RichText.ts` → `overrides/RichText.ts`: the reading text. Markup, search highlights and the word
    indexes of the audio timings are worked out on the stored Sinhala text, then each run is converted.
  - `stores/settings.ts`, `composables/storage.ts`: Pali column only, the interface language, own localStorage keys
    (`open.tipitaka.lk-…`).
- **The script is the router's base** (`src/script.ts`, `src/router.ts`): `/thai/dn-1-1` is the route `/dn-1-1` under
  the base `/thai/`, so every path that `web/src` builds keeps working. Choosing another script loads the same page
  under its url (a page load, not a route change). A url without a script goes to the reader's last script (default
  Roman).
- **Roman capitals** (`convertRun` in `src/script.ts`): the converter capitalises the start of a line and of a
  sentence. A run of a paragraph is not a line, so `RichText` tracks whether the next letter starts a sentence. Names
  are not capitalised: the BJT text does not mark them.
- **Reader** (`views/Reader.vue`, `components/Text.vue`, `Entry.vue`, `Footnote.ts`): tipitaka.lk's reader with the
  Pali alone. Kept: tabs, footnotes (hover, click, end of page, hidden), BJT page numbers (plain, no scans),
  bookmarks, links with the script, the chanted word and audio follow. Dropped: Sinhala column, dictionary,
  aṭṭhakathā links, places, word alignments, columns view.
- **Side panel** (`components/SidePanel.vue`, on the right, can be pinned on wide screens): the script (six common
  ones, all 22 on "More"), interface language, theme, text size, footnotes, page numbers, tab view, audio follow, then
  the pages and the links. **To add a link or a page: `LINKS` in `src/site.ts`**, or a `RouterLink` row in the panel.
  The app bar button that opens it shows the script of the page.
- **Interface languages** (`src/i18n`): tipitaka.app's module and its six translation files (si, my, th, kh, hi, ch),
  unchanged so they can be copied again. The 17 strings only this site has are in `open.<lang>.json`, **translated by AI
  (Claude, 2026-11) and not yet checked by a reader of each language**. `i18n.test.ts` fails when a string of the
  interface has no translation in some language.
- **Fonts** (`src/styles/open.css`, `src/assets/fonts`): tipitaka.app's faces and size adjustments, chosen by
  `html[data-script]`. Sinhala keeps tipitaka.lk's fonts. Chakma, Javanese and Balinese have no bundled font (as on
  tipitaka.app).
- **Search** (phase 3; `views/FtsSearch.vue`, `views/TitleSearch.vue`, `components/SearchBox.vue`, `data/query.ts`,
  `data/titles.ts`). Urls: `/<script>/search/<words>/<options>` and `/<script>/titles/<term>`.
  - Full text: the index is tipitaka.lk's (Sinhala script), so each word is converted to it. A word in another script
    or in Roman with diacritics is that word. A Roman word without diacritics is expanded to the spellings that occur
    in the texts (a → a ā, n → n ṇ ṅ ñ, t → t ṭ, d → d ḍ, l → l ḷ, m → m ṃ), checked letter by letter against the
    index vocabulary with the existing `fts.vocab` query. **No new table: the `fts_fold` table of the plan below was
    not needed.** The page lists the spellings it searched.
  - Options: exact word (default: words starting with it), exact phrase, or near each other within N words.
    `AND OR * ^` work as on tipitaka.lk, with the words read as typed.
  - Titles: compared in Roman, without diacritics unless the query has them; suttas known by a common name
    (`shared/sutta-names`) first.
  - Both search the mūla only, filtered by seven collections (`composables/searchFilter.ts`): Vinaya, the five
    nikāyas, Abhidhamma.
- **Tab views**: single, tabs, columns (side by side, each scrolling itself), as tipitaka.app.
- **The other editions** (`composables/editions.ts`):
  - New table `entry_cst(entry_id, key, para)` in `text.db` (`build/cst.ts`, from `dev/cst-map` and the new
    `dev/cst-data/books.tsv`, which `dev/cst-map/export.ts` now writes) and query `text.cst`: the paragraph of
    tipitaka.app an entry starts in, `https://tipitaka.app/<script>/<book key>#p<para>`. 195,566 of 237,630 entries
    have one. **The db must be rebuilt (`npm run build:data`) for this.**
  - Side panel: "Chaṭṭha Saṅgāyana edition" and "BJ Sinhala translation" open the text of the active tab there (the
    sites themselves when no text is open). The menu of a paragraph has both, at that paragraph.
- **Audio** (phase 4): tipitaka.lk's store, recordings and timing files. `components/AudioControl.vue` is the bar with
  translated labels. The chanted word is marked in every script: the words are counted on the stored text and
  converted one by one (`overrides/RichText.ts`). Checked with real recordings in Thai on `localhost:8400`.
  - **CORS**: nothing to do. The R2 bucket answers `access-control-allow-origin: *` for GET and HEAD (checked 2026-11-22
    with the origins `https://open.tipitaka.lk` and `http://127.0.0.1:8404`); the comment in `server/main.go` about
    `localhost:8400` is older than that rule.
- **Sizes and fonts as tipitaka.app** (`styles/open.css`, 2026-11-22): text 18px / 1.65, 760px column, headings 1.6 to 1.1em
  at weight 600, tree 1rem, tab names 0.875rem, snippets 0.98rem; the interface in the system font with the script
  face of the interface language; the root font size follows the text size (`App.vue`, cst `uiFontSize`).
- **Search filter**: tipitaka.lk's dialog (`components/FilterDialog.vue`, `FilterNode.vue`, `composables/searchFilter.ts`)
  over `SEARCH_KEYS`, the mūla parts of `FILTER_KEYS`; one filter per search type, kept in tipitaka.lk's search store.
  Adding the aṭṭhakathā: drop the test in `SEARCH_KEYS`.
- **Search options**: two check boxes (exact word, exact phrase) and the distance; tipitaka.lk and pitaka.lk use the
  same since 2026-11-22 (`web/src/views/FtsSearch.vue`), the link format `/<exact>-<phrase>-<distance>` unchanged.
- **Labels**: the tab strip (`components/TabsBar.vue`), tree rows (`overrides/TreeNode.vue`), theme names, the bookmarks
  and history page (`views/Bookmarks.vue`) and the not-found page are this site's, in the language of the interface.
- **Tests**: `e2e/open.spec.ts` and `e2e/audio.open.spec.ts` (projects `open-desktop`, `open-phone`, server on 8412), in
  `npm run test:e2e` and `scripts/check.sh`; `web-open/src/i18n/i18n.test.ts` in `npm test`.
- **Run it**: `npm run dev:open` (port 8083, proxies `/api` to 8404) or `npm run build:web:open`, with the server
  `server/bin/tipitaka_lk -flavor open -no-open -listen 127.0.0.1:8404`.

- **Phase 5, the server (2026-11-22)**:
  - `server/pali-converter`: git submodule, the Go port of the converter at the commit `package.json` pins (keep the
    two together); `go.mod` replaces the module with it. After a clone: `git submodule update --init`.
  - `server/ssr_open.go`: `/<script>/<key>` is rendered in the script (title, description, canonical, hreflang
    `pi-<Script>` for the 9 `seoScripts` + x-default Roman, JSON-LD, `<article id="ssr">`, `<html lang data-script>`),
    Roman capitals as the web app's `convertRun`. `/<key>` without a script: the data and a canonical link to the Roman
    page. The app removes the article when its text is shown (`App.vue`, `views/Reader.vue`).
  - `flavor.scope` (in `RunNamed`: the api and the pages): no `atta-` / `anya` rows or files, the Sinhala names,
    translation, Sinhala footnotes and `mirror_key` blanked. To add the aṭṭhakathā: `hiddenKeyRe` there and
    `SEARCH_KEYS` in `web-open/src/composables/searchFilter.ts`.
  - Sitemaps: `/sitemaps/<script>.xml` for the `seoScripts` (9,416 urls each).
  - Small screens: one search-kind button (a tap changes the kind), the panel button without a frame, long tree names wrap.
- Phase 6 (old urls, deploy):
  - `server/old_open.go` (before `withScripts`, this flavor only; table in its header, tests `TestOldOpenURLs`):
    `/<script>/book/<n>` (named query `old.book`: BJT book 1 to 57 → its first text), `/<script>/<key>/full`, the
    translation collections (`sin_apz`, `sin_sarala_ai` → pitaka.lk/main, `sin_bjt` → tipitaka.lk), `/help/…`.
  - **Not redirected, decided by the maintainer (2026-11-23):** the old positions `/<script>/<key>/<printed page>-<seq>`.
    They have the shape of ours (`<page_idx>-<entry_idx>`, as tipitaka.lk) with other numbers, so an old link opens the
    right sutta at another paragraph; the url format stays tipitaka.lk's. Also not: the collections `pali` and
    `eng_thani` (those urls are not found).
  - Checked against tipitaka-new's `server-data/text.db`: 9,413 of its 9,414 tree keys are keys here (the other,
    `kn-ps-1-1-16`, is `kn-ps-1-1-17`: `oldKeys`); all 57 `/book/<n>` map to the key the old book table names. 25
    titles differ (corrections). In `kn-ps-1-1` the keys after 16 are one higher here than there, so an old link to
    `kn-ps-1-1-17` … opens the item before the one meant.
  - `scripts/deploy.sh --flavor open`, `server/open_tipitaka_lk.service` (port 8404).

### Cut-over (to run, in this order)
1. Merge the branch; `git submodule update --init`; `npm run build:data` (for `entry_cst`, `fts_fold`).
2. `scripts/deploy.sh` (tipitaka.lk, so its release has the same `text.db`), then `scripts/deploy.sh --flavor open`:
   it uploads the web app and the binary, hard links tipitaka.lk's dbs when they are the same build, tests the release
   on port 8497, installs the unit and starts it on 8404. The old site is still the public one at this point.
3. The same run then shows the proxy lines of `/etc/nginx/sites-enabled/open.tipitaka.lk.conf` (read 2026-11-23: one
   `location / { proxy_pass http://localhost:8401; }`, certbot's ssl lines, nothing else) and offers to change it to
   `127.0.0.1:8404` with the Host and X-Real-IP headers (it restores the file when `https://open.tipitaka.lk/api/health` does not answer with the new build), and
   after that to stop and disable `tipitaka_lk_new`. Answering no leaves both for a later run.
4. Check a few old links (`/sin_apz/dn-1-1`, `/deva/book/10`), submit `/sitemap.xml` in Search
   Console, then remove `~/www/tipitaka_lk_new` on the server and archive the `tipitaka-new` repo on GitHub (its
   `sin_apz` text is already in this repo: `public/static/text-apz`).
   Rollback: `scripts/deploy.sh --flavor open --rollback` for a release; for the cut-over, put port 8401 back in nginx
   and `sudo systemctl enable --now tipitaka_lk_new`.

### Known gaps
- Own icons and web manifest (the page uses tipitaka.lk's favicon).
- The dictionary / names ops of `/api/<op>` still answer for this flavor (the web app does not call them).
- A full-text search request can still name aṭṭhakathā groups (the web app never does): `fts.candidates` is not scoped.
- Sinhala script pages are served as stored, without tipitaka.lk's joined letters, until the app renders them.
- Interface strings of `open.<lang>.json` are machine translated: to be reviewed by readers of each language.
- Two messages of tipitaka.lk's stores are still Sinhala: the notice when a recording can't be loaded
  (`stores/audio.ts`) and the tree's aria-label.
- No help or about page yet (the panel has room for them).
- Footnote pointers keep Western digits while numbers in the text follow the script.
- The tipitaka.app links were built from its router and reader code; not yet tried against the live site.
- The worktree has its own `db/` and `e2e/fixtures/db/` (built from this branch); `db/dict.db` is a link to the main
  checkout's.
- No usage statistics for this site (tipitaka.lk's `-metrics` / `/stats` are not in its unit).

## Design

### Data: reuse `db/text.db` unchanged
- No new database and no new build step. The flavor reads `entry.p_text`, `node.pali`, `footnote` (lang 0),
  and the existing `fts` index with `lang=0`. BJT corrections and future texts reach the site on the next
  tipitaka.lk deploy.
- Aṭṭhakathā/`anya-` are hidden by a flavor setting (`collections: ['mula']`): tree roots, title index,
  FTS groups (`FILTER_KEYS` in `shared/constants.ts`) and SSR/sitemap are limited to it. Turning
  aṭṭhakathā on later is flipping that list plus the mūla↔aṭṭhakathā link UI (`node.mirror_key`,
  `entry_link`).
- Sinhala text never leaves the server for this flavor: add Pali-only variants of the named queries
  (`text.entries`, `tree.*`, `tree.titleIndex`, `fts.texts`) in `server/engine/queries.sql`, or a flavor
  switch that blanks `s_*`/`sinh` columns, so payloads are smaller.

### Script conversion (tipitaka.app standard)
- Use `@pnfo/pali-converter` at the commit tipitaka.lk already pins (v1.4.1); add its Go port as a
  submodule `server/pali-converter`, exactly as cst does, for SSR.
- Port `cst/shared/scripts.ts` (22 scripts, ISO codes, legacy code map) and
  `cst/web/src/composables/script.ts`, with the stored script changed from Roman to **Sinhala**:
  `convertTo(text, script)` = `convert(text, script, 'sinh')` + `beautify`; Sinhala itself only gets
  `beautify`.
- Rendering order: parse markup on the Sinhala text (`shared/markup.ts`) → convert text nodes only → emit.
  Footnote pointers `{n}`, bold, and search-highlight ranges are located **before** conversion.
- Roman output: check proper-name capitalisation (BJT Sinhala has no case); use the converter's
  capitalisation after sentence/heading starts only.

### Search
- **FTS:** any-script input → `convertMixed(q, 'sinh')` → existing `shared/normalize.ts` +
  `shared/fts-query.ts` → `fts.candidates` with `lang=0` and mūla groups. Ranking/snippets stay client-side
  in `web/src/data/fts.ts` (imported, not copied); snippets are converted to the display script last.
- **Roman without diacritics** ("dhamma" is fine, "nibbana" is not): add a small build-time table
  `fts_fold(term, fold)` over the Pali terms in `fts_terms` (fold = Roman, diacritics stripped) and a
  `fts.vocabFold` query; the client expands folded words into the matching Sinhala terms (OR), the same
  way Singlish expansion uses `fts.vocab` today. Additive table; tipitaka.lk ignores it.
- **Title search:** client-side over `tree.titleIndex` (Pali titles only). Build the folded-Roman form of
  each title once after download; match in either Sinhala (converted query) or folded Roman. Reuse
  `web/src/data/title.ts` matching/ranking without the Singlish and Sinhala-alias parts.
- Results UI ported from cst (`SearchBox.vue` with script-aware input font, `FtsResults.vue`,
  `CollectionFilter.vue`), fed by tipitaka.lk's data layer.

### Web app: `web-open/`
- Own `vite.config.ts`, `router.ts`, `App.vue`, settings store, like `web-pitaka/`. Import shared logic
  from `web/src` (`data/source.ts`, `data/fts.ts`, `data/title.ts`, `stores/audio.ts`, `stores/text.ts`,
  `stores/tree.ts`); port UI from `cst/web/src` (ScriptPicker, LanguagePicker, NavPane/TreeDrawer,
  TabsBar, Settings, Home, Help, i18n with en/si/my/th/kh/hi/ch).
- Routes: `/:script`, `/:script/:key/:pos?`, `/:script/search/:q?/:options?`, `/:script/titles/:q?`,
  `/:script/bookmarks|settings|help|about`. Bare `/:key` redirects to the saved script.
- Reader: one Pali column per tab, audio control and follow-along (`AudioControl.vue`), footnotes
  (pointer/inline/hidden as in cst), BJT page numbers, bookmarks, copy link. No Sinhala column, no
  dictionary/tap lookup, no glosses, names, map, scanned pages.
- New localStorage keys (`open.tipitaka.lk-settings-1`, …).
- Fonts for scripts that need them (lana, brah, cakm, etc.) taken from cst.

### Server: `-flavor open`
- Add to `server/flavor.go`: `{name:"open", textDB:"text.db", distDirs:["web-open/dist","dist"],
  site:"https://open.tipitaka.lk", siteName:"Buddha Jayanti Tipitaka", base:""}` plus new fields
  `scripts bool` (a sutta is one page per script) and `collections`.
- SSR (`server/ssr.go`, `markup.go`): render `/<script>/<key>` with the Go converter; title/description,
  canonical, hreflang `pi-<Script>` alternates, JSON-LD, `<article id="ssr">`, `ssr-data` — port from
  `cst/server/ssr.go`/`ssr_pages.go`. Sitemaps per script for the main scripts (cst's `seoScripts` list).
- Disable for this flavor: dict/names/places/glosses ops, legacy endpoints.
- systemd `open_tipitaka_lk.service` on the shared droplet on a free port (8400–8403, 8090, 3000 are
  taken; the old site holds 8401 until cut-over); extend `scripts/deploy.sh` for the flavor.

### Audio
- Same recordings and timing files (`cdn.tipitaka.lk/bjt-audio`), matched by `entry.audio_ph` — unchanged
  because hashes are over the stored Sinhala text.
- CORS: the R2 bucket allows GET from every origin; nothing to add.
- Verify word-level highlight still lines up after conversion (word index from `shared/tokenize` on the
  Sinhala text; apply to converted words by index).

### Old URLs (as planned; what was built is under "Phase 6" above: all in the server, positions not redirected)
- `/<script>/<key>/<page>-<seq>` → `/<script>/<key>/<pageIdx-entryIdx>` (old position is printed page +
  seq; map via `file.page_offset`/`page.page_num`, or drop the position if unmappable).
- `/<script>/book/<n>` → the book's root key. `/search/*` → `/<script>/search`.
- `/sin_apz/…` and any `+`-joined collection containing a translation → `https://pitaka.lk/main/<key>`
  (already specified in `dev-docs/pitaka-flavor.md`); `/sin_bjt/…` → `https://tipitaka.lk/<key>/sinh`.
- Verify the old tree keys (9,414 in tipitaka-new `tree`) all exist in v3 `node.key`; list exceptions.

## Phases
1. **Design doc + skeleton:** `dev-docs/open-flavor.md`; flavor entry; `web-open/` scaffold serving the
   tree and one sutta in a chosen script; npm scripts `dev:open`, `build:web:open`; add to lint/e2e.
2. **Reader:** script conversion pipeline, footnotes, tabs, settings, i18n, bookmarks, fonts.
3. **Search:** FTS with any-script input, `fts_fold` table + query, title search, results UI.
4. **Audio:** player, follow-along, CORS.
5. **Server/SEO:** Go converter submodule, SSR per script, sitemaps, Pali-only queries, collection filter.
6. **Cut-over:** redirects, deploy script + systemd unit, switch nginx for open.tipitaka.lk, archive
   `tipitaka-new` (keep its repo; `server-data/text.db` `sin_apz` is already imported into tipitaka.lk).
7. **Later:** aṭṭhakathā (flip `collections`, add "open alongside"), apps if wanted.

## Verification
- `npm run check` and `npm run test` in tipitaka.lk still pass for the `lk` and `pitaka` flavors.
- Unit tests: Sinhala→script→Sinhala round-trip over all `p_text` for each script (report lossy cases);
  JS vs Go converter output equal on a sample of entries; markup-then-convert keeps footnote pointers and
  highlight ranges; `fts_fold` expansion returns the expected Sinhala terms for a list of folded words.
- Playwright (`e2e/open.spec.ts`, fixture db): open `/latn/dn-1-1`, switch to `thai` and `deva`; search
  "nibbāna", "nibbana", "निब्बान" and "නිබ්බාන" and get the same hit set; title search "brahmajala";
  play audio and see the highlight advance; footnote popup shows converted text.
- SSR: `curl` `/deva/dn-1-1` and check the article body, canonical and hreflang; validate a sitemap.
- Redirect table tested with a sample of old open.tipitaka.lk URLs.
- Manual pass in the browser on desktop and phone widths before cut-over.
