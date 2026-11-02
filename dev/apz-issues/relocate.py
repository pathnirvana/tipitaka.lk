# second pass: the reports the first pass found at a repeated phrase in another sutta (rejected as "the report concerns
# ..."), and the unanswered ones, located again inside the sutta the report names in brackets ("paragraph 206 (<sutta>)")
# -> items2.json (same form as items.json) for set.ts issues --items dev/apz-issues/items2.json
import json, glob, re
D = 'dev/apz-issues/'
norm = lambda s: re.sub(r'[‍‌\s.,;:“”‘’"\'()\[\]\-–!?«»*\d]', '', s)
grams = lambda s: {s[i:i + 4] for i in range(len(s) - 3)}
items = {it['id']: it for it in json.load(open(D + 'items.json'))}
out = json.load(open(D + 'outcome.json'))
redo = [k for k, (v, _) in out.items() if v in ('rejected', 'unanswered')]
res, gone = [], []
for k in redo:
    it = items[k]
    m = re.search(r'\(([^)]*)\)', it['head'])
    if not m or not it['loc']: continue
    name, g = it['loc'][0].split('-')[:2], grams(norm(it['search'] or it['now']))
    files = sorted(f for f in glob.glob('public/static/text-apz/*.json') if re.search(rf'/{name[0]}-{name[1]}(-|\.)', f))
    title = grams(norm(m.group(1).replace('සූත්‍රය', '').replace('සූත්‍රය', '')))
    best, seen = (0, None), False
    for f in files:
        a, b = json.load(open(f)), json.load(open(f.replace('text-apz', 'text')))
        flat = [(pi, i, t, b['pages'][pi]['pali']['entries'][i]['type']) for pi, p in enumerate(a['pages']) for i, t in enumerate(p['entries'])]
        for h, (pi, i, t, ty) in enumerate(flat):
            if ty != 'heading' or not title or len(title & grams(norm(t))) / len(title) < 0.7: continue
            seen = True
            for pj, j, u, ty2 in flat[h + 1:]:
                if ty2 == 'heading': break
                s = len(g & grams(norm(u))) / len(g) if g else 0
                if s > best[0]: best = (s, [f.split('/')[-1][:-5], pj, j, round(s, 2), (it['search'] or it['now']) in u, True])
    if best[1] and best[1][:3] != it['loc'][:3] and best[0] >= 0.5: res.append({**it, 'loc': best[1]})
    else: gone.append([k, 'sutta found, text not in it' if seen else 'sutta not found', best[0]])
json.dump(res, open(D + 'items2.json', 'w'), ensure_ascii=False, indent=1)
json.dump(gone, open(D + 'gone2.json', 'w'), ensure_ascii=False)
print(gone)
print(len(redo), 'to redo,', len(res), 'found in their own sutta')
