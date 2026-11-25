"""
Khuddaka Nikāya: the typed Pāḷi against the OCR of the printed pages, word by word.

For every Pāḷi page of kn-<book>*.json the typed entries are aligned with the OCR lines of its scan page
(dev/ocr/<bookId>/<prefix>_Page_<pageNum + offset>.json) and every deviation is listed with a kind:

  space   the same letters, divided into words differently
  punct   only punctuation differs (counted, not listed)
  edge    OCR-only words at the top or bottom of the page (running head, page number, footnote)
  num     a paragraph number differs
  char    one word against one word, 1-2 letters apart
  word    anything else: other words, words missing on one side

usage: python3 dev/corrections/kn-source/diff.py <book>      -> <book>/deviations.json + a summary   (book: khp, dhp, ...)
"""
import collections, difflib, glob, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
TEXT = os.path.join(ROOT, '..', '..', '..', 'public', 'static', 'text')
OCR = os.path.join(ROOT, '..', '..', 'ocr')
# bookId -> (scan file prefix, scan page of printed page 0)
BOOK = {28: ('KN1_Page_', 25), 29: ('KN2_Page_', 17), 30: ('KN3_Page_', 17), 31: ('KN4_Page_', 31)}
SI = re.compile(r'[඀-෿]')
PUNCT = '.,:;?!\'"‘’“”()[]{}-–—…*_¹²³⁴⁵⁶⁷⁸⁹⁰'


def clean(t):
    t = re.sub(r'\{[^}]*\}', '', t).replace('**', '').replace('__', '')
    t = re.sub(r'(\d+\.) ?\(\d+\)', r'\1', t)   # 6.(26): the running verse number is printed at the end of the line
    return re.sub(r'[​-‍]', '', t)


def key(w):
    w = re.sub("[’‘'\"“”¹²³⁴⁵⁶⁷⁸⁹⁰†*]", '', w)
    if SI.search(w): w = re.sub(r'\d+', '', w)   # a footnote number set against the word
    return w.strip(PUNCT)


def typed_tokens(page):
    out = []   # (word, entry index)
    for i, e in enumerate(page['pali']['entries']):
        for w in clean(e['text']).split(): out.append((w, i))
    return out


def ocr_tokens(book, page_num):   # page_num already includes the file's pageOffset
    prefix, off = BOOK[book]
    f = os.path.join(OCR, str(book), f'{prefix}{off + page_num:03d}.json')
    if not os.path.exists(f): return None
    out, carry = [], ''   # (word, line n, conf)
    for l in json.load(open(f))['lines']:
        if l['role'] == 'footnote': continue
        ws = clean(l['text']).split()
        # the running verse number at either end of a verse line, often glued to the word: සොචති15, 38 පරිප්ලව, 4.(3
        ws = [re.sub(r'(?<=[඀-෿.])\d+\.?$', '', w) if SI.search(w) else w for w in ws]
        ws = [w for k, w in enumerate(ws) if not (k and re.fullmatch(r'[\d().]+', w))]
        if ws and re.fullmatch(r'\d{2,3}', ws[0]) and len(ws) > 1: ws = ws[1:]
        ws = [re.sub(r'^(\d+\.)[\d()]+$', r'\1', w) for w in ws]
        if not ws: continue
        if carry: ws[0] = carry + ws[0]; carry = ''
        if ws[-1].endswith('-') and not ws[-1].endswith('පෙ-') and len(ws[-1]) > 1 and not ws[-1][-2].isdigit():
            carry = ws.pop()[:-1]
        for w in ws: out.append((w, l['n'], l['conf']))
    if carry: out.append((carry, -1, 0))
    return out


