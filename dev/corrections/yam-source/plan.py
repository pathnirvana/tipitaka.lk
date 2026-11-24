"""
Yamaka: the list of changes to the typed Pāḷi, from decisions.json (print and CST agree against the typed text)
and from the places read on the scans (READ below, keyed by the index in decisions.json).

usage: python3 dev/corrections/yam-source/plan.py           -> changes.json (nothing is written to the text)
       python3 dev/corrections/yam-source/plan.py apply     -> writes the changes into public/static/text/ap-yam*.json
"""
import collections, difflib, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
TEXT = os.path.join(ROOT, '..', '..', '..', 'public', 'static', 'text')
ZW = '‍'
# pages where the OCR read the columns out of order: nothing automatic there
SKIP_PAGES = {('ap-yam', 38), ('ap-yam', 40), ('ap-yam-10', 52), ('ap-yam-7-5', 578), ('ap-yam-7-5', 594), ('ap-yam-7-5', 596)}
# automatic "print" decisions not taken: headings the typed text numbers, a -පෙ- that helps, words printed on the next page
NOT = {174, 224, 342, 406, 422, 195, 399, 496, 722}
# read on the scan: index -> the words that replace the typed span ('' = remove; for an empty span = insert)
READ = {
    22: 'සොමනස්සවිප්පයුත්ත', 32: 'උප්පජ්ජිස්සති,', 44: 'අරූපාවචරානං', 59: 'උප්පජ්ජිස්සති,', 63: 'උප්පජ්ජිත්ථ.',
    90: 'සොමනස්සවිප්පයුත්තචිත්තස්ස උප්පාදක්ඛණෙ', 91: 'න', 134: 'සොමනස්සින්ද්රියං', 135: 'තස්ස', 166: 'උප්පජ්ජිස්සතී’ති:',
    186: 'අඤ්ඤින්ද්රියඤ්ච', 188: 'චක්ඛුන්ද්රියඤ්ච', 191: 'න', 197: 'අනඤ්ඤාතඤ්ඤස්සාමීති', 212: 'අනඤ්ඤාතඤ්ඤස්සාමීතී’ති:',
    218: 'අනඤ්ඤාතඤ්ඤස්සාමීතින්ද්රියන්ති:', 220: 'නො.', 225: 'නායතනා', 240: 'නූප්පජ්ජති.', 248: 'උප්පජ්ජිස්සතීති',
    275: '(පච්චනීකපුග්ගලොකාස)', 291: 'ධාතූ', 293: 'ධාතූ', 300: 'ධාතූ', 301: 'ධාතූ', 304: 'ධාතූ', 306: 'ධාතූ', 296: 'මනොධාතු',
    327: 'නිරුජ්ඣිත්ථ, මග්ගසච්චඤ්ච', 330: 'උප්පාදවාරෙපි නිරොධවාරෙපි', 338: 'කායසඞ්ඛාරො,', 339: 'වචීසඞ්ඛාරො', 343: 'කායසඞ්ඛාරො',
    344: 'වචීසඞ්ඛාරො', 345: 'චිත්තසඞ්ඛාරො', 348: 'සඞ්ඛාරා,', 341: 'පණ්ණත්තිඋද්දෙසවාරො', 349: 'වචීසඞ්ඛාරොති:', 358: 'වචීසඞ්ඛාරො',
    365: '', 366: '', 373: 'නූප්පජ්ජිස්සති.', 378: 'උප්පජ්ජති', 383: 'අස්සාසපස්සාසෙහි', 385: 'චිත්තසඞ්ඛාරො උප්පජ්ජිස්සතීති:',
    393: '(අනුලොමපුග්ගල)', 395: 'න', 412: 'න නිරුජ්ඣිස්සති. සවිතක්කසවිචාරපච්ඡිමචිත්තස්ස', 414: 'යත්ථ', 418: 'පච්චනීකම්පි විභත්තා',
    427: '75-76.', 473: 'අවිජ්ජානුසයො', 474: 'අවිජ්ජානුසයො', 476: '', 492: 'අරූපධාතුං', 493: 'න', 498: 'අරූපධාතුං', 500: 'රූපධාතුං',
    501: '', 502: 'න', 508: '', 509: 'න අරූපධාතුයා චුතස්ස රූපධාතුං උපපජ්ජන්තස්ස', 520: 'පරිච්ඡින්නුද්දෙසවාරො.', 523: 'අනුසෙතීති:',
    541: 'අනුසෙන්ති. තස්සෙව', 617: 'උප්පජ්ජිස්සති:', 618: 'න', 619: 'නිරුජ්ඣිස්සති', 620: 'උප්පන්නං:', 621: 'න', 622: 'න', 623: 'උප්පජ්ජති:',
    627: '', 628: 'න', 629: 'න', 630: 'න', 650: 'අකුසලවිප්පයුත්තචිත්තස්ස', 652: 'අකුසලා', 654: 'අකුසලා', 670: 'නිරුජ්ඣිස්සන්තීති:',
    673: '', 679: 'නිරුජ්ඣිත්ථාති:', 683: 'උප්පජ්ජන්තීති:', 684: 'උප්පජ්ජන්තීති:', 687: 'අකුසලවිප්පයුත්තචිත්තස්ස', 688: 'නිරුජ්ඣිත්ථ.',
    695: 'කුසලවිප්පයුත්තචිත්තස්ස', 701: 'කුසලමූලමූලකා,', 704: 'එකමූලකානි', 707: 'අකුසලමූලෙන එකමූලමූලකාති:', 737: 'න',
}
# the print itself is wrong here; corrected by the pattern of the pair
PRINT_SLIP = {218: 'the print drops ති too; the next sentence has the full word', 373: 'the print has a garbled word; the clause before it gives the verb',
              695: 'the print has කුසලා; everywhere else කුසලවිප්පයුත්තචිත්තස්ස'}
# changes on pages with no usable alignment: (file, pageNum, entry, old, new, why)
EXTRA = [
    ('ap-yam-7-5', 596, 3, 'චුතස්ස න අරූපධාතුං', 'චුතස්ස න රූපධාතුං', 'print; 68 repeated the wording of 69'),
    ('ap-yam-8', 612, 19, 'තං චිත්තං නිරුජ්ඣිස්සති:', 'තං චිත්තං න නිරුජ්ඣිස්සති:', 'print slip: the print lacks this න too, but the reverse question and paragraph 56 require it'),
]
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
        if i in READ: new, basis = READ[i], 'print slip' if i in PRINT_SLIP else 'scan'
        elif d['dec'] in ('print', 'print-len') and i not in NOT and (d['file'], d['pageNum']) not in SKIP_PAGES and not re.match(r'\d', d['typed']):
            new, basis = re.sub(r'[¹²³⁴⁵⁶⁷⁸⁹⁰]', '', d['ocr']).replace("'", '’'), 'print+cst'
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
                items[ei].append(dict(id=did, typed=D[did]['typed'], new=' '.join(new), basis=basis, **({'note': PRINT_SLIP[did]} if did in PRINT_SLIP else {})))
            for f, pn, ei, old, new, why in EXTRA:
                if f == name and pn == page['pageNum']:
                    t = ' '.join(raw[ei]); assert t.count(old) == 1, (f, pn, ei)
                    raw[ei] = t.replace(old, new).split()
                    items[ei].append(dict(id=None, typed=old, new=new, basis='print slip' if 'slip' in why else 'scan', note=why))
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
