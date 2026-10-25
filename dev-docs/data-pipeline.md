# Data pipeline

`npm run build:data` (build/cli.ts) - reads `public/static/text/*.json`, `dev/alignments/*.json`, `dev/cst-map/*.json`
and `dev/cst-data/*.tsv` only, writes:
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
entry_link(mula, atta, src)                       mūla entry <-> aṭṭhakathā entry (src 1 paragraph number, 2 lemma)
entity(id, slug, type, name, name_fold, lemma, family, meaning, lat, lon, prec, mentions, settings)   places, people...
node_setting(node_id, entity_id, role, ord, source, conf, listed)   place / teacher / with / about of a sutta
entry_mention(entry_id, entity_id, amb)           the names in an entry
gloss(id, conf, src, a_entry, a_w, a_eentry, a_ew, x_entry, x_w, m_entry, m_w, m_eentry, m_ew)
                                                  an aṭṭhakathā lemma (a..ae), the last word of its explanation (x) and
                                                  the mūla words it quotes (m..me); entry ids, shared/tokenize word numbers
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

## tipitaka.app data: commentary links and words, places and people (build/cst.ts)
tipitaka.app (`../cst`, VRI's CST texts) links each aṭṭhakathā paragraph to the mūla paragraph it explains, aligns the
commentary's lemmas with the mūla words they quote (glosses, its dev-docs/alignments.md) and knows the places, people
and settings of the suttas. tipitaka.lk uses them through a map of its entries to CST paragraphs:
* `npx tsx dev/cst-map/map.ts [files...]` - aligns the words of each lk file with the CST book (Myers diff in chunks of
  ~300 words, located by trigrams, nearby offsets preferred for repeated passages; `dev/cst/align.ts`) and writes
  `dev/cst-map/<file>.json` (format `lk-cst/2`: `"page:entry": [sha1-12 of p_text, confidence, "book#idx ...", runs]`,
  runs `"lkW book#idx cstW len;..."`: the entry's words from lkW (shared/tokenize numbers, the web's `data-w`) are the
  paragraph's words from cstW) and `report.md` (95% of the entries mapped; the weakest are ap-pat, ap-kvu and a few SN
  books). ~2 minutes.
* `npx tsx dev/cst-map/export.ts` - writes the app's links, entities, settings, mentions and mūla-aṭṭhakathā glosses to
  `dev/cst-data/` (committed, so the build does not need the app's repository). Gloss offsets (UTF-16 in the app's Roman
  text) become CST word numbers (`romanSpans` in `dev/cst/align.ts`; 99.99% of the paragraphs tokenize identically,
  the rest are aligned). Rerun both after an upstream (tipitaka.app) update.
* The build uses a map record only while its hash matches the entry's Pāḷi text: the report counts the stale records
  (rerun map.ts for those files after text edits). Links of a paragraph mapped to more than 64 entry pairs are dropped.
  A setting goes to the lk nodes holding at least a quarter of the unit's entries. A gloss is placed through the runs: a
  word lk reads differently (a variant between two runs of an entry) is the word at the same distance in lk's gap; a
  gloss whose paragraph is not mapped is dropped (92% placed: 105,377 of 114,833; most of the rest quote mūla
  paragraphs of SN/MN/Snp that are not mapped). The data's hash is part of `api_hash`.

### The names in Sinhala (dev/names-si)
The app's names come with English descriptions (DPD meanings such as "name of a town", the first sentence of DPPN
entries) and categories ("villages, towns and cities", "DPPN: thera"). `GEMINI_API_KEY=… npx tsx dev/names-si/translate.ts`
translates the ones not yet in `dev/names-si/{meanings,families}.tsv` (keyed by the English text, so re-exports keep them;
corrected rows stay) with gemini-4-argon and its style rules (honorifics, Pāḷi name forms). The build shows the Sinhala
(`entity.meaning`, `family`; the English in `meaning_en`, `family_en`). Run it after an export that brings new names.

## Aṭṭhakathā Pāḷi from VRI (dev/atta-vri)
`npx tsx dev/atta-vri/reimport.ts [--file atta-dn-1] [--write]` brings the aṭṭhakathā Pāḷi up to the VRI text of
tipitaka.app (word level diff; the base is the commit of the last sync, recorded in `report.md`). lk's pages, entry
splits, bold and Sinhala stay. Only lk's own choices need care: the Jātaka order, the headings (not aligned) and the
hand corrections in `keep.tsv`. Without `--write` it only reports (`changes.tsv` applied, `errata.tsv` lk corrections
kept, `review.tsv` not applied).

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
