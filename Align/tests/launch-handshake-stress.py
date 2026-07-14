#!/usr/bin/env python3
import json, pathlib, subprocess, tempfile, time, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
SERVER = ROOT / 'source' / 'server.mjs'


def launch():
    handshake_dir = tempfile.TemporaryDirectory(prefix='ba-handshake-')
    data_root = tempfile.TemporaryDirectory(prefix='ba-root-')
    handshake_file = pathlib.Path(handshake_dir.name) / 'handshake.json'
    error_file = pathlib.Path(handshake_dir.name) / 'error.txt'
    process = subprocess.Popen(
        ['node', str(SERVER), '--port', '0', '--handshake-file', str(handshake_file),
         '--error-file', str(error_file), '--root', data_root.name],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
    )
    deadline = time.time() + 15
    while time.time() < deadline:
        if handshake_file.exists():
            raw = handshake_file.read_text()
            payload = json.loads(raw)
            port = payload.get('port')
            token = payload.get('sessionToken')
            if not isinstance(port, int) or not 1 <= port <= 65535:
                raise RuntimeError(f'invalid port handshake: {payload}')
            if not isinstance(token, str) or len(token) < 64:
                raise RuntimeError('invalid session token handshake')
            request = urllib.request.Request(
                f'http://127.0.0.1:{port}/api/health',
                headers={'X-Brainana-Session': token},
            )
            with urllib.request.urlopen(request, timeout=2) as response:
                health = json.load(response)
            if not health.get('ok'):
                raise RuntimeError('health failed')
            return process, handshake_dir, data_root, port, token
        if process.poll() is not None:
            stderr = process.stderr.read() if process.stderr else ''
            error = error_file.read_text() if error_file.exists() else ''
            raise RuntimeError(f'server exited: {stderr} {error}')
        time.sleep(0.02)
    process.terminate()
    raise RuntimeError('atomic launch handshake timeout')


def close(item):
    process, handshake_dir, data_root, _, _ = item
    process.terminate()
    try:
        process.wait(timeout=2)
    except subprocess.TimeoutExpired:
        process.kill()
    handshake_dir.cleanup()
    data_root.cleanup()


for _ in range(100):
    item = launch()
    close(item)

items = []
try:
    for _ in range(24):
        items.append(launch())
    ports = [item[3] for item in items]
    tokens = [item[4] for item in items]
    if len(ports) != len(set(ports)):
        raise RuntimeError('duplicate concurrent port')
    if len(tokens) != len(set(tokens)):
        raise RuntimeError('duplicate concurrent session token')
finally:
    for item in items:
        close(item)

print('launch handshake stress ok: 100 sequential, 24 concurrent')
