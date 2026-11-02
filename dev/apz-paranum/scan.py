# list entries whose leading paragraph number differs between BJT Pāḷi and sin_apz
import json, glob, os, re, sys
NUM = re.compile(r'^\s*[“‘"(]*\s*(\d+(?:\s*[-–]\s*\d+)?)\s*\.')
def num(t): m = NUM.match(t or ''); return m.group(1).replace(' ', '').replace('–', '-') if m else None
rows = []
for f in sorted(glob.glob('public/static/text-apz/*.json')):
    name = os.path.basename(f)[:-5]
    a = json.load(open(f)); b = json.load(open('public/static/text/' + name + '.json'))
    for pi, (pa, pb) in enumerate(zip(a['pages'], b['pages'])):
        ea, eb = pa['entries'], pb['pali']['entries']
        if len(ea) != len(eb): rows.append((name, pa['pageNum'], -1, f'len {len(eb)}/{len(ea)}', '', '')); continue
        for i, (x, y) in enumerate(zip(ea, eb)):
            na, nb = num(x), num(y['text'])
            if na != nb: rows.append((name, pa['pageNum'], i, nb, na, x[:40].replace('\n',' ')))
for r in rows: print('\t'.join(map(str, r)))
