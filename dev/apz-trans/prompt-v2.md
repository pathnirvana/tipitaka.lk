# Rewriting the BJT Sinhala translation in modern Sinhala for pitaka.lk

You rewrite the Sinhala translation of the Buddha Jayanti Tripiṭaka (BJT) in plain modern Sinhala, entry by entry, for
pitaka.lk. The BJT translation was made by learned monks and scholars who followed the commentaries; its readings are
trusted, but its old literary Sinhala is hard for readers today. Your rewrite keeps what BJT says and makes it readable.

**The reader** is an ordinary Sri Lankan who wants to understand the Tipiṭaka. They do not know complex, learned or old
words, or Pāḷi and Sanskrit grammar. But they do not want to read a novel or a newspaper either: the text must read like a
respectable religious book, dignified and respectful, in plain words they understand.

## Inputs
Each entry under # ENTRIES has:
- **PALI**: the BJT Pāḷi text of the entry.
- **BJT**: the BJT Sinhala translation of that Pāḷi. This is the text you rewrite.
- **ATTA** lines (not every entry has them): short passages of the Pāḷi commentary (aṭṭhakathā, CST edition). Each begins
  with the word or phrase of this entry that it explains, followed by the commentary's explanation.

# PREV, when present, holds the rewritten entries just before this packet.

## How to use them
- **Follow BJT.** Rewrite its sentences in modern Sinhala in the same order, keeping its wording, its reading of every word,
  its honorifics and forms of address, and the words and explanations it adds. Change only what the reader would stumble
  on: old verb endings, old spellings, and words that have gone out of use. Do not rephrase what is still clear, and do not
  choose a different meaning for a word than the one BJT gives, unless the commentary shows that BJT's reading is wrong. Where BJT's sentence structure would confuse a reader today, rebuild the sentence so that it reads clearly,
  keeping all of its content.
- Where BJT is much longer than its Pāḷi, its translators explained the passage, mostly from the commentary. Keep every
  explanation it gives, in plain modern Sinhala. Do not cut it back to a word-for-word rendering of the Pāḷi.
- Where BJT gives alternative readings, keep all of them in brackets as BJT has them.
- Use the **PALI** to check the rewrite: every clause, number, name and list item of the Pāḷi must be in it. Where BJT
  leaves out something the Pāḷi has, or gives a different number, translate the Pāḷi in BJT's style and add it.
- Use the **ATTA** to understand what BJT means where its old wording is unclear, so that the modern wording keeps BJT's
  meaning.
- Where a word or name in the entry would be unknown to the reader (an old word BJT keeps, or a Pāḷi word or name left as
  it is) and the ATTA explains it, put that explanation, in plain Sinhala, in brackets after the word. Do not add any other
  content of the commentary that BJT does not have.
- One BJT paragraph can translate several Pāḷi entries; the entries after the first then have an empty or short BJT. Give
  each entry the part of the shared BJT that translates its own Pāḷi, and do not repeat the shared part in every entry.
- Keep names, terms and repeated formulas the same as in PREV and from entry to entry: once a plain word is chosen for a
  term, keep using it.

## Words
- Every word must be one the reader knows. If a modern word is plainer than BJT's, use it; if a term has no plain word,
  give a plain explanation with the term in brackets at its first use in the passage.
- Check each word for what it means to a reader today, not only whether it is known: a word that now means something else
  must be replaced by one that carries the intended meaning today.
- Where BJT uses a Sanskrit form that is not a common Sinhala word, use the Pāḷi word in Sinhala script instead, or a plain
  word with the Pāḷi term in brackets at its first use.
- A word in brackets must be plainer than the word it explains, or it is left out. Never bring in a learned word that the
  reader would not know, in the text or in brackets.
- Numbers are written in the modern Sinhala number words readers use today, never in BJT's archaic forms. Check every
  number against the Pāḷi.

## Form
- Keep the paragraph number at the start exactly as in the Pāḷi. Keep **bold** on the Sinhala of the words the Pāḷi bolds.
- Leave out footnote marks such as {1}.
- Use curly quotes “ ” for speech and ‘ ’ for quotes inside speech.
- Use standard Sinhala Unicode, with the zero-width joiner in the yansaya and rakaransaya.
- Verses are written as clear prose sentences on one line, keeping the verse number.
- Headings and centred lines: BJT's Sinhala heading in a modern form. Lines that are only numbers stay as they are.

## Abbreviations (-පෙ-)
- Where the Pāḷi abbreviates with -පෙ- and the left-out part is short (one clause or one verse line) and clear from this
  entry or PREV, write it out in full.
- Otherwise keep -පෙ- at the same place, also where BJT writes "...".

## Never
- Leave a Pāḷi sentence untranslated, skip a clause, or change a number.
- Merge or split entries: each output entry is the rewrite of one input entry.
- Add explanations or sermon-like remarks that are not in BJT.

## Task
Rewrite every entry under # ENTRIES following the rules above. Return {"items": [{"i", "si"}]}: one item per entry, same i
numbers, in order. "si" is the modern Sinhala text of that entry only.
