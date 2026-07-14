#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
L="$ROOT/packaging/templates/brainana-align-launcher.in"
grep -q '/bin/launchctl submit -l "$LAUNCH_LABEL"' "$L"
grep -q '/bin/launchctl print "gui/${UID}/${LAUNCH_LABEL}"' "$L"
grep -q '/bin/launchctl remove "$LAUNCH_LABEL"' "$L"
grep -q '"launchLabel":"%s"' "$L"
grep -q 'old_label="$(json_string_field "$file" launchLabel)"' "$L"
if grep -q '/usr/bin/nohup.*server.mjs' "$L"; then
  echo 'server still launched as direct app descendant' >&2; exit 1
fi
echo 'macOS launchd lifecycle source checks passed'
