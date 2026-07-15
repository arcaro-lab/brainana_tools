# Brainana Align changelog

## 0.17.4-export-browser.3

- Corrected a global `main` layout collision that forced the export browser content to full application height and pushed its footer outside the dialog.
- Replaced the nested semantic `main` element with the same neutral panel structure used by the remote import browser.
- Added the missing top-right Close button using the same modal header pattern as import.
- Cancel and Select this folder now occupy the visible fixed footer.

## 0.17.4-export-browser.2

- Fixed the remote export browser footer being pushed below the visible dialog.
- The Cancel and Select this folder buttons now remain visible at all supported window heights, including empty directories.
- Constrained the folder list and sidebar to scroll internally without displacing the action footer.

## 0.17.4-export-browser.1

- Rebuilt the remote export-folder chooser with the same Finder-style navigation model as remote import.
- Added Back, Forward, Up, Home, breadcrumbs, Command-L path entry, folder search, sortable Name/Date Modified columns, hidden-folder control, starting/root/recent shortcuts, and remembered export locations.
- Retained new-folder creation and current-folder selection.
- Kept remote export atomic-write behavior, SSH permissions, SFTP transport, and scientific calculations unchanged.

## 0.17.3-remote-export.1

- Added Local/Workstation destination selection to Export whenever an Electron remote connection is active.
- Made remote connection state reactive so connecting or disconnecting immediately updates the open export interface.
- Remote folder selection begins at the profile's starting directory and permits navigation to any SSH-authorized location.
- Remote exports use the existing structured SFTP transport, overwrite confirmation, temporary upload, verification, backup, replacement, and rollback flow.
- Local export and scientific behavior are unchanged.

## 0.17.2-remote-browser.1

- Replaced the basic remote file list with a Finder-style SFTP browser.
- Added a Locations sidebar for the profile starting directory, remote filesystem root, and last visited folder.
- Added Back, Forward, Up, and Home navigation, clickable path breadcrumbs, and direct path entry with Command-L.
- Added current-folder search, sortable Name/Size/Date Modified columns, readable file sizes and dates, hidden-file control, keyboard navigation, multi-selection, and remembered locations.
- Added modification timestamps to local and SFTP directory listings.
- Kept SSH authentication, SFTP transport, unrestricted SSH-permission-based navigation, image loading, and scientific calculations unchanged.

## 0.17.1-remote.3

- Reclassified each remote profile path as a starting directory rather than a filesystem containment boundary.
- Remote browsing can now navigate upward to `/` and then into any directory the authenticated SSH account is permitted to access.
- Preserved normalized path handling, loopback session authentication, structured SFTP operations, and the existing SSH account permission model.
- Kept browser-mode and local filesystem containment unchanged.

## 0.17.1-remote.2

- Fixed the Electron remote controls not appearing by replacing the ES-module preload with a sandbox-compatible CommonJS preload.
- Added package checks requiring the sandbox preload and its restricted remote IPC surface.

## 0.17.1-remote.1

- Added on-demand remote MRI and CT loading to the Electron desktop application.
- Each MRI/CT load control now offers local or remote workstation sources without a startup mode prompt.
- Added versioned, atomically written JSON connection profiles containing only non-secret metadata.
- Added Terminal-based system SSH authentication compatible with passwords, keys, passphrases, SSH configuration, and institutional interactive authentication.
- Added reusable connection status, disconnect behavior, structured SFTP browsing, progress, and cancellation.
- Local and remote volumes can be mixed in one registration session without restarting or reloading the application.
- Isolated the remote filesystem behind its own localhost port, session token, origin policy, and Electron preload bridge.

## 0.17.0-electron.4

- Corrected the recurring axial optimization-window failure by making the rendered orthographic plane—not NiiVue's sometimes-degenerate axial pointer result—the primary screen-to-image mapping.
- Added a deterministic regression test that emulates two visibly separated axial drag endpoints being reported by NiiVue as the same coordinate.
- A rejected drag on a plane without a window is now a valid unrestricted state rather than a red application error.
- Definition and completion messages now explicitly state that every plane without a window uses all voxels.