def lev(a, b):
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1): cur.append(min(prev[j] + 1, cur[-1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def verdict(k, ft, fo):
    """a first sorting by how often each side's words occur in the typed book"""
    if k in ('space', 'edge', 'num'): return k
    t, o = min(ft or [0]), min(fo or [0])
    if not ft or not fo: return 'missing-in-ocr' if not fo else 'missing-in-typed'
    if o == 0 and t >= 3: return 'ocr-noise'
    if t <= 2 and o >= 3: return 'typed-suspect'
    if t >= 3 and o >= 3: return 'both-real'
    return 'unclear'


def kind(tw, ow, i1, i2, nt):
    tk, ok = [key(w) for w in tw], [key(w) for w in ow]
    tk2, ok2 = [k for k in tk if k], [k for k in ok if k]
    if tk2 == ok2: return 'punct'
    if ''.join(tk2) == ''.join(ok2): return 'space'
    if not tw and (i1 == 0 or i1 == nt): return 'edge'
    if all(re.fullmatch(r'[\d\-–]*', k) for k in tk2 + ok2): return 'num'
    if len(tk2) == 1 and len(ok2) == 1 and lev(tk2[0], ok2[0]) <= 2: return 'char'
    return 'word'


def main():
    book = sys.argv[1]
    freq = collections.Counter()
    files = sorted(glob.glob(os.path.join(TEXT, f'kn-{book}*.json')))
    data = {os.path.basename(f)[:-5]: json.load(open(f)) for f in files}
    for d in data.values():
        for p in d['pages']:
            for w, _ in typed_tokens(p): freq[key(w)] += 1
    devs, counts, sorts, nopage, ratios = [], collections.Counter(), collections.Counter(), [], []
    for name, d in data.items():
        for pi, p in enumerate(d['pages']):
            T = typed_tokens(p)
            if not T: continue
            O = ocr_tokens(d['bookId'], p['pageNum'] + d.get('pageOffset', 0))
            if O is None: nopage.append((name, pi, p['pageNum'])); continue
            tk, ok = [key(w) for w, _ in T], [key(w) for w, *_ in O]
            sm = difflib.SequenceMatcher(None, tk, ok, autojunk=False)
            ratios.append((round(sm.ratio(), 3), name, pi, p['pageNum']))
            ops = sm.get_opcodes()
            for n, (tag, i1, i2, j1, j2) in enumerate(ops):
                tw, ow = [w for w, _ in T[i1:i2]], [w for w, *_ in O[j1:j2]]
                if tag == 'equal':
                    counts['punct'] += sum(a != b for a, b in zip(tw, ow))
                    continue
                k = kind(tw, ow, i1, i2, len(T))
                counts[k] += 1
                if k == 'punct': continue
                ei = T[min(i1, len(T) - 1)][1]
                conf = min([c for *_, c in O[j1:j2]] or [1])
                ctx = ' '.join(w for w, _ in T[max(0, i1 - 4):i1]) + ' [[' + ' '.join(tw) + ']] ' + ' '.join(w for w, _ in T[i2:i2 + 4])
                ft, fo = [freq[key(w)] for w in tw if key(w)], [freq[key(w)] for w in ow if key(w)]
                v = verdict(k, ft, fo); sorts[v] += 1
                devs.append(dict(file=name, page=pi, pageNum=p['pageNum'], entry=ei, kind=k, sort=v, typed=' '.join(tw), ocr=' '.join(ow),
                                 conf=conf, line=O[j1][1] if j1 < len(O) else -1, ft=ft, fo=fo, ctx=ctx, ti=[i1, i2],
                                 before=[w for w, _ in T[max(0, i1 - 8):i1]], after=[w for w, _ in T[i2:i2 + 8]]))
    os.makedirs(os.path.join(ROOT, book), exist_ok=True)
    json.dump(devs, open(os.path.join(ROOT, book, 'deviations.json'), 'w'), ensure_ascii=False, indent=1)
    print('pages compared', len(ratios), 'no scan page', nopage)
    print('lowest page ratios', sorted(ratios)[:12])
    print('counts', dict(counts))
    print('sorts', dict(sorts))


if __name__ == '__main__':
    main()
