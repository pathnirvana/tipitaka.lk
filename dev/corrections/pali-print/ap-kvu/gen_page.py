"""Review page for report.json (written by fix.py):  python3 dev/corrections/pali-print/ap-kvu/gen_page.py <out.html>"""
import json, sys, os, collections, html

D = os.path.dirname(os.path.abspath(__file__))
rep = json.load(open(D + '/report.json'))
AUTO = [
    ('label-spelling', 'Label spelling', 'Punctuation and spelling of the speaker/act label set to the usual form, "ස. පු: ". The spelled-out labels of the first kathā (සකවාදීපුච්ඡා:) stay as they are. In the Sinhala almost all of these are පටිඤ්ඤා typed with a hidden joiner character.'),
    ('label-garbled', 'Label mistyped or missing on one side', 'The other side has a normal label for the same line, so it is copied over.'),
    ('act-by-reply', 'Reply label contradicts the reply', 'ආමන්තා is an admission (පටිඤ්ඤා); න හෙවං වත්තබ්බෙ is a rejection (පටි). The label follows the reply text.'),
    ('act-numbered', 'පු / අනු differ on a numbered paragraph', 'Where both sides agree, a numbered paragraph opens with පු 2,703 times and with අනු 19 times. Set to පු.'),
    ('speaker', 'Speaker differs between Pāḷi and Sinhala', 'The one who answers is not the one who asked. The side that breaks this against its neighbouring line is corrected.'),
    ('reply-typo', 'Pāḷi reply formula mistyped', 'Set to "ආමන්තා." or "න හෙවං වත්තබ්බෙ" with its own ending.'),
    ('reply-ending', 'Sinhala plain reply: full stop or elision mark', 'Missing full stop added; where the Pāḷi reply ends in -පෙ- the Sinhala ends in " ...".'),
    ('ellipsis', 'Sinhala elision marks', 'One form throughout: three dots with a space each side, the form DN and MN use most. Text inside ( ) is not touched.'),
    ('number', 'Paragraph number format', 'Pāḷi "**N.** " and Sinhala "**N**. ", the form 2,670 of the numbered paragraphs already have.'),
    ('quote', 'Quote opened with one mark and closed with the other', 'Only where the entry has exactly one unmatched pair and the closing mark ends a quotation (’ති, ’යි).'),
]
MANUAL = [
    ('speaker', 'Speaker differs, not decidable by the rule'), ('speaker-same', 'Reply has the same speaker as its question on both sides'),
    ('act-question', 'පු / අනු differ, paragraph not numbered'), ('act-differs', 'Other label differences between the sides'),
    ('label-unusual', 'Label word not used elsewhere'), ('label-misaligned', 'Label on the neighbouring entry on the other side'),
    ('reply-under-other-label', 'Plain reply under a question label on both sides'),
    ('sinhala-missing', 'Sinhala missing'), ('sinhala-short', 'Sinhala much shorter than the Pāḷi'),
    ('sinhala-comma', 'Sinhala ends in a comma where the Pāḷi sentence ends'), ('elision-one-side', 'Elision mark on one side only'),
    ('pali-mark', 'Unusual elision mark in the Pāḷi'), ('quote-double', 'Double quotes that do not pair up, checked across entries'),
    ('quote-single', 'Sinhala ‘ without ’'), ('brackets', 'Unbalanced ( ) in the Sinhala'),
    ('pali-near', 'Pāḷi line one or two characters from a line repeated 3+ times'),
]
ref = lambda x: [x['tk'], x['kn'], x['pn'], x['k']]
auto = {}
for c in rep['changes']:
    a = auto.setdefault(c['cat'], dict(p=0, s=0, rows=[], groups=collections.OrderedDict()))
    a[c['side']] += 1
    if c['cat'] in ('label-spelling', 'ellipsis'):
        d = c['d']
        if c['cat'] == 'label-spelling': key = (c['side'], c['g'][0], c['g'][1])
        else: key = (c['side'], d[1] if len(d[1]) < 12 else 'several marks in one entry', d[2] if len(d[1]) < 12 else '')
        g = a['groups'].setdefault(key, dict(n=0, ex=[])); g['n'] += 1
        if len(g['ex']) < 4: g['ex'].append(ref(c))
    else: a['rows'].append([c['side']] + ref(c) + c['d'])
