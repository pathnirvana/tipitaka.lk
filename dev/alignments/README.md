# Pāḷi↔Sinhala word alignments

One file per text file (`<file>.json`, same names as `public/static/text`), stand-off: no copy of the text.
Built into the `align` table of `text.db` by `build/align.ts` (see `dev-docs/data-pipeline.md`).

```
{"format":"bjt-align/1","tokenizer":"v1","file":"dn-1","paras":{
  "<page_idx>:<entry_idx>": {
    "ph": "<sha1 of the Pāḷi entry text, first 12 hex>", "sh": "<same for the Sinhala text ('' for pali-only files)>",
    "L":  "0>0 | 1>2,3 | 2-3>4 ~p",   Pāḷi word numbers > Sinhala word numbers; ~p phrase, ~i free rendering
    "pu": "4,9",                      Pāḷi words left untranslated
    "sa": "1,5",                      Sinhala words added by the translator
    "src": "haiku-5.5-high" | "opus-5.5" | "rule" | "reviewer:<name>", "at": "<date>" }, ... }}
```

Word numbers index `tokenize()` in `shared/tokenize.ts` (v1: Sinhala-script runs, keeping bold/underline markup inside a
word as one word, and digit runs; `{n}` footnote pointers skipped). One paragraph per line keeps diffs readable.

A record is used only while both hashes match the current text. After a text correction the build report lists the
paragraph as stale; realign it (or re-hash it when the fix only changed letters inside words).

The alignments are produced by the DPD-sinhala project (`scripts/batch`: Claude Haiku 5.5 in batch, checked against
Claude Opus 5.5), which writes this folder directly.
