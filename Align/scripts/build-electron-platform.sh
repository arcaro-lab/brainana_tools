#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLATFORM="${1:?Usage: build-electron-platform.sh <darwin|linux|win32> <arm64|x64>}"
ARCH="${2:?Usage: build-electron-platform.sh <darwin|linux|win32> <arm64|x64>}"
ELECTRON_VERSION="39.2.7"
VERSION="$(node -p "require('$ROOT/source/VERSION.json').version")"
BUNDLE_VERSION="$(node -p "require('$ROOT/source/VERSION.json').bundleVersion")"
CACHE="$ROOT/.cache/electron-v${ELECTRON_VERSION}-${PLATFORM}-${ARCH}.zip"
EXTRACT="$ROOT/.cache/extracted-${PLATFORM}-${ARCH}"

mkdir -p "$ROOT/.cache"
if [[ ! -s "$CACHE" ]]; then
  curl -L --fail --retry 3 -o "$CACHE" "https://github.com/electron/electron/releases/download/v${ELECTRON_VERSION}/electron-v${ELECTRON_VERSION}-${PLATFORM}-${ARCH}.zip"
fi
rm -rf "$EXTRACT"
mkdir -p "$EXTRACT"
unzip -q "$CACHE" -d "$EXTRACT"

install_payload() {
  local resources="$1"
  mkdir -p "$resources/app/electron" "$resources/runtime"
  cp "$ROOT/source/package.json" "$resources/app/package.json"
  cp "$ROOT/source/electron/main.mjs" "$resources/app/electron/main.mjs"
  cp "$ROOT/source/electron/preload.cjs" "$resources/app/electron/preload.cjs"
  cp "$ROOT/source/electron/close-auth-terminal.applescript" "$resources/app/electron/close-auth-terminal.applescript"
  cp -R "$ROOT/source/dist" "$resources/runtime/dist"
  cp "$ROOT/source/server.mjs" "$ROOT/source/platformCore.mjs" "$ROOT/source/sftpClient.mjs" "$ROOT/source/version.mjs" "$resources/runtime/"
}

case "$PLATFORM" in
  darwin)
    APP="$ROOT/source/electron-dist/mac-${ARCH}/Brainana Align Desktop.app"
    rm -rf "$APP"; mkdir -p "$(dirname "$APP")"; cp -R "$EXTRACT/Electron.app" "$APP"
    PLIST="$APP/Contents/Info.plist"
    /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Brainana Align Desktop" "$PLIST"
    /usr/libexec/PlistBuddy -c "Set :CFBundleName Brainana Align Desktop" "$PLIST"
    /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier org.brainana.align.desktop" "$PLIST"
    /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString ${VERSION%%-*}" "$PLIST"
    /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUNDLE_VERSION" "$PLIST"
    install_payload "$APP/Contents/Resources"
    /usr/bin/codesign --force --deep --sign - --timestamp=none "$APP"
    /usr/bin/codesign --verify --deep --strict --verbose=2 "$APP"
    echo "$APP"
    ;;
  linux)
    DEST="$ROOT/source/electron-dist/linux-${ARCH}/Brainana-Align-Desktop"
    rm -rf "$DEST"; mkdir -p "$DEST"; cp -R "$EXTRACT/." "$DEST/"
    mv "$DEST/electron" "$DEST/brainana-align-desktop"
    chmod +x "$DEST/brainana-align-desktop" "$DEST/chrome-sandbox" 2>/dev/null || true
    install_payload "$DEST/resources"
    cat > "$DEST/brainana-align.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Brainana Align Desktop
Exec=brainana-align-desktop
Terminal=false
Categories=Science;MedicalSoftware;
DESKTOP
    echo "$DEST"
    ;;
  win32)
    DEST="$ROOT/source/electron-dist/win32-${ARCH}/Brainana-Align-Desktop"
    rm -rf "$DEST"; mkdir -p "$DEST"; cp -R "$EXTRACT/." "$DEST/"
    mv "$DEST/electron.exe" "$DEST/Brainana Align Desktop.exe"
    install_payload "$DEST/resources"
    echo "$DEST"
    ;;
  *) echo "Unsupported platform: $PLATFORM" >&2; exit 2 ;;
esac
