"""Kathāvatthu (ap-kvu*) source corrections: the faults a rule can fix, and lists of those that need reading.

  python3 dev/corrections/pali-print/ap-kvu/fix.py            # report only -> dev/corrections/pali-print/ap-kvu/report.json
  python3 dev/corrections/pali-print/ap-kvu/fix.py --write    # also writes public/static/text/ap-kvu*.json

What it changes (both the Pāḷi and the BJT Sinhala side unless noted):
  label-spelling   speaker/act label punctuation and spelling ("ස පු:", "අනු: පා:", "ප. පටිඤ්‍ඤා:") -> "ස. පු: "
  label-garbled    a label that is mistyped or missing on one side, taken from the other side
  act-by-reply     reply label follows the reply (ආමන්තා = පටිඤ්ඤා, න හෙවං වත්තබ්බෙ = පටි)
  act-numbered     පු / අනු differ between the sides and the paragraph is numbered: පු
  speaker          speaker differs between the sides; the one who answers is not the one who asked
  reply-typo       Pāḷi reply formula mistyped
  reply-ending     Sinhala plain reply: full stop / elision mark follows the Pāḷi
  ellipsis         Sinhala elision marks: " ... " (three dots, a space each side), as in DN and MN
  number           paragraph number format: Pāḷi "**N.** ", Sinhala "**N**. "
  quote            a quote opened with “ and closed with ’ (or ‘ … ”) inside one entry

Never changed: the kathā introductions (Sinhala entries with no Pāḷi) and anything inside ( ) in the Sinhala, which are
BJT's additions from the commentary. The script checks this before writing.
"""
import json, re, sys, glob, os, collections, difflib

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..'))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'report.json')
FILES = sorted(glob.glob(ROOT + '/public/static/text/ap-kvu*.json'), key=lambda x: [int(n) for n in re.findall(r'\d+', os.path.basename(x))])
ZWJ = '‍'
SI = '඀-෿' + ZWJ
nofn = lambda s: re.sub(r'\{[^}]*\}', '', s)

SPK = {'ස': 'S', 'සකවාදී': 'S', 'සකවාදි': 'S', 'ප': 'P', 'පරවාදී': 'P', 'පරවාදි': 'P', 'අනු': 'A', 'අනූ': 'A', 'අනුලොම': 'A',
       'අනුලෝම': 'A', 'පටි': 'T', 'පටිලොම': 'T', 'පටිලෝම': 'T'}
ACT = {'පු': 'pu', 'පුච්ඡා': 'pu', 'පටිඤ්ඤා': 'pn', 'ප්රතිඥා': 'pn', 'පටි': 'pk', 'ප්රති': 'pk', 'පටික්ඛෙපො': 'pk', 'පටික්ඛෙප': 'pk',
       'පටික්ඛේප': 'pk', 'ප්රතික්ෂේප': 'pk', 'අනු': 'an', 'අනුයොගො': 'an', 'අනුයෝග': 'an', 'ඨ': 'th', 'ඨපනා': 'th', 'පා': 'pa',
       'පාපනා': 'pa', 'ආ': 'ar', 'ආරොපනා': 'ar', 'ආරෝපනා': 'ar', 'නි': 'ni', 'නිග': 'ni', 'නිග්රහ': 'ni', 'නිග්ගහො': 'ni', 'නිග්ගහ': 'ni',
       'වි': 'vi', 'උ': 'up', 'සු': 'su', 'පටිකම්මං': 'pm', 'පටිකම්ම': 'pm', 'නිගමනං': 'ng', 'නිගමන': 'ng'}
# written tokens that are set to the usual one (the others, also the spelled-out forms, stay as written)
TOKFIX = {'අනූ': 'අනු', 'ප්රතිඥා': 'පටිඤ්ඤා', 'ප්රතික්ෂේප': 'පටි', 'ප්රති': 'පටි', 'නිග්රහ': 'නිග'}
SPK_AB = {'S': 'ස', 'P': 'ප', 'A': 'අනු', 'T': 'පටි'}
ACT_AB = {'pu': 'පු', 'pn': 'පටිඤ්ඤා', 'pk': 'පටි', 'an': 'අනු', 'th': 'ඨ', 'pa': 'පා', 'ar': 'ආ', 'ni': 'නි', 'vi': 'වි', 'up': 'උ',
          'su': 'සු', 'pm': {'p': 'පටිකම්මං', 's': 'පටිකම්ම'}, 'ng': {'p': 'නිගමනං', 's': 'නිගමන'}}
