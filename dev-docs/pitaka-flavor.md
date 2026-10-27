# pitaka.lk flavor: design and plan

Status: agreed design, not started (2026-10-27). Written in the pitaka.lk session. The implementation happens
in a fresh session started in this repo, on its own branch (`pitaka-flavor`), so that it doesn't disturb
work on master.

## Goal
Build a new pitaka.lk Tipitaka reader for novice (non-scholar) Sinhala readers. It shows the **BJT Pali**
from this repo together with the **simplified Sinhala "sin_apz" translation**. It replaces the 2014-era
"Sarala Sinhala Tipitaka" at `pitaka.lk/main`. It ships as a website and as Android and iOS apps (no
desktop apps).

It is a **second flavor of this repo**, not a fork:
- It shares the Go engine, `shared/`, the data build, the native-app pipeline and the BJT Pali.
- It has its own small web app, its own `text.db` and its own deploy.
- tipitaka.lk itself must keep working unchanged. Every change to shared code is tested against both flavors.

## Decisions (made by the maintainer, don't revisit without asking)
| Topic | Decision |
|---|---|
| Codebase | Second flavor in this repo: a separate web app directory, not `if (pitaka)` sprinkled through `web/` |
| URL | `https://pitaka.lk/main/<key>` (for example `/main/dn-1-1`). Books, dhammapada, pirith, dict and tools stay separate static sites under pitaka.lk; there is no one-stop merge |
| Text | BJT Pali (`public/static/text`) and sin_apz Sinhala. No aṭṭhakathā |
| Coverage at launch | The full BJT tree. Parts with no sin_apz (Vinaya, Abhidhamma, some KN) show **Pali only** with a short "translation coming" note |
| sin_apz ground truth | In this repo, next to the BJT text (see Data). It supersedes the old APZ XML, which is **not** kept here; it stays in github.com/pathnirvana/pitaka.lk-archive (`main/text/sinh-aps`) if ever needed |
| Reading modes | Sinhala only, Pali only, interleaved (Pali paragraph, then its Sinhala), side by side. Side by side is offered only when the screen is wide enough. No tabs and no columns of several suttas |
| Pali script | Sinhala script only |
| Keep | Dictionary on word tap, full-text and title search (with Singlish), audio chanting, map, names and places, themes, bookmarks |
| Dictionaries | Limited to five: `dpd`, `si-buddhadatta` (BU), `si-sumangala` (MS), `en-ncped` (BU English), `en-dppn` (PN) |
| Remove | Footnotes (Pali footnotes are not shown either), scanned pages, abbreviations page, aṭṭhakathā links, glosses, Atta tab, column and tab views, multi-sutta tabs |
| Android | Reuse the existing Play Store app **`lk.pitaka.saralatipitaka`**, so existing users get the new app as an update. It needs the original signing key (open item) |
| iOS | Reuse the existing Sarala Pitaka App Store app (App Store Connect id **1434955293**), so existing users get the new app as an update. Its bundle id needs confirming |
| Old URLs | pitaka.lk `/main?n=<id>` and `/<id>` redirect 301 to `/main/<key>`. open.tipitaka.lk `/sin_apz/<key>` and any `/<colls including sin_apz>/<key>` redirect 301 to `https://pitaka.lk/main/<key>` once open.tipitaka.lk drops its translations |
| Interim | The old pitaka.lk droplet keeps serving the old `/main` until launch. At launch the whole of pitaka.lk moves to the tipitaka.lk droplet |
| After launch | A full quality pass over sin_apz (it was made with an older Gemini), filling the gaps from BJT Pali, BJT Sinhala and the existing APZ |
| Phase 1 branch | The sin_apz import (data, import script, validation) is committed on **master** and pushed right away, so the only copy is backed up and CI validates it. Everything after Phase 1 goes on `pitaka-flavor`, which is branched from a clean master (the maintainer commits pending work first) |
| AI markers | The import strips "(AI)", "[AI]" and the other variants from the text and keeps a per-entry flag. How the UI shows the flag is decided in QA |
| Bad entries | Entries where Gemini copied the Pali instead of translating it, and empty entries, are imported as empty, so the reader shows Pali only for them. The import writes a gaps report for the QA pass |

## Where sin_apz comes from today (read before importing)
- **Pipeline:** `/Volumes/2TB/node/misc-projects/ai-trans/bjt` (repo pathnirvana/misc-projects).
  1. The old APZ XML was chunked by hand: `input-apz/<key>_apz_chunks.json`.
  2. BJT chunk maps: `input/<key>_chunks_map.json`.
  3. `align-apz.js` (gemini-3-pro-preview) produced exactly one Sinhala string per BJT Pali entry:
     `output-apz/<key>-combined.json` (`{"<chunk>": [text…]}`), 108 files.
  4. `sync-json-to-sqlite.js` wrote them into `/Volumes/2TB/node/tipitaka-new/server-data/text.db`, table
     `sin_apz`, keyed `(book_id, page = pageNum + pageOffset, seq = entry index + sequenceStart)`.
