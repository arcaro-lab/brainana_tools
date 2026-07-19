# Changelog

All notable changes to Brainana Viewer are documented here.

## [1.0.0] — 2026-07-18

First public release of the Brainana Viewer as a cross-platform desktop app.

### Added
- **Core platform layer** (`packages/core-*`), tool-agnostic and reusable:
  - `runtime.mjs` — HTTP server factory that binds `127.0.0.1` and guards `/api/*`
    and data routes with a per-launch session token.
  - `security.mjs` — session token (timing-safe compare) + path containment helpers.
  - `dataSource.mjs` — `DataSource` interface + in-process source registry; the server
    starts **unbound** and holds `Map<sourceId, DataSource>`.
  - `localSource.mjs` — local filesystem data source.
  - `sftpSource.mjs` / `sftpClient.mjs` — non-blocking remote source over `ssh2`/SFTP
    (SFTP subsystem only; no code runs on the workstation), with an async cache.
  - `cache.mjs` — async remote-file cache (sha256 + size + mtime), atomic writes.
  - `export.mjs` — server-side save-list / mkdir / save-file, atomic temp + rename.
  - `packages/core-launcher/launch.mjs` — cross-platform launcher (free-port scan, token, open browser).
- **Viewer domain layer** (`apps/viewer/server/`): `manifest.mjs` + `freesurfer.mjs`, with
  flexible anat/fastsurfer discovery (flat `sub-*/anat` or session `sub-*/ses-*/anat`).
- **Source-scoped file URLs** (`/brainana-data/<sourceId>/<rel>`) enabling simultaneous
  multi-source loading; server binds loopback only and requires the session token.
- **Client platform layer** (`packages/core-client/`, TS): `runtimeClient` (token from meta tag →
  authed fetch), `sourceManager` (add/list/remove sources), `filesystemClient`
  (monkeys/manifest/browse per source), `sessionPersistence` (recents, no secrets),
  `exportDestination` (server-side export + ZIP fallback), `browserCapabilities` (WebGL2 gate).
- **In-app source chooser** (`apps/viewer/src/`): add local + remote sources and browse each
  source's subjects with a manifest summary, no relaunch. Vite build → `dist/`.
- `scripts/generate-version.mjs` — single source of version + build id.
- **Bundled demo dataset** (`datasets/demo_viewer/`): a trimmed `sub-example` derivatives
  tree (only Viewer-read files; FastSurfer intermediates and regenerable cache omitted) so
  the Viewer can be launched without preprocessing a subject. README, `dev_guideline.md`, and
  `data-contract.md` now point at it (`npm run server -- --output-dir datasets/demo_viewer`).
- CI skeleton (macOS/Linux/Windows matrix); headless tests for server, security, sftp,
  and the built frontend (token injection).
- **Desktop packaging + release pipeline**: electron-builder config
  (`apps/viewer/electron-builder.yml`) and a tag-triggered GitHub Actions release matrix
  (`.github/workflows/release.yml`) that builds Mac (Apple Silicon + Intel), Windows, and Linux
  installers and publishes them to a draft GitHub Release. Procedure: `docs/publishing.md`.

- **Phase 2 unified data path**: `packages/core-client` source manager + in-app source chooser
  (`apps/viewer/src/ui/dialogs/sources.ts`); simultaneous multi-source, source-scoped throughout.
- **Phase 3 NiiVue frontend (substantial)**: dual-instance `MultiView` renderer, surfaces,
  generic atlas overlays (ARM1-6, D99, MacBNA, FuncNetwork, and continuous scalar atlases such
  as CortHierarchy), retinotopy/somatotopy with F-threshold masking, morphology shading,
  yellow-marker modes, visual-field plot, and the unified Color-display section.
- **Generic atlas discovery + continuous atlases**: the manifest `atlases` field is now a flat
  array of `{name,label,volume,labels,surface}` built from every `atlas-<name>_space-*` label
  volume on disk (ARM ordered first), replacing the hardcoded `{charm,d99}` object. Float scalar
  atlases (e.g. CortHierarchy) are detected as non-parcellations and rendered with a continuous
  colormap over their nonzero value range on both the slices and the 3D mesh; atlas `.tsv`
  sidecars may carry an optional `color` column honored over the procedural golden-angle color.
- **Remote pre-add browse + source rename**: `POST /api/remote/connect`, `GET /api/remote/browse`,
  `POST /api/remote/disconnect` (a transient SSH/SFTP session for browsing a workstation before
  adding it — password sent once, never persisted) and `PATCH /api/sources/:id` to set a
  per-source `customLabel`.
- **Source dialog upgrades**: browse a remote host's folders before adding it, editable custom
  labels per source, a resizable dataset table, and saved remote connection profiles
  (host/port/user only; no passwords).
- **View preservation**: camera, active overlays (atlas/function/morphology), and display
  settings carry over when switching between subjects, so two monkeys compare 1:1.

### Known limitations
- **Unsigned installers** — no Apple Developer ID / Windows code-signing certificate yet, so
  macOS and Windows show a one-time "unidentified developer" prompt on first launch (see README).
- **Imported-volume surface projection & ROI generation** are staged and unit-tested in
  `packages/imaging-math/{projection,roiWarp}.ts` (a `projectionClient` + worker exists) but are
  not yet driven from any panel; snapshot/state/ZIP export UI is likewise not yet wired.
- The full **cross-browser / automated test matrix** (roadmap Phase 5) is still in progress; the
  desktop Electron build and the headless server/security/sftp/frontend tests are the current gate.
