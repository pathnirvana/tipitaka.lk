"""
Khuddaka Nikāya: the list of changes to the typed Pāḷi of one book, from <book>/decisions.json (print and CST agree
against the typed text) and from the places read on the scans (READ below, keyed by the index in decisions.json).

usage: python3 dev/corrections/kn-source/plan.py <book>           -> <book>/changes.json (nothing is written to the text)
       python3 dev/corrections/kn-source/plan.py <book> apply     -> writes the changes into public/static/text/kn-<book>*.json
"""
import collections, difflib, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
TEXT = os.path.join(ROOT, '..', '..', '..', 'public', 'static', 'text')
BOOKNAME = sys.argv[1]
ZW = '‍'
SKIP_PAGES = set()
# automatic "print" decisions not taken (headings; පුබ්බණ්හ, where the scan has න්හ and only the OCR wrote ණ්හ)
NOT = {'ud': {155, 303, 359, 374, 396}, 'iti': {0, 20}, 'snp': {877}, 'vv': {0, 107, 155, 142, 189}, 'pv': {91, 129}, 'thag': {84, 150, 168, 241, 76, 81}, 'bv': {0, 11, 225}, 'cp': {0, 24, 45, 59, 62, 78, 81}}.get(BOOKNAME, set())
# read on the scan: index -> the words that replace the typed span ('' = remove; for an empty span = insert;
# a leading '=' replaces the typed words whole, punctuation included)
# khp and dhp were applied from an earlier decisions.json (see their changes.json); their indexes are not kept here.
READ = {
    'ud': {
        4: 'එකං', 17: 'ලොකස්මිං', 19: 'පිප්ඵලිගුහායං', 117: 'පිප්ඵලිගුහායං', 32: 'සො', 35: 'උභයමන්තරෙ.', 37: 'කරිත්වා',
        42: 'ඩංසමකසවාතාතපසිරිංසපසම්ඵස්සො”ති.', 54: 'ඵුසෙය්යුං', 63: 'ඉධූපසඞ්කන්තා', 64: 'ඉධූපසඞ්කන්තා', 68: 'සො', 69: 'තං', 70: '', 71: '',
        75: 'යාපනීයං.', 80: 'උදානෙති:', 82: '=අහං', 89: 'ච', 90: 'බාහාය', 92: 'ච', 102: '=“එවං', 109: 'උද්ධතො', 140: 'ඛො', 141: '', 144: 'අඤ්ඤො',
        146: 'වතම්හි', 147: '=විහිංසාවිතක්කෙනා”ති.', 157: 'අප්පොදකපායාසෙන', 161: 'සීසෙ', 162: 'සීසෙ', 167: 'අප්පහරිතඤ්ච', 177: 'රථියා',
        179: 'පවිසිංසු.', 304: 'පවිසිංසු.', 331: 'පවිසිංසු.', 183: 'භගවන්තං', 199: 'දක්ඛින්තී”ති. එවමෙව', 217: 'සූචිඝටිකං', 223: 'මහාසමුද්දස්ස',
        234: 'මෙ', 244: 'මහාකච්චායනස්ස', 255: 'මහාකච්චායනං', 256: 'මහාකච්චායනං', 245: 'පතිසල්ලීණස්ස', 248: 'පතිසල්ලීණස්ස', 249: 'පතිසල්ලීණස්ස',
        246: 'අගාරිකභූතො', 247: 'පටිප්පස්සම්භි.', 253: 'ආයස්මන්තං', 270: 'තස්සුද්දානං:', 275: 'ධම්මානුධම්මපටිපන්නා සාමීචිපටිපන්නා',
        276: 'ධම්මානුධම්මපටිපන්නා', 279: 'සාවිකා', 287: 'ඔතිණ්ණං', 306: 'සාවත්ථියං', 308: 'දෙවො', 326: 'එවංදිට්ඨිනො:', 
        352: '', 369: '', 375: 'සාවත්ථිං', 380: '', 387: 'පපඤ්චසඤ්ඤාසඞ්ඛාපහාණං', 393: 'අඤ්ඤතරං', 397: 'හොන්ති', 400: 'අට්ඨි', 408: 'අට්ඨි',
        411: 'අට්ඨි', 417: 'යෙනඤ්ඤතරං', 418: 'සීතිං', 419: 'පුරෙක්ඛතො', 421: 'සඤ්ඤමතො', 432: 'අනුබද්ධා', 433: 'සම්මිඤ්ජෙය්ය,', 439: 'කාලකතා',
        440: 'කාලකතා',
    },
    'iti': {
        12: '=සබ්බං', 22: 'තමොක්ඛන්ධං', 25: 'එවමාදීනවං', 28: '', 34: 'චෙතොපදොසහෙතු', 35: 'තස්සුද්දානං:', 51: 'තස්සුද්දානං:', 132: 'තස්සුද්දානං:',
        36: 'අවිජ්ජා', 49: 'විජෙත්වා', 57: 'ධම්මං', 67: '', 70: '', 75: 'නිබ්බාණොගධගාමිනං.', 79: 'සංවිජ්ජෙතෙව පණ්ඩිතො', 86: 'අවිජ්ජාමූලකා',
        95: 'කතමා', 107: '', 114: 'න', 115: '', 130: 'ච', 135: 'තස්ස', 137: 'භවසඤ්ඤොජනක්ඛයා.', 142: 'දොසසඤ්හිතං.', 149: 'චරියං',
        169: '=සෙවමානං', 174: 'පච්චුප්පන්නං', 183: 'අභිඤ්ඤාය', 189: '=සබ්යඤ්ජනං', 203: 'උපපජ්ජතු,', 205: 'දිපදා', 207: 'නිබ්බාණං.',
        222: '=අනෙජස්ස නිබ්බුතස්ස නිබ්බුතො,', 227: '“සත්තසඞ්ගපහීණස්ස නෙත්තිච්ඡින්නස්ස', 235: 'සබ්බප්පහායිනන්ති”.', 240: 'එවංසුඛදුක්ඛපටිසංවෙදී',
        241: 'උපපාදිං.', 248: 'අප්පං ච සුලභං ච', 250: '', 256: '=සද්ධම්මං', 262: 'පුබ්බදෙවා’ති', 263: 'බහූපකාරා', 264: 'සක්කරෙය්යාථ', 273: 'න',
        274: 'එවම්භූතො', 276: 'එවම්භූතො', 278: 'එවම්භූතො', 286: 'එවම්භූතො', 289: 'ඔත්තප්පී', 294: 'ඵුට්ඨස්ස',
    },
    'snp': {
        11: 'නානාසකත්තං', 41: 'සයනෙභාවසථෙහි ච ඵීතා', 65: 'තාරයෙතුං. 322.', 79: 'සන්තිසොරච්චසමාධිසණ්ඨිතා', 82: 'හි', 109: 'වීතිවත්තො',
        173: 'චෙ', 203: 'දක්ඛින්තීති,', 207: 'ද්වින්නම්පි', 326: 'චෙනං', 327: 'භීයස්සුප්පජ්ජතෙ', 335: 'සඤ්ඤපෙතුං.', 395: 'මනුස්සලොකෙ',
        406: 'ලක්ඛණමන්තපාරගු,', 413: 'අන්තෙපුරම්හා', 429: 'චෙ', 463: 'ච', 471: 'උපාදානාරම්භා', 509: 'තිස්සමෙත්තෙය්යසුත්තං', 527: 'විසුද්ධිමාහ',
        534: 'එලම්බුජං', 563: 'සංසුද්ධපඤ්ඤා', 624: 'සප්පරියන්තචාරිං,', 644: 'විවත්තච්ඡද්දො', 645: 'භද්රාවුධො', 647: 'කොසම්බිං', 667: 'කොධ',
        668: 'මෙත්තෙය්යො.)', 690: 'තිට්ඨෙ චෙ', 733: 'මෙ', 783: 'බලූපපන්නො', 794: 'කසිත්වාන', 838: 'මන්තබන්ධුනො.', 840: 'දිට්ඨෙව',
        383: '669. නහි', 403: 'චාමරඡත්තගාහකා. 692.', 486: '4. සුද්ධට්ඨකසුත්තං 792.', 610: '4. 15. අත්තදණ්ඩ', 269: 'පමොදිතො',
        103: 'අක්කුට්ඨොපි', 358: 'නන්දිභවපරික්ඛීණං', 650: 'පරිපූරිං', 802: 'සාරථීනං', 822: 'ඉස්සරියස්මිං', 855: 'ඛීණව්යප්පථො,', 869: 'සුවුට්ඨිතං,',
        407: 'අස්සුකානි,', 633: 'ගොධාවරීකූලෙ', 679: 'නූපධිකං,', 289: 'පාරගූ',
    },
    'vv': {
        34: 'තන්ත්යාභිනන්දාමසෙ', 46: 'උපපන්නම්හි', 47: 'යසසා', 129: '=ඵලන්ති.', 136: 'සෙහි', 142: '=තුය්හං න්විදං', 146: 'පසාදයිං චිත්තාමහං',
        166: 'සුවණ්ණච්ඡදනා.', 246: 'ථම්භා', 254: 'අධිට්ඨහාථාති.', 18: 'උපපජ්ජති', 10: 'ඨිතං', 24: 'වෙළුරියත්ථම්භං', 49: 'භද්දිත්ථීති',
        87: 'සමචරියායං', 93: 'මුදිතමනා', 203: 'බහූසු', 258: 'සෙරිස්සකා',
    },
    'pv': {
        6: 'ව', 14: 'කින්නු', 30: 'අනව්හිතො', 31: 'නානුඤ්ඤාතො', 52: 'තිදසානං', 60: 'අහමපි', 64: 'පරමිද්ධිප්පත්තො', 67: 'ධනහාරකා,', 80: 'පානීයං.',
        108: 'මීළ්හං', 126: 'ධාතුවිවණ්ණිකපෙතවත්ථු', 47: 'පරිවාරෙන්ති', 105: 'වෙදනීයං', 136: 'ජුතීමා.', 154: 'පාසාදසොපානඵලූපපන්නො,', 158: 'දට්ඨුකාම්හ',
        166: 'භික්ඛු',
    },
    'thag': {
        7: 'වයඤ්චස්සානුපස්සතී’ති.', 79: 'මානපථං', 132: 'කුමාපුත්තො', 133: 'කුමාපුත්තත්ථෙරගාථා.', 210: 'දුතියාභිසෙචන’න්ති.', 230: 'වච්ඡගොත්තො',
        252: '=සමතිවිජ්ඣතී’ති.', 313: 'සුනික්ඛමො', 364: '=දෙවා’ති.', 381: 'කුටිකණ්ණත්ථෙරො', 72: 'මංසනහාරුසිබ්බිතෙ,', 246: 'පිණ්ඩොලභාරද්වාජත්ථෙරගාථා.',
        11: 'රජමූහතං', 45: 'අහිරිකා', 336: 'නෙවසඤ්ඤීසු', 456: 'දදන්ති,',
    },
    'thig': {
        63: 'නහාපනුච්ඡාදනෙහි', 76: 'භද්දාකුණ්ඩලකෙසාථෙරීගාථා.', 94: 'දුක්ඛක්ඛන්ධං', 116: 'තෙහානුචිණ්ණං', 143: 'කාළො', 147: 'අරියඤ්චට්ඨඞ්ගිකං',
        177: 'මරිතායෙ', 181: 'කුච්ඡිම්හි', 195: 'ඵෙණපිණ්ඩොපමස්ස කායකලිනො', 200: 'සඞ්ඛාරගතෙ',
    },
    'bv': {
        5: 'පරස්මිඤ්චොභයස්මිං', 21: '=බහුං.', 27: 'නිරාකුලා', 42: 'න', 50: 'භවත්වන්තරායො', 60: 'කොණ්ඩඤ්ඤො', 69: 'සභාවන්තං දස්සයිත්වා',
        96: 'වසවත්තීමහිස්සරො.', 108: 'අසමා', 126: 'අසමා', 226: 'අසමා', 165: 'මං', 195: 'අප්ඵොටෙන්ති', 203: 'අප්ඵොටෙන්ති', 216: 'අප්ඵොටෙන්ති',
        199: 'කකුසන්ධ', 217: 'ධම්මපුප්ඵපිලන්ධනං.', 41: 'චතූසු', 61: 'උළූහි',
    },
    'cp': {
        25: 'කොට්ටෙය්යුං ඵරසූහි', 27: 'මම', 18: 'පබ්බතං.', 20: 'තිණපණ්ණසාකඵලභක්ඛො', 43: 'රුරුමාතඞ්ගො', 47: 'අනපෙක්ඛො', 75: 'අකාසිං',
        42: 'භොජපුත්තෙ', 28: 'පක්ඛිපන්තම්හි',
    },
}.get(BOOKNAME, {})
PRINT_SLIP = {}
# changes outside the aligned spans: (file, pageNum, entry, old, new, why)
EXTRA = [('kn-ud', 266, e, 'මතොගධං', 'තමොගධං', 'scan; also in the errata list of the volume') for e in (-1,)] if BOOKNAME == 'ud' else []
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
    D = json.load(open(os.path.join(ROOT, BOOKNAME, 'decisions.json')))
    picks = collections.defaultdict(list)   # (file, page) -> [(i1, i2, new words, id, basis)]
    for i, d in enumerate(D):
        if i in READ: new, basis = READ[i], 'print slip' if i in PRINT_SLIP else 'scan'
        elif d['dec'] in ('print', 'print-len') and i not in NOT and (d['file'], d['pageNum']) not in SKIP_PAGES and not re.match(r'\d', d['typed']):
            new, basis = re.sub(r'[¹²³⁴⁵⁶⁷⁸⁹⁰]', '', d['ocr']).replace("'", '’'), 'print+cst'
        else: continue
        picks[(d['file'], d['page'])].append((d['ti'][0], d['ti'][1], new.split(), i, basis))
    apply = len(sys.argv) > 2 and sys.argv[2] == 'apply'
    changes, skipped = [], []
    for name in sorted({f for f, _ in picks} | {x[0] for x in EXTRA}):
        path = os.path.join(TEXT, name + '.json')
        data = json.load(open(path))
        for pi, page in enumerate(data['pages']):
            E = page['pali']['entries']
            # every entry as words and the white space between them (verse lines are kept), and the place of each compared word
            raw = [re.split(r'(\s+)', e['text']) for e in E]
            where = [(ei, k) for ei, r in enumerate(raw) for k, w in enumerate(r) if w.strip() and clean(w).strip()]
            assert len(where) == sum(len(clean(e['text']).split()) for e in E), (name, pi)
            items = collections.defaultdict(list)
            for i1, i2, new, did, basis in sorted(picks.get((name, pi), []), reverse=True):
                span = where[i1:i2]
                whole = bool(new) and new[0].startswith('=')
                if whole: new = [new[0][1:]] + new[1:]
                if not span and new:      # a word the typed text lacks: set before the word that follows it
                    ei, k = where[i1] if i1 < len(where) else (where[-1][0], len(raw[where[-1][0]]))
                    on = ZW in E[ei]['text']
                    ins = ' '.join(zwj(n, on) for n in new)
                    if k < len(raw[ei]): raw[ei][k] = ins + ' ' + raw[ei][k]
                    else: raw[ei].append(' ' + ins)
                    items[ei].append(dict(id=did, typed='', new=' '.join(new), basis=basis)); continue
                ei = span[0][0] if span else -1
                if not span or any(e != ei for e, _ in span): skipped.append((did, name, page['pageNum'])); continue
                on = ZW in E[ei]['text']
                r = raw[ei]
                ks = [k for _, k in span]
                if len(ks) == len(new) and not whole:
                    for k, n in zip(ks, new):
                        if not letters(r[k]): r[k] = n
                        elif letters(r[k]) == letters(n): r[k] = zwj(n, on) + re.search(r'[^඀-෿\u200d’\']*$', r[k]).group(0) * (not re.search(r'[.,:;?]$', n))
                        else: r[k] = retoken(r[k], n, on)
                else:
                    m = '' if whole else re.match(r'^[^඀-෿\d(]*', r[ks[0]]).group(0)
                    r[ks[0]] = m + ' '.join(zwj(n, on) for n in new)
                    for k in ks[1:]: r[k] = r[k - 1] = ''
                    if not new: r[ks[0] + 1 if ks[0] + 1 < len(r) else ks[0] - 1] = ''   # the space that went with the removed word
                items[ei].append(dict(id=did, typed=D[did]['typed'], new=' '.join(new), basis=basis, **({'note': PRINT_SLIP[did]} if did in PRINT_SLIP else {})))
            for f, pn, ei, o, n, why in EXTRA:
                if f == name and pn == page['pageNum']:
                    ei = next(k for k, r in enumerate(raw) if o in ''.join(r))
                    t = ''.join(raw[ei]); assert t.count(o) == 1
                    raw[ei] = [t.replace(o, n)]
                    items[ei].append(dict(id=None, typed=o, new=n, basis='scan', note=why))
            for ei in sorted(items):
                after = ''.join(raw[ei])
                if after != E[ei]['text']:
                    changes.append(dict(file=name, page=pi, pageNum=page['pageNum'], entry=ei, before=E[ei]['text'], after=after, items=items[ei][::-1]))
                    if apply: E[ei]['text'] = after
        if apply: open(path, 'w').write(json.dumps(data, ensure_ascii=False, indent=4))
    json.dump(changes, open(os.path.join(ROOT, BOOKNAME, 'changes.json'), 'w'), ensure_ascii=False, indent=1)
    n = sum(len(c['items']) for c in changes)
    print('entries', len(changes), 'changes', n, collections.Counter(x['basis'] for c in changes for x in c['items']), 'skipped', skipped, 'applied' if apply else 'not applied')


if __name__ == '__main__':
    main()
