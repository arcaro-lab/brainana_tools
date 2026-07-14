#!/bin/bash
set -euo pipefail
select_runtime() {
  local process_arch="$1" hardware_arm64="$2"
  if [[ "$hardware_arm64" == "1" ]]; then
    printf '%s\n' darwin-arm64
  elif [[ "$process_arch" == "x86_64" ]]; then
    printf '%s\n' darwin-x64
  else
    return 31
  fi
}
[[ "$(select_runtime arm64 1)" == "darwin-arm64" ]]
[[ "$(select_runtime x86_64 1)" == "darwin-arm64" ]]
[[ "$(select_runtime x86_64 0)" == "darwin-x64" ]]
if select_runtime arm64 0 >/dev/null 2>&1; then
  echo "unsupported combination unexpectedly accepted" >&2
  exit 1
fi
LAUNCHER="$(cd "$(dirname "$0")/.." && pwd)/packaging/templates/brainana-align-launcher.in"
grep -q 'hw.optional.arm64' "$LAUNCHER"
grep -q 'sysctl.proc_translated' "$LAUNCHER"
grep -q 'HARDWARE_ARCH="arm64"' "$LAUNCHER"
grep -q 'darwin-arm64/node' "$LAUNCHER"
echo "macOS runtime selection tests passed"