NUM = r'^(\*\*\s*[\d\s.-]+\*\*\s*\.?\s*|\d[\d\s.-]*\.?\s+)?'
norm_tok = lambda w: w.replace(ZWJ, '')


def parse(t):
    """-> dict(num, lab, body, spk, act, st, at, full): st/at are the written tokens; full = a spelled-out label."""
    m = re.match(NUM, t); num = m.group(1) or ''; rest = t[m.end():]
    toks = []; pos = 0; full = False
    for _ in range(2):
        mm = re.match(r'\s*([' + SI + r']+)\s*([.,:]*)\s*', rest[pos:])
        if not mm: break
        w = norm_tok(mm.group(1))
        if not toks:
            g = re.match(r'^(සකවාද[ීි]|පරවාද[ීි]|අනුලොම|අනුලෝම|පටිලොම|පටිලෝම)(.+)$', w)
            if g and g.group(2) in ACT: toks = [g.group(1), g.group(2)]; pos += mm.end(); full = True; break
            if w in SPK:
                toks.append(w); pos += mm.end(); full = len(w) > 3; continue
            if w in ('නිගමනං', 'නිගමන', 'පටිඤ්ඤා') and ':' in mm.group(2): toks = ['', w]; pos += mm.end(); full = True
            break
        else:
            if w in ACT and (mm.group(2) or re.search(r'[.,:]\s*$', rest[:pos])): toks.append(w); pos += mm.end()
            break
    if len(toks) == 2:
        return dict(num=num, lab=rest[:pos], body=rest[pos:], spk=SPK.get(toks[0], ''), act=ACT[toks[1]], st=toks[0], at=toks[1], full=full)
    return dict(num=num, lab='', body=rest, spk=None, act=None, st='', at='', full=False)


def make_label(side, spk, act, st='', at=''):
    """The usual written form. st/at: written tokens to keep when they still say the same thing."""
    s = TOKFIX.get(st, st) if st and SPK.get(st) == spk else SPK_AB[spk]
    a = TOKFIX.get(at, at) if at and ACT.get(at) == act else ACT_AB[act]
    if isinstance(a, dict): a = a[side]
    return f'{s}. {a}: '


LABELLIKE = re.compile(r'^\.?\s*[' + SI + r']{1,6}\s*[.:,]\s*(?:[' + SI + r']{1,6}\s*[.:]\s*)?')


def is_am(b): return bool(re.match(r'^ආමන්තා\s*[.,:]?$', b.strip()))


def nh_split(b):
    """A plain 'න හෙවං වත්තබ්බෙ' reply (also mistyped) -> ending kind 'pe' | 'dot' | '' ; None if not one."""
    b = b.strip()
    m = re.match(r'^(.*?)\s*((?:\.\s*)?-\s*පෙ\s*-\s*\.?|\.)?$', b)
    core, end = m.group(1), m.group(2) or ''
    if len(core) > 21 or len(core) < 10 or not re.match(r'^[නප]\s?හෙ', core): return None
    if difflib.SequenceMatcher(None, core, 'න හෙවං වත්තබ්බෙ', autojunk=False).ratio() < 0.8: return None
    return 'pe' if 'පෙ' in end else ('dot' if end else '')


_M = r'(?:…+|\.\.\s\.(?!\.)|\.{2,}|[–—-]\s?පෙ\s?[–—-])'
MARK = re.compile(_M + r'(?:\s*' + _M + ')*')


def outside_brackets(s, fn):
    """Apply fn to the parts of s that are not inside ( )."""
    parts = re.split(r'(\([^()]*\))', s)
    return ''.join(p if i % 2 else fn(p) for i, p in enumerate(parts))


def fix_ellipsis(seg):
    def rep(m):
        s, a, b = m.string, m.start(), m.end()
        pre = '' if a == 0 or s[a - 1] in ' \n(“‘[' else ' '
        post = ' ' if b < len(s) and re.match('[' + SI + r'\d“‘(]', s[b]) else ''
        return pre + '...' + post
    return MARK.sub(rep, seg)


