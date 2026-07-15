# Validation status

## 0.17.4-export-browser.3

- Added a regression check rejecting nested `main.ba-export-main`, which inherited the application's full-height main layout.
- Added checks for the top-right Close action and fixed Select this folder footer action.
- Re-ran production build, export, SFTP, Electron, and scientific validation.

## 0.17.4-export-browser.2

- Added layout checks requiring a non-shrinking export action footer and internally constrained scroll regions.
- Verified the packaged frontend contains the visible Select this folder action.
- Re-ran build, export, remote endpoint, storage, Electron, and scientific regression tests.

## 0.17.4-export-browser.1

- Verified compilation and production bundling of the Finder-style export-folder chooser.
- Added source checks for history, breadcrumbs/direct paths, search, sorting, hidden folders, root navigation, remembered locations, and folder creation.
- Re-ran remote endpoint, SFTP, storage, security, export, Electron, optimization-window, and scientific regression suites.
- Visual interaction and a real workstation write remain real-Mac confirmation steps.

## 0.17.3-remote-export.1

- Verified that the Export destination selector appears when an Electron remote endpoint becomes active and returns to Local when disconnected.
- Verified remote folder listing, folder creation, overwrite confirmation, and rollback-capable SFTP save routing.
- Re-ran remote endpoint authentication, SFTP transport, storage, local export, Electron isolation, and scientific regression tests.
- A real workstation export remains the final institutional SSH/Duo smoke test.

## 0.17.2-remote-browser.1

- Verified TypeScript compilation and production rendering of the Finder-style browser.
- Added release checks for history navigation, breadcrumbs/direct paths, search, sorting metadata, hidden files, root navigation, and remembered locations.
- Verified local and SFTP directory metadata handling, remote endpoint authentication, server path security, and packaged Electron preload isolation.
- Re-ran scientific, coordinate, session, export, and all optimization-window regressions.
- Interactive visual confirmation and institutional SSH browsing remain real-Mac tests.

## 0.17.1-remote.3

- Verified that Electron starts its remote SFTP endpoint at `/` while returning the saved profile directory as the browser's initial location.
- Verified that the remote browser enables upward navigation until the remote filesystem root is reached.
- Verified that subsequent MRI/CT browsing retains the last visited remote directory during the active connection.
- Re-ran TypeScript, production-build, Electron remote integration, remote endpoint, SFTP transport, server security, scientific, coordinate, and optimization-window tests.
- Real remote permissions remain enforced by the SSH server and require confirmation against the user's workstation account.

## 0.17.1-remote.2

- Confirmed the prior package contained an ES-module preload incompatible with the sandboxed renderer configuration.
- Replaced it with a CommonJS preload using only Electron's permitted sandbox APIs.
- Verified preload syntax, packaging path, context isolation, absence of filesystem/process imports, TypeScript build, and Electron source checks.
- The Codex execution environment could not launch a visible Electron process through macOS services; the two dropdown arrows remain a real-Mac confirmation.

## 0.17.1-remote.1

Completed locally:

- TypeScript compilation and production build
- Electron preload isolation and IPC surface checks
- profile-schema and non-secret storage source checks
- separate remote endpoint session-token checks
- cross-origin preflight and origin-policy integration test
- SFTP protocol transport tests
- local server, security, storage, and export regression tests
- Electron app assembly and strict deep ad-hoc signature verification

Interactive password/Duo authentication and browsing against a real workstation require confirmation on the user's Mac. Remote export selection remains a later Electron integration step; this release adds remote MRI/CT loading.

## 0.17.0-electron.4

- Executed a deterministic MRI axial regression fixture in which NiiVue reports both drag endpoints at the same coordinate; the shared rendered-plane projection correctly produced a 50 × 50 mm window.
- Re-ran exhaustive missing-plane tests for sagittal, coronal, and axial constraints.
- Re-ran window completion, invalid-drag preservation, TypeScript compilation, production build, scientific, session, Electron source, package-signature, and archive-integrity checks.
- Visible MRI axial drawing remains a final real-Mac interaction check.