- **Alignment is exactly one-to-one:** 70,988 entries, zero mismatches. This is the same page/entry indexing
  as `entry.page_idx/entry_idx` here.
- **misc-projects/ai-trans/bjt may never be committed.** It includes 23 aligned files that exist only on
  disk (an-4, an-5, an-10, an-11 and others). So **this repo's `public/static/text-apz/` becomes the only
  committed copy of sin_apz.** Do the Phase 1 import first, before any other work.
  - The redirect map from that folder is already committed in pathnirvana/pitaka.lk (`nginx/nodeid_mapping.map`).
- **Coverage:** all of DN, MN, SN and AN; KN khp, dhp, ud, iti, snp, vv, pv, thag, thig, jat, ap and bv.
  - Missing: KN cp, mn (Mahāniddesa), nc, ps, nett, petk, mil; all of Vinaya and Abhidhamma.
- **Known quality issues:**
  - No footnotes.
  - Gāthās are stored as paragraphs (24,631 entries).
  - About 1,677 whole-entry AI fill-ins, with inconsistent markers ("(AI)", "[AI]", "AI", "(AI).").
  - The `edit` column is unused.

## Data
- **Ground truth:** `public/static/text-apz/<filename>.json`, one file per BJT text file that has sin_apz, with the
  same filename. Suggested shape (keep it minimal; everything structural comes from the Pali):
  `{ filename, pages: [{ pageNum, entries: [ "text", … ] }] }`.
  - Entry *i* translates Pali entry *i* of the same page.
  - type and level come from the Pali entry. This also fixes the gāthā-as-paragraph issue.
- **One-off import:** a script exports `sin_apz` from tipitaka-new's `text.db`, or the misc-projects combined
  JSON, into that shape. Use the same pageOffset/sequenceStart mapping as `sync-json-to-sqlite.js`.
  - Source: the `output-apz/*-combined.json` files. The db's `edit` column is empty, so the two hold the same
    text. On 2026-10-27 all 108 files matched the current BJT Pali entry counts (70,988 entries). Only kn-pv,
    kn-thig (pageOffset), mn-1-2 and mn-1-3 (sequenceStart) need the offset mapping.
  - AI markers (1,597 entries): strip them and record a per-page list of flagged entry indexes, for example
    `pages[i].ai: [3, 17]`.
  - Copied Pali (about 106 entries contain `{n}` footnote markers; detect Pali more broadly than that) and the
    156 empty entries are written as `""`. They're listed in a gaps report (`dev/apz-import/gaps.tsv` or similar).
  - Extend `deploy.sh`'s uncommitted-text guard to cover `public/static/text-apz`. These files are not served on
    tipitaka.lk.
  - After the import, git *is* the edit overlay: QA fixes are commits to these JSON files, as BJT proofreading is.
- **Build:** `npm run build:data -- --flavor pitaka` (or a separate entry point) writes `db/pitaka-text.db`
  from the same corpus code, with these differences:
  - `s_text/s_type/s_level` come from text-apz. They are empty for entries with no APZ, and the reader then
    shows Pali only for that page or sutta.
  - Validation: a text-apz file must match its Pali entry counts **exactly**. A missing file is allowed.
  - No aṭṭhakathā files or nodes in the tree, and no footnote rows.
  - The `align` table: the BJT word alignments don't apply to APZ (they're hash-checked, so they drop out).
    Leave it empty.
  - FTS over Pali and APZ (same docid scheme `entry.id*2 + lang`), written to its own `db/pitaka-fts.db`.
    tipitaka.lk's `fts.db` is 463 MB, so check this file's size for the apps.
  - Gāthā entries: the Sinhala uses gāthā styling (indentation) but isn't split into lines the way the Pali is.
  - Keep `audio_idx/audio_ph` (the audio is aligned to the Pali entries, so it carries over unchanged).
- **Dictionaries:** the same `db/dict.db`, with lookups limited to the five codes. Keep the full db unless size
  matters for the apps; if it does, build a smaller pitaka dict.db.

## Web app
- **Directory:** `web-pitaka/` (own `vite.config.ts`, router, App.vue, settings store), reusing components from
  `web/src` by import where they fit as they are.
  - Components that need changes for the simple UI are copied and simplified here, not changed in place
    with flags.
  - Shared logic (data source, fts, dictionary, title, names, audio) should be imported, not copied.
- **Base path:** `/main/` on the web (Vite `base`, router history base). The apps keep hash mode
  (`VITE_APP=1`) as now.
- **Routes:** `/main/`, `/main/<key>/<pageIdx-entryIdx>?`, `/main/title/:term?`, `/main/fts/...`,
  `/main/dict/:word?`, `/main/map`, `/main/names/:slug?`, `/main/bookmarks`, `/main/settings`.
  - Keys are the same tree keys as tipitaka.lk and open.tipitaka.lk (`dn-1-1`). Verify that the v3 tree keys
    equal tipitaka-new's for every node in `nodeid_mapping.map` and for every sin_apz node.
