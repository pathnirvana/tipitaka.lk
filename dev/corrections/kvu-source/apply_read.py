"""
Apply the decisions made by reading the Kathāvatthu "need reading" list (decisions-NN.json files, see dossier.py).

Each decision: {k, side, old, new, basis, why, doubt} or {k, keep, why, doubt}.
Checks before anything is written: the entry exists and still reads `old`; footnote marks are kept; in the Sinhala the
bracketed commentary additions are kept (unless a bracket itself is the correction); the change is small.
Decisions that fail a check, and those marked doubt, are listed and not applied, unless read-allow.json
(a list of "<file> <page>:<entry> <side>") passes them after a second look.

usage: python3 dev/corrections/kvu-source/apply_read.py <decisions dir> [--write]
  -> dev/corrections/kvu-source/read-report.json
"""
import difflib, glob, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
TEXT = os.path.join(ROOT, '..', '..', '..', 'public', 'static', 'text')
FN = re.compile(r'\{[^}]*\}')
BR = re.compile(r'\([^()]*\)')


def changed(a, b):
    """number of characters removed + added"""
    n = 0
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op != 'equal': n += (i2 - i1) + (j2 - j1)
    return n


def main(ddir, write):
    cases = {c['k']: c for c in json.load(open(os.path.join(ddir, 'cases.json')))}
    files, applied, kept, doubt, bad, seen, orig = {}, [], [], [], [], set(), {}
    allow = set(json.load(open(os.path.join(ROOT, 'read-allow.json')))) if os.path.exists(os.path.join(ROOT, 'read-allow.json')) else set()
    for f in sorted(glob.glob(os.path.join(ddir, 'decisions-*.json'))):
        for d in json.load(open(f)):
            k = d['k']; seen.add(k); d['src'] = os.path.basename(f)
            if d.get('keep'):
                (doubt if d.get('doubt') else kept).append(d); continue
            fn, pe = k.split(' '); pi, ei = map(int, pe.split(':'))
            if fn not in files: files[fn] = json.load(open(os.path.join(TEXT, fn + '.json')))
            try: e = files[fn]['pages'][pi][{'p': 'pali', 's': 'sinh'}[d['side']]]['entries'][ei]
            except (KeyError, IndexError): d['err'] = 'no such entry'; bad.append(d); continue
            old, new = d['old'], d['new']
            if e['text'] != old:
                # a second decision on the same entry: carry its edits over to the text as it reads now
                cur, ok = e['text'], (k, d['side']) in orig and orig[(k, d['side'])] == old
                if ok:
                    for op, i1, i2, j1, j2 in reversed(difflib.SequenceMatcher(None, old, new, autojunk=False).get_opcodes()):
                        if op == 'equal': continue
                        a, b = max(0, i1 - 8), min(len(old), i2 + 8)
                        if cur.count(old[a:b]) != 1: ok = False; break
                        cur = cur.replace(old[a:b], old[a:i1] + new[j1:j2] + old[i2:b])
                if not ok: d['err'] = 'old text does not match the source'; bad.append(d); continue
                old, new = e['text'], cur
            orig.setdefault((k, d['side']), d['old'])
            if new == old: d['err'] = 'no change'; bad.append(d); continue
            if sorted(FN.findall(old)) != sorted(FN.findall(new)) and f'{k} {d["side"]}' not in allow: d['err'] = 'footnote marks changed'; bad.append(d); continue
            n = changed(old, new); d['n'] = n
            flags = cases.get(k, {}).get('cats', [])
            restore = any(c in ('sinhala-missing', 'sinhala-short', 'label-misaligned') for c in flags) or f'{k} {d["side"]}' in allow
            if d['side'] == 's' and not restore and 'brackets' not in flags and BR.findall(old) != BR.findall(new):
                d['err'] = 'bracketed addition changed'; bad.append(d); continue
            if n > 24 and not restore: d['err'] = f'large change ({n} characters)'; bad.append(d); continue
            if d.get('doubt') and f'{k} {d["side"]}' not in allow: doubt.append(d); continue
            e['text'] = new; applied.append(d)
    missing = sorted(set(cases) - seen)
    rep = dict(applied=applied, kept=kept, doubt=doubt, bad=bad, missing=missing)
    json.dump(rep, open(os.path.join(ROOT, 'read-report.json'), 'w'), ensure_ascii=False, indent=1)
    print('applied', len(applied), '(Pāḷi', sum(d['side'] == 'p' for d in applied), 'Sinhala', sum(d['side'] == 's' for d in applied), ')',
          'kept', len(kept), 'doubt', len(doubt), 'failed a check', len(bad), 'cases with no decision', len(missing))
    if write:
        for fn, d in files.items():
            open(os.path.join(TEXT, fn + '.json'), 'w').write(json.dumps(d, ensure_ascii=False, indent=4))
        print('written', len(files), 'files')


if __name__ == '__main__':
    main(sys.argv[1], '--write' in sys.argv)
