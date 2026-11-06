# Common names of popular suttas

Many suttas are searched by a name that is not their BJT title: සිඟාලෝවාද is සිගාලසුත්තං (dn-3-8), Anattalakkhaṇa is
පඤ්චවග්ගිය සුත්තං, and Kālāma (an-3-2-2-5) has only a number as its title. Title search (`web/src/data/title.ts`) also
looks the query up in these names (`shared/sutta-names.ts`), shows the name after the title when the title itself does
not match, and lists these suttas first, the most searched first.

- `names.json`: the names, by node key. `si` Sinhala script, `ro` roman spellings. Edit this file to add a sutta or a
  name. Spellings that differ only in vowel length, aspiration, ණ/න, ළ/ල, spaces or a trailing සූත්‍රය / sutta need no
  separate entry. `review` marks a mapping to check.
- `build.ts`: adds the weights (Search Console impressions of the queries naming each sutta) and writes
  `shared/popular-suttas.json`. Every key must be in the tree.
- `fetch-gsc.mjs`: the Search Console queries of the last 16 months (key in `../api-keys`).

```
node dev/popular-suttas/fetch-gsc.mjs queries sc-domain:pitaka.lk /tmp/pitaka.lk.json      # also tipitaka.lk, tipitaka.app
npx tsx dev/popular-suttas/build.ts /tmp/*.lk.json /tmp/tipitaka.app.json
npx tsx dev/popular-suttas/build.ts --unmatched /tmp/*.lk.json /tmp/tipitaka.app.json     # sutta queries no name matches yet
```

Chants that are not in the Tipiṭaka (Jaya piritha, Jinapañjara, Dasa disā, Aṭavisi, Jalanandana…) are left out: there is
no node to show.
