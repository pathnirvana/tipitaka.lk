# the A. P. de Zoysa error reports (GitHub issues #133-#148, #153: items PLK-nnn / MPLK-nnn written against the old
# sinh-aps xml) -> items.json, each located in public/static/text-apz by its search text
#   gh issue view <n> --json number,title,body,comments > dev/apz-issues/issue-<n>.json; python3 dev/apz-issues/extract.py
import json, re, glob, collections
D = 'dev/apz-issues/'
items = []
for f in sorted(glob.glob(D + 'issue-*.json')):
    d = json.load(open(f))
    for block in re.split(r'\n(?=- \[[ x]\] \*\*M?PLK-)', d['body'])[1:]:
        head = block.split('\n', 1)[0]
        it = {'id': re.search(r'\*\*(M?PLK-\d+)\*\*', head).group(1), 'issue': d['number'], 'done': head.startswith('- [x]'),
              'head': re.sub(r'\(https?://[^)]*\)', '', head)}
        for k, key in (('Now', 'now'), ('Should be', 'should'), ('Why', 'why')):
            m = re.search(r'^  - ' + k + r': (.*)$', block, re.M)
            it[key] = m.group(1).strip() if m else ''
        it['compare'] = [re.sub(r'\(\[[^\]]*\]\([^)]*\)\)|\[([^\]]*)\]\([^)]*\)', r'\1', c) for c in re.findall(r'^  - (Compare.*)$', block, re.M)]
        m = re.search(r'search for: `([^`]*)`', block)
        it['search'] = m.group(1) if m else ''
        items.append(it)

apz = {f.split('/')[-1][:-5]: json.load(open(f)) for f in glob.glob('public/static/text-apz/*.json')}
def find(s):
    hits = []
    if not s: return hits
    for name, a in apz.items():
        for pi, p in enumerate(a['pages']):
            for i, t in enumerate(p['entries']):
                if s in t: hits.append([name, pi, i])
    return hits
for it in items:
    s = it['search'] or re.sub(r'^«|»$', '', it['now'])
    it['hits'] = find(s)
json.dump(items, open(D + 'items.json', 'w'), ensure_ascii=False, indent=1)
c = collections.Counter('no-search' if not it['search'] else 'gone' if not it['hits'] else 'once' if len(it['hits']) == 1 else 'many' for it in items)
print(len(items), c)
