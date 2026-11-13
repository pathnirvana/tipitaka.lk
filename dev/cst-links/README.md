# BJT ↔ CST links (`bjt-cst/1`)

Each Pāḷi entry of the BJT text is linked to the CST text (VRI Chaṭṭha Saṅgāyana) it corresponds to, with the words where the two editions differ. These links feed the proofreading pipeline (misc-ai/bjt-scans/pipeline), where a CST reading is one piece of evidence on a suspected error. A later edition-comparison site can use them too.

There is one file per text file, named as in `public/static/text`. All of DN, MN, SN and AN are linked, along with a few KN files. The links are stand-off: neither text is copied, except the CST readings where the editions differ. Each paragraph is on its own line.

```
{"format":"bjt-cst/1","tokenizer":"v1","cst":"tipitaka-xml@05d5d3c7cede","file":"dn-1","paras":{
"<page_idx>:<entry_idx>":{"ph":"…","c":[["s0101m.mul",8,0,57]],"m":0.97,"d":[[3,4,"සුතං","close-variant"]],"src":"rule"},
…}}
```

- `cst`: the CST source (github.com/VipassanaTech/tipitaka-xml at this commit, as built into the tipitaka.app `db/text.db`).
- `ph`: sha1 of the BJT Pāḷi entry text, first 12 hex digits. The record is stale once the text changes.
- `c`: the CST span, as `[CST book, para idx, first token, last token]` per paragraph. The book is the VRI file stem, e.g. `s0101m.mul`. Para idx is `para.idx` in that db.
  - CST tokens are the paragraph text with page refs `|…|` and variant notes `{…}` removed, lower-cased, ṁ written as ṃ, and split at anything that is not a letter.
  - An empty list means CST has no counterpart.
- `m`: the share of the entry's words found identical in CST, with niggahita spellings folded. Digits are not counted, because CST keeps paragraph numbers outside the text.
- `d`: where the editions differ, as `[first word, end word, CST reading, kind]`.
  - Word numbers are tokenizer v1 indices of the entry (`shared/tokenize.ts`), with the end exclusive. When first = end, CST has words that BJT lacks at that point.
  - The CST reading is converted to Sinhala script.
  - `kind` is one of `word-division`, `niggahita`, `spelling-ḷ/ṇ`, `spelling-vy/by`, `lengthening`, `peyyala`, `small-omission`, `omission`, `close-variant`, `variant`, or `cst-noted-reading`. The last one means a CST variant note gives the BJT reading, e.g. one marked "(sī.)".
- `x`: how the link was found. It is absent when the entry was found in the CST range of its own sutta key, in sequence.
  - `x: 2`: the sutta was placed by its words, not by its key, because BJT and CST number, group or order it differently. See "Where BJT and CST differ in structure" below.
  - `x: 1`: the passage is linked to a parallel elsewhere in CST. BJT writes out a repetition that CST abbreviates at this point (`…pe…`), so the link goes to the place where CST writes the same wording out. The differences then include that parallel's context words, such as names and vocatives, which are not BJT errors.
  - `x: 0`: a model or a person found no counterpart in CST (`c` is empty).
- `src`: who placed the link.
  - `rule`: the word alignment in `cst_links.py`.
  - `opus-5.5`: an entry the alignment could not place, checked by Claude Opus 5.5 at low effort. These were the entries with under 60% of words identical, other than headings. Its reason is in `note`.
  - `reviewer:<name>`: checked by a person.
  - The four DN 1 files were first checked by Sonnet 5.5 (`sonnet-5.5`). They were redone with Opus, so that all files are checked the same way.

## Where BJT and CST differ in structure

Both editions' trees use keys in the style of open.tipitaka.lk, such as `sn-3-1-3-2-1`, but the same key does not always mean the same text. So the linker first aligns each file with the CST range its keys point to. Any sutta that matches less than 85% there is then looked for by its rarer words, anywhere in the CST mūla books. If that place fits better, the sutta gets those links, marked `x: 2`.

This also handles suttas that come in a different order, or from a different CST book. Each sutta is placed by itself, so CST order a, c, b against BJT's a, b, c is not a problem. A link's CST position can therefore go backwards from one sutta to the next. That's expected; it doesn't mean a wrong link.

The main differences found (2026-11):

- **An extra or missing level.** In the Khandhasaṃyutta (`sn-3-1-*`), BJT groups the vaggas into three paṇṇāsakas (mūla, majjhima, upari). CST has the vaggas directly under the saṃyutta. So BJT `sn-3-1-3` (Uparipaṇṇāsaka) is CST's Antavagga and later vaggas, not CST `sn-3-1-3` (Bhāravagga). The same kind of shift appears in some AN paṇṇāsakas (`an-5-6`, `an-6-3`, `an-7-2`, `an-7-3`, `an-10-5`) and in SN `sn-2-2`, `sn-2-3`, `sn-2-5`, `sn-2-7` and `sn-5-1`. `sn-3-1-2` and `sn-3-1-3` are placed almost entirely by content.
- **Vaggas and suttas numbered differently.** BJT and CST sometimes split, join or number repetitive sutta groups differently. In AN 4, for example, BJT's Sappurisa suttas (`an-4-5-1-*`) sit where CST has other titles under the same keys.
- **CST abbreviates where BJT writes out.** This happens most in SN 3–5 (Khandha, Saḷāyatana and Mahā vaggas). These entries are linked to the written-out parallel (`x: 1`) or have no counterpart. That is why `sn-3-7` (median 56% of words identical), `sn-3-1-3` (62%), `sn-5` (65%) and `sn-3-2` (74%) score low. It isn't a wrong range.
- **A file spans two CST books.** Examples: `an-4-5`, `an-5-4`, `an-9` and `sn-3-1-2`. Their links name the right book per entry.
- **Titles differ by design.** CST titles are often fuller than BJT's, or they name a different sutta in a numbered group. A heading's `m` says little, and headings were not sent to the model check.

So, for an agent using these links:
- Weigh a difference less when `x` is 1 or 2 or `m` is low.
- Treat a difference in a heading as no evidence.
- With `x: 1`, a name or vocative that differs is expected.

## Making them

1. `misc-ai/bjt-scans/pipeline/cst_links.py <file…>` does the word alignment, places suttas by content when needed, and finds parallels for abbreviated passages.
2. `cst_check.py prepare <file…>` builds the sheets of entries the alignment could not place.
3. `cst_check.py run <file…>` has Opus answer them, using the plan CLI and the prompt `prompts/cst-check-v1.md`.
4. `cst_check.py apply <file…>` writes the answers into these files.
