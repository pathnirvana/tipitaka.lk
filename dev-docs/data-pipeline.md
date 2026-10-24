# Data pipeline

`npm run build:data` (build/cli.ts) - reads `public/static/text/*.json` and `dev/alignments/*.json` only, writes:
* `db/text.db`, `db/build-info.json` (`api_hash`, `db_version`, `content_hash`), `db/build-report.md`
* `web/public/static/data/{footnote-abbreviations,file-map}.json`, `web/public/static/sitemap.txt`

Steps: load → **validate** → tree → entry→node mapping → write db (with the fresh alignments).

## Validation (build/validate.ts)
Errors fail the build: filename/bookId/pageOffset, page number order (step 2, 1 for ap-pat), pali/sinh entry counts,
heading alignment and counts, keyOffset only on headings, unknown types. Warnings (unbalanced `**`, unresolved or unused
footnotes, html-like characters, pali/sinh type mismatches, missing collection) are listed in the report and frozen in
`build/validation-baseline.json`; only new warnings fail. Accept them with `npm run build:data -- --update-baseline`.

## Tree
`build/tree.ts` is an exact port of `dev/build-tree.js` (tests run the unmodified v2 script and compare). Node ids are the
v2 DFS order (`src/store/tree.js` sort). `node.grp` / `file.grp` = index in `FILTER_KEYS` (search filters).
`node.mirror_key` = the atuwa/mula counterpart if it exists.

## Entry → sutta
Same rule as v2 `getKeyForEInd`: the last node (DFS order) of the same file starting at or before the entry.
The report lists entries where v2's heading-count rule gave a different key (heading-at-end collections).

## Schema (`build/write-db.ts`)
```
meta(k, v)                                      schema_version, content_hash, api_hash, db_version, git_commit, built_at
file(id, name, book_id, page_offset, collection, pali_only, grp, page_count)
page(file_id, page_idx, page_num)
node(id = DFS order, key, parent_id, level, pali, sinh, file_id, page_idx, entry_idx, grp, child_count, mirror_key)
entry(id, file_id, page_idx, entry_idx, node_id, p_type, p_level, p_text, s_type, s_level, s_text, no_audio, key_offset, audio_idx, audio_ph)
footnote(file_id, page_idx, lang, idx, text)
align(entry_id, links, pu, sa, src)               schema 2: pali-sinhala word alignments, see below
fts USING fts4(content="", text, tokenize=simple)   docid = entry.id*2 + lang (0 pali, 1 sinh)
```
Types: centered 0, heading 1, paragraph 2, gatha 3, unindented 4. Levels as in the JSON (NULL when absent).
`audio_idx` = index among the file's pali entries without `noAudio` (audio label number - 1).
`audio_ph` = sha1-12 of the chanted entry's text: the recordings' timing files (`<label>.json`) name their paragraphs by it.

## Alignments (build/align.ts, schema 2)
`dev/alignments/<file>.json` (format `bjt-align/1`, described in `dev/alignments/README.md`) links Pāḷi words to the
Sinhala words that render them. Word numbers index `tokenize()` of `shared/tokenize.ts` (tokenizer v1) on the raw
entry text; the web renders words with the same numbers (`RichText` `indexWords`, `data-w`). A record enters the `align`
table only when its text hashes match the current entry texts and all its word numbers exist; the report lists per file
the fresh, stale (text changed since aligning: realign these) and invalid records. The store's content hash is part of
`api_hash`. `src`: 1 model, 2 Opus, 3 reviewer, 4 rule. Fetched by the `text.align` query only while the alignment
view setting is on.

## Fixture corpus
`npm run build:fixture` builds `e2e/fixtures/db/{text,dict}.db` from `e2e/fixtures/text` (truncated copies made by
`e2e/fixtures/make-fixtures.ts`) and `e2e/fixtures/alignments`. Used by unit, Go and Playwright tests.

## Dictionary
`npm run build:dict [-- <tipitaka.app db/dict.db>]` builds `db/dict.db` from tipitaka.app's dictionary db (default
`../cst/db/dict.db`, same schema; its build and daily upstream sync pin and update the sources): the English and
Sinhala dictionaries (`LK_DICTS` in `build/dict.ts`), their abbreviations, PCED's word breakups, all DPD headwords and
roots, and DPD's inflection / deconstruction lookup for the word forms of tipitaka.lk's texts (~430k of DPD's 1.2M).
Words are Roman; the web app converts with `@pnfo/pali-converter` (lossless for every word of the texts). References
to tipitaka.app's paragraphs are unwrapped. Rebuild after a text change that adds words. dict.db is not in git (like
text.db); the deploy uploads the local one. The e2e fixture dictionary is cut from it (`npm run build:fixture`), so tests
run locally (`npm run check`). The Android apps keep their dict db until the engine release (`web/src/data/source.ts`).

Full text search in singlish: `fts_terms` (fts4aux over `fts`, no storage) is the index vocabulary; `fts.vocab`
keeps the singlish library's spellings that occur (`web/src/data/fts.ts expandSinglish`) and the MATCH ORs them at
the top level (`shared/fts-query.ts buildMatchSlots`).
