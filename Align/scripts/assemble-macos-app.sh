#!/bin/bash
set -euo pipefail

usage() {
  echo "Usage: $0 --arm64-node PATH --x64-node PATH --out DIRECTORY" >&2
  exit 2
}
ARM64_NODE=""; X64_NODE=""; OUT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --arm64-node) ARM64_NODE="$2"; shift 2 ;;
    --x64-node) X64_NODE="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    *) usage ;;
  esac
done
[[ -f "$ARM64_NODE" && -f "$X64_NODE" && -n "$OUT" ]] || usage
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="$ROOT/source"
APP="$OUT/Brainana Align.app"

node "$ROOT/scripts/generate-version.mjs"
(cd "$SOURCE" && npm ci && npm run build)
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/runtime/darwin-arm64" "$APP/Contents/Resources/runtime/darwin-x64"
cp "$ROOT/generated/Info.plist" "$APP/Contents/Info.plist"
cp "$ROOT/packaging/brainana-align-launcher" "$APP/Contents/MacOS/brainana-align-launcher"
cp "$SOURCE/server.mjs" "$SOURCE/sftpClient.mjs" "$SOURCE/platformCore.mjs" "$SOURCE/version.mjs" "$SOURCE/version.env" "$APP/Contents/Resources/runtime/"
cp -a "$SOURCE/dist" "$APP/Contents/Resources/runtime/dist"
cp "$ARM64_NODE" "$APP/Contents/Resources/runtime/darwin-arm64/node"
cp "$X64_NODE" "$APP/Contents/Resources/runtime/darwin-x64/node"
chmod 755 "$APP/Contents/MacOS/brainana-align-launcher" "$APP/Contents/Resources/runtime/darwin-arm64/node" "$APP/Contents/Resources/runtime/darwin-x64/node"
echo "$APP"
