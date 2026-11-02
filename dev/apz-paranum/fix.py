# give sin_apz entries the paragraph number of the BJT Pāḷi beside them, for the runs whose ends check.json
# found aligned ("yes" at the first and last entry); the rest are listed in review.tsv
#   python3 dev/apz-paranum/fix.py [--dry]
import json, re, sys
D = 'dev/apz-paranum/'
NUM = re.compile(r'^(\s*[“‘"(*]*\s*)(\d+(?:\s*[-–]\s*\d+)?)\**(\s*\.\s*)')
runs = json.load(open(D + 'runs.json'))['runs']
check = json.load(open(D + 'check.json'))
files, review, fixed = {}, [], 0

PALI = re.compile(r'^\s*(\d+(?:\s*[-–]\s*\d+)?(?:\(\d+\))?)\s')  # (BJT also has "1257 paṭi", "7(152) appa")
def pali_num(t):
    t = t.replace('**', '')
    return (NUM.match(t) or PALI.match(t)).group(2 if NUM.match(t) else 1)

for k, r in enumerate(runs):
    ends = ['first', 'last'] if len(r['entries']) > 1 else ['first']
    res = [check.get(f'{k}:{w}', {}).get('match') for w in ends]
    name = r['file']
    if name not in files:
        files[name] = (json.load(open(f'public/static/text-apz/{name}.json')), json.load(open(f'public/static/text/{name}.json')))
    a, b = files[name]
    if any(x != 'yes' for x in res):
        e = r['entries'][0]
        review.append([name, a['pages'][e[0]]['pageNum'], e[1], r['offset'], len(r['entries']), *res,
                       *[check.get(f'{k}:{w}', {}).get('note', '') for w in ends]])
        continue
    for pi, i, _, _ in r['entries']:
        n = pali_num(b['pages'][pi]['pali']['entries'][i]['text'])
        t = a['pages'][pi]['entries'][i]
        if r['offset'] == 'add': t = n + '. ' + t
        else: t = NUM.sub(lambda m: m.group(1) + n + m.group(3), t, count=1)
        a['pages'][pi]['entries'][i] = t
        fixed += 1

if '--dry' not in sys.argv:
    for name, (a, _) in files.items():
        open(f'public/static/text-apz/{name}.json', 'w').write(json.dumps(a, ensure_ascii=False, indent=4) + '\n')
with open(D + 'review.tsv', 'w') as f:
    f.write('file\tpage\tentry\toffset\tcount\tfirst\tlast\tnotes\n')
    for row in review: f.write('\t'.join(map(str, row)) + '\n')
print('fixed', fixed, 'entries; runs to review', len(review))