## 0.17.0-electron.3

Validated on Apple Silicon macOS:

- exhaustive missing-plane optimization-window semantics
- shared six-view window interaction source path
- invalid-drag preservation of existing windows
- coordinate-projection fallback checks
- TypeScript compilation and production Vite build
- Electron security/source checks

The automated browser UI runner could not execute in the Codex environment because its configured standalone Chromium executable is not installed. Visible MRI/CT window drawing in the packaged Electron application remains a real-Mac interaction check.

## 0.17.0-electron.1

Validated on Apple Silicon macOS:

- TypeScript compilation and production Vite build
- Electron security/source checks
- scientific transform regression tests
- optimization-window tests
- coordinate, crosshair, landmark, session, and export tests
- Apple Silicon Electron bundle assembly
- strict deep ad-hoc code-signature verification
- packaged Electron runtime execution in Node mode
- packaged server handshake and authenticated health response

The Codex execution sandbox cannot communicate with macOS LaunchServices, so the final visible-window/Finder launch must be tested outside that sandbox. Remote mode is not claimed for this Electron milestone.

## Current release: 0.16.26-docs.1

This release changes documentation organization and release validation only. Application source and runtime behavior are unchanged from 0.16.25-local-start.1.

Completed checks:

- TypeScript and Vite production build
- release identity consistency
- documentation-layout enforcement
- source architecture checks
- coordinate, crosshair, landmark, and optimization-window tests
- scientific transform regression tests
- session and export tests
- server smoke, security, storage, and local-export tests
- platform path and SFTP transport tests
- browser UI and compatibility tests
- Chromium production-bundle engine test in the available environment
- launch-handshake and detached-lifecycle stress tests
- macOS runtime-selection, launchd, SSH cancellation, Terminal-helper, and Local-mode startup tests
- packaged frontend hash comparison
- bundled runtime and launcher verification
- ZIP integrity, release manifest, documentation inventory, and checksum validation

## Browser certification boundary

The repository requires Chromium, Firefox, and WebKit automation in CI. In the current build environment, only Chromium was available for execution. Firefox, WebKit, native Safari, and native Edge are not claimed as certified until their required tests run successfully. Native Safari remains necessary because WebKit automation does not fully test Safari-specific WebGL, graphics-driver, privacy, and file-dialog behavior.

## Native system boundary

Finder launch, Dock behavior, Terminal LaunchServices behavior, interactive institutional SSH authentication, sleep/wake, and real network interruption require validation on actual macOS hardware. The current remote authentication flow has been confirmed by the user on macOS after the SSH correction. Linux and Windows remain architectural foundations rather than deployable packages.

## Historical validation policy

Major changes to validation are summarized in `CHANGELOG.md`. Detailed historical snapshots remain available in prior release archives and version-control history rather than duplicated inside every new source package.
# 0.17.5-remote-ui.1

Validated the shared import/export modal layout, explicit import close and action controls, authentication TTY capture, and success-only Terminal-tab cleanup. Real password authentication and Terminal automation still require confirmation on a user Mac.
# 0.17.5-remote-ui.2

Added structural layout assertions covering every flex/grid ancestor between the import dialog and its footer. The Terminal close script is stored separately, compiled with AppleScript tooling, packaged explicitly, and invoked only after a zero authentication exit status. A close-attempt log is retained in the authentication diagnostics directory.
# 0.17.6-platforms.1

All four platform payloads are assembled from the same generated frontend and Electron main process. Binary formats, required resources, version identity, executable permissions, macOS signatures, and archive integrity are checked locally. Apple Silicon macOS is the native build host. Intel macOS, Ubuntu x64, and Windows x64 packages are cross-assembled and require real-machine launch validation. Ubuntu remote authentication is implemented but also requires a real Linux desktop and SSH target. Windows remote access is intentionally disabled pending a separately validated authentication transport.