def fix_quotes(t, sinhala):
    """One “ closed by ’ (or one ‘ closed by ”) in an entry with no other unmatched mark -> matched pair. Else unchanged."""
    if t.count('“') == 1 and t.count('”') == 0:
        i = t.index('“'); tail = t[i + 1:]
        opens = tail.count('‘'); closes = [j for j, c in enumerate(tail) if c == '’']
        # in Pāḷi a ’ before ති can stand without an opening mark, so only the simple case is taken
        if len(closes) == opens + 1 and (opens == 0):
            j = i + 1 + closes[0]
            # only a closing mark of a quotation (’ති, ’යි ...), never the ’ of a sandhi (නඛා’පි)
            if not re.match(r'\s?(යි|යයි|යන|යනු)|[.?]?$' if sinhala else 'ති', t[j + 1:]): return t
            if '(' in t[:j] and t[:j].count('(') > t[:j].count(')'): return t
            return t[:j] + '”' + t[j + 1:]
    if t.count('‘') == 1 and t.count('’') == 0 and t.count('”') == t.count('“') + 1:
        i = t.index('‘'); j = t.index('”', i) if '”' in t[i:] else -1
        if j > 0 and '“' not in t[i:j]: return t[:j] + '’' + t[j + 1:]
    return t


def snippet(a, b, ctx=28):
    """The changed part of a -> b with some context."""
    i = 0
    while i < min(len(a), len(b)) and a[i] == b[i]: i += 1
    j = 0
    while j < min(len(a), len(b)) - i and a[-1 - j] == b[-1 - j]: j += 1
    s = max(0, i - ctx); ea = len(a) - j; eb = len(b) - j
    pre = ('…' if s else '') + a[s:i]; post = a[ea:ea + ctx] + ('…' if ea + ctx < len(a) else '')
    return [pre, a[i:ea], b[i:eb], post]


