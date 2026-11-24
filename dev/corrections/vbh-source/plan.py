"""
Vibhaṅga: the list of changes to the typed Pāḷi, from decisions.json (print and CST agree against the typed text)
and from the places read on the scans (read.json, keyed by the index in decisions.json).

usage: python3 dev/corrections/vbh-source/plan.py           -> changes.json (nothing is written to the text)
       python3 dev/corrections/vbh-source/plan.py apply     -> writes the changes into public/static/text/ap-vbh*.json
"""
import collections, difflib, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
TEXT = os.path.join(ROOT, '..', '..', '..', 'public', 'static', 'text')
ZW = '‍'
# readings of the scan (dev/corrections/vbh-source/read.json): index in decisions.json -> {'to': words, 'basis': ..., 'note': ...}
READ = {int(k): v for k, v in json.load(open(os.path.join(ROOT, 'read.json'))).items()} if os.path.exists(os.path.join(ROOT, 'read.json')) else {}
EXTRA = json.load(open(os.path.join(ROOT, 'extra.json'))) if os.path.exists(os.path.join(ROOT, 'extra.json')) else []
AUTO = ('print', 'print-len', 'print-vocab', 'print-freq')
SI = re.compile(r'[඀-෿]')


def clean(t):
    t = re.sub(r'\{[^}]*\}', '', t).replace('**', '').replace('__', '')
    return re.sub(r'[​-‍]', '', t)


def letters(w):
    return ''.join(SI.findall(w))


def zwj(w, on):
    return re.sub(r'්([රය])', '්' + ZW + r'\1', w) if on else w


def retoken(raw, new, on):
    """raw token with its letters changed to those of `new`, keeping its punctuation, marks and joiners"""
    pos = [i for i, c in enumerate(raw) if SI.match(c)]
    a, b = letters(raw), letters(new)
    if not pos: return new
    out, last = list(raw), None
    edits = [(t, i1, i2, j1, j2) for t, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes() if t != 'equal']
    for t, i1, i2, j1, j2 in reversed(edits):
        s = pos[i1] if i1 < len(pos) else pos[-1] + 1
        e = pos[i2 - 1] + 1 if i2 > i1 else s
        out[s:e] = list(b[j1:j2])
    w = ''.join(out)
    w = re.sub(r'්' + ZW + r'(?![රය])', '්', w)      # a joiner left without its ra or ya
    return zwj(w.replace(ZW, ''), on) if on else w


def main():
    D = json.load(open(os.path.join(ROOT, 'decisions.json')))
    picks = collections.defaultdict(list)   # (file, page) -> [(i1, i2, new words, id, basis)]
    for i, d in enumerate(D):
        if i in READ:
            if READ[i].get('to') is None: continue
            new, basis = READ[i]['to'], READ[i].get('basis', 'scan')
        elif d['dec'] in AUTO and not re.match(r'\d', d['typed']):
            new, basis = re.sub(r'[¹²³⁴⁵⁶⁷⁸⁹⁰]', '', d['ocr']).replace("'", '’'), {'print': 'print+cst', 'print-len': 'print+cst', 'print-vocab': 'print; typed word not in CST', 'print-freq': 'print; typed word unique'}[d['dec']]
            new = ' '.join(w for w in new.split() if SI.search(w) or any(not SI.search(t) for t in d['typed'].split()))   # stray marks of the OCR
            if not new and not d['typed']: continue
            if re.search(r'[$\[\]{}]', d['typed']): continue                                   # editorial marks of the typed text
            if re.search(r'\d', new) and not re.search(r'\d', d['typed']): continue             # a footnote number read into the word
            if letters(new) == letters(d['typed']): continue                                    # only spacing or punctuation differs
        else: continue
        picks[(d['file'], d['page'])].append((d['ti'][0], d['ti'][1], new.split(), i, basis))
    apply = len(sys.argv) > 1 and sys.argv[1] == 'apply'
    changes, skipped = [], []
    for name in sorted({f for f, _ in picks} | {x[0] for x in EXTRA}):
        path = os.path.join(TEXT, name + '.json')
        data = json.load(open(path))
        for pi, page in enumerate(data['pages']):
            E = page['pali']['entries']
            raw = [e['text'].split() for e in E]
            ok = [len(r) == len(clean(e['text']).split()) for r, e in zip(raw, E)]
            where = [(ei, k) for ei, r in enumerate(raw) for k in range(len(clean(E[ei]['text']).split()))]
            items = collections.defaultdict(list)
            for i1, i2, new, did, basis in sorted(picks.get((name, pi), []), reverse=True):
                ei = where[min(i1, len(where) - 1)][0]
                if i1 == len(where): ei = where[-1][0]
                span = where[i1:i2]
                if not ok[ei] or any(e != ei for e, _ in span): skipped.append((did, name, page['pageNum'])); continue
                on = ZW in E[ei]['text']
                r = raw[ei]
                k1 = where[i1][1] if i1 < len(where) and where[i1][0] == ei else len(r)
                k2 = k1 + (i2 - i1)
                old = r[k1:k2]
                if len(old) == len(new): rep = [retoken(o, n, on) for o, n in zip(old, new)]
                else:
                    rep = [zwj(n, on) for n in new]
                    if old and rep:   # keep the marks around the old span
                        m = re.match(r'^[^඀-෿\d(]*', old[0]).group(0); rep[0] = m + rep[0]
                r[k1:k2] = rep
                items[ei].append(dict(id=did, typed=D[did]['typed'], new=' '.join(new), basis=basis, **({'note': READ[did]['note']} if did in READ and READ[did].get('note') else {})))
            for f, pn, ei, old, new, why, basis, did in EXTRA:
                if f == name and pn == page['pageNum']:
                    t = ' '.join(raw[ei]); assert t.count(old) == 1, (f, pn, ei, t.count(old))
                    raw[ei] = t.replace(old, new).split()
                    items[ei].append(dict(id=did, typed=old, new=new, basis=basis, note=why))
            for ei in sorted(items):
                after = ' '.join(raw[ei])
                if after != E[ei]['text']:
                    changes.append(dict(file=name, page=pi, pageNum=page['pageNum'], entry=ei, before=E[ei]['text'], after=after, items=items[ei][::-1]))
                    if apply: E[ei]['text'] = after
        if apply: open(path, 'w').write(json.dumps(data, ensure_ascii=False, indent=4))
    json.dump(changes, open(os.path.join(ROOT, 'changes.json'), 'w'), ensure_ascii=False, indent=1)
    n = sum(len(c['items']) for c in changes)
    print('entries', len(changes), 'changes', n, collections.Counter(x['basis'] for c in changes for x in c['items']), 'skipped', skipped, 'applied' if apply else 'not applied')


if __name__ == '__main__':
    main()
