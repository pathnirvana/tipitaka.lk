# group sin_apz paragraph-number mismatches into runs of constant offset (apz - pali)
# writes dev/apz-paranum/runs.json: one run per (file, offset) stretch, with its entries
import json, glob, os, re, sys
NUM = re.compile(r'^(\s*[“‘"(*]*\s*)(\d+)(?:\s*[-–]\s*(\d+))?\**\s*\.')
PALI = re.compile(r'^(\s*\**)(\d+)(?:\s*[-–]\s*(\d+))?(?:\(\d+\))?\**\s')  # BJT also has "5-10 puna", "1281 paṭi"
def num(t, pali=False):
    m = NUM.match(t or '') or (PALI.match(t or '') if pali else None)
    return (int(m.group(2)), int(m.group(3)) if m.group(3) else None) if m else None
runs, other = [], []
for f in sorted(glob.glob('public/static/text-apz/*.json')):
    name = os.path.basename(f)[:-5]
    a = json.load(open(f)); b = json.load(open('public/static/text/' + name + '.json'))
    cur = None
    for pi, (pa, pb) in enumerate(zip(a['pages'], b['pages'])):
        ea, eb = pa['entries'], pb['pali']['entries']
        if len(ea) != len(eb): other.append([name, pa['pageNum'], 'len']); continue
        for i, (x, y) in enumerate(zip(ea, eb)):
            if y['type'] not in ('paragraph', 'gatha'): continue
            na, nb = num(x, True), num(y['text'], True)
            if not na or not nb:
                if nb and not na:  # numbered in the Pāḷi only: the number can be added
                    if cur and cur['offset'] == 'add': cur['entries'].append([pi, i, nb[0], None])
                    else:
                        cur = {'file': name, 'offset': 'add', 'entries': [[pi, i, nb[0], None]]}
                        runs.append(cur)
                elif na: other.append([name, pa['pageNum'], i, nb, na])
                continue
            off = na[0] - nb[0]
            if off == 0 and na[1] == nb[1]: cur = None; continue
            if na[1] != nb[1]: other.append([name, pa['pageNum'], i, nb, na, 'range'])
            if cur and cur['offset'] == off: cur['entries'].append([pi, i, nb[0], na[0]])
            else:
                cur = {'file': name, 'offset': off, 'entries': [[pi, i, nb[0], na[0]]]}
                runs.append(cur)
json.dump({'runs': runs, 'other': other}, open('dev/apz-paranum/runs.json', 'w'), ensure_ascii=False)
print('runs', len(runs), 'entries', sum(len(r['entries']) for r in runs), 'other', len(other))
import collections
print(collections.Counter(len(r['entries']) for r in runs).most_common(10))
print(collections.Counter(o[-1] if o[-1] in ('len','range') else 'missing' for o in other))
