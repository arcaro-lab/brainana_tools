#!/usr/bin/env bash
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RES="$APP_DIR/Resources"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) NODE="$RES/runtime/linux-x64/node" ;;
  aarch64|arm64) NODE="$RES/runtime/linux-arm64/node" ;;
  *) echo "Unsupported Linux architecture: $ARCH" >&2; exit 31 ;;
esac
[[ -x "$NODE" ]] || { echo "Bundled Linux runtime missing: $NODE" >&2; exit 33; }
command -v xdg-open >/dev/null 2>&1 || { echo "xdg-open is required to open the default browser" >&2; exit 34; }
ROOT="${1:-$PWD}"
CACHE_BASE="${XDG_CACHE_HOME:-$HOME/.cache}/brainana-align"
STATE_BASE="${XDG_STATE_HOME:-$HOME/.local/state}/brainana-align"
mkdir -p "$CACHE_BASE" "$STATE_BASE/logs"
echo "Linux launcher source template. Packaging support will supply version metadata and the shared handshake implementation."
echo "Data root: $ROOT"
