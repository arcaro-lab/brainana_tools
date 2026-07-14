#!/usr/bin/env python3
import json, pathlib, secrets, subprocess, tempfile, time, urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
SERVER=ROOT/'source'/'server.mjs'

def launch():
    td=tempfile.TemporaryDirectory(prefix='ba-handshake-')
    root=tempfile.TemporaryDirectory(prefix='ba-root-')
    port_file=pathlib.Path(td.name)/'port'
    token=secrets.token_hex(32)
    p=subprocess.Popen(['node',str(SERVER),'--port','0','--port-file',str(port_file),'--root',root.name,'--session-token',token],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True)
    deadline=time.time()+10
    while time.time()<deadline:
        if port_file.exists():
            port=int(port_file.read_text().strip())
            request=urllib.request.Request(f'http://127.0.0.1:{port}/api/health',headers={'X-Brainana-Session':token})
            with urllib.request.urlopen(request,timeout=2) as r:
                data=json.load(r)
            if not data.get('ok'): raise RuntimeError('health failed')
            return p,td,root,port
        if p.poll() is not None:
            raise RuntimeError('server exited: '+(p.stderr.read() if p.stderr else ''))
        time.sleep(.02)
    p.terminate(); raise RuntimeError('port publication timeout')

def close(item):
    p,td,root,_=item
    p.terminate()
    try:p.wait(timeout=2)
    except subprocess.TimeoutExpired:p.kill()
    td.cleanup();root.cleanup()

for _ in range(40):
    item=launch();close(item)

items=[]
try:
    for _ in range(16):items.append(launch())
    ports=[x[3] for x in items]
    if len(ports)!=len(set(ports)):raise RuntimeError('duplicate concurrent port')
finally:
    for item in items:close(item)
print('port handshake stress ok: 40 sequential, 16 concurrent')
