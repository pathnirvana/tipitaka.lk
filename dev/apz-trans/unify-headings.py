"""One wording for the recurring heading lines of a rewrite set (results of set-list.ts + run.ts).

  python3 dev/apz-trans/unify-headings.py dev/apz-trans/out/<set>/result.json [--write]

result.json: [{key, type, pali, bjt, si}]. Rules, decided 2026-11-12:
- uddāna heading (tassuddānaṃ / tatruddānaṃ): "එහි සූත්‍රවල නම් පෙළ (උද්දානය):"
- sāvatthinidānaṃ / sāvatthi: "සැවැත්නුවරදී", keeping the Pāḷi's bold and brackets
- [devatā:]: "[දෙවියා:]"
- the end of a vagga, sutta or saṃyutta ("X vaggo tatiyo."): "තුන්වැනි X වර්ගය නිමි.", the ordinal from the Pāḷi
Without --write it prints the changes.
"""
import json, re, sys
ORD = {'පඨම': 'පළමුවැනි', 'දුතිය': 'දෙවැනි', 'තතිය': 'තුන්වැනි', 'චතුත්ථ': 'හතරවැනි', 'පඤ්චම': 'පස්වැනි', 'ඡට්ඨ': 'හයවැනි',
       'සත්තම': 'හත්වැනි', 'අට්ඨම': 'අටවැනි', 'නවම': 'නවවැනි', 'දසම': 'දසවැනි', 'එකාදසම': 'එකොළොස්වැනි', 'ද්වාදසම': 'දොළොස්වැනි',
       'තෙරසම': 'දහතුන්වැනි', 'චුද්දසම': 'දහහතරවැනි'}
SI_ORD = r'(?:පළමු|ප්‍රථම|දෙ|දෙවෙනි|තුන්|හතර|සිව්|පස්|හය|සය|හත්|සත්|අට|නව|දස|එකොළොස්|දොළොස්|දහතුන්|දහහතර)(?:වැනි|වෙනි|වන|වැන්න)?'
KIND = {'වග්ගො': 'වර්ගය', 'සුත්තං': 'සූත්‍රය', 'සංයුත්තං': 'සංයුත්තය'}

def wrap(pali, core):
    b = pali.strip().startswith('**'); br = '[' in pali
    s = f'[{core}]' if br else core
    return f'**{s}**' if b else s

def rule(x):
    p = re.sub(r'\{[^}]*\}', '', x['pali']).strip(); si = x['si'].strip()
    bare = re.sub(r'[*\[\]]', '', p).strip()
    if re.fullmatch(r'(තස්ස|තත්ර)ුද්දානං:', bare): return wrap(p, 'එහි සූත්‍රවල නම් පෙළ (උද්දානය):')
    if re.fullmatch(r'සාවත්ථි(නිදානං)?', bare): return wrap(p, 'සැවැත්නුවරදී')
    if bare == 'දෙවතා:': return wrap(p, 'දෙවියා:')
    m = re.fullmatch(r'(.*?)\s*(වග්ගො|සුත්තං|සංයුත්තං)\s+(\S+?)(ො|ං)\.?', bare)
    if m and m.group(3) in ORD:
        kind = KIND[m.group(2)]
        # the name as the model wrote it: the si without ordinals, the kind word and the ending
        name = re.sub(rf'(?:{SI_ORD})(?:යි)?|{kind}|වර්ගය|සූත්‍රය|නිමි|යි|\.|\(.*?\)', ' ', re.sub(r'[*\[\]]', '', si))
        name = re.sub(r'\s+', ' ', name).strip()
        return wrap(p, f'{ORD[m.group(3)]} {name + " " if name else ""}{kind} නිමි.')
    return None

f = sys.argv[1]; rows = json.load(open(f)); n = 0
for x in rows:
    new = rule(x)
    if new and new != x['si']:
        n += 1; print(f"{x['key']:14} {x['pali'][:40]:40} {x['si'][:50]:50} => {new}")
        x['si'] = new
print(n, 'changed')
if '--write' in sys.argv: json.dump(rows, open(f, 'w'), ensure_ascii=False, indent=1)
