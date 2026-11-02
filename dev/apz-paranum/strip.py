# the sin_apz entries numbered where the BJT Pāḷi has no "N." (runs.json "other", see cst.ts: mostly CST/VRI numbers):
# where the Pāḷi starts with an undotted number ("5-10 puna", "1281 paṭi", "**4-30 **") the APZ takes that number,
# otherwise the APZ number is removed
import json, re
D = 'dev/apz-paranum/'
NUM = re.compile(r'^(\s*\**)(\d+(?:\s*[-–]\s*\d+)?)\**(\s*\.\s*)')
PALI = re.compile(r'^\s*\**(\d+(?:\s*[-–.]\s*\d+)?(?:\(\d+\))?)\s*\**\s')
files, n = {}, {'synced': 0, 'same': 0, 'removed': 0}
for name, page, i, _, _ in [o for o in json.load(open(D + 'runs.json'))['other'] if len(o) == 5]:
    if name not in files: files[name] = (json.load(open(f'public/static/text-apz/{name}.json')), json.load(open(f'public/static/text/{name}.json')))
    a, b = files[name]
    pi = next(k for k, p in enumerate(b['pages']) if p['pageNum'] == page)
    t, p = a['pages'][pi]['entries'][i], b['pages'][pi]['pali']['entries'][i]['text']
    m, pm = NUM.match(t), PALI.match(p)
    if not m: continue
    if pm:
        num = pm.group(1).replace('.', '').replace(' ', '')
        if m.group(2).replace(' ', '') == num: n['same'] += 1; continue
        t = m.group(1) + num + m.group(3) + t[m.end():]; n['synced'] += 1
    else:
        t = m.group(1).replace('*', '') + t[m.end():]; n['removed'] += 1
    a['pages'][pi]['entries'][i] = t
for name, (a, _) in files.items():
    open(f'public/static/text-apz/{name}.json', 'w').write(json.dumps(a, ensure_ascii=False, indent=4) + '\n')
print(n)
