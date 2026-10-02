# Accepted differences from v2

* **FTS recall ~98%, not 100%**: the v2 index (`db/fts.db`) is older than the current text - many "missing" rows point
  to files that no longer exist (e.g. `mn-1-1`, `mn-3-1`) or to shifted entry positions (A8).
* **FTS filters**: `an-1` no longer matches `an-10`/`an-11` (A5). Tests compare only rows inside the selected groups.
* **FTS ranking**: v2 ordered by an integer division that was ~always 0 (A6); v3 ranks the first 2,000 matches
  (canonical order) by matches / log2(length) and shows the best 100.
* **FTS syntax**: `NOT` and parentheses are rejected (Android's SQLite lacks the enhanced syntax); `AND` = space.
* **Singlish**: @pnfo/singlish-search 1.1.0 -> 1.2.7 gives fewer, better candidate words.
* **Title search**: zwj is ignored on both sides (A32) and filters use the group (A5) - v2 results are a subset.
* **Dictionary prefix words** keep the SQL (word) order (v2 used an invalid comparator, A10).
* **Entry -> sutta key** follows v2's search rule (getKeyForEInd) everywhere (A14): the centered number before a
  heading and verses in heading-at-end collections now belong to the following sutta (`db/build-report.md`).
