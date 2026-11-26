"""
Word counts of the whole typed Pāḷi (mūla files), cached in corpus.json: how often a print reading occurs elsewhere as a word.

usage: python3 dev/corrections/pali-print/corpus.py     (rebuilds the cache)
"""
import collections, glob, json, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
from diff import TEXT, clean, key  # noqa: E402


def load():
    f = os.path.join(ROOT, 'corpus.json')
    if not os.path.exists(f): build()
    return json.load(open(f))


def build():
    c = collections.Counter()
    for f in glob.glob(os.path.join(TEXT, '*.json')):
        if os.path.basename(f).startswith('atta-'): continue
        for p in json.load(open(f))['pages']:
            for e in p['pali']['entries']:
                for w in clean(e['text']).split(): c[key(w)] += 1
    json.dump(c, open(os.path.join(ROOT, 'corpus.json'), 'w'), ensure_ascii=False)
    print(len(c), 'words')


if __name__ == '__main__':
    build()
