#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/source"
if [[ "${1:-}" != "--assemble-only" ]]; then
  corepack pnpm install --frozen-lockfile --ignore-scripts
  ELECTRON_VERSION="39.2.7"
  case "$(uname -m)" in
    arm64) ELECTRON_ARCH="arm64" ;;
    x86_64) ELECTRON_ARCH="x64" ;;
    *) echo "Unsupported macOS architecture: $(uname -m)" >&2; exit 2 ;;
  esac
  ELECTRON_ZIP="$ROOT/.cache/electron-v${ELECTRON_VERSION}-darwin-${ELECTRON_ARCH}.zip"
  mkdir -p "$(dirname "$ELECTRON_ZIP")" "$ROOT/source/node_modules/electron/dist"
  if [[ ! -s "$ELECTRON_ZIP" ]]; then
    curl -L --fail --retry 3 -o "$ELECTRON_ZIP" \
      "https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/electron-v${ELECTRON_VERSION}-darwin-${ELECTRON_ARCH}.zip"
  fi
  rm -rf "$ROOT/source/node_modules/electron/dist"
  mkdir -p "$ROOT/source/node_modules/electron/dist"
  unzip -q "$ELECTRON_ZIP" -d "$ROOT/source/node_modules/electron/dist"
  printf '%s' 'dist/Electron.app/Contents/MacOS/Electron' > "$ROOT/source/node_modules/electron/path.txt"
  corepack pnpm run build
  corepack pnpm run test:electron
fi

ELECTRON_APP="$ROOT/source/node_modules/electron/dist/Electron.app"
APP="$ROOT/source/electron-dist/mac-arm64/Brainana Align Desktop.app"
test -d "$ELECTRON_APP"
rm -rf "$APP"
mkdir -p "$(dirname "$APP")"
cp -R "$ELECTRON_APP" "$APP"

PLIST="$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Brainana Align Desktop" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleName Brainana Align Desktop" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier org.brainana.align.desktop" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString 0.17.6" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion 1761" "$PLIST"

APP_SOURCE="$APP/Contents/Resources/app"
RUNTIME="$APP/Contents/Resources/runtime"
mkdir -p "$APP_SOURCE/electron" "$RUNTIME"
cp "$ROOT/source/package.json" "$APP_SOURCE/package.json"
cp "$ROOT/source/electron/main.mjs" "$APP_SOURCE/electron/main.mjs"
cp "$ROOT/source/electron/preload.cjs" "$APP_SOURCE/electron/preload.cjs"
cp "$ROOT/source/electron/close-auth-terminal.applescript" "$APP_SOURCE/electron/close-auth-terminal.applescript"
cp -R "$ROOT/source/dist" "$RUNTIME/dist"
cp "$ROOT/source/server.mjs" "$ROOT/source/platformCore.mjs" "$ROOT/source/sftpClient.mjs" "$ROOT/source/version.mjs" "$RUNTIME/"

test -d "$APP"
/usr/bin/codesign --force --deep --sign - --timestamp=none "$APP"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$APP"
echo "Built and verified: $APP"