## 0.17.0-electron.3

- Replaced optimization-window pointer handling with one shared view-card capture path for all MRI and CT planes.
- Added a projection fallback for letterboxed image regions where NiiVue does not return a direct pointer coordinate.
- Invalid or very small replacement drags now preserve the previous valid window instead of deleting it.
- Reasserted and regression-tested the constraint rule: every plane without a usable window is completely unrestricted, equivalent to selecting the full plane.

## 0.17.0-electron.2

- Fixed packaged runtime discovery so the desktop app resolves `Resources/runtime/server.mjs` from the actual bundle layout instead of relying on Electron's executable-name-sensitive `app.isPackaged` heuristic.
- Added a regression check for packaged runtime discovery.

## 0.17.0-electron.1

- Added an Apple Silicon Electron desktop target using the complete readable TypeScript/NiiVue frontend.
- Added an internal secure local-server lifecycle with no external browser launch.
- Added single-instance handling, bounded startup, authenticated handshakes, shutdown cleanup, navigation restrictions, and hardened renderer settings.
- Preserved the browser target and its existing macOS launcher.
- Electron remote-workstation mode is intentionally deferred; the first desktop prototype supports Local mode.

## 0.16.26-docs.1

- Replaced per-release architecture, changelog, and validation Markdown files with one maintained document of each type.
- Removed the duplicated `Documentation-release/` tree.
- Consolidated browser-support policy into the current architecture and validation documents.
- Added an automated documentation-layout test that fails on version-stamped release documents, duplicate documentation trees, or missing maintained documents.
- Updated package manifests and release verification requirements for the consolidated documentation model.
- No application, scientific, SSH, local-mode, remote-mode, or export behavior changed.

## 0.16.25-local-start.1

- Local mode now opens directly without a startup MRI/CT folder chooser.

# Brainana Align 0.16.24-ssh.1

## SSH reliability correction

- Removed the explicit OpenSSH `-f` option from the interactive persistent-master command.
- The Terminal helper now uses the command form verified successfully on the affected macOS/OpenSSH 10.2 system: `ssh -M -S <socket> -o ControlPersist=600 -o ExitOnForwardFailure=yes -NT <target>`.
- OpenSSH may background the control master through `ControlPersist` only after authentication succeeds.
- The launcher continues to require a successful `ssh -O check` before starting the application server.
- Failed and timed-out SSH helper directories are retained and their paths are reported for diagnosis.
- Added a regression test that rejects any generated helper containing `-fNT`.
- Browser-matrix functionality from 0.16.23-browser-matrix.1 is retained unchanged.

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
# 0.17.5-remote-ui.1

- Corrected the remote import browser layout so **Cancel**, **Load selected**, and the top-right close control remain visible.
- Removed the same nested `main` layout collision previously found in the export browser.
- Successful SSH authentication now closes only its matching temporary Terminal tab by recorded TTY; unsuccessful authentication stays open for diagnosis.
# 0.17.5-remote-ui.2

- Added the missing minimum-height and overflow constraints that keep the remote import footer inside the dialog even for long directory listings.
- Replaced tab-object Terminal cleanup with exact authentication-window cleanup after the command has completed.
- Added a retained `terminal-close.log` for precise diagnosis if macOS refuses the close request.
- Added an AppleScript compilation gate; it caught and corrected the invalid nested Terminal property expression shipped in the previous attempt.
# 0.17.6-platforms.1

- Added Intel macOS, Ubuntu/Linux x64, and Windows x64 Electron packaging from the shared source tree.
- Added Linux terminal discovery for interactive SSH password, key-passphrase, and keyboard-interactive authentication.
- Removed hard-coded macOS SSH executable paths from shared connection lifecycle operations.
- Windows local loading, registration, sessions, and export are enabled; unsupported remote workstation controls are explicitly disabled.
