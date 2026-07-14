#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
L="$ROOT/packaging/brainana-align-launcher"
grep -q 'trap cancelled HUP INT TERM' "$L"
grep -q 'helper.pid' "$L"
grep -q 'SSH authentication helper ended before a connection was established' "$L"
grep -q 'Canceling or closing that Terminal tab' "$L"
grep -q 'return 2' "$L"
if grep -q 'ssh-status-\$\$' "$L"; then
  echo 'Legacy untrapped inline SSH status path remains' >&2
  exit 1
fi
echo 'macOS SSH cancellation lifecycle checks passed'
