"""Applied corrections that put back a form the 2022 common-errors pass had replaced (dev/word-list/common-errors).
usage: python3 norm_check.py <base commit> <file prefix>...   e.g. 04d986e^ kn-khp kn-dhp"""
import collections, difflib, glob, json, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.join(ROOT, '..', '..', '..')
SI = re.compile(r'[^඀-෿]')
k = lambda w: SI.sub('', re.sub(r'\{[^}]*\}', '', w))
def lists():
    R = {}
    for f in glob.glob(f'{REPO}/dev/word-list/common-errors/*-done-replacements.json'):
        d = json.load(open(f)); n = re.search(r'/(\d+)-', f).group(1)
        if sum(bool(re.search('[ේෝැෑෘශෂ]', w)) for w in d) > len(d) * .05: continue   # a list of the Sinhala translation
        for a, v in d.items(): R[k(a)] = (k(v['mainWord']), n, v.get('done'))
    return R
def cst_words():
    D = dict(zip('अआइईउऊएओकखगघङचछजझञटठडढणतथदधनपफबभमयरलवसहळंािीुूेो्', 'අආඉඊඋඌඑඔකඛගඝඞචඡජඣඤටඨඩඪණතථදධනපඵබභමයරලවසහළංාිීුූෙෝ'))
    W = collections.Counter()
    for f in glob.glob('/Volumes/2TB/node/critical/pali-sources/cst/deva master/*.mul.xml'):
        t = open(f, 'rb').read().decode('utf-16'); t = re.sub(r'<note>.*?</note>', '', t[t.find('<body'):], flags=re.S); t = re.sub(r'<[^>]+>', ' ', t)
        W.update(re.findall(r'[඀-෿]+', ''.join(D.get(c, c) for c in t)))
    return W
if __name__ == '__main__':
    base, R, W = sys.argv[1], lists(), cst_words()
    cw = lambda w: W[w] + W[w.replace('ඞ්', 'ං').replace('ඤ්ච', 'ංච')]
    out = []
    for pre in sys.argv[2:]:
        for f in sorted(glob.glob(f'{REPO}/public/static/text/{pre}*.json')):
            name = os.path.basename(f)
            try: old = json.loads(subprocess.run(['git', '-C', REPO, 'show', f'{base}:public/static/text/{name}'], capture_output=True, check=True).stdout)
            except Exception: continue
            new = json.load(open(f))
            for pi, (po, pn) in enumerate(zip(old['pages'], new['pages'])):
                for ei, (eo, en) in enumerate(zip(po['pali']['entries'], pn['pali']['entries'])):
                    if eo['text'] == en['text']: continue
                    a, b = eo['text'].split(), en['text'].split()
                    for t, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
                        if t != 'replace' or i2 - i1 != j2 - j1: continue
                        for x, y in zip(a[i1:i2], b[j1:j2]):
                            if k(y) in R and R[k(y)][0] == k(x):
                                out.append(dict(file=name[:-5], page=pi, pageNum=pn['pageNum'], entry=ei, old=x, new=y, list=R[k(y)][1], cstNew=cw(k(y)), cstOld=cw(k(x))))
    json.dump(out, sys.stdout, ensure_ascii=False, indent=0)
