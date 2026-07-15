#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/source/electron/close-auth-terminal.applescript"
MAIN="$ROOT/source/electron/main.mjs"
PACKAGE="$ROOT/scripts/build-electron-macos.sh"
COMPILED="${TMPDIR:-/tmp}/brainana-close-auth-terminal-$$.scpt"
trap 'rm -f "$COMPILED"' EXIT

/usr/bin/osacompile -o "$COMPILED" "$SCRIPT"
grep -q 'repeat with terminalTab in tabs of terminalWindow' "$SCRIPT"
grep -q 'close terminalWindow' "$SCRIPT"
grep -q 'await closeAuthenticationTerminalWhenFinished' "$MAIN"
grep -q "spawnSync('/usr/bin/osascript', \[scriptFile, terminalTty\]" "$MAIN"
grep -q 'terminal-close.log' "$MAIN"
grep -q 'close-auth-terminal.applescript' "$PACKAGE"

echo 'macOS authentication Terminal auto-close checks passed'