def main():
    write = '--write' in sys.argv
    tree = json.load(open(ROOT + '/public/static/data/tree.json'))
    starts = collections.defaultdict(list)
    for k, v in tree.items():
        if k.startswith('ap-kvu') and isinstance(v[3], list): starts[v[5]].append((v[3][0], v[3][1], k, v[0]))
    for v in starts.values(): v.sort()

    def where(b, pi, ei):
        best = (0, 0, b, '')
        for s in starts.get(b, []):
            if (s[0], s[1]) <= (pi, ei): best = s
        return best[2], best[3]

    data = {}; rows = []
    for f in FILES:
        b = os.path.basename(f)[:-5]; d = json.load(open(f)); data[f] = d
        for pi, pg in enumerate(d['pages']):
            assert len(pg['pali']['entries']) == len(pg['sinh']['entries']), (b, pi)
            for ei, (pe, se) in enumerate(zip(pg['pali']['entries'], pg['sinh']['entries'])):
                key, kname = where(b, pi, ei)
                r = dict(k=f'{b} {pi}:{ei}', tk=key, kn=kname, pn=pg['pageNum'], type=pe['type'], pe=pe, se=se, p0=pe['text'], s0=se['text'],
                         p=pe['text'], s=se['text'])
                rows.append(r)
    changes = []   # [cat, row, side, before, after]
    manual = []    # [cat, row, note]

    def ch(cat, r, side, new, g=None):
        old = r[side]
        if new != old: changes.append([cat, r, side, old, new, g]); r[side] = new

    para = [r for r in rows if r['type'] == 'paragraph' and nofn(r['p0']).strip()]
    for r in para:
        r['P'] = parse(r['p']); r['S'] = parse(r['s'])
        pb = nofn(r['P']['body'])
        r['am'] = is_am(pb); r['nh'] = nh_split(pb)

    def set_label(cat, r, side, spk, act):
        L = r['P' if side == 'p' else 'S']
        keep = L['spk'] == spk and L['act'] == act
        if keep and (L['full'] or L['spk'] == ''): return
        lab = make_label(side, spk, act, L['st'], L['at'])
        if lab == L['lab']: return
        ch(cat, r, side, L['num'] + lab + L['body'].lstrip(), [L['lab'], lab])
        L.update(parse(r[side]))

    # 1. label on one side only: mistyped or missing
    for i, r in enumerate(para):
        P, S = r['P'], r['S']
        if bool(P['act']) == bool(S['act']): continue
        side, L, O = ('p', P, S) if not P['act'] else ('s', S, P)
        if 'need trans' in r['s'] or not nofn(r[side]).strip(): continue
        nb = [para[j] for j in (i - 1, i + 1) if 0 <= j < len(para)]
        if any(bool(n['P']['act']) != bool(n['S']['act']) and bool(n['P']['act']) != bool(P['act']) for n in nb):
            manual.append(['label-misaligned', r, 'the label is on the neighbouring entry on the other side']); continue
        m = LABELLIKE.match(L['body'])
        if m and len(m.group(0)) <= 14 and re.search(r'[.:]\s*$', m.group(0)):
            written = re.sub(r'\s+', '', m.group(0))
            if re.search('[' + SI + ']{5,}', written):
                manual.append(['label-unusual', r, 'label word not used elsewhere: ' + m.group(0).strip()]); continue
            body = L['body'][m.end():]
            if re.match('^[' + SI + r']{1,12}\s*:', body):
                manual.append(['label-unusual', r, 'label word not used elsewhere: ' + L['body'][:m.end() + 12].strip()]); continue
        elif m and len(m.group(0)) <= 14:
            manual.append(['label-unusual', r, 'possible label: ' + m.group(0).strip()]); continue
        else: body = L['body']
        ch('label-garbled', r, side, L['num'] + make_label(side, O['spk'], O['act'], '', O['at'] if O['act'] == 'ni' else '') + body)
        L.update(parse(r[side]))

    # 2. label spelling
    for r in para:
        for side, L in (('p', r['P']), ('s', r['S'])):
            if L['act'] and L['spk'] != '' and not (L['full'] and len(L['st']) > 3 and re.match(r'^\S+: $', L['lab'])):
                if L['full'] and len(L['st']) > 3:   # spelled-out label: only the token spellings/punctuation, kept as written
                    continue
                set_label('label-spelling', r, side, L['spk'], L['act'])

    # 3. reply label follows the reply
    for r in para:
        want = 'pn' if r['am'] else ('pk' if r['nh'] is not None else None)
        if not want: continue
        sb = re.sub(r'\([^()]*\)', '', nofn(r['S']['body'])).strip()
        s_ok = (sb.startswith('එසේ ය') if want == 'pn' else 'නො කිය' in sb)
        for side, L in (('p', r['P']), ('s', r['S'])):
            if L['act'] in ('pn', 'pk') and L['act'] != want:
                if not s_ok: manual.append(['reply-unclear', r, 'the Sinhala reply does not match the Pāḷi reply']); break
                set_label('act-by-reply', r, side, L['spk'], want)
            elif L['act'] and L['act'] not in ('pn', 'pk'):
                O = r['S'] if side == 'p' else r['P']
                if O['act'] in ('pn', 'pk') and s_ok: set_label('act-by-reply', r, side, L['spk'], want)
                else: manual.append(['reply-under-other-label', r, f'a plain reply under the label "{L["lab"].strip()}" ({"Pāḷi" if side == "p" else "Sinhala"})'])

    # 4. පු / අනු on a numbered paragraph
    for r in para:
        P, S = r['P'], r['S']
        if P['act'] and S['act'] and {P['act'], S['act']} == {'pu', 'an'}:
            if P['num'] or S['num']:
                for side, L in (('p', P), ('s', S)):
                    if L['act'] != 'pu': set_label('act-numbered', r, side, L['spk'], 'pu')
            else: manual.append(['act-question', r, f'පු / අනු differ (Pāḷi {P["lab"].strip()} Sinhala {S["lab"].strip()})'])

    # 5. speaker by alternation
    opp = {'S': 'P', 'P': 'S'}
    snap = [(r['P']['spk'], r['S']['spk'], r['P']['act'], r['S']['act']) for r in para]
    for i, r in enumerate(para):
        ps, ss, pa, sa = snap[i]
        if not (pa and sa) or ps == ss: continue
        want = None
        if pa in ('pn', 'pk') and i and snap[i - 1][2] in ('pu', 'an') and snap[i - 1][0] == snap[i - 1][1] and snap[i - 1][0] in opp:
            want = opp[snap[i - 1][0]]
        elif pa in ('pu', 'an') and i + 1 < len(para) and snap[i + 1][2] in ('pn', 'pk') and snap[i + 1][0] == snap[i + 1][1] and snap[i + 1][0] in opp:
            want = opp[snap[i + 1][0]]
        if want == ps: set_label('speaker', r, 's', want, r['S']['act'])
        elif want == ss: set_label('speaker', r, 'p', want, r['P']['act'])
        else: manual.append(['speaker', r, f'speaker differs (Pāḷi {r["P"]["lab"].strip()} Sinhala {r["S"]["lab"].strip()})'])
    for i, r in enumerate(para[1:], 1):
        a, c = snap[i - 1], snap[i]
        if c[2] in ('pn', 'pk') and a[2] in ('pu', 'an') and c[0] == c[1] == a[0] == a[1] and c[0] in opp:
            manual.append(['speaker-same', r, 'the reply has the same speaker as the question before it, on both sides'])
    for r in para:
        P, S = r['P'], r['S']
        if P['act'] and S['act'] and P['act'] != S['act'] and {P['act'], S['act']} != {'pu', 'an'}:
            manual.append(['act-differs', r, f'label differs (Pāḷi {P["lab"].strip()} Sinhala {S["lab"].strip()})'])

    # 6. Pāḷi reply formula; Sinhala elision marks and plain-reply endings
    for r in rows:
        if r['type'] in ('heading', 'centered') or not nofn(r['p0']).strip(): continue   # introductions are left alone
        ch('ellipsis', r, 's', outside_brackets(r['s'], fix_ellipsis))
    for r in para:
        P = parse(r['p']); S = parse(r['s']); pb = P['body'].strip(); sb = S['body'].strip()
        s_marks = len(re.findall(r'\.\.\.', sb))
        if '{' not in pb:
            if r['am']: ch('reply-typo', r, 'p', P['num'] + P['lab'] + 'ආමන්තා.')
            elif r['nh'] is not None:
                end = r['nh'] or ('pe' if s_marks else 'dot'); r['nh'] = end
                ch('reply-typo', r, 'p', P['num'] + P['lab'] + 'න හෙවං වත්තබ්බෙ' + (' -පෙ-' if end == 'pe' else '.'))
        if '(' in sb or '{' in sb: continue
        if r['am']:
            m = re.match(r'^(එසේ (?:යැ|ය))\s*\.?$', sb)
            if m: ch('reply-ending', r, 's', S['num'] + S['lab'] + m.group(1) + '.')
        elif r['nh'] is not None:
            m = re.match(r'^(එසේ නො කිය[' + SI + r' ]*?(?:යැ|ය|යුතු))\s*(?:\.\s*\.\.\.|\.\.\.|\.)?$', sb)
            if m and not (r['nh'] == 'dot' and s_marks): ch('reply-ending', r, 's', S['num'] + S['lab'] + m.group(1) + (' ...' if r['nh'] == 'pe' else '.'))

    # 7. paragraph number format
    for r in para:
        P = parse(r['p']); S = parse(r['s'])
        np_ = re.sub(r'\s', '', re.sub(r'[*.]', '', P['num'])); ns = re.sub(r'\s', '', re.sub(r'[*.]', '', S['num']))
        if not (np_ or ns): continue
        if np_ != ns: manual.append(['number', r, f'paragraph number differs or is on one side only (Pāḷi "{P["num"].strip()}" Sinhala "{S["num"].strip()}")']); continue
        ch('number', r, 'p', f'**{np_}.** ' + r['p'][len(P['num']):].lstrip())
        ch('number', r, 's', f'**{ns}**. ' + r['s'][len(S['num']):].lstrip())

    # 8. mixed quote pairs
    for r in rows:
        if not nofn(r['p0']).strip(): continue
        ch('quote', r, 'p', fix_quotes(r['p'], False)); ch('quote', r, 's', fix_quotes(r['s'], True))

    # ---- lists that need reading
    for r in para:
        p, s = nofn(r['p']).strip(), nofn(r['s']).strip()
        if not s or 'need trans' in s: manual.append(['sinhala-missing', r, 'no Sinhala']); continue
        if len(p) > 80 and len(s) < 0.4 * len(p): manual.append(['sinhala-short', r, f'Sinhala much shorter than the Pāḷi ({len(s)} / {len(p)} characters)'])
        # a ඨපනා ("if ...,") runs on into the next line in the Sinhala, so its comma is not a fault
        if s.endswith(',') and re.search(r'[.?’”]$|ති$', p) and r['P']['act'] != 'th' and r['S']['act'] != 'th' and not re.search(r'නම්,$', s):
            manual.append(['sinhala-comma', r, 'Sinhala ends in a comma where the Pāḷi ends its sentence'])
        pe_, se_ = len(re.findall('-පෙ-', p)), len(re.findall(r'\.\.\.', s))
        if (pe_ == 0) != (se_ == 0): manual.append(['elision-one-side', r, f'elision mark on one side only (Pāḷi {pe_}, Sinhala {se_})'])
        if s.count('(') != s.count(')'): manual.append(['brackets', r, 'unbalanced ( ) in the Sinhala'])
        if s.count('‘') > s.count('’'): manual.append(['quote-single', r, 'Sinhala ‘ without ’'])
        if re.search(r'\.\.\.|…|-පෙ(?!-)|(?<!-)පෙ-', p): manual.append(['pali-mark', r, 'unusual elision mark in the Pāḷi'])
    for side in 'ps':
        stack = []
        for r in rows:
            if r['type'] == 'heading':
                for o in stack: manual.append(['quote-double', o, ('Pāḷi' if side == 'p' else 'Sinhala') + ': “ never closed before the next heading'])
                stack = []
            for c in nofn(r[side]):
                if c == '“': stack.append(r)
                elif c == '”':
                    if stack: stack.pop()
                    else: manual.append(['quote-double', r, ('Pāḷi' if side == 'p' else 'Sinhala') + ': ” without an opening “'])
    # Pāḷi lines one or two characters from a line that occurs 3+ times
    bod = collections.Counter(nofn(parse(r['p'])['body']).strip() for r in para)
    bylen = collections.defaultdict(list)
    for b, v in bod.items():
        if v >= 3 and len(b) >= 18: bylen[len(b)].append(b)
    for r in para:
        b = nofn(parse(r['p'])['body']).strip()
        if len(b) < 18 or bod[b] > 1: continue
        hit = None
        for L in range(len(b) - 2, len(b) + 3):
            for c in bylen.get(L, []):
                if c[:4] != b[:4] and c[-4:] != b[-4:]: continue
                sm = difflib.SequenceMatcher(None, b, c, autojunk=False)
                if sm.ratio() > 0.965:
                    hit = '; '.join(f'"{b[i1:i2]}" where {bod[c]} other lines have "{c[j1:j2]}"' for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != 'equal'); break
            if hit: break
        if hit: manual.append(['pali-near', r, hit])

    # ---- safety: commentary additions untouched
    for r in rows:
        if not nofn(r['p0']).strip(): assert r['s'] == r['s0'], r['k']
        assert re.findall(r'\([^()]*\)', r['s']) == re.findall(r'\([^()]*\)', r['s0']), r['k']
        assert re.findall(r'\{[^}]*\}', r['p']) == re.findall(r'\{[^}]*\}', r['p0']) and re.findall(r'\{[^}]*\}', r['s']) == re.findall(r'\{[^}]*\}', r['s0']), r['k']

    cnt = collections.Counter((c[0], c[2]) for c in changes)
    changes = [c for c in changes]
    print('changes:'); [print(f'  {k[0]:16} {"Pāḷi" if k[1] == "p" else "Sinhala":8} {v}') for k, v in sorted(cnt.items())]
    print('entries changed: Pāḷi', sum(r['p'] != r['p0'] for r in rows), 'Sinhala', sum(r['s'] != r['s0'] for r in rows))
    mc = collections.Counter(m[0] for m in manual)
    print('need reading:'); [print(f'  {k:26} {v}') for k, v in mc.most_common()]

    ref = lambda r: dict(k=r['k'], tk=r['tk'], kn=r['kn'], pn=r['pn'])
    rep = dict(changes=[dict(cat=c, side=s, **ref(r), d=snippet(a, b), g=g) for c, r, s, a, b, g in changes],
               manual=[dict(cat=c, **ref(r), note=n, p=nofn(r['p'])[:160], s=nofn(r['s'])[:160]) for c, r, n in manual],
               totals=dict(entries=len(rows), paragraphs=len(para), p_changed=sum(r['p'] != r['p0'] for r in rows), s_changed=sum(r['s'] != r['s0'] for r in rows),
                           intro=sum(1 for r in rows if r['type'] == 'paragraph' and not nofn(r['p0']).strip() and r['s0'].strip()),
                           brackets=sum(1 for r in para if '(' in r['s0'])))
    json.dump(rep, open(OUT, 'w'), ensure_ascii=False, indent=0)
    if write:
        for r in rows: r['pe']['text'] = r['p']; r['se']['text'] = r['s']
        for f, d in data.items(): open(f, 'w').write(json.dumps(d, ensure_ascii=False, indent=4))
        print('written', len(data), 'files')


main()
