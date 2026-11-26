"""
Typed Pāḷi against the print: line crops of the scans for the deviations that have to be read, stacked into sheets.

usage: python3 dev/corrections/pali-print/crops.py <book> <out dir> [ids...]   -> <out dir>/<book>-NN.png, 8 lines a sheet,
       each line labelled with its index in <book>/decisions.json
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SCANS = '/Volumes/2TB/node/pitaka.lk/bjt/newbooks'
sys.path.insert(0, ROOT)
from diff import BOOK, TEXT  # noqa: E402


def main():
    book, out = sys.argv[1], sys.argv[2]
    ids = [int(x) for x in sys.argv[3:]]
    D = json.load(open(os.path.join(ROOT, book, 'decisions.json')))
    os.makedirs(out, exist_ok=True)
    offs, parts = {}, []
    for i, d in enumerate(D):
        if (ids and i not in ids) or (not ids and (d['dec'] == 'num' or d['line'] < 0)): continue
        if d['file'] not in offs:
            t = json.load(open(os.path.join(TEXT, d['file'] + '.json'))); offs[d['file']] = (t['bookId'], t.get('pageOffset', 0))
        b, po = offs[d['file']]
        prefix, off = BOOK[b]
        key = f'{b}/{prefix}{off + po + d["pageNum"]:03d}'
        o = json.load(open(os.path.join(ROOT, '..', '..', 'ocr', key + '.json')))
        l = next(x for x in o['lines'] if x['n'] == d['line'])
        x1, y1, x2, y2 = l['bbox']
        w = subprocess.check_output(['magick', 'identify', '-format', '%w', os.path.join(SCANS, key + '.jpg')]).decode()
        s = int(w) / o['size'][0]
        f = os.path.join(out, f'_{book}{i}.png')
        subprocess.check_call(['magick', os.path.join(SCANS, key + '.jpg'), '-crop',
                               f'{int((x2 - x1 + 60) * s)}x{int((y2 - y1 + 36) * s)}+{int(max(0, x1 - 30) * s)}+{int(max(0, y1 - 18) * s)}', '+repage',
                               '-resize', '1500x>', '-background', 'white', '-gravity', 'West', '-extent', '1500x', '-gravity', 'NorthWest', '-splice', '0x26',
                               '-font', '/System/Library/Fonts/Helvetica.ttc', '-pointsize', '20', '-fill', 'red', '-annotate', '+4+2', f'{book} {i}  p{d["pageNum"]} line {d["line"]}', f])
        parts.append(f)
    for n in range(0, len(parts), 8):
        subprocess.check_call(['magick', *parts[n:n + 8], '-append', os.path.join(out, f'{book}-{n // 8:02d}.png')])
    for f in parts: os.remove(f)
    print(len(parts), 'lines')


if __name__ == '__main__':
    main()
