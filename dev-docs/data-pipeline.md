# Data pipeline

`npm run build:data` (build/cli.ts) - reads `public/static/text/*.json` only, writes:
* `db/text.db`, `db/build-info.json` (`api_hash`, `db_version`, `content_hash`), `db/build-report.md`
* `web/public/static/data/{footnote-abbreviations,file-map}.json`, `web/public/static/sitemap.txt`

Steps: load → **validate** → tree → entry→node mapping → write db.

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
entry(id, file_id, page_idx, entry_idx, node_id, p_type, p_level, p_text, s_type, s_level, s_text, no_audio, key_offset, audio_idx)
footnote(file_id, page_idx, lang, idx, text)
fts USING fts4(content="", text, tokenize=simple)   docid = entry.id*2 + lang (0 pali, 1 sinh)
```
Types: centered 0, heading 1, paragraph 2, gatha 3, unindented 4. Levels as in the JSON (NULL when absent).
`audio_idx` = index among the file's pali entries without `noAudio` (audio label number - 1).

## Fixture corpus
`npm run build:fixture` builds `e2e/fixtures/db/{text,dict}.db` from `e2e/fixtures/text` (truncated copies made by
`e2e/fixtures/make-fixtures.ts`). Used by unit, Go and Playwright tests.

## Dictionary
`npm run build:dict` rebuilds `db/dict.db` from `dev/dicts` (needs the sinhala submodule). Normally the zipped
`db/dict.db.zip` is reused. The Android apps keep dict version 2 unless dict.db changes (`web/src/data/source.ts`).
