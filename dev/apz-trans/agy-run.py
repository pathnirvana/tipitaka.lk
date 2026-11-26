"""Packets through an Antigravity agent conversation (the Google AI Pro subscription), one conversation per packet.
   python3 dev/apz-trans/agy-run.py <dir> [--model gemini-4-neon-medium] [--jobs 2] [--only N]
<dir> holds rules.md and packet-N.md (pat-export.ts); the answer of packet N is written to packet-N.<model>.json as
{"items": [{"i", "si"}]}. Packets that have an answer are skipped. The call goes through Antigravity's own agentapi helper,
with the address and local token of the running app (~/.gemini/antigravity/daemon/hub_*.json); the reply is read from the
conversation's transcript, and the model that answered is checked there."""
import glob, json, os, re, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
A = os.path.expanduser('~/.gemini/antigravity')
arg = lambda n, d=None: sys.argv[sys.argv.index(n) + 1] if n in sys.argv else d
DIR, MODEL, JOBS, ONLY = sys.argv[1], arg('--model', 'gemini-4-neon-medium'), int(arg('--jobs', '2')), arg('--only')
rules = open(f'{DIR}/rules.md').read()

def env():
    hub = json.load(open(sorted(glob.glob(f'{A}/daemon/hub_*.json'), key=os.path.getmtime)[-1]))
    return {**os.environ, 'ANTIGRAVITY_LS_ADDRESS': f"127.0.0.1:{hub['httpPort']}", 'ANTIGRAVITY_CSRF_TOKEN': hub['csrfToken']}

def ask(prompt, title):
    r = subprocess.run([f'{A}/bin/agentapi', 'new-conversation', f'--model={MODEL}', f'--title={title}', prompt], env=env(), capture_output=True, text=True, timeout=120)
    cid = json.loads(r.stdout)['response']['newConversation']['conversationId']
    log = f'{A}/brain/{cid}/.system_generated/logs/transcript_full.jsonl'
    t0 = time.time()
    while time.time() - t0 < 1500:
        time.sleep(5)
        if not os.path.exists(log): continue
        steps = [json.loads(l) for l in open(log) if l.strip()]
        last = steps[-1]
        if last['type'] == 'PLANNER_RESPONSE' and last['status'] == 'DONE' and last.get('content') and time.time() - os.path.getmtime(log) > 8:
            models = {s['model'] for s in steps if s.get('model')}
            if models != {MODEL}: raise RuntimeError(f'{title}: answered by {models}, not {MODEL}')
            return last['content'], sum(s.get('input_tokens', 0) for s in steps), sum(s.get('output_tokens', 0) for s in steps)
        if last['status'] not in ('DONE', 'RUNNING', 'PENDING', 'GENERATING'): raise RuntimeError(f'{title}: step {last["type"]} {last["status"]}')
    raise TimeoutError(title)

def one(f):
    n = re.search(r'packet-(\d+)\.md$', f).group(1)
    out = f'{DIR}/packet-{n}.{MODEL}.json'
    if os.path.exists(out): return
    packet = open(f).read()
    want = [int(x) for x in re.findall(r'^## i=(\d+) ', packet, re.M)]
    prompt = (rules + '\n\n' + packet + '\n\n# OUTPUT\nDo not use any tool and do not read or write any file. Reply with the JSON object only, '
              'nothing before or after it: {"items": [{"i": 1, "si": "…"}, …]}, one item for every entry above, in order.')
    for attempt in (1, 2, 3):
        try:
            text, tin, tout = ask(prompt, f'{os.path.basename(DIR)} packet {n}')
            m = re.search(r'\{[\s\S]*\}', text)
            items = json.loads(m.group(0), strict=False)['items']
            for x in items: x['si'] = re.sub(r'\s*\n\s*', ' ', str(x.get('si', ''))).strip()
            got = [x['i'] for x in items]
            if got != want or any(not str(x.get('si', '')).strip() for x in items): raise ValueError(f'items {got[:5]}… of {len(want)}')
            json.dump({'items': items, 'model': MODEL, 'tokens': [tin, tout]}, open(out, 'w'), ensure_ascii=False, indent=1)
            print(f'packet {n}: {len(items)} entries, {tin} in {tout} out', flush=True); return
        except Exception as e:
            print(f'packet {n}: attempt {attempt} failed: {str(e)[:300]}', flush=True); time.sleep(30 * attempt)

files = sorted(glob.glob(f'{DIR}/packet-*.md'), key=lambda f: int(re.search(r'-(\d+)\.md', f).group(1)))
if ONLY: files = [f for f in files if f.endswith(f'packet-{ONLY}.md')]
with ThreadPoolExecutor(JOBS) as ex: list(ex.map(one, files))
