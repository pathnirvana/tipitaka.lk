"""All decisions of a book on one line each, with BJT word frequency, CST word counts and the earlier normalisation.
usage: python3 dump.py <book> [dec...]"""
import json, re, sys, os
ROOT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, ROOT)
from norm_check import cst_words, lists, k
W, R, C = cst_words(), lists(), json.load(open(f'{ROOT}/corpus.json'))
cw = lambda w: W[w] + W[w.replace('ඞ්', 'ං')]
D = json.load(open(f'{ROOT}/{sys.argv[1]}/decisions.json'))
for i, d in enumerate(D):
    if d['dec'] == 'num' or (sys.argv[2:] and d['dec'] not in sys.argv[2:]): continue
    a, o = k(d['typed']), k(d['ocr'])
    one = ' ' not in d['typed'].strip() and ' ' not in d['ocr'].strip()
    flag = ('NORM ' if R.get(o, ('',))[0] == a else '') + ('ERRLIST ' if a in R else '')
    stat = f"bjt {C.get(a, 0)}/{C.get(o, 0)} cst {cw(a)}/{cw(o)}" if one else ''
    print(i, d['dec'], d['pageNum'], '|', d['typed'], '→', d['ocr'], '|', stat, flag, '|', d['ctx'][:75])