- **Reader:** one sutta at a time.
  - Mode picker: Sinhala / Pali / interleaved / side by side. Side by side is hidden or disabled below a width
    threshold, and falls back to interleaved.
  - Pages with no APZ show Pali with a "translation coming" note.
- **Settings (small):** theme, font size, reading mode, audio follow, and the dictionary choice among the five.
  - New localStorage keys (`pitaka.lk-settings-1`, `pitaka.lk-bookmarks-1`). Don't reuse tipitaka.lk's.
- **Removed:** footnotes, scanned pages, abbreviations, aṭṭhakathā links, glosses and the Atta tab,
  tabs/columns, and the column selector.
- **Branding:** pitaka.lk name, logo and colours; help and welcome text written for novices.

## Server
- **Same Go code, run as the pitaka flavor:** a flag or config chooses `db/pitaka-text.db`, the
  `web-pitaka/dist` assets, base path `/main`, SEO strings (titles, canonical `https://pitaka.lk/main/...`,
  sitemaps) and the dictionary subset.
  - One binary with a `-flavor pitaka` flag is simpler than two binaries. Decide this in implementation.
  - SSR-lite must render APZ as the Sinhala, and Pali alone where there's no APZ.
- **Production:** systemd `pitaka_lk.service` on the tipitaka.lk droplet, port **8403**. Ports 8400, 8401,
  8402, 8090 and 3000 are already taken. nginx for pitaka.lk sends `location /main/` to it.
- **Legacy endpoints** (`/tipitaka-query/*`, `/bjt-scanned-pages/*`) are not needed for pitaka.lk.

## Apps
- **Android:** the same pipeline as tipitaka.lk (`scripts/android-assets.sh`, gomobile engine via
  `scripts/build-mobile.sh`), with application id `lk.pitaka.saralatipitaka`.
  - **Open item:** find the old app's signing keystore. Without it the listing can't be updated.
  - `.well-known/assetlinks.json` in the pitaka.lk repo already lists `lk.pitaka.saralatipitaka`.
- **iOS:** `scripts/build-apple.sh` pipeline, publishing to the existing Sarala Pitaka App Store record
  (App Store Connect id 1434955293), with that record's bundle id. Add `apple-app-site-association` to
  pitaka.lk if universal links are wanted.

## Redirects at launch
- **pitaka.lk nginx** (the vhost lives in the pathnirvana/pitaka.lk repo):
  - `/main?n=<id>` and `/<id>[/...]` go to `/main/<key>`, using `nginx/nodeid_mapping.map` in the pitaka.lk
    repo (identical to the live map). Change the redirect target in `nginx/pitaka.lk.conf` there.
  - Unmapped ids go to `/main/`.
  - **Known gaps in the map:** the 754 four-digit vagga ids, about 409 DN subhead ids, SN 23, and books 52–54.
    Map vagga ids to their first sutta, or to the vagga key if v3 has one.
- **open.tipitaka.lk nginx** (on this droplet): `/sin_apz/<key>` and `/<colls>/<key>`, where colls contains
  `sin_apz`, go 301 to `https://pitaka.lk/main/<key>`. Do this when open.tipitaka.lk removes its translations
  (in the tipitaka-new codebase; note its arbitrary-SQL hole, v2-bugs A30).

## Phases
1. Import sin_apz into `public/static/text-apz/`, with validation (counts and coverage report).
2. Data build flavor: `db/pitaka-text.db`, with tests (entry counts, FTS over APZ, no aṭṭhakathā/footnotes).
3. Server flavor and SSR-lite, with `go test`.
4. `web-pitaka/`: reader with the 4 modes, tree, title and full-text search, dictionary (5 dicts), audio, map,
   names, bookmarks, settings, themes. Unit tests plus Playwright for the reading modes and the narrow-screen
   fallback.
5. Deploy on the tipitaka.lk droplet (`/main/` only, behind nginx), then switch pitaka.lk DNS and move the
   static sites (see the pitaka.lk repo plan).
6. Android (reusing the id) and iOS releases.
7. After launch: the sin_apz QA and gap-fill pass.

## Verification
- `npm run check` stays green for tipitaka.lk. The pitaka flavor gets its own data, server and e2e checks.
- Spot-check that suttas in each nikaya open at `/main/<key>`, that the Sinhala matches open.tipitaka.lk's
  sin_apz, and that non-APZ parts show Pali only.
- Every line of `nodeid_mapping.map` redirects to a page that exists. Sample `/sin_apz/<key>` redirects from
  open.tipitaka.lk.
- Lighthouse/mobile check of the reader on a narrow phone, including the side-by-side fallback.

## Open items
- The signing keystore for `lk.pitaka.saralatipitaka`.
- Confirm the iOS bundle id of App Store app 1434955293, and that the Apple account can still publish to it.
- How to mark AI fill-ins in the UI (decide during QA).
- Whether the apps can ship the full `dict.db` or need a pitaka subset.
