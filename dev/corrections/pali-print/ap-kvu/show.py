"""Print entries of a Kathāvatthu file with both sides, or the OCR lines of its printed pages.

  python3 dev/corrections/pali-print/ap-kvu/show.py ap-kvu-3 24:4 [n]     entries from 24:4-n to 24:4+n (default 6), full text
  python3 dev/corrections/pali-print/ap-kvu/show.py ap-kvu-3 24 ocr       OCR lines of the Pāḷi and Sinhala scan pages of page index 24
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dossier import TEXT, ocr_lines

f, pos = sys.argv[1], sys.argv[2]
d = json.load(open(os.path.join(TEXT, f + '.json')))
if len(sys.argv) > 3 and sys.argv[3] == 'ocr':
    pg = d['pages'][int(pos)]
    for name, n in (('PALI', pg['pageNum']), ('SINHALA', pg['pageNum'] + 1)):
        print(f'--- OCR {name} page {n}'); print('\n'.join(ocr_lines(d['bookId'], n) or ['(none)']))
else:
    pi, ei = map(int, pos.split(':')); n = int(sys.argv[3]) if len(sys.argv) > 3 else 6
    flat = [(qi, i, a, b) for qi, q in enumerate(d['pages']) for i, (a, b) in enumerate(zip(q['pali']['entries'], q['sinh']['entries']))]
    at = next(i for i, x in enumerate(flat) if x[0] == pi and x[1] == ei)
    for qi, i, a, b in flat[max(0, at - n): at + n + 1]:
        print(f'[{qi}:{i}] ({a["type"]})\n   P: {a["text"]}\n   S: {b["text"]}')
