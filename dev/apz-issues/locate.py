# finds the text-apz entry each item (items.json) is about: the entry of the issue's book whose text holds the most of
# the item's search text (character 4-grams, ZWJ and punctuation ignored); exact = the search text is in it as it is
#   python3 dev/apz-issues/locate.py  -> items.json with "loc": [file, page_idx, entry_idx, score, exact]
import json, glob, re, collections, subprocess
D = 'dev/apz-issues/'
BASE = '2fd1482' # (the last commit before dev/apz-paranum renumbered text-apz: its numbers are the reports' paragraph numbers)
BOOKS = {'Ones': ['an-1'], 'Twos': ['an-2'], 'Threes': ['an-3'], 'Fours': ['an-4'], 'Fives': ['an-5'], 'Sixes': ['an-6'],
         'Sevens': ['an-7'], 'Eights': ['an-8'], 'Nines': ['an-9'], 'Tens': ['an-10'], 'Elevens': ['an-11'], 'Majjhima': ['mn']}
norm = lambda s: re.sub(r'[‍‌\s.,;:“”‘’"\'()\[\]\-–!?«»*]', '', s)
grams = lambda s: {s[i:i + 4] for i in range(len(s) - 3)}
items = json.load(open(D + 'items.json'))
titles = {json.load(open(f))['number']: json.load(open(f))['title'] for f in glob.glob(D + 'issue-*.json')}
apz = {f.split('/')[-1][:-5]: json.load(open(f)) for f in glob.glob('public/static/text-apz/*.json')}
ents = collections.defaultdict(list)
LEAD = re.compile(r'^\s*[“‘"(*]*\s*(\d+)(?:\s*[-–]\s*(\d+))?\**\s*\.')
for name, a in apz.items():
    old = json.loads(subprocess.run(['git', 'show', f'{BASE}:public/static/text-apz/{name}.json'], capture_output=True, text=True).stdout or 'null')
    para = set()
    for pi, p in enumerate(a['pages']):
        for i, t in enumerate(p['entries']):
            m = LEAD.match(old['pages'][pi]['entries'][i]) if old else None
            if m: para = set(range(int(m.group(1)), int(m.group(2) or m.group(1)) + 1))
            ents[name].append((pi, i, t, grams(norm(t)), para))
for it in items:
    key = it['search'] or it['now'].strip('«» ')
    pre = [b for k, bs in BOOKS.items() if k in titles[it['issue']] for b in bs]
    files = [n for n in ents if any(n == b or n.startswith(b + '-') for b in pre)]
    g = grams(norm(key))
    m = re.search(r'paragraphs? ([\d, –-]+)', it['head'])
    want = {int(x) for x in re.findall(r'\d+', m.group(1))} if m else set()
    # the best match in the book; the paragraph the report names (old APZ numbers, sometimes one off) only breaks ties
    # between repeated phrases. loc: [file, page_idx, entry_idx, score, exact, near the named paragraph]
    best = (0, None)
    for n in files:
        for pi, i, t, eg, para in ents[n]:
            s = len(g & eg) / len(g) if g else 0
            near = bool(want) and any(abs(w - p) <= 2 for w in want for p in para)
            r = s + (0.15 if want & para else 0.1 if near else 0)
            if r > best[0]: best = (r, [n, pi, i, round(s, 2), key in t, near])
    it['loc'] = best[1]
json.dump(items, open(D + 'items.json', 'w'), ensure_ascii=False, indent=1)
sc = [it['loc'][3] if it['loc'] else 0 for it in items]
print('exact', sum(1 for it in items if it['loc'] and it['loc'][4]), '>=0.8', sum(s >= 0.8 for s in sc), '0.5-0.8', sum(0.5 <= s < 0.8 for s in sc), '<0.5', sum(s < 0.5 for s in sc))
