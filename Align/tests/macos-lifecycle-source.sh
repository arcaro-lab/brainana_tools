#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
L="$ROOT/packaging/templates/brainana-align-launcher.in"
grep -q 'reopen_matching_instance' "$L"
grep -q 'launchctl submit' "$L"
grep -q 'SERVER_OWNERSHIP_TRANSFERRED=1' "$L"
grep -q 'launchLabel' "$L"
grep -q 'launchctl remove' "$L"
grep -q 'dataRoot' "$L"
grep -q 'profile' "$L"
if grep -q 'reopen_existing_instance' "$L"; then
  echo 'launcher still reopens before a fresh user selection' >&2; exit 1
fi
if grep -q 'nohup.*server.mjs' "$L"; then
  echo 'launcher still leaves server as an app descendant' >&2; exit 1
fi
if grep -q 'wait "$PID"' "$L"; then
  echo 'launcher still waits indefinitely for server' >&2; exit 1
fi
mode_line="$(grep -n 'MODE_PICK="$(choose_mode)"' "$L" | head -1 | cut -d: -f1)"
reuse_line="$(grep -n 'if reopen_matching_instance' "$L" | head -1 | cut -d: -f1)"
if [[ -z "$mode_line" || -z "$reuse_line" || "$mode_line" -ge "$reuse_line" ]]; then
  echo 'mode chooser must run before existing-session reuse' >&2; exit 1
fi
grep -q 'existing_mode.*selected_mode' "$L"
grep -q 'existing_root.*selected_root' "$L"
grep -q 'existing_target.*selected_target' "$L"
grep -q 'existing_profile.*selected_profile' "$L"
echo 'macOS lifecycle source checks passed'
