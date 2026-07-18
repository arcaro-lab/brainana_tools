<p align="center">
  <img src="docs/_static/brainana_logo_side.png" alt="Brainana logo" width="500">
</p>

# Brainana Viewer

Cross-platform NiiVue viewer for per-subject (`sub-*`) output of the
[**Brainana**](https://github.com/xingyu-liu/brainana) macaque MRI pipeline.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL--v3-blue.svg)](LICENSE)

> **Status:** Source-first rebuild (fresh `0.x` line). Phases 0–2 complete
> (foundation, core platform, unified multi-source data path); Phase 3 (NiiVue SPA)
> substantially built; Phase 4 desktop packaging (Electron) built and verified, with a
> tag-triggered GitHub Actions release pipeline for Mac/Windows/Linux installers. The full
> browser/test matrix is still ahead. See [docs/technical-route.md](docs/technical-route.md).

## Download & install

Grab the app for your operating system from the **[Releases page](../../releases/latest)** — no
Node, no build, no command line. Pick the file that matches your system:

| Your system | Download |
| ----------- | -------- |
| **macOS — Apple Silicon** (M1/M2/M3…) | `Brainana Viewer-*-arm64.dmg` |
| **macOS — Intel** | `Brainana Viewer-*.dmg` |
| **Windows** | `Brainana Viewer Setup *.exe` |
| **Linux** | `Brainana Viewer-*.AppImage` or `brainana-viewer_*_amd64.deb` |

> **First launch:** the app is currently **unsigned**, so macOS and Windows show a one-time
> "unidentified developer" prompt. On macOS **right-click → Open**; on Windows choose **More info
> → Run anyway**. Linux has no prompt. Full per-OS steps are in
> [docs/publishing.md](docs/publishing.md#what-your-users-will-see-unsigned-build).

Not sure which Mac chip you have? **Apple menu → About This Mac.** No account, dataset, or setup
is required — a demo subject is bundled so you can open the app and look around immediately.

---

## For developers

Everything below is for building and contributing to the Viewer, not for using the app.

**Requirements:** **Node ≥ 22.18** (unit tests import `.ts` sources directly via Node type
stripping) and a WebGL2-capable browser (Chrome/Edge baseline; Firefox/Safari supported).

```sh
npm install                                                       # workspace deps (single lockfile)
npm run server -- --port 5174 --output-dir datasets/demo_viewer   # Terminal 1: API + bundled demo data
npm run dev:web                                                   # Terminal 2: Vite UI → http://localhost:5173
```

Open the URL Vite prints and select `sub-example`. Other common commands:

```sh
npm test               # headless: domain math, server, security, sftp, built-frontend token injection, core-purity guard
npm start              # launch the Viewer: free port, 127.0.0.1 bind, open browser
npm run dev:desktop    # launch as a native Electron app (bundled Chromium)
npm run dist:desktop   # build desktop installers for THIS OS → apps/viewer/release/
```

- [docs/dev_guideline.md](docs/dev_guideline.md) — two-process model, ports, troubleshooting.
- [docs/desktop-app.md](docs/desktop-app.md) — the Electron shell (how the desktop app is built).
- [docs/publishing.md](docs/publishing.md) — **how to publish a release** (tag → CI builds all-OS installers → GitHub Release).

## Architecture

An **npm-workspaces monorepo**: tool-agnostic shared `packages/*` consumed by per-tool
`apps/*`. Adding a sibling tool (Aligner, Editor) means a new `apps/<tool>/` — no duplicated
platform code ([docs/adding-a-tool.md](docs/adding-a-tool.md)).

| Package             | Responsibility                                                        |
| ------------------- | --------------------------------------------------------------------- |
| `core-server`       | HTTP runtime, security, DataSource registry (local + SFTP), cache, export |
| `core-launcher`     | `bootServer()` (token → free port → server) + `launch()` (opens browser)   |
| `core-desktop`      | Electron shell: `runDesktop()` loads the loopback URL natively        |
| `core-client`       | Browser platform: runtime/source/filesystem clients, session, WebGL2 gate |
| `ui` / `niivue-kit` | Design-token theme + DOM helpers / generic NiiVue helpers             |
| `imaging-math`      | Pure headless math (ROI warp, volume→surface projection)              |
| `apps/viewer`       | The Viewer: SPA + manifest/FreeSurfer server + launch/desktop entries |

Cross-package imports use `@brainana/*` specifiers whose `exports` map points at **raw
source**, so Vite and Node's `.ts` tests resolve identically — no build step in the test path.

## Data sources

The server starts **unbound** and holds a registry of sources you add in-app without a
relaunch: a **local** folder or a **remote** workstation over SSH/SFTP. Multiple sources
load simultaneously; each subject is tagged with its `sourceId` and file URLs are
source-scoped (`/brainana-data/<sourceId>/<rel>`).

## Security

The server binds `127.0.0.1` only. Every `/api/*` and data request requires a per-launch
**session token** (timing-safe compare) that the launcher generates and the server templates
into `index.html` at serve time — so the token never appears in a URL or browser history.
See `packages/core-server/security.mjs`.

## License

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0), the same license
as the parent [**Brainana**](https://github.com/xingyu-liu/brainana) pipeline. See
[LICENSE](LICENSE). Bundled fonts (Source Sans 3, IBM Plex Mono) are under the SIL Open Font
License 1.1 ([packages/ui/fonts/](packages/ui/fonts/)); full dependency inventory in
[docs/dependency-audit.md](docs/dependency-audit.md).
