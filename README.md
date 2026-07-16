# Brainana Viewer

Cross-platform NiiVue-based viewer for per-subject (`sub-*`) output from the `brainana`
Nextflow pipeline. This is the **source-first rebuild** (fresh `0.x` line) tracked in
`docs/technical-route-and-improvement-plan.md`.

> Status: **Phases 0–2 complete** (foundation, core platform, unified multi-source data path)
> and **Phase 3 (NiiVue frontend) substantially built** — the source-scoped, token-guarded SPA
> in `viewer/src/` (`dist/` is its Vite build). Remaining Phase 3 parity work (imported-volume
> projection, ROI generation) is staged in `viewer/src/data/{projection,roiWarp}.ts` and tested,
> but not yet wired into the UI. Phases 4–5 (packaging, full test/browser matrix) are ahead.

## Layout

An **npm-workspaces monorepo**: tool-agnostic shared `packages/*` consumed by per-tool `apps/*`.
Adding a sibling tool (Aligner, Editor) means a new `apps/<tool>/` — no duplicated platform code.
See [docs/adding-a-tool.md](docs/adding-a-tool.md).

```
packages/
  core-server/    tool-agnostic HTTP runtime, security, DataSource registry (local + SFTP), cache, export
  core-launcher/  cross-platform launch() (token → free port → server → open browser)
  core-client/    browser platform: runtime/source/filesystem clients, session, export, WebGL2 gate
  ui/             design-token theme (theme.css + fonts), h() DOM helper, generic components
  niivue-kit/     generic NiiVue helpers (orientation gizmo, markers)
  imaging-math/   pure headless math (ROI warp, volume→surface projection)
apps/
  viewer/         the Viewer: index.html + src/ (SPA) + server/ (manifest + FreeSurfer) + launch/server entries
scripts/          generate-version (per-app), workspace-aware test runner
tests/            headless server/security/sftp + domain-math + core-purity guard
apps/*/dist/      BUILD OUTPUT — gitignored
```

Cross-package imports use `@brainana/*` specifiers whose `exports` map points at **raw source**, so
Vite and Node's `.ts` type-stripping tests resolve identically (no build step in the test path).

## Requirements

- Node **>= 22.18** (the unit tests import `.ts` sources directly, relying on Node's type stripping)
- A modern desktop browser with **WebGL2** (Chrome/Edge baseline; Firefox/Safari supported)

## Develop

```sh
npm install                 # install workspace deps (single lockfile, hoisted node_modules)
npm run generate-version    # emit packages/core-server/version.mjs (‑‑app <name> to override identity)
npm test                    # headless: domain math, server, security, sftp, core-purity guard
npm start                   # launch the Viewer: free port, 127.0.0.1 bind, open browser
```

## Data sources

The server starts **unbound** and holds a registry of data sources. You add sources
in-app (no relaunch): a **local** folder or a **remote** workstation over SSH/SFTP.
Multiple sources can be loaded simultaneously; each subject is tagged with its `sourceId`
and file URLs are source-scoped (`/brainana-data/<sourceId>/<rel>`).

## Security

The server binds `127.0.0.1` only. Every `/api/*` and data request requires a
per-launch **session token** (timing-safe compare) that the launcher generates and the
server templates into `index.html` at serve time — so the token never appears in a URL
or browser history. See `core/server/security.mjs`.
