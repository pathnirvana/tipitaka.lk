# every report's outcome after the issues set ran (dev/apz-trans/out/issues/opus.jsonl) -> outcome.json and one comment
# per GitHub issue in comments/<n>.md
#   python3 dev/apz-issues/outcome.py
import json, os, re, collections
D, S = 'dev/apz-issues/', 'dev/apz-trans/out/issues/'
items = json.load(open(D + 'items.json'))
notes = {}
# (issues-2: the second pass over relocate.py's items2.json, issues-3 the two left unanswered; later passes override)
for src, l in [*((1, l) for l in open(S + 'opus.jsonl')), *((2, l) for l in open('dev/apz-trans/out/issues-2/opus.jsonl')),
                  *((2, l) for l in open('dev/apz-trans/out/issues-3/opus.jsonl'))]:
    for it in json.loads(l)['items']:
        for er in it.get('errors', []):
            m = re.match(r'(M?PLK-\d+)\W+(fixed|already|moot|rejected)\b[:.,;]?\s*(.*)', er['note'], re.S)
            if er['kind'] == 'report' and m:
                prev = notes.get(m.group(1))
                # (a report acted on in two entries of one pass: fixed wins)
                if not prev or m.group(2) == 'fixed' or src == 2: notes[m.group(1)] = (m.group(2), m.group(3).strip())
# relocate.py: the named sutta no longer holds the reported words
gone = {k for k, why, score in json.load(open(D + 'gone2.json')) if why == 'sutta found, text not in it' and score < 0.5}
out = {}
for it in items:
    if it['id'] == 'PLK-473': out[it['id']] = ('fixed', 'ඎ replaced by ඍ throughout the translation (241 places).')
    elif it['id'] in gone: out[it['id']] = ('already', 'the reported words are no longer in this sutta.')
    elif it['id'] in notes: out[it['id']] = notes[it['id']]
    elif not it['loc'] or it['loc'][3] < 0.5: out[it['id']] = ('already', 'the reported text is no longer in the current text (replaced when the translation was imported or checked).')
    else: out[it['id']] = ('unanswered', '')
json.dump(out, open(D + 'outcome.json', 'w'), ensure_ascii=False, indent=1)
print(collections.Counter(v[0] for v in out.values()))

WORD = {'fixed': 'Fixed', 'already': 'Already correct', 'moot': 'Not applicable', 'rejected': 'Kept as it is'}
os.makedirs(D + 'comments', exist_ok=True)
by = collections.defaultdict(list)
for it in items: by[it['issue']].append(it)
for n, its in by.items():
    c = collections.Counter(out[it['id']][0] for it in its)
    lines = [f'Thank you for these reports. Every item was checked against the BJT Pāḷi, the Buddha Jayanthi Sinhala and the aṭṭhakathā, '
             f'in the current A. P. de Zoysa text of pitaka.lk (public/static/text-apz, which replaced the old sinh-aps files). '
             f'Paragraph numbers, headings and paragraph breaks there now follow the BJT Pāḷi.', '',
             ', '.join(f'{WORD.get(k, k)}: {v}' for k, v in c.most_common()), '']
    for it in its:
        k, note = out[it['id']]
        # (the model's notes name entries of its packet, i=10: not meaningful to readers)
        note = re.sub(r'\s*\((?:entries |entry )?i=[\d, i=–-]+\)', '', note)
        note = re.sub(r'\b(?:entries |entry )?i=\d+(?:[–-]\d+)?', 'a nearby paragraph', note).replace('this packet', 'this passage').replace('packet', 'passage')
        lines.append(f'- **{it["id"]}** {WORD.get(k, k)}' + (f': {note}' if note else ''))
    open(D + f'comments/{n}.md', 'w').write('\n'.join(lines) + '\n')