for a in auto.values():
    a['groups'] = sorted(([k[0], k[1], k[2], g['n'], g['ex']] for k, g in a['groups'].items()), key=lambda x: -x[3])[:60]
manual = collections.defaultdict(list)
for m in rep['manual']: manual[m['cat']].append(ref(m) + [m['note'], m['p'], m['s']])
data = dict(auto=auto, manual=manual, autoMeta=AUTO, manualMeta=MANUAL)
t = rep['totals']
n_auto = len(rep['changes']); n_man = len(rep['manual'])
e = html.escape
rows_a = ''.join(f'<tr><td><a href="#a-{k}">{e(n)}</a></td><td class="n">{auto.get(k, dict(p=0))["p"] or "–"}</td><td class="n">{auto.get(k, dict(s=0))["s"] or "–"}</td></tr>' for k, n, _ in AUTO)
rows_m = ''.join(f'<tr><td><a href="#m-{k}">{e(n)}</a></td><td class="n">{len(manual.get(k, []))}</td></tr>' for k, n in MANUAL if manual.get(k))
page = f'''<title>Kathāvatthu source faults</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Noto+Sans+Sinhala:wght@400;600&display=swap">
<style>
/* layout: one reading column; a summary of two tables first, then one collapsible list per fault type */
:root {{ --bg:#f7f8f6; --panel:#ffffff; --fg:#1c2421; --muted:#5d6a65; --line:#d9dfdb; --accent:#0f6b5c; --del-bg:#fbdcd8; --del-fg:#8c1d13; --ins-bg:#d3efdc; --ins-fg:#0b5a2a;
  --text:"Inter","Noto Sans Sinhala",system-ui,sans-serif; --si:"Noto Sans Sinhala","Inter",system-ui,sans-serif; }}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg:#141917; --panel:#1c2320; --fg:#e4eae7; --muted:#9aa8a2; --line:#2f3a36; --accent:#5cc7b2; --del-bg:#5a211c; --del-fg:#ffc9c2; --ins-bg:#1c4a2d; --ins-fg:#bff0cf; color-scheme:dark }} }}
:root[data-theme="dark"] {{ --bg:#141917; --panel:#1c2320; --fg:#e4eae7; --muted:#9aa8a2; --line:#2f3a36; --accent:#5cc7b2; --del-bg:#5a211c; --del-fg:#ffc9c2; --ins-bg:#1c4a2d; --ins-fg:#bff0cf; color-scheme:dark }}
body {{ background:var(--bg); color:var(--fg); font:15px/1.55 var(--text); padding-block:28px 60px; padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); }}
main {{ max-width:980px; margin:0 auto; display:flex; flex-direction:column; gap:22px; }}
h1 {{ font-size:26px; font-weight:600; margin:0; text-wrap:balance; }} h2 {{ font-size:18px; font-weight:600; margin:14px 0 0; }}
p {{ margin:0; max-width:70ch; }} .muted {{ color:var(--muted); }}
a {{ color:var(--accent); }} a:focus-visible, summary:focus-visible {{ outline:2px solid var(--accent); outline-offset:2px; }}
.sum {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:18px; }} .sum > div {{ min-width:0; }}
table {{ border-collapse:collapse; width:100%; }} th,td {{ text-align:left; padding:5px 8px; border-bottom:1px solid var(--line); vertical-align:top; }}
th {{ font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); font-weight:500; }} td.n,th.n {{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }}
details {{ background:var(--panel); border:1px solid var(--line); border-radius:6px; }} summary {{ cursor:pointer; padding:10px 14px; font-weight:600; display:flex; gap:10px; align-items:baseline; flex-wrap:wrap; }}
summary .c {{ color:var(--muted); font-weight:400; font-variant-numeric:tabular-nums; }}
.body {{ padding:0 14px 14px; display:flex; flex-direction:column; gap:10px; }} .scroll {{ overflow-x:auto; }}
.row {{ border-top:1px solid var(--line); padding:7px 0; display:grid; grid-template-columns:190px 1fr; gap:4px 14px; }} .row > * {{ min-width:0; }}
@media (max-width:640px) {{ .row {{ grid-template-columns:1fr; }} }}
.where {{ font-size:12.5px; color:var(--muted); }} .where a {{ font-family:var(--si); }}
.txt {{ font-family:var(--si); overflow-wrap:anywhere; }} .side {{ font:500 11px var(--text); letter-spacing:.05em; text-transform:uppercase; color:var(--muted); margin-right:6px; }}
del {{ background:var(--del-bg); color:var(--del-fg); text-decoration:none; border-radius:2px; padding:0 1px; white-space:pre-wrap; }} ins {{ background:var(--ins-bg); color:var(--ins-fg); text-decoration:none; border-radius:2px; padding:0 1px; white-space:pre-wrap; }}
.note {{ font-size:13px; color:var(--muted); }} button {{ font:inherit; padding:5px 12px; border:1px solid var(--line); background:var(--bg); color:var(--fg); border-radius:5px; cursor:pointer; align-self:flex-start; }}
</style>
<main>
<header style="display:flex;flex-direction:column;gap:8px">
<h1>Kathāvatthu source faults</h1>
<p>All nine ap-kvu files: {t["entries"]:,} entries, {t["paragraphs"]:,} paragraphs of text. The script would change {t["p_changed"]:,} Pāḷi entries and {t["s_changed"]:,} Sinhala entries. Nothing is written to the files yet.</p>
<p class="muted">Not touched by any fix: the {t["intro"]} kathā introductions and the bracketed additions from the commentary in {t["brackets"]} Sinhala entries. The script checks this for every entry before it writes.</p>
</header>
<section class="sum">
<div><h2>Fixed by the script</h2><div class="scroll"><table><tr><th>Fault</th><th class="n">Pāḷi</th><th class="n">Sinhala</th></tr>{rows_a}</table></div></div>
<div><h2>Need reading</h2><div class="scroll"><table><tr><th>Fault</th><th class="n">Entries</th></tr>{rows_m}</table></div></div>
</section>
<p class="muted">The kathā name opens that paragraph on tipitaka.lk. The BJT page number opens the scan of the printed page (Pāḷi on the even page, Sinhala on the page after it). Red is removed, green is added. A red or green block with nothing visible in it is a space or a hidden character.</p>
<h2>Fixed by the script</h2><div id="auto" style="display:flex;flex-direction:column;gap:10px"></div>
<h2>Need reading</h2><div id="manual" style="display:flex;flex-direction:column;gap:10px"></div>
</main>
<script>
const D = {json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')};
const el = (t, c, x) => {{ const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }};
const BOOK = {{'ap-kvu':[48,'AP04',29],'ap-kvu-1-2':[48,'AP04',29],'ap-kvu-2':[48,'AP04',29],'ap-kvu-3':[49,'AP05',11],'ap-kvu-5':[49,'AP05',11],'ap-kvu-8':[49,'AP05',11],'ap-kvu-11':[50,'AP06',11],'ap-kvu-15':[50,'AP06',11],'ap-kvu-19':[50,'AP06',11]}};
const link = (text, href) => {{ const a = el('a', '', text); a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; }};
// the paragraph itself on tipitaka.lk: /<kathā key>/<page index>-<entry index>
const entryUrl = r => 'https://tipitaka.lk/' + r[0] + '/' + r[3].split(' ')[1].replace(':', '-');
// the scanned print page: Pāḷi on the even page, Sinhala on the page after it
const scan = (r, n) => {{ const b = BOOK[r[3].split(' ')[0]]; return link('BJT page ' + n, 'https://pitaka.lk/bjt/newbooks/' + b[0] + '/' + b[1] + '_Page_' + String(b[2] + n).padStart(3, '0') + '.jpg'); }};
const where = (r, sd) => {{ const w = el('div', 'where'); const d = el('div');
  if (sd !== 's') d.append(scan(r, r[2])); if (!sd) d.append(' · '); if (sd !== 'p') d.append(scan(r, r[2] + 1));
  w.append(link(r[1] || r[0], entryUrl(r)), d); return w; }};
const side = s => el('span', 'side', s === 'p' ? 'Pāḷi' : 'Sinhala');
const vis = s => s === ' ' ? '⟨space⟩' : s.replace(/\\u200d/g, '⟨joiner⟩').replace(/\\t/g, '⟨tab⟩');
function diffRow(r) {{ const row = el('div', 'row'); const t = el('div', 'txt'); t.append(side(r[0]), document.createTextNode(r[5]));
  if (r[6]) t.append(el('del', '', vis(r[6]))); if (r[7]) t.append(el('ins', '', vis(r[7]))); t.append(document.createTextNode(r[8])); row.append(where(r.slice(1, 5), r[0]), t); return row; }}
function groupRow(g) {{ const row = el('div', 'row'); const w = el('div', 'where'); w.append(side(g[0]), el('span', '', g[3].toLocaleString() + ' entries'));
  const t = el('div', 'txt'); t.append(el('del', '', vis(g[1]))); if (g[2]) t.append(document.createTextNode(' → '), el('ins', '', vis(g[2])));
  const ex = el('div', 'note', 'e.g. '); g[4].forEach((r, i) => {{ if (i) ex.append(', '); ex.append(link(r[1], entryUrl(r)), ' (', scan(r, r[2] + (g[0] === 's' ? 1 : 0)), ')'); }});
  t.append(ex); row.append(w, t); return row; }}
function manRow(r) {{ const row = el('div', 'row'); const t = el('div', 'txt'); t.append(el('div', 'note', r[4]));
  const p = el('div'); p.append(side('p'), document.createTextNode(r[5])); const s = el('div'); s.append(side('s'), document.createTextNode(r[6])); t.append(p, s); row.append(where(r), t); return row; }}
function section(host, id, title, count, desc, items, make) {{
  const d = el('details'); d.id = id; const s = el('summary'); s.append(el('span', '', title), el('span', 'c', count)); const b = el('div', 'body'); if (desc) b.append(el('p', 'note', desc));
  let shown = 0; const more = el('button', '', ''); more.type = 'button';
  const add = () => {{ const f = document.createDocumentFragment(); items.slice(shown, shown + 150).forEach(x => f.append(make(x))); shown = Math.min(items.length, shown + 150); b.insertBefore(f, more);
    more.hidden = shown >= items.length; more.textContent = 'Show more (' + (items.length - shown) + ' left)'; }};
  b.append(more); d.append(s, b); d.addEventListener('toggle', () => {{ if (d.open && !shown) add(); }}); more.addEventListener('click', add); host.append(d); return d; }}
const A = document.getElementById('auto'), M = document.getElementById('manual');
D.autoMeta.forEach(([k, n, desc]) => {{ const a = D.auto[k]; if (!a) return; const g = a.groups.length > 0;
  section(A, 'a-' + k, n, 'Pāḷi ' + a.p + ' · Sinhala ' + a.s, desc + (g ? ' Grouped by the change made.' : ''), g ? a.groups : a.rows, g ? groupRow : diffRow); }});
D.manualMeta.forEach(([k, n]) => {{ const m = D.manual[k]; if (m) section(M, 'm-' + k, n, m.length + ' entries', '', m, manRow); }});
const openHash = () => {{ const d = document.getElementById(location.hash.slice(1)); if (d && d.tagName === 'DETAILS') {{ d.open = true; d.scrollIntoView(); }} }};
addEventListener('hashchange', openHash); if (location.hash) openHash(); else document.getElementById('a-speaker').open = true;
</script>
'''
open(sys.argv[1], 'w').write(page)
print(len(page) // 1024, 'KB; automatic changes', n_auto, 'need reading', n_man)
