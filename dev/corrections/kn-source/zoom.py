"""
Khuddaka Nikāya: an enlarged crop of part of a scan line, for vowel lengths and similar letters.

usage: python3 dev/corrections/kn-source/zoom.py <out.png> <book>:<id>:<x1>-<x2> ...   (id = index in <book>/decisions.json, x as fractions of the line)
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SCANS = '/Volumes/2TB/node/pitaka.lk/bjt/newbooks'
sys.path.insert(0, ROOT)
from diff import BOOK, TEXT  # noqa: E402

parts = []
for n, a in enumerate(sys.argv[2:]):
    book, i, xs = a.split(':'); i = int(i); f1, f2 = [float(x) for x in xs.split('-')]
    d = json.load(open(os.path.join(ROOT, book, 'decisions.json')))[i]
    t = json.load(open(os.path.join(TEXT, d['file'] + '.json')))
    prefix, off = BOOK[t['bookId']]
    key = f'{t["bookId"]}/{prefix}{off + t.get("pageOffset", 0) + d["pageNum"]:03d}'
    l = next(x for x in json.load(open(os.path.join(ROOT, '..', '..', 'ocr', key + '.json')))['lines'] if x['n'] == d['line'])
    x1, y1, x2, y2 = l['bbox']; w = x2 - x1
    f = f'{sys.argv[1]}.{n}.png'
    subprocess.check_call(['magick', os.path.join(SCANS, key + '.jpg'), '-crop', f'{int(w * (f2 - f1)) + 20}x{y2 - y1 + 30}+{int(x1 + w * f1) - 10}+{y1 - 15}', '+repage',
                           '-resize', '300%', '-background', 'white', '-gravity', 'NorthWest', '-splice', '0x26', '-font', '/System/Library/Fonts/Helvetica.ttc',
                           '-pointsize', '20', '-fill', 'red', '-annotate', '+4+2', f'{book} {i}', f])
    parts.append(f)
subprocess.check_call(['magick', *parts, '-background', 'white', '-append', sys.argv[1]])
for f in parts: os.remove(f)
