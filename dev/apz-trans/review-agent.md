# Brief: review one group of chapters (rewrite mode)

You review the modern Sinhala rewrite of the Buddha Jayanti Tripiṭaka (BJT) Sinhala translation for pitaka.lk, one group
file at a time: `dev/apz-trans/out/book-<book>/rev/<group>.txt`. Each entry there has PALI (BJT Pāḷi), BJT (the BJT
Sinhala that was rewritten), sometimes ATTA lines (short spans of the Pāḷi commentary) and NEW (the rewrite to review).
The entries were rewritten a few at a time; you see whole chapters at once.

Read first, and follow:
- `dev/apz-trans/prompt-v2.md`: the rules the rewrite follows (ignore its Task section).
- `dev/apz-trans/review-prompt.md`: what to correct in a review (ignore its output format; use the one below).

Use only these two files and the group file. Do not open any other file in dev/apz-trans (no glossary, no earlier
outputs): a word's rendering must come from its context, not a list.

Read every NEW as the ordinary Sri Lankan reader would, entry by entry, against its PALI and BJT. Settled decisions:
- BJT is followed; where BJT is clearly wrong against the Pāḷi or the commentary, the correct meaning wins.
- Where wordings of the same term or formula differ, use the one the ordinary reader understands best, even if another
  is more frequent. Established Sinhala forms of doctrinal terms are fine when they are the plain ones.
- ෂඩ්වර්ගික (the group of six monks) is fine. A little extra bracket explanation is better than none.
- The repeated Vinaya formulas already settled for this book (keep them; `dev/apz-trans/unify.py` applies them after the
  review): "හෙළා දකිති, නුගුණ කියති, දොස් පතුරුවති"; "මේ ශික්ෂාපදය මෙසේ උදෙසිය යුතු ය (ප්‍රකාශ කළ යුතු ය)";
  "සැබෑ ය, භාග්‍යවතුන් වහන්ස"; ෂඩ්වර්ගික; අනුමත කරමි; "සිහි විකල් වූවෙකුට ද, මුලින්ම මේ වරද කළ තැනැත්තාට
  (ආදිකම්මිකයාට) ද ඇවැත් නැත"; **ඇවැත් නැත** (the anāpatti heading); ධර්ම කතාව; පාචිත්තිය; දුක්කට.
- Make the smallest edit that fixes each problem; do not polish wording that is already clear.
- Never change -පෙ-, the paragraph number at the start, **bold** markers or quotes.

Write your corrections, only the entries you changed, as a JSON array to the output path you are given:
`[{"key": "vp-pct 52:3", "si": "<the full corrected entry>", "errors": [{"kind": "...", "note": "..."}]}]`
kind is one of meaning-today, unknown-word, bracket, sentence, consistency, meaning, omission; the note is short, in
English, and quotes the words before and after. Write `[]` when nothing needs changing. Do not edit any other file.

Do not leave doubts for someone else: where a word, sentence or reading is unclear, decide it yourself from the PALI, the
ATTA lines, BJT and your own knowledge of Pāḷi and Sinhala (what the word means in this context, what a Sri Lankan reader
understands by the Sinhala today), and fix it or leave it on that basis.

Your final message: the number of changes by kind; each term or formula you unified, as "chosen ← replaced"; and the few
decisions you were least sure of, with key and reason. Keep it short.
