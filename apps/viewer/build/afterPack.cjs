// electron-builder `afterPack` hook — ad-hoc code-sign the packaged macOS .app.
//
// Why: the build sets `mac.identity: null`, so electron-builder skips signing and the
// bundle ships with a broken/absent signature seal. macOS Gatekeeper then reports the
// downloaded app as "damaged and can't be opened" (a HARD block with no override button).
// Applying a valid *ad-hoc* signature (`codesign --sign -`, no Apple certificate needed)
// repairs the seal, so Gatekeeper instead shows the softer "Apple could not verify… free
// of malware" prompt — which offers "Open Anyway" in System Settings → Privacy & Security.
//
// This is NOT notarization and does NOT remove the warning entirely; it only turns the
// scary "damaged" error into the recoverable one. For a friction-free double-click, sign
// with a Developer ID and notarize (see the commented block in electron-builder.yml).
//
// Runs only for the macOS target; it is a no-op on the Linux/Windows builds.

const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return; // mac only

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);

  // --force : replace the linker's per-binary ad-hoc sigs and any stale seal
  // --deep  : also (re)sign nested Electron helpers and frameworks, so the whole seal is valid
  // --sign -: ad-hoc identity — no certificate / Apple account required
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
    stdio: "inherit",
  });
  console.log(`  • ad-hoc signed ${appName}`);
};
