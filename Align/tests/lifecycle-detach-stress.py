#!/usr/bin/env python3
import json, os, signal, subprocess, tempfile, time, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
NODE=os.environ.get('NODE','node')
SERVER=ROOT/'source'/'server.mjs'

def launch(base: Path):
    data=base/'data'; cache=base/'cache'; hs=base/'handshake.json'; err=base/'error.txt'; log=base/'server.log'
    data.mkdir(parents=True); cache.mkdir(parents=True)
    out=open(log,'wb')
    p=subprocess.Popen([NODE,str(SERVER),'--host','127.0.0.1','--port','0','--handshake-file',str(hs),'--error-file',str(err),'--root',str(data),'--mode','local','--label','test','--cache',str(cache)],stdin=subprocess.DEVNULL,stdout=out,stderr=subprocess.STDOUT,start_new_session=True)
    deadline=time.time()+10
    while time.time()<deadline:
        if hs.exists() and hs.stat().st_size:
            info=json.loads(hs.read_text())
            req=urllib.request.Request(f"http://127.0.0.1:{info['port']}/api/health",headers={'X-Brainana-Session':info['sessionToken']})
            with urllib.request.urlopen(req,timeout=2) as r:
                assert r.status==200
            return p,info,out
        if p.poll() is not None:
            raise RuntimeError(f'server exited {p.returncode}: {log.read_text(errors="replace")}')
        time.sleep(.02)
    raise TimeoutError('handshake timeout')

def stop(item):
    p,_,out=item
    try: os.killpg(p.pid,signal.SIGTERM)
    except ProcessLookupError: pass
    try: p.wait(timeout=3)
    except subprocess.TimeoutExpired:
        os.killpg(p.pid,signal.SIGKILL); p.wait(timeout=3)
    out.close()

with tempfile.TemporaryDirectory(prefix='brainana-lifecycle-') as td:
    base=Path(td)
    for i in range(30):
        item=launch(base/f'seq-{i}')
        p,info,_=item
        time.sleep(.05)
        assert p.poll() is None, 'detached server did not persist after bootstrap interval'
        req=urllib.request.Request(f"http://127.0.0.1:{info['port']}/api/health",headers={'X-Brainana-Session':info['sessionToken']})
        with urllib.request.urlopen(req,timeout=2) as r: assert r.status==200
        stop(item)
    items=[launch(base/f'con-{i}') for i in range(12)]
    assert len({i[1]['port'] for i in items})==len(items)
    assert len({i[1]['sessionToken'] for i in items})==len(items)
    for item in items: stop(item)
print('detached lifecycle stress passed: 30 sequential, 12 concurrent')
