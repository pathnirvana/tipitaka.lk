"""
Vibhaṅga: a first decision for every deviation of diff.py, with the CST text as a third witness.

The typed reading and the print (OCR) reading are each put back into the typed words around them and looked up
in the CST Vibhaṅga (abh01m, Devanāgarī, converted to Sinhala letters; spaces, punctuation and vowel length ignored).

  print   OCR and CST agree against the typed text      -> take the print
  typed   CST has the typed reading, not the OCR one    -> keep the typed text
  read    CST has both or neither                       -> the scan has to be read

usage: python3 dev/corrections/vbh-source/decide.py   -> decisions.json + a summary
"""
import collections, json, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
CST = '/Volumes/2TB/node/critical/pali-sources/cst/deva master/abh0%dm.mul.xml'
DEVA = dict(zip('अआइईउऊएओकखगघङचछजझञटठडढणतथदधनपफबभमयरलवसहळंािीुूेो्', 'අආඉඊඋඌඑඔකඛගඝඞචඡජඣඤටඨඩඪණතථදධනපඵබභමයරලවසහළංාිීුූෙෝ'))


def exact(t):
    return re.sub(r'[^\u0d80-\u0dff]', '', re.sub(r'\{[^}]*\}', '', t))   # Sinhala letters only


def norm(t):
    return exact(t).replace('ූ', 'ු').replace('ී', 'ි').replace('ඊ', 'ඉ').replace('ඌ', 'උ')


def cst():
    out = []
    for n in (2,):
        t = open(CST % n, 'rb').read().decode('utf-16')
        t = t[t.find('<body'):]
        t = re.sub(r'<note>.*?</note>', '', t, flags=re.S)
        t = re.sub(r'<[^>]+>', ' ', t)
        out.append(''.join(DEVA.get(c, c) for c in t))
    return ' '.join(out)


def main():
    CX = exact(cst()); C = norm(CX)
    D = json.load(open(os.path.join(ROOT, 'deviations.json')))
    pages = collections.defaultdict(list)
    for d in D: pages[(d['file'], d['page'])].append(d)
    out, tally = [], collections.Counter()
    for d in D:
        if d['sort'] in ('space', 'edge', 'ocr-noise'): continue
        # a block that only moved on the page (columns read in another order)
        sib = pages[(d['file'], d['page'])]
        if len(norm(d['typed'] + d['ocr'])) > 12 and (not d['typed'] or not d['ocr']):
            me = norm(d['typed'] or d['ocr'])
            if any(x is not d and me in norm(x['ocr'] if d['typed'] else x['typed']) for x in sib): tally['moved'] += 1; continue
        ev = {}
        for k in (6, 3, 1):
            b, a = ''.join(d['before'][-k:]), ''.join(d['after'][:k])
            ev[k] = (C.count(norm(b + d['typed'] + a)), C.count(norm(b + d['ocr'] + a)))
        ct, cp = next((ev[k] for k in (6, 3, 1) if any(ev[k])), (0, 0))
        nt, no = norm(d['typed']), norm(d['ocr'])
        abbr = lambda x: bool(re.search(r'-[.,:]?(\s|$)', x.replace('-පෙ-', '')))
        long_ = max(len(d['typed'].split()), len(d['ocr'].split())) >= 3 and (not d['typed'] or not d['ocr'])
        if d['kind'] == 'num': dec = 'num'
        elif abbr(d['typed']) and abbr(d['ocr']) and len(d['typed'].split()) == 1 == len(d['ocr'].split()) and (nt.startswith(no) or no.startswith(nt)): dec = 'abbr'   # a word cut short at a different letter
        elif long_: dec = 'read-long'      # a clause on one side only: the OCR may have skipped or repeated a line
        elif nt != no and len(d['typed'].split()) == 1 == len(d['ocr'].split()) and not any((ct, cp)) and len(nt) > 4 and len(no) > 4 \
                and (C.count(nt) == 0) != (C.count(no) == 0) and max(C.count(nt), C.count(no)) >= 3:
            dec = 'print-vocab' if C.count(nt) == 0 else 'typed'      # one of the two words occurs nowhere in the CST Vibhaṅga
        elif norm(d['typed']) == norm(d['ocr']):      # only vowel length differs: look it up with the length kept
            b, a = ''.join(d['before'][-1:]), ''.join(d['after'][:1])
            xt, xp = CX.count(exact(b + d['typed'] + a)), CX.count(exact(b + d['ocr'] + a))
            ev['x'] = (xt, xp)
            ft, fo = min(d['ft'] or [0]), min(d['fo'] or [0])
            dec = 'print' if (xp and not xt) or (not xt and fo >= 10 * max(ft, 1)) else 'typed' if (xt and not xp) or (not xp and ft >= 10 * max(fo, 1)) else 'read'
            dec += '-len'
        elif cp and not ct: dec = 'print'
        elif ct and not cp: dec = 'typed'
        elif cp > 5 * ct and cp >= 5: dec = 'print?'
        elif ct > 5 * cp and ct >= 5: dec = 'typed?'
        else: dec = 'read'
        if dec in ('read', 'read-len') and d['kind'] == 'char' and nt != no and max(d['ft'] or [9]) <= 2 and min(d['fo'] or [0]) >= 20:
            dec = 'print-freq'      # the typed word is all but unique in the typed Vibhaṅga, the printed one is common
        tally[dec] += 1
        out.append(dict(d, cst=ev, dec=dec))
    json.dump(out, open(os.path.join(ROOT, 'decisions.json'), 'w'), ensure_ascii=False, indent=1)
    print(len(C), dict(tally))
    print(collections.Counter((d['sort'], d['dec']) for d in out))


if __name__ == '__main__':
    main()
