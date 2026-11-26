"""Review page for a KN book: a few places left to the reviewer, each with its scan line, CST form and BJT Sinhala.
usage: python3 review_page.py  -> scratchpad/snp-review/{index.html,crops/,files.json}"""
import json, os, re, subprocess, sys, glob
ROOT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, ROOT)
from diff import BOOK, TEXT
import decide
OUT = '/private/tmp/claude-501/-Volumes-2TB-node-tipitaka-lk/66eaf5d8-0872-4d59-a171-63712223a882/scratchpad/snp-review'
SCANS = '/Volumes/2TB/node/pitaka.lk/bjt/newbooks'
os.makedirs(OUT + '/crops', exist_ok=True)
D = json.load(open(f'{ROOT}/snp/decisions.json'))
T = {}
for f in glob.glob(f'{TEXT}/kn-snp*.json'):
    d = json.load(open(f)); T[d['filename']] = d
tree = json.load(open(f'{TEXT}/../data/tree.json'))
CX = decide.exact(decide.cst('snp')); C = decide.norm(CX)
loose = lambda s: decide.norm(s).replace('ං', '').replace('ඞ', '').replace('ඤ', '').replace('්', '')

def cst_forms(w):
    n = decide.norm(w); out = {}
    for m in re.finditer(re.escape(n), C): out[CX[m.start():m.end()]] = out.get(CX[m.start():m.end()], 0) + 1
    return sorted(out.items(), key=lambda x: -x[1])[:3]

def tree_key(fn, page, entry):
    best = None
    for k, v in tree.items():
        if v[5] == fn and v[3] <= [page, entry] and (best is None or v[3] >= tree[best][3]): best = k
    return best

# id: (group, current word in the text, print as read / OCR, note, options)
K = 'Keep the text as it is now'
ITEMS = {
 794: ('call', 'කසිත්වාන', 'කයීත්වාන', 'The typed text had කයීත්වාන, and the print looks the same. Changed to the CST form because the line is “එතං කසිං …”.', [('keep', K + ' (කසිත්වාන)'), ('print', 'Go back to the print (කයීත්වාන)')]),
 885: ('call', 'භීනෙයා', 'භීනෙයා', 'Not changed. The print looks garbled and the typed text copies it. CST has භිය්‍යොධ, which fits the Sinhala (“වැඩිතරම් වූ අනෙක් දහමෙක් මේ ලෝකයෙහි ඇත් නම්”).', [('keep', K + ' (භීනෙයා)'), ('cst', 'Use the CST form (භිය්‍යොධ)')]),
 471: ('call', 'උපාදානාරම්භා', 'උපාදානාරම්භා / …ම්හා', 'The typed text had උපාදානරම්හා. The long ා is clear on the scan; I could not tell භ from හ and used භ as in CST.', [('keep', K + ' (උපාදානාරම්භා)'), ('print', 'Print has හ: උපාදානාරම්හා')]),
}
for i in (12, 75, 95, 141, 214, 593, 609, 649): ITEMS[i] = ('len', None, None, '', None)
for i in (338, 577, 836, 872, 378, 232, 904, 436): ITEMS[i] = ('noise', None, None, '', None)
NOTE = {338: 'Same word as p.186, where the print’s short form සඤ්ඤපෙතුං was applied. Here it was skipped as OCR noise.'}

items, files = [], {}
for i, (grp, cur, pr, note, opts) in ITEMS.items():
    d = D[i]; data = T[d['file']]; page = data['pages'][d['page']]
    pali = page['pali']['entries'][d['entry']]['text']; S = page['sinh']['entries']
    sinh = S[d['entry']]['text'] if d['entry'] < len(S) else ''
    typed = re.sub(r'^\d+\.\s*', '', d['typed']); typed = typed.strip('.,:;')
    ocr = re.sub(r'[¹²³⁴⁵⁶⁷⁸⁹⁰]', '', d['ocr']).strip('.,:;')
    cur = cur or typed; pr = pr or ocr
    ctx = re.sub(r'\{[^}]*\}', '', pali).replace('**', '')
    ctx = ctx.replace(cur, '⟦' + cur + '⟧', 1) if cur in ctx else ctx
    if len(ctx) > 420:
        p = ctx.find('⟦'); ctx = '…' + ctx[max(0, p - 180):p + 200] + '…'
    if len(sinh) > 520:
        r = max(0, pali.find(cur)) / max(1, len(pali)); p = int(r * len(sinh)); sinh = '…' + sinh[max(0, p - 240):p + 260] + '…'
    prefix, off = BOOK[data['bookId']]; sp = d['pageNum'] + off
    L = {l['n']: l for l in json.load(open(f'{ROOT}/../../ocr/{data["bookId"]}/{prefix}{sp:03d}.json'))['lines']}
    x1, y1, x2, y2 = L[d['line']]['bbox']
    name = f'snp-{i}.jpg'; dst = f'{OUT}/crops/{name}'
    subprocess.run(['magick', f'{SCANS}/{data["bookId"]}/{prefix}{sp:03d}.jpg', '-crop', f'{x2 - x1 + 60}x{y2 - y1 + 44}+{max(0, x1 - 30)}+{max(0, y1 - 22)}', '+repage', '-resize', '170%', '-quality', '78', dst], check=True)
    files[f'crops/{name}'] = dst
    key = tree_key(d['file'], d['page'], d['entry'])
    m = re.match(r'(\d+)\.', pali)
    forms = cst_forms(cur if grp != 'call' else {794: 'කසිත්වාන', 885: 'භිය්යොධ', 471: 'උපාදානාරම්භා'}[i])
    if grp == 'len': note = 'Only the vowel length differs. Read the length on the scan line below.'
    if grp == 'noise': note = NOTE.get(i, 'Skipped as OCR noise: the OCR form is not a word anywhere in the typed canon and CST has the typed form. Check that the print really has the typed word.')
    items.append(dict(id=f'snp-{i}', grp=grp, ref=(f'Snp {m.group(1)} · ' if m else '') + f'BJT p.{d["pageNum"]}', key=key, title=tree[key][0] if key else '',
                      cur=cur, pr=pr, cst=forms, ctx=ctx, sinh=re.sub(r'\{[^}]*\}', '', sinh), note=note, crop=name,
                      opts=opts or [('keep', f'Keep the text ({cur})'), ('print', f'Use the other form ({pr})')]))
html = open(f'{ROOT}/review-head.html').read() + '\n' + open(f'{ROOT}/review-body.html').read().replace('__ITEMS__', json.dumps(items, ensure_ascii=False).replace('</', '<\\/'))
open(f'{OUT}/index.html', 'w').write(html); json.dump(files, open(f'{OUT}/files.json', 'w'))
for it in items: print(it['id'], it['grp'], it['ref'], it['key'], it['cur'], '|', it['pr'], '|', it['cst'], '|', '⟦' in it['ctx'])
