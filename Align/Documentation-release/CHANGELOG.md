# Brainana Align 0.16.21-lifecycle.6

## Fixed
- Replaced the unreliable AppleScript `do script` SSH helper launch with an executable `.command` helper opened by macOS LaunchServices in Terminal.
- Added a positive startup acknowledgement so the launcher distinguishes “Terminal accepted the open request” from “the helper actually ran.”
- Added explicit user-facing errors when Terminal does not launch or execute the helper.
- Corrected the successful-SSH race by waiting for the persistent control socket to become ready after SSH returns success.
- Preserved clean cancellation behavior for Control-C, Terminal-tab closure, HUP, INT, and TERM.

## Packaging
- Restored the complete application documentation set, release manifest, build metadata, and checksums to the macOS package.
- Added package-content validation so required release files cannot be silently omitted.

## 0.16.22-lifecycle.7
- Fixed nounset-safe generation of the Terminal SSH authentication helper.
