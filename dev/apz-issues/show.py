# prints a run's outcome per report and the changes per entry:  python3 dev/apz-issues/show.py <set>
import json, sys, difflib
S = 'dev/apz-trans/out/' + sys.argv[1] + '/'
P = {p['id']: p for p in json.load(open(S + 'packets.json'))}
for l in open(S + 'opus.jsonl'):
    r = json.loads(l); p = P[r['packet']]
    for it in r['items']:
        e = p['entries'][it['i'] - 1]
        for er in it.get('errors', []):
            if er['kind'] == 'report': print(er['note'][:200])
        if it['verdict'] != 'ok':
            old = e.get('apz') or ''
            ch = [(old[a:b], it['si'][c:d]) for t, a, b, c, d in difflib.SequenceMatcher(None, old, it['si']).get_opcodes() if t != 'equal']
            print('   ', e['key'], it['verdict'], 'reported' if e['key'] in (p.get('reports') or {}) else 'NOT REPORTED', [f'{x[:30]}→{y[:50]}' for x, y in ch][:4])
