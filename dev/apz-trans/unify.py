"""Book-wide wording of the repeated Vinaya formulas, after the chapter reviews (rewrite mode).

  python3 dev/apz-trans/unify.py dev/apz-trans/out/book-<book>/text.json [--write]

The chapter reviews make each group of chapters consistent; groups can still choose differently. These are the choices made
for the Pācittiya (the plainest wording, or BJT's where both are plain). Only whole formulas are replaced, never single
words in other contexts. Without --write it only counts.
"""
import json, re, sys, collections

ANAP = 'සිහි විකල් වූවෙකුට ද, මුලින්ම මේ වරද කළ තැනැත්තාට (ආදිකම්මිකයාට) ද ඇවැත් නැත'
RULES = [
    # ujjhāyanti khiyyanti vipācenti
    ('ujjhayanti', r'(?:අවමන් කොට සිත|පහත් කොට සිත|අවමනින් සිත|අවමන් කර|අමනාපයෙන් සිත)(ති|න|යි)(?=, (?:නුගුණ|දොස්) කිය)',
     lambda m: 'හෙළා දකි' + m.group(1) if m.group(1) != 'න' else 'හෙළා දකින'),
    ('ujjhayanti-2', r'(හෙළා දකි(?:ති|න|යි)), දොස් කිය(ති|න|යි), අගුණ පතුරුව(ති|න|යි)',
     lambda m: f'{m.group(1)}, නුගුණ කිය{m.group(2)}, දොස් පතුරුව{m.group(3)}'),
    # uddiseyyātha
    ('uddiseyyatha', r'ශික්ෂාපදය මෙසේ (ද )?(?:උදෙසිය යුතුයි|උදෙසිය යුතු ?ය|උදෙසන්න \(ප්‍රකාශ කරන්න\)|උදෙසන්න|දේශනා කළ යුතුයි|දක්වන්න|උදෙසව්)(?! \(ප්‍රකාශ)',
     lambda m: f'ශික්ෂාපදය මෙසේ {m.group(1) or ""}උදෙසිය යුතු ය (ප්‍රකාශ කළ යුතු ය)'),
    # saccaṃ bhagavā
    ('saccam', r'භාග්‍යවතුන් වහන්ස, සැබෑ ?ය|සැබෑය, භාග්‍යවතුන් වහන්ස', lambda m: 'සැබෑ ය, භාග්‍යවතුන් වහන්ස'),
    # chabbaggiyā
    ('chabbaggiya', r'ඡබ්බග්ගි(?:ය|ීය)|ෂඩ්වර්ගීය', lambda m: 'ෂඩ්වර්ගික'),
    # anujānāmi
    ('anujanami', r'අනුදනිමි', lambda m: 'අනුමත කරමි'),
    # the offence names: the forms used throughout the Pācittiya
    ('pacitti', r'පචිති(?: \(පාචිත්තිය\))?', lambda m: 'පාචිත්තිය'),
    ('dukkata', r'දුකුළා', lambda m: 'දුක්කට'),
    # dhammiṃ kathaṃ
    ('dhammikatha', r'දැහැමි කථාව|දැහැමි කතාව|ධර්ම කථාව', lambda m: 'ධර්ම කතාව'),
    # the anāpatti heading
    ('anapatti-head', r'\*\*(?:ඇවැත් නැත්තේ|ඇවැත් නැති අවස්ථා|ඇවැත් නොවන අවස්ථා|ඇවැත් නොවේ|අනාපත්ති)(:?)\*\*', lambda m: f'**ඇවැත් නැත{m.group(1)}**'),
    # Sāvatthinidānaṃ (the sekhiya headings)
    ('savatthi', r'\*\*සැවැත්(?: ?නුවර ?දී ය| නුවර නිදාන කොට| නුවර නිදානයයි| ?නුවර ?දී සිදු වූවකි| නුවරදී සිදු වූ කරුණකි| නුවර ?දී සිදු විය| නුවරදී \(පනවන ලදී\)| නුවර ?දී පැනවූ ශික්ෂාපදයකි)\*\*', lambda m: '**සැවැත් නුවරදී පැනවූ ශික්ෂාපදයයි**'),
    # the end of the anāpatti lists (sekhiya): ummattakassa ādikammikassa
    ('anapatti-list', r'උමතු වූ(?:වාට|වකුට|වෙකුට), ආදිකර්මිකයාට(?: \([^)]*\))? ඇවැත් නැත',
     lambda m: 'සිහි විකල් වූවෙකුට, මුලින්ම මේ වරද කළ තැනැත්තාට (ආදිකම්මිකයාට) ඇවැත් නැත'),
    ('adikammika', r'ආදිකර්මිකයාට(?: \([^)]*\))? ඇවැත් නැත', lambda m: 'මුලින්ම මේ වරද කළ තැනැත්තාට (ආදිකම්මිකයාට) ඇවැත් නැත'),
    ('anapatti-umatu', r'උමතු වූ(?:වාට|වකුට|වෙකුට| තැනැත්තාට| භික්ෂුවට| කෙනාට)(?: ද)?, (?:ආදිකර්මිකයාට(?: \([^)]*\))?|(?:මේ වරද මුලින් ?ම|මුලින් ?ම (?:මේ |මෙම )?වරද) කළ (?:තැනැත්තාට|භික්ෂුවට|කෙනාට)(?: \(ආදිකම්මික(?:යාට)?\))?)(?: ද)? ඇවැත් (?:නැත|නොවේ)',
     lambda m: ANAP),
    # appicchā (the reviews chose differently): the term, explained
    ('appiccha', r'අල්පේච්ඡ \((?:අඩු ආශා ඇති|අල්ප ආශා ඇති|ආශාව අඩු)\)|ආශාව? අඩු \(අල්පේච්ඡ\)|(?<!\()ආශාව? අඩු(?!\)| බව)|අල්පේච්ඡ(?! \()',
     lambda m: 'අල්පේච්ඡ (ආශා අඩු)'),
    # the bhikkhunī part: Sāvatthinidānaṃ, sikkhamānā, the definition ending, Bhaddā, samanubhāsana
    ('savatthi-2', r'\*\*සැවැත් ?නුවර ?දී (?:පැනවූ ශික්ෂාපදය(?:කි|යයි| යි)|සිදු වූ කරුණ)\*\*', lambda m: '**සැවැත් නුවරදී පැනවූ ශික්ෂාපදයයි**'),
    ('sikkhamana-1', r'හික්මෙන තැනැත්තිය(ක්|ක|කට|ට)? \(සික්ඛමානාව\1\)', lambda m: f'සික්ඛමානාව{m.group(1) or ""} (උපසම්පදාවට පෙර හික්මෙන තැනැත්තිය{m.group(1) or ""})'),
    ('sikkhamana', r'(?<!\()(?<!පෙර )හික්මෙන තැනැත්තිය(?![^()]*\))', lambda m: 'සික්ඛමානාව'),
    ('yapana-end', r'අදහස් කරන ලද භික්ෂුණිය (?:මැය ?යි|ඇය ?යි|යි|මැය|ඇය)(?=[.,]|$)', lambda m: 'අදහස් කරන ලද්දේ මේ භික්ෂුණිය යි'),
    ('bhadda', r'භද්‍රා කාපිලානි', lambda m: 'භද්දා කාපිලානි'),
    ('samanubhasana', r'සමනුභාෂණ', lambda m: 'සමනුභාසන'),
    # a word explained by itself, as left by the rules above ("දුකුළා (දුක්කට)" became "දුක්කට (දුක්කට)")
    ('self-bracket', r'(?<![඀-෿‍])([඀-෿‍]+)((?: ඇවැත්?)?) \(\1\)', lambda m: m.group(1) + m.group(2)),
    # the Mahāvagga reviews: ukkuṭika is squatting (not kneeling, ඇණතියාගෙන); සැල කළ is the modern spelling
    ('ukkutika', r'(උක්කුටික(?:ව|යෙන්)) \([^)]*\)', lambda m: f'{m.group(1)} (දණහිස් බිම නොතබා පතුල් මත)'),
    ('sala', r'සැළ කළ', lambda m: 'සැල කළ'),
    # the Pārājika (vp-prj, reviewed after the Pācittiya): the Buddha's address to one monk, khittacitta, the anāpatti items
    ('address', r'(?<=[“‘])භික්ෂුව, ', lambda m: 'මහණ, '),
    ('khittacitta', r'සිත (?:විකෘති|වික්ෂිප්ත|විකල්) වූ(?:වෙකුට|වහුට| තැනැත්තාට)', lambda m: 'සිත කැළඹී ගිය තැනැත්තාට'),
    ('khittacitta-2', r'සිත (?:විකෘති|වික්ෂිප්ත) වූ තැනැත්තා(?=[ (])', lambda m: 'සිත කැළඹී ගිය තැනැත්තා'),
    ('ummattaka', r'උමතු වූ(?: තැනැත්තාට|වාට|වකුට|වෙකුට) \(උම්මත්තක\)', lambda m: 'සිහි විකල් වූවෙකුට'),
    ('adikammika-2', r'ආදිකම්මික(?:යාට)? \(මුලින් ?ම (?:එය|මෙය|මේ වරද) කළ තැනැත්තාට\)', lambda m: 'මුලින්ම මේ වරද කළ තැනැත්තාට (ආදිකම්මිකයාට)'),
    # anāpatti ummattakassa ādikammikassa
    ('anapatti', r'සිහි ?විකල් වූ(?:වෙකුට| තැනැත්තාට|වහුට)(?: \(උම්මත්තක\))?(?: ද)?, (?:ආදිකම්මිකයාට \(මුලින්ම මේ වරද කළ තැනැත්තාට\)|(?:මේ වරද මුලින් ?ම කළ|මුලින් ?ම මේ වරද කළ) තැනැත්තාට(?: \(ආදිකම්මික(?:යාට)?\))?|මුලින්ම මේ වරද කළහුට)(?: ද)? ඇවැත් නැත',
     lambda m: ANAP),
]

path = sys.argv[1]
text = json.load(open(path))
count = collections.Counter()
for k, v in text.items():
    si = v['si']
    for name, pat, rep in RULES:
        si, n = re.subn(pat, lambda m: (count.update([name]), rep(m))[1] if rep(m) != m.group(0) else m.group(0), si)
    if si != v['si']:
        count['entries'] += 1
        if '--write' in sys.argv: v['si'] = si; v['src'] = 'review-unify'
print(dict(count))
if '--write' in sys.argv:
    json.dump(text, open(path, 'w'), ensure_ascii=False, indent=1)
