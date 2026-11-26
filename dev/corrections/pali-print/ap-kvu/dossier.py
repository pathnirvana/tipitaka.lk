"""
Case files for the Kathāvatthu "need reading" list (report.json -> manual), with the OCR of the printed pages.

For every listed entry: the Pāḷi and Sinhala text, the entries around it, and the OCR lines of the Pāḷi scan page
and the Sinhala scan page that match it (misc-ai/bjt-scans/ocr/<bookId>/<prefix><nnn>.json).

usage: python3 dev/corrections/pali-print/ap-kvu/dossier.py <out dir> [batch size]
"""
import difflib, glob, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
TEXT = os.path.join(ROOT, '..', '..', '..', '..', 'public', 'static', 'text')
OCR = '/Volumes/2TB/node/misc-ai/bjt-scans/ocr'
BOOK = {48: ('AP04_Page_', 29), 49: ('AP05_Page_', 11), 50: ('AP06_Page_', 11)}
CTX = 4   # entries before and after


def clean(t):
    t = re.sub(r'\{[^}]*\}', '', t).replace('**', '').replace('__', '')
    return re.sub(r'[​-‍]', '', t)


def ocr_lines(book, page_num):
    prefix, off = BOOK[book]
    f = os.path.join(OCR, str(book), f'{prefix}{off + page_num:03d}.json')
    if not os.path.exists(f): return None
    return [clean(l['text']) for l in json.load(open(f))['lines']]


def match_lines(entry, lines, lo=0):
    """The run of OCR lines that covers the entry: the first good run from line lo on, else the best one."""
    e = re.sub(r'\s+', '', clean(entry))
    if not e or not lines: return None
    best = None
    for i in range(lo, len(lines)):
        acc, here = '', None
        for j in range(i, min(len(lines), i + 40)):
            acc += re.sub(r'\s+', '', lines[j]).rstrip('-')
            if len(acc) < 0.6 * len(e): continue
            r = difflib.SequenceMatcher(None, e, acc, autojunk=False).ratio()
            if here is None or r > here[0] + 1e-9: here = (r, i, j)
            if len(acc) > 1.5 * len(e) + 20: break
        if here and here[0] >= 0.85: return here          # entries are in page order: take the first good run
        if here and (best is None or here[0] > best[0]): best = here
    return best


def page_matches(entries, lines):
    """Entries of a page matched to OCR lines in order."""
    out, lo = [], 0
    for t in entries:
        m = match_lines(t, lines, lo) if lines else None
        if m and m[0] >= 0.85:
            out.append(m); lo = m[2] + 1
        elif m and m[0] >= 0.55: out.append(m)         # weak match: shown, but the search position stays
        else: out.append(None)
    return out


def main(out, size):
    rep = json.load(open(os.path.join(ROOT, 'report.json')))
    by = {}
    for m in rep['manual']: by.setdefault(m['k'], []).append(m)
    files, cache = {}, {}
    cases = []
    for k, ms in by.items():
        f, pe = k.split(' '); pi, ei = map(int, pe.split(':'))
        if f not in files: files[f] = json.load(open(os.path.join(TEXT, f + '.json')))
        d = files[f]; pg = d['pages'][pi]
        pe_, se_ = pg['pali']['entries'], pg['sinh']['entries']
        if (f, pi) not in cache:
            lp, ls = ocr_lines(d['bookId'], pg['pageNum']), ocr_lines(d['bookId'], pg['pageNum'] + 1)
            cache[(f, pi)] = (lp, ls, page_matches([x['text'] for x in pe_], lp), page_matches([x['text'] for x in se_], ls))
        lp, ls, mp, ms_ = cache[(f, pi)]

        def seg(lines, m, idx):
            if not lines: return '(no OCR for this page)'
            if not m[idx]: return '(not found in the OCR; whole page follows)\n' + '\n'.join(lines)
            r, a, b = m[idx]
            return f'(match {r:.2f})\n' + '\n'.join(('  ' if a <= n <= b else '~ ') + lines[n] for n in range(max(0, a - 1), min(len(lines), b + 2)))

        # context: flat list over neighbouring pages
        flat = []
        for qi in range(max(0, pi - 1), min(len(d['pages']), pi + 2)):
            q = d['pages'][qi]
            for n, (a, b) in enumerate(zip(q['pali']['entries'], q['sinh']['entries'])):
                flat.append((qi, n, a, b))
        at = next(n for n, x in enumerate(flat) if x[0] == pi and x[1] == ei)
        ctx = []
        for qi, n, a, b in flat[max(0, at - CTX): at + CTX + 1]:
            mark = '>>' if (qi, n) == (pi, ei) else '  '
            cut = (lambda x: x) if (qi, n) == (pi, ei) else (lambda x: x if len(x) <= 320 else x[:150] + ' […cut…] ' + x[-150:])
            ctx.append(f'{mark} [{qi}:{n}] ({a["type"]})\n     P: {cut(a["text"])}\n     S: {cut(b["text"])}')
        cases.append(dict(k=k, f=f, pi=pi, ei=ei, cats=[m['cat'] for m in ms], notes=[m['note'] for m in ms],
                          p=pe_[ei]['text'], s=se_[ei]['text'], ctx='\n'.join(ctx),
                          ocr_p=seg(lp, mp, ei), ocr_s=seg(ls, ms_, ei), pn=pg['pageNum']))
    cases.sort(key=lambda c: (c['f'], c['pi'], c['ei']))
    os.makedirs(out, exist_ok=True)
    json.dump(cases, open(os.path.join(out, 'cases.json'), 'w'), ensure_ascii=False, indent=1)
    nb = 0
    for i in range(0, len(cases), size):
        nb += 1
        with open(os.path.join(out, f'batch-{nb:02d}.txt'), 'w') as w:
            for c in cases[i:i + size]:
                w.write(f'===== CASE {c["k"]}   (BJT page {c["pn"]} Pāḷi / {c["pn"] + 1} Sinhala)\n')
                for cat, note in zip(c['cats'], c['notes']): w.write(f'FLAG {cat}: {note}\n')
                w.write(f'OCR of the printed Pāḷi page {c["ocr_p"]}\nOCR of the printed Sinhala page {c["ocr_s"]}\n')
                w.write(f'CONTEXT (entries around it, >> marks the case):\n{c["ctx"]}\n\n')
    print(len(cases), 'cases,', nb, 'batches')


if __name__ == '__main__':
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 40)
