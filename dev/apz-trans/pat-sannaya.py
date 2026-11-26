"""The පදාර්ථ (word-meaning) passages of the Paṭṭhāna sannaya (Rerukane Chandawimala; pitaka.lk/books/
pattana-pakarana-sannaya), aligned to the BJT entries of ap-pat pp. 1-246 -> dev/apz-trans/pat-witness.json
{entry key: [passage, ...]}. The sannaya covers the Paccayuddesa, Paccayaniddesa, Pucchāvāra and the Kusalattika only.
A passage is cut into pieces; a piece is given to an entry when most of the entry's Pāḷi words occur in it (within the same vāra)."""
import glob, html, json, os, re, sys
BOOK = sys.argv[1] if len(sys.argv) > 1 else '/Volumes/2TB/node/pitaka.lk/books/pattana-pakarana-sannaya'
# sannaya chapter -> page index range of ap-pat (from its headings)
CHAP = {4: (0, 0), 5: (0, 8), 6: (8, 16), 7: (16, 57), 8: (57, 60), 9: (60, 90), 10: (90, 94), 11: (94, 109), 12: (109, 110), 13: (110, 245)}

def norm(t):
    t = re.sub(r'\{[^}]*\}', '', t).replace('‍', '')
    return re.sub(r'\s+', ' ', re.sub(r'[^඀-෿]+', ' ', t)).strip()

passages = []  # (chapter, file, heading, text, norm)
for f in sorted(glob.glob(BOOK + '/*.html'), key=lambda f: [int(x) for x in re.findall(r'\d+', os.path.basename(f))] or [0]):
    name = os.path.basename(f)[:-5]
    if not re.match(r'\d', name): continue
    ch = int(name.split('-')[0])
    if ch not in CHAP: continue
    t = open(f, encoding='utf-8').read()
    m = re.search(r'<main[^>]*>(.*?)</main>', t, re.S)
    if not m: continue
    body = m.group(1)
    title = html.unescape(re.sub(r'<[^>]+>', '', re.search(r'<h1>(.*?)</h1>', body, re.S).group(1))) if '<h1>' in body else name
    # the text in order, a subhead as a marker line; a පදාර්ථ section runs from its marker (a subhead, or the word inline
    # followed by a colon) to the next subhead or to the inline අභිධෙය… marker
    flat = re.sub(r'<div class="subhead">\s*<p>(.*?)</p>\s*</div>', lambda m: '\n@@' + re.sub(r'<[^>]+>', '', m.group(1)) + '@@\n', body, flags=re.S)
    flat = html.unescape(re.sub(r'[ \t]+', ' ', re.sub(r'<[^>]+>', ' ', flat))).replace('\u200d', '')
    flat = re.sub(r'(?<!@@)(පදාර්ථ\s*[:ඃ])', r'\n@@පදාර්ථ@@\n', flat)
    flat = re.sub(r'(?<!@@)(අභිධෙය[ාර්ථ]*\s*[:ඃ])', r'\n@@අභිධෙය@@\n', flat)
    parts = re.split(r'\n@@(.*?)@@\n', flat)
    for k in range(1, len(parts), 2):
        txt = re.sub(r'\s+', ' ', parts[k + 1]).strip()
        if not (parts[k].strip(' :.').startswith('පදාර්') and len(txt) > 20): continue
        # (pieces of about 1,200 chars, cut after a gloss, so that an entry gets only the glosses of its own words)
        piece = ''
        for seg in re.split(r'(?<=[:.])\s', txt):
            if piece and len(piece) + len(seg) > 1200: passages.append((ch, name, title, piece, ' ' + norm(piece) + ' ')); piece = ''
            piece += (' ' if piece else '') + seg
        if piece: passages.append((ch, name, title, piece, ' ' + norm(piece) + ' '))
print(len(passages), 'passages,', sum(len(p[3]) for p in passages), 'chars', file=sys.stderr)

d = json.load(open('public/static/text/ap-pat.json'))
out = {}
for ch, (a, b) in CHAP.items():
    cand = [p for p in passages if p[0] == ch]
    if not cand: continue
    for pi in range(a, b + 1):
        for ei, e in enumerate(d['pages'][pi]['pali']['entries']):
            w = {x for x in norm(e['text']).split() if len(x) >= 4}
            if len(w) < 3: continue
            # (the glosses stand between the Pāḷi words, so single words are counted, not word pairs)
            sc = sorted(((sum(1 for q in w if f' {q} ' in p[4]) / len(w), -i) for i, p in enumerate(cand)), reverse=True)
            got, used = [], 0
            for s_, i in sc[:3]:
                if s_ < 0.6 or (got and s_ < 0.85 * sc[0][0]): break
                txt = cand[-i][3]
                got.append(f'[{cand[-i][2]}] {txt}'); used += len(txt)
                if used >= 2400: break
            if got: out.setdefault(f'ap-pat {pi}:{ei}', got)
json.dump(out, open('dev/apz-trans/pat-witness.json', 'w'), ensure_ascii=False, indent=1)
n = sum(len(d['pages'][pi]['pali']['entries']) for pi in range(0, 246))
print(len(out), 'of', n, 'entries have a passage', file=sys.stderr)
